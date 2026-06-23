import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';

import { api } from '../lib/api.js';
import { getRoleMeta, normalizeRole } from '../lib/roles.js';
import { useConfirmDialog } from './ConfirmDialog.jsx';

function resolveUserId(row) {
    const id = row?.user?.id ?? row?.userId ?? row?.id;
    const parsed = Number(id);
    return Number.isInteger(parsed) ? parsed : null;
}

function displayUserName(row) {
    const account = row?.user || row;
    return account?.name || account?.username || account?.email || `User #${resolveUserId(row) || 'unknown'}`;
}

function displayUserDetail(row) {
    const account = row?.user || row;
    const bits = [account?.email, account?.username].filter(Boolean);
    return bits.length ? bits.join(' | ') : `User ID ${resolveUserId(row) || 'unknown'}`;
}

function getUserRole(row) {
    return row?.user?.role || row?.role || row?.userRole;
}

function assetRoleLabel(role) {
    return normalizeRole(role) === 'owner' ? 'Owner' : 'Staff';
}

function assetRoleBadgeClass(role) {
    return normalizeRole(role) === 'owner'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-sky-200 bg-sky-50 text-sky-700';
}

export default function AssetAccessPanel({ asset, assetType = 'hard', onChanged }) {
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const [staff, setStaff] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [candidates, setCandidates] = useState([]);
    const [candidateQuery, setCandidateQuery] = useState('');
    const [addUserId, setAddUserId] = useState('');
    const [addRole, setAddRole] = useState('staff');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const ownerCount = staff.filter((member) => normalizeRole(member.staffRole) === 'owner').length;
    const canAddOwner = Boolean(permissions.canAddOwner);
    const canAddStaff = Boolean(permissions.canAddStaff);
    const canAddAny = canAddOwner || canAddStaff;
    const isGroupAsset = assetType === 'group' || asset?.assetMode === 'group';
    const isSoftAsset = assetType === 'soft' || isGroupAsset;
    const resourceLabel = isGroupAsset ? 'group' : (isSoftAsset ? 'offering' : 'place');
    const resourceLabelTitle = isGroupAsset ? 'Group' : (isSoftAsset ? 'Offering' : 'Asset');
    const accessApi = isSoftAsset
        ? {
            getStaff: api.getSoftAssetStaff,
            getCandidates: api.getSoftAssetStaffCandidates,
            addStaff: api.addSoftAssetStaff,
            revokeStaff: api.revokeSoftAssetStaff,
        }
        : {
            getStaff: api.getHardAssetStaff,
            getCandidates: api.getHardAssetStaffCandidates,
            addStaff: api.addHardAssetStaff,
            revokeStaff: api.revokeHardAssetStaff,
        };

    const roleOptions = useMemo(() => (
        [
            canAddStaff ? { value: 'staff', label: 'Staff' } : null,
            canAddOwner ? { value: 'owner', label: 'Owner' } : null,
        ].filter(Boolean)
    ), [canAddOwner, canAddStaff]);

    async function loadAccess() {
        if (!asset?.id) return;
        setLoading(true);
        setFeedback(null);
        try {
            const data = await accessApi.getStaff(asset.id);
            setStaff(Array.isArray(data?.staff) ? data.staff : []);
            setPermissions(data?.permissions || {});
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || `Unable to load ${resourceLabel} access.` });
        } finally {
            setLoading(false);
        }
    }

    async function loadCandidates(query = candidateQuery) {
        if (!asset?.id || !canAddAny) {
            setCandidates([]);
            return;
        }
        try {
            const data = await accessApi.getCandidates(asset.id, query);
            setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to load access candidates.' });
        }
    }

    useEffect(() => {
        loadAccess();
    }, [asset?.id]);

    useEffect(() => {
        if (!asset?.id || !canAddAny) return undefined;
        const timer = window.setTimeout(() => {
            loadCandidates(candidateQuery);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [asset?.id, candidateQuery, canAddAny, staff.length]);

    useEffect(() => {
        if (roleOptions.length && !roleOptions.some((option) => option.value === addRole)) {
            setAddRole(roleOptions[0].value);
        }
    }, [addRole, roleOptions]);

    async function handleAdd(e) {
        e.preventDefault();
        if (!asset?.id || !addUserId || !canAddAny) return;
        setSaving(true);
        setFeedback(null);
        try {
            await accessApi.addStaff(asset.id, {
                userId: Number(addUserId),
                staffRole: addRole,
            });
            setAddUserId('');
            setFeedback({ type: 'success', message: `${assetRoleLabel(addRole)} access added.` });
            await Promise.all([loadAccess(), loadCandidates(candidateQuery)]);
            await onChanged?.();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to add asset access.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleRemove(member) {
        if (!asset?.id || !member?.id) return;
        const confirmed = await requestConfirmation({
            title: 'Remove access?',
            message: `Remove ${assetRoleLabel(member.staffRole)} access for ${displayUserName(member)}? Their account will not be deleted.`,
            confirmLabel: 'Remove',
            loadingLabel: 'Removing...',
            tone: 'danger',
        });
        if (!confirmed) return;
        setSaving(true);
        setFeedback(null);
        try {
            await accessApi.revokeStaff(asset.id, member.id);
            setFeedback({ type: 'success', message: 'Asset access removed.' });
            await Promise.all([loadAccess(), loadCandidates(candidateQuery)]);
            await onChanged?.();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to remove asset access.' });
        } finally {
            setSaving(false);
        }
    }

    const feedbackClass = feedback?.type === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-green-200 bg-green-50 text-green-700';

    return (
        <>
            {confirmDialog}

            <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                            <Users size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">{resourceLabelTitle} access</h3>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                                {isGroupAsset
                                    ? 'Owners and Staff can edit this Group collection and members.'
                                    : isSoftAsset
                                    ? 'Owners and Staff can edit this standalone offering and restricted content.'
                                    : 'Owners and Staff can edit this place and its linked offerings.'}
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={loadAccess}
                    disabled={loading || saving}
                    className="btn-ghost justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {feedback ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${feedbackClass}`}>
                    {feedback.message}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h4 className="text-lg font-bold text-slate-900">Current access</h4>
                            <p className="mt-1 text-sm text-slate-500">{ownerCount} owner{ownerCount === 1 ? '' : 's'} assigned.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {staff.length} active
                        </span>
                    </div>

                    {loading ? (
                        <div className="mt-4 space-y-3">
                            {[...Array(3)].map((_, index) => (
                                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                            ))}
                        </div>
                    ) : staff.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                            No direct asset access has been assigned.
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {staff.map((member) => {
                                const memberRole = normalizeRole(member.staffRole);
                                const canRemove = memberRole === 'owner' ? permissions.canRemoveOwner : permissions.canRemoveStaff;
                                const userRoleMeta = getRoleMeta(getUserRole(member));
                                return (
                                    <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-bold text-slate-900">{displayUserName(member)}</p>
                                                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${assetRoleBadgeClass(member.staffRole)}`}>
                                                        {assetRoleLabel(member.staffRole)}
                                                    </span>
                                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${userRoleMeta.pillClassName}`}>
                                                        {userRoleMeta.label}
                                                    </span>
                                                </div>
                                                <p className="mt-1 truncate text-sm text-slate-500">{displayUserDetail(member)}</p>
                                            </div>
                                            {memberRole === 'owner' && !permissions.canRemoveOwner ? (
                                                <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-700">
                                                    <ShieldCheck size={16} />
                                                    Owner
                                                </div>
                                            ) : canRemove ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(member)}
                                                    disabled={saving}
                                                    className="btn-ghost justify-center text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <UserMinus size={14} />
                                                    Remove
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <form onSubmit={handleAdd} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-900">Add access</h4>
                            <p className="mt-1 text-sm text-slate-500">
                                {canAddAny ? 'Search for a real user account.' : `Only ${resourceLabelTitle} Owners can add staff.`}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        <label className="block text-sm font-bold text-slate-700" htmlFor={`asset-access-search-${assetType}-${asset?.id}`}>
                            User
                        </label>
                        <div className="relative">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id={`asset-access-search-${assetType}-${asset?.id}`}
                                type="search"
                                value={candidateQuery}
                                onChange={(event) => setCandidateQuery(event.target.value)}
                                disabled={!canAddAny}
                                className="input-field w-full pl-9"
                                placeholder="Search name, username, or email"
                            />
                        </div>
                        <select
                            value={addUserId}
                            onChange={(event) => setAddUserId(event.target.value)}
                            disabled={!canAddAny || candidates.length === 0}
                            className="input-field w-full"
                        >
                            <option value="">{candidates.length ? 'Select user' : 'No available users found'}</option>
                            {candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                    {displayUserName(candidate)} - {displayUserDetail(candidate)}
                                </option>
                            ))}
                        </select>
                        <select
                            value={addRole}
                            onChange={(event) => setAddRole(event.target.value)}
                            disabled={!canAddAny || roleOptions.length <= 1}
                            className="input-field w-full"
                        >
                            {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={!canAddAny || !addUserId || saving}
                            className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            Add access
                        </button>
                    </div>
                </form>
            </div>
            </div>
        </>
    );
}
