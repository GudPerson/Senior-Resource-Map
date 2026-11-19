import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileAddressSnapshotRecords } from '../../scripts/build-address-snapshot.mjs';
import { containsSpatialPoint, normalizeSpatialArea } from '../../shared/addressSnapshotSpatial.js';
import { isAddressSnapshotScanResponse } from '../../shared/addressSnapshotScanContract.js';
import { createAddressSnapshotScanRepository } from '../src/utils/addressSnapshotScanRepository.js';
import { createAddressSnapshotRepository } from '../src/utils/addressSnapshotRepository.js';
import { ADDRESS_SNAPSHOT_MAX_BODY_BYTES } from '../src/controllers/addressSnapshotController.js';
import { ADDRESS_SNAPSHOT_CONFIG } from '../src/utils/addressSnapshotConfig.js';
import { AddressSnapshotTestBucket, routeFixture, TEST_SNAPSHOT_SHA, assertPrivateHeaders } from './helpers/addressSnapshotRouteFixtures.js';

const root = '/api/address-snapshot', scanPath = root + '/area/scan';
const actor = { id: 91103, role: 'standard' };
const MiB = 1024 * 1024;
const responseBytes = 2 * MiB, envelopeReserve = 32 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const rectangle = (west, south, east, north) => [[west, south], [east, south], [east, north], [west, north], [west, south]];
const polygon = { type: 'Polygon', coordinates: [rectangle(103.69, 1.29, 103.92, 1.47)] };
const query = (area = polygon, cursor = null) => ({ area, snapshotSha256: TEST_SNAPSHOT_SHA, cursor });
const address = (ordinal, lat = 1.38, lng = 103.75, building = '') => [
    '012345', String(ordinal), 'Fictional Road', building, 'Fictional Address', String(lat), String(lng),
];

function tiledRecords(count, building = '') {
    return Array.from({ length: count }, (_, i) => address(i, 1.301 + Math.floor(i / 20) * 0.01,
        103.701 + (i % 20) * 0.01, building)).reverse();
}

function denseRectangle(segmentsPerSide) {
    const ring = polygon.coordinates[0];
    return { type: 'Polygon', coordinates: [[...ring.slice(0, -1).flatMap(([lng, lat], i) => {
        const [nextLng, nextLat] = ring[i + 1];
        return Array.from({ length: segmentsPerSide }, (_, step) => [
            lng + (nextLng - lng) * step / segmentsPerSide, lat + (nextLat - lat) * step / segmentsPerSide,
        ]);
    }), ring[0]]] };
}

function reseal(artifact, tile, kind, bytes) {
    if (tile) {
        const key = tile[kind].key;
        const hash = sha256(bytes);
        artifact.objects.set(key, { ...artifact.objects.get(key), bytes, sha256: hash });
        tile[kind] = { key, bytes: bytes.length, sha256: hash };
    }
    const key = artifact.config.prefix + '/manifest.json';
    const manifestBytes = Buffer.from(JSON.stringify(artifact.manifest));
    const manifestSha256 = sha256(manifestBytes);
    artifact.objects.set(key, { bytes: manifestBytes, contentType: 'application/json', sha256: manifestSha256 });
    Object.assign(artifact.config, { manifestBytes: manifestBytes.length, manifestSha256,
        totalBytes: [...artifact.objects.values()].reduce((sum, entry) => sum + entry.bytes.length, 0) });
}

function fixtureFor(records, { limits, alter, etag, preparedAt = '2026-11-03T00:00:00.000Z' } = {}) {
    const artifact = compileAddressSnapshotRecords(records, { sourceSha256: TEST_SNAPSHOT_SHA, preparedAt });
    alter?.(artifact);
    const config = { ...artifact.config, limits: { ...artifact.config.limits, ...limits } };
    const bucket = new AddressSnapshotTestBucket(artifact.objects);
    const manifestKey = config.prefix + '/manifest.json';
    if (etag !== undefined) bucket.objects.get(manifestKey).etag = etag;
    const repository = createAddressSnapshotRepository(bucket, { config });
    const scanRepository = createAddressSnapshotScanRepository(bucket, { config });
    const fixture = routeFixture({ repository, scanRepository, bucket });
    const databaseCalls = [];
    Object.defineProperty(fixture.env, 'DATABASE_URL', { get() { databaseCalls.push('database'); throw Error('Unexpected database/job path'); } });
    return { ...fixture, records, artifact, config, manifestKey, databaseCalls };
}

