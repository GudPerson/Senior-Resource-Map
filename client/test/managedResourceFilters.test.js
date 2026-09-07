import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildManagedRegionFilterOptions,
    buildManagedSavedAssetTargets,
    getManagedResourceRegionIds,
    matchesManagedResourceRegion,
    normalizeManagedRegionFilter,
} from '../src/lib/managedResourceFilters.js';

test('managed Region options are deduplicated and consistently labelled', () => {
    const options = buildManagedRegionFilterOptions([
        { id: 130, name: 'Choa Chu Kang 3', subregionCode: 'SR-CLW3' },
        { id: 129, name: 'Choa Chu Kang 2', subregionCode: 'SR-CLW2' },
        { id: 130, name: 'Duplicate' },
        { id: null, name: 'Invalid' },
    ]);

    assert.deepEqual(options, [
        { value: 'all', label: 'All regions' },
        { value: '129', label: 'Choa Chu Kang 2 (SR-CLW2)' },
        { value: '130', label: 'Choa Chu Kang 3 (SR-CLW3)' },
    ]);
    assert.equal(normalizeManagedRegionFilter('130', options), '130');
    assert.equal(normalizeManagedRegionFilter('999', options), 'all');
});

test('managed Region matching covers primary, linked, coverage, and Group locations', () => {
    const asset = {
        subregionId: 1,
        matchingRegionIds: [2],
        coverageRegionIds: [3],
        location: { subregionId: 4, matchingRegionIds: [5] },
        locations: [{ primaryRegionId: 6 }],
        groupMemberLocations: [{ subregionId: 7 }],
    };

    assert.deepEqual(getManagedResourceRegionIds(asset), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(matchesManagedResourceRegion(asset, '5'), true);
    assert.equal(matchesManagedResourceRegion(asset, 7), true);
    assert.equal(matchesManagedResourceRegion(asset, '8'), false);
    assert.equal(matchesManagedResourceRegion(asset, 'all'), true);
});

test('managed saved-resource targets keep valid unique ids in filtered order', () => {
    assert.deepEqual(buildManagedSavedAssetTargets([
        { id: 4 },
        { id: '5' },
        { id: 4 },
        { id: 0 },
    ], 'soft'), [
        { resourceType: 'soft', resourceId: 4 },
        { resourceType: 'soft', resourceId: 5 },
    ]);
    assert.deepEqual(buildManagedSavedAssetTargets([{ id: 4 }], 'template'), []);
});
