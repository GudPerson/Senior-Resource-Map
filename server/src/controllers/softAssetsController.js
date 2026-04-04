import { desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { softAssets, softAssetLocations } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    assertManageableAudienceZones,
    getAssetAudienceZones,
    normalizeAudienceZoneIds,
    resolveStandardAudienceZoneIds,
    syncSoftAssetAudienceZones,
} from '../utils/audienceZones.js';
import { actorCanManageAsset } from '../utils/ownership.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { isAssetVisible } from '../utils/visibility.js';
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
    ensureActorCanManageLinkedHardAssets,
    getCacheRegionId,
    loadHardAssetsByIds,
    normalizeAudienceMode,
    parseLinkedHardAssetIds,
    resolveAssetOwner,
} from '../utils/softAssetScope.js';

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
        const role = normalizeRole(user?.role);
        const boundaryContext = await loadScopedBoundaryContext(db, user);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);

        const options = {
            with: softAssetWithRelations,
            orderBy: [desc(softAssets.updatedAt)],
        };

        if ((role === 'regional_admin' || role === 'partner') && Array.isArray(user?.subregionIds) && user.subregionIds.length > 0) {
            options.where = inArray(softAssets.subregionId, user.subregionIds);
        }

        const assets = await db.query.softAssets.findMany(options);
        const formatted = assets
            .filter((asset) => isAssetVisible(asset, user, { ownerPartner: asset.partner, allowedPartnerAudienceIds, allowedAudienceZoneIds }))
            .map((asset) => ({ raw: asset, formatted: formatSoftAsset(asset, boundaryContext, user, allowedPartnerAudienceIds, allowedAudienceZoneIds) }))
            .filter(({ raw, formatted }) => canExposeFormattedSoftAsset(raw, formatted))
            .map(({ formatted }) => formatted);

        return c.json(formatted);
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

        const asset = await loadSoftAssetById(db, id);
        if (!asset || !isAssetVisible(asset, user, { ownerPartner: asset.partner, allowedPartnerAudienceIds, allowedAudienceZoneIds })) {
            return c.json({ error: 'Not found' }, 404);
        }

        const formatted = formatSoftAsset(asset, boundaryContext, user, allowedPartnerAudienceIds, allowedAudienceZoneIds);
        if (!canExposeFormattedSoftAsset(asset, formatted)) {
            return c.json({ error: 'Not found' }, 404);
        }

        return c.json(formatted);
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

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Only partners and admins can create resources' }, 403);
        }

        const body = await c.req.json();
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
            isHidden,
            hideFrom,
            hideUntil,
            contactPhone,
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

        const linkedIds = parseLinkedHardAssetIds(body);
        const linkedHardAssets = await loadHardAssetsByIds(db, linkedIds);
        if (linkedHardAssets.length !== linkedIds.length) {
            return c.json({ error: 'One or more linked places were not found.' }, 404);
        }
        ensureActorCanManageLinkedHardAssets(user, linkedHardAssets);

        const finalSubregionId = determineSoftSubregion(user, body, linkedHardAssets);
        const { owner } = await resolveAssetOwner(db, user, body, finalSubregionId);
        const audienceMode = normalizeAudienceMode(body, owner);
        const audienceZoneIds = audienceMode === 'audience_zones'
            ? normalizeAudienceZoneIds(body?.audienceZoneIds)
            : [];

        if (audienceMode === 'audience_zones') {
            if (audienceZoneIds.length === 0) {
                return c.json({ error: 'Select at least one audience zone for audience-zone offerings.' }, 400);
            }
            await assertManageableAudienceZones(db, user, audienceZoneIds);
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
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
            ctaLabel: ctaLabel || null,
            ctaUrl: ctaUrl || null,
            venueNote: venueNote || null,
            availabilityEnabled: normalizeAvailabilityEnabled(availabilityEnabled),
            availabilityCount: normalizeAvailabilityCount(availabilityCount),
            availabilityUnit: normalizeAvailabilityUnit(availabilityUnit),
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
            await syncAssetTags(db, asset.id, 'soft', newTags);
            await syncSoftAssetAudienceZones(db, asset.id, audienceZoneIds);
        } catch (syncError) {
            await db.delete(softAssets).where(eq(softAssets.id, asset.id));
            throw syncError;
        }

        await rebuildSoftAssetCaches([finalSubregionId], c.env, user);

        return c.json(asset, 201);
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

        const body = await c.req.json();
        const nextAvailabilityEnabled = body?.availabilityEnabled !== undefined
            ? Boolean(body.availabilityEnabled)
            : normalizeAvailabilityEnabled(existing.availabilityEnabled);

        const nextAvailabilityCount = body?.availabilityCount !== undefined
            ? Number.parseInt(body.availabilityCount, 10)
            : normalizeAvailabilityCount(existing.availabilityCount);
        const nextAvailabilityUnit = body?.availabilityUnit !== undefined
            ? normalizeAvailabilityUnit(body.availabilityUnit)
            : normalizeAvailabilityUnit(existing.availabilityUnit);

        if (!Number.isInteger(nextAvailabilityCount) || nextAvailabilityCount < 0) {
            return c.json({ error: 'Availability count must be a non-negative whole number.' }, 400);
        }

        await db.update(softAssets).set({
            availabilityEnabled: nextAvailabilityEnabled,
            availabilityCount: nextAvailabilityCount,
            availabilityUnit: nextAvailabilityUnit,
            updatedAt: new Date(),
        }).where(eq(softAssets.id, id));

        await rebuildSoftAssetCaches([existing.subregionId], c.env, user);

        const boundaryContext = await loadScopedBoundaryContext(db, user);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);
        const refreshed = await loadSoftAssetById(db, id);
        if (!refreshed) {
            return c.json({ error: 'Not found' }, 404);
        }

        return c.json(
            formatSoftAsset(refreshed, boundaryContext, user, allowedPartnerAudienceIds, allowedAudienceZoneIds)
        );
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

        const body = await c.req.json();

        if (isChildSoftAsset(existing)) {
            const patch = buildChildEditablePatch(body, existing);
            await db.update(softAssets).set(patch).where(eq(softAssets.id, id));
            await rebuildSoftAssetCaches([existing.subregionId], c.env, user);
            return c.json({ success: true, id, assetMode: existing.assetMode });
        }

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

        const finalSubregionId = determineSoftSubregion(user, body, linkedHardAssets);

        let owner = existing.partner || null;
        if (role === 'partner') {
            owner = user;
        } else if (body.partnerId !== undefined || body.ownershipMode !== undefined) {
            const resolvedOwner = await resolveAssetOwner(db, user, body, finalSubregionId);
            owner = resolvedOwner.owner;
        }

        const audienceMode = normalizeAudienceMode(body.audienceMode ?? existing.audienceMode, owner);
        const existingAudienceZoneIds = existing.audienceZones.map((entry) => entry.audienceZone.id);
        const nextAudienceZoneIds = audienceMode === 'audience_zones'
            ? (body.audienceZoneIds !== undefined ? normalizeAudienceZoneIds(body.audienceZoneIds) : existingAudienceZoneIds)
            : [];

        if (audienceMode === 'audience_zones') {
            if (nextAudienceZoneIds.length === 0) {
                return c.json({ error: 'Select at least one audience zone for audience-zone offerings.' }, 400);
            }
            await assertManageableAudienceZones(db, user, nextAudienceZoneIds);
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
            contactPhone: body.contactPhone !== undefined ? (body.contactPhone || null) : existing.contactPhone,
            contactEmail: body.contactEmail !== undefined ? (body.contactEmail || null) : existing.contactEmail,
            ctaLabel: body.ctaLabel !== undefined ? (body.ctaLabel || null) : existing.ctaLabel,
            ctaUrl: body.ctaUrl !== undefined ? (body.ctaUrl || null) : existing.ctaUrl,
            venueNote: body.venueNote !== undefined ? (body.venueNote || null) : existing.venueNote,
            availabilityEnabled: body.availabilityEnabled !== undefined ? Boolean(body.availabilityEnabled) : existing.availabilityEnabled,
            availabilityCount: body.availabilityCount !== undefined ? normalizeAvailabilityCount(body.availabilityCount) : normalizeAvailabilityCount(existing.availabilityCount),
            availabilityUnit: body.availabilityUnit !== undefined ? normalizeAvailabilityUnit(body.availabilityUnit) : normalizeAvailabilityUnit(existing.availabilityUnit),
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

        await rebuildSoftAssetCaches([finalSubregionId, existing.subregionId], c.env, user);

        return c.json({ success: true, id, assetMode: existing.assetMode || SOFT_ASSET_MODES.STANDALONE });
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

        const existing = await loadSoftAssetById(db, id);
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to delete this asset' }, 403);
        }

        await db.update(softAssets).set({
            isDeleted: true,
            updatedAt: new Date(),
        }).where(eq(softAssets.id, id));
        await rebuildSoftAssetCaches([existing.subregionId], c.env, user);

        return c.json({ success: true });
    } catch (err) {
        console.error('deleteSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to delete soft asset' }, err.status || 500);
    }
};
