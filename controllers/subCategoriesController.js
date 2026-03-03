import db from '../db/index.js';
import { subCategories } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const getSubCategories = async (req, res) => {
    try {
        const categories = await db.select().from(subCategories);
        res.json(categories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch sub-categories' });
    }
};

export const createSubCategory = async (req, res) => {
    try {
        const { name, type, color } = req.body;
        if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create sub-categories' });

        const [existing] = await db.select().from(subCategories).where(eq(subCategories.name, name));
        if (existing) return res.status(400).json({ error: 'Sub-category already exists' });

        const [created] = await db.insert(subCategories).values({ name, type, color: color || '#3b82f6' }).returning();
        res.json(created);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create sub-category' });
    }
};

export const deleteSubCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete sub-categories' });

        const id = parseInt(req.params.id);
        await db.delete(subCategories).where(eq(subCategories.id, id));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete sub-category' });
    }
};
