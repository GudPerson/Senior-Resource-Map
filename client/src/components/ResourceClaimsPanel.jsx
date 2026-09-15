import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, CheckCircle2, FileCheck2, RefreshCw, RotateCcw, Search, ShieldCheck, Undo2, XCircle } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api.js';
import { normalizeRole } from '../lib/roles.js';
import { useConfirmDialog } from './ConfirmDialog.jsx';

const FIELD_OPTIONS = [
    ['logoUrl', 'Logo'],
    ['bannerUrl', 'Banner'],
    ['galleryUrls', 'Gallery images'],
    ['description', 'Description'],
    ['website', 'Website'],
    ['socialLinks', 'Social links'],
    ['ctaUrl', 'Action link'],
];

const USE_OPTIONS = [
    ['sharedMaps', 'Personal Shared Maps'],
    ['embeds', 'Website embeds'],
];

const STATUS_META = {
    claim_pending: ['Pending review', 'border-amber-200 bg-amber-50 text-amber-800'],
    owner_verified: ['Owner verified', 'border-sky-200 bg-sky-50 text-sky-800'],
    publishing_approved: ['Publication approved', 'border-emerald-200 bg-emerald-50 text-emerald-800'],
    permission_withdrawn: ['Permission withdrawn', 'border-slate-200 bg-slate-100 text-slate-700'],
    claim_rejected: ['Claim rejected', 'border-red-200 bg-red-50 text-red-700'],
};

const EMPTY_FORM = {
    organizationId: '',
    resourceType: 'hard',
    resourceId: '',
    requestedFields: [],
    requestedUses: { sharedMaps: false, embeds: false },
    evidenceNote: '',
    attestedOwnerAuthority: false,
};

function resourceLabel(resource) {
    if (!resource) return 'Unknown resource';
    return [resource.name, resource.address || resource.subCategory, resource.postalCode].filter(Boolean).join(' · ');
}

function findOrganization(organizations, organizationId) {
    return organizations.find((item) => Number(item.id) === Number(organizationId)) || null;
}

function activeAgreementOptions(organization) {
    const now = Date.now();
    return (organization?.agreements || []).filter((agreement) => {
        if (agreement.status !== 'active' || agreement.revokedAt || !agreement.approvedAt) return false;
        if (agreement.effectiveAt && new Date(agreement.effectiveAt).getTime() > now) return false;
        if (agreement.expiresAt && new Date(agreement.expiresAt).getTime() < now) return false;
        return agreement.allowedUses?.publicListing === true && agreement.allowedUses?.externalSharing === true;
    });
}

function ownerOptions(organization) {
    return (organization?.access || []).filter((entry) => !entry.revokedAt && entry.user?.id);
}

