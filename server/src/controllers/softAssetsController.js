import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { hardAssets, softAssets, softAssetLocations, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { actorCanManageAsset, canAssignPartnerOwner } from '../utils/ownership.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { loadScopedBoundaryContext, resolveSoftAssetBoundaryStatus } from '../utils/subregionBoundaryStatus.js';

const getCacheRegionId = (...ids) => ids.find((value) => value !== undefined && value !== null && value !== '') || 'all';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function loadPartnerUser(db, partnerId) {
    if (!Number.isInteger(partnerId)) return null;

    const partner = await db.query.users.findFirst({
        where: eq(users.id, partnerId),
        columns: {
            id: true,
            name: true,
            username: true,
            role: true,
            managerUserId: true,
        },
        with: {
            subregions: {
                columns: {
                    subregionId: true,
                },
            },
        },
    });

    if (!partner) return null;
    return {
        ...partner,
        role: normalizeRole(partner.role),
        subregionIds: partner.subregions.map((item) => item.subregionId),
    };
}

async function loadHardAssetsByIds(db, ids) {
    const uniqueIds = [...new Set((ids || []).map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger))];
    if (uniqueIds.length === 0) return [];

    return await db.query.hardAssets.findMany({
        where: inArray(hardAssets.id, uniqueIds),
        columns: {
            id: true,
            name: true,
            subregionId: true,
            postalCode: true,
            lat: true,
            lng: true,
            isHidden: true,
            hideFrom: true,
            hideUntil: true,
            isDeleted: true,
            partnerId: true,
        },
        with: {
            partner: {
                columns: {
                    id: true,
                    name: true,
                    role: true,
                    managerUserId: true,
                },
            },
        },
    });
}

function parseLinkedHardAssetIds(body) {
    if (Array.isArray(body?.locationIds)) {
        return body.locationIds.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger);
    }
    if (body?.locationId !== undefined && body?.locationId !== null && body?.locationId !== '') {
        const parsed = Number.parseInt(String(body.locationId), 10);
        return Number.isInteger(parsed) ? [parsed] : [];
    }
    return [];
}

function ensureActorCanManageLinkedHardAssets(actor, linkedHardAssets) {
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return;

    for (const hardAsset of linkedHardAssets) {
        if (!actorCanManageAsset(actor, hardAsset, hardAsset.partner)) {
            throw clientError(`Linked place "${hardAsset.name}" is outside your allowed scope.`, 403);
        }
    }
}

function ensureActorCanTargetSubregion(actor, subregionId) {
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return;
    if (!Array.isArray(actor?.subregionIds) || !actor.subregionIds.includes(subregionId)) {
        throw clientError('Target subregion is outside your allowed scope.', 403);
    }
}

function normalizeAudienceMode(body, owner) {
    const requestedMode = String(body?.audienceMode || 'public').trim() || 'public';
    if (!['public', 'partner_boundary'].includes(requestedMode)) {
        throw clientError('Invalid audience mode.', 400);
    }
    if (requestedMode === 'partner_boundary' && !owner?.id) {
        throw clientError('Partner-boundary audience is only allowed for partner-owned offerings.', 400);
    }
    return requestedMode;
}

function normalizeOwnershipMode(actorRole, body) {
    if (actorRole === 'partner') return 'partner';
    if (body?.ownershipMode === 'partner' || body?.partnerId) return 'partner';
    return 'system';
}

async function resolveAssetOwner(db, actor, body, subregionId) {
    const actorRole = normalizeRole(actor?.role);
    const ownershipMode = normalizeOwnershipMode(actorRole, body);

    if (actorRole === 'partner') {
        return { ownershipMode: 'partner', owner: actor };
    }

    if (ownershipMode === 'system') {
        return { ownershipMode: 'system', owner: null };
    }

    const partnerId = Number.parseInt(String(body?.partnerId ?? ''), 10);
    if (!Number.isInteger(partnerId)) {
        throw clientError('A partner owner is required for partner-owned offerings.', 400);
    }

    const owner = await loadPartnerUser(db, partnerId);
    if (!owner || normalizeRole(owner.role) !== 'partner') {
        throw clientError('Selected partner owner was not found.', 404);
    }
    if (!canAssignPartnerOwner(actor, owner, subregionId)) {
        throw clientError('Selected partner owner is outside your allowed scope.', 403);
    }

    return { ownershipMode: 'partner', owner };
}

