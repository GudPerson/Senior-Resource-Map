import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import { myMapAssets, myMaps, userFavorites } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    createSavedAssetResolutionContext,
} from '../utils/savedAssets.js';
import {
    buildLiveMyMapAssetSnapshotFromDb,
    buildMyMapDirectory,
    normalizeMyMapAssetSnapshot,
} from '../utils/myMapDirectory.js';
import { normalizeRole } from '../utils/roles.js';
import { createShareToken } from '../utils/shareTokens.js';
import {
    optionalTextSchema,
    positiveIntValueSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';

const mapAssetRefBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
});

const createMyMapBodySchema = z.object({
    name: requiredOneLineTextSchema('Map name', 160),
    description: optionalTextSchema(2000),
    assets: z.array(mapAssetRefBodySchema).max(500).optional(),
});

const updateMyMapBodySchema = z.object({
    name: requiredOneLineTextSchema('Map name', 160),
    description: optionalTextSchema(2000),
});

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function assertDirectoryUser(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can manage My Maps');
    }
}

function parseMapId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMapName(value) {
    const text = String(value ?? '').trim();
    return text ? text : null;
}

function normalizeMapDescription(value) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    return text ? text : null;
}

function normalizeResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    return type === 'hard' || type === 'soft' ? type : null;
}

function parseResourceId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseAssetRef(value) {
    const resourceType = normalizeResourceType(value?.resourceType);
    const resourceId = parseResourceId(value?.resourceId);
    if (!resourceType || !resourceId) return null;
    return { resourceType, resourceId };
}

function parseAssetRefs(values) {
    if (!Array.isArray(values)) return [];

    const unique = new Map();
    values.forEach((value) => {
        const parsed = parseAssetRef(value);
        if (!parsed) return;
        unique.set(`${parsed.resourceType}:${parsed.resourceId}`, parsed);
    });

    return [...unique.values()];
}

function formatMyMapSummary(map) {
    const assetCount = Array.isArray(map?.assets) ? map.assets.length : Number(map?.assetCount || 0);
    return {
        id: map.id,
        name: map.name,
        description: map.description || null,
        assetCount,
        isShared: Boolean(map.isShared),
        shareToken: map.isShared ? (map.shareToken || null) : null,
        sharePath: map.isShared && map.shareToken ? `/shared/maps/${map.shareToken}` : null,
        shareUpdatedAt: map.shareUpdatedAt || null,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
    };
}

function serializeMyMapAssetRecord(mapAsset) {
    return {
        id: mapAsset.id,
        mapId: mapAsset.mapId,
        resourceType: mapAsset.resourceType,
        resourceId: mapAsset.resourceId,
        assetKey: `${mapAsset.resourceType}-${mapAsset.resourceId}`,
        addedAt: mapAsset.addedAt ?? null,
        snapshot: normalizeMyMapAssetSnapshot(mapAsset.resourceType, mapAsset.resourceId, mapAsset.snapshot),
    };
}

async function loadOwnedMap(db, userId, mapId, includeAssets = false) {
    return db.query.myMaps.findFirst({
        where: and(
            eq(myMaps.id, mapId),
            eq(myMaps.userId, userId)
        ),
        with: includeAssets
            ? {
                assets: {
                    columns: {
                        id: true,
                        resourceType: true,
                        resourceId: true,
                        snapshot: true,
                        addedAt: true,
                    },
                },
            }
            : undefined,
    });
}

async function requireOwnedMap(db, userId, mapId, includeAssets = false) {
    const map = await loadOwnedMap(db, userId, mapId, includeAssets);
    if (!map) {
        throw createHttpError(404, 'Map not found');
    }
    return map;
}

async function persistSnapshotUpdates(db, updates) {
    for (const update of updates || []) {
        await db.update(myMapAssets)
            .set({ snapshot: update.snapshot })
            .where(eq(myMapAssets.id, update.mapAssetId));
    }
}

async function findSavedAssetRecord(db, userId, resourceType, resourceId) {
    return db.query.userFavorites.findFirst({
        where: and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.resourceType, resourceType),
            eq(userFavorites.resourceId, resourceId)
        ),
    });
}

