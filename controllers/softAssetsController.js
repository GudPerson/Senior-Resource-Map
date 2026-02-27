import db from '../db/index.js';
import { softAssets, hardAssets, tags, softAssetTags, users } from '../db/schema.js';
import { eq, desc, inArray } from 'drizzle-orm';

export const getSoftAssets = async (req, res) => {
    try {
        const assets = await db.query.softAssets.findMany({
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                location: true, // eagerly load linked hard asset
            },
            orderBy: [desc(softAssets.updatedAt)],
        });

        const formatted = assets.map(a => ({
            ...a,
            partnerName: a.partner?.name,
            tags: a.tags.map(t => t.tag.name),
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch soft assets' });
    }
};

export const getSoftAssetById = async (req, res) => {
    try {
        const asset = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, parseInt(req.params.id)),
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                location: true,
            }
        });

        if (!asset) return res.status(404).json({ error: 'Not found' });

        const formatted = {
            ...asset,
            partnerName: asset.partner?.name,
            tags: asset.tags.map(t => t.tag.name),
        };

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch soft asset' });
    }
};

export const createSoftAsset = async (req, res) => {
    try {
        const { locationId, name, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags = [] } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const result = await db.transaction(async (tx) => {
            const [asset] = await tx.insert(softAssets).values({
                partnerId: req.user.id,
                locationId: locationId ? parseInt(locationId) : null,
                name, description: description || null, schedule: schedule || null,
                logoUrl: logoUrl || null, bannerUrl: bannerUrl || null, galleryUrls: galleryUrls || []
            }).returning();

            for (const t of newTags) {
                let [existingTag] = await tx.select().from(tags).where(eq(tags.name, t));
                if (!existingTag) {
                    [existingTag] = await tx.insert(tags).values({ name: t }).returning();
                }
                await tx.insert(softAssetTags).values({
                    softAssetId: asset.id,
                    tagId: existingTag.id
                });
            }
            return asset;
        });

        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create soft asset' });
    }
};

export const updateSoftAsset = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [existing] = await db.select().from(softAssets).where(eq(softAssets.id, id));

        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partnerId !== req.user.id) {
            return res.status(403).json({ error: "Cannot edit another partner's soft asset" });
        }

        const { locationId, name, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags } = req.body;

        await db.transaction(async (tx) => {
            await tx.update(softAssets).set({
                locationId: locationId !== undefined ? (locationId ? parseInt(locationId) : null) : existing.locationId,
                name, description: description || null, schedule: schedule || null,
                logoUrl: logoUrl !== undefined ? logoUrl : existing.logoUrl,
                bannerUrl: bannerUrl !== undefined ? bannerUrl : existing.bannerUrl,
                galleryUrls: galleryUrls !== undefined ? galleryUrls : existing.galleryUrls,
                updatedAt: new Date()
            }).where(eq(softAssets.id, id));

            if (newTags) {
                await tx.delete(softAssetTags).where(eq(softAssetTags.softAssetId, id));
                for (const t of newTags) {
                    let [existingTag] = await tx.select().from(tags).where(eq(tags.name, t));
                    if (!existingTag) {
                        [existingTag] = await tx.insert(tags).values({ name: t }).returning();
                    }
                    await tx.insert(softAssetTags).values({
                        softAssetId: id,
                        tagId: existingTag.id
                    });
                }
            }
        });

        res.json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update soft asset' });
    }
};

export const deleteSoftAsset = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [existing] = await db.select().from(softAssets).where(eq(softAssets.id, id));

        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partnerId !== req.user.id) {
            return res.status(403).json({ error: "Cannot delete another partner's soft asset" });
        }

        await db.delete(softAssets).where(eq(softAssets.id, id));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete soft asset' });
    }
};