function resolveExplicitSubregionId(body) {
    const parsed = Number.parseInt(String(body?.subregionId ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function determineSoftSubregion(actor, body, linkedHardAssets) {
    const actorRole = normalizeRole(actor?.role);
    const uniqueSubregionIds = [...new Set(linkedHardAssets.map((asset) => asset.subregionId).filter(Number.isInteger))];

    if (uniqueSubregionIds.length > 1) {
        throw clientError('Linked places must all belong to the same subregion.', 400);
    }

    if (uniqueSubregionIds.length === 1) {
        const targetSubregionId = uniqueSubregionIds[0];
        ensureActorCanTargetSubregion(actor, targetSubregionId);
        return targetSubregionId;
    }

    if (actorRole === 'partner') {
        const partnerSubregionId = actor?.subregionIds?.[0];
        if (!Number.isInteger(partnerSubregionId)) {
            throw clientError('Partner account is missing its assigned subregion.', 400);
        }
        return partnerSubregionId;
    }

    const explicitSubregionId = resolveExplicitSubregionId(body);
    if (!Number.isInteger(explicitSubregionId)) {
        throw clientError('A target subregion is required when no linked place is selected.', 400);
    }
    ensureActorCanTargetSubregion(actor, explicitSubregionId);
    return explicitSubregionId;
}

function formatSoftAsset(asset, boundaryContext, viewer, allowedPartnerAudienceIds) {
    const visibleLocations = asset.locations
        .map((entry) => entry.hardAsset)
        .filter((location) => isAssetVisible(location, viewer, { ownerPartner: location.partner, allowedPartnerAudienceIds }));

    return {
        ...asset,
        partnerName: asset.partner?.name || null,
        partnerRole: asset.partner?.role ? normalizeRole(asset.partner.role) : null,
        ownershipMode: asset.partnerId ? 'partner' : 'system',
        creatorName: asset.creator?.name || null,
        audienceMode: asset.audienceMode || 'public',
        tags: asset.tags.map((entry) => entry.tag.name),
        locations: visibleLocations,
        location: visibleLocations[0] || null,
        boundaryStatus: resolveSoftAssetBoundaryStatus(visibleLocations, boundaryContext),
    };
}

export const getSoftAssets = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db);
        const role = normalizeRole(user?.role);
        const boundaryContext = await loadScopedBoundaryContext(db, user);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);

        const options = {
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                creator: { columns: { id: true, name: true } },
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
            },
            orderBy: [desc(softAssets.updatedAt)],
        };

        if ((role === 'regional_admin' || role === 'partner') && Array.isArray(user?.subregionIds) && user.subregionIds.length > 0) {
            options.where = inArray(softAssets.subregionId, user.subregionIds);
        }

        const assets = await db.query.softAssets.findMany(options);
        const formatted = assets
            .filter((asset) => isAssetVisible(asset, user, { ownerPartner: asset.partner, allowedPartnerAudienceIds }))
            .map((asset) => formatSoftAsset(asset, boundaryContext, user, allowedPartnerAudienceIds));

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
        await ensureBoundarySchema(db);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const boundaryContext = await loadScopedBoundaryContext(db, user);

        const asset = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                creator: { columns: { id: true, name: true } },
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
            },
        });

        if (!asset || !isAssetVisible(asset, user, { ownerPartner: asset.partner, allowedPartnerAudienceIds })) {
            return c.json({ error: 'Not found' }, 404);
        }

        return c.json(formatSoftAsset(asset, boundaryContext, user, allowedPartnerAudienceIds));
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
        await ensureBoundarySchema(db);

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Only partners and admins can create resources' }, 403);
        }

        const body = await c.req.json();
        const { name, subCategory, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags = [], isMemberOnly, isHidden, hideFrom, hideUntil } = body;
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

        const [asset] = await db.insert(softAssets).values({
            partnerId: owner?.id || null,
            createdByUserId: user.id,
            subregionId: finalSubregionId,
            name,
            subCategory: subCategory || 'Programmes',
            description: description || null,
            schedule: schedule || null,
            logoUrl: logoUrl || null,
            bannerUrl: bannerUrl || null,
            galleryUrls: galleryUrls || [],
            audienceMode,
            isMemberOnly: isMemberOnly || false,
            isHidden: isHidden || false,
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
        } catch (syncError) {
            await db.delete(softAssets).where(eq(softAssets.id, asset.id));
            throw syncError;
        }

        try {
            await rebuildMapCache(getCacheRegionId(finalSubregionId, user.subregionId, user.subregionIds?.[0]), c.env);
        } catch (cacheErr) {
            console.error('Cache err', cacheErr);
        }

        return c.json(asset, 201);
    } catch (err) {
        console.error('createSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to create soft asset' }, err.status || 500);
    }
};

export const updateSoftAsset = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db);

        const existing = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                locations: {
                    with: {
                        hardAsset: {
                            with: {
                                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to edit this asset' }, 403);
        }

        const body = await c.req.json();
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

        const audienceMode = normalizeAudienceMode({ audienceMode: body.audienceMode ?? existing.audienceMode }, owner);

        await db.update(softAssets).set({
            partnerId: owner?.id || null,
            subregionId: finalSubregionId,
            name: body.name ?? existing.name,
            subCategory: body.subCategory !== undefined ? body.subCategory : existing.subCategory,
            description: body.description !== undefined ? (body.description || null) : existing.description,
            schedule: body.schedule !== undefined ? (body.schedule || null) : existing.schedule,
            logoUrl: body.logoUrl !== undefined ? body.logoUrl : existing.logoUrl,
            bannerUrl: body.bannerUrl !== undefined ? body.bannerUrl : existing.bannerUrl,
            galleryUrls: body.galleryUrls !== undefined ? body.galleryUrls : existing.galleryUrls,
            audienceMode,
            isMemberOnly: body.isMemberOnly !== undefined ? body.isMemberOnly : existing.isMemberOnly,
            isHidden: body.isHidden !== undefined ? body.isHidden : existing.isHidden,
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

        try {
            await rebuildMapCache(getCacheRegionId(finalSubregionId, existing.subregionId, user.subregionId, user.subregionIds?.[0]), c.env);
        } catch (cacheErr) {
            console.error('Cache err', cacheErr);
        }

        return c.json({ success: true, id });
    } catch (err) {
        console.error('updateSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to update soft asset' }, err.status || 500);
    }
};

export const deleteSoftAsset = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db);

        const existing = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
            },
        });

        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to delete this asset' }, 403);
        }

        await db.update(softAssets).set({ isDeleted: true }).where(eq(softAssets.id, id));
        try {
            await rebuildMapCache(getCacheRegionId(existing.subregionId, user.subregionId, user.subregionIds?.[0]), c.env);
        } catch (cacheErr) {
            console.error('Cache err', cacheErr);
        }

        return c.json({ success: true });
    } catch (err) {
        console.error('deleteSoftAsset Error:', err);
        return c.json({ error: err.message || 'Failed to delete soft asset' }, err.status || 500);
    }
};
