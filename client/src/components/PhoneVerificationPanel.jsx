import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import {
    getWhatsAppUrl,
    isGudAuthPhoneLinkReturn,
    isSafeWhatsAppUrl,
    mergePhoneVerificationChallenge,
} from '../lib/phoneVerificationState.js';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;
const STORED_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const STORED_ATTEMPT_KEY = 'carearound-phone-link-attempt';

function clean(value) {
    return String(value || '').trim();
}

function readStoredPhoneLinkAttempt(savedPhoneText = '') {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(STORED_ATTEMPT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const attemptId = Number.parseInt(String(parsed?.attemptId || ''), 10);
        const expiresAt = Number.parseInt(String(parsed?.expiresAt || ''), 10);
        const phone = clean(parsed?.phone);

        if (!attemptId || !expiresAt || Date.now() > expiresAt) {
            window.localStorage.removeItem(STORED_ATTEMPT_KEY);
            return null;
        }

        if (phone && clean(savedPhoneText) && phone !== clean(savedPhoneText)) {
            return null;
        }

        return { attemptId, phone };
    } catch {
        try {
            window.localStorage.removeItem(STORED_ATTEMPT_KEY);
        } catch {
            // Ignore storage cleanup failures.
        }
        return null;
    }
}

function writeStoredPhoneLinkAttempt(attemptId, savedPhoneText = '') {
    if (typeof window === 'undefined') return;

    const normalizedAttemptId = Number.parseInt(String(attemptId || ''), 10);
    if (!normalizedAttemptId) return;

    try {
        window.localStorage.setItem(STORED_ATTEMPT_KEY, JSON.stringify({
            attemptId: normalizedAttemptId,
            phone: clean(savedPhoneText),
            expiresAt: Date.now() + STORED_ATTEMPT_TTL_MS,
        }));
    } catch {
        // Ignore storage failures; the Check again button remains the fallback.
    }
}

function clearStoredPhoneLinkAttempt() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORED_ATTEMPT_KEY);
    } catch {
        // Ignore storage failures.
    }
}

function prepareWhatsAppLaunchWindow() {
    if (typeof window === 'undefined') return null;

    try {
        return window.open('', '_blank');
    } catch {
        return null;
    }
}

