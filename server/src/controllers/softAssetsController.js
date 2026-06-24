import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { hardAssets, softAssetGroupMembers, softAssetRegionCoverages, softAssets, softAssetLocations, softAssetStaffMemberships, subregionPostalCodes, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    assertManageableAudienceZones,
    getAssetAudienceZones,
    normalizeAudienceZoneIds,
    resolveStandardAudienceZoneIds,
    syncSoftAssetAudienceZones,
} from '../utils/audienceZones.js';
import { actorCanManageAsset } from '../utils/ownership.js';
import { hasAnyHardAssetStaffAccess } from '../utils/hardAssetStaff.js';
import { hasSoftAssetStaffAccess, normalizeSoftAssetStaffRole } from '../utils/softAssetAccess.js';
import { hasAnyPartnerStaffAccess } from '../utils/partnerStaff.js';
import { buildEligibilityContext, buildMembershipHostIdMap, getOfferingAccessMetadata, normalizeEligibilityRules, shouldExposeOfferingToViewer } from '../utils/eligibility.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { formatSoftAssetListSummary } from '../utils/softAssetListSummary.js';
import { loadSingaporeFallbackRegion } from '../utils/singaporePostalFallback.js';
import { isAssetVisible } from '../utils/visibility.js';
import {
    buildResourceListPagination,
    filterSoftAssetsForResourceList,
    getDirectManagedHardAssetIds,
    getDirectManagedSoftAssetIds,
    isStandardDirectResourceOperator,
    normalizeResourceListPagination,
    normalizeResourceListScope,
    paginateResourceList,
    shouldUseDirectManagedResourcePagination,
} from '../utils/resourceListScope.js';
import { loadOrganizationContextsForResources } from '../utils/organizationResourceContext.js';
import {
    attachHardAssetRegionMatches,
    attachStandaloneSoftAssetCoverage,
} from '../utils/regionScope.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { loadScopedBoundaryContext, resolveSoftAssetBoundaryStatus } from '../utils/subregionBoundaryStatus.js';
import {
    buildChildEditablePatch,
    buildChildOverrideResetPatch,
    getSoftAssetLocations,
    isChildSoftAsset,
    normalizeGalleryUrls,
    normalizeOverrideFields,
    SOFT_ASSET_MODES,
} from '../utils/softAssetHierarchy.js';
import {
    buildGroupDiscoverMetadata,
    buildGroupReadiness,
    buildPublicGroupPayload,
    getGroupMemberAsset,
    getGroupMemberType,
    getPublicGroupMemberEntries,
    GROUP_MEMBER_TYPES,
    isDiscoverReadyGroup,
    isGroupSoftAsset,
    isPublicGroupMemberEntry,
} from '../utils/softAssetGroups.js';
import { normalizeSoftAssetBucket } from '../utils/softAssetBuckets.js';
import { resolveOrCreateExternalKey } from '../utils/externalKeys.js';
import {
    determineSoftSubregion,
    ensureActorCanTargetSubregion,
    ensureActorCanManageLinkedHardAssets,
    getCacheRegionId,
    loadHardAssetsByIds,
    normalizeAudienceMode,
    parseLinkedHardAssetIds,
    resolveAssetOwner,
} from '../utils/softAssetScope.js';
import {
    attachTranslations,
    loadTranslationsForResources,
    syncResourceTranslations,
} from '../utils/resourceTranslations.js';
import {
    cleanOneLineText,
    cleanOptionalOneLineText,
    cleanOptionalText,
    cleanTagList,
    normalizeUrlText,
} from '../utils/inputValidation.js';
import {
    buildResourceAuditPayload,
    diffAuditFieldNames,
    isResourceVisibilityAction,
    loadResourceAuditOrganizationId,
    safelyRecordAuditLog,
} from '../utils/auditTrail.js';
import { shouldGrantCreatorDefaultSoftAssetOwner } from '../utils/assetCreatorOwnership.js';

async function recordSoftAssetAudit(db, actor, asset, action, changedFields = [], metadata = {}) {
    if (!asset?.id) return;
    const organizationId = await loadResourceAuditOrganizationId(db, 'soft', asset.id);
    await safelyRecordAuditLog(db, actor, buildResourceAuditPayload({
        action,
        resourceType: 'soft',
        resourceId: asset.id,
        resourceName: asset.name,
        organizationId,
        changedFields,
        metadata,
    }));
}
import { buildSoftAssetSearchWhere } from '../utils/softAssetSearch.js';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function normalizeVerificationDate(value) {
    if (value === undefined) return undefined;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw clientError('Last reviewed date is invalid.');
    }
    return date;
}

function normalizeVerificationConfidence(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw clientError('Verification confidence must be between 0 and 100.');
    }
    return String(Math.round(parsed));
}

function buildFreshnessInsert(body, user) {
    const lastReviewedAt = normalizeVerificationDate(body.lastReviewedAt);
    return {
        lastReviewedAt: lastReviewedAt === undefined ? null : lastReviewedAt,
        lastVerifiedByUserId: lastReviewedAt ? user?.id || null : null,
        sourceType: cleanOptionalOneLineText(body.sourceType, 80) || null,
        verificationStatus: cleanOptionalOneLineText(body.verificationStatus, 40) || 'unverified',
        verificationConfidence: normalizeVerificationConfidence(body.verificationConfidence) ?? null,
    };
}

function buildFreshnessUpdate(body, existing, user) {
    const lastReviewedAt = normalizeVerificationDate(body.lastReviewedAt);
    const verificationConfidence = normalizeVerificationConfidence(body.verificationConfidence);
    return {
        lastReviewedAt: lastReviewedAt !== undefined ? lastReviewedAt : existing.lastReviewedAt,
        lastVerifiedByUserId: lastReviewedAt !== undefined
            ? (lastReviewedAt ? user?.id || existing.lastVerifiedByUserId || null : null)
            : existing.lastVerifiedByUserId,
        sourceType: body.sourceType !== undefined ? (cleanOptionalOneLineText(body.sourceType, 80) || null) : existing.sourceType,
        verificationStatus: body.verificationStatus !== undefined ? (cleanOptionalOneLineText(body.verificationStatus, 40) || 'unverified') : existing.verificationStatus,
        verificationConfidence: verificationConfidence !== undefined ? verificationConfidence : existing.verificationConfidence,
    };
}

const softAssetWithRelations = {
    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
    creator: { columns: { id: true, name: true } },
    parent: {
        columns: {
            id: true,
            name: true,
            bucket: true,
            subCategory: true,
            description: true,
            schedule: true,
            logoUrl: true,
            bannerUrl: true,
            galleryUrls: true,
            audienceMode: true,
            isMemberOnly: true,
            eligibilityRules: true,
            tags: true,
        },
        with: {
            audienceZones: {
                with: {
                    audienceZone: {
                        columns: {
                            id: true,
                            zoneCode: true,
                            name: true,
                            partnerUserId: true,
                        },
                    },
                },
            },
        },
    },
    hostHardAsset: {
        with: {
            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
        },
    },
    audienceZones: {
        with: {
            audienceZone: {
                columns: {
                    id: true,
                    zoneCode: true,
                    name: true,
                    partnerUserId: true,
                },
            },
        },
    },
    tags: { with: { tag: true } },
    staffMemberships: {
        columns: {
            id: true,
            staffRole: true,
            revokedAt: true,
        },
    },
    locations: {
        with: {
            hardAsset: {
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                },
            },
        },
    },
    groupMembers: {
        with: {
            hardAsset: {
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                },
            },
            softAsset: {
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                    hostHardAsset: {
                        with: {
                            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                        },
                    },
                    locations: {
                        with: {
                            hardAsset: {
                                with: {
                                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                                },
                            },
                        },
                    },
                    tags: { with: { tag: true } },
                },
            },
        },
    },
};

