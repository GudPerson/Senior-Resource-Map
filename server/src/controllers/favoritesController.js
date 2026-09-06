import { getDb } from '../db/index.js';
import { myMapAssets, myMaps, userFavorites } from '../db/schema.js';
import { eq, and, desc, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    buildSavedAssetSnapshot,
    createSavedAssetResolutionContext,
    hydrateSavedAssetRecord,
    hydrateSavedAssetRecords,
    hydrateSavedSoftAssetRecords,
    resolveSavedAssetSummary,
} from '../utils/savedAssets.js';
import { positiveIntValueSchema, validateRequestBody } from '../utils/inputValidation.js';

const favoriteToggleBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
});

const favoriteResourceRefSchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
});

const bulkRemoveUnusedBodySchema = z.object({
    resources: z.array(favoriteResourceRefSchema)
        .min(1, 'Choose at least one saved resource')
        .max(500, 'Choose no more than 500 saved resources at a time'),
});

function normalizeResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    return ['hard', 'soft'].includes(type) ? type : null;
}

function parseResourceId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function buildSavedAssetKey(resourceType, resourceId) {
    return `${resourceType}-${resourceId}`;
}

function normalizeResourceRefs(resources = []) {
    const seenKeys = new Set();

    return resources.reduce((items, resource) => {
        const resourceType = normalizeResourceType(resource?.resourceType);
        const resourceId = parseResourceId(resource?.resourceId);
        if (!resourceType || !resourceId) return items;

        const assetKey = buildSavedAssetKey(resourceType, resourceId);
        if (seenKeys.has(assetKey)) return items;
        seenKeys.add(assetKey);
        items.push({ resourceType, resourceId, assetKey });
        return items;
    }, []);
}

function buildResourceRefCondition(refs) {
    const hardIds = refs
        .filter((ref) => ref.resourceType === 'hard')
        .map((ref) => ref.resourceId);
    const softIds = refs
        .filter((ref) => ref.resourceType === 'soft')
        .map((ref) => ref.resourceId);
    const conditions = [];

    if (hardIds.length > 0) {
        conditions.push(and(
            eq(myMapAssets.resourceType, 'hard'),
            inArray(myMapAssets.resourceId, hardIds),
        ));
    }
    if (softIds.length > 0) {
        conditions.push(and(
            eq(myMapAssets.resourceType, 'soft'),
            inArray(myMapAssets.resourceId, softIds),
        ));
    }

    if (conditions.length === 0) return null;
    return conditions.length === 1 ? conditions[0] : or(...conditions);
}

export async function loadSavedAssetMyMapUsage(db, userId, resources = null) {
    const refs = resources === null ? null : normalizeResourceRefs(resources);
    if (refs && refs.length === 0) return new Map();

    const resourceCondition = refs ? buildResourceRefCondition(refs) : null;
    const rows = await db.select({
        resourceType: myMapAssets.resourceType,
        resourceId: myMapAssets.resourceId,
        mapId: myMaps.id,
    })
        .from(myMapAssets)
        .innerJoin(myMaps, eq(myMapAssets.mapId, myMaps.id))
        .where(and(
            eq(myMaps.userId, userId),
            ...(resourceCondition ? [resourceCondition] : []),
        ));
    const mapIdsByAssetKey = new Map();

    for (const row of rows) {
        const resourceType = normalizeResourceType(row?.resourceType);
        const resourceId = parseResourceId(row?.resourceId);
        if (!resourceType || !resourceId) continue;

        const assetKey = buildSavedAssetKey(resourceType, resourceId);
        if (!mapIdsByAssetKey.has(assetKey)) {
            mapIdsByAssetKey.set(assetKey, new Set());
        }
        mapIdsByAssetKey.get(assetKey).add(Number(row.mapId));
    }

    return new Map([...mapIdsByAssetKey.entries()].map(([assetKey, mapIds]) => [
        assetKey,
        {
            assetKey,
            resourceType: assetKey.startsWith('hard-') ? 'hard' : 'soft',
            resourceId: Number(assetKey.slice(assetKey.indexOf('-') + 1)),
            myMapCount: mapIds.size,
        },
    ]));
}

async function deleteSavedAssetRefs(db, userId, refs) {
    const removed = [];

    for (const resourceType of ['hard', 'soft']) {
        const resourceIds = refs
            .filter((ref) => ref.resourceType === resourceType)
            .map((ref) => ref.resourceId);
        if (resourceIds.length === 0) continue;

        const rows = await db.delete(userFavorites)
            .where(and(
                eq(userFavorites.userId, userId),
                eq(userFavorites.resourceType, resourceType),
                inArray(userFavorites.resourceId, resourceIds),
            ))
            .returning({
                resourceType: userFavorites.resourceType,
                resourceId: userFavorites.resourceId,
            });
        removed.push(...rows.map((row) => ({
            resourceType: row.resourceType,
            resourceId: Number(row.resourceId),
            assetKey: buildSavedAssetKey(row.resourceType, Number(row.resourceId)),
        })));
    }

    return removed;
}

