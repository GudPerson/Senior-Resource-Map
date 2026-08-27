import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.js';
import { dataStore } from '../src/utils/dataStore.js';
import { buildPublicCacheObservation } from '../src/routes/public.js';

test('public cache observation reports bounded age and staleness without reading rows', () => {
    const observation = buildPublicCacheObservation(
        { generatedAt: '2026-08-27T00:00:00.000Z', data: [{ private: 'not inspected' }] },
        new Date('2026-08-27T02:00:00.000Z'),
        3600,
    );
    assert.deepEqual(observation, { ageSeconds: 7200, stale: true });
    assert.deepEqual(buildPublicCacheObservation({ data: [] }), { ageSeconds: null, stale: null });
});

test('public map cache endpoint filters out rows without valid coordinates', async () => {
    const originalGetJSON = dataStore.getJSON;
    dataStore.getJSON = async () => ([
        { id: 1, lat: '1.3000', lng: '103.8000', title: 'Valid asset' },
        { id: 2, lat: null, lng: '103.9000', title: 'Missing lat' },
        { id: 3, lat: '1.3200', lng: 'bad', title: 'Bad lng' },
    ]);

    try {
        const response = await app.fetch(new Request('http://localhost/api/public/map-cache/all'));
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-carearound-cache'), 'legacy');
        assert.equal(response.headers.get('x-carearound-cache-stale'), 'unknown');
        assert.deepEqual(payload, [
            { id: 1, lat: '1.3000', lng: '103.8000', title: 'Valid asset' },
        ]);
    } finally {
        dataStore.getJSON = originalGetJSON;
    }
});

test('public discovery cache endpoint keeps rows without map coordinates', async () => {
    const originalGetJSON = dataStore.getJSON;
    dataStore.getJSON = async () => ({
        version: 2,
        data: [
            { id: 1, lat: '1.3000', lng: '103.8000', title: 'Mapped asset' },
            { id: 2, lat: null, lng: null, title: 'Standalone service' },
        ],
    });

    try {
        const response = await app.fetch(new Request('http://localhost/api/public/discovery-cache/all'));
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(payload, [
            { id: 1, lat: '1.3000', lng: '103.8000', title: 'Mapped asset' },
            { id: 2, lat: null, lng: null, title: 'Standalone service' },
        ]);
    } finally {
        dataStore.getJSON = originalGetJSON;
    }
});

test('public cache endpoints enforce asset and host hide windows at read time', async () => {
    const originalGetJSON = dataStore.getJSON;
    const now = Date.now();
    dataStore.getJSON = async () => ({
        version: 6,
        data: [
            {
                id: 1,
                lat: '1.3000',
                lng: '103.8000',
                title: 'Visible asset',
                hide_from: new Date(now + 60_000).toISOString(),
                hide_until: new Date(now + 120_000).toISOString(),
                location_hide_from: null,
                location_hide_until: null,
            },
            {
                id: 2,
                lat: '1.3100',
                lng: '103.8100',
                title: 'Hidden offering',
                hide_from: new Date(now - 60_000).toISOString(),
                hide_until: new Date(now + 60_000).toISOString(),
                location_hide_from: null,
                location_hide_until: null,
            },
            {
                id: 3,
                lat: '1.3200',
                lng: '103.8200',
                title: 'Offering at hidden place',
                hide_from: null,
                hide_until: null,
                location_hide_from: new Date(now - 60_000).toISOString(),
                location_hide_until: new Date(now + 60_000).toISOString(),
            },
        ],
    });

    try {
        for (const path of ['/api/public/map-cache/all', '/api/public/discovery-cache/all']) {
            const response = await app.fetch(new Request(`http://localhost${path}`));
            const payload = await response.json();

            assert.equal(response.status, 200);
            assert.equal(response.headers.get('x-carearound-cache'), 'hit');
            assert.deepEqual(payload, [{
                id: 1,
                lat: '1.3000',
                lng: '103.8000',
                title: 'Visible asset',
            }]);
        }
    } finally {
        dataStore.getJSON = originalGetJSON;
    }
});
