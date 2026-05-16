import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import AuthHandoffScreen from '../components/AuthHandoffScreen.jsx';

const MIN_HANDOFF_MS = 900;

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
    const [fallbackVisible, setFallbackVisible] = useState(false);

    const returnTo = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return normalizeReturnTo(params.get('returnTo'));
    }, [location.search]);

    useEffect(() => {
        let cancelled = false;
        let navigationTimer = null;
        const startedAt = Date.now();

        const navigateAfterMinimumHandoff = () => {
            if (cancelled) return;
            const elapsed = Date.now() - startedAt;
            const remaining = Math.max(0, MIN_HANDOFF_MS - elapsed);
            navigationTimer = window.setTimeout(() => {
                if (!cancelled) navigate(returnTo, { replace: true });
            }, remaining);
        };

        const checkAuth = async () => {
            try {
                const settled = await refreshSession();
                if (!cancelled && settled) {
                    navigateAfterMinimumHandoff();
                }
            } catch (err) {
                console.debug('Auth transition session refresh deferred:', err);
            }
        };

        if (isAuth) {
            navigateAfterMinimumHandoff();
            return () => {
                cancelled = true;
                if (navigationTimer) window.clearTimeout(navigationTimer);
            };
        }

        checkAuth();
        return () => {
            cancelled = true;
            if (navigationTimer) window.clearTimeout(navigationTimer);
        };
    }, [returnTo, isAuth, refreshSession, navigate]);

    useEffect(() => {
        const timer = window.setTimeout(() => setFallbackVisible(true), 9000);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <AuthHandoffScreen
            returnTo={returnTo}
            fallbackVisible={fallbackVisible}
            onContinue={() => navigate(returnTo, { replace: true })}
        />
    );
}
