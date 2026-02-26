import db from '../db/index.js';
import { resources, users } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

// Country code → full name mapping for free-form fallback queries
const COUNTRY_NAMES = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
    SG: 'Singapore', MY: 'Malaysia', IN: 'India', PH: 'Philippines',
    JP: 'Japan', DE: 'Germany', FR: 'France',
};

// Geocode a postal code + country to lat/lng via OpenStreetMap Nominatim
// Strategy: try structured postalcode param first, fall back to free-form query
async function geocode(postalCode, country) {
    const headers = { 'User-Agent': 'SeniorCareConnect/1.0' };

    // Attempt 1: structured postalcode search
    const url1 = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&country=${encodeURIComponent(country)}&format=json&limit=1`;
    const res1 = await fetch(url1, { headers });
    const data1 = await res1.json();
    if (data1.length) {
        return { lat: parseFloat(data1[0].lat), lng: parseFloat(data1[0].lon) };
    }

    // Attempt 2: free-form query (works better for SG 6-digit postcodes)
    const countryName = COUNTRY_NAMES[country] || country;
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postalCode + ' ' + countryName)}&format=json&limit=1`;
    const res2 = await fetch(url2, { headers });
    const data2 = await res2.json();
    if (data2.length) {
        return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
    }

    return null;
}

export const getResources = async (req, res) => {
    try {
        const rows = await db.select({
            id: resources.id,
            partnerId: resources.partnerId,
            name: resources.name,
            category: resources.category,
            country: resources.country,
            postalCode: resources.postalCode,
            lat: resources.lat,
            lng: resources.lng,
            address: resources.address,
            phone: resources.phone,
            hours: resources.hours,
            description: resources.description,
            updatedAt: resources.updatedAt,
            partnerName: users.name,
        })
            .from(resources)
            .leftJoin(users, eq(resources.partnerId, users.id))
            .orderBy(desc(resources.updatedAt));

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
};

export const getResourceById = async (req, res) => {
    try {
        const [r] = await db.select({
            id: resources.id,
            partnerId: resources.partnerId,
            name: resources.name,
            category: resources.category,
            country: resources.country,
            postalCode: resources.postalCode,
            lat: resources.lat,
            lng: resources.lng,
            address: resources.address,
            phone: resources.phone,
            hours: resources.hours,
            description: resources.description,
            updatedAt: resources.updatedAt,
            partnerName: users.name,
        })
            .from(resources)
            .leftJoin(users, eq(resources.partnerId, users.id))
            .where(eq(resources.id, parseInt(req.params.id)));

        if (!r) return res.status(404).json({ error: 'Not found' });
        res.json(r);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch resource' });
    }
};

export const createResource = async (req, res) => {
    try {
        const { name, category, country, postalCode, address, phone, hours, description } = req.body;
        if (!name || !category || !country || !postalCode || !address) {
            return res.status(400).json({ error: 'name, category, country, postalCode, address are required' });
        }
        // Geocode postal code → lat/lng
        const coords = await geocode(postalCode, country);
        if (!coords) {
            return res.status(400).json({ error: `Could not find location for postal code "${postalCode}" in "${country}". Please check and try again.` });
        }

        const [resource] = await db.insert(resources).values({
            partnerId: req.user.id,
            name, category, country, postalCode,
            lat: coords.lat.toString(), lng: coords.lng.toString(),
            address, phone: phone || null, hours: hours || null, description: description || null
        }).returning();

        res.status(201).json(resource);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create resource' });
    }
};

export const updateResource = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [existing] = await db.select().from(resources).where(eq(resources.id, id));

        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partnerId !== req.user.id) {
            return res.status(403).json({ error: "Cannot edit another partner's resource" });
        }

        const { name, category, country, postalCode, address, phone, hours, description } = req.body;
        // Re-geocode if postal code or country changed
        let lat = existing.lat;
        let lng = existing.lng;
        if (postalCode !== existing.postalCode || country !== existing.country) {
            const coords = await geocode(postalCode, country);
            if (!coords) {
                return res.status(400).json({ error: `Could not find location for postal code "${postalCode}" in "${country}". Please check and try again.` });
            }
            lat = coords.lat.toString();
            lng = coords.lng.toString();
        }

        const [updated] = await db.update(resources).set({
            name, category, country, postalCode, lat, lng, address,
            phone: phone || null, hours: hours || null, description: description || null,
            updatedAt: new Date()
        }).where(eq(resources.id, id)).returning();

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update resource' });
    }
};

export const deleteResource = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [existing] = await db.select().from(resources).where(eq(resources.id, id));

        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && existing.partnerId !== req.user.id) {
            return res.status(403).json({ error: "Cannot delete another partner's resource" });
        }

        await db.delete(resources).where(eq(resources.id, id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete resource' });
    }
};
