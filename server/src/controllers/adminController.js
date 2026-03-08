import { getDb } from '../db/index.js';
import { hardAssets, softAssets, users, softAssetLocations, subregions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { syncAssetTags } from '../utils/tags.js';

export const exportFullDB = async (c) => {
    try {
        const db = getDb(c.env);
        const hard = await db.query.hardAssets.findMany({
            where: eq(hardAssets.isDeleted, false),
            with: { partner: { columns: { username: true } } }
        });
        const soft = await db.query.softAssets.findMany({
            where: eq(softAssets.isDeleted, false),
            with: { partner: { columns: { username: true } }, locations: true }
        });

        const mappedHard = hard.map(h => ({ ...h, partnerUsername: h.partner?.username }));
        const mappedSoft = soft.map(s => ({
            ...s,
            partnerUsername: s.partner?.username,
            linkedPlaceIds: s.locations.map(l => l.hardAssetId).join(',')
        }));

        return c.json({ hardAssets: mappedHard, softAssets: mappedSoft });
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

async function resolveSubregionId(db, rawSubregionId, fallbackSubregionId = null) {
    const subregionText = String(rawSubregionId ?? '').trim();
    if (!subregionText) return fallbackSubregionId;

    if (/^\d+$/.test(subregionText)) {
        return Number.parseInt(subregionText, 10);
    }

    const [byCode] = await db
        .select({ id: subregions.id })
        .from(subregions)
        .where(eq(subregions.subregionCode, subregionText));
    if (byCode) return byCode.id;

    const [byName] = await db
        .select({ id: subregions.id })
        .from(subregions)
        .where(eq(subregions.name, subregionText));
    if (byName) return byName.id;

    throw new Error(`Subregion "${subregionText}" was not found.`);
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

        for (const [index, row] of rows.entries()) {
            try {
                let partnerId = user.id; // default to uploader

                if (row.partnerUsername) {
                    const partnerUsernameStr = String(row.partnerUsername).trim();
                    const [partnerUser] = await db.select({ id: users.id })
                        .from(users)
                        .where(eq(users.username, partnerUsernameStr));

                    if (partnerUser) {
                        partnerId = partnerUser.id;
                    } else {
                        errors.push(`Row ${index + 1}: Partner username '${partnerUsernameStr}' not found. Skipping.`);
                        continue;
                    }
                }

                const postalCode = String(row.postalCode || '').trim();

                let lat = parseFloat(row.lat);
                let lng = parseFloat(row.lng);
                let address = row.address || '';

                const defaultSubregionId = user.subregionIds?.[0] || null;
                const subregionId = await resolveSubregionId(db, row.subregionId, defaultSubregionId);
                const rowId = row.id ? parseInt(row.id) : null;

                if (type === 'hard') {
                    if (!/^\d{6}$/.test(postalCode)) {
                        errors.push(`Row ${index + 1}: Invalid 6-digit postal code format (${postalCode})`);
                        continue;
                    }

                    if (isNaN(lat) || isNaN(lng) || !address || row.postalCode !== postalCode) {
                        // Re-geocode if lat/lng missing, or if we assume it's an update and lat/lng could be from old record?
                        // Let's just regeocode to ensure safety if address is missing
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
                    }

                    let asset;
                    if (rowId) {
                        [asset] = await db.update(hardAssets).set({
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
                            description: row.description || null,
                            subregionId: subregionId || undefined // Only update subregionId if supplied via row, mostly
                        }).where(eq(hardAssets.id, rowId)).returning();

                        if (!asset) {
                            errors.push(`Row ${index + 1}: Hard asset with ID ${rowId} not found for updating. Skipping.`);
                            continue;
                        }
                    } else {
                        [asset] = await db.insert(hardAssets).values({
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
                            description: row.description || null,
                            subregionId
                        }).returning();
                    }

                    const tagsArray = row.tags ? String(row.tags).split(',').map(t => t.trim()).filter(Boolean) : [];
                    await syncAssetTags(db, asset.id, 'hard', tagsArray);

                    importedRows.push(asset);
                } else if (type === 'soft') {
                    let asset;
                    if (rowId) {
                        [asset] = await db.update(softAssets).set({
                            partnerId,
                            name: row.name,
                            subCategory: row.subCategory || 'Programmes',
                            description: row.description || null,
                            schedule: row.schedule || null,
                            isMemberOnly: String(row.isMemberOnly).toLowerCase() === 'true',
                            subregionId: subregionId || undefined
                        }).where(eq(softAssets.id, rowId)).returning();

                        if (!asset) {
                            errors.push(`Row ${index + 1}: Soft asset with ID ${rowId} not found for updating. Skipping.`);
                            continue;
                        }
                    } else {
                        [asset] = await db.insert(softAssets).values({
                            partnerId,
                            name: row.name,
                            subCategory: row.subCategory || 'Programmes',
                            description: row.description || null,
                            schedule: row.schedule || null,
                            isMemberOnly: String(row.isMemberOnly).toLowerCase() === 'true',
                            subregionId
                        }).returning();
                    }

                    const tagsArray = row.tags ? String(row.tags).split(',').map(t => t.trim()).filter(Boolean) : [];
                    await syncAssetTags(db, asset.id, 'soft', tagsArray);

                    // Handle linkedPlaceIds
                    if (row.linkedPlaceIds !== undefined) {
                        await db.delete(softAssetLocations).where(eq(softAssetLocations.softAssetId, asset.id));
                        const placeIds = String(row.linkedPlaceIds).split(',').map(id => id.trim()).filter(Boolean);

                        const invalidPlaceIds = placeIds.filter(id => !/^\d+$/.test(id));
                        if (invalidPlaceIds.length > 0) {
                            errors.push(`Row ${index + 1}: linkedPlaceIds contains invalid value(s): ${invalidPlaceIds.join(', ')}`);
                            continue;
                        }

                        if (placeIds.length > 0) {
                            const linkValues = placeIds.map(hId => ({
                                softAssetId: asset.id,
                                hardAssetId: parseInt(hId)
                            }));
                            await db.insert(softAssetLocations).values(linkValues);
                        }
                    }

                    importedRows.push(asset);
                }
            } catch (rowErr) {
                console.error(`Import row ${index + 1} failed:`, rowErr);
                errors.push(`Row ${index + 1}: ${rowErr?.message || 'Unexpected import error.'}`);
            }
        }

        return c.json({ message: `Successfully imported ${importedRows.length} rows`, errors });
    } catch (err) {
        console.error('Import Error:', err);
        return c.json({ error: err?.message || 'Database import failed' }, 500);
    }
};
