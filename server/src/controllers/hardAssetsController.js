import { getDb } from '../db/index.js';
import { hardAssets } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { env } from 'hono/adapter';

const COUNTRY_NAMES = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
    SG: 'Singapore', MY: 'Malaysia', IN: 'India', PH: 'Philippines',
    JP: 'Japan', DE: 'Germany', FR: 'France',
};

async function geocode(postalCode, country) {
    const headers = { 'User-Agent': 'SeniorCareConnect/1.0' };
    const url1 = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&country=${encodeURIComponent(country)}&format=json&limit=1`;
    const res1 = await fetch(url1, { headers });
    const data1 = await res1.json();
    if (data1.length) {
        return { lat: parseFloat(data1[0].lat), lng: parseFloat(data1[0].lon) };
    }
    const countryName = COUNTRY_NAMES[country] || country;
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postalCode + ' ' + countryName)}&format=json&limit=1`;
    const res2 = await fetch(url2, { headers });
    const data2 = await res2.json();
    if (data2.length) {
        return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
    }
    return null;
}

export const getHardAssets = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(env(c));

        const options = {
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                softAssets: {
                    with: {
                        softAsset: true
                    }
                },
            },
            orderBy: [desc(hardAssets.updatedAt)],
        };

        if (user?.role === 'regional_admin' || user?.role === 'partner') {
            if (user.subregionId) {
                options.where = eq(hardAssets.subregionId, user.subregionId);
            }
        }

        const assets = await db.query.hardAssets.findMany(options);

        const formatted = assets
            .filter(a => isAssetVisible(a, user))
            .map(a => ({
                ...a,
                partnerName: a.partner?.name,
                tags: a.tags.map(t => t.tag.name),
                softAssets: a.softAssets.map(sa => sa.softAsset).filter(sa => isAssetVisible(sa, user)),
            }));

        return c.json(formatted);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch hard assets' }, 500);
    }
};

export const getHardAssetById = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = c.get('user');
        const subregionScope = c.get('subregionScope');
        const db = getDb(env(c));

        const asset = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, id),
            with: {
                partner: { columns: { name: true } },
                tags: { with: { tag: true } },
                softAssets: {
                    with: {
                        softAsset: {
                            with: {
                                tags: { with: { tag: true } }
                            }
                        }
                    }
                },
            }
        });

        if (!asset) return c.json({ error: 'Not found' }, 404);
        if (!isAssetVisible(asset, user)) return c.json({ error: 'Not found' }, 404);

        if (subregionScope && asset.subregionId !== subregionScope) {
            return c.json({ error: 'Asset belongs to another subregion' }, 403);
        }

        const formatted = {
            ...asset,
            partnerName: asset.partner?.name,
            tags: asset.tags.map(t => t.tag.name),
            softAssets: asset.softAssets
                .map(sa => ({
                    ...sa.softAsset,
                    tags: sa.softAsset.tags.map(t => t.tag.name)
                }))
                .filter(sa => isAssetVisible(sa, user))
        };

        return c.json(formatted);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch hard asset' }, 500);
    }
};

export const createHardAsset = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(env(c));

        if (user.role === 'standard' || user.role === 'guest') {
            return c.json({ error: 'Insufficient permissions to create resources' }, 403);
        }

        const body = await c.req.json();
        const { name, country, postalCode, address, phone, hours, description, logoUrl, bannerUrl, galleryUrls, newTags = [], subCategory, isHidden, hideFrom, hideUntil, subregionId } = body;

        if (!name || !country || !postalCode || !address) {
            return c.json({ error: 'name, country, postalCode, address are required' }, 400);
        }

        let finalSubregionId = subregionId;
        if (user.role === 'regional_admin' || user.role === 'partner') {
            finalSubregionId = user.subregionId;
        }

        const coords = await geocode(postalCode, country);
        if (!coords) {
            return c.json({ error: `Could not find location for postal code "${postalCode}" in "${country}".` }, 400);
        }

        const result = await db.transaction(async (tx) => {
            const [asset] = await tx.insert(hardAssets).values({
                partnerId: user.id,
                subregionId: finalSubregionId ? parseInt(finalSubregionId) : null,
                name, country, postalCode, subCategory: subCategory || 'Places',
                lat: coords.lat.toString(), lng: coords.lng.toString(),
                address, phone: phone || null, hours: hours || null, description: description || null,
                logoUrl: logoUrl || null, bannerUrl: bannerUrl || null, galleryUrls: galleryUrls || [],
                isHidden: isHidden || false,
                hideFrom: hideFrom ? new Date(hideFrom) : null,
                hideUntil: hideUntil ? new Date(hideUntil) : null
            }).returning();

            await syncAssetTags(tx, asset.id, 'hard', newTags);
            return asset;
        });

        await rebuildMapCache(body.subregionId || user.subregionId, env(c));
        return c.json(result, 201);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to create hard asset' }, 500);
    }
};

