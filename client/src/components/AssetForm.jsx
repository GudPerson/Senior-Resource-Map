import React, { useEffect, useMemo, useState } from 'react';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { AlertTriangle, ArrowRightLeft, Building2, ExternalLink, Loader2, Sparkles, Globe, MapPin, MessageCircle, Phone, Clock, Package2, ShieldCheck, Users, EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { normalizeEligibilityRules } from '../lib/eligibility.js';
import {
    canUseSingaporePostalFallback,
    findSingaporeFallbackSubregion,
    getPreferredSubregionMatch,
    resolveSingleSubregionByPostal,
} from '../lib/postalBoundaries.js';
import { normalizeRole } from '../lib/roles.js';
import { createEmptySocialLinks, mergeSocialLinks, normalizeSocialLinks, SOCIAL_PLATFORMS } from '../lib/socialLinks.js';
import { SOFT_ASSET_BUCKETS } from '../lib/softAssetBuckets.js';
import AssetAccessPanel from './AssetAccessPanel.jsx';
import AssetAudienceZonesPanel from './AssetAudienceZonesPanel.jsx';
import EligibilityRulesEditor from './EligibilityRulesEditor.jsx';
import ImageUpload from './ImageUpload.jsx';
import MarkdownDescriptionField from './MarkdownDescriptionField.jsx';
import MarkdownLiteText from './MarkdownLiteText.jsx';
import PrivateResourceContentEditor from './PrivateResourceContentEditor.jsx';
import ResourceWizardShell from './ResourceWizardShell.jsx';
import TranslationReviewPanel from './TranslationReviewPanel.jsx';

function formatDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatSystemUpdateDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
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

function isValidOptionalHttpUrl(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    if (!/^https?:\/\//i.test(text)) return false;
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidOptionalEmail(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

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

    const mergedSocialLinks = mergeSocialLinks(form.socialLinks, data?.socialLinks);
    const hasNewSocialLinks = SOCIAL_PLATFORMS.some((platform) => (
        mergedSocialLinks[platform.key] && mergedSocialLinks[platform.key] !== normalizeSocialLinks(form.socialLinks)[platform.key]
    ));
    if (hasNewSocialLinks) {
        patch.socialLinks = mergedSocialLinks;
        appliedFields.push('social links');
    }

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
            ownershipMode: 'system',
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
            coverageRegionIds: initialData.coverageRegionIds || (initialData.subregionId ? [initialData.subregionId] : []),
            postalCode: initialData.postalCode || '',
            whatsappContact: initialData.whatsappContact || '',
            website: initialData.website || '',
            socialLinks: normalizeSocialLinks(initialData.socialLinks),
            sourceGooglePlaceId: initialData.sourceGooglePlaceId || '',
            sourceGoogleMapsUri: initialData.sourceGoogleMapsUri || '',
            lastReviewedAt: formatDateInput(initialData.lastReviewedAt),
            sourceType: initialData.sourceType || '',
            verificationStatus: initialData.verificationStatus || 'unverified',
            verificationConfidence: initialData.verificationConfidence || '',
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
            whatsappContact: '',
            hours: '',
            website: '',
            socialLinks: createEmptySocialLinks(),
            description: '',
            logoUrl: '',
            bannerUrl: '',
            galleryUrls: [],
            sourceGooglePlaceId: '',
            sourceGoogleMapsUri: '',
            lastReviewedAt: '',
            sourceType: '',
            verificationStatus: 'unverified',
            verificationConfidence: '',
            newTags: [],
            isHidden: false,
            hideFrom: '',
            hideUntil: '',
            ownershipMode: 'system',
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
        contactPhone: '',
        whatsappContact: '',
        contactEmail: '',
        ctaLabel: '',
        ctaUrl: '',
        venueNote: '',
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
        ownershipMode: 'system',
        partnerId: '',
        subregionId: '',
        coverageRegionIds: [],
        audienceMode: 'public',
        audienceZoneIds: [],
        lastReviewedAt: '',
        sourceType: '',
        verificationStatus: 'unverified',
        verificationConfidence: '',
    };
}

const OWNERSHIP_OPTIONS = [
    { value: 'system', label: 'System-owned' },
];

const PLACE_STEPS = ['Profile', 'Location', 'Visibility', 'Access', 'Zones', 'Translate', 'Restricted'];
const OFFERING_STEPS = ['Profile', 'Schedule', 'Host & coverage', 'Visibility', 'Access', 'Translate', 'Restricted'];

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
    onResourceToolsChanged,
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
    const [activePlaceStep, setActivePlaceStep] = useState(0);
    const [activeOfferingStep, setActiveOfferingStep] = useState(0);

    useEffect(() => {
        api.searchTags('').then((tags) => {
            setAvailableTags(tags.map((tag) => ({ value: tag, label: tag })));
        }).catch(console.error);
        api.getSubCategories().then(setAvailableSubCategories).catch(console.error);
    }, []);

    useEffect(() => {
        if (form.ownershipMode !== 'partner' && form.audienceMode === 'partner_boundary') {
            setForm((prev) => ({ ...prev, audienceMode: 'public' }));
        }
    }, [form.audienceMode, form.ownershipMode]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const tagOptions = availableTags;
    const currentTags = form.newTags.map((tag) => ({ value: tag, label: tag }));

    const audienceZoneOptions = audienceZones.map((zone) => {
        const suffix = [
            zone.zoneCode ? zone.zoneCode : null,
            zone.hardAssetName ? `Asset: ${zone.hardAssetName}` : null,
            zone.sharingStatus && zone.sharingStatus !== 'approved' ? zone.sharingStatus.replace(/_/g, ' ') : null,
        ].filter(Boolean).join(' | ');
        return {
            value: zone.id,
            label: suffix ? `${zone.name} (${suffix})` : zone.name,
        };
    });

    const hardSubregionResult = useMemo(() => {
        if (!isHard) return { status: 'not-applicable', subregion: null, matches: [] };
        return resolveSingleSubregionByPostal(subregions, form.postalCode, currentRole === 'super_admin' ? null : currentUser?.subregionIds);
    }, [currentRole, currentUser?.subregionIds, form.postalCode, isHard, subregions]);
    const preferredHardSubregion = useMemo(
        () => getPreferredSubregionMatch(hardSubregionResult.matches),
        [hardSubregionResult.matches]
    );
    const singaporeFallbackSubregion = useMemo(
        () => findSingaporeFallbackSubregion(subregions),
        [subregions]
    );
    const canUseHardSingaporeFallback = useMemo(() => (
        isHard
        && hardSubregionResult.status === 'missing'
        && canUseSingaporePostalFallback({
            country: form.country,
            currentRole,
            currentUser,
            singaporeSubregion: singaporeFallbackSubregion,
        })
    ), [currentRole, currentUser, form.country, hardSubregionResult.status, isHard, singaporeFallbackSubregion]);

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
            setError(err.message || 'Failed to create category.');
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
                socialLinks: form.socialLinks || createEmptySocialLinks(),
                subCategory: form.subCategory,
            });
            const services = Array.isArray(data?.services) ? data.services.filter(Boolean) : [];
            const hasSocialSuggestions = SOCIAL_PLATFORMS.some((platform) => data?.socialLinks?.[platform.key]);
            const hasSuggestions = Boolean(
                data?.address
                || data?.phone
                || data?.website
                || hasSocialSuggestions
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
        e?.preventDefault?.();
        setSaving(true);
        setError('');

        try {
            const payload = { ...form };
            payload.externalKey = String(payload.externalKey || '').trim() || undefined;
            if (payload.hideFrom) payload.hideFrom = new Date(payload.hideFrom).toISOString();
            if (payload.hideUntil) payload.hideUntil = new Date(payload.hideUntil).toISOString();

            if (payload.ownershipMode !== 'partner') {
                payload.partnerId = null;
                if (!isHard && payload.audienceMode === 'partner_boundary') {
                    payload.audienceMode = 'public';
                }
            }

            if (isHard) {
                delete payload.bucket;
                payload.socialLinks = normalizeSocialLinks(payload.socialLinks);
                delete payload.ownershipMode;
                delete payload.partnerId;
                if (hardSubregionResult.status !== 'ok') {
                    if (hardSubregionResult.status === 'missing' && !canUseHardSingaporeFallback) {
                        throw new Error('Postal code does not match any configured service area.');
                    }
                    if (hardSubregionResult.status === 'ambiguous') {
                        // Save is allowed; the API will route this place under the preferred matched subregion.
                    } else if (canUseHardSingaporeFallback) {
                        // Save is allowed; the API validates and caches Singapore fallback postals.
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
                payload.coverageRegionIds = Array.isArray(form.coverageRegionIds)
                    ? form.coverageRegionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
                    : [];
                if (payload.locationIds.length === 0) {
                    if (payload.coverageRegionIds.length === 0 && !(payload.audienceMode === 'audience_zones' && payload.audienceZoneIds.length > 0)) {
                        throw new Error('Select at least one service region or target area when no linked place is chosen.');
                    }
                    payload.subregionId = payload.coverageRegionIds[0] || payload.subregionId || null;
                } else {
                    payload.coverageRegionIds = [];
                    if (linkedLocationSubregions.length > 1) {
                        throw new Error('Linked places must all belong to the same service area.');
                    }
                }

                if (payload.audienceMode === 'partner_boundary' && payload.ownershipMode !== 'partner') {
                    throw new Error('Managed-area audience is no longer available for new offerings. Use target areas instead.');
                }
                if (payload.audienceMode === 'audience_zones' && payload.audienceZoneIds.length === 0) {
                    throw new Error('Select at least one audience zone for audience-zone offerings.');
                }
                if (payload.audienceMode !== 'audience_zones') {
                    payload.audienceZoneIds = [];
                }
            }

            if (!isHard && (currentRole === 'super_admin' || currentRole === 'regional_admin') && payload.ownershipMode === 'partner' && !payload.partnerId) {
                throw new Error('Legacy scoped ownership is no longer assignable. Use Asset Access on the host place instead.');
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

    const selectedLocationOptions = linkedLocationOptions.filter((option) => (form.locationIds || []).includes(option.value));
    const selectedAudienceZoneOptions = audienceZoneOptions.filter((option) => (form.audienceZoneIds || []).includes(option.value));
    const coverageRegionOptions = availableTargetSubregions.map((subregion) => ({
        value: subregion.id,
        label: `${subregion.subregionCode || subregion.name} · ${subregion.name}`,
    }));
    const selectedCoverageRegionOptions = coverageRegionOptions.filter((option) => (form.coverageRegionIds || []).map(Number).includes(Number(option.value)));
    const websiteHref = useMemo(() => normalizeExternalHref(form.website), [form.website]);
    const normalizedSocialLinks = useMemo(() => normalizeSocialLinks(form.socialLinks), [form.socialLinks]);
    const hasLogoImage = Boolean(form.logoUrl);
    const hasBannerImage = Boolean(form.bannerUrl);
    const isOfferingLinkedToHostPlace = !isHard && Array.isArray(form.locationIds) && form.locationIds.length > 0;

    function setSocialLink(platformKey, value) {
        setForm((prev) => ({
            ...prev,
            socialLinks: {
                ...normalizeSocialLinks(prev.socialLinks),
                [platformKey]: value,
            },
        }));
    }

    function getInvalidSocialLinkMessage() {
        const socialLinks = normalizeSocialLinks(form.socialLinks);
        const invalidPlatform = SOCIAL_PLATFORMS.find((platform) => (
            String(socialLinks[platform.key] || '').trim()
            && !isValidOptionalHttpUrl(socialLinks[platform.key])
        ));
        return invalidPlatform ? `Enter a valid ${invalidPlatform.label} URL starting with http:// or https://.` : '';
    }

    function getPlaceProfileContactValidationError() {
        if (!isValidOptionalHttpUrl(form.website)) {
            return 'Enter a valid website URL starting with http:// or https://.';
        }
        return getInvalidSocialLinkMessage();
    }

    function getOfferingProfileContactValidationError() {
        if (!isValidOptionalHttpUrl(form.website)) {
            return 'Enter a valid website URL starting with http:// or https://.';
        }
        const socialLinkMessage = getInvalidSocialLinkMessage();
        if (socialLinkMessage) return socialLinkMessage;
        if (!isValidOptionalEmail(form.contactEmail)) {
            return 'Enter a valid contact email address.';
        }
        if (!isValidOptionalHttpUrl(form.ctaUrl)) {
            return 'Enter a valid action button link starting with http:// or https://.';
        }
        return '';
    }

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

    function getSystemUpdateSummary(resourceLabel = isHard ? 'Place' : 'Offering') {
        const dateLabel = formatSystemUpdateDate(
            initialData?.updatedAt
            || initialData?.updated_at
            || initialData?.createdAt
            || initialData?.created_at
        );
        const actorName = String(
            initialData?.updatedByName
            || initialData?.updated_by_name
            || initialData?.creatorName
            || initialData?.creator_name
            || ''
        ).trim();
        const detail = [
            dateLabel,
            actorName ? `by ${actorName}` : '',
        ].filter(Boolean).join(' ');

        if (detail) {
            return {
                label: 'Last updated',
                detail,
            };
        }

        return {
            label: 'Recorded automatically',
            detail: `CareAround SG records who saves this ${resourceLabel} and when.`,
        };
    }

    function renderSystemUpdateRecord(resourceLabel = isHard ? 'Place' : 'Offering') {
        const updateSummary = getSystemUpdateSummary(resourceLabel);
        return (
            <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                        <ShieldCheck size={20} />
                    </span>
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">System update record</p>
                        <h3 className="mt-1 text-base font-bold text-slate-900">{updateSummary.label}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{updateSummary.detail}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                            This replaces manual freshness entry; saving the resource keeps the recency record system-led.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    function getPlaceStepValidationError(stepIndex = activePlaceStep) {
        if (!isHard) return '';
        if (stepIndex === 0) {
            if (!String(form.name || '').trim()) return 'Add a place name to continue.';
            if (!String(form.subCategory || '').trim()) return 'Choose or create a place category to continue.';
            const profileContactMessage = getPlaceProfileContactValidationError();
            if (profileContactMessage) return profileContactMessage;
        }
        if (stepIndex === 1) {
            if (!String(form.country || '').trim()) return 'Choose a country to continue.';
            if (!String(form.postalCode || '').trim()) return 'Add a postal code to continue.';
            if (!String(form.address || '').trim()) return 'Add a street address to continue.';
        }
        return '';
    }

    function validatePlaceStep(stepIndex = activePlaceStep) {
        const message = getPlaceStepValidationError(stepIndex);
        setError(message);
        return !message;
    }

    function validateAllPlaceSteps() {
        for (const stepIndex of [0, 1]) {
            const message = getPlaceStepValidationError(stepIndex);
            if (message) {
                setActivePlaceStep(stepIndex);
                setError(message);
                return false;
            }
        }
        return true;
    }

    async function handlePlaceWizardSave() {
        if (!validateAllPlaceSteps()) return;
        await handleSubmit();
    }

    function getOfferingStepValidationError(stepIndex = activeOfferingStep) {
        if (isHard) return '';
        if (stepIndex === 0) {
            if (!String(form.name || '').trim()) return 'Add an offering name to continue.';
            if (!String(form.bucket || '').trim()) return 'Choose an offering bucket to continue.';
            if (!String(form.subCategory || '').trim()) return 'Choose an offering category to continue.';
            const profileContactMessage = getOfferingProfileContactValidationError();
            if (profileContactMessage) return profileContactMessage;
        }
        if (stepIndex === 2) {
            const locationIds = Array.isArray(form.locationIds) ? form.locationIds : [];
            const coverageRegionIds = Array.isArray(form.coverageRegionIds)
                ? form.coverageRegionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
                : [];
            const audienceZoneIds = Array.isArray(form.audienceZoneIds) ? form.audienceZoneIds : [];
            if (locationIds.length === 0 && coverageRegionIds.length === 0 && !(form.audienceMode === 'audience_zones' && audienceZoneIds.length > 0)) {
                return 'Select at least one service region or target area when no linked place is chosen.';
            }
            if (locationIds.length > 0 && linkedLocationSubregions.length > 1) {
                return 'Linked places must all belong to the same service area.';
            }
        }
        if (stepIndex === 3) {
            const audienceZoneIds = Array.isArray(form.audienceZoneIds) ? form.audienceZoneIds : [];
            if (form.audienceMode === 'partner_boundary' && form.ownershipMode !== 'partner') {
                return 'Managed-area audience is no longer available for new offerings. Use target areas instead.';
            }
            if (form.audienceMode === 'audience_zones' && audienceZoneIds.length === 0) {
                return 'Select at least one audience zone for audience-zone offerings.';
            }
            const eligibilityAgeMessage = getEligibilityAgeValidationError(form.eligibilityRules);
            if (eligibilityAgeMessage) return eligibilityAgeMessage;
        }
        return '';
    }

    function validateOfferingStep(stepIndex = activeOfferingStep) {
        const message = getOfferingStepValidationError(stepIndex);
        setError(message);
        return !message;
    }

    function validateAllOfferingSteps() {
        for (const stepIndex of [0, 2, 3]) {
            const message = getOfferingStepValidationError(stepIndex);
            if (message) {
                setActiveOfferingStep(stepIndex);
                setError(message);
                return false;
            }
        }
        return true;
    }

    async function handleOfferingWizardSave() {
        if (!validateAllOfferingSteps()) return;
        await handleSubmit();
    }

    function renderPlaceImportContext() {
        return (
            <>
                {importSource ? (
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

                <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
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

                {duplicateMatches.length > 0 ? (
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

                {importWarnings.length > 0 ? (
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
            </>
        );
    }

    function renderPlaceMediaFields() {
        return (
            <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        );
    }

    function renderPlaceProfileStep() {
        return (
            <div className="space-y-5">
                {renderPlaceImportContext()}
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            {renderPlaceMediaFields()}
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
                                Stable workbook identifier. Keep this unchanged after creation.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Name *</label>
                            <input required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Place name" className="input-field" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Category *</label>
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

                        <div className="md:col-span-2">
                            <MarkdownDescriptionField
                                id="place-description"
                                value={form.description || ''}
                                onChange={(value) => setField('description', value)}
                                rows={5}
                            />
                        </div>

                        <div className="md:col-span-2">
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
                        </div>

                        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-bold text-slate-900"><Globe size={13} className="inline mr-1" />Social media links</p>
                                    <p className="mt-1 text-xs text-slate-500">Optional public channels shown on the resource detail card.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {SOCIAL_PLATFORMS.map((platform) => {
                                        const href = normalizeExternalHref(normalizedSocialLinks[platform.key]);
                                        if (!href) return null;
                                        return (
                                            <a
                                                key={platform.key}
                                                href={href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-white px-2.5 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                                            >
                                                {platform.label}
                                                <ExternalLink size={12} />
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {SOCIAL_PLATFORMS.map((platform) => (
                                    <div key={platform.key}>
                                        <label className="mb-1 block text-xs font-bold text-slate-600">{platform.label}</label>
                                        <input
                                            type="url"
                                            value={form.socialLinks?.[platform.key] || ''}
                                            onChange={(e) => setSocialLink(platform.key, e.target.value)}
                                            placeholder={platform.placeholder}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Tags (Press enter to add)</label>
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
                </section>
            </div>
        );
    }

    function renderPlaceLocationStep() {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700"><Globe size={13} className="inline mr-1" />Country *</label>
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
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Postal code *</label>
                        <input required value={form.postalCode} onChange={(e) => setField('postalCode', e.target.value)} placeholder="680153" className="input-field" />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs md:col-span-2">
                        {hardSubregionResult.status === 'ok' ? (
                            <span className="font-medium text-green-700">Service area found: {hardSubregionResult.subregion.subregionCode || 'No code'} · {hardSubregionResult.subregion.name}</span>
                        ) : hardSubregionResult.status === 'ambiguous' ? (
                            <span className="text-amber-700">
                                Postal code matches multiple service areas. This place can still be saved and will use {preferredHardSubregion?.subregionCode || 'No code'} · {preferredHardSubregion?.name || 'the preferred service area'} for area-based management.
                            </span>
                        ) : hardSubregionResult.status === 'missing' && canUseHardSingaporeFallback ? (
                            <span className="text-amber-700">
                                Postal code will be checked against Singapore before saving and attached to {singaporeFallbackSubregion?.subregionCode || 'SIN'} · {singaporeFallbackSubregion?.name || 'Singapore'} if valid.
                            </span>
                        ) : hardSubregionResult.status === 'missing' ? (
                            <span className="text-red-700">Postal code does not match any configured service area.</span>
                        ) : (
                            <span className="text-slate-500">Enter a valid 6-digit postal code to place this resource in a service area automatically.</span>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-semibold text-slate-700"><MapPin size={13} className="inline mr-1" />Street Address *</label>
                        <input required value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="123 Main St" className="input-field" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700"><Phone size={13} className="inline mr-1" />Phone</label>
                        <input type="tel" value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} placeholder="(312) 555-0000" className="input-field" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700"><MessageCircle size={13} className="inline mr-1" />WhatsApp contact</label>
                        <input value={form.whatsappContact || ''} onChange={(e) => setField('whatsappContact', e.target.value)} placeholder="87654321 or https://wa.me/6587654321" className="input-field" />
                        <p className="mt-1 text-xs text-slate-500">Public contact only. This is not used for WhatsApp sign-in.</p>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700"><Clock size={13} className="inline mr-1" />Hours</label>
                        <input value={form.hours || ''} onChange={(e) => setField('hours', e.target.value)} placeholder="Mon-Fri 9am-5pm" className="input-field" />
                    </div>
                </div>
            </section>
        );
    }

    function renderPlaceVisibilityStep() {
        return (
            <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <Globe size={18} className="text-brand-600" />
                        Visibility Settings
                    </h3>
                    <div className="mt-5 space-y-5">
                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-700">Hide from App</p>
                                <p className="text-xs text-slate-500">Temporarily or permanently remove this Place from public discovery.</p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input type="checkbox" checked={Boolean(form.isHidden)} onChange={(e) => setField('isHidden', e.target.checked)} className="peer sr-only" />
                                <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full"></div>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Scheduled Hide (From)</label>
                                <input type="datetime-local" value={form.hideFrom} onChange={(e) => setField('hideFrom', e.target.value)} className="input-field text-sm" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Scheduled Hide (Until)</label>
                                <input type="datetime-local" value={form.hideUntil} onChange={(e) => setField('hideUntil', e.target.value)} className="input-field text-sm" />
                            </div>
                        </div>
                    </div>
                </section>

                {renderSystemUpdateRecord('Place')}
            </div>
        );
    }

    function renderSavedToolUnlockMessage(toolName) {
        const resourceLabel = isHard ? 'Place' : 'Offering';
        return (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <p className="text-base font-bold text-slate-900">Save this {resourceLabel} first</p>
                <p className="mt-1 text-sm text-slate-500">{toolName} can be managed after the {resourceLabel} exists.</p>
            </div>
        );
    }

    function renderPlaceAccessStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Access');
        return (
            <div data-resource-wizard-skip-validity className="rounded-3xl border border-slate-200 bg-white p-5">
                <AssetAccessPanel asset={initialData} assetType="hard" onChanged={onResourceToolsChanged} />
            </div>
        );
    }

    function renderPlaceZonesStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Audience zones');
        return (
            <div data-resource-wizard-skip-validity className="rounded-3xl border border-slate-200 bg-white p-5">
                <AssetAudienceZonesPanel asset={initialData} currentUser={currentUser} onChanged={onResourceToolsChanged} />
            </div>
        );
    }

    function renderPlaceTranslationStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Translation review');
        return (
            <div data-resource-wizard-skip-validity className="rounded-3xl border border-sky-200 bg-sky-50/50 p-5">
                <TranslationReviewPanel
                    resourceType="hard"
                    resourceId={initialData.id}
                />
            </div>
        );
    }

    function renderPlaceRestrictedStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Restricted notes and files');
        return (
            <div data-resource-wizard-skip-validity className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5">
                <PrivateResourceContentEditor
                    resourceType="hard"
                    resourceId={initialData.id}
                />
            </div>
        );
    }

    function renderPlaceStep(stepIndex) {
        if (stepIndex === 0) return renderPlaceProfileStep();
        if (stepIndex === 1) return renderPlaceLocationStep();
        if (stepIndex === 2) return renderPlaceVisibilityStep();
        if (stepIndex === 3) return renderPlaceAccessStep();
        if (stepIndex === 4) return renderPlaceZonesStep();
        if (stepIndex === 5) return renderPlaceTranslationStep();
        if (stepIndex === 6) return renderPlaceRestrictedStep();
        return null;
    }

    function renderPlacePreviewInfoRow({ icon, label, children }) {
        return (
            <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-xl bg-brand-50 p-2.5 text-brand-600">{icon}</div>
                <div className="min-w-0">
                    <p className="mb-1 font-bold text-slate-900">{label}</p>
                    <div className="break-words text-slate-700">{children}</div>
                </div>
            </div>
        );
    }

    function renderPlaceDetailPreview() {
        const socialEntries = SOCIAL_PLATFORMS
            .map((platform) => ({
                ...platform,
                url: normalizeExternalHref(form.socialLinks?.[platform.key]),
            }))
            .filter((entry) => entry.url);
        const tags = Array.isArray(form.newTags) ? form.newTags.slice(0, 8) : [];

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
                                <Building2 size={16} />
                                {form.subCategory || 'Place'}
                            </div>
                            <h1 className="text-3xl font-bold leading-tight text-slate-900">{form.name || 'Untitled Place'}</h1>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {form.address ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                                        <MapPin size={15} />
                                        {form.address}
                                    </span>
                                ) : null}
                                {form.postalCode ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700">
                                        {form.postalCode}
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
                        {form.hours ? renderPlacePreviewInfoRow({
                            icon: <Clock size={22} />,
                            label: 'Hours',
                            children: form.hours,
                        }) : null}
                        {form.phone ? renderPlacePreviewInfoRow({
                            icon: <Phone size={22} />,
                            label: 'Phone',
                            children: form.phone,
                        }) : null}
                        {form.whatsappContact ? renderPlacePreviewInfoRow({
                            icon: <MessageCircle size={22} />,
                            label: 'WhatsApp contact',
                            children: form.whatsappContact,
                        }) : null}
                        {websiteHref ? renderPlacePreviewInfoRow({
                            icon: <Globe size={22} />,
                            label: 'Website',
                            children: <span className="break-all text-brand-700">{form.website || websiteHref}</span>,
                        }) : null}
                        {socialEntries.length > 0 ? renderPlacePreviewInfoRow({
                            icon: <Globe size={22} />,
                            label: 'Social channels',
                            children: (
                                <div className="flex flex-wrap gap-2">
                                    {socialEntries.map((entry) => (
                                        <span key={entry.key} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-700">
                                            {entry.label}
                                        </span>
                                    ))}
                                </div>
                            ),
                        }) : null}
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

    function renderOfferingMediaFields() {
        return (
            <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        );
    }

    function renderOfferingProfileStep() {
        return (
            <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            {renderOfferingMediaFields()}
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
                                Stable workbook identifier. Keep this unchanged after creation.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Name *</label>
                            <input required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Offering name" className="input-field" />
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
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Category *</label>
                            <select required value={form.subCategory || 'Programmes'} onChange={(e) => setField('subCategory', e.target.value)} className="input-field">
                                {availableSubCategories.filter((subcategory) => subcategory.type === 'soft').map((subcategory) => (
                                    <option key={subcategory.id} value={subcategory.name}>{subcategory.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <MarkdownDescriptionField
                                id="offering-description"
                                value={form.description || ''}
                                onChange={(value) => setField('description', value)}
                                rows={5}
                            />
                        </div>

                        <div className="md:col-span-2">
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
                        </div>

                        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-bold text-slate-900"><Globe size={13} className="inline mr-1" />Social media links</p>
                                    <p className="mt-1 text-xs text-slate-500">Optional public channels shown on the resource detail card.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {SOCIAL_PLATFORMS.map((platform) => {
                                        const href = normalizeExternalHref(normalizedSocialLinks[platform.key]);
                                        if (!href) return null;
                                        return (
                                            <a
                                                key={platform.key}
                                                href={href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-white px-2.5 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                                            >
                                                {platform.label}
                                                <ExternalLink size={12} />
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {SOCIAL_PLATFORMS.map((platform) => (
                                    <div key={platform.key}>
                                        <label className="mb-1 block text-xs font-bold text-slate-600">{platform.label}</label>
                                        <input
                                            type="url"
                                            value={form.socialLinks?.[platform.key] || ''}
                                            onChange={(e) => setSocialLink(platform.key, e.target.value)}
                                            placeholder={platform.placeholder}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="mb-4 flex items-center gap-2">
                                <MessageCircle size={16} className="text-brand-600" />
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">Public contact and action details</h3>
                                    <p className="text-xs text-slate-500">Optional public details shown on this offering. WhatsApp contact is not used for sign-in.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Contact phone</label>
                                    <input
                                        value={form.contactPhone || ''}
                                        onChange={(e) => setField('contactPhone', e.target.value)}
                                        placeholder="+65 6123 4567"
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">WhatsApp contact</label>
                                    <input
                                        value={form.whatsappContact || ''}
                                        onChange={(e) => setField('whatsappContact', e.target.value)}
                                        placeholder="87654321 or https://wa.me/6587654321"
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Contact email</label>
                                    <input
                                        type="email"
                                        value={form.contactEmail || ''}
                                        onChange={(e) => setField('contactEmail', e.target.value)}
                                        placeholder="info@example.org"
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Action button label</label>
                                    <input
                                        value={form.ctaLabel || ''}
                                        onChange={(e) => setField('ctaLabel', e.target.value)}
                                        placeholder="Register now"
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Action button link</label>
                                    <input
                                        type="url"
                                        value={form.ctaUrl || ''}
                                        onChange={(e) => setField('ctaUrl', e.target.value)}
                                        placeholder="https://..."
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Venue note</label>
                                    <input
                                        value={form.venueNote || ''}
                                        onChange={(e) => setField('venueNote', e.target.value)}
                                        placeholder="Level 2 studio room"
                                        className="input-field"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Tags (Press enter to add)</label>
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
                </section>
            </div>
        );
    }

    function renderOfferingScheduleStep() {
        return (
            <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700"><Clock size={13} className="inline mr-1" />Schedule</label>
                            <textarea
                                rows={4}
                                value={form.schedule || ''}
                                onChange={(e) => setField('schedule', e.target.value)}
                                placeholder="e.g. Every Tuesday at 10 AM"
                                className="input-field"
                            />
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
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
                                <p className="mt-1 text-xs text-slate-500">Optional. If left blank, public cards will fall back to "available".</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <EyeOff size={18} className="text-red-500" />
                        Hide window
                    </h3>
                    <div className="mt-5 space-y-5">
                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-700">Hide from App</p>
                                <p className="text-xs text-slate-500">Temporarily or permanently remove from discovery.</p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input type="checkbox" checked={Boolean(form.isHidden)} onChange={(e) => setField('isHidden', e.target.checked)} className="peer sr-only" />
                                <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full"></div>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Scheduled Hide (From)</label>
                                <input type="datetime-local" value={form.hideFrom} onChange={(e) => setField('hideFrom', e.target.value)} className="input-field text-sm" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Scheduled Hide (Until)</label>
                                <input type="datetime-local" value={form.hideUntil} onChange={(e) => setField('hideUntil', e.target.value)} className="input-field text-sm" />
                            </div>
                        </div>
                    </div>
                </section>

                {renderSystemUpdateRecord('Offering')}
            </div>
        );
    }

    function renderOfferingHostCoverageStep() {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="grid grid-cols-1 gap-5">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Host Locations (Optional)</label>
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

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {selectedLinkedLocations.length > 0 ? (
                            linkedLocationSubregions.length === 1 && derivedSoftSubregion ? (
                                <span className="font-medium text-green-700">Service area found from linked places: {derivedSoftSubregion.subregionCode || 'No code'} · {derivedSoftSubregion.name}</span>
                            ) : (
                                <span className="text-amber-700">Linked places span multiple service areas. Keep linked places within one service area.</span>
                            )
                        ) : (
                            <span>Select a service area below when the offering is not linked to a place.</span>
                        )}
                    </div>

                    {selectedLinkedLocations.length === 0 ? (
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Service regions</label>
                            <Select
                                isMulti
                                options={coverageRegionOptions}
                                value={selectedCoverageRegionOptions}
                                onChange={(selected) => {
                                    const ids = Array.isArray(selected) ? selected.map((item) => item.value) : [];
                                    setForm((prev) => ({
                                        ...prev,
                                        coverageRegionIds: ids,
                                        subregionId: ids[0] || '',
                                    }));
                                }}
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder="Select one or more service regions..."
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Standalone services can cover multiple overlapping Regions, or use target areas below for audience-zone-only visibility.
                            </p>
                        </div>
                    ) : null}
                </div>
            </section>
        );
    }

    function renderOfferingVisibilityStep() {
        return (
            <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <Globe size={18} className="text-brand-600" />
                        Visibility Settings
                    </h3>

                    <div className="mt-5 space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Who can see this?</label>
                                <select value={form.audienceMode || 'public'} onChange={(e) => setField('audienceMode', e.target.value)} className="input-field">
                                    <option value="public">Public</option>
                                    <option value="audience_zones">Target areas</option>
                                </select>
                                <p className="mt-1 text-xs text-slate-500">
                                    Public offerings are open to everyone. Target-area offerings show only in selected postal-code areas.
                                </p>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">For linked members</p>
                                    <p className="text-xs text-slate-500">Require users to be signed in and linked before they can view this offering.</p>
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input type="checkbox" checked={Boolean(form.isMemberOnly)} onChange={(e) => setField('isMemberOnly', e.target.checked)} className="peer sr-only" />
                                    <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>
                        </div>

                        {form.audienceMode === 'audience_zones' ? (
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Audience Zones</label>
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
                    </div>
                </section>

                <EligibilityRulesEditor
                    value={form.eligibilityRules}
                    onChange={(rules) => setField('eligibilityRules', rules)}
                />
            </div>
        );
    }

    function renderOfferingAccessStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Access');

        if (isOfferingLinkedToHostPlace) {
            return (
                <div className="rounded-3xl border border-brand-100 bg-brand-50/70 p-5">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Access is inherited from the host Place</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                This offering is linked to {selectedLinkedLocations.length === 1 ? selectedLinkedLocations[0].name : 'host Places'}, so Owners and Staff should be managed on the host Place access tab.
                            </p>
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                                Direct standalone Offering access is available only when no host Place is linked.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-700"><Users size={13} /> Ownership</label>
                            <select value={form.ownershipMode} onChange={(e) => setField('ownershipMode', e.target.value)} className="input-field">
                                {OWNERSHIP_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Access source</label>
                            <input value="Direct offering access or linked place access" readOnly className="input-field bg-slate-50" />
                        </div>
                    </div>
                </section>

                {!isOfferingLinkedToHostPlace ? (
                    <div data-resource-wizard-skip-validity className="rounded-3xl border border-slate-200 bg-white p-5">
                        <AssetAccessPanel asset={initialData} assetType="soft" onChanged={onResourceToolsChanged} />
                    </div>
                ) : null}
            </div>
        );
    }

    function renderOfferingTranslationStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Translation review');
        return (
            <div data-resource-wizard-skip-validity className="rounded-3xl border border-sky-200 bg-sky-50/50 p-5">
                <TranslationReviewPanel
                    resourceType="soft"
                    resourceId={initialData.id}
                />
            </div>
        );
    }

    function renderOfferingRestrictedStep() {
        if (!initialData?.id) return renderSavedToolUnlockMessage('Restricted notes and files');
        return (
            <div data-resource-wizard-skip-validity className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5">
                <PrivateResourceContentEditor
                    resourceType="soft"
                    resourceId={initialData.id}
                />
            </div>
        );
    }

    function renderOfferingStep(stepIndex) {
        if (stepIndex === 0) return renderOfferingProfileStep();
        if (stepIndex === 1) return renderOfferingScheduleStep();
        if (stepIndex === 2) return renderOfferingHostCoverageStep();
        if (stepIndex === 3) return renderOfferingVisibilityStep();
        if (stepIndex === 4) return renderOfferingAccessStep();
        if (stepIndex === 5) return renderOfferingTranslationStep();
        if (stepIndex === 6) return renderOfferingRestrictedStep();
        return null;
    }

    function renderOfferingDetailPreview() {
        const tags = Array.isArray(form.newTags) ? form.newTags.slice(0, 8) : [];
        const ctaHref = normalizeExternalHref(form.ctaUrl);
        const selectedCoverageLabels = selectedLinkedLocations.length > 0
            ? selectedLinkedLocations.map((location) => location.name).filter(Boolean)
            : selectedCoverageRegionOptions.map((option) => option.label);
        const availabilityText = form.availabilityEnabled
            ? `${normalizeAvailabilityCount(form.availabilityCount)} ${normalizeAvailabilityUnit(form.availabilityUnit) || 'available'}`.trim()
            : '';

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
                                <Package2 size={16} />
                                {form.bucket || 'Programmes'} · {form.subCategory || 'Offering'}
                            </div>
                            <h1 className="text-3xl font-bold leading-tight text-slate-900">{form.name || 'Untitled Offering'}</h1>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {form.schedule ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                                        <Clock size={15} />
                                        Scheduled
                                    </span>
                                ) : null}
                                {availabilityText ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                                        <Package2 size={15} />
                                        {availabilityText}
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
                        {form.schedule ? renderPlacePreviewInfoRow({
                            icon: <Clock size={22} />,
                            label: 'Schedule',
                            children: form.schedule,
                        }) : null}
                        {form.contactPhone ? renderPlacePreviewInfoRow({
                            icon: <Phone size={22} />,
                            label: 'Phone',
                            children: form.contactPhone,
                        }) : null}
                        {form.whatsappContact ? renderPlacePreviewInfoRow({
                            icon: <MessageCircle size={22} />,
                            label: 'WhatsApp contact',
                            children: form.whatsappContact,
                        }) : null}
                        {form.contactEmail ? renderPlacePreviewInfoRow({
                            icon: <MessageCircle size={22} />,
                            label: 'Email',
                            children: form.contactEmail,
                        }) : null}
                        {ctaHref ? renderPlacePreviewInfoRow({
                            icon: <Globe size={22} />,
                            label: form.ctaLabel || 'Action link',
                            children: <span className="break-all text-brand-700">{form.ctaUrl || ctaHref}</span>,
                        }) : null}
                        {selectedCoverageLabels.length > 0 ? renderPlacePreviewInfoRow({
                            icon: <MapPin size={22} />,
                            label: selectedLinkedLocations.length > 0 ? 'Host places' : 'Service regions',
                            children: selectedCoverageLabels.join(', '),
                        }) : null}
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

    if (isHard) {
        return (
            <ResourceWizardShell
                steps={PLACE_STEPS}
                activeStep={activePlaceStep}
                setActiveStep={setActivePlaceStep}
                validateStep={validatePlaceStep}
                error={error}
                renderStep={renderPlaceStep}
                onCancel={() => onCancel(form)}
                onSave={handlePlaceWizardSave}
                saving={saving}
                saveLabel="Save Place"
                savingLabel="Saving..."
                previewTitle="Place detail preview"
                previewDescription="Unsaved edits shown as a public resource detail page."
                renderPreview={renderPlaceDetailPreview}
            />
        );
    }

    return (
        <ResourceWizardShell
            steps={OFFERING_STEPS}
            activeStep={activeOfferingStep}
            setActiveStep={setActiveOfferingStep}
            validateStep={validateOfferingStep}
            error={error}
            renderStep={renderOfferingStep}
            onCancel={() => onCancel(form)}
            onSave={handleOfferingWizardSave}
            saving={saving}
            saveLabel="Save Offering"
            savingLabel="Saving..."
            previewTitle="Offering detail preview"
            previewDescription="Unsaved edits shown as a public offering detail page."
            renderPreview={renderOfferingDetailPreview}
        />
    );

}
