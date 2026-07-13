import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildResourceListPagination,
    filterHardAssetsForResourceList,
    filterSoftAssetsForResourceList,
    paginateResourceList,
    shouldUseDirectManagedResourcePagination,
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

test('admin managed hard asset lists include visible places regardless of boundary plus hidden direct assignments', () => {
    const user = actor({
        role: 'regional_admin',
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

test('standard users with direct hard-asset access only see assigned managed places', () => {
    const user = actor({
        hardAssetStaffAccess: [{
            hardAssetId: 10,
            staffRole: 'staff',
        }],
    });
    const assets = [
        { id: 10, isHidden: true, partnerId: null, subregionId: 4 },
        { id: 11, isHidden: false, partnerId: null, subregionId: 4 },
        { id: 12, isHidden: false, partnerId: null, subregionId: 4 },
    ];

    const scoped = filterHardAssetsForResourceList(assets, user, {
        scope: 'managed',
        isVisible: (asset) => !asset.isHidden,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [10]);
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

test('admin management hard asset lists can opt into region relevance', () => {
    const user = actor({
        role: 'regional_admin',
        subregionIds: [10],
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'staff',
        }],
    });
    const assets = [
        { id: 10, isHidden: false, partnerId: null, matchingRegionIds: [10] },
        { id: 11, isHidden: false, partnerId: null, matchingRegionIds: [20] },
        { id: 12, isHidden: true, partnerId: null, matchingRegionIds: [20] },
    ];

    const scoped = filterHardAssetsForResourceList(assets, user, {
        scope: 'managed',
        regionScoped: true,
        isVisible: (asset) => !asset.isHidden,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [10, 12]);
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

test('managed soft asset lists include directly assigned offerings', () => {
    const user = actor({
        softAssetStaffAccess: [{
            softAssetId: 21,
            staffRole: 'staff',
        }],
    });
    const assets = [
        { id: 21, partnerId: null, subregionId: 4, locations: [{ hardAssetId: 30 }] },
        { id: 22, partnerId: null, subregionId: 4, locations: [{ hardAssetId: 30 }] },
    ];

    const scoped = filterSoftAssetsForResourceList(assets, user, {
        scope: 'managed',
        isVisible: () => true,
        canExpose: () => true,
    });

    assert.deepEqual(scoped.map((asset) => asset.id), [21]);
});

test('partner managed soft asset lists exclude unrelated offerings in the same region', () => {
    const user = actor({
        id: 101,
        role: 'partner',
        subregionIds: [30],
    });
    const assets = [
        { id: 21, partnerId: 101, assetMode: 'standalone', coverageRegionIds: [30] },
        { id: 22, partnerId: 202, assetMode: 'standalone', coverageRegionIds: [30] },
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
    assert.equal(shouldRejectManagedResourceListRequest('managed', actor({ role: 'standard' })), true);
    assert.equal(shouldRejectManagedResourceListRequest('visible', { role: 'guest' }), false);
    assert.equal(shouldRejectManagedResourceListRequest('managed', { role: 'super_admin' }), false);
    assert.equal(shouldRejectManagedResourceListRequest('managed', actor({
        role: 'standard',
        softAssetStaffAccess: [{ softAssetId: 21, staffRole: 'staff' }],
    })), false);
});

test('super admin managed lists can use direct database pagination safely', () => {
    assert.equal(shouldUseDirectManagedResourcePagination({
        scope: 'managed',
        actor: actor({ role: 'super_admin' }),
    }), true);

    assert.equal(shouldUseDirectManagedResourcePagination({
        scope: 'managed',
        actor: actor({
            hardAssetStaffAccess: [{
                hardAssetId: 10,
                staffRole: 'staff',
            }],
        }),
    }), true);

    assert.equal(shouldUseDirectManagedResourcePagination({
        scope: 'visible',
        actor: actor({ role: 'super_admin' }),
    }), false);

    assert.equal(shouldUseDirectManagedResourcePagination({
        scope: 'managed',
        actor: actor({ role: 'regional_admin' }),
    }), false);

    assert.equal(shouldUseDirectManagedResourcePagination({
        scope: 'managed',
        actor: actor({ role: 'standard' }),
    }), false);
});

test('resource list pagination can be built from a database total count', () => {
    assert.deepEqual(buildResourceListPagination({
        totalCount: 123,
        page: 3,
        pageSize: 50,
    }), {
        totalCount: 123,
        page: 3,
        pageSize: 50,
        totalPages: 3,
    });

    assert.deepEqual(buildResourceListPagination({
        totalCount: 0,
        page: 1,
        pageSize: 50,
    }), {
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
    });
});
