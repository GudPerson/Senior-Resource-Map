import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildAddressSnapshotIndex, createAddressSnapshotServer, loadAddressSnapshot, parseAddressServiceArguments, parseCsvRecords } from './address-snapshot-service.mjs';

const header = 'postal_code,blk_no,road_name,building,address,latitude,longitude\r\n';
const rows = [
    { id: 'a', postalCode: '018906', block: '1', roadName: 'A', building: '', address: 'First', lat: 1.3, lng: 103.8 },
    { id: 'b', postalCode: '018906', block: '2', roadName: 'A', building: '', address: 'Second', lat: 1.3001, lng: 103.8 },
    { id: 'c', postalCode: '018906', block: '3', roadName: 'A', building: '', address: 'Third', lat: 1.3002, lng: 103.8 },
    { id: 'far', postalCode: '654321', block: '4', roadName: 'B', building: '', address: 'Far', lat: 1.4, lng: 103.9 },
];
const circle = { type: 'circle', center: [1.3, 103.8], radiusMeters: 100 };

async function withCsv(t, contents) {
    const directory = await mkdtemp(join(tmpdir(), 'carearound-snapshot-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const csv = join(directory, 'addresses.csv'); await writeFile(csv, contents); return csv;
}

async function localServer(t, index) {
    const server = createAddressSnapshotServer(index);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return `http://127.0.0.1:${server.address().port}`;
}

test('streaming CSV handles every byte boundary, UTF-8, BOM, embedded commas, newlines, escaped quotes and trailing empties', async () => {
    const bytes = Buffer.from('\uFEFFa,b,c\r\n"A, B","x\r\ny","a""b"\r\n末尾,,');
    async function* chunks() { for (const byte of bytes) yield Buffer.from([byte]); }
    const parsed = [];
    for await (const record of parseCsvRecords(chunks())) parsed.push(record);
    assert.deepEqual(parsed, [['a', 'b', 'c'], ['A, B', 'x\r\ny', 'a"b'], ['末尾', '', '']]);
    await assert.rejects(async () => { for await (const _ of parseCsvRecords(['a,"unclosed'])) {} }, /Unclosed/);
});

test('snapshot keeps distinct and even repeated source rows sharing one postal, with deterministic IDs and byte hash', async t => {
    const contents = header + '018906,1,ROAD,"A, B","First\naddress",1.3,103.8\r\n'
        + '018906,2,ROAD,C,Second,1.3001,103.8\r\n018906,2,ROAD,C,Second,1.3001,103.8\r\n';
    const csv = await withCsv(t, contents), first = await loadAddressSnapshot(csv, { preparedAt: '2026-11-03T00:00:00.000Z' });
    const second = await loadAddressSnapshot(csv);
    assert.equal(first.snapshot.recordCount, 3);
    assert.equal(first.snapshot.postalCodeCount, 1);
    assert.equal(first.snapshot.sha256, createHash('sha256').update(contents).digest('hex'));
    assert.equal(first.snapshot.preparedAt, '2026-11-03T00:00:00.000Z');
    assert.ok(second.snapshot.loadedAt);
    await assert.rejects(loadAddressSnapshot(csv, { expectedSha256: '0'.repeat(64) }), /hash/);
    const result = first.queryArea({ area: circle });
    assert.equal(new Set(result.rows.map(row => row.id)).size, 3);
    assert.deepEqual(result.rows.map(row => row.id), second.queryArea({ area: circle }).rows.map(row => row.id));
    assert.equal(result.rows[0].postalCode, '018906');
    assert.equal(result.rows[0].building, 'A, B');
    assert.equal(result.rows[0].address, 'First\naddress');
    assert.equal(JSON.stringify(first.snapshot).includes(csv), false);
});

test('index limits candidate work, returns stable pages without losing same-postal rows, and sorts nearest distances', () => {
    const farRows = Array.from({ length: 2000 }, (_, i) => ({ ...rows[3], id: `far_${i}`, lat: 1.35 + i * 0.00001 }));
    const index = buildAddressSnapshotIndex([...rows.slice(0, 3), ...farRows]);
    const first = index.queryArea({ area: circle, offset: 0, limit: 2 });
    const second = index.queryArea({ area: circle, offset: 2, limit: 2 });
    assert.equal(first.total, 3); assert.equal(first.truncated, true); assert.equal(second.truncated, false);
    assert.deepEqual([...first.rows, ...second.rows].map(row => row.id), ['a', 'b', 'c']);
    assert.ok(first.candidateCount < 10);
    const nearby = index.queryNearby({ lat: 1.30019, lng: 103.8, radiusMeters: 100, limit: 2 });
    assert.deepEqual(nearby.rows.map(row => row.id), ['c', 'b']);
    assert.equal(nearby.total, 3); assert.equal(nearby.truncated, true);
    assert.ok(nearby.rows[0].distanceMeters < nearby.rows[1].distanceMeters);
    const all = index.queryArea({ area: { type: 'Polygon', coordinates: [[[103, 1], [104, 1], [104, 2], [103, 2], [103, 1]]] }, limit: 1000 });
    assert.equal(all.total, 2003); assert.equal(all.rows.length, 1000); assert.equal(all.truncated, true);
});

test('service excludes polygon holes and finds another multipart island', () => {
    const area = { type: 'MultiPolygon', coordinates: [
        [[[103.799, 1.299], [103.801, 1.299], [103.801, 1.301], [103.799, 1.301], [103.799, 1.299]],
            [[103.7999, 1.30005], [103.8001, 1.30005], [103.8001, 1.30015], [103.7999, 1.30015], [103.7999, 1.30005]]],
        [[[103.899, 1.399], [103.901, 1.399], [103.901, 1.401], [103.899, 1.401], [103.899, 1.399]]],
    ] };
    assert.deepEqual(buildAddressSnapshotIndex(rows).queryArea({ area }).rows.map(row => row.id), ['a', 'c', 'far']);
});

test('header-only snapshots are honestly empty; invalid source rows and numeric postals fail closed', async t => {
    assert.equal((await loadAddressSnapshot(await withCsv(t, header))).snapshot.recordCount, 0);
    assert.deepEqual(buildAddressSnapshotIndex([]).queryArea({ area: circle }).rows, []);
    await assert.rejects(loadAddressSnapshot(await withCsv(t, header + '18906,1,A,B,C,1.3,103.8\n')), /postal/);
    await assert.rejects(loadAddressSnapshot(await withCsv(t, header + '018906,1,A,B,C,,103.8\n')), /coordinate/);
    assert.throws(() => buildAddressSnapshotIndex([{ ...rows[0], postalCode: 18906 }]), /Invalid/);
});

test('HTTP endpoint validates shape, bounds, pagination, host and origin, keeps metadata honest and never serves CSV files', async t => {
    const base = await localServer(t, buildAddressSnapshotIndex(rows, { label: 'Prepared snapshot', coverage: 'Incomplete' }));
    const metadata = await fetch(`${base}/metadata`).then(response => response.json());
    assert.equal(metadata.snapshot.coverage, 'Incomplete');
    const query = async (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const valid = await query('/area', { area: circle, offset: 1, limit: 1 });
    const body = await valid.json();
    assert.equal(valid.status, 200); assert.equal(body.total, 3); assert.equal(body.offset, 1); assert.equal(body.truncated, true);
    assert.equal(Object.hasOwn(body, 'candidateCount'), false);
    for (const payload of [{ area: circle, limit: 1001 }, { area: circle, offset: -1 }, { area: circle, offset: 0.5 },
        { area: { type: 'circle', center: [103.8, 1.3], radiusMeters: 100 } }, { area: circle, csv: '/private/file' }, { area: {} }]) {
        assert.equal((await query('/area', payload)).status, 400);
    }
    assert.equal((await query('/nearby', { lat: 1.3, lng: 103.8, radiusMeters: 10001 })).status, 400);
    assert.equal((await query('/area', { area: circle }, { Origin: 'https://untrusted.invalid' })).status, 403);
    const forbiddenHost = await new Promise((resolveStatus, rejectStatus) => {
        const request = httpRequest(`${base}/metadata`, { headers: { Host: 'untrusted.invalid' } }, response => {
            response.resume(); resolveStatus(response.statusCode);
        });
        request.on('error', rejectStatus); request.end();
    });
    assert.equal(forbiddenHost, 403);
    assert.equal((await fetch(`${base}/sg_addresses.csv`)).status, 404);
    assert.equal((await fetch(`${base}/area`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 400);
    assert.equal((await fetch(`${base}/area`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await query('/area', { area: circle, extra: 'x'.repeat(1024 * 1024) })).status, 413);
});

test('CLI requires explicit external absolute CSV and restricts optional port', () => {
    assert.deepEqual(parseAddressServiceArguments(['--csv', '/tmp/test.csv']), { csv: '/tmp/test.csv', port: 8796 });
    for (const args of [[], ['--csv', 'relative.csv'], ['--csv', '/tmp/a', '--port', '0'], ['--csv', '/tmp/a', '--host', '0.0.0.0']]) {
        assert.throws(() => parseAddressServiceArguments(args));
    }
});

// Importing Vite config is a local configuration check, with no running proxy.
test('Vite address proxy exists only with an explicit loopback service URL', async () => {
    const { addressSnapshotProxy } = await import('../client/vite.config.js');
    assert.deepEqual(addressSnapshotProxy(undefined), {});
    const proxy = addressSnapshotProxy('http://127.0.0.1:8796')['/__carearound-addresses'];
    assert.equal(proxy.target, 'http://127.0.0.1:8796');
    assert.equal(proxy.rewrite('/__carearound-addresses/metadata'), '/metadata');
    for (const value of ['https://private.example', 'http://localhost.evil:8796', 'http://user:password@127.0.0.1:8796', 'http://127.0.0.1:8796/path']) {
        assert.throws(() => addressSnapshotProxy(value));
    }
});
