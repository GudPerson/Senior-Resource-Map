import db from '../db/index.js';
import { softAssets, hardAssets, tags, softAssetTags, users, softAssetLocations } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';

export const getSoftAssets = async (req, res) => {
    try {
        const assets = await db.query.softAssets.findMany({
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                locations: { with: { hardAsset: true } },
            },
            orderBy: [desc(softAssets.updatedAt)],
        });

        const formatted = assets
            .filter(a => isAssetVisible(a, req.user))
            .map(a => ({
                ...a,
                partnerName: a.partner?.name,
                tags: a.tags.map(t => t.tag.name),
                locations: a.locations.map(l => l.hardAsset).filter(l => isAssetVisible(l, req.user)),
                location: a.locations.length > 0 ? (isAssetVisible(a.locations[0].hardAsset, req.user) ? a.locations[0].hardAsset : null) : null,
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
                locations: { with: { hardAsset: true } },
            }
        });

        if (!isAssetVisible(asset, req.user)) return res.status(404).json({ error: 'Not found' });

        const formatted = {
            ...asset,
            partnerName: asset.partner?.name,
            tags: asset.tags.map(t => t.tag.name),
            locations: asset.locations.map(l => l.hardAsset).filter(l => isAssetVisible(l, req.user)),
            location: asset.locations.length > 0 ? (isAssetVisible(asset.locations[0].hardAsset, req.user) ? asset.locations[0].hardAsset : null) : null,
        };

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch soft asset' });
    }
};

export const createSoftAsset = async (req, res) => {
    try {
        if (req.user.role === 'user') {
            return res.status(403).json({ error: 'Only partners and admins can create resources' });
        }
        const { locationId, locationIds, name, subCategory, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags = [], isMemberOnly, isHidden, hideFrom, hideUntil } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        let hardAssetIds = [];
        if (locationIds && Array.isArray(locationIds)) {
            hardAssetIds = locationIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        } else if (locationId) {
            hardAssetIds = [parseInt(locationId)].filter(id => !isNaN(id));
        }

        const result = await db.transaction(async (tx) => {
            const [asset] = await tx.insert(softAssets).values({
                partnerId: req.user.id,
                name, subCategory: subCategory || 'Programmes', description: description || null, schedule: schedule || null,
                logoUrl: logoUrl || null, bannerUrl: bannerUrl || null, galleryUrls: galleryUrls || [],
                isMemberOnly: isMemberOnly || false,
                isHidden: isHidden || false,
                hideFrom: hideFrom ? new Date(hideFrom) : null,
                hideUntil: hideUntil ? new Date(hideUntil) : null
            }).returning();

            for (const hid of hardAssetIds) {
                await tx.insert(softAssetLocations).values({
                    softAssetId: asset.id,
                    hardAssetId: hid
                });
            }

            await syncAssetTags(tx, asset.id, 'soft', newTags);
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

        const { locationId, locationIds, name, subCategory, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags, isMemberOnly, isHidden, hideFrom, hideUntil } = req.body;

        await db.transaction(async (tx) => {
            await tx.update(softAssets).set({
                name, subCategory: subCategory !== undefined ? subCategory : existing.subCategory, description: description || null, schedule: schedule || null,
                logoUrl: logoUrl !== undefined ? logoUrl : existing.logoUrl,
                bannerUrl: bannerUrl !== undefined ? bannerUrl : existing.bannerUrl,
                galleryUrls: galleryUrls !== undefined ? galleryUrls : existing.galleryUrls,
                isMemberOnly: isMemberOnly !== undefined ? isMemberOnly : existing.isMemberOnly,
                isHidden: isHidden !== undefined ? isHidden : existing.isHidden,
                hideFrom: hideFrom !== undefined ? (hideFrom ? new Date(hideFrom) : null) : existing.hideFrom,
                hideUntil: hideUntil !== undefined ? (hideUntil ? new Date(hideUntil) : null) : existing.hideUntil,
                updatedAt: new Date()
            }).where(eq(softAssets.id, id));

            if (locationIds !== undefined || locationId !== undefined) {
                let hardAssetIds = [];
                if (locationIds && Array.isArray(locationIds)) {
                    hardAssetIds = locationIds.map(lid => parseInt(lid)).filter(lid => !isNaN(lid));
                } else if (locationId) {
                    hardAssetIds = [parseInt(locationId)].filter(lid => !isNaN(lid));
                }

                await tx.delete(softAssetLocations).where(eq(softAssetLocations.softAssetId, id));
                for (const hid of hardAssetIds) {
                    await tx.insert(softAssetLocations).values({
                        softAssetId: id,
                        hardAssetId: hid
                    });
                }
            }

            if (newTags) {
                await syncAssetTags(tx, id, 'soft', newTags);
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

        await db.update(softAssets).set({ isDeleted: true }).where(eq(softAssets.id, id));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete soft asset' });
    }
};
