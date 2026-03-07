import { getDb } from '../db/index.js';
import { softAssets, softAssetLocations } from '../db/schema.js';
import { eq, desc, inArray } from 'drizzle-orm';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';

export const getSoftAssets = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);

        const options = {
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                locations: { with: { hardAsset: true } },
            },
            orderBy: [desc(softAssets.updatedAt)],
        };

        if (user?.role === 'regional_admin' || user?.role === 'partner') {
            if (user.subregionIds && user.subregionIds.length > 0) {
                options.where = inArray(softAssets.subregionId, user.subregionIds);
            }
        }

        const assets = await db.query.softAssets.findMany(options);

        const formatted = assets
            .filter(a => isAssetVisible(a, user))
            .map(a => ({
                ...a,
                partnerName: a.partner?.name,
                tags: a.tags.map(t => t.tag.name),
                locations: a.locations.map(l => l.hardAsset).filter(l => isAssetVisible(l, user)),
                location: a.locations.length > 0 ? (isAssetVisible(a.locations[0].hardAsset, user) ? a.locations[0].hardAsset : null) : null,
            }));

        return c.json(formatted);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch soft assets' }, 500);
    }
};

export const getSoftAssetById = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = c.get('user');
        const db = getDb(c.env);

        const asset = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, id),
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                locations: { with: { hardAsset: true } },
            }
        });

        if (!asset || !isAssetVisible(asset, user)) return c.json({ error: 'Not found' }, 404);

        const formatted = {
            ...asset,
            partnerName: asset.partner?.name,
            tags: asset.tags.map(t => t.tag.name),
            locations: asset.locations.map(l => l.hardAsset).filter(l => isAssetVisible(l, user)),
            location: asset.locations.length > 0 ? (isAssetVisible(asset.locations[0].hardAsset, user) ? asset.locations[0].hardAsset : null) : null,
        };

        return c.json(formatted);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch soft asset' }, 500);
    }
};

export const createSoftAsset = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);

        if (user.role === 'user' || user.role === 'standard' || user.role === 'guest') {
            return c.json({ error: 'Only partners and admins can create resources' }, 403);
        }

        const body = await c.req.json();
        const { locationId, locationIds, name, subCategory, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags = [], isMemberOnly, isHidden, hideFrom, hideUntil } = body;

        if (!name) {
            return c.json({ error: 'Name is required' }, 400);
        }

        let hardAssetIds = [];
        if (locationIds && Array.isArray(locationIds)) {
            hardAssetIds = locationIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        } else if (locationId) {
            hardAssetIds = [parseInt(locationId)].filter(id => !isNaN(id));
        }

        let finalSubregionId = body.subregionId;
        if (user.role === 'regional_admin' || user.role === 'partner') {
            finalSubregionId = user.subregionIds?.[0]; // Default to first region for partners/regional admins
        }

        const result = await db.transaction(async (tx) => {
            const [asset] = await tx.insert(softAssets).values({
                partnerId: user.id,
                subregionId: finalSubregionId ? parseInt(finalSubregionId) : null,
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

        try {
            await rebuildMapCache(body.subregionId || user.subregionIds?.[0], c.env);
        } catch (e) { console.error('Cache err', e); }
        return c.json(result, 201);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to create soft asset' }, 500);
    }
};

export const updateSoftAsset = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = c.get('user');
        const db = getDb(c.env);

        const [existing] = await db.select().from(softAssets).where(eq(softAssets.id, id));

        if (!existing) return c.json({ error: 'Not found' }, 404);
        const isOwner = existing.partnerId === user.id;
        const isSuper = user.role === 'super_admin' || user.role === 'admin';
        const isRegional = user.role === 'regional_admin' && user.subregionIds?.includes(existing.subregionId);

        if (!isOwner && !isSuper && !isRegional) {
            return c.json({ error: "Insufficient permissions to edit this asset" }, 403);
        }

        const body = await c.req.json();
        const { locationId, locationIds, name, subCategory, description, schedule, logoUrl, bannerUrl, galleryUrls, newTags, isMemberOnly, isHidden, hideFrom, hideUntil } = body;

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

        try {
            await rebuildMapCache(existing.subregionId || user.subregionIds?.[0], c.env);
        } catch (e) { console.error('Cache err', e); }
        return c.json({ success: true, id });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to update soft asset' }, 500);
    }
};

export const deleteSoftAsset = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = c.get('user');
        const db = getDb(c.env);

        const [existing] = await db.select().from(softAssets).where(eq(softAssets.id, id));

        if (!existing) return c.json({ error: 'Not found' }, 404);
        const isOwner = existing.partnerId === user.id;
        const isSuper = user.role === 'super_admin' || user.role === 'admin';
        const isRegional = user.role === 'regional_admin' && user.subregionIds?.includes(existing.subregionId);

        if (!isOwner && !isSuper && !isRegional) {
            return c.json({ error: "Insufficient permissions to delete this asset" }, 403);
        }

        await db.update(softAssets).set({ isDeleted: true }).where(eq(softAssets.id, id));
        try {
            await rebuildMapCache(existing.subregionId || user.subregionIds?.[0], c.env);
        } catch (e) { console.error('Cache err', e); }
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete soft asset' }, 500);
    }
};
