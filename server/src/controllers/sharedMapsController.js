import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { myMapAssets, myMaps } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { buildMyMapDirectory, normalizeMyMapAssetSnapshot } from '../utils/myMapDirectory.js';
import { normalizeRole } from '../utils/roles.js';

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizeMapName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function assertCopyViewer(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can save a copy');
    }
}

async function loadSharedMapByToken(db, token, includeAssets = false) {
    return db.query.myMaps.findFirst({
        where: and(
            eq(myMaps.shareToken, token),
            eq(myMaps.isShared, true)
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

async function persistSnapshotUpdates(db, updates) {
    for (const update of updates || []) {
        await db.update(myMapAssets)
            .set({ snapshot: update.snapshot })
            .where(eq(myMapAssets.id, update.mapAssetId));
    }
}

async function requireSharedMap(db, token, includeAssets = false) {
    const map = await loadSharedMapByToken(db, token, includeAssets);
    if (!map) {
        throw createHttpError(404, 'This shared directory is no longer available');
    }
    return map;
}

async function resolveUniqueCopyName(db, userId, originalName) {
    const baseName = normalizeMapName(`Copy of ${originalName}`) || 'Copy of shared directory';
    const maps = await db.query.myMaps.findMany({
        where: eq(myMaps.userId, userId),
    });
    const names = new Set(maps.map((item) => normalizeMapName(item.name)));

    if (!names.has(baseName)) {
        return baseName;
    }

    let counter = 2;
    while (names.has(`${baseName} (${counter})`)) {
        counter += 1;
    }
    return `${baseName} (${counter})`;
}

export async function getSharedMapDirectory(db, token, viewerUser) {
    const map = await requireSharedMap(db, token, true);
    const { directory, snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser,
        visibilityUser: { role: 'guest' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'shared',
    });

    if (snapshotUpdates.length > 0) {
        await persistSnapshotUpdates(db, snapshotUpdates);
    }

    return directory;
}

export async function copySharedMapToMyMaps(db, viewerUser, token) {
    assertCopyViewer(viewerUser);
    const map = await requireSharedMap(db, token, true);

    if (viewerUser.id === map.userId) {
        throw createHttpError(409, 'You already own this map');
    }

    const name = await resolveUniqueCopyName(db, viewerUser.id, map.name);
    const [createdMap] = await db.insert(myMaps).values({
        userId: viewerUser.id,
        name,
        description: map.description || null,
        isShared: false,
        shareToken: null,
        shareUpdatedAt: null,
    }).returning();

    if ((map.assets || []).length > 0) {
        await db.insert(myMapAssets).values(
            map.assets.map((asset) => ({
                mapId: createdMap.id,
                resourceType: asset.resourceType,
                resourceId: asset.resourceId,
                snapshot: normalizeMyMapAssetSnapshot(asset.resourceType, asset.resourceId, asset.snapshot),
            }))
        );
    }

    return {
        id: createdMap.id,
        name: createdMap.name,
        description: createdMap.description || null,
        assetCount: (map.assets || []).length,
        isShared: false,
        shareToken: null,
        sharePath: null,
        shareUpdatedAt: null,
        createdAt: createdMap.createdAt,
        updatedAt: createdMap.updatedAt,
    };
}

export const getSharedMap = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const token = String(c.req.param('token') || '').trim();
        if (!token) {
            return c.json({ error: 'Share token is required' }, 400);
        }
        const viewerUser = c.get('user');
        const directory = await getSharedMapDirectory(db, token, viewerUser);
        return c.json(directory);
    } catch (err) {
        console.error('getSharedMap Error:', err);
        return c.json({ error: err.message || 'Failed to fetch shared directory' }, err.status || 500);
    }
};

export const postSharedMapCopy = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const token = String(c.req.param('token') || '').trim();
        if (!token) {
            return c.json({ error: 'Share token is required' }, 400);
        }
        const viewerUser = c.get('user');
        const copied = await copySharedMapToMyMaps(db, viewerUser, token);
        return c.json(copied, 201);
    } catch (err) {
        console.error('postSharedMapCopy Error:', err);
        return c.json({ error: err.message || 'Failed to save a copy of this directory' }, err.status || 500);
    }
};
