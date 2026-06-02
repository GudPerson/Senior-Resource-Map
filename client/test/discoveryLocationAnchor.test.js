import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getAssetLocations,
    getBestLocation,
} from '../src/features/discover/discoveryData.js';

function makeMultiHostSoftAsset() {
    return {
        id: 166,
        _type: 'soft',
        name: 'Multi-host service',
        locations: [
            {
                id: 9,
                name: 'Default host',
                address: '107 Commonwealth Crescent',
                lat: '1.3046',
                lng: '103.7982',
            },
            {
                id: 4,
                name: 'Nearest host',
                address: 'Blk 809A Choa Chu Kang Ave 1',
                lat: '1.3791',
                lng: '103.7449',
            },
            {
                id: 2,
                name: 'Middle host',
                address: '488B Choa Chu Kang Ave 5',
                lat: '1.3742',
                lng: '103.7395',
            },
        ],
    };
}

test('Discover soft assets with multiple hosts anchor to the nearest host when a location context exists', () => {
    const asset = makeMultiHostSoftAsset();
    const choaChuKangSearchContext = { lat: 1.3798, lng: 103.7444 };

    const bestLocation = getBestLocation(asset, choaChuKangSearchContext);

    assert.equal(bestLocation.id, 4);
    assert.equal(bestLocation.name, 'Nearest host');
    assert.equal(bestLocation.address, 'Blk 809A Choa Chu Kang Ave 1');
});

test('Discover soft assets keep the first linked host when no location context exists', () => {
    const asset = makeMultiHostSoftAsset();

    const bestLocation = getBestLocation(asset);

    assert.equal(bestLocation.id, 9);
    assert.equal(bestLocation.name, 'Default host');
    assert.deepEqual(getAssetLocations(asset).map((location) => location.id), [9, 4, 2]);
});
