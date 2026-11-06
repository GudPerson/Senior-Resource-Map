import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAddressSnapshotRecords } from '../../scripts/build-address-snapshot.mjs';
import { createAddressSnapshotRepository } from '../src/utils/addressSnapshotRepository.js';
import { AddressSnapshotTestBucket, routeFixture, TEST_SNAPSHOT_SHA, assertPrivateHeaders } from './helpers/addressSnapshotRouteFixtures.js';

const records = [
    ['012345', '1', 'Fictional Road', 'First', '1 Fictional Road', '1.38', '103.75'],
    ['012345', '2', 'Fictional Road', 'Second', '2 Fictional Road', '1.3801', '103.7501'],
];
const area = { type: 'Polygon', coordinates: [[[103.749, 1.379], [103.752, 1.379], [103.752, 1.382], [103.749, 1.382], [103.749, 1.379]]] };
const actor = { id: 91103, role: 'standard' };

test('address budget rejections identify the first exact bounded limit before reading address shards', async () => {
    const artifact = compileAddressSnapshotRecords(records, { sourceSha256: TEST_SNAPSHOT_SHA, preparedAt: '2026-11-03T00:00:00.000Z' });
    assert.equal(artifact.manifest.tiles.length, 1);
    const reserved = artifact.config.manifestBytes + artifact.manifest.tiles.reduce((sum, tile) => sum + tile.index.bytes + tile.rows.bytes, 0);
    const cases = [
        [{ maxAreaTiles: 0 }, 'tiles', 1, 0],
        [{ maxReservedBytes: artifact.config.manifestBytes }, 'reservedBytes', reserved, artifact.config.manifestBytes],
        [{ maxCandidateRows: 1 }, 'candidateRows', 2, 1],
        [{ maxGeometryWork: 7 }, 'geometryWork', 8, 7],
        [{ maxR2Reads: 2 }, 'storageReads', 3, 2],
        [{ maxAreaTiles: 0, maxCandidateRows: 0, maxGeometryWork: 0 }, 'tiles', 1, 0],
    ];
    for (const [limits, reason, observed, allowed] of cases) {
        const bucket = new AddressSnapshotTestBucket(artifact.objects);
        const config = { ...artifact.config, limits: { ...artifact.config.limits, ...limits } };
        const fixture = routeFixture({ repository: createAddressSnapshotRepository(bucket, { config }), bucket });
        const response = await fixture.request('/api/address-snapshot/area', { actor, body: { area, offset: 0, limit: 1, snapshotSha256: TEST_SNAPSHOT_SHA } });
        assertPrivateHeaders(assert, response);
        const body = await response.json();
        assert.equal(response.status, 422);
        assert.equal(body.code, 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE');
        assert.deepEqual(body.addressLimit, { reason, observed, allowed });
        assert.equal(Object.hasOwn(body, 'rows'), false);
        assert.equal(Object.hasOwn(body, 'total'), false);
        assert.doesNotMatch(JSON.stringify(body), /coordinates|manifest\.json|tiles\/|Fictional Road/);
        assert.equal(bucket.calls.length, 1);
        assert.equal(bucket.writes.length, 0);
    }
});

test('address success remains snapshot-pinned and retains separate addresses with the same postal code', async () => {
    const artifact = compileAddressSnapshotRecords(records, { sourceSha256: TEST_SNAPSHOT_SHA, preparedAt: '2026-11-03T00:00:00.000Z' });
    const bucket = new AddressSnapshotTestBucket(artifact.objects);
    const fixture = routeFixture({ repository: createAddressSnapshotRepository(bucket, { config: artifact.config }), bucket });
    const response = await fixture.request('/api/address-snapshot/area', { actor, body: { area, limit: 1, snapshotSha256: TEST_SNAPSHOT_SHA } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.total, 2);
    assert.equal(body.rows.length, 1);
    assert.equal(body.snapshot.sha256, TEST_SNAPSHOT_SHA);
    assert.equal(body.truncated, true);
    assert.equal(Object.hasOwn(body, 'addressLimit'), false);
    assert.equal(bucket.writes.length, 0);
});
