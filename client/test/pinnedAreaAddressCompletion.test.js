import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinnedAreaAddressCompletion, validatePinnedAreaAddressPage } from '../src/lib/pinnedAreaAddressCompletion.js';

const pin = 'a'.repeat(64);
const area = { type: 'circle', center: [1.35, 103.82], radiusMeters: 100 };
const makeRows = (offset, length) => Array.from({ length }, (_, i) => ({
    id: 'address-' + (i + offset), postalCode: '012345', address: 'Fixture ' + (i + offset),
}));
function source(confirmed, total, overrides = {}) {
    return { scopeKey: 'map-one', snapshot: { sha256: pin, recordCount: total }, area, total, rows: makeRows(0, confirmed), ...overrides };
}
function page(offset, total, limit = 1000) {
    return { snapshot: { sha256: pin, recordCount: total }, offset, total, limit, rows: makeRows(offset, Math.min(limit, total - offset)) };
}

const turn = () => new Promise(resolve => setImmediate(resolve));
function harness() {
    const requests = [];
    const controller = createPinnedAreaAddressCompletion({
        fetchPage(request) {
            return new Promise((resolve, reject) => requests.push({ ...request, resolve, reject }));
        },
    });
    return { ...controller, requests };
}

test('validates exact page, unique nonempty identity and postal text without mutating the accepted IDs', () => {
    const original = page(1, 3, 2);
    const acceptedIds = new Set(['address-0']);
    const expected = { snapshotSha256: pin, offset: 1, total: 3, limit: 2, acceptedIds };
    for (const replacement of [
        { offset: 0 }, { limit: 3 }, { total: 4 }, { rows: [] }, { rows: [...original.rows, ...makeRows(3, 1)] },
        { rows: [original.rows[0], original.rows[0]] }, { rows: [original.rows[0], { id: ' ', postalCode: '123456' }] },
        { rows: [original.rows[0], ...makeRows(0, 1)] }, { rows: [original.rows[0], { id: 'other', postalCode: ' ' }] },
        { snapshot: { sha256: 'b'.repeat(64), recordCount: 3 } }, { snapshot: { sha256: pin, recordCount: 2 } },
    ]) {
        assert.throws(() => validatePinnedAreaAddressPage({ ...original, ...replacement }, expected));
        assert.deepEqual(acceptedIds, new Set(['address-0']));
    }
    assert.equal(validatePinnedAreaAddressPage(original, expected), original.rows);
    assert.deepEqual(acceptedIds, new Set(['address-0']));
});

for (const [prefix, total] of [[200, 225], [400, 425]]) {
    test('continues a verified ' + prefix + '-row prefix using the original scope and one active request', async () => {
        const h = harness(), seed = source(prefix, total);
        const notifications = [];
        const unsubscribe = h.subscribe(() => notifications.push(h.getSnapshot()));
        const pending = h.start(seed);
        const overlapping = [h.start({ ...seed, area: structuredClone(area) }), h.resume()];
        await turn();
        assert.equal(h.requests.length, 1);
        const request = h.requests[0];
        assert.deepEqual(request.area, area);
        assert.equal(request.snapshotSha256, pin);
        assert.equal(request.limit, 1000);
        assert.equal(request.offset, prefix);
        assert.equal(request.signal.aborted, false);
        assert.equal(h.getSnapshot().completedRows, null);
        assert.deepEqual(h.getSnapshot().progress, { confirmed: prefix, total });
        request.resolve(page(prefix, total));
        await Promise.all([pending, ...overlapping]);
        const ready = h.getSnapshot();
        assert.equal(ready.status, 'ready');
        assert.deepEqual(ready.completedRows, makeRows(0, total));
        await h.start(seed);
        assert.equal(h.getSnapshot(), ready);
        assert.equal(h.requests.length, 1);
        assert.equal(notifications.filter(view => view.completedRows).length, 1);
        unsubscribe();
        h.reset();
        assert.equal(notifications.at(-1), ready);
    });
}

test('equivalent circle property order reuses the pending promise and transport', async () => {
    const h = harness(), seed = source(1, 2);
    const first = h.start(seed);
    await turn();
    assert.equal(h.requests.length, 1);
    const request = h.requests[0];
    const reordered = { radiusMeters: 100, center: [1.35, 103.82], type: 'circle' };
    const second = h.start({ ...seed, area: reordered });
    await turn();
    assert.equal(h.requests.length, 1);
    assert.equal(second, first);
    assert.equal(request.signal.aborted, false);
    assert.deepEqual(request.area, area);
    request.resolve(page(1, 2));
    await Promise.all([first, second]);
    assert.deepEqual(h.getSnapshot().completedRows, makeRows(0, 2));
});

test('total zero and a valid complete prefix finish locally', async () => {
    for (const total of [0, 2]) {
        const h = harness();
        await h.start(source(total, total));
        assert.equal(h.getSnapshot().status, 'ready');
        assert.deepEqual(h.getSnapshot().completedRows, makeRows(0, total));
        assert.deepEqual(h.requests, []);
    }
});