async function requireSavedAssetRecord(db, user, assetRef, resolutionContext = null) {
    const favorite = await findSavedAssetRecord(db, user.id, assetRef.resourceType, assetRef.resourceId);
    if (!favorite) {
        throw createHttpError(400, 'You can only add assets that are already saved');
    }

    return {
        ...favorite,
        snapshot: favorite.snapshot
            ? normalizeMyMapAssetSnapshot(assetRef.resourceType, assetRef.resourceId, favorite.snapshot)
            : (await buildLiveMyMapAssetSnapshotFromDb(db, assetRef.resourceType, assetRef.resourceId))
                || normalizeMyMapAssetSnapshot(assetRef.resourceType, assetRef.resourceId, null),
    };
}

async function touchMap(db, mapId) {
    await db.update(myMaps)
        .set({ updatedAt: new Date() })
        .where(eq(myMaps.id, mapId));
}

export async function listMyMaps(db, user) {
    assertDirectoryUser(user);
    const maps = await db.query.myMaps.findMany({
        where: eq(myMaps.userId, user.id),
        with: {
            assets: {
                columns: {
                    id: true,
                },
            },
        },
        orderBy: [desc(myMaps.updatedAt)],
    });

    return maps.map(formatMyMapSummary);
}

export async function createMyMap(db, user, body, resolutionContext = null) {
    assertDirectoryUser(user);
    const name = normalizeMapName(body?.name);
    if (!name) {
        throw createHttpError(400, 'Map name is required');
    }

    const assetRefs = parseAssetRefs(body?.assets);
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const savedRecords = [];

    for (const assetRef of assetRefs) {
        const favorite = await requireSavedAssetRecord(db, user, assetRef, finalResolutionContext);
        savedRecords.push(favorite);
    }

    const [createdMap] = await db.insert(myMaps).values({
        userId: user.id,
        name,
    }).returning();

    if (savedRecords.length > 0) {
        await db.insert(myMapAssets).values(
            savedRecords.map((favorite) => ({
                mapId: createdMap.id,
                resourceType: favorite.resourceType,
                resourceId: favorite.resourceId,
                snapshot: favorite.snapshot || null,
            }))
        );
    }

    const map = await requireOwnedMap(db, user.id, createdMap.id, true);
    return {
        ...formatMyMapSummary(map),
        assets: [],
    };
}

export async function getMyMapDetail(db, user, mapId, resolutionContext = null) {
    assertDirectoryUser(user);
    const map = await requireOwnedMap(db, user.id, mapId, true);
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const { directory, snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser: user,
        visibilityUser: user,
        resolutionContext: finalResolutionContext,
        mode: 'owner',
    });

    if (snapshotUpdates.length > 0) {
        await persistSnapshotUpdates(db, snapshotUpdates);
    }

    return directory;
}

