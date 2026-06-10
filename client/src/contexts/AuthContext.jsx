import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clearImpersonationToken, consumeImpersonationTokenFromHash, getImpersonationToken, getSessionAuthHeaders } from '../lib/sessionAuth.js';
import { getSessionApiBaseCandidates } from '../lib/apiBase.js';
import {
    EMPTY_SESSION_RECHECK_ATTEMPTS,
    EMPTY_SESSION_RECHECK_DELAY_MS,
    fetchSessionJsonWithTimeout,
    isAmbiguousEmptySessionResponse,
    isDefinitiveSignedOutSessionResponse,
    resolveImpersonationSessionFailure,
    resolveUserAfterSessionCheckFailure,
} from '../lib/authSession.js';

const AuthContext = createContext(null);
const BASE_CANDIDATES = getSessionApiBaseCandidates();
const SESSION_CHECK_COOLDOWN_MS = 750;

function sleep(ms) {
    return new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const userRef = useRef(null);
    const sessionCheckInFlightRef = useRef(null);
    const lastSessionCheckAtRef = useRef(0);

    const setCurrentUser = useCallback((nextUser) => {
        userRef.current = nextUser;
        setUser(nextUser);
    }, []);

    const checkSession = useCallback(async (allowImpersonationFallback = true, force = false) => {
        const hasImpersonationToken = Boolean(getImpersonationToken());

        if (!force) {
            const inflightCheck = sessionCheckInFlightRef.current;
            const now = Date.now();
            if (inflightCheck) return inflightCheck;
            if (now - lastSessionCheckAtRef.current < SESSION_CHECK_COOLDOWN_MS) {
                return userRef.current;
            }
        }

        const runSessionCheck = async () => {
            try {
                sessionCheck:
                for (let sessionAttempt = 0; sessionAttempt <= EMPTY_SESSION_RECHECK_ATTEMPTS; sessionAttempt += 1) {
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
                                    if (hasImpersonationToken && allowImpersonationFallback) {
                                        const resolution = resolveImpersonationSessionFailure(userRef.current, { response, data });
                                        if (resolution.clearToken) clearImpersonationToken();
                                        if (resolution.retryNormalSession) return await checkSession(false, true);
                                        setCurrentUser(resolution.user);
                                        return resolution.user;
                                    }
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
                            if (
                                isAmbiguousEmptySessionResponse(response, data)
                                && sessionAttempt < EMPTY_SESSION_RECHECK_ATTEMPTS
                            ) {
                                await sleep(EMPTY_SESSION_RECHECK_DELAY_MS * (sessionAttempt + 1));
                                continue sessionCheck;
                            }
                            break;
                        } catch (err) {
                            if (i < BASE_CANDIDATES.length - 1) continue;
                            throw err;
                        }
                    }
                    break;
                }

                if (hasImpersonationToken && allowImpersonationFallback) {
                    const resolution = resolveImpersonationSessionFailure(userRef.current);
                    if (resolution.clearToken) clearImpersonationToken();
                    if (resolution.retryNormalSession) return await checkSession(false, true);
                    setCurrentUser(resolution.user);
                    return resolution.user;
                }

                setCurrentUser(null);
                return null;
            } catch (err) {
                console.error('Session check failed', err);
                if (hasImpersonationToken && allowImpersonationFallback) {
                    const resolution = resolveImpersonationSessionFailure(userRef.current, { error: err });
                    if (resolution.clearToken) clearImpersonationToken();
                    if (resolution.retryNormalSession) return await checkSession(false, true);
                    setCurrentUser(resolution.user);
                    return resolution.user;
                }
                const preservedUser = resolveUserAfterSessionCheckFailure(userRef.current);
                setCurrentUser(preservedUser);
                return preservedUser;
            }
        };

        const sessionCheckPromise = runSessionCheck();
        if (!force) {
            sessionCheckInFlightRef.current = sessionCheckPromise;
        }
        try {
            const result = await sessionCheckPromise;
            return result;
        } finally {
            if (!force) {
                if (sessionCheckInFlightRef.current === sessionCheckPromise) {
                    sessionCheckInFlightRef.current = null;
                }
                lastSessionCheckAtRef.current = Date.now();
            }
        }
    }, [setCurrentUser]);

    useEffect(() => {
        const runSessionCheck = async () => {
            setIsLoading(true);
            consumeImpersonationTokenFromHash();
            await checkSession();
            setIsLoading(false);
        };

        runSessionCheck();
    }, [checkSession]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleAuthExpired = () => {
            void checkSession();
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
        setCurrentUser(userData);
    }

    async function logout() {
        if (getImpersonationToken()) {
            clearImpersonationToken();
            setIsLoading(true);
            await checkSession(false);
            setIsLoading(false);
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

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                refreshSession: checkSession,
                isLoading,
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
