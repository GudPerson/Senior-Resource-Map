import { Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { OFFERING_ACCESS, formatMissingProfileFields } from '../lib/eligibility.js';

function buildSafeReturnTo(location) {
    const value = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
    return value.startsWith('/') && !value.startsWith('//') ? value : '/discover';
}

export default function OfferingAccessNotice({
    access,
    missingProfileFields = [],
    compact = false,
    className = '',
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuth } = useAuth();

    if (!access || access === OFFERING_ACCESS.GRANTED) {
        return null;
    }

    const returnTo = buildSafeReturnTo(location);
    const missingFieldsText = formatMissingProfileFields(missingProfileFields);
    const isLocked = access === OFFERING_ACCESS.LOCKED_MISSING_DATA;
    const ctaLabel = isAuth ? 'Add details to check this' : 'Sign in to check this';

    return (
        <div
            className={`rounded-2xl border ${compact ? 'mt-2 px-3 py-2 text-[11px]' : 'mt-4 px-4 py-3 text-sm'} ${
                isLocked
                    ? 'border-brand-200 bg-brand-50/70 text-brand-800'
                    : 'border-slate-200 bg-slate-100/80 text-slate-600'
            } ${className}`}
        >
            <div className="flex items-start gap-2">
                <Lock size={compact ? 13 : 15} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                    <p className="font-semibold">
                        {isLocked ? 'A few profile details are needed' : 'This may not match your profile'}
                    </p>
                    {isLocked ? (
                        <p className="mt-1 leading-relaxed">
                            {missingFieldsText
                                ? `Add ${missingFieldsText} to see whether this programme or service may be relevant to you.`
                                : 'Add a few optional profile details to see whether this may be relevant to you.'}
                        </p>
                    ) : (
                        <p className="mt-1 leading-relaxed">This programme or service is currently shown as not matching your saved profile details.</p>
                    )}

                    {isLocked ? (
                        <button
                            type="button"
                            onClick={() => navigate(
                                isAuth
                                    ? `/dashboard/profile?eligibility=1&returnTo=${encodeURIComponent(returnTo)}`
                                    : `/login?eligibility=1&returnTo=${encodeURIComponent(returnTo)}`
                            )}
                            className={`mt-2 inline-flex items-center rounded-full border border-current px-3 py-1 font-semibold transition hover:bg-white/70 ${compact ? 'text-[11px]' : 'text-sm'}`}
                        >
                            {ctaLabel}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
