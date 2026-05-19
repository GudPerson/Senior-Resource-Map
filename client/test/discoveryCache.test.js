import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDiscoveryCacheRows } from '../src/lib/discoveryCache.js';

test('normalizeDiscoveryCacheRows groups public cache rows into Discovery hard and soft assets', () => {
    const rows = [
        {
            id: 10,
            title: 'Community Hub',
            category: 'Active Ageing Centres',
            description: 'Neighbourhood support',
            lat: '1.3000',
            lng: '103.8000',
            asset_type: 'hard',
            address: 'Blk 10 Test Road Singapore 123456',
            postal_code: '123456',
            logo_url: 'https://example.com/hub.png',
        },
        {
            id: 20,
            title: 'Chair Yoga',
            category: 'Programmes',
            description: 'Gentle movement',
            lat: '1.3000',
            lng: '103.8000',
            asset_type: 'soft',
            schedule: 'Mondays 10am',
            availability_enabled: true,
            availability_count: 8,
            availability_unit: 'slots',
            location_hard_asset_id: 10,
            location_name: 'Community Hub',
            location_address: 'Blk 10 Test Road Singapore 123456',
            location_postal_code: '123456',
        },
        {
            id: 20,
            title: 'Chair Yoga',
            category: 'Programmes',
            description: 'Gentle movement',
            lat: '1.3100',
            lng: '103.8100',
            asset_type: 'soft',
            location_hard_asset_id: 11,
            location_name: 'Second Site',
            location_address: 'Blk 11 Test Road Singapore 123457',
            location_postal_code: '123457',
        },
    ];

    const normalized = normalizeDiscoveryCacheRows(rows);

    assert.equal(normalized.hardAssets.length, 1);
    assert.equal(normalized.softAssets.length, 1);
    assert.equal(normalized.hardAssets[0].name, 'Community Hub');
    assert.equal(normalized.hardAssets[0].subCategory, 'Active Ageing Centres');
    assert.equal(normalized.hardAssets[0].postalCode, '123456');
    assert.equal(normalized.hardAssets[0].softAssets.length, 1);
    assert.equal(normalized.hardAssets[0].softAssets[0].name, 'Chair Yoga');
    assert.equal(normalized.softAssets[0].locations.length, 2);
    assert.equal(normalized.softAssets[0].location.name, 'Community Hub');
    assert.equal(normalized.softAssets[0].availabilityEnabled, true);
    assert.equal(normalized.softAssets[0].availabilityCount, 8);
});

test('normalizeDiscoveryCacheRows tolerates legacy minimal map-cache rows', () => {
    const normalized = normalizeDiscoveryCacheRows([
        { id: 1, title: 'Legacy Place', category: 'Place', lat: '1.3', lng: '103.8', asset_type: 'hard' },
        { id: 2, title: 'Legacy Programme', category: 'Programme', lat: '1.31', lng: '103.81', asset_type: 'soft' },
    ]);

    assert.equal(normalized.hardAssets[0].name, 'Legacy Place');
    assert.equal(normalized.softAssets[0].name, 'Legacy Programme');
    assert.equal(normalized.softAssets[0].locations[0].lat, '1.31');
});

test('normalizeDiscoveryCacheRows keeps standalone soft assets without map coordinates', () => {
    const normalized = normalizeDiscoveryCacheRows([
        {
            id: 30,
            title: 'Home nursing',
            category: 'Home care',
            description: 'Service delivered at home',
            lat: null,
            lng: null,
            asset_type: 'soft',
            schedule: 'By appointment',
        },
    ]);

    assert.equal(normalized.hardAssets.length, 0);
    assert.equal(normalized.softAssets.length, 1);
    assert.equal(normalized.softAssets[0].name, 'Home nursing');
    assert.equal(normalized.softAssets[0].locations.length, 0);
    assert.equal(normalized.softAssets[0].location, null);
});
