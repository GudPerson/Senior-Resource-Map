import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
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
    const { t } = useLocale();
    const [state, setState] = useState({ status: 'idle', message: '', place: null });

    const token = useMemo(
        () => searchParams.get('token') || getPendingMembershipToken(),
        [searchParams],
    );

    useEffect(() => {
        let active = true;

        async function redeem() {
            if (!token) {
                setState({ status: 'error', message: t('membershipLinkMissingInvalid'), place: null });
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
                    message: t('membershipLinkedSuccessfully'),
                    place: response.place || null,
                });
            } catch (error) {
                if (!active) return;
                setState({
                    status: 'error',
                    message: error.message || t('membershipLinkFailed'),
                    place: null,
                });
            }
        }

        redeem();
        return () => {
            active = false;
        };
    }, [isAuth, navigate, t, token]);

    return (
        <div className="min-h-screen px-4 py-16" style={{ background: 'var(--page-gradient)' }}>
            <div className="mx-auto max-w-lg rounded-[28px] border border-slate-200 bg-white/95 p-8 shadow-xl">
                <h1 className="text-2xl font-black text-slate-900">{t('membershipLinkingTitle')}</h1>
                <p className="mt-2 text-sm text-slate-500">
                    {t('membershipLinkingDescription')}
                </p>

                {state.status === 'loading' ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                        {t('membershipLinkingLoading')}
                    </div>
                ) : null}

                {state.status === 'success' ? (
                    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-800">
                        <p className="font-semibold">{t('membershipLinkedTitle')}</p>
                        {state.place ? (
                            <p className="mt-2">
                                {t('membershipLinkedPlaceMessage', { name: state.place.name })}
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
                        {t('membershipGoToDiscover')}
                    </Link>
                    <Link to="/my-directory" className="btn-ghost">
                        {t('membershipGoToMyDirectory')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
