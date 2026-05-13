import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { api } from '../lib/api.js';
import {
    getPreferredWhatsAppLaunchUrl,
    getWhatsAppUrl,
    isGudAuthPhoneLinkReturn,
    isLikelyMobileDevice,
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

function escapePreparedWindowText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function prepareWhatsAppLaunchWindow(
    message = 'Opening WhatsApp...',
    body = 'Please wait while CareAround prepares your WhatsApp code.',
) {
    if (typeof window === 'undefined') return null;

    try {
        const preparedWindow = window.open('', '_blank');
        if (!preparedWindow) return null;

        const safeMessage = escapePreparedWindowText(message);
        const safeBody = escapePreparedWindowText(body);
        preparedWindow.document.open();
        preparedWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeMessage}</title>
    <style>
      body {
        align-items: center;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
        min-height: 100dvh;
        -webkit-text-size-adjust: 100%;
      }
      main {
        max-width: 28rem;
        padding: 2rem;
        text-align: center;
      }
      .spinner {
        animation: spin 0.9s linear infinite;
        border: 4px solid #ccfbf1;
        border-top-color: #0f9f96;
        border-radius: 999px;
        height: 3rem;
        margin: 0 auto 1rem;
        width: 3rem;
      }
      h1 {
        font-size: 1.25rem;
        margin: 0;
      }
      p {
        color: #64748b;
        line-height: 1.6;
        margin: 0.75rem 0 0;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @media (pointer: coarse) {
        body {
          align-items: flex-start;
          padding-top: 16vh;
        }
        main {
          box-sizing: border-box;
          max-width: none;
          width: 100%;
        }
        .spinner {
          border-width: 6px;
          height: clamp(4.5rem, 14vw, 8rem);
          margin-bottom: 1.25rem;
          width: clamp(4.5rem, 14vw, 8rem);
        }
        h1 {
          font-size: clamp(2rem, 7vw, 4rem);
        }
        p {
          font-size: clamp(1.25rem, 4vw, 2.25rem);
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spinner" aria-hidden="true"></div>
      <h1>${safeMessage}</h1>
      <p>${safeBody}</p>
    </main>
  </body>
</html>`);
        preparedWindow.document.close();
        return preparedWindow;
    } catch {
        return null;
    }
}

function writeWhatsAppRedirectWindow(preparedWindow, launchUrl) {
    const safeLaunchUrl = escapePreparedWindowText(launchUrl);
    const scriptLaunchUrl = JSON.stringify(launchUrl).replace(/</g, '\\u003c');

    preparedWindow.document.open();
    preparedWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${safeLaunchUrl}" />
    <title>Opening WhatsApp...</title>
    <style>
      body {
        align-items: center;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
        min-height: 100dvh;
        -webkit-text-size-adjust: 100%;
      }
      main {
        box-sizing: border-box;
        max-width: 28rem;
        padding: 2rem;
        text-align: center;
      }
      .spinner {
        animation: spin 0.9s linear infinite;
        border: 4px solid #ccfbf1;
        border-top-color: #0f9f96;
        border-radius: 999px;
        height: 3rem;
        margin: 0 auto 1rem;
        width: 3rem;
      }
      h1 {
        font-size: 1.25rem;
        margin: 0;
      }
      p {
        color: #64748b;
        line-height: 1.6;
        margin: 0.75rem 0 0;
      }
      a {
        align-items: center;
        background: #0f9f96;
        border-radius: 999px;
        color: white;
        display: inline-flex;
        font-weight: 700;
        justify-content: center;
        margin-top: 1.25rem;
        min-height: 3rem;
        padding: 0 1.5rem;
        text-decoration: none;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @media (pointer: coarse) {
        body {
          align-items: flex-start;
          padding-top: 16vh;
        }
        main {
          max-width: none;
          width: 100%;
        }
        .spinner {
          border-width: 6px;
          height: clamp(4.5rem, 14vw, 8rem);
          margin-bottom: 1.25rem;
          width: clamp(4.5rem, 14vw, 8rem);
        }
        h1 {
          font-size: clamp(2rem, 7vw, 4rem);
        }
        p {
          font-size: clamp(1.25rem, 4vw, 2.25rem);
        }
        a {
          font-size: clamp(1.25rem, 4vw, 2rem);
          min-height: 4rem;
          padding: 0 2rem;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spinner" aria-hidden="true"></div>
      <h1>Opening WhatsApp...</h1>
      <p>If WhatsApp does not open automatically, tap the button below.</p>
      <a href="${safeLaunchUrl}" id="open-whatsapp">Open WhatsApp</a>
    </main>
    <script>
      const launchUrl = ${scriptLaunchUrl};
      const openWhatsApp = () => {
        window.location.href = launchUrl;
      };
      setTimeout(openWhatsApp, 0);
      setTimeout(openWhatsApp, 400);
      document.getElementById('open-whatsapp')?.addEventListener('click', openWhatsApp);
    </script>
  </body>
</html>`);
    preparedWindow.document.close();
}

function launchPreparedWhatsAppWindow(preparedWindow, whatsappUrl) {
    const launchUrl = getPreferredWhatsAppLaunchUrl(whatsappUrl, {
        preferNative: typeof navigator !== 'undefined' && isLikelyMobileDevice(navigator),
    });
    if (!launchUrl) {
        try {
            preparedWindow?.close?.();
        } catch {
            // Ignore window cleanup failures.
        }
        return false;
    }

    try {
        if (preparedWindow && !preparedWindow.closed) {
            writeWhatsAppRedirectWindow(preparedWindow, launchUrl);
            return true;
        }
    } catch {
        // Fall through to a direct open attempt.
    }

    try {
        return Boolean(window.open(launchUrl, '_blank', 'noopener,noreferrer'));
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
    const [hasLinkedIdentity, setHasLinkedIdentity] = useState(false);
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
        const identityIsVerified = nextStatus === 'verified';
        const storedAttempt = readStoredPhoneLinkAttempt(savedPhoneText);
        setHasLinkedIdentity(Boolean(nextIdentity));
        setCurrentVerifiedPhone(identityIsVerified ? identityPhone : '');
        setDisplayPhone(profilePhone || identityPhone);
        setError('');
        if (identityIsVerified && !profilePhone && identityPhone) {
            clearStoredPhoneLinkAttempt();
            setChallenge(null);
            setAttemptId(null);
            setStatus('linked_without_profile_phone');
        } else if (identityIsVerified && summary?.profilePhoneMatchesIdentity !== false) {
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
        const preparedWhatsAppWindow = prepareWhatsAppLaunchWindow(
            t('phoneLoginOpeningWhatsApp'),
            t('phoneLoginPreparingWhatsAppCode'),
        );
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

    async function unlinkVerification() {
        if (!hasLinkedIdentity || actionBusy) return;
        if (typeof window !== 'undefined' && !window.confirm(t('phoneVerificationRemoveConfirm'))) return;

        setActionBusy(true);
        setError('');
        try {
            const summary = await api.unlinkMyPhoneIdentity();
            clearStoredPhoneLinkAttempt();
            pollUntilRef.current = 0;
            setAttemptId(null);
            setChallenge(null);
            applySummary(summary);
        } catch (err) {
            setError(err.code === 'phone_recovery_required'
                ? t('phoneVerificationReason_phone_recovery_required')
                : err.message || t('phoneVerificationRemoveFailed'));
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

        if (status === 'linked_without_profile_phone') {
            return {
                icon: AlertTriangle,
                iconClass: 'text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-800',
                badge: t('phoneVerificationLinkedWithoutProfileBadge'),
                title: t('phoneVerificationLinkedWithoutProfileTitle'),
                body: t('phoneVerificationLinkedWithoutProfileBody'),
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
    const showStartButton = !loading && !['verified', 'pending', 'manual_review', 'conflict', 'linked_without_profile_phone'].includes(status);
    const showRemoveButton = !loading
        && hasLinkedIdentity
        && Boolean(currentVerifiedPhone)
        && !actionBusy
        && ['verified', 'phone_changed', 'linked_without_profile_phone'].includes(status);
    const whatsappUrl = getWhatsAppUrl(challenge);
    const whatsappLaunchUrl = getPreferredWhatsAppLaunchUrl(whatsappUrl, {
        preferNative: typeof navigator !== 'undefined' && isLikelyMobileDevice(navigator),
    });
    const whatsappLaunchIsNative = whatsappLaunchUrl.startsWith('whatsapp://');
    const phoneLabel = status === 'phone_changed'
        ? t('phoneVerificationNewPhone', { phone: displayPhone })
        : status === 'linked_without_profile_phone'
            ? t('phoneVerificationCurrentVerifiedPhone', { phone: displayPhone })
            : t('phoneVerificationLinkedPhone', { phone: displayPhone });

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
                            {phoneLabel}
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

                        {status === 'pending' && isSafeWhatsAppUrl(whatsappLaunchUrl) ? (
                            <a
                                href={whatsappLaunchUrl}
                                target={whatsappLaunchIsNative ? undefined : '_blank'}
                                rel={whatsappLaunchIsNative ? undefined : 'noreferrer'}
                                className="btn-ghost px-4 py-2 text-sm"
                            >
                                <MessageCircle size={16} />
                                {t('phoneVerificationOpenWhatsAppButton')}
                            </a>
                        ) : null}

                        {showRemoveButton ? (
                            <button
                                type="button"
                                onClick={unlinkVerification}
                                className="btn-ghost px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                            >
                                <Unlink size={16} />
                                {t('phoneVerificationRemoveButton')}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
}
