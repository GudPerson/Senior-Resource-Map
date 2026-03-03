import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const rawBase = typeof import.meta.env.VITE_API_URL === 'string'
    ? import.meta.env.VITE_API_URL.trim()
    : '';
const BASE = rawBase ? rawBase.replace(/\/+$/, '') : '/api';
const BASE_CANDIDATES = Array.from(new Set([BASE, '/api', '/.netlify/functions/api']));

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            try {
                for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
                    const res = await fetch(`${BASE_CANDIDATES[i]}/auth/me`, {
                        credentials: 'include'
                    });
                    const contentType = res.headers.get('content-type') || '';
                    if (!contentType.includes('application/json')) {
                        if (i < BASE_CANDIDATES.length - 1) continue;
                        console.error('Auth session endpoint returned non-JSON response.');
                        return;
                    }
                    const data = await res.json();
                    if (data.user) setUser(data.user);
                    return;
                }
            } catch (err) {
                console.error('Session check failed', err);
            } finally {
                setLoading(false);
            }
        };
        // Run proper check
        setLoading(true);
        checkSession();
    }, []);


    function login(userData) {
        setUser(userData);
    }

    async function logout() {
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
    }

    if (loading) return null; // or a spinner

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
