import { normalizeDiscoveryCacheRows } from './discoveryCache.js';
import { fetchAllPaginatedResults } from './paginatedResults.js';
import { buildSavedAssetKey } from './savedAssets.js';

export const MANAGE_MAP_CATALOG_MIN_QUERY_LENGTH = 2;
export const MANAGE_MAP_CATALOG_RESULT_LIMIT = 40;

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeResourceId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function firstLocation(asset) {
    if (asset?.location && typeof asset.location === 'object') return asset.location;
    if (Array.isArray(asset?.locations) && asset.locations.length > 0) return asset.locations[0];
    if (Array.isArray(asset?.groupMemberLocations) && asset.groupMemberLocations.length > 0) {
        return asset.groupMemberLocations[0];
    }
    return null;
}

export function normalizeManageMapCatalogAsset(resourceType, asset) {
    const normalizedType = String(resourceType || '').trim().toLowerCase();
    const resourceId = normalizeResourceId(asset?.resourceId ?? asset?.id);
    const name = normalizeText(asset?.name);
    if (!['hard', 'soft'].includes(normalizedType) || !resourceId || !name) return null;

    const location = normalizedType === 'soft' ? firstLocation(asset) : asset;
    const lat = parseCoordinate(asset?.lat ?? location?.lat);
    const lng = parseCoordinate(asset?.lng ?? location?.lng);

    return {
        ...asset,
        resourceType: normalizedType,
        resourceId,
        name,
        subCategory: normalizeText(asset?.subCategory),
        address: normalizeText(asset?.address || location?.address),
        lat,
        lng,
        hasCoordinates: lat !== null && lng !== null,
        status: 'available',
        detailPath: `/resource/${normalizedType}/${resourceId}`,
    };
}

export function buildManageMapResourceCatalog({ hardAssets = [], softAssets = [] } = {}) {
    const byKey = new Map();

    for (const [resourceType, assets] of [['hard', hardAssets], ['soft', softAssets]]) {
        for (const asset of Array.isArray(assets) ? assets : []) {
            const normalized = normalizeManageMapCatalogAsset(resourceType, asset);
            if (!normalized) continue;
            const key = buildSavedAssetKey(normalized.resourceType, normalized.resourceId);
            if (!byKey.has(key)) byKey.set(key, normalized);
        }
    }

    return [...byKey.values()];
}

function buildSearchText(asset) {
    const tags = Array.isArray(asset?.tags)
        ? asset.tags.map((tag) => (typeof tag === 'string' ? tag : (tag?.name || tag?.label || '')))
        : [];

    return [
        asset?.name,
        asset?.subCategory,
        asset?.address,
        asset?.description,
        asset?.schedule,
        asset?.groupMemberSearchText,
        ...tags,
        asset?.resourceType === 'hard' ? 'place' : 'offering',
    ]
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
        .join(' ');
}

export function filterManageMapResourceCatalog({
    catalog = [],
    query = '',
    filter = 'all',
    savedAssetKeys = new Set(),
    limit = MANAGE_MAP_CATALOG_RESULT_LIMIT,
} = {}) {
    const normalizedQuery = normalizeText(query).toLowerCase();
    if (normalizedQuery.length < MANAGE_MAP_CATALOG_MIN_QUERY_LENGTH) return [];

    const savedKeys = savedAssetKeys instanceof Set ? savedAssetKeys : new Set(savedAssetKeys || []);
    const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : MANAGE_MAP_CATALOG_RESULT_LIMIT;

    return (Array.isArray(catalog) ? catalog : [])
        .filter((asset) => filter === 'all' || asset.resourceType === filter)
        .filter((asset) => !savedKeys.has(buildSavedAssetKey(asset.resourceType, asset.resourceId)))
        .filter((asset) => buildSearchText(asset).includes(normalizedQuery))
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, boundedLimit);
}

export async function loadManageMapResourceCatalog({
    getDiscoveryCache,
    getHardAssets,
    getSoftAssets,
    fetchAll = fetchAllPaginatedResults,
} = {}) {
    if (typeof getDiscoveryCache !== 'function' || typeof getHardAssets !== 'function' || typeof getSoftAssets !== 'function') {
        throw new Error('Resource catalogue is unavailable.');
    }

    const [cacheRows, groupAssets] = await Promise.all([
        getDiscoveryCache('all').catch(() => null),
        fetchAll(getSoftAssets, { assetMode: 'group' }).catch(() => []),
    ]);

    let hardAssets = [];
    let softAssets = [];

    if (Array.isArray(cacheRows) && cacheRows.length > 0) {
        const normalized = normalizeDiscoveryCacheRows(cacheRows);
        hardAssets = normalized.hardAssets;
        softAssets = normalized.softAssets;
    } else {
        [hardAssets, softAssets] = await Promise.all([
            fetchAll(getHardAssets),
            fetchAll(getSoftAssets),
        ]);
    }

    return buildManageMapResourceCatalog({
        hardAssets,
        softAssets: [...softAssets, ...(Array.isArray(groupAssets) ? groupAssets : [])],
    });
}
