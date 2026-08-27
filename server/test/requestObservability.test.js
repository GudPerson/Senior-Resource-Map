import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

import app from '../src/app.js';
import {
    createRequestObservability,
    sanitizeObservedRoute,
} from '../src/middleware/requestObservability.js';

test('observed routes redact ids, tokens, and query values', () => {
    assert.equal(sanitizeObservedRoute('https://api.example/api/users/42?email=private@example.com'), '/api/users/:id');
    assert.equal(sanitizeObservedRoute('/api/shared-maps/0123456789abcdef0123456789abcdef'), '/api/shared-maps/:id');
    assert.equal(sanitizeObservedRoute('/api/health'), '/api/health');
});

test('request observability adds correlation and timing without logging private request data', async () => {
    const events = [];
    const times = [100, 125.4];
    const observed = new Hono();
    observed.use('*', createRequestObservability({
        now: () => times.shift(),
        createRequestId: () => 'request-unit-1',
        random: () => 0,
        log: (event) => events.push(event),
    }));
    observed.get('/private/:token', (c) => c.json({ ok: true }));

    const response = await observed.request('/private/a-secret-share-token-value', {
        headers: { Authorization: 'Bearer private-session' },
    }, { REQUEST_LOG_SAMPLE_RATE: '1' });

    assert.equal(response.headers.get('x-request-id'), 'request-unit-1');
    assert.equal(response.headers.get('server-timing'), 'app;dur=25.4');
    assert.deepEqual(events, [{
        event: 'api_request',
        requestId: 'request-unit-1',
        method: 'GET',
        route: '/private/:token',
        status: 200,
        durationMs: 25.4,
        outcome: 'sampled',
    }]);
    assert.doesNotMatch(JSON.stringify(events), /secret|Bearer|private-session/);
});

test('slow and failed requests are logged even when sampling is disabled', async () => {
    const slowEvents = [];
    const times = [0, 2500];
    const observed = new Hono();
    observed.use('*', createRequestObservability({
        now: () => times.shift(),
        createRequestId: () => 'request-slow-1',
        random: () => 1,
        log: (event) => slowEvents.push(event),
    }));
    observed.get('/slow', (c) => c.json({ ok: true }));
    await observed.request('/slow', {}, { REQUEST_LOG_SAMPLE_RATE: '0', SLOW_REQUEST_MS: '1000' });
    assert.equal(slowEvents[0]?.outcome, 'slow');
});

test('application health exposes safe observability headers to browsers', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/health', { headers: { Origin: 'https://app.carearound.sg' } }),
        { NODE_ENV: 'production', REQUEST_LOG_SAMPLE_RATE: '0' },
    );
    assert.match(response.headers.get('x-request-id') || '', /\S/);
    assert.match(response.headers.get('server-timing') || '', /^app;dur=/);
    assert.match(response.headers.get('access-control-expose-headers') || '', /X-Request-ID/i);
});