export async function removeUnusedSavedAssets(db, user, resources = []) {
    const refs = normalizeResourceRefs(resources);
    const usageByAssetKey = await loadSavedAssetMyMapUsage(db, user.id, refs);
    const protectedItems = refs
        .filter((ref) => usageByAssetKey.has(ref.assetKey))
        .map((ref) => usageByAssetKey.get(ref.assetKey));
    const removableItems = refs.filter((ref) => !usageByAssetKey.has(ref.assetKey));
    const removed = await deleteSavedAssetRefs(db, user.id, removableItems);
    const removedKeys = new Set(removed.map((item) => item.assetKey));
    const notSaved = removableItems.filter((item) => !removedKeys.has(item.assetKey));

    return {
        success: true,
        requestedCount: refs.length,
        removedCount: removed.length,
        protectedCount: protectedItems.length,
        notSavedCount: notSaved.length,
        removed,
        notSaved,
        protected: protectedItems,
    };
}

async function findFavoriteRecord(db, userId, resourceType, resourceId) {
    return db.query.userFavorites.findFirst({
        where: and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.resourceType, resourceType),
            eq(userFavorites.resourceId, resourceId)
        ),
    });
}

function isUniqueConstraintViolation(err) {
    const message = String(err?.message || '').toLowerCase();
    return err?.code === '23505' || message.includes('duplicate key') || message.includes('unique');
}

function createEmptyResolutionContext() {
    return {
        allowedPartnerAudienceIds: new Set(),
        allowedAudienceZoneIds: new Set(),
    };
}

async function resolveListResolutionContext(db, user, resolutionContext) {
    if (resolutionContext) return resolutionContext;

    try {
        return await createSavedAssetResolutionContext(db, user);
    } catch (err) {
        console.warn('Saved asset audience context failed; using safe fallback.', {
            error: err?.message || 'Unknown error',
        });
        return createEmptyResolutionContext();
    }
}

export async function listSavedAssets(db, user, resolutionContext = null) {
    const favorites = await db.query.userFavorites.findMany({
        where: eq(userFavorites.userId, user.id),
        orderBy: [desc(userFavorites.createdAt)],
    });
    const finalResolutionContext = await resolveListResolutionContext(db, user, resolutionContext);
    return hydrateSavedAssetRecords(db, user, favorites, finalResolutionContext);
}

export async function listSavedSoftAssets(db, user, resolutionContext = null) {
    const favorites = await db.query.userFavorites.findMany({
        where: and(
            eq(userFavorites.userId, user.id),
            eq(userFavorites.resourceType, 'soft'),
        ),
        orderBy: [desc(userFavorites.createdAt)],
    });
    const finalResolutionContext = await resolveListResolutionContext(db, user, resolutionContext);
    return hydrateSavedSoftAssetRecords(db, user, favorites, finalResolutionContext);
}

export async function toggleSavedAsset(db, user, resourceType, resourceId, resolutionContext = null) {
    const existing = await findFavoriteRecord(db, user.id, resourceType, resourceId);

    if (existing) {
        await db.delete(userFavorites).where(
            and(
                eq(userFavorites.userId, user.id),
                eq(userFavorites.resourceType, resourceType),
                eq(userFavorites.resourceId, resourceId)
            )
        );

        return {
            success: true,
            action: 'removed',
            saved: false,
            resourceType,
            resourceId,
            item: null,
        };
    }

    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const resolved = await resolveSavedAssetSummary(db, user, resourceType, resourceId, finalResolutionContext);
    if (!resolved?.summary || resolved.status !== 'available') {
        const err = new Error('Resource unavailable');
        err.status = 404;
        throw err;
    }

    try {
        await db.insert(userFavorites).values({
            userId: user.id,
            resourceType,
            resourceId,
            snapshot: buildSavedAssetSnapshot(resolved.summary),
        });
    } catch (err) {
        if (!isUniqueConstraintViolation(err)) {
            throw err;
        }
    }

    const favorite = await findFavoriteRecord(db, user.id, resourceType, resourceId);
    const item = favorite
        ? await hydrateSavedAssetRecord(db, user, favorite, finalResolutionContext)
        : null;

    return {
        success: true,
        action: 'added',
        saved: true,
        resourceType,
        resourceId,
        item,
    };
}

export const getFavorites = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const favorites = await listSavedAssets(db, user);
        return c.json(favorites);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch favorites' }, 500);
    }
};

export const getFavoriteMapUsage = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const usageByAssetKey = await loadSavedAssetMyMapUsage(db, user.id);
        return c.json({ items: [...usageByAssetKey.values()] });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to load My Map usage' }, 500);
    }
};

export const bulkRemoveUnusedFavorites = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(
            await c.req.json().catch(() => ({})),
            bulkRemoveUnusedBodySchema,
            'Saved resources',
        );
        const result = await removeUnusedSavedAssets(db, user, body.resources);
        return c.json(result);
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to remove saved resources' }, err.status || 500);
    }
};

export const toggleFavorite = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(await c.req.json(), favoriteToggleBodySchema, 'Saved resource');
        const resourceType = normalizeResourceType(body?.resourceType);
        const resourceId = parseResourceId(body?.resourceId);

        if (!resourceType || !resourceId) {
            return c.json({ error: 'resourceType and resourceId are required' }, 400);
        }

        const result = await toggleSavedAsset(db, user, resourceType, resourceId);
        return c.json(result);
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to toggle favorite' }, err.status || 500);
    }
};
