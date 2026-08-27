import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

import app from '../src/app.js';
import {
    authRateLimit,
    cookieSessionCsrfGuard,
    createRateLimiter,
} from '../src/middleware/security.js';

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

test('cookie-authenticated unsafe requests require a trusted CareAround origin', async () => {
    const guarded = new Hono();
    guarded.use('*', cookieSessionCsrfGuard);
    guarded.post('/mutate', (c) => c.json({ updated: true }));

    const trusted = await guarded.request('/mutate', {
        method: 'POST',
        headers: {
            Cookie: 'sc_token=signed-session',
            Origin: 'https://app.carearound.sg',
        },
    }, { NODE_ENV: 'production' });
    assert.equal(trusted.status, 200);

    const untrusted = await guarded.request('/mutate', {
        method: 'POST',
        headers: {
            Cookie: 'sc_token=signed-session',
            Origin: 'https://attacker.example',
        },
    }, { NODE_ENV: 'production' });
    assert.equal(untrusted.status, 403);
    assert.match((await untrusted.json()).error, /could not be verified/i);

    const missingOrigin = await guarded.request('/mutate', {
        method: 'POST',
        headers: { Cookie: 'sc_token=signed-session' },
    }, { NODE_ENV: 'production' });
    assert.equal(missingOrigin.status, 403);
});

test('CSRF guard preserves public mutations, read-only cookie requests, and header-token clients', async () => {
    const guarded = new Hono();
    guarded.use('*', cookieSessionCsrfGuard);
    guarded.get('/read', (c) => c.json({ ok: true }));
    guarded.post('/mutate', (c) => c.json({ updated: true }));

    assert.equal((await guarded.request('/mutate', { method: 'POST' })).status, 200);
    assert.equal((await guarded.request('/read', {
        headers: { Cookie: 'sc_token=signed-session' },
    })).status, 200);
    assert.equal((await guarded.request('/mutate', {
        method: 'POST',
        headers: {
            Cookie: 'sc_token=signed-session',
            'X-Session-Token': 'explicit-session',
        },
    })).status, 200);
});

test('CSRF guard accepts configured and CareAround preview origins', async () => {
    const guarded = new Hono();
    guarded.use('*', cookieSessionCsrfGuard);
    guarded.post('/mutate', (c) => c.json({ updated: true }));
    const env = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://staging.carearound.sg',
    };

    for (const origin of [
        'https://staging.carearound.sg',
        'https://db93dedb.senior-resource-map.pages.dev',
    ]) {
        const response = await guarded.request('/mutate', {
            method: 'POST',
            headers: {
                Cookie: 'sc_token=signed-session',
                Origin: origin,
            },
        }, env);
        assert.equal(response.status, 200);
    }
});

test('request body guard rejects oversized JSON before route handlers', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': String((2 * 1024 * 1024) + 1),
                Origin: 'https://app.carearound.sg',
            },
            body: JSON.stringify({ email: 'test@example.com', password: 'pw' }),
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /Request body is too large/);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
});

test('request body guard returns a clean malformed JSON error', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': '9',
                Origin: 'https://app.carearound.sg',
            },
            body: '{"email":',
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Request body must be valid JSON.');
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
});

test('request body guard allows bodyless JSON-labelled requests for existing routes', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': '0',
                Origin: 'https://app.carearound.sg',
            },
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
});

test('request body guard allows larger multipart upload routes', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=unit',
                'Content-Length': String(10 * 1024 * 1024),
                Origin: 'https://app.carearound.sg',
            },
            body: '--unit--',
        }),
        { NODE_ENV: 'production' },
    );

    assert.notEqual(response.status, 413);
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

test('rate limiter ignores unverified session-token headers when grouping unauthenticated requests', async () => {
    const previousStore = globalThis.__carearoundRateLimitBuckets;
    globalThis.__carearoundRateLimitBuckets = new Map();

    try {
        const limited = new Hono();
        limited.use('*', createRateLimiter({
            name: 'unit-test-unverified-session',
            limit: 2,
            windowMs: 60_000,
        }));
        limited.post('/api/auth/login', (c) => c.json({ ok: true }));

        assert.equal((await limited.request('/api/auth/login', {
            method: 'POST',
            headers: {
                'CF-Connecting-IP': '203.0.113.10',
                'X-Session-Token': 'random-token-one',
            },
        })).status, 200);
        assert.equal((await limited.request('/api/auth/login', {
            method: 'POST',
            headers: {
                'CF-Connecting-IP': '203.0.113.10',
                'X-Session-Token': 'random-token-two',
            },
        })).status, 200);
        assert.equal((await limited.request('/api/auth/login', {
            method: 'POST',
            headers: {
                'CF-Connecting-IP': '203.0.113.10',
                'X-Session-Token': 'random-token-three',
            },
        })).status, 429);
    } finally {
        globalThis.__carearoundRateLimitBuckets = previousStore;
    }
});

test('auth rate limiter does not spend login budget on phone status polling', async () => {
    const previousStore = globalThis.__carearoundRateLimitBuckets;
    globalThis.__carearoundRateLimitBuckets = new Map();

    try {
        const limited = new Hono();
        limited.use('*', authRateLimit);
        limited.get('/api/auth/phone/attempt-1', (c) => c.json({ status: 'pending' }));
        limited.post('/api/auth/login', (c) => c.json({ ok: true }));

        for (let index = 0; index < 25; index += 1) {
            const pollResponse = await limited.request('/api/auth/phone/attempt-1', {
                headers: { 'CF-Connecting-IP': '203.0.113.10' },
            });
            assert.equal(pollResponse.status, 200);
        }

        const loginResponse = await limited.request('/api/auth/login', {
            method: 'POST',
            headers: { 'CF-Connecting-IP': '203.0.113.10' },
        });
        assert.equal(loginResponse.status, 200);
    } finally {
        globalThis.__carearoundRateLimitBuckets = previousStore;
    }
});
