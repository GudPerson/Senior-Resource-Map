import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { compileAddressSnapshotRecords } from '../../scripts/build-address-snapshot.mjs';
import { createAddressSnapshotRepository } from '../src/utils/addressSnapshotRepository.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = 'a'.repeat(64), center = [1.38, 103.75];
const circle = { type: 'circle', center, radiusMeters: 100 };
const records = Array.from({ length: 233 }, (_, i) => [i < 2 ? '012345' : String(100000 + i), String(i + 1), 'Fictional Road',
    i === 0 ? '=1+1' : `Block ${i}`, `Fictional address ${i}`, String(1.3799 + i % 15 * .00001), String(103.7499 + Math.floor(i / 15) * .00001)]);
records.push(['999999', '99', 'Far Road', 'Far', 'Far', '1.4', '103.77']);
function fixture() { return compileAddressSnapshotRecords(records, { sourceSha256: pin, preparedAt: '2026-11-03T00:00:00.000Z', prefix: `address-snapshot/v1/${pin}-r1` }); }
function resign(data) {
    let total = 0;
    for (const tile of data.manifest.tiles) for (const kind of ['index', 'rows']) {
        const object = data.objects.get(tile[kind].key); tile[kind].bytes = object.bytes.length; tile[kind].sha256 = hash(object.bytes); total += object.bytes.length;
    }
    const key = `${data.config.prefix}/manifest.json`, bytes = Buffer.from(JSON.stringify(data.manifest));
    data.objects.set(key, { bytes, contentType: 'application/json', sha256: hash(bytes) });
    data.config = { ...data.config, manifestBytes: bytes.length, manifestSha256: hash(bytes), totalBytes: total + bytes.length };
}
function fakeBucket(data, alter = value => value) {
    const reads = []; let active = 0, peak = 0, cancelled = 0;
    return { reads, get peak() { return peak; }, get cancelled() { return cancelled; },
        async get(key) {
            reads.push(key); const original = data.objects.get(key); if (!original) return null;
            const value = alter({ ...original, bytes: Buffer.from(original.bytes) }, key);
            if (!value) return null;
            active++; peak = Math.max(peak, active); let offset = 0, finished = false;
            const done = () => { if (!finished) { finished = true; active--; } };
            return { size: value.size ?? value.bytes.length, httpMetadata: { contentType: value.contentType },
                body: new ReadableStream({ async pull(controller) {
                    await Promise.resolve();
                    if (offset >= value.bytes.length) { controller.close(); done(); return; }
                    const next = Math.min(value.bytes.length, offset + 127); controller.enqueue(new Uint8Array(value.bytes.subarray(offset, next))); offset = next;
                }, cancel() { cancelled++; done(); } }) };
        }, put() { assert.fail('Repository must never write'); }, list() { assert.fail('Repository must never list'); }, delete() { assert.fail('Repository must never delete'); } };
}
const areaInput = extra => ({ area: circle, snapshotSha256: pin, ...extra });

test('exact total, original-ID/source order and all pages preserve same-postal rows; nearby uses geographic order', async () => {
    const data = fixture(), bucket = fakeBucket(data), repo = createAddressSnapshotRepository(bucket, { config: data.config });
    const metadata = await repo.metadata(); assert.equal(metadata.ready, true); assert.equal(metadata.snapshot.recordCount, 234);
    const first = await repo.area(areaInput({ limit: 200 })), second = await repo.area(areaInput({ offset: 200, limit: 200 }));
    assert.equal(first.total, 233); assert.equal(first.truncated, true); assert.equal(second.rows.length, 33); assert.equal(second.truncated, false);
    assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 233);
    assert.equal(first.rows[0].postalCode, '012345'); assert.equal(first.rows[1].postalCode, '012345');
    assert.equal(first.rows[0].building, '=1+1'); assert.equal(first.rows[0].address, records[0][4]);
    assert.equal(first.rows[0].id, `address_${hash(JSON.stringify(records[0]))}_1`);
    const near = await repo.nearby({ lat: center[0], lng: center[1], snapshotSha256: pin, limit: 10 });
    assert.equal(near.total, 233); assert.equal(near.rows.length, 10);
    assert.ok(near.rows.every((row, i) => i === 0 || row.distanceMeters >= near.rows[i - 1].distanceMeters));
    assert.ok(bucket.peak <= 4);
    metadata.snapshot.sha256 = 'b'.repeat(64); assert.equal((await repo.metadata()).snapshot.sha256, pin);
});

