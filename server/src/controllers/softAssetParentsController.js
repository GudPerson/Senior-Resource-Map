import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { softAssetParents, softAssets } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    assertManageableAudienceZones,
    getAssetAudienceZones,
    normalizeAudienceZoneIds,
    syncSoftAssetParentAudienceZones,
} from '../utils/audienceZones.js';
import { actorCanManageAsset } from '../utils/ownership.js';
import { normalizeEligibilityRules } from '../utils/eligibility.js';
import { normalizeRole } from '../utils/roles.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import {
    buildChildPropagationPatch,
    buildChildValuesFromParent,
    getMissingChildHostIds,
    normalizeGalleryUrls,
    normalizeOverrideFields,
    normalizeTagList,
} from '../utils/softAssetHierarchy.js';
import { normalizeSoftAssetBucket } from '../utils/softAssetBuckets.js';
import { buildChildExternalKey, resolveOrCreateExternalKey } from '../utils/externalKeys.js';
import {
    clientError,
    ensureActorCanManageLinkedHardAssets,
    getCacheRegionId,
    loadHardAssetsByIds,
    normalizeAudienceMode,
    normalizeOwnershipMode,
    parseLinkedHardAssetIds,
    resolveAssetOwner,
} from '../utils/softAssetScope.js';
import { syncAssetTags } from '../utils/tags.js';

const baseParentColumns = {
    id: true,
    externalKey: true,
    partnerId: true,
    createdByUserId: true,
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
    isDeleted: true,
    updatedAt: true,
    createdAt: true,
};

function canManageSoftAssetParent(actor, parent, ownerUser) {
    const actorRole = normalizeRole(actor?.role);

    if (!actor || !parent) return false;
    if (actorRole === 'super_admin') return true;
    if (actorRole === 'partner') return parent.partnerId === actor.id;

    if (actorRole === 'regional_admin') {
        if (parent.partnerId) {
            return ownerUser?.id === parent.partnerId && ownerUser?.managerUserId === actor.id;
        }

        return parent.createdByUserId === actor.id;
    }

    return false;
}

function formatSoftAssetParent(parent, options = {}) {
    const activeChildren = (parent.children || []).filter((child) => !child.isDeleted);
    const audienceZones = getAssetAudienceZones(parent);
    const formattedChildren = options.includeChildren
        ? activeChildren.map((child) => ({
            id: child.id,
            assetMode: child.assetMode,
            hostHardAssetId: child.hostHardAssetId,
            hostLocation: child.hostHardAsset || null,
            subregionId: child.subregionId,
            isHidden: Boolean(child.isHidden),
            overriddenFields: normalizeOverrideFields(child.overriddenFields),
            updatedAt: child.updatedAt,
        }))
        : undefined;

    return {
        id: parent.id,
        externalKey: parent.externalKey || null,
        name: parent.name,
        bucket: parent.bucket || null,
        subCategory: parent.subCategory,
        description: parent.description,
        schedule: parent.schedule,
        logoUrl: parent.logoUrl,
        bannerUrl: parent.bannerUrl,
        galleryUrls: Array.isArray(parent.galleryUrls) ? parent.galleryUrls : [],
        audienceMode: parent.audienceMode || 'public',
        isMemberOnly: Boolean(parent.isMemberOnly),
        eligibilityRules: parent.eligibilityRules || null,
        tags: Array.isArray(parent.tags) ? parent.tags : [],
        partnerId: parent.partnerId,
        partnerName: parent.partner?.name || null,
        partnerRole: parent.partner?.role ? normalizeRole(parent.partner.role) : null,
        ownershipMode: parent.partnerId ? 'partner' : 'system',
        creatorName: parent.creator?.name || null,
        updatedAt: parent.updatedAt,
        createdAt: parent.createdAt,
        childCount: activeChildren.length,
        liveChildCount: activeChildren.filter((child) => !child.isHidden).length,
        hiddenChildCount: activeChildren.filter((child) => child.isHidden).length,
        overriddenChildCount: activeChildren.filter((child) => normalizeOverrideFields(child.overriddenFields).length > 0).length,
        audienceZones,
        audienceZoneIds: audienceZones.map((zone) => zone.id),
        ...(options.includeChildren ? { children: formattedChildren } : {}),
    };
}

