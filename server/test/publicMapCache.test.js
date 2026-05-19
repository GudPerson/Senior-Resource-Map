import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.js';
import { dataStore } from '../src/utils/dataStore.js';

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
