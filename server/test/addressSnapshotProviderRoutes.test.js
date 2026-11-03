import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileAddressSnapshotRecords } from '../../scripts/build-address-snapshot.mjs';
import { createAddressSnapshotRepository } from '../src/utils/addressSnapshotRepository.js';
import { createHelpMediaRoutes } from '../src/routes/helpCms.js';
import { Hono } from 'hono';
import { AddressSnapshotTestBucket, routeFixture, TEST_SNAPSHOT_SHA, assertPrivateHeaders } from './helpers/addressSnapshotRouteFixtures.js';

const root = '/api/address-snapshot', actor = { id: 91103, role: 'standard' };
const records = [
    ['012345', '1', 'Fictional Road', '=1+1', '1 Fictional Road', '1.38', '103.75'],
    ['012345', '2', 'Fictional Road', 'Second address sharing postal', '2 Fictional Road', '1.3801', '103.7501'],
    ['680003', '3', 'Fictional Road', 'Outer boundary point', '3 Fictional Road', '1.38', '103.76'],
    ['680004', '4', 'Fictional Road', 'Excluded hole interior', '4 Fictional Road', '1.385', '103.755'],
    ['680005', '5', 'Fictional Road', 'Second polygon part', '5 Fictional Road', '1.41', '103.78'],
    ['680006', '6', 'Fictional Road', 'Outside area', '6 Fictional Road', '1.44', '103.82'],
    ['680007', '7', 'Fictional Road', 'Hole boundary point', '7 Fictional Road', '1.385', '103.7545'],
];
const mainOuter = [[103.749, 1.379], [103.76, 1.379], [103.76, 1.391], [103.749, 1.391], [103.749, 1.379]];
const hole = [[103.7545, 1.3845], [103.7555, 1.3845], [103.7555, 1.3855], [103.7545, 1.3855], [103.7545, 1.3845]];
const second = [[103.779, 1.409], [103.781, 1.409], [103.781, 1.411], [103.779, 1.411], [103.779, 1.409]];
const multi = { type: 'MultiPolygon', coordinates: [[mainOuter, hole], [second]] };
const query = extra => ({ area: multi, snapshotSha256: TEST_SNAPSHOT_SHA, ...extra });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function compiled() { return compileAddressSnapshotRecords(records, { sourceSha256: TEST_SNAPSHOT_SHA, preparedAt: '2026-11-03T00:00:00.000Z' }); }
function fixtureFor(artifact, { limits = {} } = {}) {
    const config = { ...artifact.config, limits: { ...artifact.config.limits, ...limits } };
    const bucket = new AddressSnapshotTestBucket(artifact.objects);
    const repository = createAddressSnapshotRepository(bucket, { config });
    return { ...routeFixture({ repository, bucket }), artifact, config };
}
function reseal(artifact) {
    const key = `${artifact.config.prefix}/manifest.json`;
    const bytes = Buffer.from(JSON.stringify(artifact.manifest));
    artifact.objects.set(key, { bytes, contentType: 'application/json', sha256: hash(bytes) });
    artifact.config = { ...artifact.config, manifestBytes: bytes.length, manifestSha256: hash(bytes),
        totalBytes: [...artifact.objects.values()].reduce((total, value) => total + value.bytes.length, 0) };
}
function replaceObject(artifact, key, bytes) {
    const entry = artifact.objects.get(key), sha256 = hash(bytes);
    artifact.objects.set(key, { ...entry, bytes, sha256 });
    for (const tile of artifact.manifest.tiles) for (const kind of ['index', 'rows']) {
        if (tile[kind].key === key) tile[kind] = { key, bytes: bytes.length, sha256 };
    }
    reseal(artifact);
}

async function resultOf(fixture, body = query()) {
    const response = await fixture.request(`${root}/area`, { actor, body });
    assertPrivateHeaders(assert, response);
    return { response, body: await response.json() };
}

test('real repository metadata and pinned pagination preserve all rows, duplicate postals, multipart and hole boundaries', async () => {
    const fixture = fixtureFor(compiled());
    const meta = await fixture.request(`${root}/metadata`, { actor });
    assert.equal(meta.status, 200); assert.equal((await meta.json()).snapshot.sha256, TEST_SNAPSHOT_SHA);
    const all = [];
    for (const offset of [0, 2, 4]) {
        const { response, body } = await resultOf(fixture, query({ offset, limit: 2 }));
        assert.equal(response.status, 200); assert.equal(body.total, 5); assert.equal(body.offset, offset);
        assert.equal(body.snapshot.sha256, TEST_SNAPSHOT_SHA); all.push(...body.rows);
    }
    assert.deepEqual(all.map(row => row.block), ['1', '2', '3', '5', '7']);
    assert.equal(new Set(all.map(row => row.id)).size, 5);
    assert.equal(all.filter(row => row.postalCode === '012345').length, 2);
    assert.equal(all.some(row => row.building === 'Excluded hole interior' || row.building === 'Outside area'), false);
    assert.equal(fixture.bucket.writes.length, 0);
    assert.ok(fixture.bucket.calls.every(key => key.startsWith(`${fixture.config.prefix}/`)));
});

