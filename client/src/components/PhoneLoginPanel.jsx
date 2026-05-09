import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, Phone, RefreshCw, UserPlus } from 'lucide-react';

import { api } from '../lib/api.js';
import {
    getPreferredWhatsAppLaunchUrl,
    getWhatsAppUrl,
    isGudAuthPhoneLoginReturn,
    isLikelyMobileDevice,
    isSafeWhatsAppUrl,
    mergePhoneVerificationChallenge,
    shouldUsePreparedWhatsAppWindow,
} from '../lib/phoneVerificationState.js';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;
const STORED_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const STORED_ATTEMPT_KEY = 'carearound-phone-login-attempt';

function clean(value) {
    return String(value || '').trim();
}

function normalizeStatus(status) {
    return String(status || '').trim().toLowerCase();
}

function friendlyErrorMessage(message, t) {
    const text = String(message || '').trim();
    const lower = text.toLowerCase();
    if (
        lower.includes('externaluserid')
        || lower.includes('invalid input')
        || lower.includes('provider')
        || lower.includes('gudauth')
    ) {
        return t('phoneLoginProviderSetupError');
    }
    return text || t('phoneLoginGenericError');
}

function readStoredPhoneLoginAttempt() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(STORED_ATTEMPT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const attemptId = Number.parseInt(String(parsed?.attemptId || ''), 10);
        const expiresAt = Number.parseInt(String(parsed?.expiresAt || ''), 10);
        if (!attemptId || !expiresAt || Date.now() > expiresAt) {
            window.localStorage.removeItem(STORED_ATTEMPT_KEY);
            return null;
        }
        return {
            attemptId,
            phone: clean(parsed?.phone),
            returnTo: clean(parsed?.returnTo),
        };
    } catch {
        try {
            window.localStorage.removeItem(STORED_ATTEMPT_KEY);
        } catch {
            // Ignore storage cleanup failures.
        }
        return null;
    }
}

function writeStoredPhoneLoginAttempt(attemptId, phone, returnTo) {
    if (typeof window === 'undefined') return;

    const normalizedAttemptId = Number.parseInt(String(attemptId || ''), 10);
    if (!normalizedAttemptId) return;

    try {
        window.localStorage.setItem(STORED_ATTEMPT_KEY, JSON.stringify({
            attemptId: normalizedAttemptId,
            phone: clean(phone),
            returnTo: clean(returnTo),
            expiresAt: Date.now() + STORED_ATTEMPT_TTL_MS,
        }));
    } catch {
        // Ignore storage failures; active polling still continues in the current tab.
    }
}