const softAssetListSummaryRelations = {
    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
    parent: {
        columns: {
            id: true,
            name: true,
        },
        with: {
            audienceZones: {
                with: {
                    audienceZone: {
                        columns: {
                            id: true,
                            zoneCode: true,
                            name: true,
                            partnerUserId: true,
                        },
                    },
                },
            },
        },
    },
    hostHardAsset: {
        columns: {
            id: true,
            name: true,
            address: true,
            country: true,
            postalCode: true,
            subregionId: true,
            subCategory: true,
            logoUrl: true,
            partnerId: true,
            isHidden: true,
            hideFrom: true,
            hideUntil: true,
            isDeleted: true,
        },
        with: {
            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
        },
    },
    audienceZones: {
        with: {
            audienceZone: {
                columns: {
                    id: true,
                    zoneCode: true,
                    name: true,
                    partnerUserId: true,
                },
            },
        },
    },
    tags: { with: { tag: true } },
    staffMemberships: {
        columns: {
            id: true,
            staffRole: true,
            revokedAt: true,
        },
    },
    locations: {
        columns: {
            softAssetId: true,
            hardAssetId: true,
        },
        with: {
            hardAsset: {
                columns: {
                    id: true,
                    name: true,
                    address: true,
                    country: true,
                    postalCode: true,
                    subregionId: true,
                    subCategory: true,
                    logoUrl: true,
                    partnerId: true,
                    isHidden: true,
                    hideFrom: true,
                    hideUntil: true,
                    isDeleted: true,
                },
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                },
            },
        },
    },
    groupMembers: {
        columns: {
            id: true,
            groupSoftAssetId: true,
            memberResourceType: true,
            memberResourceId: true,
            sortOrder: true,
        },
        with: {
            hardAsset: {
                columns: {
                    id: true,
                    name: true,
                    address: true,
                    country: true,
                    postalCode: true,
                    lat: true,
                    lng: true,
                    subregionId: true,
                    subCategory: true,
                    logoUrl: true,
                    partnerId: true,
                    isHidden: true,
                    hideFrom: true,
                    hideUntil: true,
                    isDeleted: true,
                },
            },
            softAsset: {
                columns: {
                    id: true,
                    name: true,
                    assetMode: true,
                    bucket: true,
                    subCategory: true,
                    description: true,
                    logoUrl: true,
                    audienceMode: true,
                    isMemberOnly: true,
                    isHidden: true,
                    hideFrom: true,
                    hideUntil: true,
                    isDeleted: true,
                    hostHardAssetId: true,
                },
                with: {
                    hostHardAsset: {
                        columns: {
                            id: true,
                            name: true,
                            address: true,
                            country: true,
                            postalCode: true,
                            lat: true,
                            lng: true,
                            subregionId: true,
                            subCategory: true,
                            logoUrl: true,
                            isHidden: true,
                            hideFrom: true,
                            hideUntil: true,
                            isDeleted: true,
                        },
                    },
                    locations: {
                        columns: {
                            softAssetId: true,
                            hardAssetId: true,
                        },
                        with: {
                            hardAsset: {
                                columns: {
                                    id: true,
                                    name: true,
                                    address: true,
                                    country: true,
                                    postalCode: true,
                                    lat: true,
                                    lng: true,
                                    subregionId: true,
                                    subCategory: true,
                                    logoUrl: true,
                                    isHidden: true,
                                    hideFrom: true,
                                    hideUntil: true,
                                    isDeleted: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

function isQueryFlagEnabled(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function normalizeAvailabilityEnabled(value) {
    return Boolean(value);
}

function normalizeAvailabilityCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return parsed;
}

function normalizeAvailabilityUnit(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function normalizeCoverageRegionIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .map((entry) => Number.parseInt(String(entry), 10))
            .filter((entry) => Number.isInteger(entry) && entry > 0)
    )];
}

function normalizeGroupAudienceMode(value) {
    const mode = String(value || 'public').trim().toLowerCase() || 'public';
    if (mode === 'public' || mode === 'target_regions') return mode;
    throw clientError('Invalid Group visibility mode.', 400);
}

function getRequestedCoverageRegionIds(body = {}) {
    return normalizeCoverageRegionIds(
        body.coverageRegionIds ?? body.regionIds ?? body.serviceRegionIds ?? []
    );
}

function hasCoverageRegionPatch(body = {}) {
    return Object.prototype.hasOwnProperty.call(body, 'coverageRegionIds')
        || Object.prototype.hasOwnProperty.call(body, 'regionIds')
        || Object.prototype.hasOwnProperty.call(body, 'serviceRegionIds');
}

function getExplicitSubregionId(body = {}) {
    const parsed = Number.parseInt(String(body?.subregionId ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasExplicitSubregionId(body = {}) {
    return Number.isInteger(getExplicitSubregionId(body));
}

function withCoverageSubregionFallback(body = {}, linkedIds = [], coverageRegionIds = []) {
    if (linkedIds.length > 0 || hasExplicitSubregionId(body) || coverageRegionIds.length === 0) {
        return body;
    }
    return {
        ...body,
        subregionId: coverageRegionIds[0],
    };
}

function uniqueSortedIntegerList(values = []) {
    return [...new Set(
        values
            .map((value) => Number.parseInt(String(value), 10))
            .filter((value) => Number.isInteger(value) && value > 0)
    )].sort((left, right) => left - right);
}

async function syncSoftAssetRegionCoverages(db, softAssetId, regionIds = [], actor) {
    const ids = normalizeCoverageRegionIds(regionIds);
    await db.delete(softAssetRegionCoverages).where(eq(softAssetRegionCoverages.softAssetId, softAssetId));

    if (ids.length === 0) return;

    await db.insert(softAssetRegionCoverages).values(
        ids.map((subregionId) => ({
            softAssetId,
            subregionId,
            createdByUserId: actor?.id || null,
        }))
    ).onConflictDoNothing();
}

function assertManageableCoverageRegions(actor, regionIds = []) {
    for (const regionId of normalizeCoverageRegionIds(regionIds)) {
        ensureActorCanTargetSubregion(actor, regionId);
    }
}

function sanitizeSoftAssetPayload(body = {}) {
    return {
        ...body,
        externalKey: cleanOptionalOneLineText(body.externalKey, 160) || undefined,
        name: cleanOneLineText(body.name, 255),
        bucket: cleanOptionalOneLineText(body.bucket, 40),
        subCategory: cleanOneLineText(body.subCategory || 'Programmes', 80),
        description: cleanOptionalText(body.description, 10000),
        schedule: cleanOptionalText(body.schedule, 6000),
        logoUrl: normalizeUrlText(body.logoUrl, 2000),
        bannerUrl: normalizeUrlText(body.bannerUrl, 2000),
        galleryUrls: Array.isArray(body.galleryUrls)
            ? body.galleryUrls.map((url) => normalizeUrlText(url, 2000)).filter(Boolean).slice(0, 12)
            : [],
        newTags: cleanTagList(body.newTags),
        contactPhone: cleanOptionalOneLineText(body.contactPhone, 50),
        whatsappContact: cleanOptionalOneLineText(body.whatsappContact, 255),
        contactEmail: cleanOptionalOneLineText(body.contactEmail, 255),
        ctaLabel: cleanOptionalOneLineText(body.ctaLabel, 255),
        ctaUrl: normalizeUrlText(body.ctaUrl, 2000),
        venueNote: cleanOptionalText(body.venueNote, 3000),
        availabilityUnit: cleanOptionalOneLineText(body.availabilityUnit, 80),
    };
}

function sanitizeSoftAssetPatch(body = {}) {
    const full = sanitizeSoftAssetPayload(body);
    const patch = { ...body };
    [
        'externalKey',
        'name',
        'bucket',
        'subCategory',
        'description',
        'schedule',
        'logoUrl',
        'bannerUrl',
        'galleryUrls',
        'newTags',
        'contactPhone',
        'whatsappContact',
        'contactEmail',
        'ctaLabel',
        'ctaUrl',
        'venueNote',
        'availabilityUnit',
    ].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            patch[field] = full[field];
        }
    });
    return patch;
}

function formatSoftAsset(asset, boundaryContext, viewer, allowedPartnerAudienceIds, allowedAudienceZoneIds) {
    const allLocations = getSoftAssetLocations(asset);
    const visibleLocations = allLocations
        .filter((location) => isAssetVisible(location, viewer, { ownerPartner: location.partner, allowedPartnerAudienceIds, allowedAudienceZoneIds }));
    const { parent, hostHardAsset, tags, locations, audienceZones, groupMembers, ...assetRest } = asset;
    const resolvedAudienceZones = getAssetAudienceZones(asset);
    const groupPayload = isGroupSoftAsset(asset) ? buildPublicGroupPayload(asset) : null;
    const groupMetadata = isGroupSoftAsset(asset) ? buildGroupDiscoverMetadata(asset) : null;
    const groupReadiness = isGroupSoftAsset(asset) ? buildGroupReadiness(asset) : null;

    return {
        ...assetRest,
        assetMode: asset.assetMode || SOFT_ASSET_MODES.STANDALONE,
        partnerName: asset.partner?.name || null,
        partnerRole: asset.partner?.role ? normalizeRole(asset.partner.role) : null,
        ownershipMode: asset.partnerId ? 'partner' : 'system',
        creatorName: asset.creator?.name || null,
        audienceMode: asset.audienceMode || 'public',
        tags: asset.tags.map((entry) => entry.tag.name),
        audienceZones: resolvedAudienceZones,
        audienceZoneIds: resolvedAudienceZones.map((zone) => zone.id),
        overriddenFields: normalizeOverrideFields(asset.overriddenFields),
        availabilityEnabled: normalizeAvailabilityEnabled(asset.availabilityEnabled),
        availabilityCount: normalizeAvailabilityCount(asset.availabilityCount),
        availabilityUnit: normalizeAvailabilityUnit(asset.availabilityUnit),
        parentSummary: asset.parent ? { id: asset.parent.id, name: asset.parent.name } : null,
        locations: visibleLocations,
        location: visibleLocations[0] || null,
        hostLocation: isChildSoftAsset(asset) ? (visibleLocations[0] || null) : null,
        boundaryStatus: resolveSoftAssetBoundaryStatus(visibleLocations, boundaryContext),
        ...(groupPayload ? {
            groupMemberSummary: groupPayload.groupMemberSummary,
            groupMembers: groupPayload.groupMembers,
            groupMemberSearchText: groupPayload.groupMemberSearchText,
            groupMemberLocations: groupPayload.groupMemberLocations,
            groupDiscoverMetadata: groupMetadata,
            groupReadinessStatus: groupReadiness.status,
            groupOwnerCount: groupReadiness.ownerCount,
            isDiscoverReady: groupReadiness.isDiscoverReady,
            selectedGroupMemberCount: Array.isArray(groupMembers) ? groupMembers.length : 0,
            publicGroupMemberCount: getPublicGroupMemberEntries(asset).length,
        } : {}),
    };
}

function formatSoftAssetWithAccess(
    asset,
    boundaryContext,
    viewer,
    allowedPartnerAudienceIds,
    allowedAudienceZoneIds,
    eligibilityContext,
    membershipHostIdMap,
) {
    const formatted = formatSoftAsset(asset, boundaryContext, viewer, allowedPartnerAudienceIds, allowedAudienceZoneIds);
    return {
        ...formatted,
        eligibilityRules: asset.eligibilityRules || null,
        ...getOfferingAccessMetadata(asset, viewer, eligibilityContext, membershipHostIdMap),
    };
}

function isStandaloneOffering(asset) {
    const hasLinkedLocations = Array.isArray(asset?.locations) && asset.locations.length > 0;
    return !asset?.hostHardAssetId
        && !hasLinkedLocations
        && (asset?.assetMode || SOFT_ASSET_MODES.STANDALONE) === SOFT_ASSET_MODES.STANDALONE;
}

function isDirectAccessManagedSoftAsset(asset) {
    return isStandaloneOffering(asset) || isGroupSoftAsset(asset);
}

function buildSoftAssetPermissionSummary(viewer, asset) {
    const role = normalizeRole(viewer?.role);
    const isSuperAdmin = role === 'super_admin';

    if (isDirectAccessManagedSoftAsset(asset)) {
        const isOwner = hasSoftAssetStaffAccess(viewer, asset?.id, ['owner']);
        const isStaff = hasSoftAssetStaffAccess(viewer, asset?.id, ['staff']);
        return {
            canEdit: isSuperAdmin || isOwner || isStaff,
            canManageAccess: isSuperAdmin || isOwner,
            canDelete: isSuperAdmin || isOwner,
            canHide: isSuperAdmin || isOwner,
        };
    }

    const canEdit = actorCanManageAsset(viewer, asset, asset?.partner);
    return {
        canEdit: isSuperAdmin || canEdit,
        canManageAccess: false,
        canDelete: isSuperAdmin || canEdit,
        canHide: isSuperAdmin || canEdit,
    };
}

async function attachSoftAssetRegionMetadata(db, assets = []) {
    const singaporeRegion = await loadSingaporeFallbackRegion(db);
    const hardLocationEntries = assets.flatMap((asset) => {
        const entries = [];
        if (asset?.hostHardAsset) entries.push(asset.hostHardAsset);
        if (Array.isArray(asset?.locations)) {
            entries.push(...asset.locations.map((location) => location?.hardAsset).filter(Boolean));
        }
        return entries;
    });
    const hardPostalCodes = [...new Set(hardLocationEntries.map((asset) => asset?.postalCode).filter(Boolean))];
    const hardRegionRows = hardPostalCodes.length > 0
        ? await db.select({
            postalCode: subregionPostalCodes.postalCode,
            subregionId: subregionPostalCodes.subregionId,
        })
            .from(subregionPostalCodes)
            .where(inArray(subregionPostalCodes.postalCode, hardPostalCodes))
        : [];
    const hardAssetsWithRegions = attachHardAssetRegionMatches(hardLocationEntries, hardRegionRows, {
        singaporeRegionId: singaporeRegion?.id,
    });
    const matchingRegionsByHardAssetId = new Map(
        hardAssetsWithRegions.map((asset) => [Number(asset.id), asset.matchingRegionIds || []])
    );

    const coverageTrackedIds = assets
        .filter((asset) => isStandaloneOffering(asset) || isGroupSoftAsset(asset))
        .map((asset) => Number(asset.id))
        .filter((id) => Number.isInteger(id) && id > 0);
    const coverageRows = coverageTrackedIds.length > 0
        ? await db.select({
            softAssetId: softAssetRegionCoverages.softAssetId,
            subregionId: softAssetRegionCoverages.subregionId,
        })
            .from(softAssetRegionCoverages)
            .where(inArray(softAssetRegionCoverages.softAssetId, coverageTrackedIds))
        : [];
    const standaloneWithCoverage = attachStandaloneSoftAssetCoverage(assets, coverageRows);
    const coverageBySoftAssetId = new Map(
        standaloneWithCoverage.map((asset) => [Number(asset.id), asset.coverageRegionIds || []])
    );

    return assets.map((asset) => {
        const hostMatches = matchingRegionsByHardAssetId.get(Number(asset?.hostHardAssetId)) || [];
        const locationMatches = Array.isArray(asset.locations)
            ? asset.locations.flatMap((location) => matchingRegionsByHardAssetId.get(Number(location?.hardAssetId ?? location?.hardAsset?.id)) || [])
            : [];
        const coverageRegionIds = coverageBySoftAssetId.get(Number(asset.id)) || [];
        return {
            ...asset,
            coverageRegionIds,
            matchingRegionIds: uniqueSortedIntegerList([...hostMatches, ...locationMatches, ...coverageRegionIds]),
            hostHardAsset: asset.hostHardAsset
                ? {
                    ...asset.hostHardAsset,
                    matchingRegionIds: matchingRegionsByHardAssetId.get(Number(asset.hostHardAsset.id)) || [],
                }
                : asset.hostHardAsset,
            locations: Array.isArray(asset.locations)
                ? asset.locations.map((location) => ({
                    ...location,
                    matchingRegionIds: matchingRegionsByHardAssetId.get(Number(location?.hardAssetId ?? location?.hardAsset?.id)) || [],
                    hardAsset: location?.hardAsset
                        ? {
                            ...location.hardAsset,
                            matchingRegionIds: matchingRegionsByHardAssetId.get(Number(location.hardAsset.id)) || [],
                        }
                        : location?.hardAsset,
                }))
                : asset.locations,
        };
    });
}

async function attachSoftAssetTranslations(db, formattedAssets) {
    const assets = Array.isArray(formattedAssets) ? formattedAssets : [formattedAssets].filter(Boolean);
    if (assets.length === 0) return formattedAssets;

    const softTranslationMap = await loadTranslationsForResources(db, 'soft', assets.map((asset) => asset.id));
    const hardLocationIds = assets
        .flatMap((asset) => (asset.locations || []).map((location) => location.id).filter(Boolean));
    const hardTranslationMap = await loadTranslationsForResources(db, 'hard', hardLocationIds);

    const attachOne = (asset) => attachTranslations({
        ...asset,
        locations: (asset.locations || []).map((location) => attachTranslations(
            location,
            hardTranslationMap.get(`hard:${location.id}`) || {},
        )),
        location: asset.location
            ? attachTranslations(asset.location, hardTranslationMap.get(`hard:${asset.location.id}`) || {})
            : asset.location,
        hostLocation: asset.hostLocation
            ? attachTranslations(asset.hostLocation, hardTranslationMap.get(`hard:${asset.hostLocation.id}`) || {})
            : asset.hostLocation,
    }, softTranslationMap.get(`soft:${asset.id}`) || {});

    return Array.isArray(formattedAssets) ? assets.map(attachOne) : attachOne(assets[0]);
}

async function triggerSoftAssetTranslation(db, env, asset, user) {
    try {
        return await syncResourceTranslations(db, env, {
            resourceType: 'soft',
            resourceId: asset.id,
            source: asset,
            updatedByUserId: user?.id || null,
        });
    } catch (err) {
        console.error('Soft asset translation trigger failed:', { assetId: asset?.id, message: err.message });
        return {
            status: 'failed',
            message: err.message || 'English was saved, but auto-translation failed.',
        };
    }
}

function canExposeFormattedSoftAsset(asset, formatted, viewer = null) {
    if (isGroupSoftAsset(asset)) {
        if (isDiscoverReadyGroup(asset)) return true;
        return buildSoftAssetPermissionSummary(viewer, asset).canEdit;
    }

    const allLocations = getSoftAssetLocations(asset);
    if (isChildSoftAsset(asset)) {
        return formatted.locations.length > 0;
    }

    return allLocations.length === 0 || formatted.locations.length > 0;
}

async function countSoftAssetRows(db, where) {
    const [row] = await db.select({
        totalCount: sql`count(*)`.mapWith(Number),
    }).from(softAssets).where(where);
    return Number(row?.totalCount || 0);
}

async function loadSoftAssetById(db, id) {
    return db.query.softAssets.findFirst({
        where: eq(softAssets.id, id),
        with: softAssetWithRelations,
    });
}

async function rebuildSoftAssetCaches(subregionIds, env, user) {
    const uniqueIds = [...new Set((subregionIds || []).filter((value) => value !== undefined && value !== null))];

    for (const subregionId of uniqueIds) {
        try {
            await rebuildMapCache(getCacheRegionId(subregionId, user?.subregionId, user?.subregionIds?.[0]), env);
        } catch (cacheErr) {
            console.error('Cache err', cacheErr);
        }
    }
}

function isGroupAssetMode(value) {
    return String(value || '').trim().toLowerCase() === SOFT_ASSET_MODES.GROUP;
}

function assertNoGroupHostLinks(body = {}, linkedIds = []) {
    if (linkedIds.length > 0 || body.locationId || body.hostId || body.parentSoftAssetId || body.hostHardAssetId) {
        throw clientError('Groups do not link directly to places. Add places as Group members instead.');
    }
}

function resolveGroupSubregionId(actor, body = {}) {
    const explicitSubregionId = getExplicitSubregionId(body);
    if (explicitSubregionId) {
        ensureActorCanTargetSubregion(actor, explicitSubregionId);
        return explicitSubregionId;
    }

    if (Number.isInteger(actor?.subregionId) && actor.subregionId > 0) {
        return actor.subregionId;
    }

    const fallback = Array.isArray(actor?.subregionIds)
        ? actor.subregionIds.find((id) => Number.isInteger(id) && id > 0)
        : null;
    return fallback || null;
}

function normalizeInitialGroupAccessPayload(body = {}, actor = {}) {
    const rawAccess = Array.isArray(body.initialAccess)
        ? body.initialAccess
        : (Array.isArray(body.initialStaff)
            ? body.initialStaff
            : (Array.isArray(body.initialOwnerUserIds)
                ? body.initialOwnerUserIds.map((userId) => ({ userId, staffRole: 'owner' }))
                : []));
    const actorRole = normalizeRole(actor?.role);
    const byUserId = new Map();

    for (const row of rawAccess) {
        const userId = Number.parseInt(String(row?.userId ?? row?.id ?? ''), 10);
        const staffRole = normalizeSoftAssetStaffRole(row?.staffRole || row?.role || 'staff');
        if (!Number.isInteger(userId) || userId <= 0) {
            throw clientError('Each Group access row needs a user id.');
        }
        if (!staffRole) {
            throw clientError('Group access role must be Owner or Staff.');
        }
        if (actorRole !== 'super_admin' && Number(userId) !== Number(actor?.id)) {
            throw clientError('Only Super Admins can assign other initial Group managers.', 403);
        }
        if (actorRole !== 'super_admin' && staffRole !== 'owner') {
            throw clientError('Group creators must save themselves as an Owner first.', 403);
        }

        const previous = byUserId.get(userId);
        byUserId.set(userId, {
            userId,
            staffRole: previous?.staffRole === 'owner' || staffRole === 'owner' ? 'owner' : 'staff',
        });
    }

    if (byUserId.size === 0 && actorRole !== 'super_admin' && actor?.id) {
        byUserId.set(Number(actor.id), { userId: Number(actor.id), staffRole: 'owner' });
    }

    const rows = [...byUserId.values()];
    if (!rows.some((row) => row.staffRole === 'owner')) {
        throw clientError('Select at least one active Group Owner.');
    }
    return rows;
}

async function validateInitialGroupAccessUsers(db, rows = []) {
    if (!rows.length) return rows;
    const userIds = rows.map((row) => Number(row.userId));
    const foundUsers = await db.select({ id: users.id })
        .from(users)
        .where(inArray(users.id, userIds));
    const foundIds = new Set(foundUsers.map((row) => Number(row.id)));
    const missingId = userIds.find((id) => !foundIds.has(id));
    if (missingId) {
        throw clientError(`Group Owner or Staff user #${missingId} could not be found.`, 404);
    }
    return rows;
}

async function createGroupSoftAsset(c, db, user, body, linkedIds) {
    assertNoGroupHostLinks(body, linkedIds);

    const {
        name,
        description,
        schedule,
        logoUrl,
        bannerUrl,
        galleryUrls,
        newTags = [],
        isHidden,
        hideFrom,
        hideUntil,
        contactPhone,
        whatsappContact,
        contactEmail,
        ctaLabel,
        ctaUrl,
        venueNote,
    } = body;

    if (!name) {
        return c.json({ error: 'Name is required' }, 400);
    }

    const initialAccessRows = await validateInitialGroupAccessUsers(
        db,
        normalizeInitialGroupAccessPayload(body, user),
    );
    const requestedMembers = Array.isArray(body.groupMembers) ? body.groupMembers : body.members;
    const audienceMode = normalizeGroupAudienceMode(body.audienceMode);
    const coverageRegionIds = audienceMode === 'target_regions' ? getRequestedCoverageRegionIds(body) : [];
    if (audienceMode === 'target_regions' && coverageRegionIds.length === 0) {
        throw clientError('Select at least one target Region for target-region Groups.');
    }
    assertManageableCoverageRegions(user, coverageRegionIds);
    const finalSubregionId = resolveGroupSubregionId(user, withCoverageSubregionFallback(body, [], coverageRegionIds));
    const [asset] = await db.insert(softAssets).values({
        assetMode: SOFT_ASSET_MODES.GROUP,
        externalKey: await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
            requestedKey: body.externalKey,
            prefix: 'group',
            name,
        }),
        partnerId: null,
        createdByUserId: user.id,
        subregionId: finalSubregionId,
        name,
        bucket: null,
        subCategory: 'Groups',
        description: description || null,
        schedule: schedule || null,
        logoUrl: logoUrl || null,
        bannerUrl: bannerUrl || null,
        galleryUrls: normalizeGalleryUrls(galleryUrls),
        audienceMode,
        isMemberOnly: false,
        eligibilityRules: null,
        contactPhone: contactPhone || null,
        whatsappContact: whatsappContact || null,
        contactEmail: contactEmail || null,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        venueNote: venueNote || null,
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: null,
        ...buildFreshnessInsert(body, user),
        isHidden: Boolean(isHidden),
        hideFrom: hideFrom ? new Date(hideFrom) : null,
        hideUntil: hideUntil ? new Date(hideUntil) : null,
    }).returning();

    try {
        await db.insert(softAssetStaffMemberships).values(initialAccessRows.map((row) => ({
            softAssetId: asset.id,
            userId: row.userId,
            staffRole: row.staffRole,
            createdByUserId: user.id,
            updatedByUserId: user.id,
        }))).onConflictDoNothing();
        const selectedMembers = await validateGroupMemberSelection(db, asset.id, { members: requestedMembers || [] });
        if (selectedMembers.length > 0) {
            await db.insert(softAssetGroupMembers).values(selectedMembers.map((member) => ({
                groupSoftAssetId: asset.id,
                memberResourceType: member.memberResourceType,
                memberResourceId: member.memberResourceId,
                sortOrder: member.sortOrder,
                addedByUserId: user?.id || null,
            }))).onConflictDoNothing();
        }
        await syncSoftAssetRegionCoverages(db, asset.id, coverageRegionIds, user);
        await syncAssetTags(db, asset.id, 'soft', newTags);
    } catch (syncError) {
        await db.delete(softAssets).where(eq(softAssets.id, asset.id));
        throw syncError;
    }

    const translationStatus = await triggerSoftAssetTranslation(db, c.env, asset, user);
    await rebuildSoftAssetCaches([finalSubregionId, ...coverageRegionIds, 'all'], c.env, user);
    await recordSoftAssetAudit(db, user, asset, 'created', ['created'], {
        assetMode: SOFT_ASSET_MODES.GROUP,
        visibility: asset.isHidden ? 'hidden' : 'visible',
        ownerCount: initialAccessRows.filter((row) => row.staffRole === 'owner').length,
        selectedMemberCount: Array.isArray(requestedMembers) ? requestedMembers.length : 0,
    });

    return c.json({ ...asset, translationStatus }, 201);
}

async function updateGroupSoftAsset(c, db, user, existing, body) {
    assertNoGroupHostLinks(body, parseLinkedHardAssetIds(body));

    const [existingWithCoverage] = await attachSoftAssetRegionMetadata(db, [existing]);
    const existingCoverageRegionIds = existingWithCoverage?.coverageRegionIds || [];
    const audienceMode = normalizeGroupAudienceMode(body.audienceMode ?? existing.audienceMode);
    const coveragePatchRequested = hasCoverageRegionPatch(body) || body.audienceMode !== undefined;
    const nextCoverageRegionIds = audienceMode === 'target_regions'
        ? (coveragePatchRequested ? getRequestedCoverageRegionIds(body) : existingCoverageRegionIds)
        : [];
    if (audienceMode === 'target_regions' && nextCoverageRegionIds.length === 0) {
        throw clientError('Select at least one target Region for target-region Groups.');
    }
    assertManageableCoverageRegions(user, nextCoverageRegionIds);
    const groupRoutingBody = withCoverageSubregionFallback(body, [], nextCoverageRegionIds);
    const finalSubregionId = body.subregionId !== undefined || nextCoverageRegionIds.length > 0
        ? resolveGroupSubregionId(user, groupRoutingBody)
        : (existing.subregionId || resolveGroupSubregionId(user, groupRoutingBody));

    const updatePatch = {
        partnerId: existing.partnerId || null,
        subregionId: finalSubregionId,
        name: body.name ?? existing.name,
        bucket: null,
        subCategory: 'Groups',
        description: body.description !== undefined ? (body.description || null) : existing.description,
        schedule: body.schedule !== undefined ? (body.schedule || null) : existing.schedule,
        logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : existing.logoUrl,
        bannerUrl: body.bannerUrl !== undefined ? (body.bannerUrl || null) : existing.bannerUrl,
        galleryUrls: body.galleryUrls !== undefined ? normalizeGalleryUrls(body.galleryUrls) : existing.galleryUrls,
        audienceMode,
        isMemberOnly: false,
        eligibilityRules: null,
        contactPhone: body.contactPhone !== undefined ? (body.contactPhone || null) : existing.contactPhone,
        whatsappContact: body.whatsappContact !== undefined ? (body.whatsappContact || null) : existing.whatsappContact,
        contactEmail: body.contactEmail !== undefined ? (body.contactEmail || null) : existing.contactEmail,
        ctaLabel: body.ctaLabel !== undefined ? (body.ctaLabel || null) : existing.ctaLabel,
        ctaUrl: body.ctaUrl !== undefined ? (body.ctaUrl || null) : existing.ctaUrl,
        venueNote: body.venueNote !== undefined ? (body.venueNote || null) : existing.venueNote,
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: null,
        ...buildFreshnessUpdate(body, existing, user),
        isHidden: body.isHidden !== undefined ? Boolean(body.isHidden) : existing.isHidden,
        hideFrom: body.hideFrom !== undefined ? (body.hideFrom ? new Date(body.hideFrom) : null) : existing.hideFrom,
        hideUntil: body.hideUntil !== undefined ? (body.hideUntil ? new Date(body.hideUntil) : null) : existing.hideUntil,
        updatedAt: new Date(),
    };

    await db.update(softAssets).set(updatePatch).where(eq(softAssets.id, existing.id));

    if (body.newTags !== undefined) {
        await syncAssetTags(db, existing.id, 'soft', body.newTags || []);
    }

    await syncSoftAssetRegionCoverages(db, existing.id, nextCoverageRegionIds, user);

    const refreshed = await loadSoftAssetById(db, existing.id);
    const translationStatus = refreshed
        ? await triggerSoftAssetTranslation(db, c.env, refreshed, user)
        : { status: 'skipped', message: 'Group was saved but could not be reloaded for translation.' };

    await rebuildSoftAssetCaches([finalSubregionId, existing.subregionId, ...nextCoverageRegionIds, ...existingCoverageRegionIds, 'all'], c.env, user);
    const changedFields = diffAuditFieldNames(existing, updatePatch)
        .concat(body.newTags !== undefined ? ['tags'] : [])
        .concat(coveragePatchRequested ? ['targetRegions'] : []);
    if (changedFields.length) {
        await recordSoftAssetAudit(
            db,
            user,
            refreshed || { ...existing, ...updatePatch },
            isResourceVisibilityAction(existing, updatePatch)
                ? (updatePatch.isHidden ? 'hidden' : 'shown')
                : 'updated',
            changedFields,
            { assetMode: SOFT_ASSET_MODES.GROUP },
        );
    }

    return c.json({ success: true, id: existing.id, assetMode: SOFT_ASSET_MODES.GROUP, translationStatus });
}

function normalizeGroupMemberPayload(body = {}) {
    const rawMembers = Array.isArray(body) ? body : (Array.isArray(body.members) ? body.members : []);
    const seen = new Set();

    return rawMembers.map((member, index) => {
        const type = String(member?.memberResourceType || member?.resourceType || member?.type || '').trim().toLowerCase();
        const normalizedType = type === GROUP_MEMBER_TYPES.HARD ? GROUP_MEMBER_TYPES.HARD : (type === GROUP_MEMBER_TYPES.SOFT ? GROUP_MEMBER_TYPES.SOFT : '');
        const id = Number.parseInt(String(member?.memberResourceId ?? member?.resourceId ?? member?.id ?? ''), 10);

        if (!normalizedType || !Number.isInteger(id) || id <= 0) {
            throw clientError('Each Group member needs a hard or soft resource type and resource id.');
        }

        const key = `${normalizedType}:${id}`;
        if (seen.has(key)) {
            throw clientError('A resource can only be added to a Group once.');
        }
        seen.add(key);

        const sortOrder = Number.isInteger(Number(member?.sortOrder))
            ? Number(member.sortOrder)
            : index;

        return {
            memberResourceType: normalizedType,
            memberResourceId: id,
            sortOrder,
        };
    });
}

function summarizeGroupMemberForAdmin(entry = {}) {
    const asset = getGroupMemberAsset(entry);
    const type = getGroupMemberType(entry);
    return {
        id: entry.id || null,
        memberResourceType: type,
        memberResourceId: Number(entry.memberResourceId || asset?.id || 0) || null,
        sortOrder: Number(entry.sortOrder || 0),
        isPublicEligible: isPublicGroupMemberEntry(entry),
        resource: asset ? {
            id: asset.id,
            resourceType: type,
            name: asset.name,
            assetMode: asset.assetMode || null,
            bucket: asset.bucket || null,
            subCategory: asset.subCategory || null,
            description: asset.description || null,
            logoUrl: asset.logoUrl || null,
            address: asset.address || null,
            postalCode: asset.postalCode || null,
            isHidden: Boolean(asset.isHidden),
            isMemberOnly: Boolean(asset.isMemberOnly),
            audienceMode: asset.audienceMode || null,
            detailPath: `/resource/${type}/${asset.id}`,
        } : null,
    };
}

async function validateGroupMemberSelection(db, groupId, body = {}) {
    const members = normalizeGroupMemberPayload(body);
    if (members.length === 0) return [];

    const hardIds = members
        .filter((member) => member.memberResourceType === GROUP_MEMBER_TYPES.HARD)
        .map((member) => member.memberResourceId);
    const softIds = members
        .filter((member) => member.memberResourceType === GROUP_MEMBER_TYPES.SOFT)
        .map((member) => member.memberResourceId);

    if (softIds.includes(groupId)) {
        throw clientError('A Group cannot include itself.');
    }

    const [hardRows, softRows] = await Promise.all([
        hardIds.length > 0
            ? db.query.hardAssets.findMany({
                where: inArray(hardAssets.id, hardIds),
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                },
            })
            : [],
        softIds.length > 0
            ? db.query.softAssets.findMany({
                where: inArray(softAssets.id, softIds),
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                    hostHardAsset: {
                        with: {
                            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                        },
                    },
                    locations: {
                        with: {
                            hardAsset: {
                                with: {
                                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                                },
                            },
                        },
                    },
                    tags: { with: { tag: true } },
                },
            })
            : [],
    ]);

    const hardById = new Map(hardRows.map((asset) => [Number(asset.id), asset]));
    const softById = new Map(softRows.map((asset) => [Number(asset.id), asset]));

    return members.map((member) => {
        const entry = {
            ...member,
            hardAsset: member.memberResourceType === GROUP_MEMBER_TYPES.HARD ? hardById.get(member.memberResourceId) : null,
            softAsset: member.memberResourceType === GROUP_MEMBER_TYPES.SOFT ? softById.get(member.memberResourceId) : null,
        };
        const asset = getGroupMemberAsset(entry);
        if (!asset) {
            throw clientError('One or more Group members could not be found.', 404);
        }
        if (!isPublicGroupMemberEntry(entry)) {
            throw clientError('Groups can only include public, non-hidden Places, Programmes, Services, or Promotions.');
        }
        return entry;
    });
}

export const getSoftAssetGroupMembers = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const group = await loadSoftAssetById(db, id);
        if (!group) return c.json({ error: 'Not found' }, 404);
        if (!isGroupSoftAsset(group)) return c.json({ error: 'This soft asset is not a Group.' }, 400);
        if (!buildSoftAssetPermissionSummary(user, group).canEdit) {
            return c.json({ error: 'Insufficient permissions to manage this Group' }, 403);
        }

        return c.json({
            groupId: id,
            members: (group.groupMembers || [])
                .slice()
                .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
                .map(summarizeGroupMemberForAdmin),
            publicPayload: buildPublicGroupPayload(group),
            readiness: {
                ...buildGroupReadiness(group),
                selectedMemberCount: Array.isArray(group.groupMembers) ? group.groupMembers.length : 0,
                publicMemberCount: getPublicGroupMemberEntries(group).length,
            },
        });
    } catch (err) {
        console.error('getSoftAssetGroupMembers Error:', err);
        return c.json({ error: err.message || 'Failed to fetch Group members' }, err.status || 500);
    }
};

