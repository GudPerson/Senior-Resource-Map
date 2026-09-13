import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildEmbeddedMapResponse,
    onRequest,
} from '../functions/embed/governed-maps/[token].js';

function createContext({
    request = new Request('https://app.carearound.sg/embed/governed-maps/governed-token'),
    apiBaseUrl = 'https://api.carearound.sg/api',
} = {}) {
    const assetRequests = [];
    return {
        assetRequests,
        context: {
            request,
            params: { token: 'governed-token' },
            env: {
                VITE_API_URL: apiBaseUrl,
                ASSETS: {
                    fetch: async (url) => {
                        assetRequests.push(String(url));
                        return new Response('<!doctype html><div id="root"></div>', {
                            status: 200,
                            headers: { 'Content-Type': 'text/html' },
                        });
                    },
                },
            },
        },
    };
}

test('governed embed serves the SPA only after loading the governed allowlist', async () => {
    const { context, assetRequests } = createContext();
    const calls = [];
    const response = await buildEmbeddedMapResponse(context, async (url, options) => {
        calls.push({ url, options });
        return Response.json({ allowedOrigins: ['https://partner.example.org'] });
    });

    assert.equal(response.status, 200);
    assert.equal(calls[0].url, 'https://api.carearound.sg/api/governed-maps/public/governed-token/embed-config');
    assert.match(response.headers.get('content-security-policy') || '', /partner\.example\.org/);
    assert.deepEqual(assetRequests, ['https://app.carearound.sg/index.html']);
});

test('governed embed fails closed when publication configuration is unavailable', async () => {
    const { context, assetRequests } = createContext();
    const response = await buildEmbeddedMapResponse(context, async () => (
        Response.json({ error: 'unavailable' }, { status: 404 })
    ));

    assert.equal(response.status, 404);
    assert.deepEqual(assetRequests, []);
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'none'/);
});

test('governed embed route rejects non-read methods', async () => {
    const { context } = createContext({
        request: new Request('https://app.carearound.sg/embed/governed-maps/governed-token', { method: 'POST' }),
    });
    const response = await onRequest(context);
    assert.equal(response.status, 405);
});
