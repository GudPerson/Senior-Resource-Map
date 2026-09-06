import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SAVED_ASSET_MAP_USAGE_FILTERS,
    filterSavedAssetsByMapUsage,
    getSavedAssetMapUsageCount,
    selectUnusedSavedAssets,
    summarizeSavedAssetRemoval,
} from './savedAssetBulkManagement.js';

const savedAssets = [
    { resourceType: 'hard', resourceId: 11, name: 'Used place' },
    { resourceType: 'soft', resourceId: 22, name: 'Unused activity' },
    { resourceType: 'soft', resourceId: 33, name: 'Used activity' },
];

const usageByAssetKey = new Map([
    ['hard-11', { myMapCount: 2 }],
    ['soft-33', { myMapCount: 1 }],
]);

test('saved-resource map filters distinguish used and unused resources', () => {
    assert.deepEqual(
        filterSavedAssetsByMapUsage(savedAssets, usageByAssetKey, SAVED_ASSET_MAP_USAGE_FILTERS.used)
            .map((asset) => asset.resourceId),
        [11, 33],
    );
    assert.deepEqual(
        filterSavedAssetsByMapUsage(savedAssets, usageByAssetKey, SAVED_ASSET_MAP_USAGE_FILTERS.unused)
            .map((asset) => asset.resourceId),
        [22],
    );
    assert.equal(
        filterSavedAssetsByMapUsage(savedAssets, usageByAssetKey, SAVED_ASSET_MAP_USAGE_FILTERS.all).length,
        3,
    );
});

test('bulk-removal candidates exclude every resource used in a My Map', () => {
    assert.deepEqual(
        selectUnusedSavedAssets(savedAssets, usageByAssetKey).map((asset) => asset.resourceId),
        [22],
    );
    assert.equal(getSavedAssetMapUsageCount(savedAssets[0], usageByAssetKey), 2);
    assert.equal(getSavedAssetMapUsageCount(savedAssets[1], usageByAssetKey), 0);
});

test('bulk-removal impact counts Offerings for the Care Calendar warning', () => {
    assert.deepEqual(summarizeSavedAssetRemoval(savedAssets), {
        resourceCount: 3,
        offeringCount: 2,
    });
});