test('pinned nearby results retain original precision and nearest-first distance order', async () => {
    const fixture = fixtureFor(compiled());
    const response = await fixture.request(`${root}/nearby`, { actor, body: { lat: 1.38, lng: 103.75, radiusMeters: 100, snapshotSha256: TEST_SNAPSHOT_SHA } });
    assert.equal(response.status, 200); const body = await response.json();
    assert.equal(body.total, 2); assert.deepEqual(body.rows.map(row => row.block), ['1', '2']);
    assert.equal(body.rows[0].lat, 1.38); assert.equal(body.rows[1].lng, 103.7501);
    assert.ok(body.rows[0].distanceMeters <= body.rows[1].distanceMeters);
    assert.equal(fixture.bucket.writes.length, 0);
});

test('wrong, missing or changed snapshot pins never read a different dataset', async () => {
    const fixture = fixtureFor(compiled());
    const first = await resultOf(fixture, query({ limit: 2 })); assert.equal(first.response.status, 200);
    fixture.bucket.calls.length = 0;
    for (const body of [query({ snapshotSha256: 'b'.repeat(64), offset: 2 }), query({ snapshotSha256: undefined, offset: 2 }), query({ snapshotSha256: 'bad' })]) {
        const result = await resultOf(fixture, body);
        assert.equal(result.response.status, body.snapshotSha256?.length === 64 ? 409 : 400);
        assert.equal(Object.hasOwn(result.body, 'rows'), false); assert.equal(fixture.bucket.calls.length, 0);
    }
});