export const replaceSoftAssetGroupMembers = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const group = await loadSoftAssetById(db, id);
        if (!group) return c.json({ error: 'Not found' }, 404);
        if (!isGroupSoftAsset(group)) return c.json({ error: 'This soft asset is not a Group.' }, 400);
        if (!buildSoftAssetPermissionSummary(user, group).canEdit) {
            return c.json({ error: 'Insufficient permissions to manage this Group' }, 403);
        }

        const selectedMembers = await validateGroupMemberSelection(db, id, await c.req.json());
        await db.delete(softAssetGroupMembers).where(eq(softAssetGroupMembers.groupSoftAssetId, id));
        if (selectedMembers.length > 0) {
            await db.insert(softAssetGroupMembers).values(selectedMembers.map((member) => ({
                groupSoftAssetId: id,
                memberResourceType: member.memberResourceType,
                memberResourceId: member.memberResourceId,
                sortOrder: member.sortOrder,
                addedByUserId: user?.id || null,
            }))).onConflictDoNothing();
        }

        const refreshed = await loadSoftAssetById(db, id);
        await rebuildSoftAssetCaches([group.subregionId, 'all'], c.env, user);
        await recordSoftAssetAudit(db, user, refreshed || group, 'updated', ['groupMembers'], {
            assetMode: SOFT_ASSET_MODES.GROUP,
            selectedMemberCount: selectedMembers.length,
        });

        return c.json({
            success: true,
            groupId: id,
            members: (refreshed?.groupMembers || [])
                .slice()
                .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
                .map(summarizeGroupMemberForAdmin),
            publicPayload: refreshed ? buildPublicGroupPayload(refreshed) : null,
            readiness: {
                ...(refreshed ? buildGroupReadiness(refreshed) : { status: 'hidden', isDiscoverReady: false, ownerCount: 0 }),
                selectedMemberCount: Array.isArray(refreshed?.groupMembers) ? refreshed.groupMembers.length : 0,
                publicMemberCount: refreshed ? getPublicGroupMemberEntries(refreshed).length : 0,
            },
        });
    } catch (err) {
        console.error('replaceSoftAssetGroupMembers Error:', err);
        return c.json({ error: err.message || 'Failed to update Group members' }, err.status || 500);
    }
};

