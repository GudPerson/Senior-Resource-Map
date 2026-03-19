import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDerivedMapLocations,
    buildMarkerKey,
    getAssetLocations,
    getBestLocation,
} from '../../client/src/features/discover/discoveryData.js';

test('buildDerivedMapLocations expands multi-host soft assets into one entry per host', () => {
    const hardAssets = [
        { id: 1, name: 'Center A', subCategory: 'Places', lat: '1.3000', lng: '103.8000' },
    ];
    const softAssets = [
        {
            id: 2,
            name: 'Morning Yoga',
            subCategory: 'Programmes',
            locations: [
                { id: 10, lat: '1.3010', lng: '103.8010' },
                { id: 11, lat: '1.3020', lng: '103.8020' },
            ],
        },
    ];

    const locations = buildDerivedMapLocations(hardAssets, softAssets);

    assert.deepEqual(locations, [
        { id: 1, locationId: 1, title: 'Center A', category: 'Places', lat: '1.3000', lng: '103.8000', asset_type: 'hard' },
        { id: 2, locationId: 10, title: 'Morning Yoga', category: 'Programmes', lat: '1.3010', lng: '103.8010', asset_type: 'soft' },
        { id: 2, locationId: 11, title: 'Morning Yoga', category: 'Programmes', lat: '1.3020', lng: '103.8020', asset_type: 'soft' },
    ]);
});

test('getAssetLocations and getBestLocation resolve the nearest soft-asset host', () => {
    const asset = {
        id: 7,
        _type: 'soft',
        locations: [
            { id: 21, lat: '1.3000', lng: '103.8000' },
            { id: 22, lat: '1.3500', lng: '103.9000' },
        ],
    };

    assert.equal(getAssetLocations(asset).length, 2);
    assert.deepEqual(getBestLocation(asset, { lat: 1.3010, lng: 103.8010 }), asset.locations[0]);
});

test('buildMarkerKey stays stable across host-specific markers', () => {
    assert.equal(
        buildMarkerKey({ asset_type: 'soft', id: 5, locationId: 99 }),
        'soft-5-99'
    );
    assert.equal(
        buildMarkerKey({ asset_type: 'hard', id: 3, lat: '1.2345678', lng: '103.8765432' }),
        'hard-3-1.234568-103.876543'
    );
});
