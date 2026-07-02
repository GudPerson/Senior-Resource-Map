import { getAssetAudienceZones } from './audienceZones.js';
import { normalizeRole } from './roles.js';
import {
    getSoftAssetLocations,
    isChildSoftAsset,
    normalizeOverrideFields,
    SOFT_ASSET_MODES,
} from './softAssetHierarchy.js';
import {
    buildGroupDiscoverMetadata,
    buildGroupMemberSummary,
    buildGroupReadiness,
    getPublicGroupMemberEntries,
    isGroupSoftAsset,
} from './softAssetGroups.js';

function formatLocationSummary(location) {
    if (!location) return null;
    const partnerRole = location.partner?.role ? normalizeRole(location.partner.role) : null;

    return {
        id: location.id,
        name: location.name,
        address: location.address,
        country: location.country || null,
        postalCode: location.postalCode,
        subregionId: location.subregionId || null,
        subCategory: location.subCategory,
        logoUrl: location.logoUrl || null,
        partnerId: location.partnerId || null,
        partnerName: location.partner?.name || null,
        partnerRole,
        matchingRegionIds: Array.isArray(location.matchingRegionIds) ? location.matchingRegionIds : [],
    };
}

export function formatSoftAssetListSummary(asset, options = {}) {
    const partnerRole = asset?.partner?.role ? normalizeRole(asset.partner.role) : null;
    const resolvedAudienceZones = getAssetAudienceZones(asset);
    const locations = getSoftAssetLocations(asset)
        .map(formatLocationSummary)
        .filter(Boolean);
    const location = locations[0] || null;
    const hostLocation = isChildSoftAsset(asset) ? location : null;
    const isGroup = isGroupSoftAsset(asset);
    const groupMemberSummary = isGroup ? buildGroupMemberSummary(asset) : null;
    const groupDiscoverMetadata = isGroup ? buildGroupDiscoverMetadata(asset) : null;
    const groupReadiness = isGroup ? buildGroupReadiness(asset) : null;

    return {
        id: asset.id,
        externalKey: asset.externalKey || null,
        partnerId: asset.partnerId || null,
        subregionId: asset.subregionId || null,
        assetMode: asset.assetMode || SOFT_ASSET_MODES.STANDALONE,
        parentSoftAssetId: asset.parentSoftAssetId || null,
        hostHardAssetId: asset.hostHardAssetId || null,
        name: asset.name,
        bucket: asset.bucket || null,
        subCategory: asset.subCategory,
        description: asset.description || null,
        schedule: asset.schedule || null,
        logoUrl: asset.logoUrl || null,
        bannerUrl: asset.bannerUrl || null,
        audienceMode: asset.audienceMode || 'public',
        isMemberOnly: Boolean(asset.isMemberOnly),
        overriddenFields: normalizeOverrideFields(asset.overriddenFields),
        contactPhone: asset.contactPhone || null,
        whatsappContact: asset.whatsappContact || null,
        contactEmail: asset.contactEmail || null,
        ctaLabel: asset.ctaLabel || null,
        ctaUrl: asset.ctaUrl || null,
        venueNote: asset.venueNote || null,
        availabilityEnabled: Boolean(asset.availabilityEnabled),
        availabilityCount: Number(asset.availabilityCount || 0),
        availabilityUnit: asset.availabilityUnit || null,
        lastReviewedAt: asset.lastReviewedAt || null,
        lastVerifiedByUserId: asset.lastVerifiedByUserId || null,
        sourceType: asset.sourceType || null,
        verificationStatus: asset.verificationStatus || 'unverified',
        verificationConfidence: asset.verificationConfidence || null,
        isHidden: Boolean(asset.isHidden),
        hideFrom: asset.hideFrom || null,
        hideUntil: asset.hideUntil || null,
        updatedAt: asset.updatedAt || null,
        partnerName: asset.partner?.name || null,
        partnerRole,
        ownershipMode: asset.partnerId ? 'partner' : 'system',
        tags: Array.isArray(asset.tags) ? asset.tags.map((entry) => entry.tag?.name).filter(Boolean) : [],
        audienceZones: resolvedAudienceZones,
        audienceZoneIds: resolvedAudienceZones.map((zone) => zone.id),
        parentSummary: asset.parent ? { id: asset.parent.id, name: asset.parent.name } : null,
        locations,
        location,
        hostLocation,
        ...(isGroup ? {
            galleryUrls: Array.isArray(asset.galleryUrls) ? asset.galleryUrls : [],
            website: asset.website || null,
            socialLinks: asset.socialLinks || {},
            creatorName: asset.creator?.name || null,
            updatedByName: asset.updater?.name || asset.creator?.name || null,
            groupMemberSummary,
            groupDiscoverMetadata,
            groupReadinessStatus: groupReadiness.status,
            groupOwnerCount: groupReadiness.ownerCount,
            isDiscoverReady: groupReadiness.isDiscoverReady,
            selectedGroupMemberCount: Array.isArray(asset.groupMembers) ? asset.groupMembers.length : 0,
            publicGroupMemberCount: getPublicGroupMemberEntries(asset).length,
        } : {}),
        coverageRegionIds: asset.coverageRegionIds || [],
        matchingRegionIds: asset.matchingRegionIds || asset.coverageRegionIds || [],
        primaryRegionId: asset.subregionId || null,
        boundaryStatus: options.boundaryStatus || 'no-boundary',
        organizationLinks: Array.isArray(options.organizationLinks) ? options.organizationLinks : [],
        permissions: options.permissions || {
            canEdit: false,
            canManageAccess: false,
            canDelete: false,
            canHide: false,
        },
    };
}
