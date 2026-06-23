import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Image, Layers3, Mail, Phone, Plus, Search, ShieldCheck, X } from 'lucide-react';

import AssetAccessPanel from './AssetAccessPanel.jsx';
import ImageUpload from './ImageUpload.jsx';
import { api } from '../lib/api.js';
import { formatGroupMemberCountLine, formatGroupSaveErrorMessage, isGroupAsset } from '../lib/groupAssets.js';
import { normalizeRole } from '../lib/roles.js';

const STEPS = ['Profile', 'Access', 'Members', 'Review'];

function splitTags(value) {
    return String(value || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeMemberKey(type, id) {
    return `${type}:${Number(id)}`;
}

function normalizeUserOption(user) {
    if (!user?.id) return null;
    return {
        id: Number(user.id),
        name: user.name || user.username || user.email || `User #${user.id}`,
        username: user.username || '',
        email: user.email || '',
        role: user.role || '',
    };
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

function buildDefaultAccess(currentUser, accessUserOptions) {
    const normalizedCurrentUser = normalizeUserOption(currentUser);
    if (normalizedCurrentUser) {
        return [{ userId: normalizedCurrentUser.id, staffRole: 'owner' }];
    }
    const firstUser = accessUserOptions.map(normalizeUserOption).find(Boolean);
    return firstUser ? [{ userId: firstUser.id, staffRole: 'owner' }] : [];
}

function getReadinessLabel({ form, ownerCount, selectedMembers, memberRows }) {
    if (form.isHidden) return 'Hidden';
    if (ownerCount === 0) return 'Needs owner';
    if ((memberRows || []).some((member) => member.isPublicEligible === false)) return 'Review members';
    if (selectedMembers.length === 0) return 'Needs members';
    return 'Ready for Discover';
}

export default function GroupAssetForm({
    accessUserOptions = [],
    currentUser = null,
    hardAssets = [],
    initialData = null,
    memberCandidatesError = '',
    memberCandidatesLoading = false,
    onCancel,
    onSave,
    softAssets = [],
}) {
    const normalizedAccessUsers = useMemo(() => {
        const byId = new Map();
        [...accessUserOptions, currentUser]
            .map(normalizeUserOption)
            .filter(Boolean)
            .forEach((user) => {
                if (normalizeRole(user.role) !== 'guest' || Number(user.id) === Number(currentUser?.id)) byId.set(user.id, user);
            });
        return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
    }, [accessUserOptions, currentUser]);

    const [activeStep, setActiveStep] = useState(0);
    const [form, setForm] = useState(() => ({
        name: initialData?.name || '',
        description: initialData?.description || '',
        schedule: initialData?.schedule || '',
        logoUrl: initialData?.logoUrl || '',
        bannerUrl: initialData?.bannerUrl || '',
        galleryImageUrl: Array.isArray(initialData?.galleryUrls) ? (initialData.galleryUrls[0] || '') : '',
        tags: (initialData?.tags || []).join(', '),
        contactPhone: initialData?.contactPhone || '',
        whatsappContact: initialData?.whatsappContact || '',
        contactEmail: initialData?.contactEmail || '',
        ctaLabel: initialData?.ctaLabel || '',
        ctaUrl: initialData?.ctaUrl || '',
        venueNote: initialData?.venueNote || '',
        lastReviewedAt: initialData?.lastReviewedAt ? String(initialData.lastReviewedAt).slice(0, 10) : '',
        sourceType: initialData?.sourceType || '',
        verificationStatus: initialData?.verificationStatus || 'unverified',
        verificationConfidence: initialData?.verificationConfidence ?? '',
        isHidden: Boolean(initialData?.isHidden),
    }));
    const [initialAccess, setInitialAccess] = useState(() => initialData?.id ? [] : buildDefaultAccess(currentUser, accessUserOptions));
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
    const ownerCount = initialData?.id
        ? Number(initialData?.groupOwnerCount || 0)
        : initialAccess.filter((row) => row.staffRole === 'owner').length;
    const readinessLabel = getReadinessLabel({ form, ownerCount, selectedMembers, memberRows });
    const canMoveNext = activeStep < STEPS.length - 1;
    const canMovePrevious = activeStep > 0;

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

    useEffect(() => {
        if (initialData?.id || initialAccess.length > 0 || normalizedAccessUsers.length === 0) return;
        const preferredUser = normalizeUserOption(currentUser) || normalizedAccessUsers[0];
        if (preferredUser?.id) {
            setInitialAccess([{ userId: Number(preferredUser.id), staffRole: 'owner' }]);
        }
    }, [currentUser, initialAccess.length, initialData?.id, normalizedAccessUsers]);

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

    function updateAccessRow(index, field, value) {
        setInitialAccess((current) => current.map((row, rowIndex) => (
            rowIndex === index ? { ...row, [field]: field === 'userId' ? Number(value) : value } : row
        )));
    }

    function addAccessRow() {
        const usedIds = new Set(initialAccess.map((row) => Number(row.userId)));
        const candidate = normalizedAccessUsers.find((user) => !usedIds.has(Number(user.id)));
        if (!candidate) return;
        setInitialAccess((current) => [...current, { userId: candidate.id, staffRole: 'staff' }]);
    }

    function removeAccessRow(index) {
        setInitialAccess((current) => current.filter((_, rowIndex) => rowIndex !== index));
    }

    function validateStep(stepIndex = activeStep) {
        if (stepIndex === 0 && !form.name.trim()) {
            setError('Group name is required.');
            return false;
        }
        if (stepIndex === 1 && !initialData?.id && ownerCount === 0) {
            setError('Select at least one Group Owner.');
            return false;
        }
        setError('');
        return true;
    }

    function goNext() {
        if (!validateStep()) return;
        setActiveStep((current) => Math.min(current + 1, STEPS.length - 1));
    }

    function goPrevious() {
        setError('');
        setActiveStep((current) => Math.max(current - 1, 0));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (submitting) return;
        if (!validateStep(0) || (!initialData?.id && !validateStep(1))) return;
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                assetMode: 'group',
                name: form.name.trim(),
                description: form.description,
                schedule: form.schedule,
                logoUrl: form.logoUrl,
                bannerUrl: form.bannerUrl,
                galleryUrls: form.galleryImageUrl ? [form.galleryImageUrl] : [],
                newTags: splitTags(form.tags),
                isHidden: form.isHidden,
                contactPhone: form.contactPhone,
                whatsappContact: form.whatsappContact,
                contactEmail: form.contactEmail,
                ctaLabel: form.ctaLabel,
                ctaUrl: form.ctaUrl,
                venueNote: form.venueNote,
                lastReviewedAt: form.lastReviewedAt || null,
                sourceType: form.sourceType,
                verificationStatus: form.verificationStatus,
                verificationConfidence: form.verificationConfidence === '' ? null : form.verificationConfidence,
                ...(initialData?.id ? {} : {
                    initialAccess,
                    members: selectedMembers.map((member, index) => ({ ...member, sortOrder: index })),
                }),
            };
            const saved = initialData?.id
                ? await api.updateSoftAsset(initialData.id, payload)
                : await api.createSoftAsset(payload);
            if (initialData?.id) {
                await api.replaceSoftAssetGroupMembers(initialData.id, {
                    members: selectedMembers.map((member, index) => ({ ...member, sortOrder: index })),
                });
            }
            await onSave?.(saved);
        } catch (err) {
            setError(formatGroupSaveErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    function renderSelectedMembers() {
        return (
            <div className="grid gap-3">
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
        );
    }

    function renderProfileStep() {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-slate-700">Group name</span>
                    <input className="input-field" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-slate-700">Description</span>
                    <textarea className="input-field min-h-[110px]" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                </label>
                <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
                    <ImageUpload label="Logo / Icon" value={form.logoUrl} onChange={(url) => updateField('logoUrl', url)} />
                    <ImageUpload label="Hero Banner" value={form.bannerUrl} onChange={(url) => updateField('bannerUrl', url)} />
                    <ImageUpload label="Gallery Image" value={form.galleryImageUrl} onChange={(url) => updateField('galleryImageUrl', url)} />
                </div>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-slate-700">Tags</span>
                    <input className="input-field" value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="Caregiver, West, Active ageing" />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700"><CalendarDays size={15} /> Schedule / notes</span>
                    <textarea className="input-field min-h-[88px]" value={form.schedule} onChange={(event) => updateField('schedule', event.target.value)} />
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 md:col-span-2">
                    <input type="checkbox" checked={form.isHidden} onChange={(event) => updateField('isHidden', event.target.checked)} className="h-4 w-4 accent-brand-600" />
                    Hide from public Discover
                </label>
            </div>
        );
    }

    function renderAccessStep() {
        if (initialData?.id) {
            return (
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <AssetAccessPanel asset={initialData} assetType="group" />
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-brand-700">
                            <ShieldCheck size={14} />
                            {ownerCount > 0 ? 'Owner ready' : 'Needs owner'}
                        </div>
                        <button type="button" className="btn-secondary h-10 px-3 text-sm" onClick={addAccessRow} disabled={initialAccess.length >= normalizedAccessUsers.length}>
                            <Plus size={15} /> Add access
                        </button>
                    </div>
                    <div className="grid gap-3">
                        {initialAccess.map((row, index) => (
                            <div key={`${row.userId}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_150px_auto]">
                                <label className="block">
                                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Group Owner / Staff</span>
                                    <select className="input-field" value={row.userId} onChange={(event) => updateAccessRow(index, 'userId', event.target.value)}>
                                        {normalizedAccessUsers.map((user) => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Role</span>
                                    <select className="input-field" value={row.staffRole} onChange={(event) => updateAccessRow(index, 'staffRole', event.target.value)}>
                                        <option value="owner">Owner</option>
                                        <option value="staff">Staff</option>
                                    </select>
                                </label>
                                <button type="button" onClick={() => removeAccessRow(index)} className="btn-ghost self-end px-3 text-sm">
                                    <X size={15} /> Remove
                                </button>
                            </div>
                        ))}
                        {initialAccess.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                                No Group Owner selected.
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    function renderMembersStep() {
        return (
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

                {renderSelectedMembers()}

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
        );
    }

    function renderReviewStep() {
        return (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-brand-700">
                        <CheckCircle2 size={14} />
                        {readinessLabel}
                    </div>
                    <h3 className="text-lg font-black text-slate-900">{form.name || 'Untitled Group'}</h3>
                    {form.description ? <p className="mt-2 text-sm text-slate-600">{form.description}</p> : null}
                    <p className="mt-3 text-sm font-semibold text-slate-600">{formatGroupMemberCountLine(selectedPreviewAsset)}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        {form.contactPhone ? <span className="inline-flex items-center gap-2"><Phone size={14} /> {form.contactPhone}</span> : null}
                        {form.contactEmail ? <span className="inline-flex items-center gap-2"><Mail size={14} /> {form.contactEmail}</span> : null}
                        {form.galleryImageUrl ? <span className="inline-flex items-center gap-2"><Image size={14} /> Gallery image added</span> : null}
                    </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4">
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-700">Contact phone</span>
                            <input className="input-field" value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-700">WhatsApp</span>
                            <input className="input-field" value={form.whatsappContact} onChange={(event) => updateField('whatsappContact', event.target.value)} />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-700">Email</span>
                            <input className="input-field" type="email" value={form.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="block">
                                <span className="mb-1 block text-sm font-bold text-slate-700">CTA label</span>
                                <input className="input-field" value={form.ctaLabel} onChange={(event) => updateField('ctaLabel', event.target.value)} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-bold text-slate-700">CTA URL</span>
                                <input className="input-field" value={form.ctaUrl} onChange={(event) => updateField('ctaUrl', event.target.value)} />
                            </label>
                        </div>
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-700">Freshness date</span>
                            <input className="input-field" type="date" value={form.lastReviewedAt} onChange={(event) => updateField('lastReviewedAt', event.target.value)} />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-700">Review notes</span>
                            <textarea className="input-field min-h-[88px]" value={form.venueNote} onChange={(event) => updateField('venueNote', event.target.value)} />
                        </label>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {STEPS.map((step, index) => (
                    <button
                        key={step}
                        type="button"
                        onClick={() => {
                            if (index <= activeStep || validateStep()) setActiveStep(index);
                        }}
                        className={`flex min-h-[48px] items-center justify-center gap-2 border-r border-slate-200 px-2 text-sm font-black last:border-r-0 ${index === activeStep ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-white'}`}
                    >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]">{index + 1}</span>
                        <span className="truncate">{step}</span>
                    </button>
                ))}
            </div>

            {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                </div>
            ) : null}

            {activeStep === 0 ? renderProfileStep() : null}
            {activeStep === 1 ? renderAccessStep() : null}
            {activeStep === 2 ? renderMembersStep() : null}
            {activeStep === 3 ? renderReviewStep() : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
                <div className="flex flex-wrap justify-end gap-3">
                    {canMovePrevious ? (
                        <button type="button" className="btn-secondary" onClick={goPrevious} disabled={submitting}>
                            <ChevronLeft size={16} /> Back
                        </button>
                    ) : null}
                    {canMoveNext ? (
                        <button type="button" className="btn-primary" onClick={goNext} disabled={submitting}>
                            Next <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Group'}
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
}
