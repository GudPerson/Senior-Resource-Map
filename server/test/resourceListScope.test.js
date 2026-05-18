import test from 'node:test';
import assert from 'node:assert/strict';

import {
    filterHardAssetsForResourceList,
    filterSoftAssetsForResourceList,
    paginateResourceList,
    shouldRejectManagedResourceListRequest,
} from '../src/utils/resourceListScope.js';

function actor(overrides = {}) {
    return {
        id: 1,
        role: 'standard',
        subregionIds: [],
        hardAssetStaffAccess: [],
        partnerStaffAccess: [],
        ...overrides,
    };
}

test('resource lists count after filtering before pagination', () => {
    const visibleAssets = [
        { id: 1, isHidden: false },
        { id: 2, isHidden: true },
        { id: 3, isHidden: false },
    ].filter((asset) => !asset.isHidden);

    const page = paginateResourceList(visibleAssets, { page: 2, pageSize: 1 });

    assert.deepEqual(page.data.map((asset) => asset.id), [3]);
    assert.equal(page.pagination.totalCount, 2);
    assert.equal(page.pagination.totalPages, 2);
});

test('managed hard asset lists include visible places regardless of boundary plus hidden direct assignments', () => {
    const user = actor({
        hardAssetStaffAccess: [{
            hardAssetId: 10,
            staffRole: 'staff',
        }],
    });
    const assets = [
        { id: 10, isHidden: true, partnerId: null, subregionId: 4 },
        { id: 11, isHidden: false, partnerId: null, subregionId: 4 },
        { id: 12, isHidden: true, partnerId: null, subregionId: 4 },
    ];

    const scoped = filterHardAssetsForResourceList(assets, user, {
        scope: 'managed',
        isVisible: (asset) => !asset.isHidden,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [10, 11]);
});

test('managed hard asset lists do not use boundaries to hide visible places', () => {
    const user = actor({
        role: 'regional_admin',
        subregionIds: [10],
    });
    const assets = [
        { id: 10, isHidden: false, partnerId: null, matchingRegionIds: [10] },
        { id: 11, isHidden: false, partnerId: null, matchingRegionIds: [20] },
        { id: 12, isHidden: true, partnerId: null, matchingRegionIds: [20] },
    ];

    const scoped = filterHardAssetsForResourceList(assets, user, {
        scope: 'managed',
        isVisible: (asset) => !asset.isHidden,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [10, 11]);
});

test('managed soft asset lists follow direct access to linked hard assets', () => {
    const user = actor({
        hardAssetStaffAccess: [{
            hardAssetId: 10,
            staffRole: 'owner',
        }],
    });
    const assets = [
        { id: 21, partnerId: null, subregionId: 4, hostHardAssetId: 10 },
        { id: 22, partnerId: null, subregionId: 4, locations: [{ hardAssetId: 30 }] },
    ];

    const scoped = filterSoftAssetsForResourceList(assets, user, {
        scope: 'managed',
        isVisible: () => true,
        canExpose: () => true,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [21]);
});

test('managed standalone soft asset lists follow service coverage', () => {
    const user = actor({
        role: 'regional_admin',
        subregionIds: [30],
    });
    const assets = [
        { id: 21, assetMode: 'standalone', coverageRegionIds: [30] },
        { id: 22, assetMode: 'standalone', coverageRegionIds: [40] },
    ];

    const scoped = filterSoftAssetsForResourceList(assets, user, {
        scope: 'managed',
        isVisible: () => true,
        canExpose: () => true,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [21]);
});

test('managed resource list scope rejects guest access instead of returning silent zeroes', () => {
    assert.equal(shouldRejectManagedResourceListRequest('managed', { role: 'guest' }), true);
    assert.equal(shouldRejectManagedResourceListRequest('visible', { role: 'guest' }), false);
    assert.equal(shouldRejectManagedResourceListRequest('managed', { role: 'super_admin' }), false);
});
