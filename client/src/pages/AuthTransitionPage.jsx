import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

function normalizeReturnTo(value) {
    const text = String(value || '').trim();
    if (!text) return '/dashboard';
    if (!text.startsWith('/') || text.startsWith('//')) return '/dashboard';
    return text;
}

export default function AuthTransitionPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuth, refreshSession } = useAuth();
    const { t } = useLocale();
    const [fallbackVisible, setFallbackVisible] = useState(false);

    const returnTo = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return normalizeReturnTo(params.get('returnTo'));
    }, [location.search]);

    useEffect(() => {
        let cancelled = false;
        const checkAuth = async () => {
            try {
                const settled = await refreshSession();
                if (!cancelled && settled) {
                    navigate(returnTo, { replace: true });
                }
            } catch (err) {
                console.debug('Auth transition session refresh deferred:', err);
            }
        };

        if (isAuth) {
            navigate(returnTo, { replace: true });
            return () => {
                cancelled = true;
            };
        }

        checkAuth();
        return () => {
            cancelled = true;
        };
    }, [returnTo, isAuth, refreshSession, navigate]);

    useEffect(() => {
        const timer = window.setTimeout(() => setFallbackVisible(true), 9000);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--page-gradient)' }}>
            <div className="card w-full max-w-2xl shadow-xl p-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{t('authHandoffTitle')}</h1>
                    <p className="mt-3 text-sm text-slate-600">
                        {t('authHandoffSubtitle', { destination: returnTo })}
                    </p>
                </div>

                <div className="mt-8 flex flex-col items-center">
                    <span className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                    <p className="mt-4 text-sm text-slate-600">{t('authHandoffLoading')}</p>
                </div>

                <div className="mt-8 space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <h2 className="text-sm font-bold tracking-wide text-slate-700 uppercase">{t('authHandoffNewsTitle')}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('authHandoffNewsBody')}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <h2 className="text-sm font-bold tracking-wide text-slate-700 uppercase">{t('authHandoffTipsTitle')}</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                            <li>{t('authHandoffTipItemOne')}</li>
                            <li>{t('authHandoffTipItemTwo')}</li>
                        </ul>
                    </div>
                </div>

                {fallbackVisible ? (
                    <div className="mt-8 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{t('authHandoffSlowMessage')}</p>
                        <button
                            type="button"
                            onClick={() => navigate(returnTo, { replace: true })}
                            className="btn-primary mt-3 justify-center"
                        >
                            {t('authHandoffContinueNow')}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
