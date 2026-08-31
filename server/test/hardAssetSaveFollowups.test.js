import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHardAssetPostSaveStatus,
    formatHardAssetSaveError,
    geocodePostalCode,
    hardAssetTranslationFieldsChanged,
    runHardAssetPostSaveTask,
    scheduleHardAssetPostSaveTask,
} from '../src/controllers/hardAssetsController.js';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

test('Singapore postal geocoding uses the exact OneMap result without calling Nominatim', async () => {
    const requestedUrls = [];
    const result = await geocodePostalCode('601309', 'SG', async (url) => {
        requestedUrls.push(String(url));
        return jsonResponse({
            results: [{
                POSTAL: '601309',
                ADDRESS: '309A JURONG EAST STREET 32 SINGAPORE 601309',
                LATITUDE: '1.347290585868534',
                LONGITUDE: '103.7339164391061',
            }],
        });
    });

    assert.deepEqual(result, {
        lat: 1.347290585868534,
        lng: 103.7339164391061,
    });
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /^https:\/\/www\.onemap\.gov\.sg\//);
    assert.doesNotMatch(requestedUrls[0], /nominatim/i);
});

test('Singapore postal geocoding fails closed when OneMap has no exact match', async () => {
    const requestedUrls = [];
    const result = await geocodePostalCode('601309', 'Singapore', async (url) => {
        requestedUrls.push(String(url));
        return jsonResponse({
            results: [{
                POSTAL: '601308',
                LATITUDE: '1.347',
                LONGITUDE: '103.733',
            }],
        });
    });

    assert.equal(result, null);
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /^https:\/\/www\.onemap\.gov\.sg\//);
});

test('non-Singapore postal geocoding retains the existing Nominatim fallback', async () => {
    const requestedUrls = [];
    const result = await geocodePostalCode('2000', 'AU', async (url) => {
        requestedUrls.push(String(url));
        return requestedUrls.length === 1
            ? jsonResponse([])
            : jsonResponse([{ lat: '-33.8688', lon: '151.2093' }]);
    });

    assert.deepEqual(result, { lat: -33.8688, lng: 151.2093 });
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls.every((url) => url.startsWith('https://nominatim.openstreetmap.org/')));
});

test('formatHardAssetSaveError hides Worker subrequest implementation details', () => {
    const message = formatHardAssetSaveError(new Error(
        'Too many subrequests by single Worker invocation. To configure this limit, refer to https://developers.cloudflare.com/workers/wrangler/configuration/#limits',
    ));

    assert.equal(message, 'We could not finish saving this asset right now. Please try again in a moment.');
    assert.doesNotMatch(message, /subrequests/i);
    assert.doesNotMatch(message, /cloudflare/i);
});

test('runHardAssetPostSaveTask converts background failures into partial status', async () => {
    const originalError = console.error;
    console.error = () => undefined;
    let issue;
    try {
        issue = await runHardAssetPostSaveTask('mapCache', async () => {
            throw new Error('Too many subrequests by single Worker invocation.');
        });
    } finally {
        console.error = originalError;
    }

    assert.equal(issue.ok, false);
    assert.equal(issue.taskName, 'mapCache');

    const status = buildHardAssetPostSaveStatus([issue]);
    assert.deepEqual(status, {
        status: 'partial',
        issues: ['mapCache'],
        message: 'Your main changes were saved, but some background updates may take a moment to refresh.',
    });
});

test('hard asset translation follow-up runs only for English text changes', () => {
    const existing = {
        name: 'Senior Corner',
        subCategory: 'Active Ageing Centre',
        address: 'Blk 1',
        hours: 'Mon-Fri',
        description: 'Exercises and talks.',
        logoUrl: 'https://example.test/old.png',
    };

    assert.equal(hardAssetTranslationFieldsChanged(existing, {
        ...existing,
        logoUrl: 'https://example.test/new.png',
    }), false);

    assert.equal(hardAssetTranslationFieldsChanged(existing, {
        logoUrl: 'https://example.test/new.png',
    }), false);

    assert.equal(hardAssetTranslationFieldsChanged(existing, {
        ...existing,
        description: 'Exercises, talks, and karaoke.',
    }), true);
});

test('scheduleHardAssetPostSaveTask queues follow-ups through waitUntil', async () => {
    let queuedPromise = null;
    const status = scheduleHardAssetPostSaveTask({
        executionCtx: {
            waitUntil(promise) {
                queuedPromise = promise;
            },
        },
    }, 'mapCache', async () => 'done');

    assert.equal(status.status, 'queued');
    assert.equal(status.taskName, 'mapCache');
    assert.ok(queuedPromise);
    assert.deepEqual(await queuedPromise, { ok: true, result: 'done' });
});
