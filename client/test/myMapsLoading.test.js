import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    fetchMyMapWithResilience,
    fetchMyMapsWithResilience,
    getMyMapsListStatus,
} from '../src/lib/myMapsLoading.js';

const myDirectoryPageSource = readFileSync(
    new URL('../src/pages/MyDirectoryPage.jsx', import.meta.url),
    'utf8',
);
const myMapDetailPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);

test('my maps list retries a transient first load failure', async () => {
    let attempts = 0;
    const maps = await fetchMyMapsWithResilience(async () => {
        attempts += 1;
        if (attempts === 1) {
            throw new Error('temporary My Maps load failure');
        }
        return [{ id: 87, name: 'My Partners' }];
    }, {
        maxAttempts: 2,
        waitMs: async () => {},
    });

    assert.equal(attempts, 2);
    assert.deepEqual(maps, [{ id: 87, name: 'My Partners' }]);
});

test('my map detail retries a transient first load failure', async () => {
    let attempts = 0;
    const map = await fetchMyMapWithResilience(async () => {
        attempts += 1;
        if (attempts === 1) {
            throw new Error('temporary My Map detail load failure');
        }
        return { id: 87, name: 'My Partners' };
    }, {
        maxAttempts: 2,
        waitMs: async () => {},
    });

    assert.equal(attempts, 2);
    assert.deepEqual(map, { id: 87, name: 'My Partners' });
});

test('my maps loading does not retry expired sessions or access failures', async () => {
    let attempts = 0;

    await assert.rejects(
        fetchMyMapsWithResilience(async () => {
            attempts += 1;
            throw new Error('Session expired. Please log in again.');
        }, {
            maxAttempts: 3,
            waitMs: async () => {},
        }),
        /Session expired/,
    );

    assert.equal(attempts, 1);
});

test('my maps list status avoids empty state before first load settles', () => {
    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: false,
        mapsError: '',
        mapCount: 0,
    }), 'loading');

    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: false,
        mapsError: 'Failed to load your maps.',
        mapCount: 0,
    }), 'load-error');

    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: true,
        mapsError: '',
        mapCount: 0,
    }), 'empty');

    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: true,
        mapsError: '',
        mapCount: 2,
    }), 'ready');
});

test('my maps pages use resilient loading helpers', () => {
    assert.match(myDirectoryPageSource, /fetchMyMapsWithResilience\(\(\) => api\.getMyMaps\(\)\)/);
    assert.match(myDirectoryPageSource, /getMyMapsListStatus\(/);
    assert.match(myDirectoryPageSource, /MyMapsLoadErrorState/);
    assert.match(myMapDetailPageSource, /fetchMyMapWithResilience\(\(\) => api\.getMyMap\(mapId\)\)/);
});