test('all invalid bodies and missing/wrong snapshot pins fail before any storage read', async () => {
    const data = fixture(), bucket = fakeBucket(data), repo = createAddressSnapshotRepository(bucket, { config: data.config });
    for (const input of [null, {}, areaInput({ snapshotSha256: undefined }), areaInput({ offset: -1 }), areaInput({ limit: 1001 }), areaInput({ offset: .5 }),
        areaInput({ extra: 1 }), areaInput({ area: { type: 'Polygon', coordinates: [[[103, 1], [104, 1], [105, 1], [103, 1]]] } })]) {
        await assert.rejects(repo.area(input), error => error.status === 400 && error.code === 'ADDRESS_SNAPSHOT_INVALID_QUERY');
    }
    await assert.rejects(repo.area(areaInput({ snapshotSha256: 'b'.repeat(64) })), error => error.status === 409);
    await assert.rejects(repo.nearby({ lat: '1.38', lng: 103.75, snapshotSha256: pin }), error => error.status === 400);
    await assert.rejects(repo.nearby({ lat: 1.38, lng: 103.75, radiusMeters: 1001, snapshotSha256: pin }), error => error.status === 400);
    assert.equal(bucket.reads.length, 0);
});

test('resource admission reserves every intersected row pack and rejects oversized work before any shard reads', async () => {
    for (const override of [{ maxAreaTiles: 1 }, { maxCandidateRows: 1 }, { maxReservedBytes: 20000 }, { maxGeometryWork: 1 }, { maxR2Reads: 2 }]) {
        const data = fixture(), bucket = fakeBucket(data), config = { ...data.config, limits: { ...data.config.limits, ...override } };
        await assert.rejects(createAddressSnapshotRepository(bucket, { config }).area(areaInput()), error => error.status === 422);
        assert.deepEqual(bucket.reads, [`${data.config.prefix}/manifest.json`]);
    }
});

test('missing storage, object hash/type/size mismatch, truncated or oversized streams fail closed and cancel readers', async () => {
    await assert.rejects(createAddressSnapshotRepository(null).metadata(), error => error.status === 503);
    for (const mode of ['missing', 'hash', 'type', 'header-size', 'stream-short', 'stream-long']) {
        const data = fixture(), key = `${data.config.prefix}/manifest.json`;
        const bucket = fakeBucket(data, (value, path) => {
            if (path !== key) return value;
            if (mode === 'missing') return null;
            if (mode === 'hash') value.bytes[0] ^= 1;
            if (mode === 'type') value.contentType = 'text/plain';
            if (mode === 'header-size') value.size = value.bytes.length + 1;
            if (mode === 'stream-short') { value.size = value.bytes.length; value.bytes = value.bytes.subarray(0, -1); }
            if (mode === 'stream-long') { value.size = value.bytes.length; value.bytes = Buffer.concat([value.bytes, Buffer.from('extra')]); }
            return value;
        });
        await assert.rejects(createAddressSnapshotRepository(bucket, { config: data.config }).metadata(), error => error.status === 503 && error.code === 'ADDRESS_SNAPSHOT_UNAVAILABLE');
        if (['type', 'header-size', 'stream-long'].includes(mode)) assert.ok(bucket.cancelled > 0);
    }
});

