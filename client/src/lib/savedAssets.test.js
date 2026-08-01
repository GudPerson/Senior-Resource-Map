import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSavedAssetKey, selectBulkSavedAssetTargets } from './savedAssets.js';

test('bulk saved-asset selection keeps only resources whose state must change', () => {
    const items = [
        { resourceType: 'hard', resourceId: 11 },
        { resourceType: 'hard', resourceId: 11 },
        { resourceType: 'soft', resourceId: 22 },
        { resourceType: 'invalid', resourceId: 33 },
        { resourceType: 'hard', resourceId: 0 },
    ];
    const savedKeys = new Set([buildSavedAssetKey('hard', 11)]);

    assert.deepEqual(selectBulkSavedAssetTargets(items, savedKeys, true), [
        { resourceType: 'soft', resourceId: 22 },
    ]);
    assert.deepEqual(selectBulkSavedAssetTargets(items, savedKeys, false), [
        { resourceType: 'hard', resourceId: 11 },
    ]);
});

test('bulk saved-asset selection returns no work when every resource already has the requested state', () => {
    const items = [
        { resourceType: 'hard', resourceId: 11 },
        { resourceType: 'soft', resourceId: 22 },
    ];
    const savedKeys = new Set(items.map((item) => buildSavedAssetKey(item.resourceType, item.resourceId)));

    assert.deepEqual(selectBulkSavedAssetTargets(items, savedKeys, true), []);
    assert.deepEqual(selectBulkSavedAssetTargets(items, new Set(), false), []);
});
