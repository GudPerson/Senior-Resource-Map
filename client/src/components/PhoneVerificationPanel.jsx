import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import {
    getWhatsAppUrl,
    isSafeWhatsAppUrl,
    mergePhoneVerificationChallenge,
} from '../lib/phoneVerificationState.js';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

function clean(value) {
    return String(value || '').trim();
}

function classifyError(message) {
    const text = String(message || '').toLowerCase();
    if (
        text.includes('manual review')
        || text.includes('more than one account')
        || text.includes('already linked')
        || text.includes('another account')
        || text.includes('different phone identity')
    ) {
        return 'manual_review';
    }
    if (text.includes('valid singapore phone')) return 'not_verified';
    return null;
}

function normalizeStatus(status) {
    if (status === 'manualReview') return 'manual_review';
    return String(status || '').trim().toLowerCase();
}

function translateReason(t, reason) {
    if (!reason) return '';
    const key = `phoneVerificationReason_${reason}`;
    const message = t(key);
    return message === key ? '' : message;
}

export default function PhoneVerificationPanel({ savedPhone, draftPhone, t }) {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('loading');
    const [displayPhone, setDisplayPhone] = useState('');
    const [attemptId, setAttemptId] = useState(null);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const pollUntilRef = useRef(0);

    const savedPhoneText = clean(savedPhone);
    const draftPhoneText = clean(draftPhone);
    const hasUnsavedPhone = savedPhoneText !== draftPhoneText;
    const hasSavedPhone = Boolean(savedPhoneText);

    const applySummary = useCallback((summary) => {
        const nextIdentity = summary?.identity || null;
        const nextStatus = normalizeStatus(nextIdentity?.status);
        setDisplayPhone(nextIdentity?.phone || summary?.profilePhone || '');
        setChallenge(null);
        setAttemptId(null);
        setError('');
        if (nextStatus === 'verified') {
            setStatus('verified');
        } else {
            setStatus('not_verified');
        }
    }, []);

    const refreshSummary = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const summary = await api.getMyPhoneIdentity();
            applySummary(summary);
        } catch (err) {
            setError(err.message || t('phoneVerificationLoadFailed'));
            setStatus('not_verified');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [applySummary, t]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const summary = await api.getMyPhoneIdentity();
                if (!cancelled) applySummary(summary);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || t('phoneVerificationLoadFailed'));
                    setStatus('not_verified');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [applySummary, savedPhoneText, t]);

    const applyAttempt = useCallback((result) => {
        const nextStatus = normalizeStatus(result?.status);
        setDisplayPhone(result?.identity?.phone || result?.phone || displayPhone);
        setChallenge((previousChallenge) => mergePhoneVerificationChallenge(
            previousChallenge,
            result?.challenge || null,
            nextStatus,
        ));
        setError(translateReason(t, result?.reason));

        if (result?.attemptId) setAttemptId(result.attemptId);

        if (nextStatus === 'verified') {
            setStatus('verified');
            setAttemptId(null);
            pollUntilRef.current = 0;
        } else if (nextStatus === 'failed' || nextStatus === 'expired') {
            setStatus(nextStatus);
            setAttemptId(null);
            pollUntilRef.current = 0;
        } else if (nextStatus === 'conflict' || nextStatus === 'manual_review') {
            setStatus('manual_review');
            setAttemptId(null);
            pollUntilRef.current = 0;
        } else {
            setStatus('pending');
        }
    }, [displayPhone, t]);

    const pollAttempt = useCallback(async ({ manual = false } = {}) => {
        if (!attemptId) return;
        if (manual) setActionBusy(true);
        try {
            const result = await api.getPhoneIdentityLinkAttempt(attemptId);
            applyAttempt(result);
        } catch (err) {
            const classified = classifyError(err.message);
            if (classified === 'manual_review') {
                setStatus('manual_review');
                setAttemptId(null);
            }
            setError(err.message || t('phoneVerificationPollFailed'));
        } finally {
            if (manual) setActionBusy(false);
        }
    }, [applyAttempt, attemptId, t]);

    useEffect(() => {
        if (!attemptId || status !== 'pending') return undefined;
        if (pollUntilRef.current && Date.now() >= pollUntilRef.current) {
            setStatus('expired');
            setAttemptId(null);
            setError(t('phoneVerificationTimedOut'));
            return undefined;
        }

        const timer = window.setTimeout(() => {
            pollAttempt();
        }, POLL_INTERVAL_MS);

        return () => window.clearTimeout(timer);
    }, [attemptId, pollAttempt, status, t]);

    async function startVerification() {
        if (hasUnsavedPhone || !hasSavedPhone || actionBusy) return;
        setActionBusy(true);
        setError('');
        try {
            const result = await api.startPhoneIdentityLink({ phone: savedPhoneText });
            pollUntilRef.current = Date.now() + POLL_TIMEOUT_MS;
            applyAttempt(result);
        } catch (err) {
            const classified = classifyError(err.message);
            if (classified === 'manual_review') setStatus('manual_review');
            setError(err.message || t('phoneVerificationStartFailed'));
        } finally {
            setActionBusy(false);
        }
    }

    const view = useMemo(() => {
        if (loading || status === 'loading') {
            return {
                icon: RefreshCw,
                iconClass: 'text-slate-600',
                badgeClass: 'bg-slate-100 text-slate-700',
                badge: t('phoneVerificationCheckingBadge'),
                title: t('phoneVerificationCheckingTitle'),
                body: t('phoneVerificationCheckingBody'),
            };
        }

        if (hasUnsavedPhone) {
            return {
                icon: AlertTriangle,
                iconClass: 'text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-800',
                badge: t('phoneVerificationSaveFirstBadge'),
                title: t('phoneVerificationSaveFirstTitle'),
                body: t('phoneVerificationSaveFirstBody'),
            };
        }

        if (!hasSavedPhone) {
            return {
                icon: AlertTriangle,
                iconClass: 'text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-800',
                badge: t('phoneVerificationNotReadyBadge'),
                title: t('phoneVerificationNoPhoneTitle'),
                body: t('phoneVerificationNoPhoneBody'),
            };
        }

        if (status === 'verified') {
            return {
                icon: CheckCircle2,
                iconClass: 'text-green-700',
                badgeClass: 'bg-green-100 text-green-800',
                badge: t('phoneVerificationVerifiedBadge'),
                title: t('phoneVerificationVerifiedTitle'),
                body: t('phoneVerificationVerifiedBody'),
            };
        }

        if (status === 'pending') {
            return {
                icon: Clock,
                iconClass: 'text-blue-700',
                badgeClass: 'bg-blue-100 text-blue-800',
                badge: t('phoneVerificationPendingBadge'),
                title: t('phoneVerificationPendingTitle'),
                body: t('phoneVerificationPendingBody'),
            };
        }

        if (status === 'failed' || status === 'expired') {
            return {
                icon: AlertTriangle,
                iconClass: 'text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-800',
                badge: t('phoneVerificationTryAgainBadge'),
                title: t('phoneVerificationFailedTitle'),
                body: t('phoneVerificationFailedBody'),
            };
        }

        if (status === 'manual_review' || status === 'conflict') {
            return {
                icon: AlertTriangle,
                iconClass: 'text-red-700',
                badgeClass: 'bg-red-100 text-red-800',
                badge: t('phoneVerificationReviewBadge'),
                title: t('phoneVerificationReviewTitle'),
                body: t('phoneVerificationReviewBody'),
            };
        }

        return {
            icon: ShieldCheck,
            iconClass: 'text-brand-700',
            badgeClass: 'bg-brand-50 text-brand-700',
            badge: t('phoneVerificationNotVerifiedBadge'),
            title: t('phoneVerificationNotVerifiedTitle'),
            body: t('phoneVerificationNotVerifiedBody'),
        };
    }, [hasSavedPhone, hasUnsavedPhone, loading, status, t]);

    const Icon = view.icon;
    const canStart = hasSavedPhone && !hasUnsavedPhone && !actionBusy && !loading && status !== 'pending';
    const canManualPoll = attemptId && status === 'pending' && !actionBusy;
    const showStartButton = !loading && !['verified', 'pending', 'manual_review', 'conflict'].includes(status);
    const whatsappUrl = getWhatsAppUrl(challenge);

    return (
        <section className="rounded-2xl border border-brand-100 bg-brand-50/40 px-4 py-4">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <Icon size={20} className={view.iconClass} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-bold text-slate-900">{view.title}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${view.badgeClass}`}>
                            {view.badge}
                        </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{view.body}</p>
                    {displayPhone ? (
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                            {t('phoneVerificationLinkedPhone', { phone: displayPhone })}
                        </p>
                    ) : null}
                    {challenge?.message ? (
                        <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                            {challenge.message}
                        </p>
                    ) : null}
                    {error ? (
                        <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                            {error}
                        </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                        {showStartButton ? (
                            <button
                                type="button"
                                disabled={!canStart}
                                onClick={startVerification}
                                className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {actionBusy ? (
                                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                    <MessageCircle size={16} />
                                )}
                                {status === 'failed' || status === 'expired'
                                    ? t('phoneVerificationTryAgainButton')
                                    : t('phoneVerificationStartButton')}
                            </button>
                        ) : null}

                        {canManualPoll ? (
                            <button
                                type="button"
                                onClick={() => pollAttempt({ manual: true })}
                                className="btn-ghost px-4 py-2 text-sm"
                            >
                                <RefreshCw size={16} />
                                {t('phoneVerificationCheckAgainButton')}
                            </button>
                        ) : null}

                        {status === 'pending' && isSafeWhatsAppUrl(whatsappUrl) ? (
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost px-4 py-2 text-sm"
                            >
                                <MessageCircle size={16} />
                                {t('phoneVerificationOpenWhatsAppButton')}
                            </a>
                        ) : null}

                        {status === 'verified' ? (
                            <button
                                type="button"
                                onClick={() => refreshSummary()}
                                disabled={loading || actionBusy}
                                className="btn-ghost px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw size={16} />
                                {t('phoneVerificationRefreshButton')}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
}
