import React, { useEffect, useMemo, useState } from 'react';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { AlertTriangle, ArrowRightLeft, ExternalLink, Loader2, Sparkles, Globe, MapPin, Phone, Clock, Package2, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { normalizeEligibilityRules } from '../lib/eligibility.js';
import { getPreferredSubregionMatch, resolveSingleSubregionByPostal } from '../lib/postalBoundaries.js';
import { normalizeRole } from '../lib/roles.js';
import { SOFT_ASSET_BUCKETS } from '../lib/softAssetBuckets.js';
import EligibilityRulesEditor from './EligibilityRulesEditor.jsx';
import ImageUpload from './ImageUpload.jsx';
import MarkdownDescriptionField from './MarkdownDescriptionField.jsx';
import PrivateResourceContentEditor from './PrivateResourceContentEditor.jsx';
import TranslationReviewPanel from './TranslationReviewPanel.jsx';

function formatDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeExternalHref(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        return new URL(candidate).toString();
    } catch {
        return '';
    }
}

function normalizeFormText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isGenericSingaporeAddress(value, postalCode) {
    const address = normalizeFormText(value)
        .toLowerCase()
        .replace(/[,.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const postal = normalizeFormText(postalCode);

    return !address
        || address === 'singapore'
        || (postal && (address === postal || address === `singapore ${postal}`));
}

function buildEnrichmentPatch(form, data, services) {
    const patch = {};
    const appliedFields = [];

    const nextAddress = normalizeFormText(data?.address);
    if (
        nextAddress
        && isGenericSingaporeAddress(form.address, form.postalCode)
        && normalizeFormText(form.address).toLowerCase() !== nextAddress.toLowerCase()
    ) {
        patch.address = nextAddress;
        appliedFields.push('address');
    }

    [
        ['phone', 'phone'],
        ['website', 'website'],
        ['hours', 'hours'],
        ['description', 'description'],
        ['logoUrl', 'logo'],
    ].forEach(([field, label]) => {
        const value = normalizeFormText(data?.[field]);
        if (!value || normalizeFormText(form[field])) return;
        patch[field] = value;
        appliedFields.push(label);
    });

    const existingTags = new Set((form.newTags || []).map((tag) => String(tag).toLowerCase()));
    const nextTags = services.filter((tag) => !existingTags.has(String(tag).toLowerCase()));
    if (nextTags.length > 0) {
        patch.newTags = [...new Set([...(form.newTags || []), ...nextTags])];
        appliedFields.push('tags');
    }

    return { patch, appliedFields };
}

function buildInitialForm(type, initialData, currentUser) {
    if (initialData) {
        return {
            ...initialData,
            externalKey: initialData.externalKey || '',
            bucket: type === 'soft' ? (initialData.bucket || 'Programmes') : '',
            ownershipMode: initialData.ownershipMode || (initialData.partnerId ? 'partner' : 'system'),
            audienceMode: initialData.audienceMode || 'public',
            audienceZoneIds: initialData.audienceZoneIds || initialData.audienceZones?.map((zone) => zone.id) || [],
            newTags: initialData.newTags || initialData.tags || [],
            locationIds: initialData.locations?.map((location) => location.id) || [],
            hideFrom: formatDateTimeLocal(initialData.hideFrom),
            hideUntil: formatDateTimeLocal(initialData.hideUntil),
            availabilityEnabled: Boolean(initialData.availabilityEnabled),
            availabilityCount: normalizeAvailabilityCount(initialData.availabilityCount),
            availabilityUnit: initialData.availabilityUnit || '',
            eligibilityRules: normalizeEligibilityRules(initialData.eligibilityRules),
            partnerId: initialData.partnerId || '',
            subregionId: initialData.subregionId || '',
            postalCode: initialData.postalCode || '',
            website: initialData.website || '',
            sourceGooglePlaceId: initialData.sourceGooglePlaceId || '',
            sourceGoogleMapsUri: initialData.sourceGoogleMapsUri || '',
        };
    }

    if (type === 'hard') {
        return {
            externalKey: '',
            name: '',
            bucket: '',
            subCategory: 'Places',
            country: 'SG',
            postalCode: '',
            address: '',
            phone: '',
            hours: '',
            website: '',
            description: '',
            logoUrl: '',
            bannerUrl: '',
            galleryUrls: [],
            sourceGooglePlaceId: '',
            sourceGoogleMapsUri: '',
            newTags: [],
            isHidden: false,
            hideFrom: '',
            hideUntil: '',
            ownershipMode: normalizeRole(currentUser?.role) === 'partner' ? 'partner' : 'system',
            partnerId: '',
        };
    }

    return {
        externalKey: '',
        name: '',
        bucket: 'Programmes',
        subCategory: 'Programmes',
        locationIds: [],
        description: '',
        schedule: '',
        logoUrl: '',
        bannerUrl: '',
        galleryUrls: [],
        newTags: [],
        isMemberOnly: false,
        isHidden: false,
        hideFrom: '',
        hideUntil: '',
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: '',
        eligibilityRules: null,
        ownershipMode: normalizeRole(currentUser?.role) === 'partner' ? 'partner' : 'system',
        partnerId: '',
        subregionId: normalizeRole(currentUser?.role) === 'partner' ? (currentUser?.subregionIds?.[0] || '') : '',
        audienceMode: 'public',
        audienceZoneIds: [],
    };
}

const OWNERSHIP_OPTIONS = [
    { value: 'system', label: 'System-owned' },
    { value: 'partner', label: 'Partner-owned' },
];

function TooltipMultiValueLabel(props) {
    const label = props.data?.label || '';
    return (
        <components.MultiValueLabel
            {...props}
            innerProps={{
                ...props.innerProps,
                title: label,
                'aria-label': label,
            }}
        >
            {props.children}
        </components.MultiValueLabel>
    );
}

export default function AssetForm({
    type = 'hard',
    initialData,
    onSave,
    onCancel,
    partnerHardAssets = [],
    currentUser,
    partnerOptions = [],
    subregions = [],
    audienceZones = [],
    importSource = null,
    importWarnings = [],
    duplicateMatches = [],
    onSelectDuplicateMatch = null,
}) {
    const isHard = type === 'hard';
    const currentRole = normalizeRole(currentUser?.role);
    const [form, setForm] = useState(() => buildInitialForm(type, initialData, currentUser));
    const [saving, setSaving] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [enrichmentNotice, setEnrichmentNotice] = useState('');
    const [creatingSubCategory, setCreatingSubCategory] = useState(false);
    const [error, setError] = useState('');
    const [availableTags, setAvailableTags] = useState([]);
    const [availableSubCategories, setAvailableSubCategories] = useState([]);

    useEffect(() => {
        api.searchTags('').then((tags) => {
            setAvailableTags(tags.map((tag) => ({ value: tag, label: tag })));
        }).catch(console.error);
        api.getSubCategories().then(setAvailableSubCategories).catch(console.error);
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

    const partnerSelectOptions = partnerOptions.map((partner) => ({
        value: partner.id,
        label: `${partner.name} (@${partner.username})`,
    }));
    const audienceZoneOptions = audienceZones.map((zone) => ({
        value: zone.id,
        label: zone.zoneCode ? `${zone.name} (${zone.zoneCode})` : zone.name,
    }));

    const hardSubregionResult = useMemo(() => {
        if (!isHard) return { status: 'not-applicable', subregion: null, matches: [] };
        return resolveSingleSubregionByPostal(subregions, form.postalCode, currentRole === 'super_admin' ? null : currentUser?.subregionIds);
    }, [currentRole, currentUser?.subregionIds, form.postalCode, isHard, subregions]);
    const preferredHardSubregion = useMemo(
        () => getPreferredSubregionMatch(hardSubregionResult.matches),
        [hardSubregionResult.matches]
    );

    const linkedLocationOptions = partnerHardAssets.map((asset) => ({
        value: asset.id,
        label: `${asset.name} (${asset.address})`,
    }));

    const selectedLinkedLocations = partnerHardAssets.filter((asset) => (form.locationIds || []).includes(asset.id));
    const linkedLocationSubregions = [...new Set(selectedLinkedLocations.map((asset) => asset.subregionId).filter(Boolean))];
    const derivedSoftSubregion = linkedLocationSubregions.length === 1
        ? subregions.find((subregion) => Number(subregion.id) === Number(linkedLocationSubregions[0])) || null
        : null;
    const hardSubCategoryOptions = useMemo(
        () => availableSubCategories
            .filter((subcategory) => subcategory.type === 'hard')
            .map((subcategory) => ({ value: subcategory.name, label: subcategory.name })),
        [availableSubCategories]
    );

    const availableTargetSubregions = useMemo(() => {
        if (currentRole === 'super_admin') return subregions;
        const scope = new Set((currentUser?.subregionIds || []).map(Number));
        return subregions.filter((subregion) => scope.has(Number(subregion.id)));
    }, [currentRole, currentUser?.subregionIds, subregions]);

    const explicitTargetSubregion = availableTargetSubregions.find((subregion) => Number(subregion.id) === Number(form.subregionId)) || null;
    const selectedHardSubCategoryOption = useMemo(() => {
        const currentValue = String(form.subCategory || 'Places').trim();
        return hardSubCategoryOptions.find((option) => option.value === currentValue) || { value: currentValue, label: currentValue };
    }, [form.subCategory, hardSubCategoryOptions]);
    const hostLocationSelectStyles = useMemo(() => ({
        valueContainer: (base) => ({
            ...base,
            alignItems: 'flex-start',
            paddingTop: 4,
            paddingBottom: 4,
        }),
        multiValue: (base) => ({
            ...base,
            maxWidth: '100%',
            alignItems: 'flex-start',
        }),
        multiValueLabel: (base) => ({
            ...base,
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'unset',
            lineHeight: 1.2,
            paddingTop: 4,
            paddingBottom: 4,
        }),
    }), []);

    async function handleCreateHardSubCategory(inputValue) {
        const name = String(inputValue || '').trim().replace(/\s+/g, ' ');
        if (!name) return;

        const existingOption = hardSubCategoryOptions.find((option) => option.label.toLowerCase() === name.toLowerCase());
        if (existingOption) {
            setField('subCategory', existingOption.value);
            return;
        }

        setCreatingSubCategory(true);
        setError('');
        try {
            const created = await api.createSubCategory({ name, type: 'hard' });
            setAvailableSubCategories((prev) => (
                [...prev, created].sort((left, right) => `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`))
            ));
            setField('subCategory', created.name);
        } catch (err) {
            setError(err.message || 'Failed to create sub-category.');
        } finally {
            setCreatingSubCategory(false);
        }
    }

    async function handleEnrichDraft() {
        setEnriching(true);
        setError('');
        setEnrichmentNotice('');
        try {
            const data = await api.enrichHardAssetDraft({
                googlePlaceId: form.sourceGooglePlaceId || '',
                name: form.name,
                address: form.address,
                postalCode: form.postalCode,
                website: form.website,
                subCategory: form.subCategory,
            });
            const services = Array.isArray(data?.services) ? data.services.filter(Boolean) : [];
            const hasSuggestions = Boolean(
                data?.address
                || data?.phone
                || data?.website
                || data?.hours
                || data?.description
                || data?.logoUrl
                || services.length
            );
            if (!hasSuggestions) {
                setEnrichmentNotice('No AI suggestions were returned for this place. Check AI enrichment configuration or try a more specific name and address.');
                return;
            }
            if (data) {
                const { patch, appliedFields } = buildEnrichmentPatch(form, data, services);
                if (appliedFields.length === 0) {
                    setEnrichmentNotice('AI suggestions were returned, but your existing fields already have values.');
                    return;
                }
                setForm((prev) => ({ ...prev, ...patch }));
                setEnrichmentNotice(`AI suggestions were applied to ${appliedFields.join(', ')}.`);
            }
        } catch (err) {
            setError(err.message || 'Failed to enrich draft');
        } finally {
            setEnriching(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const payload = { ...form };
            payload.externalKey = String(payload.externalKey || '').trim() || undefined;
            if (payload.hideFrom) payload.hideFrom = new Date(payload.hideFrom).toISOString();
            if (payload.hideUntil) payload.hideUntil = new Date(payload.hideUntil).toISOString();

            if (currentRole === 'partner') {
                payload.ownershipMode = 'partner';
                payload.partnerId = currentUser?.id;
            }

            if (payload.ownershipMode !== 'partner') {
                payload.partnerId = null;
                if (!isHard && payload.audienceMode === 'partner_boundary') {
                    payload.audienceMode = 'public';
                }
            }

            if (isHard) {
                delete payload.bucket;
                if (hardSubregionResult.status !== 'ok') {
                    if (hardSubregionResult.status === 'missing') {
                        throw new Error('Postal code does not match any configured service area.');
                    }
                    if (hardSubregionResult.status === 'ambiguous') {
                        // Save is allowed; the API will route this place under the preferred matched subregion.
                    } else {
                        throw new Error('Postal code must be a valid 6-digit code.');
                    }
                }
                delete payload.subregionId;
                delete payload.locationIds;
                delete payload.audienceMode;
            } else {
                payload.bucket = form.bucket || 'Programmes';
                payload.availabilityEnabled = Boolean(form.availabilityEnabled);
                payload.availabilityCount = normalizeAvailabilityCount(form.availabilityCount);
                payload.availabilityUnit = normalizeAvailabilityUnit(form.availabilityUnit);
                payload.eligibilityRules = normalizeEligibilityRules(form.eligibilityRules);
                payload.locationIds = Array.isArray(form.locationIds) ? form.locationIds : [];
                payload.audienceZoneIds = Array.isArray(form.audienceZoneIds) ? form.audienceZoneIds : [];
                if (payload.locationIds.length === 0) {
                    if (currentRole === 'partner') {
                        payload.subregionId = currentUser?.subregionIds?.[0] || null;
                    } else {
                        if (!payload.subregionId) {
                            throw new Error('Select a service area when no linked place is chosen.');
                        }
                    }
                } else {
                    if (linkedLocationSubregions.length > 1) {
                        throw new Error('Linked places must all belong to the same service area.');
                    }
                }

                if (payload.audienceMode === 'partner_boundary' && payload.ownershipMode !== 'partner') {
                    throw new Error('Partner-area audience is only allowed for partner-owned offerings.');
                }
                if (payload.audienceMode === 'audience_zones' && payload.audienceZoneIds.length === 0) {
                    throw new Error('Select at least one audience zone for audience-zone offerings.');
                }
                if (payload.audienceMode !== 'audience_zones') {
                    payload.audienceZoneIds = [];
                }
            }

            if ((currentRole === 'super_admin' || currentRole === 'regional_admin') && payload.ownershipMode === 'partner' && !payload.partnerId) {
                throw new Error('Select a partner owner for partner-owned assets.');
            }

            let savedAsset = null;

            if (initialData?.id) {
                if (isHard) {
                    savedAsset = await api.updateHardAsset(initialData.id, payload);
                } else {
                    savedAsset = await api.updateSoftAsset(initialData.id, payload);
                }
            } else if (isHard) {
                savedAsset = await api.createHardAsset(payload);
            } else {
                savedAsset = await api.createSoftAsset(payload);
            }

            onSave(savedAsset);
        } catch (err) {
            setError(err.message || 'Failed to save asset');
            setSaving(false);
            return;
        }

        setSaving(false);
    }

    const ownershipDisabled = currentRole === 'partner';
    const selectedPartnerOption = partnerSelectOptions.find((option) => Number(option.value) === Number(form.partnerId)) || null;
    const selectedLocationOptions = linkedLocationOptions.filter((option) => (form.locationIds || []).includes(option.value));
    const selectedAudienceZoneOptions = audienceZoneOptions.filter((option) => (form.audienceZoneIds || []).includes(option.value));
    const websiteHref = useMemo(() => (isHard ? normalizeExternalHref(form.website) : ''), [form.website, isHard]);
    const hasLogoImage = Boolean(form.logoUrl);
    const hasBannerImage = Boolean(form.bannerUrl);

    function moveLogoToBanner() {
        if (!form.logoUrl) return;
        setForm((prev) => ({
            ...prev,
            bannerUrl: prev.logoUrl,
            logoUrl: '',
        }));
    }

    function moveBannerToLogo() {
        if (!form.bannerUrl) return;
        setForm((prev) => ({
            ...prev,
            logoUrl: prev.bannerUrl,
            bannerUrl: '',
        }));
    }

    function swapMediaImages() {
        if (!form.logoUrl || !form.bannerUrl) return;
        setForm((prev) => ({
            ...prev,
            logoUrl: prev.bannerUrl,
            bannerUrl: prev.logoUrl,
        }));
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {isHard && importSource ? (
                <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Imported Google place</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        {importSource.googlePlaceId ? (
                            <span className="rounded-full border border-brand-200 bg-white px-3 py-1 font-semibold text-slate-700">
                                Place ID {importSource.googlePlaceId}
                            </span>
                        ) : null}
                        {importSource.googleMapsUri ? (
                            <a
                                href={importSource.googleMapsUri}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3 py-1 font-semibold text-brand-700 transition hover:bg-brand-100"
                            >
                                Open source
                                <ExternalLink size={13} />
                            </a>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                        These values are suggestions only. Review them carefully before saving this place.
                    </p>
                </div>
            ) : null}

            {isHard ? (
                <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">AI Grounding</p>
                            <p className="mt-1 text-sm text-slate-700">
                                Uses name and postal code to find a better address, hours, description, services, and logo.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleEnrichDraft}
                            disabled={enriching || !form.name || !form.postalCode}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {enriching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {enriching ? 'Enriching...' : 'Enrich with AI'}
                        </button>
                    </div>
                    {enrichmentNotice ? (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                            {enrichmentNotice}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {isHard && duplicateMatches.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-700" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-amber-900">Possible existing place found</p>
                            <p className="mt-1 text-sm text-amber-800">
                                We found {duplicateMatches.length} likely match{duplicateMatches.length === 1 ? '' : 'es'} in CareAround SG. You can still create a new place, but updating the existing one may be cleaner.
                            </p>
                            <div className="mt-3 space-y-2">
                                {duplicateMatches.map((match) => (
                                    <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-3 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{match.name}</p>
                                            <p className="text-xs text-slate-500">{match.address || match.postalCode || 'Existing place'}</p>
                                        </div>
                                        {onSelectDuplicateMatch ? (
                                            <button
                                                type="button"
                                                onClick={() => onSelectDuplicateMatch(match.id)}
                                                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                                            >
                                                Edit existing asset
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {isHard && importWarnings.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Import notes</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                        {importWarnings.map((warning) => (
                            <li key={warning} className="flex items-start gap-2">
                                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                                <span>{warning}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
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

                    {hasLogoImage || hasBannerImage ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Image placement</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    If the imported image landed in the wrong slot, you can reassign it here without uploading it again.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {hasLogoImage && !hasBannerImage ? (
                                    <button
                                        type="button"
                                        onClick={moveLogoToBanner}
                                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                                    >
                                        <ArrowRightLeft size={15} />
                                        Move logo to hero
                                    </button>
                                ) : null}
                                {hasBannerImage && !hasLogoImage ? (
                                    <button
                                        type="button"
                                        onClick={moveBannerToLogo}
                                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                                    >
                                        <ArrowRightLeft size={15} />
                                        Move hero to logo
                                    </button>
                                ) : null}
                                {hasLogoImage && hasBannerImage ? (
                                    <button
                                        type="button"
                                        onClick={swapMediaImages}
                                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                                    >
                                        <ArrowRightLeft size={15} />
                                        Swap logo and hero
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
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
                        Stable workbook identifier. Keep this unchanged after creation.
                    </p>
                </div>

                <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                    <input required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={isHard ? 'Place name' : 'Offering name'} className="input-field" />
                </div>

                <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Users size={13} /> Ownership</label>
                        <select
                            value={form.ownershipMode}
                            disabled={ownershipDisabled}
                            onChange={(e) => setField('ownershipMode', e.target.value)}
                            className="input-field"
                        >
                            {OWNERSHIP_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Partner Owner</label>
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
                </div>

                {!isHard && (
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Bucket *</label>
                            <select required value={form.bucket || 'Programmes'} onChange={(e) => setField('bucket', e.target.value)} className="input-field">
                                {SOFT_ASSET_BUCKETS.map((bucket) => (
                                    <option key={bucket} value={bucket}>{bucket}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Sub-Category *</label>
                            <select required value={form.subCategory || 'Programmes'} onChange={(e) => setField('subCategory', e.target.value)} className="input-field">
                                {availableSubCategories.filter((subcategory) => subcategory.type === 'soft').map((subcategory) => (
                                    <option key={subcategory.id} value={subcategory.name}>{subcategory.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Host Locations (Optional)</label>
                            <Select
                                isMulti
                                options={linkedLocationOptions}
                                value={selectedLocationOptions}
                                onChange={(selected) => setField('locationIds', Array.isArray(selected) ? selected.map((item) => item.value) : [])}
                                components={{ MultiValueLabel: TooltipMultiValueLabel }}
                                styles={hostLocationSelectStyles}
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder="Select places..."
                            />
                        </div>
                    </div>
                )}

                {isHard && (
                    <>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Sub-Category *</label>
                            <CreatableSelect
                                isClearable={false}
                                options={hardSubCategoryOptions}
                                value={selectedHardSubCategoryOption}
                                onChange={(selected) => setField('subCategory', selected?.value || 'Places')}
                                onCreateOption={handleCreateHardSubCategory}
                                isDisabled={creatingSubCategory}
                                formatCreateLabel={(inputValue) => `Create category "${inputValue.trim().replace(/\s+/g, ' ')}"`}
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder="Select or create a place category..."
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Type to create a new place category on the fly when the right one is not already available.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Globe size={13} className="inline mr-1" />Country *</label>
                            <select required value={form.country} onChange={(e) => setField('country', e.target.value)} className="input-field">
                                <option value="SG">Singapore</option>
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="GB">United Kingdom</option>
                                <option value="AU">Australia</option>
                                <option value="MY">Malaysia</option>
                                <option value="IN">India</option>
                                <option value="PH">Philippines</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Postal code *</label>
                            <input required value={form.postalCode} onChange={(e) => setField('postalCode', e.target.value)} placeholder="680153" className="input-field" />
                        </div>
                        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                            {hardSubregionResult.status === 'ok' ? (
                                <span className="text-green-700 font-medium">Service area found: {hardSubregionResult.subregion.subregionCode || 'No code'} · {hardSubregionResult.subregion.name}</span>
                            ) : hardSubregionResult.status === 'ambiguous' ? (
                                <span className="text-amber-700">
                                    Postal code matches multiple service areas. This place can still be saved and will use {preferredHardSubregion?.subregionCode || 'No code'} · {preferredHardSubregion?.name || 'the preferred service area'} for area-based management.
                                </span>
                            ) : hardSubregionResult.status === 'missing' ? (
                                <span className="text-red-700">Postal code does not match any configured service area.</span>
                            ) : (
                                <span className="text-slate-500">Enter a valid 6-digit postal code to place this resource in a service area automatically.</span>
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><MapPin size={13} className="inline mr-1" />Street Address *</label>
                            <input required value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="123 Main St" className="input-field" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Phone size={13} className="inline mr-1" />Phone</label>
                            <input type="tel" value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} placeholder="(312) 555-0000" className="input-field" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Clock size={13} className="inline mr-1" />Hours</label>
                            <input value={form.hours || ''} onChange={(e) => setField('hours', e.target.value)} placeholder="Mon–Fri 9am–5pm" className="input-field" />
                        </div>
                        <div className="col-span-2">
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                <label className="block text-sm font-semibold text-slate-700"><Globe size={13} className="inline mr-1" />Website</label>
                                {websiteHref ? (
                                    <a
                                        href={websiteHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition hover:text-brand-800 hover:underline"
                                    >
                                        Open website
                                        <ExternalLink size={13} />
                                    </a>
                                ) : null}
                            </div>
                            <input
                                type="url"
                                value={form.website || ''}
                                onChange={(e) => setField('website', e.target.value)}
                                placeholder="https://example.org"
                                className="input-field"
                            />
                            {websiteHref ? (
                                <a
                                    href={websiteHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-sm font-medium text-brand-700 transition hover:text-brand-800 hover:underline"
                                >
                                    {form.website || websiteHref}
                                    <ExternalLink size={13} className="flex-shrink-0" />
                                </a>
                            ) : null}
                        </div>
                    </>
                )}

                {!isHard && (
                    <>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Clock size={13} className="inline mr-1" />Schedule</label>
                            <textarea
                                rows={3}
                                value={form.schedule || ''}
                                onChange={(e) => setField('schedule', e.target.value)}
                                placeholder="e.g. Every Tuesday at 10 AM"
                                className="input-field"
                            />
                        </div>
                        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            {selectedLinkedLocations.length > 0 ? (
                                linkedLocationSubregions.length === 1 && derivedSoftSubregion ? (
                                    <span className="text-green-700 font-medium">Service area found from linked places: {derivedSoftSubregion.subregionCode || 'No code'} · {derivedSoftSubregion.name}</span>
                                ) : (
                                    <span className="text-amber-700">Linked places span multiple service areas. Keep linked places within one service area.</span>
                                )
                            ) : currentRole === 'partner' ? (
                                <span className="text-green-700 font-medium">Service area fixed to your partner account.</span>
                            ) : (
                                <span>Select a service area below when the offering is not linked to a place.</span>
                            )}
                        </div>
                        {selectedLinkedLocations.length === 0 ? (
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Service area</label>
                                {currentRole === 'partner' ? (
                                    <input
                                        readOnly
                                        value={availableTargetSubregions.find((subregion) => Number(subregion.id) === Number(currentUser?.subregionIds?.[0]))?.name || 'Assigned service area'}
                                        className="input-field bg-slate-50"
                                    />
                                ) : (
                                    <select className="input-field" value={form.subregionId || ''} onChange={(e) => setField('subregionId', e.target.value)}>
                                        <option value="">Select service area</option>
                                        {availableTargetSubregions.map((subregion) => (
                                            <option key={subregion.id} value={subregion.id}>{subregion.subregionCode || subregion.name} · {subregion.name}</option>
                                        ))}
                                    </select>
                                )}
                                {explicitTargetSubregion ? (
                                    <p className="mt-1 text-xs text-green-700 font-medium">Selected service area: {explicitTargetSubregion.subregionCode || 'No code'} · {explicitTargetSubregion.name}</p>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-4 flex items-center gap-2">
                                <Package2 size={16} className="text-brand-600" />
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">Availability</h3>
                                    <p className="text-xs text-slate-500">Control the public availability count shown on offering cards and detail pages.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">Enable availability tracking</p>
                                        <p className="text-xs text-slate-500">Turn this on when users should see a live remaining count.</p>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(form.availabilityEnabled)}
                                            onChange={(e) => setField('availabilityEnabled', e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-brand-600 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-slate-700">Availability count</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={form.availabilityCount}
                                            onChange={(e) => setField('availabilityCount', e.target.value)}
                                            placeholder="0"
                                            className="input-field"
                                        />
                                        <p className="mt-1 text-xs text-slate-500">Use a whole number. The value is preserved even if tracking is switched off.</p>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-slate-700">Availability unit</label>
                                        <input
                                            value={form.availabilityUnit || ''}
                                            onChange={(e) => setField('availabilityUnit', e.target.value)}
                                            placeholder="slots, tickets, vouchers"
                                            className="input-field"
                                        />
                                        <p className="mt-1 text-xs text-slate-500">Optional. If left blank, public cards will fall back to “available”.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className="col-span-2">
                    <MarkdownDescriptionField
                        id="asset-description"
                        value={form.description || ''}
                        onChange={(value) => setField('description', value)}
                        rows={3}
                    />
                </div>

                {initialData?.id ? (
                    <div className="col-span-2">
                        <TranslationReviewPanel
                            resourceType={isHard ? 'hard' : 'soft'}
                            resourceId={initialData.id}
                        />
                    </div>
                ) : (
                    <div className="col-span-2 rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-slate-600">
                        Save this resource first, then edit it again to review Mandarin, Malay, and Tamil translations.
                    </div>
                )}

                {initialData?.id ? (
                    <div className="col-span-2">
                        <PrivateResourceContentEditor
                            resourceType={isHard ? 'hard' : 'soft'}
                            resourceId={initialData.id}
                        />
                    </div>
                ) : (
                    <div className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Save this resource first, then edit it again to add partner-only notes and files.
                    </div>
                )}

                <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tags (Press enter to add)</label>
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

            {!isHard ? (
                <EligibilityRulesEditor
                    value={form.eligibilityRules}
                    onChange={(rules) => setField('eligibilityRules', rules)}
                />
            ) : null}

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-6 space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Globe size={16} className="text-brand-600" />
                    Visibility Settings
                </h3>

                {!isHard && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Who can see this?</label>
                                <select value={form.audienceMode || 'public'} onChange={(e) => setField('audienceMode', e.target.value)} className="input-field">
                                    <option value="public">Public</option>
                                    <option value="audience_zones">Target areas</option>
                                    {form.ownershipMode === 'partner' ? <option value="partner_boundary">Partner area</option> : null}
                                </select>
                                <p className="mt-1 text-xs text-slate-500">
                                    Public offerings are open to everyone. Target-area offerings show only in selected postal-code areas. Partner-area offerings stay tied to the partner&apos;s own member area.
                                </p>
                            </div>
                            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 bg-white">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">For linked members</p>
                                    <p className="text-xs text-slate-500">Require users to be signed in and linked before they can view this offering</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={Boolean(form.isMemberOnly)} onChange={(e) => setField('isMemberOnly', e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                </label>
                            </div>
                        </div>
                        {form.audienceMode === 'audience_zones' ? (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Audience Zones</label>
                                <Select
                                    isMulti
                                    options={audienceZoneOptions}
                                    value={selectedAudienceZoneOptions}
                                    onChange={(selected) => setField('audienceZoneIds', Array.isArray(selected) ? selected.map((item) => item.value) : [])}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select one or more audience zones..."
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Users whose postal code falls inside any selected zone can discover this offering.
                                </p>
                            </div>
                        ) : null}
                    </>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">Hide from App</p>
                        <p className="text-xs text-slate-500">Temporarily or permanently remove from discovery</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={Boolean(form.isHidden)} onChange={(e) => setField('isHidden', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Hide (From)</label>
                        <input type="datetime-local" value={form.hideFrom} onChange={(e) => setField('hideFrom', e.target.value)} className="input-field text-sm p-2" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Hide (Until)</label>
                        <input type="datetime-local" value={form.hideUntil} onChange={(e) => setField('hideUntil', e.target.value)} className="input-field text-sm p-2" />
                    </div>
                </div>
            </div>

            {error ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div> : null}

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => onCancel(form)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save Asset'}
                </button>
            </div>
        </form>
    );
}
