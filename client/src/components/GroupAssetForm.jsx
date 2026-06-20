import { useEffect, useMemo, useState } from 'react';
import { Layers3, Plus, Search, X } from 'lucide-react';

import ImageUpload from './ImageUpload.jsx';
import { api } from '../lib/api.js';
import { formatGroupMemberCountLine, formatGroupSaveErrorMessage, isGroupAsset } from '../lib/groupAssets.js';

function splitTags(value) {
    return String(value || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeMemberKey(type, id) {
    return `${type}:${Number(id)}`;
}

function memberMatchesQuery(member, query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [
        member.name,
        member.subCategory,
        member.address,
        member.postalCode,
        ...(Array.isArray(member.tags) ? member.tags : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
}

function buildMemberOptions(hardAssets = [], softAssets = []) {
    const hardOptions = hardAssets
        .filter((asset) => asset?.id && !asset.isHidden && !asset.isDeleted)
        .map((asset) => ({
            key: normalizeMemberKey('hard', asset.id),
            type: 'hard',
            id: asset.id,
            name: asset.name,
            subCategory: asset.subCategory || 'Place',
            address: asset.address || '',
            postalCode: asset.postalCode || '',
            tags: asset.tags || [],
            label: 'Place',
        }));

    const softOptions = softAssets
        .filter((asset) => asset?.id && !asset.isHidden && !asset.isDeleted && !isGroupAsset(asset))
        .filter((asset) => !asset.isMemberOnly && (asset.audienceMode || 'public') === 'public')
        .map((asset) => ({
            key: normalizeMemberKey('soft', asset.id),
            type: 'soft',
            id: asset.id,
            name: asset.name,
            subCategory: asset.subCategory || asset.bucket || 'Offering',
            address: asset.location?.address || '',
            postalCode: asset.location?.postalCode || '',
            tags: asset.tags || [],
            label: asset.bucket || 'Offering',
        }));

    return [...hardOptions, ...softOptions].sort((left, right) => left.name.localeCompare(right.name));
}

function getReadinessLabel({ form, selectedMembers, memberRows }) {
    if (form.isHidden) return 'Hidden';
    if ((memberRows || []).some((member) => member.isPublicEligible === false)) return 'Review members';
    if (selectedMembers.length === 0) return 'Needs members';
    return 'Ready for Discover';
}

export default function GroupAssetForm({
    hardAssets = [],
    initialData = null,
    memberCandidatesError = '',
    memberCandidatesLoading = false,
    onCancel,
    onSave,
    partnerOptions = [],
    softAssets = [],
    subregions = [],
}) {
    const [form, setForm] = useState(() => ({
        name: initialData?.name || '',
        description: initialData?.description || '',
        logoUrl: initialData?.logoUrl || '',
        bannerUrl: initialData?.bannerUrl || '',
        tags: (initialData?.tags || []).join(', '),
        isHidden: Boolean(initialData?.isHidden),
        subregionId: initialData?.subregionId || '',
        ownershipMode: initialData?.partnerId ? 'partner' : 'system',
        partnerId: initialData?.partnerId || '',
    }));
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [memberRows, setMemberRows] = useState([]);
    const [memberQuery, setMemberQuery] = useState('');
    const [loadingMembers, setLoadingMembers] = useState(Boolean(initialData?.id));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const memberOptions = useMemo(() => buildMemberOptions(hardAssets, softAssets), [hardAssets, softAssets]);
    const selectedKeys = useMemo(() => new Set(selectedMembers.map((member) => normalizeMemberKey(member.memberResourceType, member.memberResourceId))), [selectedMembers]);
    const visibleMemberOptions = useMemo(
        () => memberOptions.filter((member) => !selectedKeys.has(member.key) && memberMatchesQuery(member, memberQuery)).slice(0, 60),
        [memberOptions, memberQuery, selectedKeys],
    );
    const selectedPreviewAsset = useMemo(() => ({
        assetMode: 'group',
        groupMemberSummary: {
            counts: selectedMembers.reduce((counts, member) => {
                const option = memberOptions.find((candidate) => candidate.type === member.memberResourceType && Number(candidate.id) === Number(member.memberResourceId));
                if (member.memberResourceType === 'hard') counts.places += 1;
                else if (/service/i.test(option?.label || option?.subCategory || '')) counts.services += 1;
                else if (/promotion/i.test(option?.label || option?.subCategory || '')) counts.promotions += 1;
                else counts.programmes += 1;
                counts.total += 1;
                return counts;
            }, { places: 0, programmes: 0, services: 0, promotions: 0, total: 0 }),
        },
    }), [memberOptions, selectedMembers]);
    const readinessLabel = getReadinessLabel({ form, selectedMembers, memberRows });

    useEffect(() => {
        let active = true;
        async function loadMembers() {
            if (!initialData?.id) {
                setLoadingMembers(false);
                return;
            }
            try {
                const response = await api.getSoftAssetGroupMembers(initialData.id);
                if (!active) return;
                const rows = Array.isArray(response?.members) ? response.members : [];
                setMemberRows(rows);
                setSelectedMembers(rows
                    .filter((member) => member.memberResourceType && member.memberResourceId)
                    .map((member, index) => ({
                        memberResourceType: member.memberResourceType,
                        memberResourceId: member.memberResourceId,
                        sortOrder: member.sortOrder ?? index,
                    })));
            } catch (err) {
                if (active) setError(err.message || 'Failed to load Group members.');
            } finally {
                if (active) setLoadingMembers(false);
            }
        }
        loadMembers();
        return () => {
            active = false;
        };
    }, [initialData?.id]);

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    function addMember(member) {
        setSelectedMembers((current) => [
            ...current,
            {
                memberResourceType: member.type,
                memberResourceId: member.id,
                sortOrder: current.length,
            },
        ]);
    }

    function removeMember(index) {
        setSelectedMembers((current) => current
            .filter((_, itemIndex) => itemIndex !== index)
            .map((member, sortOrder) => ({ ...member, sortOrder })));
    }

    function getSelectedOption(member) {
        return memberOptions.find((option) => (
            option.type === member.memberResourceType && Number(option.id) === Number(member.memberResourceId)
        )) || memberRows.find((row) => (
            row.memberResourceType === member.memberResourceType && Number(row.memberResourceId) === Number(member.memberResourceId)
        ))?.resource || null;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (submitting) return;
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                assetMode: 'group',
                name: form.name,
                description: form.description,
                logoUrl: form.logoUrl,
                bannerUrl: form.bannerUrl,
                newTags: splitTags(form.tags),
                isHidden: form.isHidden,
                subregionId: form.subregionId || undefined,
                ownershipMode: form.ownershipMode,
                partnerId: form.ownershipMode === 'partner' ? form.partnerId || undefined : undefined,
            };
            const saved = initialData?.id
                ? await api.updateSoftAsset(initialData.id, payload)
                : await api.createSoftAsset(payload);
            const groupId = initialData?.id || saved.id;
            await api.replaceSoftAssetGroupMembers(groupId, {
                members: selectedMembers.map((member, index) => ({ ...member, sortOrder: index })),
            });
            await onSave?.(saved);
        } catch (err) {
            setError(formatGroupSaveErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-slate-700">Group name</span>
                    <input className="input-field" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-slate-700">Description</span>
                    <textarea className="input-field min-h-[110px]" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                </label>
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                    <ImageUpload
                        label="Logo / Icon"
                        value={form.logoUrl}
                        onChange={(url) => updateField('logoUrl', url)}
                    />
                    <ImageUpload
                        label="Hero Banner"
                        value={form.bannerUrl}
                        onChange={(url) => updateField('bannerUrl', url)}
                    />
                </div>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-slate-700">Tags</span>
                    <input className="input-field" value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="Caregiver, West, Active ageing" />
                </label>
                {subregions.length > 0 ? (
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">Admin area</span>
                        <select className="input-field" value={form.subregionId} onChange={(event) => updateField('subregionId', event.target.value)}>
                            <option value="">No admin area</option>
                            {subregions.map((subregion) => (
                                <option key={subregion.id} value={subregion.id}>{subregion.name}</option>
                            ))}
                        </select>
                    </label>
                ) : null}
                {partnerOptions.length > 0 ? (
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-700">Owner</span>
                        <select
                            className="input-field"
                            value={form.ownershipMode === 'partner' ? form.partnerId : ''}
                            onChange={(event) => {
                                updateField('ownershipMode', event.target.value ? 'partner' : 'system');
                                updateField('partnerId', event.target.value);
                            }}
                        >
                            <option value="">System owned</option>
                            {partnerOptions.map((partner) => (
                                <option key={partner.id} value={partner.id}>{partner.name || partner.username}</option>
                            ))}
                        </select>
                    </label>
                ) : null}
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={form.isHidden} onChange={(event) => updateField('isHidden', event.target.checked)} className="h-4 w-4 accent-brand-600" />
                Hide from public Discover
            </label>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-brand-700">
                            <Layers3 size={14} />
                            {readinessLabel}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-600">{formatGroupMemberCountLine(selectedPreviewAsset)}</p>
                    </div>
                    {loadingMembers ? <span className="text-sm font-semibold text-slate-500">Loading members...</span> : null}
                    {memberCandidatesLoading ? <span className="text-sm font-semibold text-slate-500">Loading available members...</span> : null}
                </div>

                <div className="mt-4 grid gap-3">
                    {selectedMembers.map((member, index) => {
                        const option = getSelectedOption(member);
                        return (
                            <div key={`${member.memberResourceType}-${member.memberResourceId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-slate-900">{option?.name || 'Selected resource'}</p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{member.memberResourceType === 'hard' ? 'Place' : option?.label || option?.subCategory || 'Offering'}</p>
                                </div>
                                <button type="button" onClick={() => removeMember(index)} className="btn-ghost h-9 px-3 text-xs">
                                    <X size={14} /> Remove
                                </button>
                            </div>
                        );
                    })}
                    {selectedMembers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                            No members selected.
                        </div>
                    ) : null}
                </div>

                <div className="mt-5">
                    <label className="relative block">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            className="input-field pl-9"
                            value={memberQuery}
                            onChange={(event) => setMemberQuery(event.target.value)}
                            placeholder="Search places and offerings"
                        />
                    </label>
                    <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
                        {memberCandidatesError ? (
                            <div className="px-4 py-6 text-center text-sm font-semibold text-red-600">
                                {memberCandidatesError}
                            </div>
                        ) : memberCandidatesLoading ? (
                            <div className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                                Loading available members...
                            </div>
                        ) : visibleMemberOptions.length > 0 ? visibleMemberOptions.map((member) => (
                            <button
                                key={member.key}
                                type="button"
                                onClick={() => addMember(member)}
                                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-brand-50/50"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-black text-slate-900">{member.name}</span>
                                    <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{member.label} - {member.subCategory}</span>
                                </span>
                                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-brand-100 bg-white text-brand-700">
                                    <Plus size={15} />
                                </span>
                            </button>
                        )) : (
                            <div className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                                No available public members found.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                {error ? (
                    <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                ) : null}
                <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Group'}
                </button>
            </div>
        </form>
    );
}