export const getSoftAssets = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const boundaryContext = await loadScopedBoundaryContext(db, user);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);

        const { page, pageSize } = normalizeResourceListPagination({
            page: c.req.query('page'),
            pageSize: c.req.query('pageSize'),
        });
        const listScope = normalizeResourceListScope(c.req.query('scope'));
        const query = c.req.query('q');
        const assetModeFilter = String(c.req.query('assetMode') || '').trim().toLowerCase();
        const summaryOnly = isQueryFlagEnabled(c.req.query('summary'));
        const useManagedSummary = summaryOnly && listScope === 'managed';

        const whereClauses = [eq(softAssets.isDeleted, false)];
        if (assetModeFilter === SOFT_ASSET_MODES.GROUP) {
            whereClauses.push(eq(softAssets.assetMode, SOFT_ASSET_MODES.GROUP));
        }
        const isDirectStaffManagedScope = listScope === 'managed' && isStandardDirectResourceOperator(user);

        if (isDirectStaffManagedScope) {
            const directManagedHardAssetIds = getDirectManagedHardAssetIds(user);
            const directManagedSoftAssetIds = getDirectManagedSoftAssetIds(user);
            const linkedRows = directManagedHardAssetIds.length > 0
                ? await db.select({ softAssetId: softAssetLocations.softAssetId })
                    .from(softAssetLocations)
                    .where(inArray(softAssetLocations.hardAssetId, directManagedHardAssetIds))
                : [];
            const linkedSoftAssetIds = linkedRows
                .map((row) => Number(row.softAssetId))
                .filter((id) => Number.isInteger(id) && id > 0);
            const directScopeSoftAssetIds = [...new Set([
                ...directManagedSoftAssetIds,
                ...linkedSoftAssetIds,
            ])];
            const directScopeWhere = [
                directScopeSoftAssetIds.length > 0 ? inArray(softAssets.id, directScopeSoftAssetIds) : null,
                directManagedHardAssetIds.length > 0 ? inArray(softAssets.hostHardAssetId, directManagedHardAssetIds) : null,
            ].filter(Boolean);

            if (directScopeWhere.length === 0) {
                return c.json({
                    data: [],
                    pagination: buildResourceListPagination({ totalCount: 0, page, pageSize }),
                });
            }

            whereClauses.push(directScopeWhere.length === 1 ? directScopeWhere[0] : or(...directScopeWhere));
        }

        const searchWhere = buildSoftAssetSearchWhere(query);
        if (searchWhere) {
            whereClauses.push(searchWhere);
        }

        const finalWhere = and(...whereClauses);

        const options = {
            where: finalWhere,
            with: useManagedSummary ? softAssetListSummaryRelations : softAssetWithRelations,
            orderBy: [desc(softAssets.updatedAt), desc(softAssets.id)],
        };

        const canUseDirectPagination = shouldUseDirectManagedResourcePagination({
            scope: listScope,
            actor: user,
        });
        const [directTotalCount, assets] = canUseDirectPagination
            ? await Promise.all([
                countSoftAssetRows(db, finalWhere),
                db.query.softAssets.findMany({
                    ...options,
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                }),
            ])
            : [null, await db.query.softAssets.findMany(options)];
        const assetsWithRegionMetadata = await attachSoftAssetRegionMetadata(db, assets);
        const scopedAssets = filterSoftAssetsForResourceList(assetsWithRegionMetadata, user, {
            scope: listScope,
            isVisible: (asset) => isAssetVisible(asset, user, {
                ownerPartner: asset.partner,
                allowedPartnerAudienceIds,
                allowedAudienceZoneIds,
                treatMemberOnlyAsVisible: true,
            }),
            canExpose: () => true,
        });

        if (useManagedSummary) {
            const summaries = scopedAssets.map((asset) => ({
                ...formatSoftAssetListSummary(asset, {
                    boundaryStatus: resolveSoftAssetBoundaryStatus(getSoftAssetLocations(asset), boundaryContext),
                    permissions: buildSoftAssetPermissionSummary(user, asset),
                }),
            }));
            const { data: pagedSummaries, pagination } = canUseDirectPagination
                ? {
                    data: summaries,
                    pagination: buildResourceListPagination({ totalCount: directTotalCount, page, pageSize }),
                }
                : paginateResourceList(summaries, { page, pageSize });
            const organizationContextsByResource = await loadOrganizationContextsForResources(
                db,
                pagedSummaries.map((asset) => ({ resourceType: 'soft', resourceId: asset.id })),
            );

            return c.json({
                data: pagedSummaries.map((asset) => ({
                    ...asset,
                    organizationLinks: organizationContextsByResource.get(`soft:${asset.id}`) || [],
                })),
                pagination,
            });
        }

        const eligibilityContext = await buildEligibilityContext(db, user);
        const membershipHostIdMap = await buildMembershipHostIdMap(db, scopedAssets);
        const formatted = scopedAssets
            .map((asset) => ({
                raw: asset,
                formatted: formatSoftAssetWithAccess(
                    asset,
                    boundaryContext,
                    user,
                    allowedPartnerAudienceIds,
                    allowedAudienceZoneIds,
                    eligibilityContext,
                    membershipHostIdMap,
                ),
            }))
            .filter(({ raw, formatted }) => (
                listScope === 'managed'
                || (
                    canExposeFormattedSoftAsset(raw, formatted, user)
                    && shouldExposeOfferingToViewer(
                        raw,
                        user,
                        eligibilityContext,
                        membershipHostIdMap.get(raw.id) || [],
                    )
                )
            ))
            .map(({ raw, formatted }) => ({
                ...formatted,
                coverageRegionIds: raw.coverageRegionIds || [],
                matchingRegionIds: raw.matchingRegionIds || raw.coverageRegionIds || [],
                primaryRegionId: raw.subregionId || null,
                permissions: buildSoftAssetPermissionSummary(user, raw),
            }));
        const { data: pagedFormatted, pagination } = canUseDirectPagination
            ? {
                data: formatted,
                pagination: buildResourceListPagination({ totalCount: directTotalCount, page, pageSize }),
            }
            : paginateResourceList(formatted, { page, pageSize });
        const organizationContextsByResource = await loadOrganizationContextsForResources(
            db,
            pagedFormatted.map((asset) => ({ resourceType: 'soft', resourceId: asset.id })),
        );
        const pagedWithOrganizationContext = pagedFormatted.map((asset) => ({
            ...asset,
            organizationLinks: organizationContextsByResource.get(`soft:${asset.id}`) || [],
        }));

        const formattedWithTranslations = await attachSoftAssetTranslations(db, pagedWithOrganizationContext);

        return c.json({
            data: formattedWithTranslations,
            pagination,
        });
    } catch (err) {
        console.error('getSoftAssets Error:', err);
        return c.json({ error: err.message || 'Failed to fetch soft assets' }, err.status || 500);
    }
};