export async function renameMyMap(db, user, mapId, body) {
    assertDirectoryUser(user);
    const name = normalizeMapName(body?.name);
    const description = normalizeMapDescription(body?.description);
    if (!name) {
        throw createHttpError(400, 'Map name is required');
    }

    await requireOwnedMap(db, user.id, mapId);
    await db.update(myMaps)
        .set({
            name,
            ...(description !== undefined ? { description } : {}),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function publishMyMap(db, user, mapId, resolutionContext = null) {
    assertDirectoryUser(user);
    const map = await requireOwnedMap(db, user.id, mapId, true);
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const { snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser: user,
        visibilityUser: user,
        resolutionContext: finalResolutionContext,
        mode: 'owner',
    });

    if (snapshotUpdates.length > 0) {
        await persistSnapshotUpdates(db, snapshotUpdates);
    }

    const shareToken = map.isShared && map.shareToken ? map.shareToken : createShareToken();
    await db.update(myMaps)
        .set({
            isShared: true,
            shareToken,
            shareUpdatedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function unpublishMyMap(db, user, mapId) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);
    await db.update(myMaps)
        .set({
            isShared: false,
            shareToken: null,
            shareUpdatedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function deleteMyMapRecord(db, user, mapId) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);
    await db.delete(myMaps)
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    return { success: true };
}

export async function addAssetToMyMap(db, user, mapId, body, resolutionContext = null) {
    assertDirectoryUser(user);
    const assetRef = parseAssetRef(body);
    if (!assetRef) {
        throw createHttpError(400, 'resourceType and resourceId are required');
    }

    const map = await requireOwnedMap(db, user.id, mapId);
    const favorite = await requireSavedAssetRecord(db, user, assetRef, resolutionContext);

    const existing = await db.query.myMapAssets.findFirst({
        where: and(
            eq(myMapAssets.mapId, map.id),
            eq(myMapAssets.resourceType, assetRef.resourceType),
            eq(myMapAssets.resourceId, assetRef.resourceId)
        ),
    });

    if (existing) {
        throw createHttpError(409, 'This asset is already in the map');
    }

    const [createdAsset] = await db.insert(myMapAssets).values({
        mapId: map.id,
        resourceType: assetRef.resourceType,
        resourceId: assetRef.resourceId,
        snapshot: favorite.snapshot || null,
    }).returning();

    await touchMap(db, map.id);
    return serializeMyMapAssetRecord(createdAsset);
}

export async function removeAssetFromMyMap(db, user, mapId, resourceType, resourceId) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);

    await db.delete(myMapAssets)
        .where(
            and(
                eq(myMapAssets.mapId, mapId),
                eq(myMapAssets.resourceType, resourceType),
                eq(myMapAssets.resourceId, resourceId)
            )
        );

    await touchMap(db, mapId);

    return {
        success: true,
        mapId,
        resourceType,
        resourceId,
    };
}

export const getMyMaps = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const maps = await listMyMaps(db, user);
        return c.json(maps);
    } catch (err) {
        console.error('getMyMaps Error:', err);
        return c.json({ error: err.message || 'Failed to fetch maps' }, err.status || 500);
    }
};

export const postMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(await c.req.json(), createMyMapBodySchema, 'Map details');
        const map = await createMyMap(db, user, body);
        return c.json(map, 201);
    } catch (err) {
        console.error('postMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to create map' }, err.status || 500);
    }
};

export const getMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const map = await getMyMapDetail(db, user, mapId);
        return c.json(map);
    } catch (err) {
        console.error('getMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to fetch map' }, err.status || 500);
    }
};

export const patchMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validateRequestBody(await c.req.json(), updateMyMapBodySchema, 'Map details');
        const map = await renameMyMap(db, user, mapId, body);
        return c.json(map);
    } catch (err) {
        console.error('patchMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to update map' }, err.status || 500);
    }
};

export const postMyMapShare = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const map = await publishMyMap(db, user, mapId);
        return c.json(map);
    } catch (err) {
        console.error('postMyMapShare Error:', err);
        return c.json({ error: err.message || 'Failed to publish share link' }, err.status || 500);
    }
};

export const deleteMyMapShare = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const map = await unpublishMyMap(db, user, mapId);
        return c.json(map);
    } catch (err) {
        console.error('deleteMyMapShare Error:', err);
        return c.json({ error: err.message || 'Failed to unpublish share link' }, err.status || 500);
    }
};

export const deleteMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const result = await deleteMyMapRecord(db, user, mapId);
        return c.json(result);
    } catch (err) {
        console.error('deleteMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to delete map' }, err.status || 500);
    }
};

export const postMyMapAsset = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validateRequestBody(await c.req.json(), mapAssetRefBodySchema, 'Map resource');
        const item = await addAssetToMyMap(db, user, mapId, body);
        return c.json(item, 201);
    } catch (err) {
        console.error('postMyMapAsset Error:', err);
        return c.json({ error: err.message || 'Failed to add asset to map' }, err.status || 500);
    }
};

export const deleteMyMapAsset = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const resourceType = normalizeResourceType(c.req.param('resourceType'));
        const resourceId = parseResourceId(c.req.param('resourceId'));
        if (!mapId || !resourceType || !resourceId) {
            return c.json({ error: 'Map id, resourceType, and resourceId are required' }, 400);
        }
        const result = await removeAssetFromMyMap(db, user, mapId, resourceType, resourceId);
        return c.json(result);
    } catch (err) {
        console.error('deleteMyMapAsset Error:', err);
        return c.json({ error: err.message || 'Failed to remove asset from map' }, err.status || 500);
    }
};
