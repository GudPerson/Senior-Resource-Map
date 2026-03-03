import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const BASE = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch(`${BASE}/auth/me`, {
                    credentials: 'include'
                });
                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    console.error('Auth session endpoint returned non-JSON response.');
                    return;
                }
                const data = await res.json();
                if (data.user) setUser(data.user);
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
            await fetch(`${BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
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
