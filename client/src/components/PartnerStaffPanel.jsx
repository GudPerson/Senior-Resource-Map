import { useEffect, useMemo, useState } from 'react';
import { Building2, RefreshCw, Search, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';

import { api } from '../lib/api.js';
import { getRoleMeta, normalizeRole } from '../lib/roles.js';

function resolveUserId(user) {
    const id = user?.user?.id ?? user?.userId ?? user?.id;
    const parsed = Number(id);
    return Number.isInteger(parsed) ? parsed : null;
}

function displayUserName(user) {
    const account = user?.user || user;
    return account?.name || account?.username || account?.email || `User #${resolveUserId(user) || 'unknown'}`;
}

function displayUserDetail(user) {
    const account = user?.user || user;
    const bits = [account?.email, account?.username].filter(Boolean);
    return bits.length ? bits.join(' | ') : `User ID ${resolveUserId(user) || 'unknown'}`;
}

function getUserRole(user) {
    return user?.user?.role || user?.role || user?.userRole;
}

function roleLabel(role) {
    return normalizeRole(role) === 'owner' ? 'Owner' : 'Editor';
}

function roleBadgeClass(role) {
    return normalizeRole(role) === 'owner'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-sky-200 bg-sky-50 text-sky-700';
}

function uniqueByUserId(rows) {
    const seen = new Set();
    return rows.filter((row) => {
        const id = resolveUserId(row);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export default function PartnerStaffPanel() {
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
    const [staff, setStaff] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [candidateQuery, setCandidateQuery] = useState('');
    const [addUserId, setAddUserId] = useState('');
    const [handoverUserId, setHandoverUserId] = useState('');
    const [loadingOrganizations, setLoadingOrganizations] = useState(true);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const selectedOrganization = organizations.find((org) => String(org.id) === String(selectedOrganizationId)) || null;
    const owner = staff.find((member) => normalizeRole(member.staffRole) === 'owner') || null;
    const editors = staff.filter((member) => normalizeRole(member.staffRole) !== 'owner');

    const handoverOptions = useMemo(() => uniqueByUserId([
        ...editors.map((member) => ({
            id: member.userId,
            name: member.user?.name,
            username: member.user?.username,
            email: member.user?.email,
            role: getUserRole(member),
            isExistingStaff: true,
        })),
        ...candidates,
    ]), [candidates, editors]);

    async function loadOrganizations() {
        setLoadingOrganizations(true);
        setFeedback(null);
        try {
            const data = await api.getPartnerOrganizations();
            const rows = Array.isArray(data?.organizations) ? data.organizations : [];
            setOrganizations(rows);
            if (data?.setupRequired) {
                setFeedback({
                    type: 'info',
                    message: data.message || 'Partner staff setup is not ready yet. Finish setup before adding staff access.',
                });
            }
            setSelectedOrganizationId((current) => {
                if (rows.some((org) => String(org.id) === String(current))) return current;
                return rows[0]?.id ? String(rows[0].id) : '';
            });
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to load partner organisations.' });
        } finally {
            setLoadingOrganizations(false);
        }
    }

    async function loadStaff(organizationId = selectedOrganizationId) {
        if (!organizationId) {
            setStaff([]);
            return;
        }
        setLoadingStaff(true);
        setFeedback(null);
        try {
            const data = await api.getPartnerOrganizationStaff(organizationId);
            setStaff(Array.isArray(data?.staff) ? data.staff : []);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to load partner staff.' });
        } finally {
            setLoadingStaff(false);
        }
    }

    async function loadCandidates(organizationId = selectedOrganizationId, query = candidateQuery) {
        if (!organizationId) {
            setCandidates([]);
            return;
        }
        try {
            const data = await api.getPartnerOrganizationStaffCandidates(organizationId, query);
            setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to load staff candidates.' });
        }
    }

    useEffect(() => {
        loadOrganizations();
    }, []);

    useEffect(() => {
        if (!selectedOrganizationId) return undefined;
        loadStaff(selectedOrganizationId);
        return undefined;
    }, [selectedOrganizationId]);

    useEffect(() => {
        if (!selectedOrganizationId) return undefined;
        const timer = window.setTimeout(() => {
            loadCandidates(selectedOrganizationId, candidateQuery);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [candidateQuery, selectedOrganizationId, staff.length]);

    async function refreshCurrentOrganization() {
        await Promise.all([
            loadOrganizations(),
            selectedOrganizationId ? loadStaff(selectedOrganizationId) : Promise.resolve(),
            selectedOrganizationId ? loadCandidates(selectedOrganizationId, candidateQuery) : Promise.resolve(),
        ]);
    }

    async function handleAddStaff(e) {
        e.preventDefault();
        if (!selectedOrganizationId || !addUserId) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.addPartnerOrganizationStaff(selectedOrganizationId, {
                userId: Number(addUserId),
                staffRole: 'editor',
            });
            setAddUserId('');
            setFeedback({ type: 'success', message: 'Staff access added as Editor.' });
            await Promise.all([
                loadStaff(selectedOrganizationId),
                loadCandidates(selectedOrganizationId, candidateQuery),
            ]);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to add staff access.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleRevoke(member) {
        if (!selectedOrganizationId || !member?.id) return;
        if (!window.confirm(`Remove staff access for ${displayUserName(member)}? Their personal account will not be deleted.`)) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.revokePartnerOrganizationStaff(selectedOrganizationId, member.id);
            setFeedback({ type: 'success', message: 'Staff access removed.' });
            await Promise.all([
                loadStaff(selectedOrganizationId),
                loadCandidates(selectedOrganizationId, candidateQuery),
            ]);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to remove staff access.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleHandover(e, directUserId) {
        e?.preventDefault?.();
        const targetUserId = Number(directUserId || handoverUserId);
        if (!selectedOrganizationId || !Number.isInteger(targetUserId)) return;

        const target = handoverOptions.find((candidate) => resolveUserId(candidate) === targetUserId)
            || staff.find((member) => resolveUserId(member) === targetUserId)
            || { userId: targetUserId };
        if (!window.confirm(`Make ${displayUserName(target)} the Owner for ${selectedOrganization?.name || 'this partner organisation'}?`)) return;

        setSaving(true);
        setFeedback(null);
        try {
            const data = await api.handoverPartnerOrganizationOwner(selectedOrganizationId, {
                newOwnerUserId: targetUserId,
            });
            setStaff(Array.isArray(data?.staff) ? data.staff : []);
            setHandoverUserId('');
            setFeedback({ type: 'success', message: 'Owner handover completed.' });
            await loadCandidates(selectedOrganizationId, candidateQuery);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to complete owner handover.' });
        } finally {
            setSaving(false);
        }
    }

    const feedbackClass = feedback?.type === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : feedback?.type === 'info'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-green-200 bg-green-50 text-green-700';

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                                <Building2 size={22} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Partner staff access</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    Give real user accounts access to manage a partner organisation's resources.
                                </p>
                            </div>
                        </div>
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
                            Existing resources still belong to the original partner owner account. This bridge lets staff work on behalf of that owner without sharing passwords or changing resource ownership yet.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={refreshCurrentOrganization}
                        disabled={loadingOrganizations || loadingStaff || saving}
                        className="btn-ghost justify-center disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loadingOrganizations || loadingStaff ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {feedback ? (
                    <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedbackClass}`}>
                        {feedback.message}
                    </div>
                ) : null}

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <label className="text-sm font-bold text-slate-700" htmlFor="partner-organization-select">
                            Partner organisation
                        </label>
                        <select
                            id="partner-organization-select"
                            value={selectedOrganizationId}
                            onChange={(e) => setSelectedOrganizationId(e.target.value)}
                            disabled={loadingOrganizations || organizations.length === 0}
                            className="input-field mt-2 w-full"
                        >
                            {organizations.length === 0 ? (
                                <option value="">No partner organisations found</option>
                            ) : organizations.map((organization) => (
                                <option key={organization.id} value={organization.id}>
                                    {organization.name || `Partner organisation #${organization.id}`}
                                </option>
                            ))}
                        </select>
                        {selectedOrganization ? (
                            <div className="mt-4 rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                                <p className="font-bold text-slate-900">{selectedOrganization.name}</p>
                                <p className="mt-1">Legacy partner owner ID: {selectedOrganization.legacyPartnerUserId}</p>
                                {selectedOrganization.subregionIds?.length ? (
                                    <p className="mt-1">Subregion scope: {selectedOrganization.subregionIds.join(', ')}</p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Current staff</h3>
                                <p className="mt-1 text-sm text-slate-500">Owner and Editor accounts can manage this partner's resources.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                {staff.length} active
                            </span>
                        </div>

                        {loadingStaff ? (
                            <div className="mt-4 space-y-3">
                                {[...Array(3)].map((_, index) => (
                                    <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                                ))}
                            </div>
                        ) : staff.length === 0 ? (
                            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                                No staff access has been added yet.
                            </div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {staff.map((member) => {
                                    const isOwner = normalizeRole(member.staffRole) === 'owner';
                                    const userRoleMeta = getRoleMeta(getUserRole(member));
                                    return (
                                        <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-bold text-slate-900">{displayUserName(member)}</p>
                                                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleBadgeClass(member.staffRole)}`}>
                                                            {roleLabel(member.staffRole)}
                                                        </span>
                                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${userRoleMeta.pillClassName}`}>
                                                            {userRoleMeta.label}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 truncate text-sm text-slate-500">{displayUserDetail(member)}</p>
                                                </div>
                                                {isOwner ? (
                                                    <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-700">
                                                        <ShieldCheck size={16} />
                                                        Current owner
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleHandover(e, resolveUserId(member))}
                                                            disabled={saving}
                                                            className="btn-ghost justify-center text-xs disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Make Owner
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevoke(member)}
                                                            disabled={saving}
                                                            className="btn-ghost justify-center text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <UserMinus size={14} />
                                                            Remove
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <form onSubmit={handleAddStaff} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Add Editor</h3>
                            <p className="text-sm text-slate-500">Editors can manage resources, but cannot hand over ownership.</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="text-sm font-bold text-slate-700" htmlFor="partner-staff-search">
                            Find existing user
                        </label>
                        <div className="relative mt-2">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="partner-staff-search"
                                value={candidateQuery}
                                onChange={(e) => setCandidateQuery(e.target.value)}
                                className="input-field w-full pl-10"
                                placeholder="Search by name, email, or username"
                            />
                        </div>
                    </div>
                    <select
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        className="input-field mt-3 w-full"
                        disabled={!selectedOrganizationId || candidates.length === 0}
                    >
                        <option value="">Select user to add</option>
                        {candidates.map((candidate) => (
                            <option key={resolveUserId(candidate) || candidate.id} value={resolveUserId(candidate) || ''}>
                                {displayUserName(candidate)} ({getRoleMeta(candidate.role).label})
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={!addUserId || saving}
                        className="btn-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <UserPlus size={16} />
                        Add as Editor
                    </button>
                </form>

                <form onSubmit={handleHandover} className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-amber-700">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Owner handover</h3>
                            <p className="text-sm text-slate-600">Use this when a partner account should move to a new staff owner.</p>
                        </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-white/70 px-4 py-3 text-sm text-slate-600">
                        Current owner: <span className="font-bold text-slate-900">{owner ? displayUserName(owner) : 'Not assigned'}</span>
                    </div>
                    <select
                        value={handoverUserId}
                        onChange={(e) => setHandoverUserId(e.target.value)}
                        className="input-field mt-3 w-full"
                        disabled={!selectedOrganizationId || handoverOptions.length === 0}
                    >
                        <option value="">Select new owner</option>
                        {handoverOptions.map((candidate) => (
                            <option key={resolveUserId(candidate) || candidate.id} value={resolveUserId(candidate) || ''}>
                                {displayUserName(candidate)}{candidate.isExistingStaff ? ' (current editor)' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={!handoverUserId || saving}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ShieldCheck size={16} />
                        Complete Owner Handover
                    </button>
                </form>
            </section>
        </div>
    );
}
