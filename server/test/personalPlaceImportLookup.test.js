import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { PgDialect } from 'drizzle-orm/pg-core';
import { resolvePersonalPlaceImportLocation } from '../src/utils/personalPlaceImportLookup.js';
import { createMyMapPersonalPlaceImportLookupHandler } from '../src/controllers/personalPlaceImportLookupController.js';
import { importMyMapPersonalPlaces } from '../src/controllers/personalPlaceImportController.js';

const match = (postal = '680503', changes = {}) => Response.json({ results: [{
    POSTAL: postal, ADDRESS: `FICTIONAL EXACT ADDRESS ${postal}`, LATITUDE: '1.3', LONGITUDE: '103.8', ...changes,
}] });
const noWait = async () => {};

test('backend recovers rate limits and service failures without exposing intermediate errors', async () => {
    let calls = 0;
    const waits = [];
    const result = await resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async (url) => {
            assert.equal(new URL(url).searchParams.get('searchVal'), '680503');
            calls += 1;
            return calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '2' } })
                : calls === 2 ? new Response('', { status: 503 }) : match();
        }, wait: async (ms) => waits.push(ms),
    });
    assert.equal(result.postalCode, '680503');
    assert.equal(calls, 3);
    assert.deepEqual(waits, [2000, 2000]);
});

test('transient empty result retries and exact matching searches every returned result', async () => {
    let calls = 0;
    const result = await resolvePersonalPlaceImportLocation('070001', {
        fetchImpl: async () => {
            calls += 1;
            return calls === 1 ? Response.json({ results: [] }) : Response.json({ results: [
                { POSTAL: '070002', ADDRESS: 'WRONG ADDRESS', LATITUDE: '1', LONGITUDE: '103' },
                { POSTAL: '070001', ADDRESS: 'FICTIONAL CORRECT ADDRESS', LATITUDE: '1.3', LONGITUDE: '103.8' },
            ] });
        }, wait: noWait,
    });
    assert.equal(calls, 2);
    assert.equal(result.postalCode, '070001');
    assert.equal(result.address, 'FICTIONAL CORRECT ADDRESS');
});

test('confirmed missing postal code is distinct from exhausted service errors', async () => {
    for (const missing of [true, false]) {
        let calls = 0;
        await assert.rejects(() => resolvePersonalPlaceImportLocation('680503', {
            fetchImpl: async () => { calls += 1; return missing ? Response.json({ results: [] }) : new Response('', { status: 503 }); },
            wait: noWait,
        }), error => {
            assert.equal(error.status, missing ? 400 : 503);
            assert.equal(error.code, missing ? 'postal_not_found' : 'postal_lookup_unavailable');
            assert.match(error.message, missing ? /Check the postal code/ : /service is temporarily unavailable/);
            assert.doesNotMatch(error.message, /correct the file/);
            return true;
        });
        assert.equal(calls, 3);
    }
});

test('one empty response after failed requests does not falsely blame the postal code', async () => {
    let calls = 0;
    await assert.rejects(() => resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async () => { calls += 1; return calls < 3 ? new Response('', { status: 503 }) : Response.json({ results: [] }); },
        wait: noWait,
    }), { status: 503, code: 'postal_lookup_unavailable' });
    assert.equal(calls, 3);
});

test('network failure and incomplete coordinates can recover; invalid data is never returned as a pin', async () => {
    let calls = 0;
    const result = await resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async () => {
            calls += 1;
            if (calls === 1) throw Object.assign(new TypeError('Temporary upstream transport failure'), { code: 'ECONNRESET' });
            return calls === 2 ? match('680503', { LATITUDE: 'not a coordinate' }) : match();
        }, wait: noWait,
    });
    assert.equal(calls, 3);
    assert.equal(result.lat, 1.3);
    await assert.rejects(() => resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async () => match('680503', { LATITUDE: '95' }), wait: noWait,
    }), { status: 503, code: 'postal_lookup_unavailable' });
});

test('a provider warning does not reject an otherwise exact complete successful response', async () => {
    const result = await resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async () => Response.json({
            error: 'Authentication token missing. Please create an account and generate or renew your API Token.',
            found: 1, results: [{ POSTAL: '680503', ADDRESS: 'FICTIONAL EXACT ADDRESS', LATITUDE: '1.3', LONGITUDE: '103.8' }],
        }), wait: noWait,
    });
    assert.equal(result.postalCode, '680503');
    assert.equal(result.address, 'FICTIONAL EXACT ADDRESS');
});

test('provider errors and malformed successful payloads never claim the postal code is invalid', async () => {
    for (const payload of [{}, { error: 'Temporary provider failure', results: [] }]) {
        let calls = 0;
        await assert.rejects(() => resolvePersonalPlaceImportLocation('680503', {
            fetchImpl: async () => { calls += 1; return Response.json(payload); }, wait: noWait,
        }), { status: 503, code: 'postal_lookup_unavailable' });
        assert.equal(calls, 3);
    }
});

