import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildRequestHeaders,
    requestFormDataWithBaseCandidates,
    requestWithBaseCandidates,
} from '../src/lib/api.js';

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

test('authenticated form uploads do not fall through to fallback bases after an API HTML response', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        return new Response('<html>Temporary edge response</html>', {
            status: 500,
            headers: { 'content-type': 'text/html' },
        });
    };

    await assert.rejects(
        () => requestFormDataWithBaseCandidates(
            '/soft-assets/import/collateral/preview',
            new FormData(),
            {
                baseCandidates: ['https://api.example/api', 'https://fallback.example/api'],
                fetchImpl,
            },
        ),
        /Upload API returned an unexpected response/,
    );

    assert.deepEqual(calls, ['https://api.example/api/soft-assets/import/collateral/preview']);
});

test('form upload network failures use a user-safe error message', async () => {
    await assert.rejects(
        () => requestFormDataWithBaseCandidates(
            '/soft-assets/import/collateral/preview',
            new FormData(),
            {
                baseCandidates: ['https://api.example/api'],
                fetchImpl: async () => {
                    throw new TypeError('Failed to fetch');
                },
            },
        ),
        /Upload request could not reach the API/,
    );
});
