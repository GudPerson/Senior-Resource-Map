import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import BrandLockup from '../components/layout/BrandLockup.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { api } from '../lib/api.js';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 45000;

function normalizeReturnTo(value) {
    const text = String(value || '').trim();
    if (!text || !text.startsWith('/') || text.startsWith('//')) return '/dashboard';
    return text;
}

function normalizeAttemptId(value) {
    const attemptId = Number.parseInt(String(value || ''), 10);
    return attemptId > 0 ? attemptId : null;
}

export default function PhoneLoginReturnPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const { t } = useLocale();
    const [status, setStatus] = useState('checking');
    const [message, setMessage] = useState('');
    const [continueTo, setContinueTo] = useState('/dashboard');
    const inFlightRef = useRef(false);

    const { attemptId, returnTo } = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return {
            attemptId: normalizeAttemptId(params.get('attempt')),
            returnTo: normalizeReturnTo(params.get('returnTo')),
        };
    }, [location.search]);

    useEffect(() => {
        if (!attemptId) {
            setStatus('failed');
            setMessage(t('phoneLoginFailedBody'));
            return undefined;
        }

        let cancelled = false;
        let timer = null;
        const startedAt = Date.now();

        const scheduleNextCheck = (delay = POLL_INTERVAL_MS) => {
            if (cancelled) return;
            timer = window.setTimeout(checkAttempt, delay);
        };

        async function checkAttempt() {
            if (cancelled || inFlightRef.current) return;
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                setStatus('failed');
                setMessage(t('phoneLoginPollingError'));
                return;
            }

            inFlightRef.current = true;
            try {
                const result = await api.getPhoneLoginAttempt(attemptId);
                if (cancelled) return;

                const nextStatus = String(result?.status || '').trim().toLowerCase();
                if (nextStatus === 'verified' && result?.user) {
                    setStatus('verified');
                    setMessage(t('phoneLoginReturnSuccessBody'));
                    setContinueTo(returnTo);
                    login(result.user);
                    return;
                }

                if (nextStatus === 'signup_required') {
                    navigate(`/login?gudauth=phone_login&attempt=${attemptId}&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
                    return;
                }

                if (['failed', 'expired', 'conflict', 'no_account'].includes(nextStatus)) {
                    setStatus('failed');
                    setMessage(result?.message || t('phoneLoginFailedBody'));
                    return;
                }

                setStatus('checking');
                setMessage(result?.message || '');
                scheduleNextCheck();
            } catch (err) {
                if (cancelled) return;
                setStatus('checking');
                setMessage(err?.message || t('phoneLoginPollingError'));
                scheduleNextCheck(2500);
            } finally {
                inFlightRef.current = false;
            }
        }

        scheduleNextCheck(0);

        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
        };
    }, [attemptId, login, navigate, returnTo, t]);

    const isFailed = status === 'failed';
    const Icon = isFailed ? AlertTriangle : status === 'verified' ? CheckCircle2 : Loader2;
    const title = status === 'verified'
        ? t('phoneLoginReturnSuccessTitle')
        : isFailed
            ? t('phoneLoginFailedTitle')
            : t('phoneLoginReturnTitle');

    return (
        <main className="flex min-h-[calc(100vh-88px)] items-center justify-center bg-slate-50 px-5 py-12">
            <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
                <BrandLockup showTagline className="justify-center" textClassName="text-center" />
                <div className={`mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-3xl ${
                    isFailed ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-brand-700'
                }`}>
                    <Icon className={status === 'checking' ? 'animate-spin' : ''} size={32} />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-slate-950">
                    {title}
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-600">
                    {message || t('phoneLoginReturnBody')}
                </p>
                {status === 'verified' ? (
                    <>
                        <Link to={continueTo} className="btn-primary mt-6 w-full justify-center">
                            {t('phoneLoginReturnContinue')}
                        </Link>
                        <p className="mt-4 text-sm leading-6 text-slate-500">
                            {t('phoneLoginReturnFallbackHint')}
                        </p>
                    </>
                ) : null}
                {isFailed ? (
                    <Link to="/login" className="btn-primary mt-6 w-full justify-center">
                        {t('phoneLoginReturnBackToLogin')}
                    </Link>
                ) : null}
            </section>
        </main>
    );
}