test('save-stage verification retries and paces unique postals before exactly one atomic write', async () => {
    const events = [];
    let calls = 0;
    const db = {
        query: { myMaps: { findFirst: async () => ({ id: 7 }) } },
        select: () => ({ from: () => 'fictional owner lock' }),
        execute: () => 'fictional prepared query',
        batch: async () => {
            events.push('write');
            return [[], { rows: [{ result: { mapFound: true, rowErrors: [], results: [{ index: 0, placeId: 1, status: 'created' }] } }] }];
        },
    };
    const body = { rows: ['680503', '680504', '680503'].map((postalCode, index) => ({
        name: `Fictional ${index}`, postalCode, address: `FICTIONAL ADDRESS ${postalCode}`,
    })) };
    await importMyMapPersonalPlaces(db, { id: 1, role: 'standard' }, 7, body, {
        locationLookupOptions: {
            fetchImpl: async (url) => {
                const postal = new URL(url).searchParams.get('searchVal');
                calls += 1; events.push(`lookup:${postal}`);
                return calls === 1 ? new Response('', { status: 503 }) : match(postal);
            }, wait: async (ms) => events.push(`wait:${ms}`),
        },
    });
    assert.deepEqual(events, ['lookup:680503', 'wait:1000', 'lookup:680503', 'wait:600', 'lookup:680504', 'write']);
    events.length = 0;
    await assert.rejects(() => importMyMapPersonalPlaces(db, { id: 1, role: 'standard' }, 7, body, {
        locationLookupOptions: { fetchImpl: async () => new Response('', { status: 503 }), wait: noWait },
    }), { status: 503 });
    assert.deepEqual(events, [], 'exhausted verification must not begin a write');
});

test('malformed postal input and permanent upstream denial are not retried', async () => {
    let calls = 0;
    await assert.rejects(() => resolvePersonalPlaceImportLocation('68050', {
        fetchImpl: async () => { calls += 1; return match(); },
    }), { status: 400, code: 'invalid_postal_code' });
    assert.equal(calls, 0);
    await assert.rejects(() => resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async () => { calls += 1; return new Response('', { status: 403 }); }, wait: noWait,
    }), { status: 503, code: 'postal_lookup_unavailable' });
    assert.equal(calls, 1);
});

test('upstream timeout can retry and caller cancellation stops all later attempts', async () => {
    let calls = 0;
    const result = await resolvePersonalPlaceImportLocation('680503', {
        fetchImpl: async (url, { signal }) => {
            calls += 1;
            if (calls === 1) return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('Timeout'), { name: 'AbortError' })), { once: true }));
            return match();
        }, wait: noWait, timeoutMs: 5,
    });
    assert.equal(calls, 2); assert.equal(result.postalCode, '680503');
    const controller = new AbortController();
    calls = 0;
    await assert.rejects(() => resolvePersonalPlaceImportLocation('680503', {
        signal: controller.signal, fetchImpl: async () => { calls += 1; throw new TypeError('Temporary failure'); },
        wait: async () => controller.abort(),
    }), { name: 'AbortError' });
    assert.equal(calls, 1);
});

function fixture({ user = { id: 1, role: 'standard' }, owned = true, lookup } = {}) {
    const app = new Hono();
    const state = { databaseReads: 0, lookups: 0 };
    app.use('*', async (c, next) => { c.set('user', user); await next(); });
    app.get('/:id/personal-places/lookup', createMyMapPersonalPlaceImportLookupHandler({
        dbForContext: () => ({ query: { myMaps: { findFirst: async ({ where }) => {
            state.databaseReads += 1;
            const predicate = new PgDialect().sqlToQuery(where);
            assert.deepEqual(predicate.params, [7, 1]);
            return owned ? { id: 7 } : null;
        } } }, batch: () => { throw new Error('Preview must not write'); }, execute: () => { throw new Error('Preview must not write'); } }),
        resolveLocation: async (...args) => { state.lookups += 1; return lookup ? lookup(...args) : { postalCode: '680503', address: 'FICTIONAL ADDRESS', lat: 1.3, lng: 103.8 }; },
    }));
    return { app, state };
}

test('private lookup verifies map ownership, returns no-store data, and does not write', async () => {
    const { app, state } = fixture();
    const response = await app.request('/7/personal-places/lookup?postalCode=680503');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).location.postalCode, '680503');
    assert.deepEqual(state, { databaseReads: 1, lookups: 1 });
});

test('guest, non-owner, invalid map and invalid postal requests cannot reach the location service', async () => {
    for (const [options, path, status] of [
        [{ user: { id: 1, role: 'guest' } }, '/7/personal-places/lookup?postalCode=680503', 403],
        [{ owned: false }, '/7/personal-places/lookup?postalCode=680503', 404],
        [{}, '/-7/personal-places/lookup?postalCode=680503', 400],
        [{}, '/7/personal-places/lookup?postalCode=68050', 400],
    ]) {
        const { app, state } = fixture(options);
        const response = await app.request(path);
        assert.equal(response.status, status);
        assert.equal(state.lookups, 0);
    }
});

test('API service failure is clearly distinguished from an invalid postal code', async () => {
    const { app } = fixture({ lookup: async () => { throw new TypeError('Private upstream details'); } });
    const response = await app.request('/7/personal-places/lookup?postalCode=680503');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'postal_lookup_unavailable');
    assert.match(body.error, /service is temporarily unavailable/);
    assert.doesNotMatch(body.error, /Private upstream|correct the file/);
});
