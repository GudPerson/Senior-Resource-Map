import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDiscoveryCacheRows } from '../src/lib/discoveryCache.js';
import {
    buildSavedPlacePins,
    getAssetAreaLocations,
    getAssetLocations,
} from '../src/features/discover/discoveryData.js';

test('Discovery cache normalizes Group rows as list-only soft assets with member context', () => {
    const normalized = normalizeDiscoveryCacheRows([
        {
            id: 90,
            title: 'West Care Picks',
            category: 'Groups',
            description: 'Curated public resources in the west',
            asset_type: 'soft',
            asset_mode: 'group',
            lat: null,
            lng: null,
            group_member_summary: { counts: { places: 1, programmes: 1, services: 0, promotions: 0, total: 2 } },
            group_member_search_text: 'Bukit Batok Care Hub Falls Prevention',
            group_member_locations: [
                { id: 10, name: 'Bukit Batok Care Hub', postalCode: '650010', lat: '1.35', lng: '103.75' },
            ],
        },
    ]);

    const group = normalized.softAssets[0];
    assert.equal(group.assetMode, 'group');
    assert.equal(group.name, 'West Care Picks');
    assert.deepEqual(group.groupMemberSummary.counts, {
        places: 1,
        programmes: 1,
        services: 0,
        promotions: 0,
        total: 2,
    });
    assert.equal(group.groupMemberSearchText, 'Bukit Batok Care Hub Falls Prevention');
    assert.equal(group.locations.length, 0);
    assert.equal(group.groupMemberLocations.length, 1);
});

test('Group assets do not create map pins but can expose member locations for Area filtering', () => {
    const group = {
        id: 90,
        assetMode: 'group',
        name: 'West Care Picks',
        groupMemberLocations: [
            { id: 10, postalCode: '650010', lat: '1.35', lng: '103.75' },
        ],
    };

    assert.deepEqual(getAssetLocations(group), []);
    assert.equal(getAssetAreaLocations(group).length, 1);

    const savedPinData = buildSavedPlacePins([
        { resourceType: 'soft', resourceId: 90, name: 'West Care Picks' },
    ], [], [group]);

    assert.equal(savedPinData.pins.length, 0);
    assert.equal(savedPinData.unmappableSavedAssetKeys.has('soft-90'), true);
});
