import { and, desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { softAssetRegionCoverages, softAssets, softAssetLocations, subregionPostalCodes } from '../db/schema.js';
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
import { hasSoftAssetStaffAccess } from '../utils/softAssetAccess.js';
import { hasAnyPartnerStaffAccess } from '../utils/partnerStaff.js';
import { buildEligibilityContext, buildMembershipHostIdMap, getOfferingAccessMetadata, normalizeEligibilityRules } from '../utils/eligibility.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { loadSingaporeFallbackRegion } from '../utils/singaporePostalFallback.js';
import { isAssetVisible } from '../utils/visibility.js';
import {
    filterSoftAssetsForResourceList,
    normalizeResourceListPagination,
    normalizeResourceListScope,
    paginateResourceList,
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
    locations: {
        with: {
            hardAsset: {
                with: {
                    partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                },
            },
        },
    },
};

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
    const { parent, hostHardAsset, tags, locations, audienceZones, ...assetRest } = asset;
    const resolvedAudienceZones = getAssetAudienceZones(asset);

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

function buildSoftAssetPermissionSummary(viewer, asset) {
    const role = normalizeRole(viewer?.role);
    const isSuperAdmin = role === 'super_admin';

    if (isStandaloneOffering(asset)) {
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

    const standaloneIds = assets
        .filter(isStandaloneOffering)
        .map((asset) => Number(asset.id))
        .filter((id) => Number.isInteger(id) && id > 0);
    const coverageRows = standaloneIds.length > 0
        ? await db.select({
            softAssetId: softAssetRegionCoverages.softAssetId,
            subregionId: softAssetRegionCoverages.subregionId,
        })
            .from(softAssetRegionCoverages)
            .where(inArray(softAssetRegionCoverages.softAssetId, standaloneIds))
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

function canExposeFormattedSoftAsset(asset, formatted) {
    const allLocations = getSoftAssetLocations(asset);
    if (isChildSoftAsset(asset)) {
        return formatted.locations.length > 0;
    }

    return allLocations.length === 0 || formatted.locations.length > 0;
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

        const whereClauses = [eq(softAssets.isDeleted, false)];

        const searchWhere = buildSoftAssetSearchWhere(query);
        if (searchWhere) {
            whereClauses.push(searchWhere);
        }

        const finalWhere = and(...whereClauses);

        const options = {
            where: finalWhere,
            with: softAssetWithRelations,
            orderBy: [desc(softAssets.updatedAt), desc(softAssets.id)],
        };

        const assets = await db.query.softAssets.findMany(options);
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
            .filter(({ raw, formatted }) => listScope === 'managed' || canExposeFormattedSoftAsset(raw, formatted))
            .map(({ raw, formatted }) => ({
                ...formatted,
                coverageRegionIds: raw.coverageRegionIds || [],
                matchingRegionIds: raw.matchingRegionIds || raw.coverageRegionIds || [],
                primaryRegionId: raw.subregionId || null,
                permissions: buildSoftAssetPermissionSummary(user, raw),
            }));
        const { data: pagedFormatted, pagination } = paginateResourceList(formatted, { page, pageSize });
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
        if (!asset || !isAssetVisible(asset, user, {
            ownerPartner: asset.partner,
            allowedPartnerAudienceIds,
            allowedAudienceZoneIds,
            treatMemberOnlyAsVisible: true,
        })) {
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
        if (!canExposeFormattedSoftAsset(asset, formatted)) {
            return c.json({ error: 'Not found' }, 404);
        }

        return c.json(await attachSoftAssetTranslations(db, {
            ...formatted,
            coverageRegionIds: asset.coverageRegionIds || [],
            matchingRegionIds: asset.matchingRegionIds || asset.coverageRegionIds || [],
            primaryRegionId: asset.subregionId || null,
            organizationLinks: (await loadOrganizationContextsForResources(db, [{ resourceType: 'soft', resourceId: asset.id }])).get(`soft:${asset.id}`) || [],
            permissions: buildSoftAssetPermissionSummary(user, asset),
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
        const linkedIds = parseLinkedHardAssetIds(body);
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
        } catch (syncError) {
            await db.delete(softAssets).where(eq(softAssets.id, asset.id));
            throw syncError;
        }

        const translationStatus = await triggerSoftAssetTranslation(db, c.env, asset, user);
        await rebuildSoftAssetCaches([finalSubregionId, ...coverageRegionIds], c.env, user);

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

        await db.update(softAssets).set({
            availabilityEnabled: nextAvailabilityEnabled,
            availabilityCount: nextAvailabilityCount,
            availabilityUnit: nextAvailabilityUnit,
            eligibilityRules: nextEligibilityRules,
            updatedAt: new Date(),
        }).where(eq(softAssets.id, id));

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
            return c.json({ success: true, id, assetMode: existing.assetMode, translationStatus });
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

        await db.update(softAssets).set({
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
        }).where(eq(softAssets.id, id));

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

        await db.update(softAssets).set({
            isDeleted: true,
            updatedAt: new Date(),
        }).where(eq(softAssets.id, id));
        await rebuildSoftAssetCaches([existing.subregionId, ...(existing.coverageRegionIds || [])], c.env, user);

        return c.json({ success: true });
    } catch (err) {
        console.error('deleteSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to delete soft asset' }, err.status || 500);
    }
};
