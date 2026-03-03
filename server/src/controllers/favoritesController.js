import db from '../db/index.js';
import { userFavorites, hardAssets, softAssets } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const getFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user's favorites from DB
        const favorites = await db.select().from(userFavorites).where(eq(userFavorites.userId, userId));
        res.json(favorites);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
};

export const toggleFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { resourceType, resourceId } = req.body;

        if (!resourceType || !resourceId) {
            return res.status(400).json({ error: 'resourceType and resourceId are required' });
        }

        const [existing] = await db.select().from(userFavorites).where(
            and(
                eq(userFavorites.userId, userId),
                eq(userFavorites.resourceType, resourceType),
                eq(userFavorites.resourceId, resourceId)
            )
        );

        if (existing) {
            // Un-favorite
            await db.delete(userFavorites).where(eq(userFavorites.id, existing.id));
            res.json({ success: true, action: 'removed' });
        } else {
            // Favorite
            await db.insert(userFavorites).values({
                userId,
                resourceType,
                resourceId
            });
            res.json({ success: true, action: 'added' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
};
