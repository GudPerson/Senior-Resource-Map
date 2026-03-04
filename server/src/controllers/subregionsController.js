import db from '../db/index.js';
import { subregions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const getSubregions = async (req, res) => {
    try {
        const list = await db.query.subregions.findMany({
            orderBy: [subregions.name]
        });
        res.json(list);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch subregions' });
    }
};

export const createSubregion = async (req, res) => {
    try {
        if (req.user?.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only Super Admins can create subregions' });
        }
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const [newReg] = await db.insert(subregions).values({
            name,
            description
        }).returning();

        res.status(201).json(newReg);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create subregion' });
    }
};

export const deleteSubregion = async (req, res) => {
    try {
        if (req.user?.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only Super Admins can delete subregions' });
        }
        const id = parseInt(req.params.id);
        await db.delete(subregions).where(eq(subregions.id, id));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete subregion' });
    }
};
