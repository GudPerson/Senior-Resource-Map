import test from 'node:test';
import assert from 'node:assert/strict';
import { createAddressSnapshotClient } from '../src/lib/addressSnapshotClient.js';
import { requestWithBaseCandidates } from '../src/lib/api.js';
import { normalizeAddressSnapshotLimit } from '../../shared/addressSnapshotQueryLimits.js';

const pin = 'a'.repeat(64);
const area = { type: 'circle', center: [1.38, 103.75], radiusMeters: 100 };
const payload = { code: 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE', error: 'Area limit',
    addressLimit: { reason: 'geometryWork', observed: 250100, allowed: 250000, coordinates: 'must not cross the error boundary' } };

test('production address errors retain exact safe admission counts through the real API transport', async () => {
    const calls = [];
    const client = createAddressSnapshotClient({ apiRequest: (method, path, body, options) => requestWithBaseCandidates(method, path, body, {
        ...options, baseCandidates: ['https://fictional.invalid/api'], fetchImpl: async (url, init) => {
            calls.push({ url, init }); return Response.json(payload, { status: 422 });
        },
    }) });
    await assert.rejects(client.findSnapshotAddressesWithinArea({ area, snapshotSha256: pin }), error => {
        assert.equal(error.code, payload.code); assert.equal(error.status, 422);
        assert.deepEqual(error.addressLimit, { reason: 'geometryWork', observed: 250100, allowed: 250000 });
        assert.equal(Object.hasOwn(error.addressLimit, 'coordinates'), false); return true;
    });
    assert.equal(calls.length, 1); assert.equal(calls[0].init.method, 'POST'); assert.equal(calls[0].init.credentials, 'include');
});

test('other API errors never gain address diagnostic properties', async () => {
    await assert.rejects(requestWithBaseCandidates('POST', '/favorites/save', {}, {
        baseCandidates: ['https://fictional.invalid/api'], fetchImpl: async () => Response.json(payload, { status: 422 }),
    }), error => !Object.hasOwn(error, 'addressLimit'));
});

test('legacy local-provider error and malformed diagnostics keep the existing generic fallback', async () => {
    const client = createAddressSnapshotClient({ provider: 'local', fetchImpl: async () => Response.json({ ...payload,
        addressLimit: { reason: 'private/key', observed: 2, allowed: 1 } }, { status: 422 }) });
    await assert.rejects(client.findSnapshotAddressesWithinArea({ area, snapshotSha256: pin }), error => {
        assert.equal(error.code, payload.code); assert.equal(Object.hasOwn(error, 'addressLimit'), false); return true;
    });
    for (const value of [{ reason: 'tiles', observed: Infinity, allowed: 1 }, { reason: 'tiles', observed: 1.5, allowed: 1 },
        { reason: 'tiles', observed: 1, allowed: 1 }, { reason: 'tiles', observed: 2, allowed: -1 }]) {
        assert.equal(normalizeAddressSnapshotLimit(value), undefined);
    }
});
