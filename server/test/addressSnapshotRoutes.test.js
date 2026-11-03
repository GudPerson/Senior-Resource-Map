import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDRESS_SNAPSHOT_MAX_BODY_BYTES } from '../src/controllers/addressSnapshotController.js';
import { ADDRESS_SNAPSHOT_CONFIG } from '../src/utils/addressSnapshotConfig.js';
import { routeFixture, validAreaQuery, validNearbyQuery, assertPrivateHeaders } from './helpers/addressSnapshotRouteFixtures.js';

const root = '/api/address-snapshot';
const actor = { id: 91103, role: 'standard' };

function trackedBody(bytes, { chunk = 32768 } = {}) {
    let offset = 0; const tracking = { cancelled: false };
    const stream = new ReadableStream({
        pull(controller) { if (offset === bytes.length) { controller.close(); return; } const next = bytes.slice(offset, offset + chunk); offset += next.length; controller.enqueue(next); },
        cancel() { tracking.cancelled = true; },
    }, { highWaterMark: 0 });
    return { stream, tracking };
}

test('actual app denies anonymous, invalid, revoked and guest sessions before body parsing or R2 reads', async () => {
    const fixture = routeFixture({ fullApp: true });
    const invalid = await fixture.request(`${root}/metadata`, { token: 'not-a-real-session' });
    assert.equal(invalid.status, 403); assertPrivateHeaders(assert, invalid);
    const revokedToken = await fixture.tokenFor(actor); fixture.liveUsers.delete(actor.id);
    assert.equal((await fixture.request(`${root}/metadata`, { token: revokedToken })).status, 403);
    for (const options of [{}, { actor: { ...actor, role: 'guest' } }]) {
        let clones = 0;
        const result = await fixture.request(`${root}/area`, { ...options, rawBody: '{', headers: { 'Content-Length': '1' }, cloneSpy: () => clones++ });
        assert.equal(result.status, options.actor ? 403 : 401); assert.equal(clones, 0); assertPrivateHeaders(assert, result);
    }
    assert.equal(fixture.bucket.calls.length, 0); assert.equal(fixture.bucket.writes.length, 0);
});

test('real live-session roles can query and current role revocation overrides an existing signed token', async () => {
    const fixture = routeFixture();
    for (const role of ['standard', 'partner', 'regional_admin', 'super_admin', 'user']) {
        const result = await fixture.request(`${root}/metadata`, { actor: { ...actor, role } });
        assert.equal(result.status, 200, role); assertPrivateHeaders(assert, result);
        assert.equal((await result.json()).ready, true);
    }
    const token = await fixture.tokenFor(actor); fixture.liveUsers.set(actor.id, { ...actor, role: 'guest' });
    const before = fixture.calls.repositories;
    assert.equal((await fixture.request(`${root}/metadata`, { token })).status, 403);
    assert.equal(fixture.calls.repositories, before);
});

test('cookie CSRF and header-token precedence retain existing boundaries in the actual app', async () => {
    const fixture = routeFixture({ fullApp: true });
    for (const Origin of ['https://untrusted.example', '', 'not-an-origin']) {
        let clones = 0;
        const result = await fixture.request(`${root}/area`, { actor, cookie: true, rawBody: '{', headers: { Origin, 'Content-Length': '1' }, cloneSpy: () => clones++ });
        assert.equal(result.status, 403); assert.equal(clones, 0); assertPrivateHeaders(assert, result);
    }
    const token = await fixture.tokenFor(actor);
    const result = await fixture.request(`${root}/metadata`, { cookie: true, token, headers: { 'X-Session-Token': 'invalid-header-overrides-cookie' } });
    assert.equal(result.status, 403); assert.equal(fixture.bucket.calls.length, 0);
    const allowed = await fixture.request(`${root}/nearby`, { actor, cookie: true, body: { ...validNearbyQuery(), snapshotSha256: ADDRESS_SNAPSHOT_CONFIG.sourceSha256 } });
    assert.equal(allowed.status, 503, 'trusted cookie request reaches the absent synthetic store, rather than a CSRF denial');
    assertPrivateHeaders(assert, allowed);
});

test('only the two exact POST query routes skip the global clone and use their own parser', async () => {
    const fixture = routeFixture({ fullApp: true });
    for (const path of [`${root}/nearby`, `${root}/area`]) {
        let clones = 0;
        const result = await fixture.request(path, { actor, rawBody: '{', headers: { 'Content-Length': '1' }, cloneSpy: () => clones++ });
        assert.equal(result.status, 400); assert.equal(clones, 0);
        assert.equal((await result.json()).code, 'ADDRESS_SNAPSHOT_INVALID_QUERY');
    }
    for (const path of [`${root}/area/`, `${root}/area/extra`, `${root}/nearby-other`, '/api/auth/login']) {
        let clones = 0;
        const result = await fixture.request(path, { actor, rawBody: '{', headers: { 'Content-Length': '1' }, cloneSpy: () => clones++ });
        assert.equal(result.status, 400, path); assert.equal(clones, 1, path);
        assert.match((await result.json()).error, /valid JSON/);
    }
    let clones = 0;
    const wrongMethod = await fixture.request(`${root}/area`, { method: 'PUT', actor, rawBody: '{', headers: { 'Content-Length': '1' }, cloneSpy: () => clones++ });
    assert.equal(wrongMethod.status, 400); assert.equal(clones, 1); assert.equal(fixture.bucket.calls.length, 0);
});

