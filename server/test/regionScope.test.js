import test from 'node:test';
import assert from 'node:assert/strict';

import {
    attachHardAssetRegionMatches,
    attachStandaloneSoftAssetCoverage,
    filterSoftAssetsByRegionRelevance,
    getActorRegionIds,
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

test('super admin is region-relevant for every standalone soft asset', () => {
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

test('Singapore national region covers SG hard assets when exact postal rows are missing', () => {
    const assets = [
        { id: 1, country: 'SG', postalCode: '679440' },
        { id: 2, country: 'MY', postalCode: '679440' },
        { id: 3, country: 'SG', postalCode: 'not-a-postal' },
    ];

    assert.deepEqual(
        attachHardAssetRegionMatches(assets, [], { singaporeRegionId: 186 })
            .map((asset) => [asset.id, asset.matchingRegionIds]),
        [[1, [186]], [2, []], [3, []]],
    );
});

test('Singapore national region coexists with exact local hard asset matches', () => {
    const assets = [
        { id: 1, country: 'SG', postalCode: '680153' },
    ];
    const regionRows = [
        { postalCode: '680153', subregionId: 10 },
        { postalCode: '680153', subregionId: 20 },
    ];

    assert.deepEqual(
        attachHardAssetRegionMatches(assets, regionRows, { singaporeRegionId: 186 })
            .map((asset) => [asset.id, asset.matchingRegionIds]),
        [[1, [10, 20, 186]]],
    );
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
