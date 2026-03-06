import { getDb } from '../db/index.js';
import { tags } from '../db/schema.js';
import { ilike } from 'drizzle-orm';
import { env } from 'hono/adapter';

export const getTags = async (c) => {
    try {
        const q = c.req.query('q') || '';
        const db = getDb(env(c));
        const allTags = await db.select().from(tags).where(ilike(tags.name, `%${q}%`)).limit(20);
        return c.json(allTags.map(t => t.name));
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch tags' }, 500);
    }
};
