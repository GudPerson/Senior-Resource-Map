import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundaryPostalScanner } from '../src/utils/boundaryPostalScanner.js';
import { snapshot } from './helpers/boundaryJobFixture.js';
import { createAddressSnapshotRepository } from '../src/utils/addressSnapshotRepository.js';
const rectangle = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n], [w, s]];

test('41 tiles, a hole, an included hole edge, multipart and a split dense tile: exact bounded continuations', async () => {
    const points = Array.from({ length: 41 }, (_, i) => ['001111', 1.301, 103.101 + i * .01]);
    points.push(['000321', 1.301, 103.102], ['999991', 1.301, 103.103], ['000012', 1.301, 103.104]);
    const d = snapshot(points), area = { type: 'MultiPolygon', coordinates: [
            [rectangle(103.10, 1.30, 103.45, 1.31), rectangle(103.102, 1.3005, 103.1035, 1.302)],
            [rectangle(103.48, 1.30, 103.51, 1.31)]
        ] };
    await assert.rejects(createAddressSnapshotRepository(d.bucket, { config: d.config }).area({ area, snapshotSha256: d.config.sourceSha256 }), { code: 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' });
    const scanner = createBoundaryPostalScanner(d.bucket, { config: d.config });
    const pin = await scanner.pin();
    const codes = new Set();
    let cursor = {}, done = false, steps = 0;
    while (!done && ++steps < 60) {
        const step = await scanner.scanBoundaryPostalStep({ area, manifestIdentity: pin, cursor, budget: { candidates: 2, geometryWork: 24 } });
        assert.ok(step.diagnostics.candidates <= 2 && step.diagnostics.geometryWork <= 24 && step.diagnostics.reads <= 3 && step.diagnostics.bytes <= 4 * 1024 * 1024);
        assert.notDeepEqual(step.cursor, cursor);
        cursor = step.cursor;
        done = step.done;
        step.postalCodes.forEach(c => codes.add(c));
    }
    assert.ok(done);
    assert.deepEqual([...codes].sort(), ['000012', '000321', '001111']);
    await assert.rejects(scanner.scanBoundaryPostalStep({ area, manifestIdentity: { ...pin, etag: 'new' }, cursor: {} }), { code: 'BOUNDARY_SNAPSHOT_CHANGED' });
});

test('a single dense tile beyond interactive geometry allowance resumes by row and refuses impossible I/O budgets', async () => {
    const n = 600, points = Array.from({ length: n }, (_, i) => [i === 599 ? '000002' : '000001', 1.305, 103.105]);
    const d = snapshot(points), ring = Array.from({ length: 500 }, (_, i) => [
        103.105 + .0001 * Math.cos(i * 2 * Math.PI / 500), 1.305 + .0001 * Math.sin(i * 2 * Math.PI / 500)
    ]);
    ring.push(ring[0]);
    const area = { type: 'Polygon', coordinates: [ring] };
    await assert.rejects(createAddressSnapshotRepository(d.bucket, { config: d.config }).area({ area, snapshotSha256: d.config.sourceSha256 }), e => e.addressLimit.reason === 'geometryWork' && e.addressLimit.observed === 300000);
    const scanner = createBoundaryPostalScanner(d.bucket, { config: d.config }), manifestIdentity = await scanner.pin();
    const step = (cursor = {}, budget) => scanner.scanBoundaryPostalStep({ area, manifestIdentity, cursor, budget });
    const first = await step();
    assert.equal(first.done, false);
    assert.deepEqual(first.cursor, { tile: 0, row: 500 });
    assert.deepEqual(first.postalCodes, ['000001']);
    const last = await step(first.cursor);
    assert.equal(last.done, true);
    assert.deepEqual(last.postalCodes, ['000001', '000002']);
    for (const budget of [{ bytes: d.config.manifestBytes + 1 }, { reads: 2 }, { geometryWork: 499 }]) {
        await assert.rejects(step({}, budget), { code: 'BOUNDARY_STEP_BUDGET' });
    }
});
