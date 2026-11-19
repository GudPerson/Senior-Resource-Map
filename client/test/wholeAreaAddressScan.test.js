import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { AddressSnapshotError } from '../src/lib/addressSnapshotClient.js';
import { createWholeAreaAddressScan } from '../src/lib/wholeAreaAddressScan.js';

const sha = 'a'.repeat(64);
const manifestSha256 = 'b'.repeat(64);
const manifestEtag = '"verified"';
const area = { type: 'circle', center: [1.3, 103.8], radiusMeters: 100 };
const areaSha256 = createHash('sha256').update(JSON.stringify(area)).digest('hex');
const snapshot = {
    label: 'Fixture snapshot', coverage: 'Incomplete', preparedAt: '2026-01-01T00:00:00.000Z', source: 'Fixture',
    preparationEvidence: 'Fixture evidence', sha256: sha, recordCount: 12, postalCodeCount: 1,
};

const row = (ordinal, overrides = {}) => ({
    id: `address_${ordinal.toString(16).padStart(64, '0')}_1`, postalCode: '012345', block: '123',
    roadName: 'Fixture Road', building: '', address: '123 Fixture Road', lat: 1.3, lng: 103.8, ordinal, ...overrides,
});
const cursorAt = (tile, position = 0) => ({
    schemaVersion: 1, snapshotSha256: sha, manifestSha256, manifestEtag, areaSha256, tile, row: position,
});

function batch({ cursor = null, tilesTotal = 1, rows = [], consumedCandidates = rows.length,
    candidates = consumedCandidates, recordCount = 12, snapshotSha256 = sha, hash = areaSha256 } = {}) {
    return {
        schemaVersion: 1, snapshot: { ...snapshot, sha256: snapshotSha256, recordCount },
        scan: { areaSha256: hash, manifestSha256, manifestEtag, tilesTotal, batchCandidateLimit: 512 },
        rows, nextCursor: cursor, done: cursor === null,
        progress: { tilesCompleted: cursor?.tile ?? tilesTotal, tilesTotal },
        diagnostics: { reads: 3, bytes: 200, consumedCandidates, candidates, geometryWork: candidates },
    };
}

function setup(steps, { metadata = () => ({ ready: true, snapshot }) } = {}) {
    const calls = [], metadataCalls = [];
    const scan = createWholeAreaAddressScan({
        getMetadata: async request => { metadataCalls.push(request); return metadata(); },
        scanBatch: async request => {
            const next = steps[calls.length];
            calls.push(request);
            if (next instanceof Error) throw next;
            return typeof next === 'function' ? next(request) : next;
        },
    });
    return { scan, calls, metadataCalls };
}

function assertPending(scan, status) {
    const value = scan.getSnapshot();
    assert.equal(value.status, status);
    assert.equal(value.total, null);
    assert.equal(value.completedRows, null);
    assert.equal(value.snapshot, null);
}

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

test('three sequential steps keep rows private through empty intermediate progress and sort by ordinal at completion', async () => {
    const finalResponse = deferred(), reachedFinal = deferred();
    const first = cursorAt(1), second = cursorAt(2);
    const matches = [row(7), row(5), row(2)];
    const { scan, calls, metadataCalls } = setup([
        batch({ cursor: first, tilesTotal: 3, rows: matches.slice(0, 2) }),
        batch({ cursor: second, tilesTotal: 3, consumedCandidates: 1 }),
        () => { reachedFinal.resolve(); return finalResponse.promise; },
    ]);
    const updates = [];
    const unsubscribe = scan.subscribe(() => updates.push(scan.getSnapshot()));
    const running = scan.start(area);
    await reachedFinal.promise;
    assertPending(scan, 'scanning');
    assert.deepEqual(scan.getSnapshot().progress, { tilesCompleted: 2, tilesTotal: 3 });
    assert.equal(scan.getSnapshot(), scan.getSnapshot(), 'snapshot remains stable between state changes');
    await scan.start(area);
    await scan.resume();
    assert.equal(calls.length, 3, 'repeated start and resume cannot enqueue another request');

    finalResponse.resolve(batch({ tilesTotal: 3, rows: matches.slice(2) }));
    await running;
    assert.deepEqual(calls.map(({ cursor }) => cursor), [null, first, second]);
    assert.equal(metadataCalls.length, 1);
    assert.ok(calls.every(request => request.snapshotSha256 === sha && request.signal === metadataCalls[0].signal));
    assert.deepEqual(scan.getSnapshot().completedRows, [matches[2], matches[1], matches[0]]);
    assert.equal(scan.getSnapshot().total, 3, 'distinct IDs sharing a postal code remain distinct');
    assert.equal(scan.getSnapshot().status, 'ready');
    assert.deepEqual(scan.getSnapshot().snapshot, snapshot, 'ready results retain the dated snapshot notice');
    assert.equal(updates.filter(value => value.status === 'ready').length, 1);
    assert.ok(updates.filter(value => value.status !== 'ready').every(value => value.completedRows === null && value.total === null));
    unsubscribe();
    scan.reset();
    assertPending(scan, 'idle');
    assert.equal(updates.at(-1).status, 'ready');
});

