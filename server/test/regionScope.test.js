import test from 'node:test';
import assert from 'node:assert/strict';

import {
    attachHardAssetRegionMatches,
    attachStandaloneSoftAssetCoverage,
    filterHardAssetsByRegionRelevance,
    filterSoftAssetsByRegionRelevance,
    getActorRegionIds,
    hardAssetMatchesActorRegions,
    standaloneSoftAssetMatchesActorRegions,
    summarizeMatchingRegions,
} from '../src/utils/regionScope.js';

function actor(overrides = {}) {
    return {
        id: 1,
        role: 'regional_admin',
        subregionIds: [10],
        hardAssetStaffAccess: [],
        softAssetStaffAccess: [],
        ...overrides,
    };
}

test('hard asset read relevance follows overlapping postal-code regions', () => {
    const asset = {
        id: 99,
        postalCode: '680153',
        matchingRegionIds: [10, 20, 30],
        subregionId: 20,
    };

    assert.equal(hardAssetMatchesActorRegions(actor({ subregionIds: [10] }), asset), true);
    assert.equal(hardAssetMatchesActorRegions(actor({ subregionIds: [30] }), asset), true);
    assert.equal(hardAssetMatchesActorRegions(actor({ subregionIds: [40] }), asset), false);
});

test('hard asset direct owner or staff access grants relevance without a region match', () => {
    const asset = {
        id: 77,
        matchingRegionIds: [],
    };

    assert.equal(hardAssetMatchesActorRegions(actor({
        subregionIds: [],
        hardAssetStaffAccess: [{ hardAssetId: 77, staffRole: 'staff' }],
    }), asset), true);
});

test('super admin is region-relevant for every asset', () => {
    assert.equal(hardAssetMatchesActorRegions(actor({ role: 'super_admin', subregionIds: [] }), { id: 99 }), true);
    assert.equal(standaloneSoftAssetMatchesActorRegions(actor({ role: 'super_admin', subregionIds: [] }), { id: 501 }), true);
});

test('standalone soft asset read relevance follows explicit service region coverage', () => {
    const offering = {
        id: 501,
        assetMode: 'standalone',
        coverageRegionIds: [10, 30],
    };

    assert.equal(standaloneSoftAssetMatchesActorRegions(actor({ subregionIds: [10] }), offering), true);
    assert.equal(standaloneSoftAssetMatchesActorRegions(actor({ subregionIds: [20] }), offering), false);
});

test('standalone soft asset direct staff access grants relevance without coverage match', () => {
    const offering = {
        id: 501,
        assetMode: 'standalone',
        coverageRegionIds: [],
    };

    assert.equal(standaloneSoftAssetMatchesActorRegions(actor({
        subregionIds: [],
        softAssetStaffAccess: [{ softAssetId: 501, staffRole: 'staff' }],
    }), offering), true);
});

test('matching region summary is stable and numeric', () => {
    assert.deepEqual(summarizeMatchingRegions([
        { id: '30' },
        { id: 10 },
        { id: 10 },
        { id: 'bad' },
    ]), [10, 30]);
});

test('actor region ids are normalized from session payload', () => {
    assert.deepEqual(getActorRegionIds(actor({ subregionIds: ['20', 10, 'bad', 20] })), [10, 20]);
});

test('postal-code rows attach all matching regions to hard assets', () => {
    const assets = [
        { id: 1, postalCode: '100001' },
        { id: 2, postalCode: '100002' },
    ];
    const regionRows = [
        { postalCode: '100001', subregionId: 10 },
        { postalCode: '100001', subregionId: 20 },
        { postalCode: '100002', subregionId: 30 },
    ];

    assert.deepEqual(
        attachHardAssetRegionMatches(assets, regionRows).map((asset) => [asset.id, asset.matchingRegionIds]),
        [[1, [10, 20]], [2, [30]]],
    );
});

test('managed hard asset read scope uses region relevance, not edit authority', () => {
    const scoped = filterHardAssetsByRegionRelevance([
        { id: 1, matchingRegionIds: [10] },
        { id: 2, matchingRegionIds: [20] },
    ], actor({ subregionIds: [10] }));

    assert.deepEqual(scoped.map((asset) => asset.id), [1]);
});

test('standalone soft asset coverage attaches service region ids', () => {
    const offerings = [
        { id: 1, assetMode: 'standalone' },
        { id: 2, assetMode: 'standalone' },
    ];
    const coverageRows = [
        { softAssetId: 1, subregionId: 10 },
        { softAssetId: 1, subregionId: 30 },
        { softAssetId: 2, subregionId: 20 },
    ];

    assert.deepEqual(
        attachStandaloneSoftAssetCoverage(offerings, coverageRows).map((offering) => [offering.id, offering.coverageRegionIds]),
        [[1, [10, 30]], [2, [20]]],
    );
});

test('standalone soft asset list relevance follows coverage regions', () => {
    const scoped = filterSoftAssetsByRegionRelevance([
        { id: 1, assetMode: 'standalone', coverageRegionIds: [10, 30] },
        { id: 2, assetMode: 'standalone', coverageRegionIds: [20] },
    ], actor({ subregionIds: [30] }));

    assert.deepEqual(scoped.map((offering) => offering.id), [1]);
});
