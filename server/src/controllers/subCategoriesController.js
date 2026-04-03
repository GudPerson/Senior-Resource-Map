import { getDb } from '../db/index.js';
import { hardAssets, softAssetParents, softAssets, subCategories } from '../db/schema.js';
import { and, eq, ne } from 'drizzle-orm';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';

function normalizeCategoryName(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function normalizeOptionalText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

export const getSubCategories = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const categories = await db.select().from(subCategories);
        return c.json(
            [...categories].sort((left, right) => (
                `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`)
            ))
        );
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch sub-categories' }, 500);
    }
};

export const createSubCategory = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = await c.req.json();
        const name = normalizeCategoryName(body?.name);
        const type = normalizeCategoryName(body?.type);
        const color = normalizeCategoryName(body?.color) || '#3b82f6';
        const iconUrl = normalizeOptionalText(body?.iconUrl);

        if (!name || !type) return c.json({ error: 'Name and type are required' }, 400);
        if (!['hard', 'soft'].includes(type)) return c.json({ error: 'Type must be hard or soft' }, 400);

        const [existing] = await db.select().from(subCategories).where(eq(subCategories.name, name));
        if (existing) return c.json({ error: 'Sub-category already exists' }, 400);

        const [created] = await db.insert(subCategories).values({
            name,
            type,
            color,
            iconUrl,
        }).returning();
        return c.json(created);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to create sub-category' }, 500);
    }
};

export const updateSubCategory = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const id = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(id) || id <= 0) {
            return c.json({ error: 'Invalid sub-category id' }, 400);
        }

        const body = await c.req.json();
        const [existing] = await db.select().from(subCategories).where(eq(subCategories.id, id));
        if (!existing) {
            return c.json({ error: 'Sub-category not found' }, 404);
        }

        const nextName = normalizeCategoryName(body?.name) || existing.name;
        const nextColor = normalizeCategoryName(body?.color) || existing.color || '#3b82f6';
        const nextIconUrl = body && Object.prototype.hasOwnProperty.call(body, 'iconUrl')
            ? normalizeOptionalText(body.iconUrl)
            : (existing.iconUrl || null);

        const [nameConflict] = await db.select().from(subCategories).where(and(
            eq(subCategories.name, nextName),
            ne(subCategories.id, id),
        ));
        if (nameConflict) {
            return c.json({ error: 'Sub-category already exists' }, 400);
        }

        const [updated] = await db.update(subCategories)
            .set({
                name: nextName,
                color: nextColor,
                iconUrl: nextIconUrl,
            })
            .where(eq(subCategories.id, id))
            .returning();

        if (nextName !== existing.name) {
            await db.update(hardAssets).set({ subCategory: nextName }).where(eq(hardAssets.subCategory, existing.name));
            await db.update(softAssets).set({ subCategory: nextName }).where(eq(softAssets.subCategory, existing.name));
            await db.update(softAssetParents).set({ subCategory: nextName }).where(eq(softAssetParents.subCategory, existing.name));
        }

        return c.json(updated);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to update sub-category' }, 500);
    }
};

export const deleteSubCategory = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const id = parseInt(c.req.param('id'));
        await db.delete(subCategories).where(eq(subCategories.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete sub-category' }, 500);
    }
};
