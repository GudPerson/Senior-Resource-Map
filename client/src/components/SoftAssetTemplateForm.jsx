import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { Clock, Globe, Loader2, Users } from 'lucide-react';

import { api } from '../lib/api.js';
import { normalizeEligibilityRules } from '../lib/eligibility.js';
import { normalizeRole } from '../lib/roles.js';
import { SOFT_ASSET_BUCKETS } from '../lib/softAssetBuckets.js';
import EligibilityRulesEditor from './EligibilityRulesEditor.jsx';
import ImageUpload from './ImageUpload.jsx';
import MarkdownDescriptionField from './MarkdownDescriptionField.jsx';
import TranslationReviewPanel from './TranslationReviewPanel.jsx';

function buildInitialForm(initialData, currentUser) {
    if (initialData) {
        return {
            externalKey: initialData.externalKey || '',
            name: initialData.name || '',
            bucket: initialData.bucket || 'Programmes',
            subCategory: initialData.subCategory || 'Programmes',
            description: initialData.description || '',
            schedule: initialData.schedule || '',
            logoUrl: initialData.logoUrl || '',
            bannerUrl: initialData.bannerUrl || '',
            newTags: initialData.tags || [],
            ownershipMode: initialData.ownershipMode || (initialData.partnerId ? 'partner' : 'system'),
            partnerId: initialData.partnerId || '',
            audienceMode: initialData.audienceMode || 'public',
            audienceZoneIds: initialData.audienceZoneIds || initialData.audienceZones?.map((zone) => zone.id) || [],
            isMemberOnly: Boolean(initialData.isMemberOnly),
            eligibilityRules: normalizeEligibilityRules(initialData.eligibilityRules),
        };
    }

    return {
        externalKey: '',
        name: '',
        bucket: 'Programmes',
        subCategory: 'Programmes',
        description: '',
        schedule: '',
        logoUrl: '',
        bannerUrl: '',
        newTags: [],
        ownershipMode: normalizeRole(currentUser?.role) === 'partner' ? 'partner' : 'system',
        partnerId: normalizeRole(currentUser?.role) === 'partner' ? (currentUser?.id || '') : '',
        audienceMode: 'public',
        audienceZoneIds: [],
        isMemberOnly: false,
        eligibilityRules: null,
    };
}

const OWNERSHIP_OPTIONS = [
    { value: 'system', label: 'System-owned' },
    { value: 'partner', label: 'Partner-owned' },
];

