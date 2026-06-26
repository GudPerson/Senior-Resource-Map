import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { Clock, Globe, Users } from 'lucide-react';

import { api } from '../lib/api.js';
import { normalizeEligibilityRules } from '../lib/eligibility.js';
import { normalizeRole } from '../lib/roles.js';
import { SOFT_ASSET_BUCKETS } from '../lib/softAssetBuckets.js';
import EligibilityRulesEditor from './EligibilityRulesEditor.jsx';
import ImageUpload from './ImageUpload.jsx';
import MarkdownLiteText from './MarkdownLiteText.jsx';
import MarkdownDescriptionField from './MarkdownDescriptionField.jsx';
import ResourceWizardShell from './ResourceWizardShell.jsx';
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
            ownershipMode: 'system',
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
        ownershipMode: 'system',
        partnerId: '',
        audienceMode: 'public',
        audienceZoneIds: [],
        isMemberOnly: false,
        eligibilityRules: null,
    };
}

const OWNERSHIP_OPTIONS = [
    { value: 'system', label: 'System-owned' },
];

const TEMPLATE_STEPS = ['Profile', 'Defaults', 'Visibility', 'Generate', 'Translate'];

function isBlankEligibilityAge(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function isWholeEligibilityAge(value) {
    return /^\d+$/.test(String(value).trim());
}

function getEligibilityAgeValidationError(rules) {
    const age = rules?.criteria?.age;
    if (!age || typeof age !== 'object') return '';
    const hasMin = !isBlankEligibilityAge(age.min);
    const hasMax = !isBlankEligibilityAge(age.max);
    if ((hasMin && !isWholeEligibilityAge(age.min)) || (hasMax && !isWholeEligibilityAge(age.max))) {
        return 'Eligibility age must use whole numbers greater than or equal to 0.';
    }
    if (hasMin && hasMax && Number(age.min) > Number(age.max)) {
        return 'Eligibility minimum age cannot be greater than maximum age.';
    }
    return '';
}

export default function SoftAssetTemplateForm({
    initialData,
    currentUser,
    audienceZones = [],
    onSave,
    onCancel,
}) {
    const currentRole = normalizeRole(currentUser?.role);
    const [form, setForm] = useState(() => buildInitialForm(initialData, currentUser));
    const [availableTags, setAvailableTags] = useState([]);
    const [availableSubCategories, setAvailableSubCategories] = useState([]);
    const [activeTemplateStep, setActiveTemplateStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // Only reset when opening a different template record; browser refocus after uploads
    // can refresh auth state and replace currentUser with a new object identity.
    const templateResetKey = initialData?.id ?? '__create__';

    useEffect(() => {
        setForm(buildInitialForm(initialData, currentUser));
        setActiveTemplateStep(0);
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
        if (form.ownershipMode !== 'partner' && form.audienceMode === 'partner_boundary') {
            setForm((prev) => ({ ...prev, audienceMode: 'public' }));
        }
    }, [form.audienceMode, form.ownershipMode]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const tagOptions = availableTags;
    const currentTags = form.newTags.map((tag) => ({ value: tag, label: tag }));

    const audienceZoneOptions = useMemo(() => audienceZones.map((zone) => ({
        value: zone.id,
        label: zone.zoneCode ? `${zone.name} (${zone.zoneCode})` : zone.name,
    })), [audienceZones]);

    const selectedAudienceZoneOptions = audienceZoneOptions.filter((option) => (form.audienceZoneIds || []).includes(option.value));

    async function handleSubmit(e) {
        e?.preventDefault?.();
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
                ownershipMode: 'system',
                partnerId: null,
                audienceMode: form.ownershipMode !== 'partner' && form.audienceMode === 'partner_boundary'
                    ? 'public'
                    : (form.audienceMode || 'public'),
                audienceZoneIds: form.audienceMode === 'audience_zones' ? (form.audienceZoneIds || []) : [],
                isMemberOnly: Boolean(form.isMemberOnly),
                eligibilityRules: normalizeEligibilityRules(form.eligibilityRules),
            };

            if (!payload.name?.trim()) {
                throw new Error('Add a template name to continue.');
            }

            if ((currentRole === 'super_admin' || currentRole === 'regional_admin') && payload.ownershipMode === 'partner' && !payload.partnerId) {
                throw new Error('Legacy scoped ownership is no longer assignable. Use Asset Access on host places instead.');
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

    function getTemplateStepValidationError(stepIndex = activeTemplateStep) {
        if (stepIndex === 0) {
            if (!String(form.name || '').trim()) return 'Add a template name to continue.';
        }
        if (stepIndex === 2) {
            const audienceZoneIds = Array.isArray(form.audienceZoneIds) ? form.audienceZoneIds : [];
            if (form.audienceMode === 'audience_zones' && audienceZoneIds.length === 0) {
                return 'Select at least one audience zone for audience-zone templates.';
            }
            const eligibilityAgeMessage = getEligibilityAgeValidationError(form.eligibilityRules);
            if (eligibilityAgeMessage) return eligibilityAgeMessage;
        }
        return '';
    }

    function validateTemplateStep(stepIndex = activeTemplateStep) {
        const message = getTemplateStepValidationError(stepIndex);
        setError(message);
        return !message;
    }

    function validateAllTemplateSteps() {
        for (const stepIndex of [0, 2]) {
            const message = getTemplateStepValidationError(stepIndex);
            if (message) {
                setActiveTemplateStep(stepIndex);
                setError(message);
                return false;
            }
        }
        return true;
    }

    async function handleTemplateWizardSave() {
        if (!validateAllTemplateSteps()) return;
        await handleSubmit();
    }

    function renderTemplateProfileStep() {
        return (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
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

                <div className="md:col-span-2">
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
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Bucket *</label>
                    <select required value={form.bucket || 'Programmes'} onChange={(e) => setField('bucket', e.target.value)} className="input-field">
                        {SOFT_ASSET_BUCKETS.map((bucket) => (
                            <option key={bucket} value={bucket}>{bucket}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Sub-Category *</label>
                    <select required value={form.subCategory || 'Programmes'} onChange={(e) => setField('subCategory', e.target.value)} className="input-field">
                        {availableSubCategories
                            .filter((subcategory) => subcategory.type === 'soft')
                            .map((subcategory) => (
                                <option key={subcategory.id} value={subcategory.name}>{subcategory.name}</option>
                            ))}
                    </select>
                </div>

                <div className="md:col-span-2">
                    <MarkdownDescriptionField
                        id="template-description"
                        value={form.description || ''}
                        onChange={(value) => setField('description', value)}
                        placeholder="Main description shared by all place versions."
                        rows={4}
                    />
                </div>

                <div className="md:col-span-2">
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
        );
    }

    function renderTemplateDefaultsStep() {
        return (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                    <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-700"><Users size={13} /> Ownership</label>
                    <select
                        value={form.ownershipMode}
                        onChange={(e) => setField('ownershipMode', e.target.value)}
                        className="input-field"
                    >
                        {OWNERSHIP_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Access source</label>
                    <input value="Inherited from generated place access" readOnly className="input-field bg-slate-50" />
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
            </div>
        );
    }

    function renderTemplateVisibilityStep() {
        return (
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
                        </select>
                        <p className="mt-1 text-xs text-slate-500">Target-area templates can show in selected postal-code areas.</p>
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
            </div>
        );
    }

    function renderTemplateGenerateStep() {
        return (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                    <Globe size={16} className="text-brand-600" />
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Generate place versions</h3>
                        <p className="text-xs text-slate-500">Generated place versions are created from the saved template and use the existing row action.</p>
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Access source</label>
                    <input value="Inherited from generated place access" readOnly className="input-field bg-white" />
                </div>
                <div className="rounded-xl border border-dashed border-brand-200 bg-white px-4 py-3 text-xs text-slate-600">
                    Save the template first, then generate hidden place-specific offerings from the template panel.
                </div>
            </div>
        );
    }

    function renderTemplateTranslationStep() {
        if (initialData?.id) {
            return (
                <div data-resource-wizard-skip-validity>
                    <TranslationReviewPanel
                        resourceType="template"
                        resourceId={initialData.id}
                    />
                </div>
            );
        }

        return (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-slate-600">
                Save this template first, then edit it again to review Mandarin, Malay, and Tamil translations.
            </div>
        );
    }

    function renderTemplateStep(stepIndex) {
        if (stepIndex === 0) return renderTemplateProfileStep();
        if (stepIndex === 1) return renderTemplateDefaultsStep();
        if (stepIndex === 2) return renderTemplateVisibilityStep();
        if (stepIndex === 3) return renderTemplateGenerateStep();
        if (stepIndex === 4) return renderTemplateTranslationStep();
        return null;
    }

    function renderTemplatePreview() {
        const tags = Array.isArray(form.newTags) ? form.newTags.slice(0, 8) : [];
        const visibilityLabel = form.audienceMode === 'audience_zones' ? 'Target areas' : 'Public';
        const targetAreaLabels = form.audienceMode === 'audience_zones'
            ? selectedAudienceZoneOptions.map((option) => option.label).filter(Boolean)
            : [];

        return (
            <div className="space-y-5">
                {(form.bannerUrl || form.logoUrl) ? (
                    <div className="flex h-52 items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <img
                            src={form.bannerUrl || form.logoUrl}
                            alt=""
                            className={form.bannerUrl ? 'h-full w-full object-cover' : 'max-h-full max-w-full object-contain p-6'}
                        />
                    </div>
                ) : null}

                <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-4 flex flex-col items-start gap-4 sm:flex-row">
                        {form.logoUrl && form.bannerUrl ? (
                            <img
                                src={form.logoUrl}
                                alt=""
                                className="h-20 w-20 shrink-0 rounded-2xl border border-slate-200 bg-white object-contain"
                            />
                        ) : null}
                        <div className="min-w-0">
                            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 shadow-sm">
                                <Globe size={16} />
                                {form.bucket || 'Programmes'} · {form.subCategory || 'Template'}
                            </div>
                            <h1 className="text-3xl font-bold leading-tight text-slate-900">{form.name || 'Untitled Template'}</h1>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {form.schedule ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                                        <Clock size={15} />
                                        Scheduled
                                    </span>
                                ) : null}
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700">
                                    <Globe size={15} />
                                    {visibilityLabel}
                                </span>
                                {form.isMemberOnly ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700">
                                        <Users size={15} />
                                        Linked members
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-600">
                        {form.description ? (
                            <MarkdownLiteText text={form.description} />
                        ) : (
                            <p className="italic text-slate-400">No description added yet.</p>
                        )}
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2">
                        {form.schedule ? (
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 rounded-xl bg-brand-50 p-2.5 text-brand-600"><Clock size={22} /></div>
                                <div className="min-w-0">
                                    <p className="mb-1 font-bold text-slate-900">Schedule</p>
                                    <div className="break-words text-slate-700">{form.schedule}</div>
                                </div>
                            </div>
                        ) : null}
                        {targetAreaLabels.length > 0 ? (
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 rounded-xl bg-brand-50 p-2.5 text-brand-600"><Globe size={22} /></div>
                                <div className="min-w-0">
                                    <p className="mb-1 font-bold text-slate-900">Target areas</p>
                                    <div className="break-words text-slate-700">{targetAreaLabels.join(', ')}</div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {tags.length > 0 ? (
                        <div className="mt-8 border-t border-slate-200 pt-6">
                            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-900">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                    <span key={tag} className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </article>
            </div>
        );
    }

    return (
        <ResourceWizardShell
            steps={TEMPLATE_STEPS}
            activeStep={activeTemplateStep}
            setActiveStep={setActiveTemplateStep}
            validateStep={validateTemplateStep}
            error={error}
            renderStep={renderTemplateStep}
            onCancel={onCancel}
            onSave={handleTemplateWizardSave}
            saving={saving}
            saveLabel={initialData?.id ? 'Save Template' : 'Create Template'}
            savingLabel="Saving..."
            previewLabel="Preview"
            previewTitle="Template preview"
            previewDescription="Unsaved edits shown as the parent template profile."
            renderPreview={renderTemplatePreview}
        />
    );
}
