function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value);
}

function normalizeInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

function coalesce(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

function parseJsonValue(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeTags(value) {
    const parsed = parseJsonValue(value, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map((entry) => (typeof entry === 'string' ? entry : (entry?.name || entry?.label || '')))
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function normalizeTranslations(value) {
    const parsed = parseJsonValue(value, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y'].includes(normalized);
}

function normalizeGroupAssetMode(value) {
    return normalizeString(value).trim().toLowerCase();
}

function normalizeGroupMemberSummary(value) {
    const parsed = parseJsonValue(value, null);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { counts: { places: 0, programmes: 0, services: 0, promotions: 0, total: 0 } };
    }
    const counts = parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {};
    return {
        ...parsed,
        counts: {
            places: normalizeInteger(counts.places) ?? 0,
            programmes: normalizeInteger(counts.programmes) ?? 0,
            services: normalizeInteger(counts.services) ?? 0,
            promotions: normalizeInteger(counts.promotions) ?? 0,
            total: normalizeInteger(counts.total) ?? 0,
        },
    };
}

function normalizeGroupMemberLocations(value) {
    const parsed = parseJsonValue(value, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map((location) => ({
            id: normalizeInteger(location?.id),
            name: coalesce(location?.name, location?.title),
            address: normalizeString(location?.address),
            postalCode: coalesce(location?.postalCode, location?.postal_code),
            lat: location?.lat,
            lng: location?.lng,
            subCategory: normalizeString(coalesce(location?.subCategory, location?.sub_category)),
        }))
        .filter((location) => location.id || location.name || location.postalCode);
}

function normalizeCacheType(row) {
    const type = normalizeString(row?.asset_type || row?.assetType || row?.type).trim().toLowerCase();
    if (type === 'hard' || type === 'place') return 'hard';
    if (type === 'soft' || type === 'offering') return 'soft';
    return '';
}

function buildLocationFromCacheRow(row) {
    const locationId = normalizeInteger(coalesce(
        row.location_hard_asset_id,
        row.locationHardAssetId,
        row.location_id,
        row.locationId,
    ));
    return {
        id: locationId ?? undefined,
        name: coalesce(row.location_name, row.locationName, row.address, row.title, row.name),
        address: coalesce(row.location_address, row.locationAddress, row.address),
        postalCode: coalesce(row.location_postal_code, row.locationPostalCode, row.postal_code, row.postalCode),
        whatsappContact: normalizeString(coalesce(row.location_whatsapp_contact, row.locationWhatsappContact)),
        lat: row.lat,
        lng: row.lng,
        translations: normalizeTranslations(coalesce(row.location_translations, row.locationTranslations)),
    };
}

function buildHardAssetFromCacheRow(row) {
    const id = normalizeInteger(row.id);
    if (!id) return null;

    return {
        id,
        name: coalesce(row.name, row.title),
        subCategory: coalesce(row.subCategory, row.sub_category, row.category),
        description: normalizeString(row.description),
        address: coalesce(row.address, row.location_address, row.locationAddress),
        postalCode: coalesce(row.postalCode, row.postal_code, row.location_postal_code, row.locationPostalCode),
        lat: row.lat,
        lng: row.lng,
        logoUrl: coalesce(row.logoUrl, row.logo_url),
        bannerUrl: coalesce(row.bannerUrl, row.banner_url),
        hours: normalizeString(row.hours),
        website: normalizeString(row.website),
        phone: normalizeString(row.phone),
        whatsappContact: normalizeString(coalesce(row.whatsappContact, row.whatsapp_contact)),
        tags: normalizeTags(row.tags),
        translations: normalizeTranslations(row.translations),
        softAssets: [],
        isHidden: false,
        updatedAt: coalesce(row.updatedAt, row.updated_at, new Date(0).toISOString()),
    };
}

function buildSoftAssetFromCacheRow(row) {
    const id = normalizeInteger(row.id);
    if (!id) return null;

    return {
        id,
        name: coalesce(row.name, row.title),
        subCategory: coalesce(row.subCategory, row.sub_category, row.category),
        description: normalizeString(row.description),
        schedule: normalizeString(row.schedule),
        bucket: normalizeString(row.bucket),
        assetMode: normalizeGroupAssetMode(coalesce(row.assetMode, row.asset_mode)) || 'standalone',
        phone: normalizeString(row.phone),
        whatsappContact: normalizeString(coalesce(row.whatsappContact, row.whatsapp_contact)),
        logoUrl: coalesce(row.logoUrl, row.logo_url),
        bannerUrl: coalesce(row.bannerUrl, row.banner_url),
        availabilityEnabled: normalizeBoolean(coalesce(row.availabilityEnabled, row.availability_enabled)),
        availabilityCount: normalizeInteger(coalesce(row.availabilityCount, row.availability_count)) ?? 0,
        availabilityUnit: normalizeString(coalesce(row.availabilityUnit, row.availability_unit)),
        access: 'granted',
        tags: normalizeTags(row.tags),
        translations: normalizeTranslations(row.translations),
        groupMemberSummary: normalizeGroupMemberSummary(coalesce(row.groupMemberSummary, row.group_member_summary)),
        groupMemberSearchText: normalizeString(coalesce(row.groupMemberSearchText, row.group_member_search_text)),
        groupMemberLocations: normalizeGroupMemberLocations(coalesce(row.groupMemberLocations, row.group_member_locations)),
        locations: [],
        location: null,
        isHidden: false,
        updatedAt: coalesce(row.updatedAt, row.updated_at, new Date(0).toISOString()),
    };
}

export function normalizeDiscoveryCacheRows(rows = []) {
    const hardAssets = [];
    const hardById = new Map();
    const softById = new Map();
    const softLocationHardIds = new Map();

    for (const row of Array.isArray(rows) ? rows : []) {
        const type = normalizeCacheType(row);
        if (type === 'hard') {
            const asset = buildHardAssetFromCacheRow(row);
            if (!asset) continue;
            if (!hardById.has(asset.id)) {
                hardById.set(asset.id, asset);
                hardAssets.push(asset);
            }
            continue;
        }

        if (type !== 'soft') continue;

        const softId = normalizeInteger(row.id);
        if (!softId) continue;
        let asset = softById.get(softId);
        if (!asset) {
            asset = buildSoftAssetFromCacheRow(row);
            if (!asset) continue;
            softById.set(softId, asset);
        }

        const location = buildLocationFromCacheRow(row);
        if (location.lat && location.lng) {
            asset.locations.push(location);
            if (!asset.location) asset.location = location;
        }

        const hardAssetId = normalizeInteger(coalesce(row.location_hard_asset_id, row.locationHardAssetId));
        if (hardAssetId) {
            if (!softLocationHardIds.has(softId)) softLocationHardIds.set(softId, new Set());
            softLocationHardIds.get(softId).add(hardAssetId);
        }
    }

    for (const [softId, hardIds] of softLocationHardIds.entries()) {
        const softAsset = softById.get(softId);
        if (!softAsset) continue;
        for (const hardId of hardIds) {
            const hardAsset = hardById.get(hardId);
            if (!hardAsset) continue;
            hardAsset.softAssets.push(softAsset);
        }
    }

    return {
        hardAssets,
        softAssets: [...softById.values()],
    };
}