function clearStoredPhoneLoginAttempt() {
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

function launchPreparedWhatsAppWindow(preparedWindow, whatsappUrl) {
    const mobileDevice = typeof navigator !== 'undefined' && isLikelyMobileDevice(navigator.userAgent);
    const launchUrl = getPreferredWhatsAppLaunchUrl(whatsappUrl, {
        preferNative: mobileDevice,
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
            preparedWindow.opener = null;
            preparedWindow.location.href = launchUrl;
            return true;
        }
    } catch {
        // Fall through to a direct open attempt.
    }

    if (mobileDevice) {
        try {
            window.location.href = launchUrl;
            return true;
        } catch {
            return false;
        }
    }

    try {
        return Boolean(window.open(launchUrl, '_blank', 'noopener,noreferrer'));
    } catch {
        return false;
    }
}

function statusView(status, t) {
    if (status === 'starting') {
        return {
            icon: RefreshCw,
            iconClass: 'text-brand-700',
            title: t('phoneLoginOpeningWhatsApp'),
            body: t('phoneLoginCheckingAutomatically'),
        };
    }

    if (status === 'pending') {
        return {
            icon: Clock,
            iconClass: 'text-blue-700',
            title: t('phoneLoginPendingTitle'),
            body: t('phoneLoginPendingBody'),
        };
    }

    if (status === 'verified') {
        return {
            icon: CheckCircle2,
            iconClass: 'text-green-700',
            title: t('phoneLoginVerifiedTitle'),
            body: t('phoneLoginVerifiedBody'),
        };
    }

    if (status === 'no_account') {
        return {
            icon: AlertTriangle,
            iconClass: 'text-amber-700',
            title: t('phoneLoginNoAccountTitle'),
            body: t('phoneLoginNoAccountBody'),
        };
    }

    if (status === 'signup_required') {
        return {
            icon: UserPlus,
            iconClass: 'text-brand-700',
            title: t('phoneLoginSignupTitle'),
            body: t('phoneLoginSignupBody'),
        };
    }

    if (status === 'conflict') {
        return {
            icon: AlertTriangle,
            iconClass: 'text-red-700',
            title: t('phoneLoginConflictTitle'),
            body: t('phoneLoginConflictBody'),
        };
    }

    if (status === 'expired') {
        return {
            icon: AlertTriangle,
            iconClass: 'text-amber-700',
            title: t('phoneLoginExpiredTitle'),
            body: t('phoneLoginExpiredBody'),
        };
    }

    if (status === 'failed') {
        return {
            icon: AlertTriangle,
            iconClass: 'text-amber-700',
            title: t('phoneLoginFailedTitle'),
            body: t('phoneLoginFailedBody'),
        };
    }

    return {
        icon: MessageCircle,
        iconClass: 'text-brand-700',
        title: t('phoneLoginEntryTitle'),
        body: t('phoneLoginEntryBody'),
    };
}

export default function PhoneLoginPanel({ t, returnTo = '', onSignedIn }) {
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState('idle');
    const [attemptId, setAttemptId] = useState(null);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [signupForm, setSignupForm] = useState({ name: '', postalCode: '' });
    const [signupBusy, setSignupBusy] = useState(false);
    const pollUntilRef = useRef(0);
    const pollInFlightRef = useRef(false);
    const returnToRef = useRef(clean(returnTo));

    useEffect(() => {
        returnToRef.current = clean(returnTo);
    }, [returnTo]);

    const finishWithResult = useCallback((result) => {
        const nextStatus = normalizeStatus(result?.status);
        const storedAttempt = readStoredPhoneLoginAttempt();
        setChallenge((previousChallenge) => mergePhoneVerificationChallenge(
            previousChallenge,
            result?.challenge || null,
            nextStatus,
        ));
        setError(nextStatus === 'signup_required' ? '' : (result?.message || ''));
        if (result?.attemptId) setAttemptId(result.attemptId);

        if (nextStatus === 'verified' && result?.user) {
            clearStoredPhoneLoginAttempt();
            setStatus('verified');
            setAttemptId(null);
            pollUntilRef.current = 0;
            onSignedIn(result.user, storedAttempt?.returnTo || returnToRef.current);
            return;
        }

        if (nextStatus === 'signup_required') {
            if (result?.attemptId) {
                writeStoredPhoneLoginAttempt(
                    result.attemptId,
                    phone || storedAttempt?.phone || '',
                    storedAttempt?.returnTo || returnToRef.current,
                );
            }
            setStatus('signup_required');
            pollUntilRef.current = 0;
            return;
        }

        if (['no_account', 'conflict', 'failed', 'expired'].includes(nextStatus)) {
            clearStoredPhoneLoginAttempt();
            setStatus(nextStatus);
            setAttemptId(null);
            pollUntilRef.current = 0;
            return;
        }

        if (result?.attemptId) {
            writeStoredPhoneLoginAttempt(
                result.attemptId,
                phone || storedAttempt?.phone || '',
                storedAttempt?.returnTo || returnToRef.current,
            );
            setStatus('pending');
        }
    }, [onSignedIn, phone]);

    const pollAttemptById = useCallback(async (id) => {
        const normalizedAttemptId = Number.parseInt(String(id || ''), 10);
        if (!normalizedAttemptId || pollInFlightRef.current) return;

        pollInFlightRef.current = true;
        try {
            const result = await api.getPhoneLoginAttempt(normalizedAttemptId);
            finishWithResult(result);
        } catch (err) {
            setError(err.message || t('phoneLoginPollingError'));
        } finally {
            pollInFlightRef.current = false;
        }
    }, [finishWithResult, t]);

    const restoreStoredAttemptAndPoll = useCallback(() => {
        const storedAttempt = readStoredPhoneLoginAttempt();
        if (!storedAttempt?.attemptId) return;

        setAttemptId(storedAttempt.attemptId);
        if (storedAttempt.phone) setPhone(storedAttempt.phone);
        pollUntilRef.current = Date.now() + POLL_TIMEOUT_MS;
        setStatus((currentStatus) => (currentStatus === 'verified' ? currentStatus : 'pending'));
        pollAttemptById(storedAttempt.attemptId);
    }, [pollAttemptById]);

    useEffect(() => {
        if (!attemptId || status !== 'pending') return undefined;

        const runPoll = () => {
            if (pollUntilRef.current && Date.now() >= pollUntilRef.current) {
                clearStoredPhoneLoginAttempt();
                setStatus('expired');
                setAttemptId(null);
                setError(t('phoneLoginExpiredBody'));
                return;
            }
            pollAttemptById(attemptId);
        };

        const interval = window.setInterval(runPoll, POLL_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [attemptId, pollAttemptById, status, t]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const isPhoneLoginReturn = isGudAuthPhoneLoginReturn(window.location.search);
        const storedAttempt = readStoredPhoneLoginAttempt();
        if (!isPhoneLoginReturn && !storedAttempt?.attemptId) return undefined;

        restoreStoredAttemptAndPoll();

        if (isPhoneLoginReturn) {
            const url = new URL(window.location.href);
            url.searchParams.delete('gudauth');
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        }
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

    async function startPhoneLogin() {
        const phoneText = clean(phone);
        if (!phoneText || actionBusy) return;

        const preparedWhatsAppWindow = shouldUsePreparedWhatsAppWindow(
            typeof navigator !== 'undefined' ? navigator.userAgent : '',
        )
            ? prepareWhatsAppLaunchWindow(
                t('phoneLoginOpeningWhatsApp'),
                t('phoneLoginPreparingWhatsAppCode'),
            )
            : null;
        setActionBusy(true);
        setStatus('starting');
        setError('');
        setChallenge(null);
        try {
            const result = await api.startPhoneLogin({ phone: phoneText });
            pollUntilRef.current = Date.now() + POLL_TIMEOUT_MS;
            if (result?.attemptId) writeStoredPhoneLoginAttempt(result.attemptId, phoneText, returnToRef.current);
            finishWithResult(result);
            launchPreparedWhatsAppWindow(preparedWhatsAppWindow, getWhatsAppUrl(result?.challenge));
        } catch (err) {
            try {
                preparedWhatsAppWindow?.close?.();
            } catch {
                // Ignore window cleanup failures.
            }
            setStatus('failed');
            setError(friendlyErrorMessage(err.message, t));
        } finally {
            setActionBusy(false);
        }
    }

    async function completeSignup(event) {
        event.preventDefault();
        if (!attemptId || signupBusy) return;

        setSignupBusy(true);
        setError('');
        try {
            const result = await api.completePhoneLoginSignup(attemptId, {
                name: signupForm.name,
                postalCode: signupForm.postalCode,
            });
            finishWithResult(result);
        } catch (err) {
            setError(friendlyErrorMessage(err.message, t));
        } finally {
            setSignupBusy(false);
        }
    }

    function resetPanel() {
        clearStoredPhoneLoginAttempt();
        pollUntilRef.current = 0;
        setAttemptId(null);
        setChallenge(null);
        setError('');
        setStatus('idle');
        setSignupForm({ name: '', postalCode: '' });
    }

    const view = statusView(status, t);
    const Icon = view.icon;
    const whatsappUrl = getWhatsAppUrl(challenge);
    const whatsappLaunchUrl = getPreferredWhatsAppLaunchUrl(whatsappUrl, {
        preferNative: typeof navigator !== 'undefined' && isLikelyMobileDevice(navigator.userAgent),
    });
    const whatsappLaunchIsNative = whatsappLaunchUrl.startsWith('whatsapp://');
    const canStart = Boolean(clean(phone)) && !actionBusy && status !== 'pending' && status !== 'starting';
    const showTryAgain = ['failed', 'expired', 'no_account', 'conflict'].includes(status);
    const canCompleteSignup = Boolean(clean(signupForm.name)) && !signupBusy;

    if (status === 'idle') {
        return (
            <button
                type="button"
                onClick={() => setStatus('collecting')}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
                <MessageCircle size={18} className="text-brand-600" />
                {t('whatsAppSignInTitle')}
            </button>
        );
    }

    return (
        <section className="mt-4 w-full rounded-2xl border border-brand-100 bg-brand-50/30 px-4 py-4 text-left">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <Icon size={20} className={view.iconClass} />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-slate-900">{view.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{view.body}</p>

                    {status === 'collecting' || showTryAgain ? (
                        <div className="mt-3">
                            <label className="block text-xs font-semibold text-slate-700" htmlFor="phone-login-number">
                                {t('phoneLoginInputLabel')}
                            </label>
                            <div className="relative mt-1">
                                <Phone size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="phone-login-number"
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    placeholder={t('phoneLoginInputPlaceholder')}
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>
                    ) : null}

                    {error ? (
                        <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            {error}
                        </p>
                    ) : null}

                    {status === 'pending' ? (
                        <p className="mt-3 text-xs font-semibold text-slate-500">
                            {t('phoneLoginCheckingAutomatically')}
                        </p>
                    ) : null}

                    {status === 'signup_required' ? (
                        <form onSubmit={completeSignup} className="mt-4 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700" htmlFor="phone-login-signup-name">
                                    {t('phoneLoginSignupNameLabel')}
                                </label>
                                <input
                                    id="phone-login-signup-name"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    value={signupForm.name}
                                    onChange={(event) => setSignupForm((current) => ({ ...current, name: event.target.value }))}
                                    placeholder={t('phoneLoginSignupNamePlaceholder')}
                                    className="input-field mt-1"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700" htmlFor="phone-login-signup-postal">
                                    {t('phoneLoginSignupPostalLabel')}
                                </label>
                                <input
                                    id="phone-login-signup-postal"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                    value={signupForm.postalCode}
                                    onChange={(event) => setSignupForm((current) => ({ ...current, postalCode: event.target.value }))}
                                    placeholder={t('phoneLoginSignupPostalPlaceholder')}
                                    className="input-field mt-1"
                                />
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {t('phoneLoginSignupPostalHelp')}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="submit"
                                    disabled={!canCompleteSignup}
                                    className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {signupBusy ? (
                                        <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    ) : (
                                        <UserPlus size={16} />
                                    )}
                                    {signupBusy ? t('phoneLoginSignupSaving') : t('phoneLoginSignupButton')}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetPanel}
                                    className="btn-ghost px-4 py-2 text-sm"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </form>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                        {status === 'collecting' || showTryAgain ? (
                            <button
                                type="button"
                                disabled={!canStart}
                                onClick={startPhoneLogin}
                                className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {actionBusy ? (
                                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                    <MessageCircle size={16} />
                                )}
                                {showTryAgain ? t('phoneLoginTryAgainButton') : t('phoneLoginStartButton')}
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
                                {t('phoneLoginOpenWhatsAppFallback')}
                            </a>
                        ) : null}

                        {status === 'pending' || status === 'collecting' ? (
                            <button
                                type="button"
                                onClick={resetPanel}
                                className="btn-ghost px-4 py-2 text-sm"
                            >
                                {t('cancel')}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
}