export const getSoftAssetById = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);
        const boundaryContext = await loadScopedBoundaryContext(db, user);

        const loadedAsset = await loadSoftAssetById(db, id);
        const [asset] = loadedAsset ? await attachSoftAssetRegionMetadata(db, [loadedAsset]) : [];
        const permissions = asset ? buildSoftAssetPermissionSummary(user, asset) : null;
        const isVisibleToViewer = asset ? isAssetVisible(asset, user, {
            ownerPartner: asset.partner,
            allowedPartnerAudienceIds,
            allowedAudienceZoneIds,
            treatMemberOnlyAsVisible: true,
        }) : false;
        if (!asset || (!isVisibleToViewer && !permissions?.canEdit)) {
            return c.json({ error: 'Not found' }, 404);
        }

        const eligibilityContext = await buildEligibilityContext(db, user);
        const membershipHostIdMap = await buildMembershipHostIdMap(db, [asset]);
        const formatted = formatSoftAssetWithAccess(
            asset,
            boundaryContext,
            user,
            allowedPartnerAudienceIds,
            allowedAudienceZoneIds,
            eligibilityContext,
            membershipHostIdMap,
        );
        if (!canExposeFormattedSoftAsset(asset, formatted, user)) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!shouldExposeOfferingToViewer(
            asset,
            user,
            eligibilityContext,
            membershipHostIdMap.get(asset.id) || [],
        )) {
            return c.json({ error: 'Not found' }, 404);
        }

        return c.json(await attachSoftAssetTranslations(db, {
            ...formatted,
            coverageRegionIds: asset.coverageRegionIds || [],
            matchingRegionIds: asset.matchingRegionIds || asset.coverageRegionIds || [],
            primaryRegionId: asset.subregionId || null,
            organizationLinks: (await loadOrganizationContextsForResources(db, [{ resourceType: 'soft', resourceId: asset.id }])).get(`soft:${asset.id}`) || [],
            permissions,
        }));
    } catch (err) {
        console.error('getSoftAssetById Error:', err);
        return c.json({ error: err.message || 'Failed to fetch soft asset' }, err.status || 500);
    }
};

