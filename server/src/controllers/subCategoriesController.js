import { getDb } from '../db/index.js';
import { subCategories } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from 'hono/adapter';

export const getSubCategories = async (c) => {
    try {
        const db = getDb(env(c));
        const categories = await db.select().from(subCategories);
        return c.json(categories);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch sub-categories' }, 500);
    }
};

export const createSubCategory = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(env(c));
        const body = await c.req.json();
        const { name, type, color } = body;
        if (!name || !type) return c.json({ error: 'Name and type are required' }, 400);
        if (user.role !== 'admin' && user.role !== 'super_admin') return c.json({ error: 'Only admins can create sub-categories' }, 403);

        const [existing] = await db.select().from(subCategories).where(eq(subCategories.name, name));
        if (existing) return c.json({ error: 'Sub-category already exists' }, 400);

        const [created] = await db.insert(subCategories).values({ name, type, color: color || '#3b82f6' }).returning();
        return c.json(created);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to create sub-category' }, 500);
    }
};

export const deleteSubCategory = async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'super_admin') return c.json({ error: 'Only admins can delete sub-categories' }, 403);

        const db = getDb(env(c));
        const id = parseInt(c.req.param('id'));
        await db.delete(subCategories).where(eq(subCategories.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete sub-category' }, 500);
    }
};