test('all hard query budgets fail explicitly before index/pack reads instead of reporting empty results', async () => {
    for (const limits of [{ maxAreaTiles: 1 }, { maxCandidateRows: 1 }, { maxGeometryWork: 1 }, { maxR2Reads: 1 }, { maxReservedBytes: compiled().config.manifestBytes + 1 }]) {
        const fixture = fixtureFor(compiled(), { limits });
        const { response, body } = await resultOf(fixture);
        assert.equal(response.status, 422, JSON.stringify(limits)); assert.equal(body.code, 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE');
        assert.equal(Object.hasOwn(body, 'total'), false); assert.equal(Object.hasOwn(body, 'rows'), false);
        assert.equal(fixture.bucket.calls.length, 1, 'only the immutable manifest was read');
        assert.equal(fixture.bucket.writes.length, 0);
    }
});

test('missing, hash-corrupt, MIME-corrupt and falsely sized stored objects fail as sanitized503', async () => {
    for (const corrupt of ['missing-manifest', 'missing-index', 'missing-pack', 'hash-index', 'mime-index', 'size-index', 'actual-stream-overflow']) {
        const fixture = fixtureFor(compiled());
        const tile = fixture.artifact.manifest.tiles.find(value => value.count >= 2);
        const key = corrupt === 'missing-manifest' ? `${fixture.config.prefix}/manifest.json` : corrupt === 'missing-pack' ? tile.rows.key : tile.index.key;
        if (corrupt.startsWith('missing')) fixture.bucket.objects.delete(key);
        else {
            const entry = fixture.bucket.objects.get(key);
            if (corrupt === 'hash-index') { entry.bytes = entry.bytes.slice(); entry.bytes[0] ^= 1; }
            if (corrupt === 'mime-index') entry.contentType = 'text/html';
            if (corrupt === 'size-index') entry.reportedSize = entry.bytes.length - 1;
            if (corrupt === 'actual-stream-overflow') { entry.reportedSize = entry.bytes.length; entry.bytes = new Uint8Array(entry.bytes.length + 1); }
        }
        const { response, body } = await resultOf(fixture, query({ limit: 1000 }));
        assert.equal(response.status, 503, corrupt); assert.equal(body.code, 'ADDRESS_SNAPSHOT_UNAVAILABLE');
        assert.equal(Object.hasOwn(body, 'rows'), false); assert.equal(Object.hasOwn(body, 'total'), false);
        assert.doesNotMatch(JSON.stringify(body), /manifest\.json|tiles\/|private|care-map-media/);
    }
});

test('manifest path traversal and index/pack semantic corruption fail even when object hashes are resealed', async () => {
    for (const corrupt of ['namespace', 'duplicate-ordinal', 'invalid-coordinate', 'row-count', 'duplicate-row-id']) {
        const artifact = compiled();
        const tile = artifact.manifest.tiles.find(value => value.count >= 2);
        if (corrupt === 'namespace') { tile.index.key = 'care-map-media/v1/owners/1/quota.json'; reseal(artifact); }
        else if (corrupt === 'duplicate-ordinal' || corrupt === 'invalid-coordinate') {
            const bytes = Buffer.from(artifact.objects.get(tile.index.key).bytes);
            if (corrupt === 'duplicate-ordinal') bytes.writeUInt32LE(bytes.readUInt32LE(16), 36);
            else bytes.writeDoubleLE(999, 0);
            replaceObject(artifact, tile.index.key, bytes);
        } else {
            const rows = JSON.parse(Buffer.from(artifact.objects.get(tile.rows.key).bytes).toString());
            if (corrupt === 'row-count') rows.pop(); else rows[1][0] = rows[0][0];
            replaceObject(artifact, tile.rows.key, Buffer.from(JSON.stringify(rows)));
        }
        const fixture = fixtureFor(artifact); const { response, body } = await resultOf(fixture, query({ limit: 1000 }));
        assert.equal(response.status, 503, corrupt); assert.equal(body.code, 'ADDRESS_SNAPSHOT_UNAVAILABLE');
        assert.ok(fixture.bucket.calls.every(key => key.startsWith(`${fixture.config.prefix}/`)), corrupt);
    }
});

test('concurrent R2 reads remain within the configured bound and never mutate storage', async () => {
    const fixture = fixtureFor(compiled());
    fixture.bucket.beforeGet = async () => new Promise(resolve => setImmediate(resolve));
    const { response } = await resultOf(fixture, query({ limit: 1000 }));
    assert.equal(response.status, 200); assert.ok(fixture.bucket.peakReads <= fixture.config.limits.maxConcurrentReads);
    assert.ok(fixture.bucket.calls.length <= fixture.config.limits.maxR2Reads);
    assert.ok(fixture.bucket.deliveredBytes <= fixture.config.limits.maxReservedBytes); assert.equal(fixture.bucket.writes.length, 0);
});

test('public help media cannot reveal address objects by source digest or encoded storage key', async () => {
    const artifact = compiled(), bucket = new AddressSnapshotTestBucket(artifact.objects);
    const app = new Hono(); app.route('/api/help/media', createHelpMediaRoutes({ articles: [], bucketForContext: () => bucket }));
    for (const id of [TEST_SNAPSHOT_SHA, encodeURIComponent(`${artifact.config.prefix}/manifest.json`), '%2e%2e%2faddress-snapshot%2fv1%2fprivate']) {
        const result = await app.request(`/api/help/media/${id}`); assert.equal(result.status, 404);
    }
    assert.equal(bucket.calls.length, 0); assert.equal(bucket.writes.length, 0);
});

test('production work cap admits exactly250000 operations and rejects complex outlines before shard reads', async () => {
    const source = Array.from({ length: 100 }, (_, index) => ['680001', String(index + 1), 'Fictional Budget Road', `Budget row ${index}`, `${index + 1} Fictional Budget Road`, String(1.38 + (index % 10) * .0000001), String(103.75 + Math.floor(index / 10) * .0000001)]);
    const artifact = compileAddressSnapshotRecords(source, { sourceSha256: TEST_SNAPSHOT_SHA, preparedAt: '2026-11-03T00:00:00.000Z' });
    assert.equal(artifact.config.limits.maxGeometryWork, 250000);
    for (const edges of [2500, 2501, 10000, 10001]) {
        const ring = Array.from({ length: edges }, (_, index) => [103.75 + .001 * Math.cos(index * 2 * Math.PI / edges), 1.38 + .001 * Math.sin(index * 2 * Math.PI / edges)]);
        ring.push([...ring[0]]);
        const fixture = fixtureFor(artifact);
        const { response, body } = await resultOf(fixture, { area: { type: 'Polygon', coordinates: [ring] }, snapshotSha256: TEST_SNAPSHOT_SHA, limit: 100 });
        assert.equal(response.status, edges === 2500 ? 200 : edges > 10000 ? 400 : 422, String(edges));
        if (edges === 2500) assert.equal(body.total, 100);
        else {
            assert.equal(body.code, edges > 10000 ? 'ADDRESS_SNAPSHOT_INVALID_QUERY' : 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE');
            assert.equal(fixture.bucket.calls.length, edges > 10000 ? 0 : 1, 'invalid or over-budget geometry reads no shards');
            assert.equal(Object.hasOwn(body, 'total'), false);
        }
        assert.equal(fixture.bucket.writes.length, 0);
    }
});