test('streamed byte cap rejects missing or forged length and cancels overflow before creating a repository', async () => {
    for (const headers of [{}, { 'Content-Length': '1' }]) {
        const fixture = routeFixture();
        const { stream, tracking } = trackedBody(new Uint8Array(ADDRESS_SNAPSHOT_MAX_BODY_BYTES + 1).fill(32));
        const result = await fixture.request(`${root}/area`, { actor, rawBody: stream, headers });
        assert.equal(result.status, 413); assert.equal((await result.json()).code, 'ADDRESS_SNAPSHOT_BODY_TOO_LARGE');
        assert.ok(tracking.cancelled); assert.equal(fixture.calls.repositories, 0); assert.equal(fixture.bucket.calls.length, 0);
    }
});

test('the exact byte boundary is accepted for valid JSON and multibyte overflow counts UTF-8 bytes', async () => {
    const fixture = routeFixture();
    const json = JSON.stringify(validAreaQuery());
    const exact = json + ' '.repeat(ADDRESS_SNAPSHOT_MAX_BODY_BYTES - Buffer.byteLength(json));
    assert.equal((await fixture.request(`${root}/area`, { actor, rawBody: exact })).status, 200);
    const malformedButBounded = new TextEncoder().encode('"' + 'é'.repeat((ADDRESS_SNAPSHOT_MAX_BODY_BYTES - 2) / 2) + '"');
    assert.equal(malformedButBounded.length, ADDRESS_SNAPSHOT_MAX_BODY_BYTES);
    const bounded = await fixture.request(`${root}/area`, { actor, rawBody: trackedBody(malformedButBounded).stream });
    assert.equal(bounded.status, 400, 'a scalar JSON body at the exact byte limit reaches schema validation');
    const over = new Uint8Array(malformedButBounded.length + 1); over.set(malformedButBounded);
    const overflow = await fixture.request(`${root}/area`, { actor, rawBody: trackedBody(over).stream });
    assert.equal(overflow.status, 413);
});

test('malformed, unknown, unpinned and invalid query envelopes are rejected without creating a repository', async () => {
    const fixture = routeFixture();
    const cases = [null, [], 'scalar', {}, { ...validAreaQuery(), mapId: 1 }, { area: validAreaQuery().area },
        validAreaQuery({ snapshotSha256: 'BAD' }), validAreaQuery({ offset: -1 }), validAreaQuery({ offset: .5 }), validAreaQuery({ limit: 0 }), validAreaQuery({ limit: 1001 }),
        validAreaQuery({ area: { type: 'Unknown', coordinates: [] } }), validAreaQuery({ area: { type: 'circle', center: [1.38, 103.75], radiusMeters: 1, extra: true } }),
        validAreaQuery({ area: { type: 'Polygon', coordinates: [[[103.75, 1.38], [103.76, 1.38], [103.76, 1.39]]] } })];
    for (const body of cases) assert.equal((await fixture.request(`${root}/area`, { actor, body })).status, 400, JSON.stringify(body));
    for (const body of [validNearbyQuery({ lat: '1.38' }), validNearbyQuery({ lng: 181 }), validNearbyQuery({ lat: null }), validNearbyQuery({ radiusMeters: 1001 }), validNearbyQuery({ extra: 'forbidden' })]) {
        assert.equal((await fixture.request(`${root}/nearby`, { actor, body })).status, 400);
    }
    for (const headers of [{ 'Content-Type': 'text/plain' }, { 'Content-Encoding': 'gzip' }, { 'Content-Length': 'not-a-number' }]) {
        assert.equal((await fixture.request(`${root}/area`, { actor, rawBody: '{}', headers })).status, 400);
    }
    assert.equal(fixture.calls.repositories, 0); assert.equal(fixture.bucket.calls.length, 0);
});

test('provider failures have fixed JSON statuses and never expose internal error messages', async () => {
    for (const [code, status] of [['ADDRESS_SNAPSHOT_INVALID_QUERY', 400], ['ADDRESS_SNAPSHOT_CHANGED', 409], ['ADDRESS_SNAPSHOT_AREA_TOO_LARGE', 422], ['ADDRESS_SNAPSHOT_UNAVAILABLE', 503], ['UNKNOWN', 503]]) {
        const repository = { area: async () => { throw Object.assign(new Error('private-key/care-map-media/secret-data'), { code }); } };
        const fixture = routeFixture({ repository });
        const result = await fixture.request(`${root}/area`, { actor, body: validAreaQuery() });
        assert.equal(result.status, status); assertPrivateHeaders(assert, result);
        const json = await result.json(); assert.doesNotMatch(JSON.stringify(json), /private-key|secret-data|care-map-media/);
        assert.equal(json.code, code === 'UNKNOWN' ? 'ADDRESS_SNAPSHOT_UNAVAILABLE' : code);
        assert.equal(Object.hasOwn(json, 'rows'), false); assert.equal(Object.hasOwn(json, 'total'), false);
    }
});

test('actual authenticated metadata is unavailable safely when no dataset is installed', async () => {
    const fixture = routeFixture({ fullApp: true });
    const result = await fixture.request(`${root}/metadata`, { actor });
    assert.equal(result.status, 503); assertPrivateHeaders(assert, result);
    assert.deepEqual(await result.json(), { error: 'Address search is temporarily unavailable. Try again later.', code: 'ADDRESS_SNAPSHOT_UNAVAILABLE', ready: false });
    assert.equal(fixture.bucket.calls.length, 1); assert.equal(fixture.bucket.writes.length, 0);
});