function launchPreparedWhatsAppWindow(preparedWindow, whatsappUrl) {
    const safeUrl = isSafeWhatsAppUrl(whatsappUrl) ? whatsappUrl : '';
    if (!safeUrl) {
        try {
            preparedWindow?.close?.();
        } catch {
            // Ignore window cleanup failures.
        }
        return false;
    }

    try {
        if (preparedWindow && !preparedWindow.closed) {
            preparedWindow.opener = null;
            preparedWindow.location.href = safeUrl;
            return true;
        }
    } catch {
        // Fall through to a direct open attempt.
    }

    try {
        return Boolean(window.open(safeUrl, '_blank', 'noopener,noreferrer'));
    } catch {
        return false;
    }
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
    const [currentVerifiedPhone, setCurrentVerifiedPhone] = useState('');
    const [attemptId, setAttemptId] = useState(null);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const pollUntilRef = useRef(0);
    const pollInFlightRef = useRef(false);

    const savedPhoneText = clean(savedPhone);
    const draftPhoneText = clean(draftPhone);
    const hasUnsavedPhone = savedPhoneText !== draftPhoneText;
    const hasSavedPhone = Boolean(savedPhoneText);

    const applySummary = useCallback((summary) => {
        const nextIdentity = summary?.identity || null;
        const nextStatus = normalizeStatus(nextIdentity?.status);
        const profilePhone = summary?.profilePhone || '';
        const identityPhone = nextIdentity?.phone || '';
        const storedAttempt = readStoredPhoneLinkAttempt(savedPhoneText);
        setCurrentVerifiedPhone(nextStatus === 'verified' ? identityPhone : '');
        setDisplayPhone(profilePhone || identityPhone);
        setError('');
        if (nextStatus === 'verified' && summary?.profilePhoneMatchesIdentity !== false) {
            clearStoredPhoneLinkAttempt();
            setChallenge(null);
            setAttemptId(null);
            setStatus('verified');
        } else if (storedAttempt?.attemptId) {
            setAttemptId(storedAttempt.attemptId);
            pollUntilRef.current = Date.now() + POLL_TIMEOUT_MS;
            setStatus('pending');
        } else if (nextStatus === 'verified' && summary?.profilePhoneNeedsVerification) {
            setChallenge(null);
            setAttemptId(null);
            setStatus('phone_changed');
        } else {
            setChallenge(null);
            setAttemptId(null);
            setStatus('not_verified');
        }
    }, [savedPhoneText]);

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
            clearStoredPhoneLinkAttempt();
            setCurrentVerifiedPhone(result?.identity?.phone || result?.phone || '');
            setStatus('verified');
            setAttemptId(null);
            pollUntilRef.current = 0;
        } else if (nextStatus === 'failed' || nextStatus === 'expired') {
            clearStoredPhoneLinkAttempt();
            setStatus(nextStatus);
            setAttemptId(null);
            pollUntilRef.current = 0;
        } else if (nextStatus === 'conflict' || nextStatus === 'manual_review') {
            clearStoredPhoneLinkAttempt();
            setStatus('manual_review');
            setAttemptId(null);
            pollUntilRef.current = 0;
        } else {
            if (result?.attemptId) writeStoredPhoneLinkAttempt(result.attemptId, savedPhoneText);
            setStatus('pending');
        }
    }, [displayPhone, savedPhoneText, t]);

    const pollAttemptById = useCallback(async (id, { manual = false } = {}) => {
        const normalizedAttemptId = Number.parseInt(String(id || ''), 10);
        if (!normalizedAttemptId || pollInFlightRef.current) return;

        pollInFlightRef.current = true;
        if (manual) setActionBusy(true);
        try {
            const result = await api.getPhoneIdentityLinkAttempt(normalizedAttemptId);
            applyAttempt(result);
        } catch (err) {
            const classified = classifyError(err.message);
            if (classified === 'manual_review') {
                setStatus('manual_review');
                setAttemptId(null);
                clearStoredPhoneLinkAttempt();
            }
            setError(err.message || t('phoneVerificationPollFailed'));
        } finally {
            pollInFlightRef.current = false;
            if (manual) setActionBusy(false);
        }
    }, [applyAttempt, t]);

    const pollAttempt = useCallback(async ({ manual = false } = {}) => {
        await pollAttemptById(attemptId, { manual });
    }, [attemptId, pollAttemptById]);

    const restoreStoredAttemptAndPoll = useCallback(() => {
        const storedAttempt = readStoredPhoneLinkAttempt(savedPhoneText);
        if (!storedAttempt?.attemptId) return;

        setAttemptId(storedAttempt.attemptId);
        pollUntilRef.current = Date.now() + POLL_TIMEOUT_MS;
        setStatus((currentStatus) => (currentStatus === 'verified' ? currentStatus : 'pending'));
        pollAttemptById(storedAttempt.attemptId);
    }, [pollAttemptById, savedPhoneText]);

    useEffect(() => {
        if (!attemptId || status !== 'pending') return undefined;

        const runPoll = () => {
            if (pollUntilRef.current && Date.now() >= pollUntilRef.current) {
                clearStoredPhoneLinkAttempt();
                setStatus('expired');
                setAttemptId(null);
                setError(t('phoneVerificationTimedOut'));
                return;
            }

            pollAttempt();
        };

        const interval = window.setInterval(runPoll, POLL_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [attemptId, pollAttempt, status, t]);

    async function startVerification() {
        if (hasUnsavedPhone || !hasSavedPhone || actionBusy) return;
        const preparedWhatsAppWindow = prepareWhatsAppLaunchWindow();
        setActionBusy(true);
        setError('');
        try {
            const result = await api.startPhoneIdentityLink({ phone: savedPhoneText });
            pollUntilRef.current = Date.now() + POLL_TIMEOUT_MS;
            if (result?.attemptId) writeStoredPhoneLinkAttempt(result.attemptId, savedPhoneText);
            applyAttempt(result);
            launchPreparedWhatsAppWindow(preparedWhatsAppWindow, getWhatsAppUrl(result?.challenge));
        } catch (err) {
            try {
                preparedWhatsAppWindow?.close?.();
            } catch {
                // Ignore window cleanup failures.
            }
            const classified = classifyError(err.message);
            if (classified === 'manual_review') setStatus('manual_review');
            setError(err.message || t('phoneVerificationStartFailed'));
        } finally {
            setActionBusy(false);
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (!isGudAuthPhoneLinkReturn(window.location.search)) return undefined;

        restoreStoredAttemptAndPoll();

        const url = new URL(window.location.href);
        url.searchParams.delete('gudauth');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        return undefined;
    }, [restoreStoredAttemptAndPoll]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

        const handleFocus = () => restoreStoredAttemptAndPoll();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') restoreStoredAttemptAndPoll();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [restoreStoredAttemptAndPoll]);

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

        if (status === 'phone_changed') {
            return {
                icon: AlertTriangle,
                iconClass: 'text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-800',
                badge: t('phoneVerificationChangeBadge'),
                title: t('phoneVerificationChangeTitle'),
                body: t('phoneVerificationChangeBody'),
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
                            {status === 'phone_changed'
                                ? t('phoneVerificationNewPhone', { phone: displayPhone })
                                : t('phoneVerificationLinkedPhone', { phone: displayPhone })}
                        </p>
                    ) : null}
                    {status === 'phone_changed' && currentVerifiedPhone ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            {t('phoneVerificationCurrentVerifiedPhone', { phone: currentVerifiedPhone })}
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
                                    : status === 'phone_changed'
                                        ? t('phoneVerificationChangeButton')
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
                    </div>
                </div>
            </div>
        </section>
    );
}