export default function SoftAssetTemplateForm({
    initialData,
    currentUser,
    partnerOptions = [],
    audienceZones = [],
    onSave,
    onCancel,
}) {
    const currentRole = normalizeRole(currentUser?.role);
    const [form, setForm] = useState(() => buildInitialForm(initialData, currentUser));
    const [availableTags, setAvailableTags] = useState([]);
    const [availableSubCategories, setAvailableSubCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // Only reset when opening a different template record; browser refocus after uploads
    // can refresh auth state and replace currentUser with a new object identity.
    const templateResetKey = initialData?.id ?? '__create__';

    useEffect(() => {
        setForm(buildInitialForm(initialData, currentUser));
    }, [templateResetKey]);

    useEffect(() => {
        api.searchTags('')
            .then((tags) => setAvailableTags(tags.map((tag) => ({ value: tag, label: tag }))))
            .catch(console.error);
        api.getSubCategories()
            .then(setAvailableSubCategories)
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (currentRole === 'partner' && form.ownershipMode !== 'partner') {
            setForm((prev) => ({ ...prev, ownershipMode: 'partner', partnerId: currentUser?.id || '' }));
        }
    }, [currentRole, currentUser?.id, form.ownershipMode]);

    useEffect(() => {
        if (form.ownershipMode !== 'partner' && form.audienceMode === 'partner_boundary') {
            setForm((prev) => ({ ...prev, audienceMode: 'public' }));
        }
    }, [form.audienceMode, form.ownershipMode]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const tagOptions = availableTags;
    const currentTags = form.newTags.map((tag) => ({ value: tag, label: tag }));

    const partnerSelectOptions = useMemo(() => partnerOptions.map((partner) => ({
        value: partner.id,
        label: `${partner.name} (@${partner.username})`,
    })), [partnerOptions]);
    const audienceZoneOptions = useMemo(() => audienceZones.map((zone) => ({
        value: zone.id,
        label: zone.zoneCode ? `${zone.name} (${zone.zoneCode})` : zone.name,
    })), [audienceZones]);

    const selectedPartnerOption = partnerSelectOptions.find((option) => Number(option.value) === Number(form.partnerId)) || null;
    const selectedAudienceZoneOptions = audienceZoneOptions.filter((option) => (form.audienceZoneIds || []).includes(option.value));

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const payload = {
                externalKey: String(form.externalKey || '').trim() || undefined,
                name: form.name,
                bucket: form.bucket || 'Programmes',
                subCategory: form.subCategory || 'Programmes',
                description: form.description || null,
                schedule: form.schedule || null,
                logoUrl: form.logoUrl || null,
                bannerUrl: form.bannerUrl || null,
                newTags: form.newTags || [],
                ownershipMode: form.ownershipMode,
                partnerId: form.ownershipMode === 'partner' ? form.partnerId || null : null,
                audienceMode: form.ownershipMode !== 'partner' && form.audienceMode === 'partner_boundary'
                    ? 'public'
                    : (form.audienceMode || 'public'),
                audienceZoneIds: form.audienceMode === 'audience_zones' ? (form.audienceZoneIds || []) : [],
                isMemberOnly: Boolean(form.isMemberOnly),
                eligibilityRules: normalizeEligibilityRules(form.eligibilityRules),
            };

            if (!payload.name?.trim()) {
                throw new Error('Template name is required.');
            }

            if (currentRole === 'partner') {
                payload.ownershipMode = 'partner';
                payload.partnerId = currentUser?.id;
            }

            if ((currentRole === 'super_admin' || currentRole === 'regional_admin') && payload.ownershipMode === 'partner' && !payload.partnerId) {
                throw new Error('Select a partner owner for partner-owned templates.');
            }
            if (payload.audienceMode === 'audience_zones' && payload.audienceZoneIds.length === 0) {
                throw new Error('Select at least one audience zone for audience-zone templates.');
            }

            if (initialData?.id) {
                await api.updateSoftAssetParent(initialData.id, payload);
            } else {
                await api.createSoftAssetParent(payload);
            }

            await onSave?.();
        } catch (err) {
            setError(err.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 grid grid-cols-2 gap-4">
                    <ImageUpload
                        label="Logo / Icon"
                        value={form.logoUrl}
                        onChange={(url) => setField('logoUrl', url)}
                        hint="Best: 512 x 512px square PNG with a transparent background. Keep the artwork centered and within the middle 80%."
                    />
                    <ImageUpload
                        label="Hero Banner"
                        value={form.bannerUrl}
                        onChange={(url) => setField('bannerUrl', url)}
                        hint="Best: 1600 x 900px landscape image or wider. Keep key content near the center because banners crop responsively."
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                        External Key {initialData?.id ? '' : '(optional)'}
                    </label>
                    <input
                        value={form.externalKey || ''}
                        onChange={(e) => setField('externalKey', e.target.value)}
                        readOnly={Boolean(initialData?.id)}
                        placeholder={initialData?.id ? '' : 'Leave blank to auto-generate'}
                        className={`input-field ${initialData?.id ? 'bg-slate-50 text-slate-500' : ''}`}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                        Stable workbook identifier used to manage template imports and place-version exports.
                    </p>
                </div>

                <div className="col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Template Name *</label>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder="Shared programme or promotion name"
                        className="input-field"
                    />
                </div>

                <div>
                    <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-700"><Users size={13} /> Ownership</label>
                    <select
                        value={form.ownershipMode}
                        disabled={currentRole === 'partner'}
                        onChange={(e) => setField('ownershipMode', e.target.value)}
                        className="input-field"
                    >
                        {OWNERSHIP_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Partner Owner</label>
                    {form.ownershipMode === 'partner' ? (
                        currentRole === 'partner' ? (
                            <input value={currentUser?.name || ''} readOnly className="input-field bg-slate-50" />
                        ) : (
                            <Select
                                options={partnerSelectOptions}
                                value={selectedPartnerOption}
                                onChange={(selected) => setField('partnerId', selected?.value || '')}
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder="Select partner owner..."
                            />
                        )
                    ) : (
                        <input value="System-owned" readOnly className="input-field bg-slate-50" />
                    )}
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Bucket *</label>
                    <select value={form.bucket || 'Programmes'} onChange={(e) => setField('bucket', e.target.value)} className="input-field">
                        {SOFT_ASSET_BUCKETS.map((bucket) => (
                            <option key={bucket} value={bucket}>{bucket}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Sub-Category *</label>
                    <select value={form.subCategory || 'Programmes'} onChange={(e) => setField('subCategory', e.target.value)} className="input-field">
                        {availableSubCategories
                            .filter((subcategory) => subcategory.type === 'soft')
                            .map((subcategory) => (
                                <option key={subcategory.id} value={subcategory.name}>{subcategory.name}</option>
                            ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-700"><Clock size={13} /> Default Schedule</label>
                    <input
                        value={form.schedule || ''}
                        onChange={(e) => setField('schedule', e.target.value)}
                        placeholder="e.g. Every Tuesday at 10 AM"
                        className="input-field"
                    />
                </div>

                <div className="col-span-2">
                    <MarkdownDescriptionField
                        id="template-description"
                        value={form.description || ''}
                        onChange={(value) => setField('description', value)}
                        placeholder="Main description shared by all place versions."
                        rows={4}
                    />
                </div>

                {initialData?.id ? (
                    <div className="col-span-2">
                        <TranslationReviewPanel
                            resourceType="template"
                            resourceId={initialData.id}
                        />
                    </div>
                ) : (
                    <div className="col-span-2 rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-slate-600">
                        Save this template first, then edit it again to review Mandarin, Malay, and Tamil translations.
                    </div>
                )}

                <div className="col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Tags</label>
                    <CreatableSelect
                        isMulti
                        options={tagOptions}
                        value={currentTags}
                        onChange={(selected) => setField('newTags', selected.map((item) => item.value))}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Search or create tags..."
                    />
                </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                    <Globe size={16} className="text-brand-600" />
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Who can see this?</h3>
                        <p className="text-xs text-slate-500">These settings are copied to generated place versions unless you change the template later.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Audience</label>
                        <select value={form.audienceMode || 'public'} onChange={(e) => setField('audienceMode', e.target.value)} className="input-field">
                            <option value="public">Public</option>
                            <option value="audience_zones">Target areas</option>
                            {form.ownershipMode === 'partner' ? <option value="partner_boundary">Partner area</option> : null}
                        </select>
                        <p className="mt-1 text-xs text-slate-500">Target-area templates can show in selected postal-code areas. Partner-area templates can only generate partner-owned place versions.</p>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">For linked members</p>
                            <p className="text-xs text-slate-500">Require sign-in and a linked membership for all generated place versions.</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input type="checkbox" checked={Boolean(form.isMemberOnly)} onChange={(e) => setField('isMemberOnly', e.target.checked)} className="peer sr-only" />
                            <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-brand-600 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                        </label>
                    </div>
                </div>
                {form.audienceMode === 'audience_zones' ? (
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Target areas</label>
                        <Select
                            isMulti
                            options={audienceZoneOptions}
                            value={selectedAudienceZoneOptions}
                            onChange={(selected) => setField('audienceZoneIds', Array.isArray(selected) ? selected.map((item) => item.value) : [])}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Select one or more target areas..."
                        />
                        <p className="mt-1 text-xs text-slate-500">Generated place versions will use these target areas from the template.</p>
                    </div>
                ) : null}

                <EligibilityRulesEditor
                    value={form.eligibilityRules}
                    onChange={(rules) => setField('eligibilityRules', rules)}
                    description="These demographic rules are copied into generated place versions."
                />

                <div className="rounded-xl border border-dashed border-brand-200 bg-white px-4 py-3 text-xs text-slate-600">
                    Save the template first, then generate hidden place-specific offerings from the template panel.
                </div>
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onCancel} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : initialData?.id ? 'Save Template' : 'Create Template'}
                </button>
            </div>
        </form>
    );
}
