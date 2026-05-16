import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clearImpersonationToken, consumeImpersonationTokenFromHash, getImpersonationToken, getSessionAuthHeaders } from '../lib/sessionAuth.js';
import { getSessionApiBaseCandidates } from '../lib/apiBase.js';
import {
    fetchSessionJsonWithTimeout,
    isDefinitiveSignedOutSessionResponse,
    resolveUserAfterSessionCheckFailure,
} from '../lib/authSession.js';

const AuthContext = createContext(null);
const BASE_CANDIDATES = getSessionApiBaseCandidates();

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
    const userRef = useRef(null);

    const setCurrentUser = useCallback((nextUser) => {
        userRef.current = nextUser;
        setUser(nextUser);
    }, []);

    const checkSession = useCallback(async (allowImpersonationFallback = true) => {
        const hasImpersonationToken = Boolean(getImpersonationToken());

        try {
            for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
                try {
                    const { response, data, isJson } = await fetchSessionJsonWithTimeout(`${BASE_CANDIDATES[i]}/auth/me`, {
                        headers: getSessionAuthHeaders(),
                        credentials: 'include'
                    });
                    if (!isJson) {
                        if (i < BASE_CANDIDATES.length - 1) continue;
                        console.error('Auth session endpoint returned non-JSON response.');
                        const preservedUser = resolveUserAfterSessionCheckFailure(userRef.current);
                        setCurrentUser(preservedUser);
                        return preservedUser;
                    }
                    if (!response.ok) {
                        if (isDefinitiveSignedOutSessionResponse(response, data)) {
                            setCurrentUser(null);
                            return null;
                        }
                        if (i < BASE_CANDIDATES.length - 1) continue;
                        throw new Error(data?.error || 'Session check failed');
                    }
                    if (data.user) {
                        setCurrentUser(data.user);
                        return data.user;
                    }
                    break;
                } catch (err) {
                    if (i < BASE_CANDIDATES.length - 1) continue;
                    throw err;
                }
            }

            if (hasImpersonationToken && allowImpersonationFallback) {
                clearImpersonationToken();
                return await checkSession(false);
            }

            setCurrentUser(null);
            return null;
        } catch (err) {
            console.error('Session check failed', err);
            if (hasImpersonationToken && allowImpersonationFallback) {
                clearImpersonationToken();
                return await checkSession(false);
            }
            const preservedUser = resolveUserAfterSessionCheckFailure(userRef.current);
            setCurrentUser(preservedUser);
            return preservedUser;
        }
    }, [setCurrentUser]);

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
            setCurrentUser(null);
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
    }, [checkSession, setCurrentUser]);


    function login(userData) {
        setCurrentUser(userData);
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
        setCurrentUser(null);
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
