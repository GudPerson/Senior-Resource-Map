import { useEffect, useMemo, useState } from 'react';
import { Building2, Link2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Users } from 'lucide-react';

import { api } from '../../lib/api.js';
import {
    formatGovernanceActionError,
    formatGovernanceGroupScopeLabel,
    getGovernanceGroupRoleOptionLabel,
    getGovernanceGroupTypeMeta,
} from '../../lib/governanceOrganizationUi.js';

const EMPTY_GROUP_FORM = {
    groupType: 'org',
    organizationId: '',
    subregionId: '',
    name: '',
    description: '',
    coordinationStatus: 'active',
    publicLabel: '',
    publicSummary: '',
};

const GROUP_STATUS_META = {
    active: {
        label: 'Active',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    draft: {
        label: 'Draft',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
    },
    paused: {
        label: 'Paused',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    archived: {
        label: 'Archived',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
    },
};

function getPanelGroupType(mode) {
    return mode === 'region' ? 'region' : 'org';
}

function normalizeGroupStatus(value) {
    const status = String(value || 'active').trim().toLowerCase();
    return GROUP_STATUS_META[status] ? status : 'active';
}

function getGroupStatusMeta(value) {
    return GROUP_STATUS_META[normalizeGroupStatus(value)];
}

function getDefaultGroupForm({ mode = 'organization', organizationId = null } = {}) {
    return {
        ...EMPTY_GROUP_FORM,
        groupType: getPanelGroupType(mode),
        organizationId: organizationId || '',
    };
}

function normalizeGroupForm(group, fallback = {}) {
    if (!group) return { ...EMPTY_GROUP_FORM, ...fallback };
    return {
        groupType: group.groupType || fallback.groupType || 'org',
        organizationId: group.organizationId || fallback.organizationId || '',
        subregionId: group.subregionId || '',
        name: group.name || '',
        description: group.description || '',
        coordinationStatus: normalizeGroupStatus(group.coordinationStatus),
        publicLabel: group.publicLabel || '',
        publicSummary: group.publicSummary || '',
    };
}

function compactDisplayName(user = {}) {
    return user.name || user.username || user.email || `User ${user.id}`;
}

function formatResourceTypeLabel(resourceType = '') {
    const normalized = String(resourceType || '').trim().toLowerCase();
    if (normalized === 'hard') return 'Place';
    if (normalized === 'template') return 'Template';
    return 'Offering';
}

function formatResourceKey(resource = {}) {
    return `${resource.resourceType}:${resource.resourceId}`;
}

function containsInternalPublicCopy(value = '') {
    return /org group|region group|iccp|subregion|governance|admin|boundary|internal/i.test(String(value || ''));
}

function Feedback({ feedback }) {
    if (!feedback) return null;
    const isError = feedback.type === 'error';
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {feedback.message}
        </div>
    );
}

export default function GovernanceGroupsPanel({
    organization = null,
    organizationId = null,
    mode = 'organization',
    readOnly = false,
} = {}) {
    const panelGroupType = getPanelGroupType(mode);
    const resolvedOrganizationId = organizationId || organization?.id || null;
    const [groups, setGroups] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState(() => getDefaultGroupForm({ mode, organizationId: resolvedOrganizationId }));
    const [memberForm, setMemberForm] = useState({ userId: '', groupRole: 'staff' });
    const [organizationLinkForm, setOrganizationLinkForm] = useState({ organizationId: '' });
    const [resourceLinkForm, setResourceLinkForm] = useState({ resourceKey: '' });
    const [allOrganizations, setAllOrganizations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [feedback, setFeedback] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selectedGroup = useMemo(() => (
        groups.find((group) => Number(group.id) === Number(selectedId)) || null
    ), [groups, selectedId]);

    const visibleOrganizations = useMemo(() => {
        if (panelGroupType === 'region') return allOrganizations;
        return organization ? [organization] : [];
    }, [allOrganizations, organization, panelGroupType]);

    const groupMemberIds = useMemo(() => new Set((selectedGroup?.members || [])
        .map((member) => Number(member.userId))
        .filter(Boolean)), [selectedGroup?.members]);

    const groupOrganizationIds = useMemo(() => new Set((selectedGroup?.organizations || [])
        .map((entry) => Number(entry.organizationId))
        .filter(Boolean)), [selectedGroup?.organizations]);

    const groupResourceKeys = useMemo(() => new Set((selectedGroup?.resources || [])
        .map(formatResourceKey)
        .filter(Boolean)), [selectedGroup?.resources]);

    const memberCandidates = useMemo(() => {
        const sourceUsers = panelGroupType === 'region'
            ? allUsers
            : (organization?.access || []).map((entry) => entry.user).filter(Boolean);

        return sourceUsers
            .filter((user) => user?.id && !groupMemberIds.has(Number(user.id)))
            .sort((left, right) => compactDisplayName(left).localeCompare(compactDisplayName(right)));
    }, [allUsers, groupMemberIds, organization?.access, panelGroupType]);

    const organizationCandidates = useMemo(() => (
        visibleOrganizations
            .filter((item) => item?.id && !groupOrganizationIds.has(Number(item.id)))
            .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
    ), [groupOrganizationIds, visibleOrganizations]);

    const resourceCandidates = useMemo(() => {
        const regionOrganizationIds = new Set((selectedGroup?.organizations || [])
            .map((entry) => Number(entry.organizationId))
            .filter(Boolean));
        const candidateOrganizations = panelGroupType === 'region'
            ? visibleOrganizations.filter((item) => regionOrganizationIds.has(Number(item.id)))
            : (organization ? [organization] : []);

        const resources = [];
        for (const item of candidateOrganizations) {
            for (const link of item?.resourceLinks || []) {
                if (!link?.resourceType || !link?.resourceId) continue;
                resources.push({
                    ...link,
                    organizationName: item.name || '',
                });
            }
        }

        return resources
            .filter((resource) => !groupResourceKeys.has(formatResourceKey(resource)))
            .sort((left, right) => String(left.resourceName || '').localeCompare(String(right.resourceName || '')));
    }, [groupResourceKeys, organization, panelGroupType, selectedGroup?.organizations, visibleOrganizations]);

    const selectedResource = resourceCandidates.find((candidate) => formatResourceKey(candidate) === resourceLinkForm.resourceKey) || null;
    const canEdit = !readOnly;
    const canCreateNew = canEdit && (panelGroupType === 'region' || resolvedOrganizationId);

    async function loadGroups(nextSelectedId = selectedId) {
        setLoading(true);
        try {
            const params = { type: panelGroupType };
            if (resolvedOrganizationId && panelGroupType === 'org') params.organizationId = resolvedOrganizationId;
            const data = await api.getGovernanceGroups(params);
            const items = Array.isArray(data?.groups) ? data.groups : [];
            setGroups(items);
            const stillSelected = items.some((group) => Number(group.id) === Number(nextSelectedId));
            const resolvedSelectedId = stillSelected ? nextSelectedId : items[0]?.id || null;
            const nextGroup = items.find((group) => Number(group.id) === Number(resolvedSelectedId));

            setSelectedId(resolvedSelectedId);
            setForm(normalizeGroupForm(nextGroup, getDefaultGroupForm({ mode, organizationId: resolvedOrganizationId })));
            setFeedback(null);
        } catch (err) {
            setFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Groups failed to load.'),
            });
        } finally {
            setLoading(false);
        }
    }

    async function loadRegionOptions() {
        if (panelGroupType !== 'region') return;
        try {
            const [organizationData, userData] = await Promise.all([
                api.getGovernanceOrganizations(),
                api.getUsers(),
            ]);
            setAllOrganizations(Array.isArray(organizationData?.organizations) ? organizationData.organizations : []);
            setAllUsers(Array.isArray(userData) ? userData : []);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Region Group options failed to load.'),
            });
        }
    }

    useEffect(() => {
        setForm(getDefaultGroupForm({ mode, organizationId: resolvedOrganizationId }));
        setMemberForm({ userId: '', groupRole: 'staff' });
        setOrganizationLinkForm({ organizationId: '' });
        setResourceLinkForm({ resourceKey: '' });
        setActionFeedback(null);
        loadGroups(null);
        loadRegionOptions();
    }, [mode, panelGroupType, resolvedOrganizationId]);

    useEffect(() => {
        setMemberForm({ userId: '', groupRole: 'staff' });
        setOrganizationLinkForm({ organizationId: '' });
        setResourceLinkForm({ resourceKey: '' });
        setActionFeedback(null);
    }, [selectedGroup?.id]);

    async function handleRefresh() {
        await Promise.all([
            loadGroups(selectedGroup?.id || null),
            loadRegionOptions(),
        ]);
    }

    async function handleSaveGroup(event) {
        event.preventDefault();
        if (!canEdit) return;

        if (containsInternalPublicCopy(form.publicLabel) || containsInternalPublicCopy(form.publicSummary)) {
            setFeedback({
                type: 'error',
                message: 'Optional public wording should stay plain language and avoid internal coordination labels.',
            });
            return;
        }

        setSaving(true);
        setFeedback(null);
        try {
            const groupType = panelGroupType;
            const payload = {
                groupType,
                organizationId: groupType === 'org' ? Number(form.organizationId || resolvedOrganizationId) : undefined,
                subregionId: groupType === 'region' && form.subregionId ? Number(form.subregionId) : undefined,
                name: form.name,
                description: form.description,
                coordinationStatus: form.coordinationStatus,
                publicLabel: form.publicLabel,
                publicSummary: form.publicSummary,
            };

            if (selectedGroup) {
                await api.updateGovernanceGroup(selectedGroup.id, payload);
                setFeedback({ type: 'success', message: 'Group updated.' });
                await loadGroups(selectedGroup.id);
            } else {
                const created = await api.createGovernanceGroup(payload);
                setFeedback({ type: 'success', message: 'Group created.' });
                await loadGroups(created.id);
            }
        } catch (err) {
            setFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Group could not be saved.'),
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleAddMember(event) {
        event.preventDefault();
        if (!selectedGroup || !canEdit || !memberForm.userId) return;
        setSaving(true);
        setActionFeedback(null);
        try {
            await api.addGovernanceGroupMember(selectedGroup.id, {
                userId: Number(memberForm.userId),
                groupRole: memberForm.groupRole,
            });
            setActionFeedback({ type: 'success', message: 'Group member added.' });
            setMemberForm({ userId: '', groupRole: 'staff' });
            await loadGroups(selectedGroup.id);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Group member could not be added.'),
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleRemoveMember(membershipId) {
        if (!selectedGroup || !membershipId || !canEdit) return;
        setSaving(true);
        setActionFeedback(null);
        try {
            await api.revokeGovernanceGroupMember(selectedGroup.id, membershipId);
            setActionFeedback({ type: 'success', message: 'Group member removed.' });
            await loadGroups(selectedGroup.id);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Group member could not be removed.'),
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleLinkOrganization(event) {
        event.preventDefault();
        if (!selectedGroup || panelGroupType !== 'region' || !canEdit || !organizationLinkForm.organizationId) return;
        setSaving(true);
        setActionFeedback(null);
        try {
            await api.linkGovernanceGroupOrganization(selectedGroup.id, {
                organizationId: Number(organizationLinkForm.organizationId),
            });
            setActionFeedback({ type: 'success', message: 'Organisation linked to group.' });
            setOrganizationLinkForm({ organizationId: '' });
            await Promise.all([
                loadGroups(selectedGroup.id),
                loadRegionOptions(),
            ]);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Organisation could not be linked to the group.'),
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleUnlinkOrganization(linkId) {
        if (!selectedGroup || !linkId || !canEdit) return;
        setSaving(true);
        setActionFeedback(null);
        try {
            await api.unlinkGovernanceGroupOrganization(selectedGroup.id, linkId);
            setActionFeedback({ type: 'success', message: 'Organisation removed from group.' });
            await Promise.all([
                loadGroups(selectedGroup.id),
                loadRegionOptions(),
            ]);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Organisation could not be removed from the group.'),
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleLinkResource(event) {
        event.preventDefault();
        if (!selectedGroup || !selectedResource || !canEdit) return;
        setSaving(true);
        setActionFeedback(null);
        try {
            await api.linkGovernanceGroupResource(selectedGroup.id, {
                resourceType: selectedResource.resourceType,
                resourceId: Number(selectedResource.resourceId),
            });
            setActionFeedback({ type: 'success', message: 'Resource linked to group.' });
            setResourceLinkForm({ resourceKey: '' });
            await loadGroups(selectedGroup.id);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Resource could not be linked to the group.'),
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleUnlinkResource(linkId) {
        if (!selectedGroup || !linkId || !canEdit) return;
        setSaving(true);
        setActionFeedback(null);
        try {
            await api.unlinkGovernanceGroupResource(selectedGroup.id, linkId);
            setActionFeedback({ type: 'success', message: 'Resource removed from group.' });
            await loadGroups(selectedGroup.id);
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: formatGovernanceActionError(err, 'Resource could not be removed from the group.'),
            });
        } finally {
            setSaving(false);
        }
    }

    const panelTitle = panelGroupType === 'region' ? 'Region Groups' : 'Org Groups';
    const emptyHint = panelGroupType === 'region'
        ? 'No Region Groups yet.'
        : 'No Org Groups yet.';

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="rounded-xl bg-indigo-50 p-3 text-indigo-700">
                        <Users className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-900">{panelTitle}</h2>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                            Groups are coordination-only. Group roles do not grant resource editing, publishing, or restricted notes/files access.
                        </p>
                    </div>
                </div>
                <button type="button" className="btn-secondary w-fit gap-2" onClick={handleRefresh} disabled={loading || saving}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                Use groups for coordination metadata only. Resource ownership, publishing, restricted notes/files, and public Discover labels still follow the resource Owner/Staff rules.
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]">
                <div className="space-y-3">
                    {canCreateNew ? (
                        <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-black text-brand-700 transition hover:bg-brand-100"
                            onClick={() => {
                                setSelectedId(null);
                                setForm(getDefaultGroupForm({ mode, organizationId: resolvedOrganizationId }));
                                setFeedback(null);
                                setActionFeedback(null);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            New Group
                        </button>
                    ) : null}

                    {loading ? (
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">Loading groups...</p>
                    ) : groups.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm font-semibold text-slate-500">{emptyHint}</p>
                    ) : groups.map((group) => {
                        const typeMeta = getGovernanceGroupTypeMeta(group.groupType);
                        const statusMeta = getGroupStatusMeta(group.coordinationStatus);
                        return (
                            <button
                                key={group.id}
                                type="button"
                                className={`w-full rounded-xl border px-4 py-3 text-left transition ${Number(selectedId) === Number(group.id) ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'}`}
                                onClick={() => {
                                    setSelectedId(group.id);
                                    setForm(normalizeGroupForm(group, getDefaultGroupForm({ mode, organizationId: resolvedOrganizationId })));
                                    setFeedback(null);
                                    setActionFeedback(null);
                                }}
                            >
                                <span className="flex min-w-0 items-start justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="block truncate font-black">{group.name}</span>
                                        <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                                            {typeMeta.label} - {formatGovernanceGroupScopeLabel(group)}
                                        </span>
                                    </span>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black uppercase ${statusMeta.className}`}>
                                        {statusMeta.label}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-5">
                    <form onSubmit={handleSaveGroup} className="space-y-4">
                        <Feedback feedback={feedback} />
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-1">
                                <span className="text-sm font-bold text-slate-700">Group type</span>
                                <input
                                    value={getGovernanceGroupTypeMeta(panelGroupType).label}
                                    disabled
                                    className="input-field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-bold text-slate-700">Status</span>
                                <select
                                    className="input-field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    value={form.coordinationStatus}
                                    onChange={(event) => setForm((current) => ({ ...current, coordinationStatus: event.target.value }))}
                                    disabled={!canEdit || saving}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </label>
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">Name</span>
                                <input
                                    className="input-field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    value={form.name}
                                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                    required
                                    disabled={!canEdit || saving}
                                    placeholder={panelGroupType === 'region' ? 'Bukit Batok coordination group' : 'Internal programme team'}
                                />
                            </label>
                            {panelGroupType === 'region' ? (
                                <label className="space-y-1">
                                    <span className="text-sm font-bold text-slate-700">Optional region ID</span>
                                    <input
                                        className="input-field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                        value={form.subregionId}
                                        onChange={(event) => setForm((current) => ({ ...current, subregionId: event.target.value }))}
                                        disabled={!canEdit || saving}
                                        inputMode="numeric"
                                    />
                                </label>
                            ) : null}
                            <label className={`space-y-1 ${panelGroupType === 'region' ? '' : 'md:col-span-2'}`}>
                                <span className="text-sm font-bold text-slate-700">Optional public phrase</span>
                                <input
                                    className="input-field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    value={form.publicLabel}
                                    onChange={(event) => setForm((current) => ({ ...current, publicLabel: event.target.value }))}
                                    disabled={!canEdit || saving}
                                    placeholder="Supported by community partners"
                                />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">Coordination notes</span>
                                <textarea
                                    className="input-field min-h-[96px] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    value={form.description}
                                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    disabled={!canEdit || saving}
                                    placeholder="Internal coordination context for this group."
                                />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">Optional public summary</span>
                                <input
                                    className="input-field disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                    value={form.publicSummary}
                                    onChange={(event) => setForm((current) => ({ ...current, publicSummary: event.target.value }))}
                                    disabled={!canEdit || saving}
                                    placeholder="Delivered together with community partners."
                                />
                                <span className="block text-xs leading-5 text-slate-500">
                                    Keep this editable and optional. Avoid exposing internal coordination labels in public-facing text.
                                </span>
                            </label>
                        </div>
                        {canEdit ? (
                            <button type="submit" className="btn-primary w-full gap-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !canCreateNew}>
                                <Save className="h-4 w-4" />
                                {selectedGroup ? 'Save Group' : 'Create Group'}
                            </button>
                        ) : null}
                    </form>

                    {selectedGroup ? (
                        <div className="space-y-4">
                            <Feedback feedback={actionFeedback} />
                            <section className="rounded-xl border border-slate-200 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
                                    <div>
                                        <h3 className="font-black text-slate-900">Group access</h3>
                                        <p className="mt-1 text-sm text-slate-500">Group Admin/Staff can coordinate this group. They do not become resource Owner/Staff.</p>
                                    </div>
                                </div>
                                {canEdit ? (
                                    <form onSubmit={handleAddMember} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto]">
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">User</span>
                                            <select
                                                className="input-field min-h-[48px] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                                value={memberForm.userId}
                                                onChange={(event) => setMemberForm((current) => ({ ...current, userId: event.target.value }))}
                                                disabled={saving || memberCandidates.length === 0}
                                            >
                                                <option value="">{memberCandidates.length ? 'Choose user' : 'No eligible users'}</option>
                                                {memberCandidates.map((user) => (
                                                    <option key={user.id} value={user.id}>
                                                        {compactDisplayName(user)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Role</span>
                                            <select
                                                className="input-field min-h-[48px] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                                value={memberForm.groupRole}
                                                onChange={(event) => setMemberForm((current) => ({ ...current, groupRole: event.target.value }))}
                                                disabled={saving}
                                            >
                                                <option value="staff">Staff</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </label>
                                        <button type="submit" className="btn-primary min-h-[48px] gap-2 self-end disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !memberForm.userId}>
                                            <Plus className="h-4 w-4" />
                                            Add
                                        </button>
                                    </form>
                                ) : null}
                                <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                                    {(selectedGroup.members || []).length === 0 ? (
                                        <p className="p-4 text-sm text-slate-500">No group access assigned.</p>
                                    ) : selectedGroup.members.map((member) => (
                                        <div key={member.id} className="flex items-center justify-between gap-3 p-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-bold text-slate-800">{compactDisplayName(member.user)}</p>
                                                <p className="truncate text-xs text-slate-500">{member.user?.email || member.user?.username || ''} - {getGovernanceGroupRoleOptionLabel(member.groupRole)}</p>
                                            </div>
                                            {canEdit ? (
                                                <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => handleRemoveMember(member.id)} disabled={saving}>
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {panelGroupType === 'region' ? (
                                <section className="rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="rounded-lg bg-sky-50 p-2 text-sky-700"><Building2 className="h-4 w-4" /></span>
                                        <div>
                                            <h3 className="font-black text-slate-900">Linked organisations</h3>
                                            <p className="mt-1 text-sm text-slate-500">For Region Group coordination context only. Partner organisations remain in control of their own resources.</p>
                                        </div>
                                    </div>
                                    {canEdit ? (
                                        <form onSubmit={handleLinkOrganization} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <label className="space-y-1">
                                                <span className="text-sm font-bold text-slate-700">Organisation</span>
                                                <select
                                                    className="input-field min-h-[48px] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                                    value={organizationLinkForm.organizationId}
                                                    onChange={(event) => setOrganizationLinkForm({ organizationId: event.target.value })}
                                                    disabled={saving || organizationCandidates.length === 0}
                                                >
                                                    <option value="">{organizationCandidates.length ? 'Choose organisation' : 'No eligible organisations'}</option>
                                                    {organizationCandidates.map((item) => (
                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button type="submit" className="btn-primary min-h-[48px] gap-2 self-end disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !organizationLinkForm.organizationId}>
                                                <Link2 className="h-4 w-4" />
                                                Link
                                            </button>
                                        </form>
                                    ) : null}
                                    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                                        {(selectedGroup.organizations || []).length === 0 ? (
                                            <p className="p-4 text-sm text-slate-500">No linked organisations yet.</p>
                                        ) : selectedGroup.organizations.map((entry) => (
                                            <div key={entry.id} className="flex items-center justify-between gap-3 p-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-slate-800">{entry.organizationName || `Organisation ${entry.organizationId}`}</p>
                                                    <p className="truncate text-xs text-slate-500">Organisation #{entry.organizationId}</p>
                                                </div>
                                                {canEdit ? (
                                                    <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => handleUnlinkOrganization(entry.id)} disabled={saving}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ) : null}

                            <section className="rounded-xl border border-slate-200 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700"><Link2 className="h-4 w-4" /></span>
                                    <div>
                                        <h3 className="font-black text-slate-900">Linked resources</h3>
                                        <p className="mt-1 text-sm text-slate-500">Resource links describe coordination scope. They do not grant editing, publishing, or restricted content access.</p>
                                    </div>
                                </div>
                                {canEdit ? (
                                    <form onSubmit={handleLinkResource} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Resource</span>
                                            <select
                                                className="input-field min-h-[48px] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                                value={resourceLinkForm.resourceKey}
                                                onChange={(event) => setResourceLinkForm({ resourceKey: event.target.value })}
                                                disabled={saving || resourceCandidates.length === 0}
                                            >
                                                <option value="">{resourceCandidates.length ? 'Choose linked resource' : 'No eligible resources'}</option>
                                                {resourceCandidates.map((resource) => (
                                                    <option key={formatResourceKey(resource)} value={formatResourceKey(resource)}>
                                                        {resource.resourceName || `Resource ${resource.resourceId}`} - {formatResourceTypeLabel(resource.resourceType)}
                                                    </option>
                                                ))}
                                            </select>
                                            {panelGroupType === 'region' && (selectedGroup.organizations || []).length === 0 ? (
                                                <span className="block text-xs leading-5 text-slate-500">Link at least one organisation before adding its resources to this Region Group.</span>
                                            ) : null}
                                        </label>
                                        <button type="submit" className="btn-primary min-h-[48px] gap-2 self-end disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !selectedResource}>
                                            <Link2 className="h-4 w-4" />
                                            Link
                                        </button>
                                    </form>
                                ) : null}
                                <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                                    {(selectedGroup.resources || []).length === 0 ? (
                                        <p className="p-4 text-sm text-slate-500">No linked resources yet.</p>
                                    ) : selectedGroup.resources.map((resource) => (
                                        <div key={resource.id} className="flex items-center justify-between gap-3 p-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-bold text-slate-800">{resource.resourceName || `Resource ${resource.resourceId}`}</p>
                                                <p className="truncate text-xs text-slate-500">{formatResourceTypeLabel(resource.resourceType)} #{resource.resourceId}</p>
                                            </div>
                                            {canEdit ? (
                                                <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => handleUnlinkResource(resource.id)} disabled={saving}>
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                            {canCreateNew ? 'Create or select a group to manage coordination members and links.' : 'Select an organisation before creating an Org Group.'}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
