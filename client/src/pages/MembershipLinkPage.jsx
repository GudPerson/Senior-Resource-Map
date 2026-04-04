import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api.js';
import {
    buildMembershipLinkPath,
    clearPendingMembershipToken,
    getPendingMembershipToken,
    setPendingMembershipToken,
} from '../lib/membershipLink.js';

export default function MembershipLinkPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAuth } = useAuth();
    const [state, setState] = useState({ status: 'idle', message: '', place: null });

    const token = useMemo(
        () => searchParams.get('token') || getPendingMembershipToken(),
        [searchParams],
    );

    useEffect(() => {
        let active = true;

        async function redeem() {
            if (!token) {
                setState({ status: 'error', message: 'Membership link is missing or invalid.', place: null });
                return;
            }

            if (!isAuth) {
                setPendingMembershipToken(token);
                navigate(`/login?returnTo=${encodeURIComponent(buildMembershipLinkPath(token))}`, { replace: true });
                return;
            }

            setState({ status: 'loading', message: '', place: null });
            try {
                const response = await api.redeemMembershipLink({ token });
                if (!active) return;
                clearPendingMembershipToken();
                setState({
                    status: 'success',
                    message: 'Membership linked successfully.',
                    place: response.place || null,
                });
            } catch (error) {
                if (!active) return;
                setState({
                    status: 'error',
                    message: error.message || 'Failed to link membership.',
                    place: null,
                });
            }
        }

        redeem();
        return () => {
            active = false;
        };
    }, [isAuth, navigate, token]);

    return (
        <div className="min-h-screen px-4 py-16" style={{ background: 'var(--page-gradient)' }}>
            <div className="mx-auto max-w-lg rounded-[28px] border border-slate-200 bg-white/95 p-8 shadow-xl">
                <h1 className="text-2xl font-black text-slate-900">Membership linking</h1>
                <p className="mt-2 text-sm text-slate-500">
                    Join a community place with one scan so member-only offerings can recognise your access.
                </p>

                {state.status === 'loading' ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                        Linking your membership…
                    </div>
                ) : null}

                {state.status === 'success' ? (
                    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-800">
                        <p className="font-semibold">You&apos;re now linked.</p>
                        {state.place ? (
                            <p className="mt-2">
                                Your account has been linked to <span className="font-semibold">{state.place.name}</span>.
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {state.status === 'error' ? (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
                        {state.message}
                    </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/discover" className="btn-primary">
                        Go to Discover
                    </Link>
                    <Link to="/my-directory" className="btn-ghost">
                        Go to My Directory
                    </Link>
                </div>
            </div>
        </div>
    );
}
