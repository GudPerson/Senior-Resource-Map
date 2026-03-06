import { getDb } from '../db/index.js';
import { userFavorites } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { env } from 'hono/adapter';

export const getFavorites = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        const favorites = await db.select().from(userFavorites).where(eq(userFavorites.userId, user.id));
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
        const body = await c.req.json();
        const { resourceType, resourceId } = body;

        if (!resourceType || !resourceId) {
            return c.json({ error: 'resourceType and resourceId are required' }, 400);
        }

        const [existing] = await db.select().from(userFavorites).where(
            and(
                eq(userFavorites.userId, user.id),
                eq(userFavorites.resourceType, resourceType),
                eq(userFavorites.resourceId, resourceId)
            )
        );

        if (existing) {
            await db.delete(userFavorites).where(eq(userFavorites.id, existing.id));
            return c.json({ success: true, action: 'removed' });
        } else {
            await db.insert(userFavorites).values({
                userId: user.id,
                resourceType,
                resourceId
            });
            return c.json({ success: true, action: 'added' });
        }
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to toggle favorite' }, 500);
    }
};
