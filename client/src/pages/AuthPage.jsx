import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api.js';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import BrandLockup from '../components/layout/BrandLockup.jsx';
import { buildMembershipLinkPath, getPendingMembershipToken } from '../lib/membershipLink.js';
import { useLocale } from '../contexts/LocaleContext.jsx';

function normalizeReturnTo(value) {
    const text = String(value || '').trim();
    if (!text || !text.startsWith('/') || text.startsWith('//')) return '';
    return text;
}

export default function AuthPage({ isPartner = false }) {
    const [tab, setTab] = useState('login');
    const [form, setForm] = useState({ username: '', email: '', password: '', name: '', postalCode: '', role: 'user' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { t } = useLocale();
    const navigate = useNavigate();
    const location = useLocation();

    function resolvePostAuthDestination() {
        const pendingMembershipToken = getPendingMembershipToken();
        if (pendingMembershipToken) {
            return buildMembershipLinkPath(pendingMembershipToken);
        }

        const params = new URLSearchParams(location.search);
        return normalizeReturnTo(params.get('returnTo')) || '/dashboard';
    }

    function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const loginPayload = isPartner
                ? { username: form.username, password: form.password, isPartnerLogin: true }
                : { email: form.email, password: form.password, isPartnerLogin: false };

            const res = tab === 'login'
                ? await api.login(loginPayload)
                : await api.register({ email: form.email, password: form.password, name: form.name, postalCode: form.postalCode, role: 'user' });
            login(res.user);
            navigate(resolvePostAuthDestination(), { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setLoading(true);
        try {
            const payload = { credential: credentialResponse.credential };
            if (tab === 'register') {
                payload.postalCode = form.postalCode;
            }
            const res = await api.googleAuth(payload);
            login(res.user);
            navigate(resolvePostAuthDestination(), { replace: true });
        } catch (err) {
            setError(err.message || t('googleSignInFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError(t('googleSignInFailed'));
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--page-gradient)' }}>
            <div className="card w-full max-w-md shadow-xl">

                {/* Header */}
                <div className="text-center mb-8">
                    <BrandLockup showTagline className="justify-center" textClassName="text-center" />
                    <h1 className="mt-6 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{isPartner ? t('partnerSignIn') : t('signInTitle')}</h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {isPartner ? t('partnerSignInSubtitle') : t('userSignInSubtitle')}
                    </p>
                </div>

                {/* Tabs - Only show Register if NOT partner */}
                {!isPartner && (
                    <div className="flex rounded-2xl p-1 mb-6" style={{ backgroundColor: 'var(--color-badge-bg)' }}>
                        {[{ key: 'login', label: t('signIn'), Icon: LogIn }, { key: 'register', label: t('register'), Icon: UserPlus }].map(({ key, label, Icon }) => (
                            <button
                                key={key}
                                id={`auth-tab-${key}`}
                                onClick={() => { setTab(key); setError(''); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Icon size={15} /> {label}
                            </button>
                        ))}
                    </div>
                )}
                {!isPartner && (
                    <div className="mb-6 flex flex-col items-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme="outline"
                            size="large"
                            width="100%"
                            text={tab === 'login' ? 'signin_with' : 'signup_with'}
                        />
                        <div className="flex items-center w-full my-6">
                            <div className="flex-1 border-b" style={{ borderColor: 'var(--color-border)' }}></div>
                            <div className="px-4 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{t('or')}</div>
                            <div className="flex-1 border-b" style={{ borderColor: 'var(--color-border)' }}></div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {tab === 'register' && !isPartner && (
                        <>
                            <div>
                                <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{t('yourName')}</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    required
                                    placeholder={t('namePlaceholder')}
                                    value={form.name}
                                    onChange={set('name')}
                                    className=" input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{t('postalCodeOptional')}</label>
                                <input
                                    id="auth-postal-code"
                                    type="text"
                                    placeholder="680153"
                                    value={form.postalCode}
                                    onChange={set('postalCode')}
                                    className=" input-field"
                                    autoComplete="postal-code"
                                />
                                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                    {t('registerPostalHelp')}
                                </p>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                            {isPartner ? t('username') : t('emailAddress')}
                        </label>
                        <input
                            id="auth-login-id"
                            type={isPartner ? 'text' : 'email'}
                            required
                            placeholder={isPartner ? t('enterUsername') : t('emailPlaceholder')}
                            value={isPartner ? form.username : form.email}
                            onChange={isPartner ? set('username') : set('email')}
                            className=" input-field"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{t('password')}</label>
                        <div className="relative">
                            <input
                                id="auth-password"
                                type={showPass ? 'text' : 'password'}
                                required
                                placeholder="••••••••"
                                value={form.password}
                                onChange={set('password')}
                                className=" input-field pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                aria-label={showPass ? t('hidePassword') : t('showPassword')}
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: '#fff1ef', border: '1px solid #f7c2b8', color: '#b84030' }}>
                            {error}
                        </div>
                    )}

                    <button
                        id="auth-submit"
                        type="submit"
                        disabled={loading}
                        className=" btn-primary w-full justify-center text-base"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : tab === 'login' ? <><LogIn size={18} /> {t('signIn')}</> : <><UserPlus size={18} /> {t('createAccount')}</>}
                    </button>
                </form>

                <div className="mt-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {isPartner ? (
                        <>{t('lookingForUserLogin')} <Link to="/login" className="text-brand-600 font-semibold hover:underline">{t('clickHere')}</Link></>
                    ) : (
                        <>{t('staffOrAdmin')} <Link to="/partner-login" className="text-brand-600 font-semibold hover:underline">{t('logInHere')}</Link></>
                    )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 text-center text-xs leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>
                        By using CareAround SG, you agree to the{' '}
                        <Link to="/terms" className="font-semibold text-brand-700 hover:underline">
                            Terms of Use
                        </Link>{' '}
                        and acknowledge the{' '}
                        <Link to="/privacy" className="font-semibold text-brand-700 hover:underline">
                            Privacy & Cookies Notice
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}