test('an empty completed scan exposes the exact total zero', async () => {
    const { scan } = setup([batch({ tilesTotal: 0 })]);
    await scan.start(area);
    assert.deepEqual(scan.getSnapshot(), {
        status: 'ready', progress: { tilesCompleted: 0, tilesTotal: 0 }, completedRows: [], total: 0, error: null, snapshot,
    });
});

test('start owns a frozen copy of the exact normalized multipart geometry before async metadata resolves', async () => {
    const metadata = deferred();
    const polygon = [[103.8, 1.3], [103.81, 1.3], [103.81, 1.31], [103.8, 1.3]];
    const original = { type: 'MultiPolygon', coordinates: [[polygon]], ignoredUiField: true };
    const normalized = { type: original.type, coordinates: structuredClone(original.coordinates) };
    const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const { scan, calls } = setup([batch({ tilesTotal: 0, hash })], { metadata: () => metadata.promise });
    const running = scan.start(original);
    polygon[1][0] = 103.9;
    metadata.resolve({ snapshot });
    await running;
    assert.equal(scan.getSnapshot().status, 'ready');
    assert.deepEqual(calls[0].area, normalized);
    assert.ok(Object.isFrozen(calls[0].area.coordinates[0][0][0]));
});

test('identical rows replayed with reordered fields are harmless', async () => {
    const match = row(1);
    const { scan } = setup([
        batch({ cursor: cursorAt(1), tilesTotal: 2, rows: [match] }),
        batch({ tilesTotal: 2, rows: [Object.fromEntries(Object.entries(match).reverse())] }),
    ]);
    await scan.start(area);
    assert.deepEqual(scan.getSnapshot().completedRows, [match]);
    assert.equal(scan.getSnapshot().total, 1);
});

for (const [description, different] of [
    ['same ID and changed ordinal', row(3, { id: row(1).id })],
    ['same ID and changed payload', row(1, { address: 'Different address' })],
    ['same ordinal and another ID', row(1, { id: row(3).id })],
]) {
    test(`rejects conflicting replay with ${description} without accepting any rows from the rejected step`, async () => {
        const confirmed = cursorAt(1), initial = row(1), acceptedAfterRetry = row(2);
        const { scan, calls } = setup([
            batch({ cursor: confirmed, tilesTotal: 2, rows: [initial] }),
            batch({ tilesTotal: 2, rows: [row(4), different] }),
            batch({ tilesTotal: 2, rows: [acceptedAfterRetry] }),
        ]);
        await scan.start(area);
        assertPending(scan, 'error');
        assert.equal(scan.getSnapshot().progress.tilesCompleted, 1);
        await scan.resume();
        assert.equal(calls[2].cursor, calls[1].cursor, 'Retry uses the exact last accepted bookmark');
        assert.deepEqual(scan.getSnapshot().completedRows, [initial, acceptedAfterRetry]);
    });
}

test('duplicate ordinals inside one batch are validated before any rows are accepted', async () => {
    const { scan, calls } = setup([
        batch({ rows: [row(1), row(1, { id: row(3).id })] }),
        batch({ rows: [row(2)] }),
    ]);
    await scan.start(area);
    assertPending(scan, 'error');
    assert.equal(scan.getSnapshot().progress, null);
    await scan.resume();
    assert.deepEqual(calls.map(request => request.cursor), [null, null]);
    assert.deepEqual(scan.getSnapshot().completedRows, [row(2)]);
});

for (const count of [undefined, 0, -1, 1.5, '12', 0x100000000, Number.MAX_SAFE_INTEGER + 1]) {
    test(`refuses invalid metadata record count ${String(count)} before a step starts`, async () => {
        const { scan, calls } = setup([], { metadata: () => ({ snapshot: { ...snapshot, recordCount: count } }) });
        await scan.start(area);
        assertPending(scan, 'error');
        assert.equal(calls.length, 0);
    });
}