test('invalid or excessive pinned prefixes never publish rows or request further pages', async () => {
    for (const seed of [
        source(0, 2, { snapshot: { sha256: pin, recordCount: 1 } }), source(2, 1),
        source(0, -1), source(0, 0.5), source(1, 2, { snapshot: { sha256: '', recordCount: 2 } }),
        source(2, 2, { rows: [...makeRows(0, 1), ...makeRows(0, 1)] }),
    ]) {
        const h = harness();
        await h.start(seed);
        assert.equal(h.getSnapshot().status, 'error');
        assert.equal(h.getSnapshot().completedRows, null);
        await h.resume();
        assert.equal(h.requests.length, 0);
    }
});

test('late malformed rows roll back the entire page, retry resumes the exact confirmed offset and pin', async () => {
    const h = harness(), total = 1203;
    const run = h.start(source(200, total));
    await turn();
    assert.equal(h.requests.length, 1);
    h.requests[0].resolve(page(200, total));
    await turn();
    assert.equal(h.requests.length, 2);
    const bad = page(1200, total);
    bad.rows[2].id = 'address-1';
    h.requests[1].resolve(bad);
    await run;
    assert.equal(h.getSnapshot().status, 'error');
    assert.deepEqual(h.getSnapshot().progress, { confirmed: 1200, total });
    assert.equal(h.getSnapshot().completedRows, null);
    const retry = h.resume(), duplicate = h.resume();
    await turn();
    assert.equal(h.requests.length, 3);
    assert.equal(h.requests[2].offset, 1200);
    assert.equal(h.requests[2].snapshotSha256, pin);
    h.requests[2].resolve(page(1200, total));
    await Promise.all([retry, duplicate]);
    assert.deepEqual(h.getSnapshot().completedRows, makeRows(0, total));
});

test('transport errors retain progress and changed pin retires the session until restart', async () => {
    const h = harness(), seed = source(1, 3);
    const run = h.start(seed);
    await turn();
    assert.equal(h.requests.length, 1);
    h.requests[0].reject(new Error('Synthetic interrupted page'));
    await run;
    assert.equal(h.getSnapshot().status, 'error');
    assert.deepEqual(h.getSnapshot().progress, { confirmed: 1, total: 3 });
    await h.start(seed);
    assert.equal(h.requests.length, 1);
    const retry = h.resume();
    await turn();
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve({ ...page(1, 3), snapshot: { sha256: 'b'.repeat(64), recordCount: 3 } });
    await retry;
    assert.equal(h.getSnapshot().status, 'changed');
    assert.equal(h.getSnapshot().completedRows, null);
    await h.resume();
    assert.equal(h.requests.length, 2);
});

test('reset and replacement scopes fence abort-ignoring late pages before publication or continuation', async () => {
    for (const replacement of [null, { scopeKey: 'map-two' }, { area: { ...area, radiusMeters: 101 } }]) {
        const h = harness(), run = h.start(source(1, 2002));
        await turn();
        assert.equal(h.requests.length, 1);
        if (replacement) await h.start(source(2002, 2002, replacement));
        else h.reset();
        const view = h.getSnapshot();
        assert.equal(view.status, replacement ? 'ready' : 'idle');
        assert.equal(h.requests[0].signal.aborted, true);
        h.requests[0].resolve(page(1, 2002));
        await run;
        assert.equal(h.getSnapshot(), view);
        assert.equal(h.requests.length, 1);
    }
});

test('the byte budget counts UTF-8 plus array framing and rejects an oversized continuation atomically', async () => {
    const h = harness();
    const limit = 64 * 1024 * 1024;
    const seed = source(1, 2);
    const response = page(1, 2);
    const row = response.rows[0];
    const spare = limit - Buffer.byteLength(JSON.stringify([...seed.rows, row]));
    // The serialized array exceeds the cap by one byte while its JS string length fits easily.
    row.address += '界'.repeat(Math.floor(spare / 3)) + 'a'.repeat(spare % 3 + 1);
    assert.equal(Buffer.byteLength(JSON.stringify([...seed.rows, row])), limit + 1);
    const run = h.start(seed);
    await turn();
    assert.equal(h.requests.length, 1);
    h.requests[0].resolve(response);
    await run;
    assert.equal(h.getSnapshot().status, 'error');
    assert.equal(h.getSnapshot().completedRows, null);
    assert.deepEqual(h.getSnapshot().progress, { confirmed: 1, total: 2 });
});

test('starting another scope withdraws the previous ready rows synchronously', async () => {
    const h = harness();
    await h.start(source(1, 1));
    const pending = h.start(source(1, 2, { scopeKey: 'map-two' }));
    assert.equal(h.getSnapshot().status, 'preparing');
    assert.equal(h.getSnapshot().completedRows, null);
    h.reset();
    await pending;
    assert.equal(h.requests.length, 0);
});
