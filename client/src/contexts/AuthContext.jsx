import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearImpersonationToken, consumeImpersonationTokenFromHash, getImpersonationToken, getSessionAuthHeaders } from '../lib/sessionAuth.js';
import { getApiBaseCandidates } from '../lib/apiBase.js';

const AuthContext = createContext(null);
const BASE_CANDIDATES = getApiBaseCandidates();

function AuthLoadingFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                    Loading CareAround SG...
                </div>
            </div>
        </div>
    );
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkSession = useCallback(async (allowImpersonationFallback = true) => {
        const hasImpersonationToken = Boolean(getImpersonationToken());

        try {
            for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
                const res = await fetch(`${BASE_CANDIDATES[i]}/auth/me`, {
                    headers: getSessionAuthHeaders(),
                    credentials: 'include'
                });
                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    if (i < BASE_CANDIDATES.length - 1) continue;
                    console.error('Auth session endpoint returned non-JSON response.');
                    setUser(null);
                    return null;
                }
                const data = await res.json();
                if (data.user) {
                    setUser(data.user);
                    return data.user;
                }
                break;
            }

            if (hasImpersonationToken && allowImpersonationFallback) {
                clearImpersonationToken();
                return await checkSession(false);
            }

            setUser(null);
            return null;
        } catch (err) {
            console.error('Session check failed', err);
            if (hasImpersonationToken && allowImpersonationFallback) {
                clearImpersonationToken();
                return await checkSession(false);
            }
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        const runSessionCheck = async () => {
            setLoading(true);
            consumeImpersonationTokenFromHash();
            await checkSession();
            setLoading(false);
        };

        runSessionCheck();
    }, [checkSession]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleAuthExpired = () => {
            setUser(null);
        };

        const handleFocus = () => {
            checkSession(false);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkSession(false);
            }
        };

        window.addEventListener('carearound:auth-expired', handleAuthExpired);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('carearound:auth-expired', handleAuthExpired);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkSession]);


    function login(userData) {
        setUser(userData);
    }

    async function logout() {
        if (getImpersonationToken()) {
            clearImpersonationToken();
            setLoading(true);
            await checkSession(false);
            setLoading(false);
            return { exitedImpersonation: true };
        }

        try {
            let loggedOut = false;
            for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
                const res = await fetch(`${BASE_CANDIDATES[i]}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include'
                });
                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json') && i < BASE_CANDIDATES.length - 1) {
                    continue;
                }
                loggedOut = true;
                break;
            }
            if (!loggedOut) {
                console.error('Logout endpoint returned unexpected response.');
            }
        } catch (err) {
            console.error('Logout request failed', err);
        }
        setUser(null);
        return { exitedImpersonation: false };
    }

    if (loading) return <AuthLoadingFallback />;

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                refreshSession: checkSession,
                isAuth: !!user,
                isImpersonating: Boolean(user?.isImpersonating && getImpersonationToken()),
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
