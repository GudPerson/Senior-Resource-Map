import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Activity, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function AuthPage({ isPartner = false }) {
    const [tab, setTab] = useState('login');
    const [form, setForm] = useState({ email: '', password: '', name: '', role: 'user' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

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
                : await api.register({ email: form.email, password: form.password, name: form.name, role: 'user' });
            login(res.user);
            navigate('/dashboard');
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
            const res = await api.googleAuth({ credential: credentialResponse.credential });
            login(res.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Google Auth Failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google Login was unsuccessful. Try again later.');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-100 flex items-center justify-center px-4 py-12">
            <div className=" card w-full max-w-md shadow-xl">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center shadow-md mx-auto mb-4">
                        <Activity size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{isPartner ? 'Partner Sign In' : 'Sign In'}</h1>
                    <p className="text-slate-500 mt-1">{isPartner ? 'Access your partner or admin account' : 'Access your user account'}</p>
                </div>

                {/* Tabs - Only show Register if NOT partner */}
                {!isPartner && (
                    <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                        {[{ key: 'login', label: 'Sign In', Icon: LogIn }, { key: 'register', label: 'Register', Icon: UserPlus }].map(({ key, label, Icon }) => (
                            <button
                                key={key}
                                id={`auth-tab-${key}`}
                                onClick={() => { setTab(key); setError(''); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
                            <div className="flex-1 border-b border-slate-200"></div>
                            <div className="px-4 text-sm text-slate-400 font-medium">OR</div>
                            <div className="flex-1 border-b border-slate-200"></div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {tab === 'register' && !isPartner && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Your Name</label>
                            <input
                                id="auth-name"
                                type="text"
                                required
                                placeholder="e.g. John Doe"
                                value={form.name}
                                onChange={set('name')}
                                className=" input-field"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            {isPartner ? 'Username' : 'Email Address'}
                        </label>
                        <input
                            id="auth-login-id"
                            type={isPartner ? 'text' : 'email'}
                            required
                            placeholder={isPartner ? 'Enter your username' : 'you@example.com'}
                            value={isPartner ? form.username : form.email}
                            onChange={isPartner ? set('username') : set('email')}
                            className=" input-field"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
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
                                aria-label={showPass ? 'Hide password' : 'Show password'}
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
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
                        ) : tab === 'login' ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Create Account</>}
                    </button>
                </form>

                <div className="mt-4 text-center text-sm text-slate-500">
                    {isPartner ? (
                        <>Looking for user login? <Link to="/login" className="text-brand-600 font-semibold hover:underline">Click here</Link></>
                    ) : (
                        <>Are you a Partner or Admin? <Link to="/partner-login" className="text-brand-600 font-semibold hover:underline">Log in here</Link></>
                    )}
                </div>

                {/* Demo credentials */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Demo Accounts</p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                        <div className="bg-slate-50 rounded-lg p-2">
                            <p className="font-bold text-slate-700">Admin</p>
                            <p>Admin</p>
                            <p>I9oki9ok</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                            <p className="font-bold text-slate-700">Partner</p>
                            <p>fitlife</p>
                            <p>partner123</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                            <p className="font-bold text-slate-700">User</p>
                            <p>user@example.com</p>
                            <p>user123</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
