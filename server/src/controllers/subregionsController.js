import { getDb } from '../db/index.js';
import { subregions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from 'hono/adapter';

export const getSubregions = async (c) => {
    try {
        const db = getDb(c.env);
        const list = await db.query.subregions.findMany({
            orderBy: [subregions.name]
        });
        return c.json(list);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch subregions' }, 500);
    }
};

export const createSubregion = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Only Super Admins can create subregions' }, 403);
        }

        const body = await c.req.json();
        const { name, description } = body;
        if (!name) return c.json({ error: 'Name is required' }, 400);

        const db = getDb(c.env);
        const [newReg] = await db.insert(subregions).values({
            name,
            description
        }).returning();

        return c.json(newReg, 201);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to create subregion' }, 500);
    }
};

export const deleteSubregion = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Only Super Admins can delete subregions' }, 403);
        }

        const id = parseInt(c.req.param('id'));
        const db = getDb(c.env);

        await db.delete(subregions).where(eq(subregions.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete subregion' }, 500);
    }
};
