import assert from 'node:assert/strict';
import test from 'node:test';
import { AddressSnapshotError, createAddressSnapshotClient, findNearbySnapshotAddresses } from '../src/lib/addressSnapshotClient.js';

const sha = 'a'.repeat(64), snapshot = { label: 'Dated address snapshot', coverage: 'Incomplete', sha256: sha };
const area = { type: 'circle', center: [1.3, 103.8], radiusMeters: 100 };
const result = (overrides = {}) => ({ snapshot, rows: [], total: 0, offset: 0, limit: 200, truncated: false, ...overrides });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('production provider is the default and initial searches obtain and carry the metadata pin', async t => {
    const controller = new AbortController(), calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options }); return json(url.endsWith('/metadata') ? { ready: true, snapshot } : result());
    });
    await findNearbySnapshotAddresses({ lat: 1.3, lng: 103.8, signal: controller.signal });
    assert.deepEqual(calls.map(call => call.url), ['/api/address-snapshot/metadata', '/api/address-snapshot/nearby']);
    assert.ok(calls.every(call => call.options.credentials === 'include' && call.options.signal === controller.signal && call.options.cache === 'no-store'));
    assert.deepEqual(JSON.parse(calls[1].options.body), { lat: 1.3, lng: 103.8, radiusMeters: 100, limit: 10, snapshotSha256: sha });
});

test('area first query and each subsequent page/export preserve the chosen snapshot without re-reading metadata', async () => {
    const calls = [], client = createAddressSnapshotClient({ apiRequest: async (method, path, body, options) => {
        calls.push({ method, path, body, options }); return path.endsWith('/metadata') ? { snapshot } : result({ offset: body.offset });
    } });
    await client.findSnapshotAddressesWithinArea({ area });
    await client.findSnapshotAddressesWithinArea({ area, offset: 200, snapshotSha256: sha });
    await client.findSnapshotAddressesWithinArea({ area, offset: 0, snapshotSha256: sha });
    assert.deepEqual(calls.map(call => call.path), ['/address-snapshot/metadata', '/address-snapshot/area', '/address-snapshot/area', '/address-snapshot/area']);
    assert.ok(calls.filter(call => call.body).every(call => call.body.snapshotSha256 === sha));
    await assert.rejects(client.findSnapshotAddressesWithinArea({ area, offset: 200 }), error => error.code === 'ADDRESS_SNAPSHOT_INVALID_QUERY');
    assert.equal(calls.length, 4, 'Missing pagination pin fails before network access');
});

test('explicit local preview uses only the fixed same-origin proxy, never cookies, and pins requests too', async () => {
    const calls = [], controller = new AbortController();
    const client = createAddressSnapshotClient({ provider: 'local', fetchImpl: async (url, options) => {
        calls.push({ url, options }); return json(url.endsWith('/metadata') ? { snapshot } : result());
    } });
    await client.findNearbySnapshotAddresses({ lat: 1.3, lng: 103.8, signal: controller.signal });
    assert.deepEqual(calls.map(call => call.url), ['/__carearound-addresses/metadata', '/__carearound-addresses/nearby']);
    assert.ok(calls.every(call => call.options.credentials === 'omit' && call.options.signal === controller.signal));
    assert.equal(JSON.parse(calls[1].options.body).snapshotSha256, sha);
});

test('changed response snapshot fails closed before consumers receive mixed rows', async () => {
    const client = createAddressSnapshotClient({ apiRequest: async () => result({ snapshot: { ...snapshot, sha256: 'b'.repeat(64) } }) });
    await assert.rejects(client.findSnapshotAddressesWithinArea({ area, snapshotSha256: sha }), error => error.code === 'ADDRESS_SNAPSHOT_CHANGED' && error.status === 409);
});

test('metadata unavailable, HTML and malformed results remain errors rather than zero addresses', async () => {
    for (const value of [new TypeError('Offline'), { ready: false, snapshot }, { snapshot: { label: 'No pin' } }, { rows: [] }]) {
        const client = createAddressSnapshotClient({ apiRequest: async () => { if (value instanceof Error) throw value; return value; } });
        await assert.rejects(client.findNearbySnapshotAddresses({ lat: 1.3, lng: 103.8 }), error => error instanceof AddressSnapshotError && error.code === 'ADDRESS_SNAPSHOT_UNAVAILABLE');
    }
    const local = createAddressSnapshotClient({ provider: 'local', fetchImpl: async () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }) });
    await assert.rejects(local.getAddressSnapshotMetadata(), error => error.code === 'ADDRESS_SNAPSHOT_UNAVAILABLE');
});

test('invalid area, changed snapshot and area-too-large service errors keep their typed actionable status', async () => {
    for (const [status, code] of [[400, 'ADDRESS_SNAPSHOT_INVALID_QUERY'], [409, 'ADDRESS_SNAPSHOT_CHANGED'], [422, 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE'], [503, 'ADDRESS_SNAPSHOT_UNAVAILABLE']]) {
        const client = createAddressSnapshotClient({ apiRequest: async () => { throw Object.assign(new Error('Service error'), { status, code }); } });
        await assert.rejects(client.findSnapshotAddressesWithinArea({ area, snapshotSha256: sha }), error => error.code === code && error.status === status);
    }
});

test('abort during metadata or query stays an abort and never starts the next request', async () => {
    const controller = new AbortController(), error = new DOMException('Aborted', 'AbortError'); let calls = 0;
    const client = createAddressSnapshotClient({ apiRequest: async () => { calls++; controller.abort(); throw error; } });
    await assert.rejects(client.findNearbySnapshotAddresses({ lat: 1.3, lng: 103.8, signal: controller.signal }), actual => actual === error);
    assert.equal(calls, 1);
});