test('rejects out-of-bounds row ordinals and accepted consumption above the pinned record count', async () => {
    const recordCount = 2, confirmed = cursorAt(1);
    const { scan, calls } = setup([
        batch({ cursor: confirmed, tilesTotal: 2, rows: [row(0)], recordCount }),
        batch({ tilesTotal: 2, rows: [row(2)], recordCount }),
        batch({ tilesTotal: 2, rows: [row(1)], consumedCandidates: 2, recordCount }),
        batch({ tilesTotal: 2, rows: [row(1)], recordCount }),
    ], { metadata: () => ({ snapshot: { ...snapshot, recordCount } }) });
    await scan.start(area);
    assertPending(scan, 'error');
    await scan.resume();
    assertPending(scan, 'error');
    assert.equal(scan.getSnapshot().progress.tilesCompleted, 1);
    await scan.resume();
    assert.deepEqual(calls.map(request => request.cursor), [null, confirmed, confirmed, confirmed]);
    assert.equal(scan.getSnapshot().total, 2);
});

test('byteSplitRetestReachesRecordCountWithoutFalseExcess', async () => {
    const recordCount = 2, withheld = cursorAt(0, 1);
    const { scan } = setup([
        batch({ cursor: withheld, rows: [row(0)], candidates: 2, recordCount }),
        batch({ rows: [row(1)], recordCount }),
    ], { metadata: () => ({ snapshot: { ...snapshot, recordCount } }) });
    await scan.start(area);
    assert.equal(scan.getSnapshot().status, 'ready');
    assert.deepEqual(scan.getSnapshot().completedRows, [row(0), row(1)]);
});

test('counts UTF-8 unique-row bytes with array brackets and commas and fails atomically at 64 MiB', async () => {
    const recordCount = 256, maxBytes = 64 * 1024 * 1024;
    const text = '界'.repeat(65536), roadName = '界'.repeat(22000);
    const rows = Array.from({ length: recordCount }, (_, i) => row(i, { address: text, roadName }));
    const last = rows.at(-1);
    // Leave the encodings of the rows below the limit, and put the array encoding one byte over.
    const arrayBytes = () => rows.reduce((bytes, value) => bytes + Buffer.byteLength(JSON.stringify(value)), rows.length + 1);
    const excess = arrayBytes() - maxBytes - 1;
    assert.ok(excess > 0 && excess < Buffer.byteLength(last.address));
    const bytes = Buffer.byteLength(last.address) - excess;
    last.address = '界'.repeat(Math.floor(bytes / 3)) + 'x'.repeat(bytes % 3);
    assert.equal(arrayBytes(), maxBytes + 1);
    const steps = [];
    for (let start = 0; start < rows.length; start += 7) {
        const end = Math.min(start + 7, rows.length);
        steps.push(batch({ recordCount, rows: rows.slice(start, end), cursor: end < rows.length ? cursorAt(0, end) : null }));
    }
    const accepted = structuredClone(steps.at(-1));
    const acceptedLast = accepted.rows.at(-1);
    acceptedLast.address = acceptedLast.address.endsWith('x')
        ? acceptedLast.address.slice(0, -1)
        : `${acceptedLast.address.slice(0, -1)}xx`;
    steps.push(accepted);
    const { scan, calls } = setup(steps, { metadata: () => ({ snapshot: { ...snapshot, recordCount } }) });
    await scan.start(area);
    assertPending(scan, 'error');
    assert.equal(calls.length, steps.length - 1);
    await scan.resume();
    assert.equal(calls.at(-1).cursor, calls.at(-2).cursor);
    assert.equal(scan.getSnapshot().status, 'ready');
    assert.equal(scan.getSnapshot().total, 256);
});

test('stops at the successful batch budget while rows are still incomplete', async () => {
    const recordCount = 9000, calls = [];
    const scan = createWholeAreaAddressScan({
        getMetadata: async () => ({ snapshot: { ...snapshot, recordCount } }),
        scanBatch: async ({ cursor }) => {
            calls.push(cursor);
            return batch({ cursor: cursorAt(0, (cursor?.row ?? 0) + 1), consumedCandidates: 1, recordCount });
        },
    });
    await scan.start(area);
    assertPending(scan, 'error');
    assert.equal(calls.length, 8192);
    await scan.resume();
    assert.equal(calls.length, 8192);
});