export const createSoftAsset = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const body = sanitizeSoftAssetPayload(await c.req.json());
        const requestedAssetMode = body?.assetMode || SOFT_ASSET_MODES.STANDALONE;
        if (![SOFT_ASSET_MODES.STANDALONE, SOFT_ASSET_MODES.GROUP].includes(requestedAssetMode)) {
            return c.json({ error: 'Generated child offerings must be created from a parent template.' }, 400);
        }
        const linkedIds = parseLinkedHardAssetIds(body);
        if (isGroupAssetMode(requestedAssetMode)) {
            if (
                (role === 'standard' || role === 'guest')
                && !hasAnyPartnerStaffAccess(user)
            ) {
                return c.json({ error: 'Only admins and partner resource staff can create Groups' }, 403);
            }
            return await createGroupSoftAsset(c, db, user, body, linkedIds);
        }
        const explicitSubregionId = getExplicitSubregionId(body);
        const requestedCoverageRegionIds = getRequestedCoverageRegionIds(body);
        const coverageRegionIds = linkedIds.length === 0
            ? (requestedCoverageRegionIds.length > 0 ? requestedCoverageRegionIds : (explicitSubregionId ? [explicitSubregionId] : []))
            : [];
        const bodyForRouting = withCoverageSubregionFallback(body, linkedIds, coverageRegionIds);
        if (
            (role === 'standard' || role === 'guest')
            && !hasAnyPartnerStaffAccess(user)
            && !(hasAnyHardAssetStaffAccess(user) && linkedIds.length > 0)
        ) {
            return c.json({ error: 'Only admins and assigned asset staff can create linked offerings' }, 403);
        }
        if ((body?.assetMode && body.assetMode !== SOFT_ASSET_MODES.STANDALONE) || body?.parentSoftAssetId || body?.hostHardAssetId) {
            return c.json({ error: 'Generated child offerings must be created from a parent template.' }, 400);
        }

        const {
            name,
            bucket,
            subCategory,
            description,
            schedule,
            logoUrl,
            bannerUrl,
            galleryUrls,
            newTags = [],
            isMemberOnly,
            eligibilityRules,
            isHidden,
            hideFrom,
            hideUntil,
            contactPhone,
            whatsappContact,
            contactEmail,
            ctaLabel,
            ctaUrl,
            venueNote,
            availabilityEnabled,
            availabilityCount,
            availabilityUnit,
        } = body;

        if (!name) {
            return c.json({ error: 'Name is required' }, 400);
        }

        const linkedHardAssets = await loadHardAssetsByIds(db, linkedIds);
        if (linkedHardAssets.length !== linkedIds.length) {
            return c.json({ error: 'One or more linked places were not found.' }, 404);
        }
        ensureActorCanManageLinkedHardAssets(user, linkedHardAssets);

        assertManageableCoverageRegions(user, coverageRegionIds);

        const requestedAudienceZoneIds = normalizeAudienceZoneIds(body?.audienceZoneIds);
        const canRouteWithoutSubregion = linkedIds.length === 0
            && coverageRegionIds.length === 0
            && (body.audienceMode || 'public') === 'audience_zones'
            && requestedAudienceZoneIds.length > 0;
        const finalSubregionId = canRouteWithoutSubregion
            ? null
            : determineSoftSubregion(user, bodyForRouting, linkedHardAssets);
        const { owner } = await resolveAssetOwner(db, user, bodyForRouting, finalSubregionId);
        const audienceMode = normalizeAudienceMode(body, owner);
        const audienceZoneIds = audienceMode === 'audience_zones'
            ? requestedAudienceZoneIds
            : [];

        if (linkedIds.length === 0 && coverageRegionIds.length === 0 && audienceZoneIds.length === 0) {
            return c.json({ error: 'Standalone offerings need at least one service Region or Audience Zone.' }, 400);
        }

        if (audienceMode === 'audience_zones') {
            if (audienceZoneIds.length === 0) {
                return c.json({ error: 'Select at least one audience zone for audience-zone offerings.' }, 400);
            }
            await assertManageableAudienceZones(db, user, audienceZoneIds, { hardAssetIds: linkedIds });
        }

        const [asset] = await db.insert(softAssets).values({
            assetMode: SOFT_ASSET_MODES.STANDALONE,
            externalKey: await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
                requestedKey: body.externalKey,
                prefix: 'offering',
                name,
            }),
            partnerId: owner?.id || null,
            createdByUserId: user.id,
            subregionId: finalSubregionId,
            name,
            bucket: normalizeSoftAssetBucket(bucket, null),
            subCategory: subCategory || 'Programmes',
            description: description || null,
            schedule: schedule || null,
            logoUrl: logoUrl || null,
            bannerUrl: bannerUrl || null,
            galleryUrls: normalizeGalleryUrls(galleryUrls),
            audienceMode,
            isMemberOnly: Boolean(isMemberOnly),
            eligibilityRules: normalizeEligibilityRules(eligibilityRules),
            contactPhone: contactPhone || null,
            whatsappContact: whatsappContact || null,
            contactEmail: contactEmail || null,
            ctaLabel: ctaLabel || null,
            ctaUrl: ctaUrl || null,
            venueNote: venueNote || null,
            availabilityEnabled: normalizeAvailabilityEnabled(availabilityEnabled),
            availabilityCount: normalizeAvailabilityCount(availabilityCount),
            availabilityUnit: normalizeAvailabilityUnit(availabilityUnit),
            ...buildFreshnessInsert(body, user),
            isHidden: Boolean(isHidden),
            hideFrom: hideFrom ? new Date(hideFrom) : null,
            hideUntil: hideUntil ? new Date(hideUntil) : null,
        }).returning();

        try {
            for (const hardAsset of linkedHardAssets) {
                await db.insert(softAssetLocations).values({
                    softAssetId: asset.id,
                    hardAssetId: hardAsset.id,
                });
            }
            await syncSoftAssetRegionCoverages(db, asset.id, coverageRegionIds, user);
            await syncAssetTags(db, asset.id, 'soft', newTags);
            await syncSoftAssetAudienceZones(db, asset.id, audienceZoneIds);
            if (shouldGrantCreatorDefaultSoftAssetOwner(user, { linkedHardAssetIds: linkedIds, hostHardAssetId: asset.hostHardAssetId })) {
                await db.insert(softAssetStaffMemberships).values({
                    softAssetId: asset.id,
                    userId: user.id,
                    staffRole: 'owner',
                    createdByUserId: user.id,
                    updatedByUserId: user.id,
                }).onConflictDoNothing();
            }
        } catch (syncError) {
            await db.delete(softAssets).where(eq(softAssets.id, asset.id));
            throw syncError;
        }

        const translationStatus = await triggerSoftAssetTranslation(db, c.env, asset, user);
        await rebuildSoftAssetCaches([finalSubregionId, ...coverageRegionIds], c.env, user);
        await recordSoftAssetAudit(db, user, asset, 'created', ['created'], {
            assetMode: asset.assetMode || SOFT_ASSET_MODES.STANDALONE,
            visibility: asset.isHidden ? 'hidden' : 'visible',
        });

        return c.json({ ...asset, translationStatus }, 201);
    } catch (err) {
        console.error('createSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to create soft asset' }, err.status || 500);
    }
};

