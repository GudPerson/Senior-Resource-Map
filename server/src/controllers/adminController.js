import { getDb } from '../db/index.js';
import { hardAssets, softAssets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { syncAssetTags } from '../utils/tags.js';

export const exportFullDB = async (c) => {
    try {
        const db = getDb(c.env);
        const hard = await db.select().from(hardAssets).where(eq(hardAssets.isDeleted, false));
        const soft = await db.select().from(softAssets).where(eq(softAssets.isDeleted, false));

        return c.json({ hardAssets: hard, softAssets: soft });
    } catch (err) {
        console.error('Export Error:', err);
        return c.json({ error: 'Failed to export database' }, 500);
    }
};

async function geocodePostal(postalCode) {
    try {
        const response = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postalCode}&returnGeom=Y&getAddrDetails=Y&pageNum=1`);
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
            return {
                lat: parseFloat(data.results[0].LATITUDE),
                lng: parseFloat(data.results[0].LONGITUDE),
                address: data.results[0].ADDRESS
            };
        }
    } catch (e) {
        console.error(`Geocoding failed for ${postalCode}`, e);
    }
    return null;
}

export const importCSV = async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const { rows, type } = body;

        if (!rows || !Array.isArray(rows)) return c.json({ error: 'Invalid CSV format' }, 400);

        const db = getDb(c.env);
        const importedRows = [];
        const errors = [];

        await db.transaction(async (tx) => {
            for (const [index, row] of rows.entries()) {
                const partnerId = parseInt(row.partnerId) || user.id;
                const postalCode = String(row.postalCode || '').trim();

                let lat = parseFloat(row.lat);
                let lng = parseFloat(row.lng);
                let address = row.address || '';

                if (type === 'hard') {
                    if (!/^\d{6}$/.test(postalCode)) {
                        errors.push(`Row ${index + 1}: Invalid 6-digit postal code format (${postalCode})`);
                        continue;
                    }

                    if (isNaN(lat) || isNaN(lng) || !address) {
                        const geo = await geocodePostal(postalCode);
                        if (geo) {
                            lat = geo.lat;
                            lng = geo.lng;
                            address = address || geo.address;
                        } else {
                            errors.push(`Row ${index + 1}: Could not geocode postal code ${postalCode}`);
                            continue;
                        }
                    }

                    const [asset] = await tx.insert(hardAssets).values({
                        partnerId,
                        name: row.name,
                        subCategory: row.subCategory || 'Active Ageing Centres',
                        lat: lat.toString(),
                        lng: lng.toString(),
                        address,
                        country: 'SG',
                        postalCode: postalCode,
                        phone: row.phone || null,
                        hours: row.hours || null,
                        description: row.description || null
                    }).returning();

                    const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                    if (tagsArray.length > 0) {
                        await syncAssetTags(tx, asset.id, 'hard', tagsArray);
                    }
                    importedRows.push(asset);
                } else if (type === 'soft') {
                    const [asset] = await tx.insert(softAssets).values({
                        partnerId,
                        name: row.name,
                        subCategory: row.subCategory || 'Programmes',
                        description: row.description || null,
                        schedule: row.schedule || null,
                        isMemberOnly: String(row.isMemberOnly).toLowerCase() === 'true'
                    }).returning();

                    const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                    if (tagsArray.length > 0) {
                        await syncAssetTags(tx, asset.id, 'soft', tagsArray);
                    }
                    importedRows.push(asset);
                }
            }
        });

        return c.json({ message: `Successfully imported ${importedRows.length} rows`, errors });
    } catch (err) {
        console.error('Import Error:', err);
        return c.json({ error: 'Database import transaction failed' }, 500);
    }
};