for (const [description, mutate] of [
    ['source pin', value => { value.snapshot.sha256 = 'c'.repeat(64); }],
    ['manifest hash', value => { value.scan.manifestSha256 = 'c'.repeat(64); }],
    ['ETag', value => { value.scan.manifestEtag = '"other"'; }],
    ['geometry identity', value => { value.scan.areaSha256 = 'c'.repeat(64); }],
    ['tile count', value => { value.scan.tilesTotal = value.progress.tilesTotal = value.progress.tilesCompleted = 3; value.diagnostics.consumedCandidates = value.diagnostics.candidates = value.diagnostics.geometryWork = 2; }],
    ['candidate budget', value => { value.scan.batchCandidateLimit--; }],
    ['snapshot metadata', value => { value.snapshot.label = 'Different label'; }],
    ['record count', value => { value.snapshot.recordCount++; }],
    ['completion progress', value => { value.progress.tilesCompleted = 1; }],
    ['consumed less than returned rows', value => { value.diagnostics.consumedCandidates = 0; }],
    ['candidate count over the batch limit', value => { value.diagnostics.candidates = value.diagnostics.geometryWork = 513; }],
    ['consumed greater than tested', value => { value.diagnostics.consumedCandidates = 2; }],
    ['invalid row fields', value => { value.rows[0].postalCode = '12345'; }],
    ['unadvanced bookmark', value => { value.done = false; value.nextCursor = cursorAt(1); value.progress.tilesCompleted = 1; }],
    ['regressing progress', value => { value.done = false; value.nextCursor = cursorAt(0, 2); value.progress.tilesCompleted = 0; }],
    ['bookmark tile differs from progress', value => { value.done = false; value.nextCursor = cursorAt(1, 1); }],
]) {
    test(`rejects malformed continuation with changed ${description} and preserves confirmed progress`, async () => {
        const confirmed = cursorAt(1);
        const rejected = batch({ tilesTotal: 2, rows: [row(2)] });
        mutate(rejected);
        const { scan, calls } = setup([
            batch({ tilesTotal: 2, cursor: confirmed, rows: [row(0)] }),
            rejected,
            batch({ tilesTotal: 2, rows: [row(3)] }),
        ]);
        await scan.start(area);
        assertPending(scan, 'error');
        assert.deepEqual(scan.getSnapshot().progress, { tilesCompleted: 1, tilesTotal: 2 });
        await scan.resume();
        assert.deepEqual(calls.map(request => request.cursor), [null, confirmed, confirmed]);
        assert.deepEqual(scan.getSnapshot().completedRows, [row(0), row(3)]);
    });
}

test('rejects a first response for the wrong geometry before accepting a cursor', async () => {
    const { scan, calls } = setup([
        batch({ tilesTotal: 0, hash: 'c'.repeat(64) }),
        batch({ tilesTotal: 0 }),
    ]);
    await scan.start(area);
    assertPending(scan, 'error');
    assert.equal(scan.getSnapshot().progress, null);
    await scan.resume();
    assert.deepEqual(calls.map(request => request.cursor), [null, null]);
    assert.equal(scan.getSnapshot().status, 'ready');
});

test('failed first batch resumes at null on the same frozen geometry and pinned metadata', async () => {
    const failure = new Error('Offline');
    const { scan, calls, metadataCalls } = setup([failure, batch({ rows: [row(3)] })]);
    await scan.start(area);
    assertPending(scan, 'error');
    assert.equal(scan.getSnapshot().error, failure);
    assert.equal(calls.length, 1, 'there is no automatic retry');
    await scan.resume();
    assert.equal(metadataCalls.length, 1);
    assert.deepEqual(calls.map(request => request.cursor), [null, null]);
    assert.deepEqual(calls.map(request => request.snapshotSha256), [sha, sha]);
    assert.equal(calls[0].area, calls[1].area);
    assert.deepEqual(scan.getSnapshot().completedRows, [row(3)]);
});

test('lost later response resumes at the exact confirmed cursor without losing accepted results', async () => {
    const confirmed = cursorAt(1), other = cursorAt(2);
    const { scan, calls, metadataCalls } = setup([
        batch({ cursor: confirmed, tilesTotal: 3, rows: [row(9)] }),
        new Error('Lost response'),
        batch({ cursor: other, tilesTotal: 3, rows: [row(0)] }),
        batch({ tilesTotal: 3, rows: [row(3)] }),
    ]);
    await scan.start(area);
    assertPending(scan, 'error');
    assert.deepEqual(scan.getSnapshot().progress, { tilesCompleted: 1, tilesTotal: 3 });
    assert.equal(calls.length, 2, 'there is no automatic retry');
    await scan.resume();
    assert.equal(metadataCalls.length, 1);
    assert.deepEqual(calls.map(request => request.snapshotSha256), [sha, sha, sha, sha]);
    assert.deepEqual(calls.map(request => request.cursor), [null, confirmed, confirmed, other]);
    assert.equal(calls[2].cursor, calls[1].cursor);
    assert.deepEqual(scan.getSnapshot().completedRows, [row(0), row(3), row(9)]);
});

