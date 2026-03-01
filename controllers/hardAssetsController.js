import db from '../db/index.js';
import { hardAssets, tags, hardAssetTags, users } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';

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

export const getHardAssets = async (req, res) => {
    try {
        const assets = await db.query.hardAssets.findMany({
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
        });

        const formatted = assets
            .filter(a => isAssetVisible(a, req.user))
            .map(a => ({
                ...a,
                partnerName: a.partner?.name,
                tags: a.tags.map(t => t.tag.name),
                softAssets: a.softAssets.map(sa => sa.softAsset).filter(sa => isAssetVisible(sa, req.user)),
            }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch hard assets' });
    }
};

export const getHardAssetById = async (req, res) => {
    try {
        const asset = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, parseInt(req.params.id)),
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

        if (!asset) return res.status(404).json({ error: 'Not found' });

        if (!isAssetVisible(asset, req.user)) return res.status(404).json({ error: 'Not found' });

        const formatted = {
            ...asset,
            partnerName: asset.partner?.name,
            tags: asset.tags.map(t => t.tag.name),
            softAssets: asset.softAssets
                .map(sa => ({
                    ...sa.softAsset,
                    tags: sa.softAsset.tags.map(t => t.tag.name)
                }))
                .filter(sa => isAssetVisible(sa, req.user))
        };

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch hard asset' });
    }
};

export const createHardAsset = async (req, res) => {
    try {
        const { name, country, postalCode, address, phone, hours, description, logoUrl, bannerUrl, galleryUrls, newTags = [], subCategory, isHidden, hideFrom, hideUntil } = req.body;
        if (!name || !country || !postalCode || !address) {
            return res.status(400).json({ error: 'name, country, postalCode, address are required' });
        }

        const coords = await geocode(postalCode, country);
        if (!coords) {
            return res.status(400).json({ error: `Could not find location for postal code "${postalCode}" in "${country}". Please check and try again.` });
        }

        const result = await db.transaction(async (tx) => {
            const [asset] = await tx.insert(hardAssets).values({
                partnerId: req.user.id,
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

        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create hard asset' });
    }
};

export const updateHardAsset = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [existing] = await db.select().from(hardAssets).where(eq(hardAssets.id, id));

        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partnerId !== req.user.id) {
            return res.status(403).json({ error: "Cannot edit another partner's hard asset" });
        }

        const { name, country, postalCode, address, phone, hours, description, logoUrl, bannerUrl, galleryUrls, newTags, subCategory, isHidden, hideFrom, hideUntil } = req.body;

        let lat = existing.lat;
        let lng = existing.lng;
        if (postalCode && country && (postalCode !== existing.postalCode || country !== existing.country)) {
            const coords = await geocode(postalCode, country);
            if (!coords) {
                return res.status(400).json({ error: `Could not find location for postal code "${postalCode}" in "${country}".` });
            }
            lat = coords.lat.toString();
            lng = coords.lng.toString();
        }

        await db.transaction(async (tx) => {
            await tx.update(hardAssets).set({
                name, country, postalCode, lat, lng, address,
                subCategory: subCategory !== undefined ? subCategory : existing.subCategory,
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

        res.json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update hard asset' });
    }
};

export const deleteHardAsset = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [existing] = await db.select().from(hardAssets).where(eq(hardAssets.id, id));

        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partnerId !== req.user.id) {
            return res.status(403).json({ error: "Cannot delete another partner's hard asset" });
        }

        await db.delete(hardAssets).where(eq(hardAssets.id, id));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete hard asset' });
    }
};