export const patchSoftAssetAvailability = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadSoftAssetById(db, id);
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to edit this asset' }, 403);
        }
        const [existingWithCoverage] = await attachSoftAssetRegionMetadata(db, [existing]);

        const body = sanitizeSoftAssetPatch(await c.req.json());
        const nextAvailabilityEnabled = body?.availabilityEnabled !== undefined
            ? Boolean(body.availabilityEnabled)
            : normalizeAvailabilityEnabled(existing.availabilityEnabled);

        const nextAvailabilityCount = body?.availabilityCount !== undefined
            ? Number.parseInt(body.availabilityCount, 10)
            : normalizeAvailabilityCount(existing.availabilityCount);
        const nextAvailabilityUnit = body?.availabilityUnit !== undefined
            ? normalizeAvailabilityUnit(body.availabilityUnit)
            : normalizeAvailabilityUnit(existing.availabilityUnit);
        const nextEligibilityRules = body?.eligibilityRules !== undefined
            ? normalizeEligibilityRules(body.eligibilityRules)
            : existing.eligibilityRules || null;

        if (!Number.isInteger(nextAvailabilityCount) || nextAvailabilityCount < 0) {
            return c.json({ error: 'Availability count must be a non-negative whole number.' }, 400);
        }

        const availabilityPatch = {
            availabilityEnabled: nextAvailabilityEnabled,
            availabilityCount: nextAvailabilityCount,
            availabilityUnit: nextAvailabilityUnit,
            eligibilityRules: nextEligibilityRules,
            updatedAt: new Date(),
        };
        await db.update(softAssets).set(availabilityPatch).where(eq(softAssets.id, id));

        await rebuildSoftAssetCaches([existing.subregionId, ...(existingWithCoverage?.coverageRegionIds || [])], c.env, user);

        const boundaryContext = await loadScopedBoundaryContext(db, user);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);
        const loadedRefreshed = await loadSoftAssetById(db, id);
        const [refreshed] = loadedRefreshed ? await attachSoftAssetRegionMetadata(db, [loadedRefreshed]) : [];
        if (!refreshed) {
            return c.json({ error: 'Not found' }, 404);
        }

        const eligibilityContext = await buildEligibilityContext(db, user);
        const membershipHostIdMap = await buildMembershipHostIdMap(db, refreshed ? [refreshed] : []);
        const translationStatus = await triggerSoftAssetTranslation(db, c.env, refreshed, user);
        const formatted = formatSoftAssetWithAccess(
                refreshed,
                boundaryContext,
                user,
                allowedPartnerAudienceIds,
                allowedAudienceZoneIds,
                eligibilityContext,
                membershipHostIdMap,
        );
        const changedFields = diffAuditFieldNames(existing, availabilityPatch);
        if (changedFields.length) {
            await recordSoftAssetAudit(db, user, refreshed, 'availability_updated', changedFields);
        }
        return c.json({
            ...(await attachSoftAssetTranslations(db, formatted)),
            coverageRegionIds: refreshed.coverageRegionIds || [],
            matchingRegionIds: refreshed.matchingRegionIds || refreshed.coverageRegionIds || [],
            primaryRegionId: refreshed.subregionId || null,
            permissions: buildSoftAssetPermissionSummary(user, refreshed),
            translationStatus,
        });
    } catch (err) {
        console.error('patchSoftAssetAvailability Error:', err);
        return c.json({ error: err.message || 'Failed to update offering availability' }, err.status || 500);
    }
};

