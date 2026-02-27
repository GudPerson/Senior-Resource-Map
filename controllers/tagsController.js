import { db } from '../db/index.js';
import { tags } from '../db/schema.js';
import { ilike } from 'drizzle-orm';

export const getTags = async (req, res) => {
    try {
        const q = req.query.q || '';
        // Use ilike for case-insensitive Postgres matching
        const allTags = await db.select().from(tags).where(ilike(tags.name, `%${q}%`)).limit(20);
        res.json(allTags.map(t => t.name));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
};
