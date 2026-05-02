import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

import app from '../src/app.js';
import { createRateLimiter } from '../src/middleware/security.js';

test('security headers are set on API responses', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/health', { headers: { Origin: 'https://app.carearound.sg' } }),
        { NODE_ENV: 'production' },
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(response.headers.get('strict-transport-security') || '', /max-age=31536000/);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
});

test('CORS allows CareAround Pages previews but rejects unrelated Pages origins', async () => {
    const previewResponse = await app.fetch(
        new Request('https://senior-resource-map-api.joshuachua79.workers.dev/api/health', {
            headers: { Origin: 'https://db93dedb.senior-resource-map.pages.dev' },
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get('access-control-allow-origin'), 'https://db93dedb.senior-resource-map.pages.dev');

    const unrelatedResponse = await app.fetch(
        new Request('https://senior-resource-map-api.joshuachua79.workers.dev/api/health', {
            headers: { Origin: 'https://unrelated-project.pages.dev' },
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(unrelatedResponse.status, 200);
    assert.equal(unrelatedResponse.headers.get('access-control-allow-origin'), null);
});

test('CORS honours explicitly configured runtime origins', async () => {
    const response = await app.fetch(
        new Request('https://senior-resource-map-api.joshuachua79.workers.dev/api/health', {
            headers: { Origin: 'https://staging.carearound.sg' },
        }),
        {
            NODE_ENV: 'production',
            ALLOWED_ORIGINS: 'https://staging.carearound.sg',
        },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://staging.carearound.sg');
});

test('rate limiter blocks repeated requests without relying on a database', async () => {
    const previousStore = globalThis.__carearoundRateLimitBuckets;
    globalThis.__carearoundRateLimitBuckets = new Map();

    try {
        const limited = new Hono();
        limited.use('*', createRateLimiter({
            name: 'unit-test',
            limit: 2,
            windowMs: 60_000,
            keyFn: () => 'same-client',
        }));
        limited.get('/ok', (c) => c.json({ ok: true }));

        assert.equal((await limited.request('/ok')).status, 200);
        assert.equal((await limited.request('/ok')).status, 200);
        const blocked = await limited.request('/ok');
        assert.equal(blocked.status, 429);
        assert.equal((await blocked.json()).error, 'Too many requests. Please wait a moment and try again.');
    } finally {
        globalThis.__carearoundRateLimitBuckets = previousStore;
    }
});