test('even re-signed malformed manifests cannot request arbitrary keys or falsify counts/layout/bounds', async () => {
    for (const mode of ['key', 'count', 'bounds', 'layout']) {
        const data = fixture();
        if (mode === 'key') data.manifest.tiles[0].rows.key = 'other-private-prefix/secret';
        if (mode === 'count') data.manifest.snapshot.recordCount++;
        if (mode === 'bounds') data.manifest.tiles[0].bounds.south = NaN;
        if (mode === 'layout') data.manifest.layout.indexRecordBytes = 16;
        if (mode !== 'key') resign(data);
        else { const bytes = Buffer.from(JSON.stringify(data.manifest)); data.objects.set(`${data.config.prefix}/manifest.json`, { bytes, contentType: 'application/json' }); data.config = { ...data.config, manifestBytes: bytes.length, manifestSha256: hash(bytes) }; }
        const bucket = fakeBucket(data);
        await assert.rejects(createAddressSnapshotRepository(bucket, { config: data.config }).area(areaInput()), error => error.status === 503);
        assert.equal(bucket.reads.length, 1);
    }
});

test('re-signed corrupt coordinate indices and address packs reject rather than returning missing/wrong rows', async () => {
    for (const mode of ['NaN', 'ordinal-range', 'ordinal-duplicate', 'row-count', 'postal-number', 'duplicate-id']) {
        const data = fixture(), tile = data.manifest.tiles.find(t => t.count > 2);
        const index = data.objects.get(tile.index.key), pack = data.objects.get(tile.rows.key);
        if (mode === 'NaN') index.bytes.writeDoubleLE(NaN, 0);
        if (mode === 'ordinal-range') index.bytes.writeUInt32LE(data.config.recordCount, 16);
        if (mode === 'ordinal-duplicate') index.bytes.writeUInt32LE(index.bytes.readUInt32LE(16), 36);
        if (['row-count', 'postal-number', 'duplicate-id'].includes(mode)) {
            const rows = JSON.parse(pack.bytes);
            if (mode === 'row-count') rows.pop();
            if (mode === 'postal-number') rows[0][1] = 12345;
            if (mode === 'duplicate-id') rows[1][0] = rows[0][0];
            pack.bytes = Buffer.from(JSON.stringify(rows));
        }
        resign(data);
        await assert.rejects(createAddressSnapshotRepository(fakeBucket(data), { config: data.config }).area(areaInput()), error => error.status === 503);
    }
});

test('hole interiors stay excluded and multipart islands form a union', async () => {
    const data = fixture(), repo = createAddressSnapshotRepository(fakeBucket(data), { config: data.config });
    const outer = [[103.749, 1.379], [103.751, 1.379], [103.751, 1.381], [103.749, 1.381], [103.749, 1.379]];
    const hole = [[103.7498, 1.3798], [103.7502, 1.3798], [103.7502, 1.3802], [103.7498, 1.3802], [103.7498, 1.3798]];
    const island = [[103.769, 1.399], [103.771, 1.399], [103.771, 1.401], [103.769, 1.401], [103.769, 1.399]];
    const result = await repo.area(areaInput({ area: { type: 'MultiPolygon', coordinates: [[outer, hole], [island]] } }));
    assert.equal(result.total, 1); assert.equal(result.rows[0].postalCode, '999999');
});


test('250000 geometry-work boundary is admitted and one more edge is denied before coordinate reads', async () => {
    const compact = Array.from({ length: 100 }, (_, i) => ['012345', String(i), 'A', 'B', 'C', String(1.381 + i * .0000001), '103.751']);
    const data = compileAddressSnapshotRecords(compact, { sourceSha256: pin, preparedAt: '2026-11-03T00:00:00.000Z', prefix: `address-snapshot/v1/${pin}-r1` });
    const polygon = count => ({ type: 'Polygon', coordinates: [Array.from({ length: count + 1 }, (_, i) => {
        const angle = i % count * 2 * Math.PI / count;
        return [103.751 + Math.cos(angle) * .001, 1.381 + Math.sin(angle) * .001];
    })] });
    const admittedBucket = fakeBucket(data);
    const admitted = await createAddressSnapshotRepository(admittedBucket, { config: data.config }).area(areaInput({ area: polygon(2500) }));
    assert.equal(admitted.total, 100);
    const rejectedBucket = fakeBucket(data);
    await assert.rejects(createAddressSnapshotRepository(rejectedBucket, { config: data.config }).area(areaInput({ area: polygon(2501) })), error => error.status === 422);
    assert.equal(rejectedBucket.reads.length, 1);
});
