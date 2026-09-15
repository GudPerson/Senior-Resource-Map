import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Globe2, LockKeyhole, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';

import { api } from '../../lib/api.js';
import { useConfirmDialog } from '../ConfirmDialog.jsx';
import ResourceClaimsPanel from '../ResourceClaimsPanel.jsx';
import {
    GOVERNED_MAPS_UI_ENABLED,
    ORGANIZATION_ONBOARDING_UI_ENABLED,
    RESOURCE_CLAIMS_UI_ENABLED,
} from '../../lib/governedPilotRelease.js';
import { hasRestrictedPublicAccess, publicAccessStatusLabel, restrictedAccessSettings } from '../../lib/platformAccessBoundary.js';

function Feedback({ value }) {
    if (!value) return null;
    return (
        <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${value.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
            {value.message}
        </p>
    );
}

export default function PlatformAccessPanel() {
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const [settings, setSettings] = useState(null);
    const [onboardingRequests, setOnboardingRequests] = useState([]);
    const [joinRequests, setJoinRequests] = useState([]);
    const [reasons, setReasons] = useState({});
    const [roles, setRoles] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setFeedback(null);
        try {
            const access = await api.getPlatformAccessSettings();
            setSettings(access.settings);
            const [onboarding, joins] = ORGANIZATION_ONBOARDING_UI_ENABLED && access.settings.organizationOnboardingEnabled
                ? await Promise.all([api.getOrganizationOnboardingRequests(), api.getOrganizationJoinRequests()])
                : [{ requests: [] }, { requests: [] }];
            setOnboardingRequests(onboarding.requests || []);
            setJoinRequests(joins.requests || []);
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || 'Unable to load pilot controls.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const pilotEnabled = useMemo(() => hasRestrictedPublicAccess(settings), [settings]);
    const onboardingEnabled = ORGANIZATION_ONBOARDING_UI_ENABLED && settings?.organizationOnboardingEnabled === true;
    const resourceClaimsEnabled = RESOURCE_CLAIMS_UI_ENABLED && settings?.resourceClaimsEnabled === true;
    const governedMapsEnabled = GOVERNED_MAPS_UI_ENABLED && settings?.governedMapsEnabled === true;

    async function setPilotMode(enable) {
        const confirmed = await requestConfirmation({
            title: enable ? (onboardingEnabled ? 'Activate closed organisation pilot?' : 'Restrict public access?') : 'Reopen public access?',
            message: enable
                ? (onboardingEnabled
                    ? (governedMapsEnabled
                        ? 'Guest discovery, general registration and general sign-in will close. Published personal and Governed Care Map share links and embeds remain available.'
                        : 'Guest discovery, general registration and general sign-in will close. Published personal My Map share links and embeds remain available. Governed Care Maps remain unavailable until their release stage.')
                    : 'Directory access, new registration and sign-in will be restricted to Super Admin recovery. Existing personal My Map share links and embeds remain available.')
                : 'Public discovery, registration and general sign-in will become available again.',
            details: enable
                ? [onboardingEnabled ? 'Approved organisation users continue through Organisation sign-in.' : 'Super Admins can sign in through the staff sign-in page with their existing email and password.', 'The change is audited and can be reversed from this panel.']
                : ['This does not alter maps, resources, organisations or prior audit records.'],
            tone: 'warning',
            confirmLabel: enable ? (onboardingEnabled ? 'Activate pilot' : 'Restrict access') : 'Reopen access',
        });
        if (!confirmed) return;
        setSaving(true);
        setFeedback(null);
        try {
            const result = await api.updatePlatformAccessSettings({
                ...(enable ? restrictedAccessSettings(onboardingEnabled) : {
                    publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open',
                }),
                expectedRevision: settings.revision,
            });
            setSettings(result.settings);
            setFeedback({ type: 'success', message: enable ? 'Public access is restricted.' : 'Public access is open.' });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || 'Unable to update pilot mode.' });
        } finally {
            setSaving(false);
        }
    }

    async function approveOnboarding(request) {
        const confirmed = await requestConfirmation({
            title: `Approve ${request.organizationName}?`,
            message: 'This verifies the organisation domain and records its supplied logo, banner and content-use grant.',
            details: [request.emailDomain, `Terms: ${request.termsVersion}`],
            tone: 'info',
            confirmLabel: 'Approve organisation',
        });
        if (!confirmed) return;
        setSaving(true);
        try {
            await api.approveOrganizationOnboardingRequest(request.id);
            await load();
            setFeedback({ type: 'success', message: `${request.organizationName} is now registered.` });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    }

    async function rejectOnboarding(request) {
        const reason = String(reasons[`onboarding:${request.id}`] || '').trim();
        if (reason.length < 10) {
            setFeedback({ type: 'error', message: 'Enter a rejection reason of at least 10 characters.' });
            return;
        }
        setSaving(true);
        try {
            await api.rejectOrganizationOnboardingRequest(request.id, { reason });
            await load();
        } catch (error) {
            setFeedback({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    }

    async function decideJoin(request, approve) {
        const reason = String(reasons[`join:${request.id}`] || '').trim();
        if (!approve && reason.length < 10) {
            setFeedback({ type: 'error', message: 'Enter a rejection reason of at least 10 characters.' });
            return;
        }
        setSaving(true);
        try {
            if (approve) {
                await api.approveOrganizationJoinRequest(request.id, { accessRole: roles[request.id] || 'staff' });
            } else {
                await api.rejectOrganizationJoinRequest(request.id, { reason });
            }
            await load();
        } catch (error) {
            setFeedback({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    }

    const pendingOnboarding = onboardingRequests.filter((request) => request.status === 'pending');
    const pendingJoins = joinRequests.filter((request) => request.status === 'pending');

    return (
        <div className="space-y-6" data-testid="platform-access-panel">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><LockKeyhole size={22} /></span>
                            <div>
                                <h2 className="text-xl font-black text-slate-950">Public access boundary</h2>
                                <p className="text-sm text-slate-500">Control public discovery, registration and sign-in independently of shared My Maps.</p>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-slate-50 p-4"><Globe2 size={18} className="text-brand-700" /><p className="mt-2 text-sm font-bold">Directory</p><p className="text-xs text-slate-500">{settings?.publicDirectoryMode || 'Loading'}</p></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><UserCheck size={18} className="text-brand-700" /><p className="mt-2 text-sm font-bold">Registration</p><p className="text-xs text-slate-500">{settings?.publicRegistrationMode || 'Loading'}</p></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><ShieldCheck size={18} className="text-brand-700" /><p className="mt-2 text-sm font-bold">Sign-in</p><p className="text-xs text-slate-500">{settings?.publicLoginMode || 'Loading'}</p></div>
                        </div>
                    </div>
                    <div className="min-w-64 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Current mode</p>
                        <p className="mt-1 font-black text-slate-950">{publicAccessStatusLabel(settings)}</p>
                        <button type="button" disabled={loading || saving || !settings?.available} onClick={() => setPilotMode(!pilotEnabled)} className="btn-primary mt-4 w-full justify-center disabled:opacity-50">
                            {saving ? 'Applying…' : pilotEnabled ? 'Reopen public access' : onboardingEnabled ? 'Activate pilot boundary' : 'Restrict public access'}
                        </button>
                    </div>
                </div>
            </section>

            <Feedback value={feedback} />

            {!onboardingEnabled && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Organisation onboarding and Governed Care Maps are not open yet. Public access controls remain available.</p>}
            {onboardingEnabled && <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="text-xl font-black text-slate-950">Organisation onboarding</h2><p className="text-sm text-slate-500">Review domain, applicant, owner-supplied asset pack and recorded permission.</p></div>
                    <button type="button" onClick={load} disabled={loading} className="btn-secondary"><RefreshCw size={16} /> Refresh</button>
                </div>
                <div className="mt-5 space-y-4">
                    {pendingOnboarding.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No pending organisation requests.</p> : pendingOnboarding.map((request) => (
                        <article key={request.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-start gap-3"><Building2 className="mt-0.5 text-brand-700" size={20} /><div><h3 className="font-black text-slate-950">{request.organizationName}</h3><p className="text-sm text-slate-600">{request.emailDomain} · {request.applicantName} · {request.applicantEmail}</p><p className="mt-1 text-xs text-slate-500">{request.termsVersion} · permission accepted {new Date(request.termsAcceptedAt).toLocaleDateString()}</p><div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-brand-700">{request.websiteUrl ? <a href={request.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">Official website</a> : null}<a href={request.logoUrl} target="_blank" rel="noreferrer" className="hover:underline">Review logo</a><a href={request.bannerUrl} target="_blank" rel="noreferrer" className="hover:underline">Review banner</a></div></div></div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><input className="input-field" placeholder="Reason if rejecting" value={reasons[`onboarding:${request.id}`] || ''} onChange={(event) => setReasons((current) => ({ ...current, [`onboarding:${request.id}`]: event.target.value }))} /><button type="button" className="btn-secondary" disabled={saving} onClick={() => rejectOnboarding(request)}>Reject</button><button type="button" className="btn-primary" disabled={saving} onClick={() => approveOnboarding(request)}>Approve</button></div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-950">Staff access requests</h2>
                <p className="text-sm text-slate-500">Create an account only after the verified organisation approves it.</p>
                <div className="mt-5 space-y-4">
                    {pendingJoins.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No pending staff requests.</p> : pendingJoins.map((request) => (
                        <article key={request.id} className="rounded-2xl border border-slate-200 p-4">
                            <h3 className="font-black text-slate-950">{request.name}</h3><p className="text-sm text-slate-600">{request.email} · {request.organizationName}</p>
                            <div className="mt-4 grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)_auto_auto]"><select className="input-field" value={roles[request.id] || 'staff'} onChange={(event) => setRoles((current) => ({ ...current, [request.id]: event.target.value }))}><option value="staff">Staff</option><option value="admin">Org Admin</option></select><input className="input-field" placeholder="Reason if rejecting" value={reasons[`join:${request.id}`] || ''} onChange={(event) => setReasons((current) => ({ ...current, [`join:${request.id}`]: event.target.value }))} /><button type="button" className="btn-secondary" disabled={saving} onClick={() => decideJoin(request, false)}>Reject</button><button type="button" className="btn-primary" disabled={saving} onClick={() => decideJoin(request, true)}>Approve</button></div>
                        </article>
                    ))}
                </div>
            </section>
            </>}
            {resourceClaimsEnabled ? <ResourceClaimsPanel /> : null}
            {confirmDialog}
        </div>
    );
}
