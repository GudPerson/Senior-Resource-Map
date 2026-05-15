import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestHeaders, requestWithBaseCandidates } from '../src/lib/api.js';

test('GET requests do not send JSON content-type when there is no body', () => {
    const requestHeaders = buildRequestHeaders('GET');

    assert.equal(requestHeaders['Content-Type'], undefined);
});

test('GET requests retry another API base after a transient fetch failure', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        if (calls.length === 1) {
            throw new TypeError('Failed to fetch');
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };

    const data = await requestWithBaseCandidates('GET', '/health', undefined, {
        baseCandidates: ['https://primary.example/api', 'https://fallback.example/api'],
        fetchImpl,
        networkAttemptsPerBase: 1,
    });

    assert.deepEqual(data, { ok: true });
    assert.deepEqual(calls, [
        'https://primary.example/api/health',
        'https://fallback.example/api/health',
    ]);
});