function Feedback({ value }) {
    if (!value) return null;
    return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${value.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{value.message}</div>;
}

export default function ResourceClaimsPanel({ readOnly = false } = {}) {
    const { user } = useAuth();
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const [claims, setClaims] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [resubmitClaimId, setResubmitClaimId] = useState(null);
    const [candidateQuery, setCandidateQuery] = useState('');
    const [candidates, setCandidates] = useState([]);
    const [actionDrafts, setActionDrafts] = useState({});
    const [loading, setLoading] = useState(true);
    const [candidateLoading, setCandidateLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const isSuperAdmin = normalizeRole(user?.role) === 'super_admin';

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [claimData, organizationData] = await Promise.all([
                api.getResourceClaims(),
                api.getGovernanceOrganizations(),
            ]);
            const nextOrganizations = organizationData.organizations || [];
            setClaims(claimData.claims || []);
            setOrganizations(nextOrganizations);
            setForm((current) => ({
                ...current,
                organizationId: current.organizationId || String(nextOrganizations[0]?.id || ''),
            }));
            setFeedback(null);
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || 'Resource claims could not be loaded.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (readOnly || resubmitClaimId || !form.organizationId || candidateQuery.trim().length < 2) {
            setCandidates([]);
            return undefined;
        }
        const timer = window.setTimeout(async () => {
            setCandidateLoading(true);
            try {
                const data = await api.getResourceClaimCandidates(form.organizationId, form.resourceType, candidateQuery);
                setCandidates(data.candidates || []);
            } catch (error) {
                setCandidates([]);
                setFeedback({ type: 'error', message: error.message || 'Claim candidates could not be loaded.' });
            } finally {
                setCandidateLoading(false);
            }
        }, 250);
        return () => window.clearTimeout(timer);
    }, [candidateQuery, form.organizationId, form.resourceType, readOnly, resubmitClaimId]);

    const selectedOrganization = useMemo(() => findOrganization(organizations, form.organizationId), [organizations, form.organizationId]);
    const visibleFieldOptions = form.resourceType === 'soft' ? FIELD_OPTIONS : FIELD_OPTIONS.filter(([key]) => key !== 'ctaUrl');

    function updateForm(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function toggleFormField(field) {
        setForm((current) => ({
            ...current,
            requestedFields: current.requestedFields.includes(field)
                ? current.requestedFields.filter((item) => item !== field)
                : [...current.requestedFields, field],
        }));
    }

    function toggleFormUse(use) {
        setForm((current) => ({ ...current, requestedUses: { ...current.requestedUses, [use]: !current.requestedUses[use] } }));
    }

    function resetForm(organizationId = form.organizationId) {
        setForm({ ...EMPTY_FORM, organizationId: String(organizationId || '') });
        setResubmitClaimId(null);
        setCandidateQuery('');
        setCandidates([]);
    }

    async function submitClaim(event) {
        event.preventDefault();
        setSaving(true);
        setFeedback(null);
        try {
            const scope = {
                requestedFields: form.requestedFields,
                requestedUses: form.requestedUses,
                evidenceNote: form.evidenceNote,
                attestedOwnerAuthority: form.attestedOwnerAuthority,
            };
            if (resubmitClaimId) {
                const previous = claims.find((claim) => claim.id === resubmitClaimId);
                await api.resubmitResourceClaim(resubmitClaimId, { ...scope, expectedRevision: previous.revision });
            } else {
                await api.submitResourceClaim({
                    ...scope,
                    organizationId: Number(form.organizationId),
                    resourceType: form.resourceType,
                    resourceId: Number(form.resourceId),
                });
            }
            const successMessage = resubmitClaimId ? 'Claim resubmitted for review.' : 'Resource claim submitted for review.';
            resetForm(form.organizationId);
            await load();
            setFeedback({ type: 'success', message: successMessage });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || 'Resource claim could not be submitted.' });
        } finally {
            setSaving(false);
        }
    }

    function beginResubmit(claim) {
        setResubmitClaimId(claim.id);
        setForm({
            organizationId: String(claim.organization?.id || ''),
            resourceType: claim.resourceType,
            resourceId: String(claim.resource?.id || ''),
            requestedFields: claim.approvedFields || [],
            requestedUses: claim.allowedUses || { sharedMaps: false, embeds: false },
            evidenceNote: claim.provenanceNote || '',
            attestedOwnerAuthority: false,
        });
        window.requestAnimationFrame(() => document.getElementById('resource-claim-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

    function draftFor(claim) {
        const organization = findOrganization(organizations, claim.organization?.id);
        const owners = ownerOptions(organization);
        const agreements = activeAgreementOptions(organization);
        return actionDrafts[claim.id] || {
            ownerUserId: String(owners.find((entry) => entry.accessRole === 'admin')?.user?.id || owners[0]?.user?.id || ''),
            agreementId: String(agreements[0]?.id || ''),
            approvedFields: [...(claim.approvedFields || [])],
            allowedUses: { ...claim.allowedUses },
            reason: '',
        };
    }

    function updateDraft(claim, patch) {
        setActionDrafts((current) => ({ ...current, [claim.id]: { ...draftFor(claim), ...patch } }));
    }

    async function runAction(claim, kind) {
        const draft = draftFor(claim);
        const labels = {
            verify: ['Verify resource Owner?', 'This creates the organisation-resource link and assigns the selected user as a resource Owner.', 'Verify Owner'],
            publish: ['Approve publication permission?', 'Only the selected owner-requested fields and uses will appear in public personal Shared Maps or embeds.', 'Approve publication'],
            reject: ['Reject this resource claim?', 'The reason remains visible to the organisation and the claim can be resubmitted.', 'Reject claim'],
            withdraw: ['Withdraw publication permission?', 'Provider media, copied descriptions and provider links will immediately fail closed in public personal Shared Maps and embeds.', 'Withdraw permission'],
        };
        const [title, message, confirmLabel] = labels[kind];
        const confirmed = await requestConfirmation({ title, message, confirmLabel, tone: kind === 'reject' || kind === 'withdraw' ? 'warning' : 'info' });
        if (!confirmed) return;
        setSaving(true);
        setFeedback(null);
        try {
            if (kind === 'verify') await api.verifyResourceClaimOwner(claim.id, { ownerUserId: Number(draft.ownerUserId), expectedRevision: claim.revision });
            if (kind === 'publish') await api.approveResourcePublication(claim.id, {
                agreementId: Number(draft.agreementId),
                approvedFields: draft.approvedFields,
                allowedUses: draft.allowedUses,
                expectedRevision: claim.revision,
            });
            if (kind === 'reject') await api.rejectResourceClaim(claim.id, { reason: draft.reason, expectedRevision: claim.revision });
            if (kind === 'withdraw') await api.withdrawResourcePermission(claim.id, { reason: draft.reason, expectedRevision: claim.revision });
            await load();
            setFeedback({ type: 'success', message: `${confirmLabel} completed.` });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || `${confirmLabel} could not be completed.` });
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-5" data-testid="resource-claims-panel">
            {confirmDialog}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">Gate 2</p>
                    <h2 className="mt-1 text-3xl font-black text-slate-950">Resource Claims</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Claim an existing demonstration record, assign its accountable Owner, and approve only the provider content and public uses covered by the organisation’s agreement.</p>
                </div>
                <button type="button" className="btn-secondary w-fit gap-2" onClick={load} disabled={loading || saving}><RefreshCw size={16} /> Refresh</button>
            </div>

            <Feedback value={feedback} />

            {!readOnly && organizations.length ? (
                <form id="resource-claim-form" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submitClaim}>
                    <div className="flex items-start gap-3">
                        <span className="rounded-xl bg-teal-50 p-3 text-teal-700"><FileCheck2 size={21} /></span>
                        <div><h3 className="text-lg font-black text-slate-950">{resubmitClaimId ? 'Resubmit claim' : 'New claim'}</h3><p className="text-sm text-slate-500">Evidence stays inside the authenticated organisation workspace and audit trail.</p></div>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <label className="space-y-1"><span className="text-sm font-bold text-slate-700">Organisation</span><select className="input-field" value={form.organizationId} onChange={(event) => { updateForm('organizationId', event.target.value); updateForm('resourceId', ''); }} disabled={saving || Boolean(resubmitClaimId)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
                        <label className="space-y-1"><span className="text-sm font-bold text-slate-700">Resource type</span><select className="input-field" value={form.resourceType} onChange={(event) => setForm((current) => ({ ...current, resourceType: event.target.value, resourceId: '', requestedFields: current.requestedFields.filter((field) => event.target.value === 'soft' || field !== 'ctaUrl') }))} disabled={saving || Boolean(resubmitClaimId)}><option value="hard">Place</option><option value="soft">Programme, service or promotion</option></select></label>
                    </div>
                    {resubmitClaimId ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">{resourceLabel(claims.find((claim) => claim.id === resubmitClaimId)?.resource)}</div> : (
                        <div className="mt-4 space-y-2"><label className="relative block"><Search className="absolute left-3 top-3.5 text-slate-400" size={18} /><input className="input-field pl-10" value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} minLength={2} placeholder="Search demonstration records by name, address or postcode" /></label><select className="input-field" value={form.resourceId} onChange={(event) => updateForm('resourceId', event.target.value)} required><option value="">{candidateLoading ? 'Searching…' : candidateQuery.trim().length < 2 ? 'Enter at least 2 characters to search' : 'Select a resource to claim'}</option>{candidates.map((candidate) => <option key={`${candidate.resourceType}:${candidate.id}`} value={candidate.id}>{resourceLabel(candidate)}</option>)}</select></div>
                    )}
                    <fieldset className="mt-5"><legend className="text-sm font-black text-slate-800">Requested public fields</legend><div className="mt-2 flex flex-wrap gap-2">{visibleFieldOptions.map(([key, label]) => <label key={key} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.requestedFields.includes(key)} onChange={() => toggleFormField(key)} /> {label}</label>)}</div></fieldset>
                    <fieldset className="mt-5"><legend className="text-sm font-black text-slate-800">Requested public uses</legend><div className="mt-2 flex flex-wrap gap-2">{USE_OPTIONS.map(([key, label]) => <label key={key} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.requestedUses[key]} onChange={() => toggleFormUse(key)} /> {label}</label>)}</div></fieldset>
                    <label className="mt-5 block space-y-1"><span className="text-sm font-bold text-slate-700">Ownership evidence</span><textarea className="input-field min-h-28" value={form.evidenceNote} onChange={(event) => updateForm('evidenceNote', event.target.value)} minLength={20} maxLength={2000} required placeholder="State how your organisation operates this resource and provide an official reference or URL." /></label>
                    <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><input className="mt-1" type="checkbox" checked={form.attestedOwnerAuthority} onChange={(event) => updateForm('attestedOwnerAuthority', event.target.checked)} required /><span>I confirm that I am authorised to submit this claim for {selectedOrganization?.name || 'the organisation'} and that any replacement media or content will be organisation-supplied.</span></label>
                    <div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary gap-2" type="submit" disabled={saving || !form.resourceId || !form.attestedOwnerAuthority}><ShieldCheck size={17} /> {resubmitClaimId ? 'Resubmit claim' : 'Submit claim'}</button>{resubmitClaimId ? <button className="btn-secondary gap-2" type="button" onClick={() => resetForm(form.organizationId)}><Undo2 size={16} /> Cancel</button> : null}</div>
                </form>
            ) : null}

            <div className="space-y-4">
                {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading resource claims…</div> : null}
                {!loading && claims.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-sm text-slate-500">No resource claims have been submitted.</div> : null}
                {claims.map((claim) => {
                    const displayStatus = claim.permissions?.displayStatus || claim.status;
                    const [statusLabel, statusClass] = STATUS_META[displayStatus] || [displayStatus, 'border-slate-200 bg-slate-50 text-slate-700'];
                    const organization = findOrganization(organizations, claim.organization?.id);
                    const owners = ownerOptions(organization);
                    const agreements = activeAgreementOptions(organization);
                    const draft = draftFor(claim);
                    return (
                        <article key={claim.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex gap-3"><span className="rounded-xl bg-slate-100 p-3 text-slate-700"><Building2 size={20} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-slate-950">{claim.resource?.name}</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusClass}`}>{statusLabel}</span></div><p className="mt-1 text-sm text-slate-500">{claim.organization?.name} · {claim.resourceType === 'hard' ? 'Place' : 'Offering'} #{claim.resource?.id}</p></div></div><Link className="btn-secondary w-fit text-sm" to={`/resource/${claim.resourceType}/${claim.resource?.id}`}>Review resource</Link></div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Ownership evidence</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{claim.provenanceNote}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Requested scope</p><p className="mt-2 text-sm text-slate-700">Fields: {(claim.approvedFields || []).join(', ') || 'None'}</p><p className="mt-1 text-sm text-slate-700">Uses: {USE_OPTIONS.filter(([key]) => claim.allowedUses?.[key]).map(([, label]) => label).join(', ') || 'None'}</p></div></div>
                            {claim.withdrawalReason ? <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800"><strong>Reason:</strong> {claim.withdrawalReason}</div> : null}
                            {claim.permissions?.canVerifyOwner ? <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><select className="input-field" value={draft.ownerUserId} onChange={(event) => updateDraft(claim, { ownerUserId: event.target.value })}><option value="">Select accountable resource Owner</option>{owners.map((entry) => <option key={entry.id} value={entry.user.id}>{entry.user.name || entry.user.email} · {entry.accessRole}</option>)}</select><button type="button" className="btn-primary gap-2" disabled={saving || !draft.ownerUserId} onClick={() => runAction(claim, 'verify')}><BadgeCheck size={17} /> Verify Owner</button></div> : null}
                            {claim.permissions?.canApprovePublication ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="grid gap-3 lg:grid-cols-2"><label className="space-y-1"><span className="text-sm font-bold text-slate-700">Covered agreement</span><select className="input-field bg-white" value={draft.agreementId} onChange={(event) => updateDraft(claim, { agreementId: event.target.value })}><option value="">Select agreement</option>{agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.agreementReference}</option>)}</select></label><div><p className="text-sm font-bold text-slate-700">Approved public uses</p><div className="mt-2 flex flex-wrap gap-2">{USE_OPTIONS.filter(([key]) => claim.allowedUses?.[key]).map(([key, label]) => <label key={key} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.allowedUses?.[key] === true} onChange={() => updateDraft(claim, { allowedUses: { ...draft.allowedUses, [key]: !draft.allowedUses?.[key] } })} /> {label}</label>)}</div></div></div><div className="mt-3 flex flex-wrap gap-2">{FIELD_OPTIONS.filter(([key]) => claim.approvedFields?.includes(key)).map(([key, label]) => <label key={key} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm"><input type="checkbox" checked={draft.approvedFields.includes(key)} onChange={() => updateDraft(claim, { approvedFields: draft.approvedFields.includes(key) ? draft.approvedFields.filter((item) => item !== key) : [...draft.approvedFields, key] })} /> {label}</label>)}</div><p className="mt-3 text-xs leading-5 text-emerald-900">Confirm that the current values were supplied or approved by the Owner. Approval can narrow this request and cannot add fields or uses.</p><button type="button" className="btn-primary mt-4 gap-2" disabled={saving || !draft.agreementId || draft.approvedFields.length === 0 || !Object.values(draft.allowedUses || {}).some(Boolean)} onClick={() => runAction(claim, 'publish')}><CheckCircle2 size={17} /> Approve publication</button></div> : null}
                            {(claim.permissions?.canReject || claim.permissions?.canWithdraw) ? <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input className="input-field" value={draft.reason} onChange={(event) => updateDraft(claim, { reason: event.target.value })} minLength={10} maxLength={1000} placeholder={claim.permissions.canReject ? 'Reason for rejecting this claim' : 'Reason for withdrawing permission'} /><button type="button" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700 disabled:opacity-50" disabled={saving || draft.reason.trim().length < 10} onClick={() => runAction(claim, claim.permissions.canReject ? 'reject' : 'withdraw')}>{claim.permissions.canReject ? <><XCircle className="mr-2 inline" size={17} />Reject claim</> : <><Undo2 className="mr-2 inline" size={17} />Withdraw</>}</button></div> : null}
                            {claim.permissions?.canResubmit && !readOnly ? <button type="button" className="btn-secondary mt-4 gap-2" onClick={() => beginResubmit(claim)}><RotateCcw size={16} /> Revise and resubmit</button> : null}
                            {claim.permissions?.canEditResource ? <p className="mt-4 text-sm text-slate-600"><Link className="font-bold text-brand-700 hover:underline" to="/dashboard/resources">Manage the owner-supplied resource content</Link> before publication approval.</p> : null}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
