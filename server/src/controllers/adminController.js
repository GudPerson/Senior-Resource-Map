import { getDb } from '../db/index.js';
import { hardAssets, softAssets, users, softAssetLocations, subregions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';

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
        console.error(`OneMap geocoding failed for ${postalCode}`, e);
    }

    try {
        const headers = { 'User-Agent': 'SeniorCareConnect/1.0' };
        const exactPostal = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&countrycodes=sg&format=json&limit=1`, { headers });
        const exactPostalData = await exactPostal.json();

        if (Array.isArray(exactPostalData) && exactPostalData.length > 0) {
            return {
                lat: parseFloat(exactPostalData[0].lat),
                lng: parseFloat(exactPostalData[0].lon),
                address: exactPostalData[0].display_name
            };
        }

        const fallback = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${postalCode} Singapore`)}&format=json&limit=1`, { headers });
        const fallbackData = await fallback.json();
        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
            return {
                lat: parseFloat(fallbackData[0].lat),
                lng: parseFloat(fallbackData[0].lon),
                address: fallbackData[0].display_name
            };
        }
    } catch (e) {
        console.error(`Nominatim geocoding failed for ${postalCode}`, e);
    }

    return null;
}

function resolveSubregionId(rawSubregionId, fallbackSubregionId = null, subregionLookup = null) {
    const subregionText = String(rawSubregionId ?? '').trim();
    if (!subregionText) return fallbackSubregionId;

    if (/^\d+$/.test(subregionText)) {
        return Number.parseInt(subregionText, 10);
    }

    if (subregionLookup) {
        const resolved = subregionLookup.get(normalizeName(subregionText));
        if (resolved) return resolved;
    }

    throw new Error(`Subregion "${subregionText}" was not found.`);
}

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function normalizeName(value) {
    return normalizeText(value).toLowerCase();
}

function parseRowId(value) {
    const text = normalizeText(value);
    if (!text) return null;
    if (!/^\d+$/.test(text)) throw new Error(`Invalid ID "${text}".`);

    const parsed = Number.parseInt(text, 10);
    return parsed > 0 ? parsed : null;
}

function rememberExistingAsset(context, asset) {
    const normalized = normalizeName(asset?.name);
    if (!asset?.id || !normalized) return;
    context.existingById.set(asset.id, { id: asset.id, name: asset.name });
    context.existingByName.set(normalized, { id: asset.id, name: asset.name });
}

async function buildImportContext(db, rows, type) {
    const context = {
        partnerIds: new Map(),
        subregionIds: new Map(),
        existingById: new Map(),
        existingByName: new Map(),
        geocodeCache: new Map(),
    };

    const partnerUsernames = [...new Set(rows.map((row) => normalizeText(row.partnerUsername)).filter(Boolean))];
    if (partnerUsernames.length > 0) {
        const partnerRows = await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.username, partnerUsernames));

        partnerRows.forEach((row) => {
            context.partnerIds.set(row.username, row.id);
        });
    }

    const regionRows = await db
        .select({ id: subregions.id, name: subregions.name, subregionCode: subregions.subregionCode })
        .from(subregions);

    regionRows.forEach((row) => {
        context.subregionIds.set(String(row.id), row.id);
        if (row.name) context.subregionIds.set(normalizeName(row.name), row.id);
        if (row.subregionCode) context.subregionIds.set(normalizeName(row.subregionCode), row.id);
    });

    const assetTable = type === 'hard' ? hardAssets : softAssets;
    const existingAssets = await db
        .select({ id: assetTable.id, name: assetTable.name })
        .from(assetTable)
        .where(eq(assetTable.isDeleted, false));

    existingAssets.forEach((asset) => {
        rememberExistingAsset(context, asset);
    });

    const postalCodes = [...new Set(rows.map((row) => normalizeText(row.postalCode)).filter(Boolean))];
    if (postalCodes.length > 0) {
        const existingPostalRows = await db
            .select({
                postalCode: hardAssets.postalCode,
                lat: hardAssets.lat,
                lng: hardAssets.lng,
                address: hardAssets.address,
            })
            .from(hardAssets)
            .where(inArray(hardAssets.postalCode, postalCodes));

        existingPostalRows.forEach((row) => {
            if (!row.postalCode) return;
            context.geocodeCache.set(row.postalCode, {
                lat: parseFloat(row.lat),
                lng: parseFloat(row.lng),
                address: row.address
            });
        });
    }

    return context;
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
        const context = await buildImportContext(db, rows, type);

        for (const [index, row] of rows.entries()) {
            try {
                let partnerId = user.id; // default to uploader

                if (row.partnerUsername) {
                    const partnerUsernameStr = normalizeText(row.partnerUsername);
                    const resolvedPartnerId = context.partnerIds.get(partnerUsernameStr);
                    if (resolvedPartnerId) {
                        partnerId = resolvedPartnerId;
                    } else {
                        errors.push(`Row ${index + 1}: Partner username '${partnerUsernameStr}' not found. Skipping.`);
                        continue;
                    }
                }

                const name = normalizeText(row.name);
                if (!name) {
                    errors.push(`Row ${index + 1}: Name is required. Skipping.`);
                    continue;
                }

                const postalCode = normalizeText(row.postalCode);

                let lat = parseFloat(row.lat);
                let lng = parseFloat(row.lng);
                let address = normalizeText(row.address);

                const defaultSubregionId = user.subregionIds?.[0] || null;
                const subregionId = resolveSubregionId(row.subregionId, defaultSubregionId, context.subregionIds);
                const rowId = parseRowId(row.id);
                const matchedByName = context.existingByName.get(normalizeName(name));
                const targetAsset = rowId
                    ? context.existingById.get(rowId)
                    : matchedByName;

                if (type === 'hard') {
                    if (!/^\d{6}$/.test(postalCode)) {
                        errors.push(`Row ${index + 1}: Invalid 6-digit postal code format (${postalCode})`);
                        continue;
                    }

                    if (rowId && !targetAsset) {
                        errors.push(`Row ${index + 1}: Hard asset with ID ${rowId} not found for updating. Skipping.`);
                        continue;
                    }

                    if (isNaN(lat) || isNaN(lng) || !address) {
                        const cachedGeo = context.geocodeCache.get(postalCode) ?? await geocodePostal(postalCode);
                        context.geocodeCache.set(postalCode, cachedGeo);

                        if (cachedGeo) {
                            lat = Number.isNaN(lat) ? cachedGeo.lat : lat;
                            lng = Number.isNaN(lng) ? cachedGeo.lng : lng;
                            address = address || cachedGeo.address;
                        } else {
                            errors.push(`Row ${index + 1}: Could not geocode postal code ${postalCode}`);
                            continue;
                        }
                    }

                    let asset;
                    if (targetAsset) {
                        [asset] = await db.update(hardAssets).set({
                            partnerId,
                            name,
                            subCategory: row.subCategory || 'Active Ageing Centres',
                            lat: lat.toString(),
                            lng: lng.toString(),
                            address,
                            country: 'SG',
                            postalCode: postalCode,
                            phone: row.phone || null,
                            hours: row.hours || null,
                            description: row.description || null,
                            subregionId: subregionId || undefined
                        }).where(eq(hardAssets.id, targetAsset.id)).returning();
                    } else {
                        [asset] = await db.insert(hardAssets).values({
                            partnerId,
                            name,
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
                    rememberExistingAsset(context, asset);

                    importedRows.push(asset);
                } else if (type === 'soft') {
                    if (rowId && !targetAsset) {
                        errors.push(`Row ${index + 1}: Soft asset with ID ${rowId} not found for updating. Skipping.`);
                        continue;
                    }

                    let asset;
                    if (targetAsset) {
                        [asset] = await db.update(softAssets).set({
                            partnerId,
                            name,
                            subCategory: row.subCategory || 'Programmes',
                            description: row.description || null,
                            schedule: row.schedule || null,
                            isMemberOnly: String(row.isMemberOnly).toLowerCase() === 'true',
                            subregionId: subregionId || undefined
                        }).where(eq(softAssets.id, targetAsset.id)).returning();
                    } else {
                        [asset] = await db.insert(softAssets).values({
                            partnerId,
                            name,
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

                    rememberExistingAsset(context, asset);
                    importedRows.push(asset);
                }
            } catch (rowErr) {
                console.error(`Import row ${index + 1} failed:`, rowErr);
                errors.push(`Row ${index + 1}: ${rowErr?.message || 'Unexpected import error.'}`);
            }
        }

        if (importedRows.length > 0) {
            await rebuildMapCache('all', c.env);
        }

        return c.json({
            message: `Successfully imported ${importedRows.length} rows`,
            importedCount: importedRows.length,
            failedCount: errors.length,
            totalRows: rows.length,
            errors
        });
    } catch (err) {
        console.error('Import Error:', err);
        return c.json({ error: err?.message || 'Database import failed' }, 500);
    }
};
