import { getDb } from '../db/index.js';
import { userFavorites } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    buildSavedAssetSnapshot,
    createSavedAssetResolutionContext,
    hydrateSavedAssetRecord,
    resolveSavedAssetSummary,
} from '../utils/savedAssets.js';
import { positiveIntValueSchema, validateRequestBody } from '../utils/inputValidation.js';

const favoriteToggleBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
});

function normalizeResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    return ['hard', 'soft'].includes(type) ? type : null;
}

function parseResourceId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
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

export async function listSavedAssets(db, user, resolutionContext = null) {
    const favorites = await db.query.userFavorites.findMany({
        where: eq(userFavorites.userId, user.id),
        orderBy: [desc(userFavorites.createdAt)],
    });
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    return Promise.all(
        favorites.map((favorite) => hydrateSavedAssetRecord(db, user, favorite, finalResolutionContext))
    );
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
