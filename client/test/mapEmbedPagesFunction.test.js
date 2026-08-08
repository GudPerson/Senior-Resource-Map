import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    buildEmbeddedMapResponse,
    buildEmbedContentSecurityPolicy,
    normalizeFrameAncestorOrigins,
    onRequest,
} from '../functions/embed/maps/[token].js';

function createContext(overrides = {}) {
    const assetRequests = [];
    return {
        assetRequests,
        context: {
            request: new Request('https://app.carearound.sg/embed/maps/shared-token'),
            params: { token: 'shared-token' },
            env: {
                CAREAROUND_EMBED_API_BASE_URL: 'https://api.example.test/api',
                ASSETS: {
                    fetch: async (request) => {
                        assetRequests.push(String(request));
                        return new Response('<!doctype html><div id="root"></div>', {
                            headers: {
                                'Content-Type': 'text/html',
                                'X-Frame-Options': 'DENY',
                            },
                        });
                    },
                },
            },
            ...overrides,
        },
    };
}

test('normalizeFrameAncestorOrigins fails closed on unsafe configuration', () => {
    assert.deepEqual(normalizeFrameAncestorOrigins([
        'https://WWW.Example.org.sg/',
        'https://www.example.org.sg',
        'http://localhost:4173',
    ]), [
        'https://www.example.org.sg',
        'http://localhost:4173',
    ]);
    assert.deepEqual(normalizeFrameAncestorOrigins(['https://*.example.org.sg']), []);
    assert.deepEqual(normalizeFrameAncestorOrigins(['https://example.org.sg/page']), []);
});

test('buildEmbedContentSecurityPolicy permits only self and approved ancestors', () => {
    const policy = buildEmbedContentSecurityPolicy([
        'https://www.example.org.sg',
        'https://staging.example.org.sg',
    ]);
    assert.match(policy, /frame-ancestors 'self' https:\/\/www\.example\.org\.sg https:\/\/staging\.example\.org\.sg/);
    assert.doesNotMatch(policy, /frame-ancestors \*/);
    assert.match(policy, /form-action 'none'/);
});

test('buildEmbeddedMapResponse serves the SPA with route-specific framing headers', async () => {
    const { context, assetRequests } = createContext();
    const apiRequests = [];
    const response = await buildEmbeddedMapResponse(context, async (url, options) => {
        apiRequests.push({ url: String(url), redirect: options?.redirect });
        return Response.json({
            allowedOrigins: ['https://www.example.org.sg'],
        });
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<!doctype html><div id="root"></div>');
    assert.deepEqual(apiRequests, [
        {
            url: 'https://api.example.test/api/shared-maps/shared-token/embed-config',
            redirect: 'manual',
        },
    ]);
    assert.deepEqual(assetRequests, ['https://app.carearound.sg/index.html']);
    assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'self' https:\/\/www\.example\.org\.sg/);
    assert.equal(response.headers.get('x-frame-options'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=(), payment=()');
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains; preload');
});

test('buildEmbeddedMapResponse fails closed without serving the app when config is unavailable', async () => {
    const { context, assetRequests } = createContext();
    const response = await buildEmbeddedMapResponse(context, async () => (
        Response.json({ error: 'unavailable' }, { status: 503 })
    ));

    assert.equal(response.status, 503);
    assert.deepEqual(assetRequests, []);
    assert.match(await response.text(), /embedded map is unavailable/i);
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'none'/);
    assert.equal(response.headers.get('x-frame-options'), null);
});

test('onRequest rejects non-read methods and preserves HEAD headers without a body', async () => {
    const { context } = createContext({
        request: new Request('https://app.carearound.sg/embed/maps/shared-token', { method: 'POST' }),
    });
    const methodResponse = await onRequest(context);
    assert.equal(methodResponse.status, 405);

    const { context: headContext } = createContext({
        request: new Request('https://app.carearound.sg/embed/maps/shared-token', { method: 'HEAD' }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({
        allowedOrigins: ['https://www.example.org.sg'],
    });
    try {
        const headResponse = await onRequest(headContext);
        assert.equal(headResponse.status, 200);
        assert.equal(await headResponse.text(), '');
        assert.match(headResponse.headers.get('content-security-policy') || '', /www\.example\.org\.sg/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Pages Functions routing is limited to embedded map documents', () => {
    const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
    assert.deepEqual(routes, {
        version: 1,
        include: ['/embed/maps/*'],
        exclude: [],
    });
});