async function step(fixture, body = query(), options = {}) {
    const response = await fixture.request(scanPath, { actor, body, ...options });
    assertPrivateHeaders(assert, response);
    const text = await response.text();
    assert.match(text, /^\{/, `Expected private scan JSON, received HTTP ${response.status}`);
    assert.ok(Buffer.byteLength(text) <= responseBytes);
    assert.equal(fixture.bucket.writes.length, 0);
    assert.deepEqual(fixture.databaseCalls, []);
    return { status: response.status, body: JSON.parse(text), bytes: Buffer.byteLength(text) };
}

async function batch(fixture, body, options) {
    const { status, body: value, bytes } = await step(fixture, body, options);
    assert.equal(status, 200);
    assert.ok(isAddressSnapshotScanResponse(value, { snapshotSha256: body.snapshotSha256, cursor: body.cursor,
        areaSha256: sha256(JSON.stringify(normalizeSpatialArea(body.area))) }));
    assert.equal(Object.hasOwn(value, 'total'), false);
    assert.ok(value.rows.length <= value.diagnostics.consumedCandidates);
    assert.ok(value.diagnostics.consumedCandidates <= value.diagnostics.candidates);
    assert.ok(value.diagnostics.candidates <= value.scan.batchCandidateLimit);
    assert.equal(value.progress.tilesTotal, value.scan.tilesTotal);
    assert.equal(value.nextCursor === null, value.done);
    if (value.done) assert.equal(value.progress.tilesCompleted, value.progress.tilesTotal);
    else {
        assert.equal(value.nextCursor.tile, value.progress.tilesCompleted);
        const before = body.cursor || { tile: 0, row: 0 };
        assert.ok(value.nextCursor.tile > before.tile
            || (value.nextCursor.tile === before.tile && value.nextCursor.row > before.row));
        assert.ok(value.diagnostics.consumedCandidates > 0);
    }
    return { ...value, responseBytes: bytes };
}

async function scanAll(fixture, area = polygon) {
    let cursor = null;
    const batches = [];
    do {
        const result = await batch(fixture, query(area, cursor));
        if (batches.length) assert.deepEqual(result.scan, batches[0].scan);
        batches.push(result);
        cursor = result.nextCursor;
        assert.ok(batches.length <= fixture.config.recordCount + 1, 'scan always reaches a terminal response');
    } while (cursor);
    return batches;
}

function oracle(records, area) {
    const occurrences = new Map();
    return records.flatMap((values, ordinal) => {
        const [postalCode, block, roadName, building, address, rawLat, rawLng] = values;
        const lat = Number(rawLat), lng = Number(rawLng), digest = sha256(JSON.stringify(values));
        const occurrence = (occurrences.get(digest) || 0) + 1;
        occurrences.set(digest, occurrence);
        return containsSpatialPoint(area, [lat, lng])
            ? [{ id: 'address_' + digest + '_' + occurrence, postalCode, block, roadName, building, address, lat, lng, ordinal }] : [];
    });
}

const rowsByOrdinal = batches => batches.flatMap(value => value.rows).sort((a, b) => a.ordinal - b.ordinal);

test('legacy298TileQueryRejectsButScanCompletesExactOracle', async () => {
    const fixture = fixtureFor(tiledRecords(298));
    const area = denseRectangle(159);
    const legacy = await fixture.request(root + '/area', { actor, body: { area, snapshotSha256: TEST_SNAPSHOT_SHA, limit: 1 } });
    assert.equal(legacy.status, 422);
    assert.deepEqual((await legacy.json()).addressLimit, { reason: 'tiles', observed: 298, allowed: 16 });
    const batches = await scanAll(fixture, area);
    assert.equal(fixture.calls.repositories, 1, 'only the ordinary area query uses the legacy repository');
    assert.equal(batches.length, 19);
    assert.equal(batches[0].scan.tilesTotal, 298);
    assert.equal(batches[0].scan.batchCandidateLimit, Math.floor(250000 / 636));
    assert.equal(batches[0].scan.areaSha256, sha256(JSON.stringify(normalizeSpatialArea(area))));
    assert.deepEqual(rowsByOrdinal(batches), oracle(fixture.records, area));
    assert.equal(new Set(rowsByOrdinal(batches).map(row => row.postalCode)).size, 1);
});

test('denseTileResumesWithoutSkippingNextRow', async () => {
    const records = Array.from({ length: 1026 }, (_, i) => address(i));
    records[1] = records[0];
    const fixture = fixtureFor(records);
    const batches = await scanAll(fixture);
    assert.deepEqual(batches.map(value => value.progress.tilesCompleted), [0, 0, 1]);
    assert.deepEqual(batches.slice(0, 2).map(value => [value.nextCursor.tile, value.nextCursor.row]), [[0, 512], [0, 1024]]);
    assert.deepEqual(batches.map(value => value.diagnostics.consumedCandidates), [512, 512, 2]);
    assert.deepEqual(rowsByOrdinal(batches), oracle(fixture.records, polygon));
});

test('multipartHoleAndEmptyBatchesStayExact', async () => {
    const area = { type: 'MultiPolygon', coordinates: [
        [rectangle(103.7, 1.3, 103.742, 1.35), rectangle(103.712, 1.32, 103.732, 1.34)],
        [rectangle(103.768, 1.3, 103.782, 1.35)],
    ] };
    const fixture = fixtureFor([
        address(0, 1.32, 103.705), address(1, 1.33000000001, 103.716), address(2, 1.33, 103.732),
        address(3, 1.33, 103.75), address(4, 1.35, 103.775),
    ], { limits: { maxAreaTiles: 1 } });
    const batches = await scanAll(fixture, area);
    assert.deepEqual(batches.map(value => value.rows.length), [1, 0, 1, 0, 1]);
    assert.deepEqual(rowsByOrdinal(batches), oracle(fixture.records, area));
    assert.deepEqual(rowsByOrdinal(batches).map(row => row.ordinal), [0, 2, 4]);
    const empty = await batch(fixture, query({ type: 'circle', center: [0, 0], radiusMeters: 10 }));
    assert.equal(empty.done, true);
    assert.deepEqual(empty.rows, []);
    assert.deepEqual(empty.diagnostics, { reads: 1, bytes: fixture.config.manifestBytes, consumedCandidates: 0, candidates: 0, geometryWork: 0 });
});

test('everyBudgetIsCumulativeAcrossTiles', async () => {
    const records = tiledRecords(20);
    for (const [limits, expected] of [
        [{ maxAreaTiles: 3 }, 3],
        [{ maxR2Reads: 5 }, 2],
        [{ maxCandidateRows: 2 }, 2],
        [{ maxGeometryWork: 8 }, 2],
        [{ maxConcurrentReads: 1 }, 16],
        [{ maxAreaTiles: 100, maxR2Reads: 100, maxConcurrentReads: 100 }, 16],
    ]) {
        const fixture = fixtureFor(records, { limits });
        fixture.bucket.beforeGet = () => new Promise(resolve => setImmediate(resolve));
        const first = await batch(fixture, query());
        assert.equal(first.progress.tilesCompleted, expected, JSON.stringify(limits));
        assert.equal(first.diagnostics.reads, 1 + 2 * expected);
        assert.equal(first.diagnostics.consumedCandidates, expected);
        assert.equal(first.diagnostics.geometryWork, expected * 4);
        assert.ok(fixture.bucket.peakReads <= Math.min(4, limits.maxConcurrentReads ?? 4));
        assert.equal(first.diagnostics.bytes, fixture.bucket.deliveredBytes);
    }
    for (const hardCap of [false, true]) {
        const fixture = fixtureFor(tiledRecords(12, '\u0000'.repeat(65536)), {
            limits: { maxReservedBytes: hardCap ? 10 * MiB : MiB },
        });
        const disconnected = { type: 'MultiPolygon', coordinates: [
            [rectangle(103.69, 1.29, 103.692, 1.292)],
            [rectangle(103.91, 1.31, 103.92, 1.32)],
        ] };
        const first = await batch(fixture, query(disconnected));
        assert.equal(first.progress.tilesCompleted, hardCap ? 10 : 2);
        assert.equal(first.diagnostics.bytes, fixture.bucket.deliveredBytes);
        assert.ok(first.diagnostics.bytes <= Math.min(fixture.config.limits.maxReservedBytes, 4 * MiB));
    }
    const dense = fixtureFor(Array.from({ length: 55 }, (_, i) => address(i)), { limits: { maxGeometryWork: 1000000 } });
    const constrained = await batch(dense, query(denseRectangle(2500)));
    assert.equal(constrained.scan.batchCandidateLimit, 25);
    assert.equal(constrained.diagnostics.geometryWork, 250000);
    assert.equal(constrained.nextCursor.row, 25);
});

test('firstTileCannotFitFailsRatherThanLoops', async () => {
    for (const [limits, reason] of [
        [{ maxReservedBytes: 1 }, 'reservedBytes'],
        [{ maxReservedBytes: 800 }, 'reservedBytes'],
        [{ maxR2Reads: 2 }, 'storageReads'],
        [{ maxAreaTiles: 0 }, 'tiles'],
        [{ maxGeometryWork: 3 }, 'geometryWork'],
        [{ maxCandidateRows: 0 }, 'candidateRows'],
    ]) {
        const fixture = fixtureFor([address(0, 1.38, 103.75, 'a'.repeat(500))], { limits });
        const result = await step(fixture);
        assert.equal(result.status, 422, JSON.stringify(limits));
        assert.equal(result.body.code, 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE');
        assert.equal(result.body.addressLimit.reason, reason);
        assert.equal(Object.hasOwn(result.body, 'rows'), false);
        assert.ok(fixture.bucket.calls.length <= 1);
    }
});

test('responseByteBoundaryPreservesNextRowAndCountsConsumedSeparately', async () => {
    const records = Array.from({ length: 7 }, (_, i) => address(i, 1.301, 103.701 + Math.floor(i / 2) * 0.01,
        '\u0000'.repeat(65535) + 'é'));
    const fixture = fixtureFor(records);
    const batches = await scanAll(fixture);
    assert.deepEqual(batches.map(value => value.rows.length), [5, 2]);
    assert.deepEqual(batches.map(value => value.diagnostics.consumedCandidates), [5, 2]);
    assert.deepEqual(batches.map(value => value.diagnostics.candidates), [6, 2]);
    assert.deepEqual(batches.map(value => value.diagnostics.geometryWork), [24, 8]);
    assert.deepEqual([batches[0].nextCursor.tile, batches[0].nextCursor.row], [2, 1]);
    assert.deepEqual(rowsByOrdinal(batches), oracle(records, polygon));
});

test('wholeSerializedEnvelopeFitsTwoMiBWithoutDroppingConsumedRows', async () => {
    const records = tiledRecords(7, '\u0000'.repeat(65536));
    const least = Buffer.byteLength(JSON.stringify(oracle(records.slice(2), polygon)));
    const firstFive = records.slice(2);
    const target = responseBytes - envelopeReserve;
    // Add multibyte and ASCII characters to exactly fill the row-array allowance.
    firstFive[0][4] = 'é'.repeat(Math.floor((target - least + 'Fictional Address'.length) / 2))
        + 'a'.repeat((target - least + 'Fictional Address'.length) % 2);
    const fixture = fixtureFor([...records.slice(0, 2), ...firstFive], {
        etag: '\ud800'.repeat(256),
        preparedAt: '-271821-04-20T00:00:00.000Z',
        alter: artifact => {
            for (const key of ['label', 'preparationEvidence', 'source', 'coverage']) artifact.manifest.snapshot[key] = '\u0000'.repeat(1000);
            reseal(artifact);
        },
    });
    const batches = await scanAll(fixture);
    const first = batches[0];
    assert.equal(first.rows.length, 5);
    assert.equal(first.diagnostics.consumedCandidates, 5);
    const rowBytes = Buffer.byteLength(JSON.stringify(first.rows));
    assert.equal(rowBytes, target);
    assert.ok(first.responseBytes - rowBytes <= envelopeReserve);
    assert.ok(first.responseBytes >= responseBytes - 8192);
    assert.deepEqual(rowsByOrdinal(batches), oracle(records, polygon));
});

test('actual app authorizes the exact scan route before its bounded private parser', async () => {
    const fixture = routeFixture({ fullApp: true });
    const databaseCalls = [];
    Object.defineProperty(fixture.env, 'DATABASE_URL', { get() { databaseCalls.push('database'); throw Error('Unexpected database/job path'); } });
    let clones = 0;
    const cloneSpy = () => clones++;
    const denied = [
        [{}, 401], [{ token: 'invalid-fictional-token' }, 403],
        [{ actor: { ...actor, role: 'guest' } }, 403],
        [{ actor, cookie: true, headers: { Origin: 'https://untrusted.example' } }, 403],
    ];
    for (const [options, expected] of denied) {
        const response = await fixture.request(scanPath, { ...options, rawBody: '{', cloneSpy });
        assert.equal(response.status, expected);
        assertPrivateHeaders(assert, response);
    }
    const malformed = await fixture.request(scanPath, { actor, rawBody: '{', cloneSpy });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, 'ADDRESS_SNAPSHOT_INVALID_QUERY');
    assert.equal(clones, 0);
    const tooLarge = new Uint8Array(ADDRESS_SNAPSHOT_MAX_BODY_BYTES + 65536).fill(32);
    let cancelled = false, offset = 0;
    const rawBody = new ReadableStream({
        pull(controller) {
            controller.enqueue(tooLarge.subarray(offset, offset + 32768));
            offset += 32768;
            if (offset >= tooLarge.length) controller.close();
        },
        cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const over = await fixture.request(scanPath, { actor, rawBody, headers: { 'Content-Length': '1' }, cloneSpy });
    assert.equal(over.status, 413);
    assert.equal((await over.json()).code, 'ADDRESS_SNAPSHOT_BODY_TOO_LARGE');
    assert.ok(cancelled);
    assertPrivateHeaders(assert, over);
    assert.equal(clones, 0);
    for (const [path, method] of [[scanPath + '/', 'POST'], [scanPath + '/extra', 'POST'], [scanPath, 'PUT']]) {
        const sibling = await fixture.request(path, { actor, method, rawBody: '{', headers: { 'Content-Length': '1' }, cloneSpy });
        assert.equal(sibling.status, 400);
        assert.match((await sibling.json()).error, /valid JSON/);
    }
    assert.equal(clones, 3);
    assert.equal(fixture.bucket.calls.length, 0);
    const exact = JSON.stringify({ ...query(), snapshotSha256: ADDRESS_SNAPSHOT_CONFIG.sourceSha256 });
    const admitted = await fixture.request(scanPath, { actor, cookie: true, cloneSpy,
        rawBody: exact + ' '.repeat(ADDRESS_SNAPSHOT_MAX_BODY_BYTES - Buffer.byteLength(exact)) });
    assert.equal(admitted.status, 503, 'a valid body at the exact cap reaches the empty synthetic store');
    assert.equal((await admitted.json()).code, 'ADDRESS_SNAPSHOT_UNAVAILABLE');
    assertPrivateHeaders(assert, admitted);
    assert.equal(clones, 3);
    assert.equal(fixture.bucket.calls.length, 1);
    assert.equal(fixture.bucket.writes.length, 0);
    assert.deepEqual(databaseCalls, []);
});

test('cursor fields, identities and canonical positions are verified before continuing', async () => {
    const fixture = fixtureFor([address(0), address(1), address(2, 1.391, 103.75)], { limits: { maxCandidateRows: 1 } });
    const first = await batch(fixture, query());
    const cursor = first.nextCursor;
    assert.deepEqual(Object.keys(cursor).sort(), ['schemaVersion', 'snapshotSha256', 'manifestSha256',
        'manifestEtag', 'areaSha256', 'tile', 'row'].sort());
    const invalid = [
        { ...query(), cursor: undefined }, { ...query(), extra: 1 }, { ...query(), snapshotSha256: 'A'.repeat(64) },
        query({ ...polygon, extra: true }), query({ type: 'Polygon', coordinates: [rectangle(103.69, 1.29, 103.923, 1.47)] }, cursor),
        ...[
            { extra: true }, { schemaVersion: 2 }, { manifestSha256: 'x' }, { snapshotSha256: 'A'.repeat(64) },
            { areaSha256: 'b'.repeat(64) }, { manifestEtag: '' }, { manifestEtag: 'e'.repeat(257) },
            { manifestEtag: 'one\u0085two' }, { tile: -1 }, { tile: 0.5 }, { tile: 2 ** 53 },
            { row: '1' }, { row: 2 }, { row: 1, tile: 2 }, { tile: 3, row: 0 },
        ].map(extra => query(polygon, { ...cursor, ...extra })),
    ];
    for (const input of invalid) {
        const before = fixture.bucket.calls.length;
        const result = await step(fixture, input);
        assert.equal(result.status, 400, JSON.stringify(input));
        assert.equal(result.body.code, 'ADDRESS_SNAPSHOT_INVALID_QUERY');
        assert.ok(fixture.bucket.calls.length - before <= 1);
    }
    for (const input of [
        { ...query(), snapshotSha256: 'b'.repeat(64) },
        query(polygon, { ...cursor, snapshotSha256: 'b'.repeat(64) }),
        query(polygon, { ...cursor, manifestSha256: 'b'.repeat(64) }),
    ]) {
        const before = fixture.bucket.calls.length;
        const result = await step(fixture, input);
        assert.equal(result.status, 409);
        assert.equal(result.body.code, 'ADDRESS_SNAPSHOT_CHANGED');
        assert.equal(fixture.bucket.calls.length, before);
    }
    const terminal = await batch(fixture, query(polygon, { ...cursor, tile: 2, row: 0 }));
    assert.equal(terminal.done, true);
    assert.deepEqual(terminal.rows, []);
});

test('a replaced manifest requires restart while corruption under the accepted ETag fails closed', async () => {
    const fixture = fixtureFor([address(0), address(1)], { limits: { maxCandidateRows: 1 } });
    const { nextCursor } = await batch(fixture, query());
    const storedManifest = fixture.bucket.objects.get(fixture.manifestKey);
    storedManifest.bytes[0] ^= 1;
    const sameEtag = await step(fixture, query(polygon, nextCursor));
    assert.equal(sameEtag.status, 503);
    assert.equal(sameEtag.body.code, 'ADDRESS_SNAPSHOT_UNAVAILABLE');

    storedManifest.etag = 'different-fictional-etag';
    const bytesBefore = fixture.bucket.deliveredBytes;
    const replacement = await step(fixture, query(polygon, nextCursor));
    assert.equal(replacement.status, 409);
    assert.equal(replacement.body.code, 'ADDRESS_SNAPSHOT_CHANGED');
    assert.equal(fixture.bucket.cancelled.at(-1), fixture.manifestKey);
    assert.equal(fixture.bucket.deliveredBytes, bytesBefore, 'the replaced manifest body was not read');
    assert.equal(Object.hasOwn(replacement.body, 'rows'), false);

    const restart = await step(fixture, query());
    assert.equal(restart.status, 503, 'restarting still verifies the configured manifest bytes');
    assert.equal(restart.body.code, 'ADDRESS_SNAPSHOT_UNAVAILABLE');
    storedManifest.bytes[0] ^= 1;
    const ready = await batch(fixture, query());
    assert.equal(ready.scan.manifestEtag, storedManifest.etag);
});

test('abort stops subsequent bounded reads and a failed pair settles its started companion', async () => {
    const aborted = fixtureFor(tiledRecords(3), { limits: { maxConcurrentReads: 1 } });
    const controller = new AbortController();
    controller.abort();
    assert.equal((await step(aborted, query(), { signal: controller.signal })).status, 503);
    assert.deepEqual(aborted.bucket.calls, []);

    const during = new AbortController(), first = aborted.artifact.manifest.tiles[0];
    aborted.bucket.beforeGet = key => { if (key === first.index.key) during.abort(); };
    assert.equal((await step(aborted, query(), { signal: during.signal })).status, 503);
    assert.deepEqual(aborted.bucket.calls, [aborted.manifestKey, first.index.key]);
    assert.equal(aborted.bucket.activeReads, 0);

    const parallel = fixtureFor(tiledRecords(3));
    const duringPairStart = new AbortController();
    const firstParallel = parallel.artifact.manifest.tiles[0];
    parallel.bucket.beforeGet = key => { if (key === firstParallel.index.key) duringPairStart.abort(); };
    assert.equal((await step(parallel, query(), { signal: duringPairStart.signal })).status, 503);
    assert.deepEqual(parallel.bucket.calls, [parallel.manifestKey, firstParallel.index.key]);

    const faulty = fixtureFor(tiledRecords(3));
    const firstFaulty = faulty.artifact.manifest.tiles[0];
    let companionSettled = false;
    faulty.bucket.beforeGet = async key => {
        if (key === firstFaulty.index.key) throw Error('Private provider detail');
        if (key === firstFaulty.rows.key) {
            await new Promise(resolve => setImmediate(resolve));
            companionSettled = true;
        }
    };
    const result = await step(faulty);
    assert.equal(result.status, 503);
    assert.doesNotMatch(JSON.stringify(result.body), /Private provider detail/);
    assert.ok(companionSettled);
    assert.equal(faulty.bucket.activeReads, 0);
    assert.deepEqual(faulty.bucket.calls, [faulty.manifestKey, firstFaulty.index.key, firstFaulty.rows.key]);
});

test('verified pack corruption and duplicate ids or ordinals fail closed', async () => {
    for (const issue of ['hash', 'mime', 'missing', 'invalid-etag', 'short-pack', 'bad-row', 'bad-coordinate',
        'duplicate-id', 'duplicate-ordinal', 'cross-tile-duplicate-id', 'cross-tile-duplicate-ordinal']) {
        const fixture = fixtureFor([address(0), address(1), address(2, 1.391, 103.75)], {
            alter: artifact => {
                const [first, second] = artifact.manifest.tiles;
                const crossTile = issue.startsWith('cross-tile');
                const tile = crossTile ? second : first;
                if (issue.includes('ordinal') || issue === 'bad-coordinate') {
                    const bytes = Buffer.from(artifact.objects.get(tile.index.key).bytes);
                    if (issue === 'bad-coordinate') bytes.writeDoubleLE(999, 0);
                    else bytes.writeUInt32LE(0, crossTile ? 16 : 36);
                    reseal(artifact, tile, 'index', bytes);
                } else if (['short-pack', 'bad-row'].includes(issue) || issue.includes('duplicate-id')) {
                    const rows = JSON.parse(artifact.objects.get(tile.rows.key).bytes);
                    if (issue === 'short-pack') rows.pop();
                    else if (issue === 'bad-row') rows[1][1] = 'not-a-postal';
                    else if (crossTile) rows[0][0] = JSON.parse(artifact.objects.get(first.rows.key).bytes)[0][0];
                    else rows[1][0] = rows[0][0];
                    reseal(artifact, tile, 'rows', Buffer.from(JSON.stringify(rows)));
                }
            },
        });
        const key = fixture.artifact.manifest.tiles[0].rows.key;
        if (issue === 'missing') fixture.bucket.objects.delete(key);
        if (issue === 'hash') fixture.bucket.objects.get(key).bytes[0] ^= 1;
        if (issue === 'mime') fixture.bucket.objects.get(key).contentType = 'text/plain';
        if (issue === 'invalid-etag') fixture.bucket.objects.get(fixture.manifestKey).etag = 'x'.repeat(257);
        const result = await step(fixture);
        assert.equal(result.status, 503, issue);
        assert.deepEqual(result.body, { error: 'Address search is temporarily unavailable. Try again later.',
            code: 'ADDRESS_SNAPSHOT_UNAVAILABLE', ready: false });
    }
});

test('the HTTP handler counts the exact serialized response and rejects an unexpected envelope overflow', async () => {
    const verified = await batch(fixtureFor([address(0)]), query());
    const { responseBytes: measured, ...body } = verified;
    assert.equal(measured, Buffer.byteLength(JSON.stringify(body)));
    // Inject a much larger envelope than the verified repository allows to exercise the final hard guard.
    const snapshot = { ...body.snapshot, coverage: '' };
    const value = { ...body, snapshot };
    const padding = responseBytes - Buffer.byteLength(JSON.stringify(value));
    snapshot.coverage = 'é'.repeat(Math.floor(padding / 2)) + 'a'.repeat(padding % 2);
    const fixture = routeFixture({ scanRepository: { scan: async () => value } });
    const exact = await fixture.request(scanPath, { actor, body: query() });
    assert.equal(exact.status, 200);
    assert.equal(Buffer.byteLength(await exact.text()), responseBytes);

    snapshot.coverage += 'a';
    const overflow = await fixture.request(scanPath, { actor, body: query() });
    assert.equal(overflow.status, 503);
    assert.deepEqual(await overflow.json(), { error: 'Address search is temporarily unavailable. Try again later.',
        code: 'ADDRESS_SNAPSHOT_UNAVAILABLE', ready: false });
    assertPrivateHeaders(assert, overflow);
});

test('the repository owns the original geometry through asynchronous verification', async () => {
    const fixture = fixtureFor([address(0, 1.3800012345678, 103.7500012345678)]);
    const repository = createAddressSnapshotScanRepository(fixture.bucket, { config: fixture.config });
    const requested = structuredClone(polygon);
    const before = JSON.stringify(normalizeSpatialArea(requested));
    const response = repository.scan(query(requested));
    requested.coordinates[0][1][0] = 103.71;
    const result = await response;
    assert.equal(result.scan.areaSha256, sha256(before));
    assert.deepEqual(result.rows, oracle(fixture.records, polygon));
});

test('shared validation rejects unpinned, nonadvancing and internally inconsistent batches', async () => {
    const fixture = fixtureFor([address(0), address(1), address(2)], { limits: { maxCandidateRows: 1 } });
    const result = await batch(fixture, query());
    const { responseBytes: _measured, ...value } = result;
    const context = { cursor: null, snapshotSha256: TEST_SNAPSHOT_SHA, areaSha256: result.scan.areaSha256 };
    assert.ok(isAddressSnapshotScanResponse(value, context));
    assert.equal(isAddressSnapshotScanResponse(value, { ...context, cursor: value.nextCursor }), false);
    assert.equal(isAddressSnapshotScanResponse(value, { ...context, areaSha256: 'b'.repeat(64) }), false);
    const changes = [
        { snapshot: { ...value.snapshot, recordCount: 0xffffffff + 1 } },
        { done: true },
        { progress: { ...value.progress, tilesCompleted: 1 } },
        { nextCursor: { ...value.nextCursor, row: 0 } },
        { nextCursor: { ...value.nextCursor, manifestEtag: 'other' } },
        { rows: [{ ...value.rows[0], ordinal: fixture.records.length }] },
        { rows: [{ ...value.rows[0], internal: true }] },
        { diagnostics: { ...value.diagnostics, consumedCandidates: 0 } },
        { diagnostics: { ...value.diagnostics, candidates: 2 } },
        { diagnostics: { ...value.diagnostics, bytes: 4 * MiB + 1 } },
    ];
    for (const change of changes) assert.equal(isAddressSnapshotScanResponse({ ...value, ...change }, context), false);
});

test('shared validation binds same-tile row movement to consumed positions', async () => {
    const fixture = fixtureFor([address(0), address(1), address(2), address(3)], { limits: { maxCandidateRows: 1 } });
    const { responseBytes: _initialBytes, ...initial } = await batch(fixture, query());
    assert.equal(isAddressSnapshotScanResponse({ ...initial, nextCursor: { ...initial.nextCursor, row: 2 } }, { cursor: null }), false);

    const cursor = initial.nextCursor;
    const { responseBytes: _continuedBytes, ...continued } = await batch(fixture, query(polygon, cursor));
    assert.equal(isAddressSnapshotScanResponse({ ...continued, nextCursor: { ...continued.nextCursor, row: 3 } }, { cursor }), false);
});

test('shared validation requires enough consumed positions to complete tiles and reach the destination row', async () => {
    const fixture = fixtureFor([
        address(0, 1.301), address(1, 1.311), address(2, 1.311), address(3, 1.321),
    ], { limits: { maxCandidateRows: 1 } });
    const { responseBytes: _measured, ...first } = await batch(fixture, query());
    assert.deepEqual([first.nextCursor.tile, first.nextCursor.row], [1, 0]);
    assert.equal(isAddressSnapshotScanResponse({ ...first, nextCursor: { ...first.nextCursor, row: 1 } }, { cursor: null }), false);
    assert.equal(isAddressSnapshotScanResponse({
        ...first,
        progress: { ...first.progress, tilesCompleted: 2 },
        nextCursor: { ...first.nextCursor, tile: 2 },
    }, { cursor: null }), false);
    assert.equal(isAddressSnapshotScanResponse({
        ...first,
        done: true,
        nextCursor: null,
        progress: { ...first.progress, tilesCompleted: first.progress.tilesTotal },
    }, { cursor: null }), false);
});

test('shared validation accepts zero consumed positions at the terminal bookmark', async () => {
    const fixture = fixtureFor([address(0), address(1)], { limits: { maxCandidateRows: 1 } });
    const first = await batch(fixture, query());
    const cursor = { ...first.nextCursor, tile: first.scan.tilesTotal, row: 0 };
    const { responseBytes: _measured, ...terminal } = await batch(fixture, query(polygon, cursor));
    assert.equal(terminal.diagnostics.consumedCandidates, 0);
    assert.equal(isAddressSnapshotScanResponse({
        ...terminal,
        diagnostics: { ...terminal.diagnostics, consumedCandidates: 1, candidates: 1, geometryWork: 4 },
    }, { cursor }), false);
});
