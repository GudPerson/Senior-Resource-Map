import { useEffect, useState } from 'react';
import { Building2, LockKeyhole, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api.js';
import { getOrganizationAccess, hasPartnerStaffAccess, normalizeRole } from '../lib/roles.js';
import { LoadingState } from './LoadingState.jsx';

function userCanUseDirectory(user, settings) {
    const role = normalizeRole(user?.role);
    if (settings?.publicDirectoryMode === 'open') return true;
    if (role === 'super_admin') return true;
    if (settings?.publicDirectoryMode === 'closed') return false;
    return Boolean(user?.id) && (
        getOrganizationAccess(user).length > 0
        || hasPartnerStaffAccess(user)
        || ['regional_admin', 'partner'].includes(role)
    );
}

export function PublicAccessNotice({ purpose = 'directory' }) {
    return (
        <main className="min-h-[calc(100vh-80px)] px-4 py-14" style={{ background: 'var(--page-gradient)' }}>
            <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><LockKeyhole size={24} /></span>
                <h1 className="mt-5 text-3xl font-black text-slate-950">CareAround SG is in an organisation-led pilot</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">{purpose === 'sign-in'
                    ? 'General public registration and sign-in are closed during this pilot. Approved organisation users can continue through the organisation pathway.'
                    : 'The full resource directory is available only to approved organisation users. Public Care Maps shared by service providers remain accessible through their direct links and website embeds.'}</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <Link to="/partner-login" className="btn-primary justify-center"><Building2 size={17} /> Organisation sign-in</Link>
                    <Link to="/organization/join" className="btn-secondary justify-center"><MapPinned size={17} /> Request staff access</Link>
                </div>
                <p className="mt-6 text-sm text-slate-500">Is your organisation new to CareAround SG? <Link to="/organization/register" className="font-bold text-brand-700 hover:underline">Register the organisation</Link>.</p>
            </div>
        </main>
    );
}

export default function PublicDirectoryGate({ children }) {
    const { user } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        api.getPlatformAccessSettings()
            .then((result) => { if (!cancelled) setSettings(result.settings); })
            .catch(() => { if (!cancelled) setSettings({ publicDirectoryMode: 'closed' }); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user?.id]);

    if (loading) return <LoadingState label="Checking directory access…" />;
    if (!userCanUseDirectory(user, settings)) return <PublicAccessNotice />;
    return children;
}