function buildParentPatch(body, existingParent, owner, audienceMode) {
    return {
        partnerId: owner?.id || null,
        name: body.name ?? existingParent.name,
        bucket: body.bucket !== undefined ? normalizeSoftAssetBucket(body.bucket, null) : (existingParent.bucket || null),
        subCategory: body.subCategory !== undefined ? (body.subCategory || 'Programmes') : existingParent.subCategory,
        description: body.description !== undefined ? (body.description || null) : existingParent.description,
        schedule: body.schedule !== undefined ? (body.schedule || null) : existingParent.schedule,
        logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : existingParent.logoUrl,
        bannerUrl: body.bannerUrl !== undefined ? (body.bannerUrl || null) : existingParent.bannerUrl,
        galleryUrls: body.galleryUrls !== undefined ? normalizeGalleryUrls(body.galleryUrls) : (Array.isArray(existingParent.galleryUrls) ? existingParent.galleryUrls : []),
        audienceMode,
        isMemberOnly: body.isMemberOnly !== undefined ? Boolean(body.isMemberOnly) : Boolean(existingParent.isMemberOnly),
        eligibilityRules: body.eligibilityRules !== undefined
            ? normalizeEligibilityRules(body.eligibilityRules)
            : (existingParent.eligibilityRules || null),
        tags: body.newTags !== undefined
            ? normalizeTagList(body.newTags)
            : (body.tags !== undefined ? normalizeTagList(body.tags) : (Array.isArray(existingParent.tags) ? existingParent.tags : [])),
        updatedAt: new Date(),
    };
}

async function loadParentDetail(db, id) {
    return db.query.softAssetParents.findFirst({
        where: eq(softAssetParents.id, id),
        columns: baseParentColumns,
        with: {
            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
            creator: { columns: { id: true, name: true } },
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
            children: {
                columns: {
                    id: true,
                    assetMode: true,
                    hostHardAssetId: true,
                    subregionId: true,
                    isHidden: true,
                    isDeleted: true,
                    overriddenFields: true,
                    updatedAt: true,
                },
                with: {
                    hostHardAsset: true,
                },
            },
        },
    });
}

export const getSoftAssetParents = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Only partners and admins can view templates' }, 403);
        }

        const parents = await db.query.softAssetParents.findMany({
            where: eq(softAssetParents.isDeleted, false),
            columns: baseParentColumns,
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                creator: { columns: { id: true, name: true } },
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
                children: {
                    columns: {
                        id: true,
                        isHidden: true,
                        isDeleted: true,
                        overriddenFields: true,
                    },
                },
            },
            orderBy: [desc(softAssetParents.updatedAt)],
        });

        const visibleParents = parents
            .filter((parent) => canManageSoftAssetParent(user, parent, parent.partner))
            .map((parent) => formatSoftAssetParent(parent));

        return c.json(visibleParents);
    } catch (err) {
        console.error('getSoftAssetParents Error:', err);
        return c.json({ error: err.message || 'Failed to fetch offering templates' }, err.status || 500);
    }
};

export const getSoftAssetParentById = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const parent = await loadParentDetail(db, id);
        if (!parent || parent.isDeleted) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!canManageSoftAssetParent(user, parent, parent.partner)) {
            return c.json({ error: 'Insufficient permissions to view this template' }, 403);
        }

        return c.json(formatSoftAssetParent(parent, { includeChildren: true }));
    } catch (err) {
        console.error('getSoftAssetParentById Error:', err);
        return c.json({ error: err.message || 'Failed to fetch offering template' }, err.status || 500);
    }
};