test('409 snapshot change retires pending rows and requires a fresh metadata pin and null cursor', async () => {
    const newPin = 'c'.repeat(64);
    let pin = sha;
    const { scan, calls, metadataCalls } = setup([
        batch({ cursor: cursorAt(1), tilesTotal: 2, rows: [row(8)] }),
        new AddressSnapshotError(undefined, 'ADDRESS_SNAPSHOT_CHANGED', 409),
        batch({ rows: [row(1)], snapshotSha256: newPin }),
    ], { metadata: () => ({ snapshot: { ...snapshot, sha256: pin } }) });
    await scan.start(area);
    assertPending(scan, 'changed');
    assert.equal(scan.getSnapshot().progress, null);
    await scan.resume();
    assert.equal(calls.length, 2);
    pin = newPin;
    await scan.start(area);
    assert.equal(metadataCalls.length, 2);
    assert.equal(calls[2].cursor, null);
    assert.equal(calls[2].snapshotSha256, newPin);
    assert.deepEqual(scan.getSnapshot().completedRows, [row(1)]);
});

test('reset aborts transport and an abort-ignoring late step cannot publish or enqueue a continuation', async () => {
    const late = deferred(), reached = deferred();
    const { scan, calls } = setup([
        () => { reached.resolve(); return late.promise; },
        batch({ rows: [row(0)] }),
    ]);
    const updates = [];
    scan.subscribe(() => updates.push(scan.getSnapshot()));
    const running = scan.start(area);
    await reached.promise;
    scan.reset();
    assert.equal(calls[0].signal.aborted, true);
    assertPending(scan, 'idle');
    await scan.start(area);
    const replacement = scan.getSnapshot();
    late.resolve(batch({ cursor: cursorAt(1), tilesTotal: 2, rows: [row(9)] }));
    await running;
    assert.equal(calls.length, 2);
    assert.equal(scan.getSnapshot(), replacement);
    assert.equal(updates.filter(value => value.status === 'ready').length, 1);
    assert.deepEqual(replacement.completedRows, [row(0)]);
});

test('reset during metadata prevents even a late successful pin from starting a batch', async () => {
    const metadata = deferred();
    const { scan, calls } = setup([], { metadata: () => metadata.promise });
    const running = scan.start(area);
    scan.reset();
    metadata.resolve({ snapshot });
    await running;
    assertPending(scan, 'idle');
    assert.equal(calls.length, 0);
});

test('reset immediately releases accepted rows while a later transport ignores abort', async t => {
    const match = row(9), reached = deferred(), late = deferred();
    const mapSet = Map.prototype.set, setAdd = Set.prototype.add;
    let acceptedRows, acceptedOrdinals;
    // Observe the real collections so the release check does not depend on GC timing.
    t.mock.method(Map.prototype, 'set', function set(key, value) {
        if (key === match.id) acceptedRows = this;
        return mapSet.call(this, key, value);
    });
    t.mock.method(Set.prototype, 'add', function add(value) {
        if (value === match.ordinal) acceptedOrdinals = this;
        return setAdd.call(this, value);
    });
    const { scan, calls } = setup([
        batch({ cursor: cursorAt(1), tilesTotal: 2, rows: [match] }),
        () => {
            reached.resolve({ rows: acceptedRows, ordinals: acceptedOrdinals });
            return late.promise;
        },
    ]);
    const running = scan.start(area);
    const { rows, ordinals } = await reached.promise;
    try {
        assert.deepEqual(rows.get(match.id), match);
        assert.equal(ordinals.has(match.ordinal), true);
        scan.reset();
        assert.equal(calls[1].signal.aborted, true);
        assertPending(scan, 'idle');
        assert.equal(rows.size, 0, 'reset releases the accepted row before the request settles');
        assert.equal(ordinals.size, 0, 'reset releases accepted ordinals too');
    } finally {
        late.resolve(batch({ rows: [row(0)], tilesTotal: 2 }));
        await running;
    }
    assertPending(scan, 'idle');
    assert.equal(calls.length, 2);
});