export const updateHardAsset = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = c.get('user');
        const db = getDb(env(c));

        const [existing] = await db.select().from(hardAssets).where(eq(hardAssets.id, id));

        if (!existing) return c.json({ error: 'Not found' }, 404);

        const isOwner = existing.partnerId === user.id;
        const isSuper = user.role === 'super_admin' || user.role === 'admin';
        const isRegional = user.role === 'regional_admin' && existing.subregionId === user.subregionId;

        if (!isOwner && !isSuper && !isRegional) {
            return c.json({ error: "Insufficient permissions to edit this asset" }, 403);
        }

        const body = await c.req.json();
        const { name, country, postalCode, address, phone, hours, description, logoUrl, bannerUrl, galleryUrls, newTags, subCategory, isHidden, hideFrom, hideUntil, subregionId } = body;

        let lat = existing.lat;
        let lng = existing.lng;
        if (postalCode && country && (postalCode !== existing.postalCode || country !== existing.country)) {
            const coords = await geocode(postalCode, country);
            if (!coords) {
                return c.json({ error: `Could not find location for postal code "${postalCode}" in "${country}".` }, 400);
            }
            lat = coords.lat.toString();
            lng = coords.lng.toString();
        }

        await db.transaction(async (tx) => {
            await tx.update(hardAssets).set({
                name, country, postalCode, lat, lng, address,
                subCategory: subCategory !== undefined ? subCategory : existing.subCategory,
                subregionId: (isSuper && subregionId !== undefined) ? subregionId : existing.subregionId,
                phone: phone || null, hours: hours || null, description: description || null,
                logoUrl: logoUrl !== undefined ? logoUrl : existing.logoUrl,
                bannerUrl: bannerUrl !== undefined ? bannerUrl : existing.bannerUrl,
                galleryUrls: galleryUrls !== undefined ? galleryUrls : existing.galleryUrls,
                isHidden: isHidden !== undefined ? isHidden : existing.isHidden,
                hideFrom: hideFrom !== undefined ? (hideFrom ? new Date(hideFrom) : null) : existing.hideFrom,
                hideUntil: hideUntil !== undefined ? (hideUntil ? new Date(hideUntil) : null) : existing.hideUntil,
                updatedAt: new Date()
            }).where(eq(hardAssets.id, id));

            if (newTags) {
                await syncAssetTags(tx, id, 'hard', newTags);
            }
        });

        await rebuildMapCache(body.subregionId || existing.subregionId || user.subregionId, env(c));
        return c.json({ success: true, id });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to update hard asset' }, 500);
    }
};

export const deleteHardAsset = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = c.get('user');
        const db = getDb(env(c));

        const [existing] = await db.select().from(hardAssets).where(eq(hardAssets.id, id));

        if (!existing) return c.json({ error: 'Not found' }, 404);

        const isOwner = existing.partnerId === user.id;
        const isSuper = user.role === 'super_admin' || user.role === 'admin';
        const isRegional = user.role === 'regional_admin' && existing.subregionId === user.subregionId;

        if (!isOwner && !isSuper && !isRegional) {
            return c.json({ error: "Insufficient permissions to delete this asset" }, 403);
        }

        await db.update(hardAssets).set({ isDeleted: true }).where(eq(hardAssets.id, id));
        await rebuildMapCache(existing.subregionId || user.subregionId, env(c));
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete hard asset' }, 500);
    }
};
