import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchEmbeddedMap } from '../src/lib/embedMapApi.js';

test('fetchEmbeddedMap uses a credential-free guest request', async () => {
    const calls = [];
    const payload = await fetchEmbeddedMap('shared token', {
        baseCandidates: ['https://api.example.test/api'],
        fetchImpl: async (url, init) => {
            calls.push({ url, init });
            return Response.json({ id: 3, name: 'Neighbourhood support' });
        },
    });

    assert.equal(payload.id, 3);
    assert.equal(calls[0].url, 'https://api.example.test/api/shared-maps/shared%20token/embed');
    assert.equal(calls[0].init.credentials, 'omit');
    assert.deepEqual(calls[0].init.headers, { Accept: 'application/json' });
});

test('fetchEmbeddedMap reports the public unavailable response without auth handling', async () => {
    await assert.rejects(
        () => fetchEmbeddedMap('missing', {
            baseCandidates: ['https://api.example.test/api'],
            fetchImpl: async () => Response.json(
                { error: 'This embedded map is no longer available' },
                { status: 404 },
            ),
        }),
        (error) => error.status === 404 && /no longer available/.test(error.message),
    );
});

test('fetchEmbeddedMap uses the governed publication endpoint for governed embeds', async () => {
    const calls = [];
    await fetchEmbeddedMap('governed token', {
        mapKind: 'governed',
        baseCandidates: ['https://api.example.test/api'],
        fetchImpl: async (url) => {
            calls.push(url);
            return Response.json({ governedMap: true });
        },
    });

    assert.equal(
        calls[0],
        'https://api.example.test/api/governed-maps/public/governed%20token/embed',
    );
});