export const updateSoftAsset = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadSoftAssetById(db, id);
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to edit this asset' }, 403);
        }

        const body = sanitizeSoftAssetPatch(await c.req.json());
        const visibilityPatchRequested = ['isHidden', 'hideFrom', 'hideUntil']
            .some((field) => Object.prototype.hasOwnProperty.call(body, field));
        if (visibilityPatchRequested && !buildSoftAssetPermissionSummary(user, existing).canHide) {
            return c.json({ error: 'Insufficient permissions to hide this asset' }, 403);
        }

        if (isChildSoftAsset(existing)) {
            const patch = buildChildEditablePatch(body, existing);
            await db.update(softAssets).set(patch).where(eq(softAssets.id, id));
            const refreshedChild = await loadSoftAssetById(db, id);
            const translationStatus = refreshedChild
                ? await triggerSoftAssetTranslation(db, c.env, refreshedChild, user)
                : { status: 'skipped', message: 'Offering was saved but could not be reloaded for translation.' };
            await rebuildSoftAssetCaches([existing.subregionId], c.env, user);
            const changedFields = diffAuditFieldNames(existing, patch);
            if (changedFields.length) {
                await recordSoftAssetAudit(
                    db,
                    user,
                    refreshedChild || existing,
                    isResourceVisibilityAction(existing, patch)
                        ? (patch.isHidden ? 'hidden' : 'shown')
                        : 'updated',
                    changedFields,
                    { assetMode: existing.assetMode || 'child' },
                );
            }
            return c.json({ success: true, id, assetMode: existing.assetMode, translationStatus });
        }

        if (isGroupSoftAsset(existing)) {
            return await updateGroupSoftAsset(c, db, user, existing, body);
        }

        const [existingWithCoverage] = await attachSoftAssetRegionMetadata(db, [existing]);
        const existingCoverageRegionIds = existingWithCoverage?.coverageRegionIds || [];
        const explicitSubregionId = getExplicitSubregionId(body);
        const nextLinkedIds = body.locationIds !== undefined || body.locationId !== undefined
            ? parseLinkedHardAssetIds(body)
            : existing.locations.map((entry) => entry.hardAssetId);
        const linkedHardAssets = body.locationIds !== undefined || body.locationId !== undefined
            ? await loadHardAssetsByIds(db, nextLinkedIds)
            : existing.locations.map((entry) => entry.hardAsset);

        if (linkedHardAssets.length !== nextLinkedIds.length) {
            return c.json({ error: 'One or more linked places were not found.' }, 404);
        }
        ensureActorCanManageLinkedHardAssets(user, linkedHardAssets);

        const coveragePatchRequested = hasCoverageRegionPatch(body);
        const nextCoverageRegionIds = nextLinkedIds.length === 0
            ? (
                coveragePatchRequested
                    ? getRequestedCoverageRegionIds(body)
                    : (explicitSubregionId ? [explicitSubregionId] : (existingCoverageRegionIds.length > 0 ? existingCoverageRegionIds : (existing.subregionId ? [existing.subregionId] : [])))
            )
            : [];
        assertManageableCoverageRegions(user, nextCoverageRegionIds);

        const existingAudienceZoneIds = existing.audienceZones.map((entry) => entry.audienceZone.id);
        const requestedAudienceMode = body.audienceMode ?? existing.audienceMode;
        const requestedAudienceZoneIds = body.audienceZoneIds !== undefined
            ? normalizeAudienceZoneIds(body.audienceZoneIds)
            : existingAudienceZoneIds;
        let bodyForRouting = withCoverageSubregionFallback(body, nextLinkedIds, nextCoverageRegionIds);
        if (nextLinkedIds.length === 0 && !hasExplicitSubregionId(bodyForRouting) && existing.subregionId) {
            bodyForRouting = { ...bodyForRouting, subregionId: existing.subregionId };
        }
        const canRouteWithoutSubregion = nextLinkedIds.length === 0
            && nextCoverageRegionIds.length === 0
            && requestedAudienceMode === 'audience_zones'
            && requestedAudienceZoneIds.length > 0
            && !hasExplicitSubregionId(bodyForRouting);
        const finalSubregionId = canRouteWithoutSubregion
            ? null
            : determineSoftSubregion(user, bodyForRouting, linkedHardAssets);

        let owner = existing.partner || null;
        if (role === 'partner') {
            owner = user;
        } else if (hasAnyPartnerStaffAccess(user) && (body.partnerId !== undefined || body.ownershipMode !== undefined)) {
            return c.json({ error: 'Partners cannot transfer offering ownership.' }, 403);
        } else if (hasAnyPartnerStaffAccess(user)) {
            const resolvedOwner = await resolveAssetOwner(db, user, bodyForRouting, finalSubregionId);
            owner = resolvedOwner.owner;
        } else if (body.partnerId !== undefined || body.ownershipMode !== undefined) {
            const resolvedOwner = await resolveAssetOwner(db, user, bodyForRouting, finalSubregionId);
            owner = resolvedOwner.owner;
        }

        const audienceMode = normalizeAudienceMode(body.audienceMode ?? existing.audienceMode, owner);
        const nextAudienceZoneIds = audienceMode === 'audience_zones'
            ? requestedAudienceZoneIds
            : [];

        if (nextLinkedIds.length === 0 && nextCoverageRegionIds.length === 0 && nextAudienceZoneIds.length === 0) {
            return c.json({ error: 'Standalone offerings need at least one service Region or Audience Zone.' }, 400);
        }

        if (audienceMode === 'audience_zones') {
            if (nextAudienceZoneIds.length === 0) {
                return c.json({ error: 'Select at least one audience zone for audience-zone offerings.' }, 400);
            }
            await assertManageableAudienceZones(db, user, nextAudienceZoneIds, { hardAssetIds: nextLinkedIds });
        }

        const updatePatch = {
            partnerId: owner?.id || null,
            subregionId: finalSubregionId,
            name: body.name ?? existing.name,
            bucket: body.bucket !== undefined ? normalizeSoftAssetBucket(body.bucket, null) : (existing.bucket || null),
            subCategory: body.subCategory !== undefined ? (body.subCategory || 'Programmes') : existing.subCategory,
            description: body.description !== undefined ? (body.description || null) : existing.description,
            schedule: body.schedule !== undefined ? (body.schedule || null) : existing.schedule,
            logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : existing.logoUrl,
            bannerUrl: body.bannerUrl !== undefined ? (body.bannerUrl || null) : existing.bannerUrl,
            galleryUrls: body.galleryUrls !== undefined ? normalizeGalleryUrls(body.galleryUrls) : existing.galleryUrls,
            audienceMode,
            isMemberOnly: body.isMemberOnly !== undefined ? Boolean(body.isMemberOnly) : existing.isMemberOnly,
            eligibilityRules: body.eligibilityRules !== undefined
                ? normalizeEligibilityRules(body.eligibilityRules)
                : (existing.eligibilityRules || null),
            contactPhone: body.contactPhone !== undefined ? (body.contactPhone || null) : existing.contactPhone,
            whatsappContact: body.whatsappContact !== undefined ? (body.whatsappContact || null) : existing.whatsappContact,
            contactEmail: body.contactEmail !== undefined ? (body.contactEmail || null) : existing.contactEmail,
            ctaLabel: body.ctaLabel !== undefined ? (body.ctaLabel || null) : existing.ctaLabel,
            ctaUrl: body.ctaUrl !== undefined ? (body.ctaUrl || null) : existing.ctaUrl,
            venueNote: body.venueNote !== undefined ? (body.venueNote || null) : existing.venueNote,
            availabilityEnabled: body.availabilityEnabled !== undefined ? Boolean(body.availabilityEnabled) : existing.availabilityEnabled,
            availabilityCount: body.availabilityCount !== undefined ? normalizeAvailabilityCount(body.availabilityCount) : normalizeAvailabilityCount(existing.availabilityCount),
            availabilityUnit: body.availabilityUnit !== undefined ? normalizeAvailabilityUnit(body.availabilityUnit) : normalizeAvailabilityUnit(existing.availabilityUnit),
            ...buildFreshnessUpdate(body, existing, user),
            isHidden: body.isHidden !== undefined ? Boolean(body.isHidden) : existing.isHidden,
            hideFrom: body.hideFrom !== undefined ? (body.hideFrom ? new Date(body.hideFrom) : null) : existing.hideFrom,
            hideUntil: body.hideUntil !== undefined ? (body.hideUntil ? new Date(body.hideUntil) : null) : existing.hideUntil,
            updatedAt: new Date(),
        };
        await db.update(softAssets).set(updatePatch).where(eq(softAssets.id, id));

        if (body.locationIds !== undefined || body.locationId !== undefined) {
            await db.delete(softAssetLocations).where(eq(softAssetLocations.softAssetId, id));
            for (const hardAsset of linkedHardAssets) {
                await db.insert(softAssetLocations).values({
                    softAssetId: id,
                    hardAssetId: hardAsset.id,
                });
            }
        }

        if (body.newTags !== undefined) {
            await syncAssetTags(db, id, 'soft', body.newTags || []);
        }

        await syncSoftAssetAudienceZones(db, id, nextAudienceZoneIds);
        await syncSoftAssetRegionCoverages(db, id, nextCoverageRegionIds, user);

        const refreshed = await loadSoftAssetById(db, id);
        const translationStatus = refreshed
            ? await triggerSoftAssetTranslation(db, c.env, refreshed, user)
            : { status: 'skipped', message: 'Offering was saved but could not be reloaded for translation.' };

        await rebuildSoftAssetCaches([
            finalSubregionId,
            existing.subregionId,
            ...nextCoverageRegionIds,
            ...existingCoverageRegionIds,
        ], c.env, user);
        const changedFields = diffAuditFieldNames(existing, updatePatch)
            .concat(body.locationIds !== undefined || body.locationId !== undefined ? ['linkedPlaces'] : [])
            .concat(body.newTags !== undefined ? ['tags'] : [])
            .concat(coveragePatchRequested ? ['coverageRegions'] : [])
            .concat(body.audienceZoneIds !== undefined || body.audienceMode !== undefined ? ['audienceZones'] : []);
        if (changedFields.length) {
            await recordSoftAssetAudit(
                db,
                user,
                refreshed || { ...existing, ...updatePatch, id },
                isResourceVisibilityAction(existing, updatePatch)
                    ? (updatePatch.isHidden ? 'hidden' : 'shown')
                    : 'updated',
                changedFields,
                { assetMode: existing.assetMode || SOFT_ASSET_MODES.STANDALONE },
            );
        }

        return c.json({ success: true, id, assetMode: existing.assetMode || SOFT_ASSET_MODES.STANDALONE, translationStatus });
    } catch (err) {
        console.error('updateSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to update soft asset' }, err.status || 500);
    }
};

export const resetSoftAssetOverrides = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadSoftAssetById(db, id);
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to edit this asset' }, 403);
        }
        if (!isChildSoftAsset(existing) || !existing.parent) {
            return c.json({ error: 'Only generated child offerings support override resets.' }, 400);
        }

        const body = await c.req.json();
        if (!Array.isArray(body?.fields) || body.fields.length === 0) {
            return c.json({ error: 'At least one override field is required.' }, 400);
        }

        const patch = buildChildOverrideResetPatch(existing.parent, existing, body.fields);
        await db.update(softAssets).set(patch).where(eq(softAssets.id, id));
        await rebuildSoftAssetCaches([existing.subregionId], c.env, user);
        await recordSoftAssetAudit(db, user, { ...existing, ...patch }, 'updated', diffAuditFieldNames(existing, patch), {
            assetMode: existing.assetMode || 'child',
            resetFields: body.fields,
        });

        return c.json({ success: true, id, overriddenFields: patch.overriddenFields });
    } catch (err) {
        console.error('resetSoftAssetOverrides Error:', err);
        return c.json({ error: err.message || 'Failed to reset child overrides' }, err.status || 500);
    }
};

export const deleteSoftAsset = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const loadedExisting = await loadSoftAssetById(db, id);
        const [existing] = loadedExisting ? await attachSoftAssetRegionMetadata(db, [loadedExisting]) : [];
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!buildSoftAssetPermissionSummary(user, existing).canDelete) {
            return c.json({ error: 'Insufficient permissions to delete this asset' }, 403);
        }

        const [deletedRow] = await db.update(softAssets)
            .set({
                isDeleted: true,
                updatedAt: new Date(),
            })
            .where(and(
                eq(softAssets.id, id),
                eq(softAssets.isDeleted, false),
            ))
            .returning({ id: softAssets.id });

        if (!deletedRow) {
            return c.json({ success: true, alreadyDeleted: true });
        }

        await rebuildSoftAssetCaches([existing.subregionId, ...(existing.coverageRegionIds || [])], c.env, user);
        await recordSoftAssetAudit(db, user, existing, 'deleted', ['isDeleted'], {
            assetMode: existing.assetMode || SOFT_ASSET_MODES.STANDALONE,
        });

        return c.json({ success: true });
    } catch (err) {
        console.error('deleteSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to delete soft asset' }, err.status || 500);
    }
};