export const createSoftAssetParent = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Only partners and admins can create templates' }, 403);
        }

        const body = await c.req.json();
        if (!body?.name) {
            return c.json({ error: 'Name is required' }, 400);
        }

        const ownershipMode = normalizeOwnershipMode(role, body);
        const { owner } = await resolveAssetOwner(db, user, { ...body, ownershipMode }, null);
        const audienceMode = normalizeAudienceMode(body, owner);
        const audienceZoneIds = audienceMode === 'audience_zones'
            ? normalizeAudienceZoneIds(body?.audienceZoneIds)
            : [];
        if (audienceMode === 'audience_zones') {
            if (audienceZoneIds.length === 0) {
                return c.json({ error: 'Select at least one audience zone for audience-zone templates.' }, 400);
            }
            await assertManageableAudienceZones(db, user, audienceZoneIds);
        }
        const values = buildParentPatch(body, {}, owner, audienceMode);

        const [parent] = await db.insert(softAssetParents).values({
            ...values,
            externalKey: await resolveOrCreateExternalKey(db, softAssetParents, softAssetParents.externalKey, {
                requestedKey: body.externalKey,
                prefix: 'template',
                name: body.name,
            }),
            createdByUserId: user.id,
        }).returning();
        await syncSoftAssetParentAudienceZones(db, parent.id, audienceZoneIds);

        const created = await loadParentDetail(db, parent.id);
        return c.json(formatSoftAssetParent(created, { includeChildren: true }), 201);
    } catch (err) {
        console.error('createSoftAssetParent Error:', err);
        return c.json({ error: err.message || 'Failed to create offering template' }, err.status || 500);
    }
};

export const updateSoftAssetParent = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadParentDetail(db, id);
        if (!existing || existing.isDeleted) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!canManageSoftAssetParent(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to edit this template' }, 403);
        }

        const body = await c.req.json();
        let owner = existing.partner || null;
        if (role === 'partner') {
            owner = user;
        } else if (body.partnerId !== undefined || body.ownershipMode !== undefined) {
            const resolvedOwner = await resolveAssetOwner(db, user, body, null);
            owner = resolvedOwner.owner;
        }

        const audienceMode = normalizeAudienceMode(body.audienceMode ?? existing.audienceMode, owner);
        const existingAudienceZoneIds = getAssetAudienceZones(existing).map((zone) => zone.id);
        const nextAudienceZoneIds = audienceMode === 'audience_zones'
            ? (body.audienceZoneIds !== undefined ? normalizeAudienceZoneIds(body.audienceZoneIds) : existingAudienceZoneIds)
            : [];
        if (audienceMode === 'audience_zones') {
            if (nextAudienceZoneIds.length === 0) {
                return c.json({ error: 'Select at least one audience zone for audience-zone templates.' }, 400);
            }
            await assertManageableAudienceZones(db, user, nextAudienceZoneIds);
        }
        const patch = buildParentPatch(body, existing, owner, audienceMode);

        await db.update(softAssetParents).set(patch).where(eq(softAssetParents.id, id));
        await syncSoftAssetParentAudienceZones(db, id, nextAudienceZoneIds);
        const refreshed = await loadParentDetail(db, id);

        const affectedSubregions = new Set();
        for (const child of existing.children || []) {
            if (child.isDeleted) continue;
            const childPatch = buildChildPropagationPatch(refreshed, child);
            await db.update(softAssets).set(childPatch).where(eq(softAssets.id, child.id));
            await syncAssetTags(db, child.id, 'soft', refreshed.tags || []);
            if (Number.isInteger(child.subregionId)) {
                affectedSubregions.add(child.subregionId);
            }
        }

        for (const subregionId of affectedSubregions) {
            try {
                await rebuildMapCache(getCacheRegionId(subregionId, user.subregionId, user.subregionIds?.[0]), c.env);
            } catch (cacheErr) {
                console.error('Cache err', cacheErr);
            }
        }

        const updated = await loadParentDetail(db, id);
        return c.json(formatSoftAssetParent(updated, { includeChildren: true }));
    } catch (err) {
        console.error('updateSoftAssetParent Error:', err);
        return c.json({ error: err.message || 'Failed to update offering template' }, err.status || 500);
    }
};

