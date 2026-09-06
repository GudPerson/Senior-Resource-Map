import { buildSavedAssetKey } from './savedAssets.js';

export const SAVED_ASSET_MAP_USAGE_FILTERS = Object.freeze({
    all: 'all',
    used: 'used',
    unused: 'unused',
});

export function getSavedAssetMapUsageCount(asset, usageByAssetKey) {
    if (!(usageByAssetKey instanceof Map)) return 0;
    const assetKey = buildSavedAssetKey(asset?.resourceType, asset?.resourceId);
    return Math.max(0, Number(usageByAssetKey.get(assetKey)?.myMapCount) || 0);
}

export function filterSavedAssetsByMapUsage(items, usageByAssetKey, filter) {
    const source = Array.isArray(items) ? items : [];
    if (filter === SAVED_ASSET_MAP_USAGE_FILTERS.used) {
        return source.filter((asset) => getSavedAssetMapUsageCount(asset, usageByAssetKey) > 0);
    }
    if (filter === SAVED_ASSET_MAP_USAGE_FILTERS.unused) {
        return source.filter((asset) => getSavedAssetMapUsageCount(asset, usageByAssetKey) === 0);
    }
    return source;
}

export function selectUnusedSavedAssets(items, usageByAssetKey) {
    return (Array.isArray(items) ? items : []).filter(
        (asset) => getSavedAssetMapUsageCount(asset, usageByAssetKey) === 0,
    );
}

export function summarizeSavedAssetRemoval(items) {
    const resources = Array.isArray(items) ? items : [];
    return {
        resourceCount: resources.length,
        offeringCount: resources.filter((asset) => asset?.resourceType === 'soft').length,
    };
}
