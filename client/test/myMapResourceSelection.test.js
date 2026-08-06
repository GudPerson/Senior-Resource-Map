import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMyMapAssetMutationPlan,
    isMyMapAssetSelectionReconciled,
} from '../src/lib/myMapResourceSelection.js';

test('My Map resource mutations reconcile stale duplicate additions against server state', () => {
    const staleClientAssets = [
        { assetKey: 'hard-11', resourceType: 'hard', resourceId: 11 },
    ];
    const selectedAssets = [
        { resourceType: 'hard', resourceId: 11 },
        { resourceType: 'hard', resourceId: 12 },
    ];
    const { targetKeys, toAdd, toRemove } = buildMyMapAssetMutationPlan(
        staleClientAssets,
        selectedAssets,
    );

    assert.deepEqual(toAdd, [{ resourceType: 'hard', resourceId: 12 }]);
    assert.deepEqual(toRemove, []);
    assert.equal(isMyMapAssetSelectionReconciled([
        ...staleClientAssets,
        { assetKey: 'hard-12', resourceType: 'hard', resourceId: 12 },
    ], targetKeys), true);
});

test('My Map resource reconciliation detects partial updates deterministically', () => {
    const { targetKeys } = buildMyMapAssetMutationPlan([], [
        { resourceType: 'hard', resourceId: 21 },
        { resourceType: 'soft', resourceId: 34 },
    ]);

    assert.equal(isMyMapAssetSelectionReconciled([
        { assetKey: 'hard-21', resourceType: 'hard', resourceId: 21 },
    ], targetKeys), false);
    assert.equal(isMyMapAssetSelectionReconciled([
        { assetKey: 'hard-21', resourceType: 'hard', resourceId: 21 },
        { assetKey: 'soft-34', resourceType: 'soft', resourceId: 34 },
        { assetKey: 'hard-99', resourceType: 'hard', resourceId: 99 },
    ], targetKeys), false);
});