export const deleteSoftAssetParent = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadParentDetail(db, id);
        if (!existing || existing.isDeleted) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!canManageSoftAssetParent(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to delete this template' }, 403);
        }

        await db.update(softAssetParents).set({
            isDeleted: true,
            updatedAt: new Date(),
        }).where(eq(softAssetParents.id, id));

        const affectedSubregions = new Set();
        for (const child of existing.children || []) {
            if (child.isDeleted) continue;
            await db.update(softAssets).set({
                isDeleted: true,
                updatedAt: new Date(),
            }).where(eq(softAssets.id, child.id));
            if (Number.isInteger(child.subregionId)) {
                affectedSubregions.add(child.subregionId);
            }
        }

        for (const subregionId of affectedSubregions) {
            try {
                await rebuildMapCache(getCacheRegionId(subregionId, user.subregionId, user.subregionIds?.[0]), c.env);
            } catch (cacheErr) {
                console.error('Cache err', cacheErr);
            }
        }

        return c.json({ success: true });
    } catch (err) {
        console.error('deleteSoftAssetParent Error:', err);
        return c.json({ error: err.message || 'Failed to delete offering template' }, err.status || 500);
    }
};

export const generateSoftAssetChildren = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const parent = await loadParentDetail(db, id);
        if (!parent || parent.isDeleted) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!canManageSoftAssetParent(user, parent, parent.partner)) {
            return c.json({ error: 'Insufficient permissions to generate children for this template' }, 403);
        }

        const body = await c.req.json();
        const requestedHostIds = parseLinkedHardAssetIds(body, ['hostIds', 'locationIds']);
        if (requestedHostIds.length === 0) {
            return c.json({ error: 'At least one host is required.' }, 400);
        }

        const hosts = await loadHardAssetsByIds(db, requestedHostIds);
        if (hosts.length !== requestedHostIds.length) {
            return c.json({ error: 'One or more selected hosts were not found.' }, 404);
        }
        ensureActorCanManageLinkedHardAssets(user, hosts);

        if (parent.partnerId) {
            const mismatchedHost = hosts.find((host) => host.partnerId !== parent.partnerId);
            if (mismatchedHost) {
                throw clientError(`Host "${mismatchedHost.name}" is not owned by the template partner.`, 400);
            }
        }

        const existingChildren = await db.query.softAssets.findMany({
            where: and(
                eq(softAssets.parentSoftAssetId, parent.id),
                eq(softAssets.assetMode, 'child')
            ),
            columns: {
                id: true,
                hostHardAssetId: true,
                isDeleted: true,
            },
        });

        const missingHostIds = getMissingChildHostIds(existingChildren, requestedHostIds);
        const skippedHostIds = requestedHostIds.filter((hostId) => !missingHostIds.includes(hostId));
        const created = [];

        for (const host of hosts) {
            if (!missingHostIds.includes(host.id)) continue;

            const [child] = await db.insert(softAssets).values(
                buildChildValuesFromParent(
                    parent,
                    host,
                    user,
                    await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
                        requestedKey: buildChildExternalKey(parent.externalKey, host.externalKey),
                        prefix: 'rollout',
                        name: `${parent.name} ${host.name}`,
                    })
                )
            ).returning();
            await syncAssetTags(db, child.id, 'soft', parent.tags || []);
            created.push(child);
        }

        return c.json({
            parentId: parent.id,
            createdCount: created.length,
            skippedCount: skippedHostIds.length,
            createdChildren: created,
            skippedHostIds,
        }, 201);
    } catch (err) {
        console.error('generateSoftAssetChildren Error:', err);
        return c.json({ error: err.message || 'Failed to generate child offerings' }, err.status || 500);
    }
};

export const getSoftAssetParentChildren = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const parent = await loadParentDetail(db, id);
        if (!parent || parent.isDeleted) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!canManageSoftAssetParent(user, parent, parent.partner)) {
            return c.json({ error: 'Insufficient permissions to view this template' }, 403);
        }

        return c.json(formatSoftAssetParent(parent, { includeChildren: true }).children || []);
    } catch (err) {
        console.error('getSoftAssetParentChildren Error:', err);
        return c.json({ error: err.message || 'Failed to fetch child offerings' }, err.status || 500);
    }
};
