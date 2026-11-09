import assert from 'node:assert/strict';
import test from 'node:test';
import { BOUNDARY_DRAWING_SCHEMA_VERSION, BoundaryDrawingError, canonicalizeBoundaryDrawing,
    boundaryDrawingToArea, countBoundaryDrawingStoredPoints, assertBoundaryDrawingBatchCapacity } from '../../shared/boundaryDrawing.js';
import { containsSpatialPoint } from '../../shared/addressSnapshotSpatial.js';

const square = [[0, 100], [0, 104], [4, 104], [4, 100]];
const circle = () => ({ type: 'circle', points: [[0, 100], [0.001, 100]], text: 'Coverage' });
const boundary = (points = square, boundaryParts) => ({ type: 'polygon', boundarySource: 'kml',
    points: points.map(point => [...point]), controlPoints: points.map(point => [...point]), ...(boundaryParts ? { boundaryParts } : {}) });
const rejects = (run, code) => assert.throws(run, error => error instanceof BoundaryDrawingError && error.code === code);

test('snapshot owns whitelisted geometry, style and source text without inheriting identity or permissions', () => {
    const raw = { ...boundary(), id: 'private-id', name: 'Source name', text: 'Source label', groupName: 'Area group',
        isShared: true, sharingStatus: 'approved', resourceLinks: [{ kind: 'place', id: 7 }], resourceBehaviour: 'open',
        resourceGlowColor: '#FF0000', image: { assetId: 'private-media' }, camera: { zoom: 16 },
        style: { color: '#123456', fillColor: '#ABCDEF', fillOpacity: 0.8, weight: 0.5,
            strokeOpacity: 0.7, dashed: true, textColor: '#654321', fontSize: 18, secret: 'omit' } };
    const drawing = canonicalizeBoundaryDrawing(raw);
    assert.equal(BOUNDARY_DRAWING_SCHEMA_VERSION, 1);
    assert.deepEqual(drawing, { schemaVersion: 1, type: 'polygon', boundarySource: 'kml',
        points: square, controlPoints: square, name: 'Source name', text: 'Source label', groupName: 'Area group',
        style: { color: '#123456', fillColor: '#ABCDEF', fillOpacity: 0.8, weight: 0.5,
            strokeOpacity: 0.7, dashed: true, textColor: '#654321', fontSize: 18 } });
    assert.deepEqual(canonicalizeBoundaryDrawing(JSON.parse(JSON.stringify(drawing))), drawing);
    raw.points[0][0] = 9; raw.controlPoints[1][0] = 9; raw.style.color = '#000000';
    assert.deepEqual(drawing.points[0], [0, 100]); assert.deepEqual(drawing.controlPoints[1], [0, 104]);
    const area = boundaryDrawingToArea(drawing); area.coordinates[0][0][0] = 90;
    assert.deepEqual(drawing.points[0], [0, 100]);
});

test('circle projection preserves geographic metres and the existing one metre minimum', () => {
    const drawing = canonicalizeBoundaryDrawing(circle());
    const area = boundaryDrawingToArea(drawing);
    assert.deepEqual(area.center, [0, 100]);
    assert.ok(Math.abs(area.radiusMeters - 111.19492664455875) < 1e-9);
    assert.equal(containsSpatialPoint(area, [0.001, 100]), true);
    assert.equal(containsSpatialPoint(area, [0.00101, 100]), false);
    assert.deepEqual(boundaryDrawingToArea({ type: 'circle', points: [[0, 100], [0, 100]] }),
        { type: 'circle', center: [0, 100], radiusMeters: 1 });
});

test('rotated box projection retains the exact displayed corners', () => {
    const drawing = canonicalizeBoundaryDrawing({ type: 'rectangle', points: [[0, 0], [2, 4]], rotationDegrees: 90 });
    assert.equal(drawing.rotationDegrees, 90);
    const ring = boundaryDrawingToArea(drawing).coordinates[0];
    const want = [[3, -1], [3, 3], [1, 3], [1, -1], [3, -1]];
    ring.forEach((point, index) => point.forEach((value, axis) => assert.ok(Math.abs(value - want[index][axis]) < 1e-12)));
});

test('ordinary polygon projection uses the existing rounded corners and retained controls', () => {
    const points = [[0, 0], [0, 10], [10, 0]];
    const drawing = canonicalizeBoundaryDrawing({ type: 'polygon', points, controlPoints: points, rotationDegrees: 12 });
    assert.deepEqual(drawing.points, points); assert.deepEqual(drawing.controlPoints, points);
    assert.equal(drawing.rotationDegrees, 12);
    const ring = boundaryDrawingToArea(drawing).coordinates[0];
    assert.equal(ring.length, 16);
    assert.deepEqual(ring.slice(0, 5), [[0, 1.6], [0.1, 0.9], [0.4, 0.4], [0.9, 0.1], [1.6, 0]]);
    assert.equal(containsSpatialPoint(boundaryDrawingToArea(drawing), [0.01, 0.01]), false);
});

test('multipart and hole projection preserves ring winding and union membership', () => {
    const hole = [[1, 101], [1, 102], [2, 102], [2, 101]];
    const island = [[6, 106], [6, 108], [8, 108], [8, 106]];
    const drawing = canonicalizeBoundaryDrawing(boundary([...square, ...hole, ...island], [[4, 4], [4]]));
    assert.deepEqual(boundaryDrawingToArea(drawing), { type: 'MultiPolygon', coordinates: [
        [[[100, 0], [104, 0], [104, 4], [100, 4], [100, 0]],
            [[101, 2], [102, 2], [102, 1], [101, 1], [101, 2]]],
        [[[106, 6], [108, 6], [108, 8], [106, 8], [106, 6]]] ] });
    const area = boundaryDrawingToArea(drawing);
    assert.equal(containsSpatialPoint(area, [1.5, 101.5]), false);
    assert.equal(containsSpatialPoint(area, [1, 101.5]), true);
    assert.equal(containsSpatialPoint(area, [7, 107]), true);
    assert.equal(countBoundaryDrawingStoredPoints(drawing), 24);
});

test('malformed, non-finite, open, unsupported and excessive geometry fails instead of clipping', () => {
    for (const raw of [null, { type: 'line', points: square }, { type: 'image', points: square },
        { type: 'Polygon', coordinates: [[[100, 0], [104, 0], [104, 4]]] }]) {
        rejects(() => canonicalizeBoundaryDrawing(raw), 'unsupported');
    }
    for (const raw of [{ ...circle(), points: [[NaN, 100], [0, 100]] },
        { ...circle(), points: [['0', 100], [1, 100]] }, { ...circle(), points: [[0, 100, 3], [1, 100]] },
        { ...circle(), points: [...circle().points, [2, 100]] }, { ...circle(), rotationDegrees: Infinity },
        { type: 'rectangle', points: [[0, 100], [0, 104]] },
        { ...boundary(), controlPoints: [[0, 100], [1, 101]] }, { ...boundary(), boundaryParts: [[3]] },
        { ...boundary(), boundarySource: 'unknown' }, { ...circle(), schemaVersion: 2 },
        { type: 'polygon', points: [[0, 100], [0, 101], [0, 102]] }]) {
        rejects(() => canonicalizeBoundaryDrawing(raw), 'geometry');
    }
    rejects(() => canonicalizeBoundaryDrawing({ type: 'polygon', points: Array(501).fill([0, 100]) }), 'vertices');
    rejects(() => canonicalizeBoundaryDrawing({ type: 'polygon', points: square, controlPoints: Array(201).fill([0, 100]) }), 'vertices');
    rejects(() => canonicalizeBoundaryDrawing(boundary(Array(1001).fill([0, 100]))), 'vertices');
});

test('batch count uses every existing annotation including hidden items and rejects atomically', () => {
    const existing = Array.from({ length: 199 }, (_, index) => ({ id: `hidden_${index}`, type: 'pin', points: [[0, 100]], hidden: true }));
    assert.doesNotThrow(() => assertBoundaryDrawingBatchCapacity(existing, [circle()]));
    const full = [...existing, { ...circle(), id: 'last' }];
    const before = structuredClone(full);
    rejects(() => assertBoundaryDrawingBatchCapacity(full, [circle()]), 'count');
    assert.deepEqual(full, before);
    rejects(() => assertBoundaryDrawingBatchCapacity(existing.slice(0, 198), [circle(), { type: 'line', points: square }]), 'unsupported');
});

test('batch counts stored points and controls at exactly 20000 and refuses 20001', () => {
    // 9,999 stored points + 9,999 controls and one incoming two-point circle.
    const thousand = Array.from({ length: 1000 }, (_, index) => [index % 2, 100 + (index % 3)]);
    const points = Array.from({ length: 10 }, () => thousand).flat().slice(0, 9999);
    const existing = [{ type: 'polygon', boundarySource: 'kml', points, controlPoints: points,
        boundaryParts: [...Array.from({ length: 9 }, () => [1000]), [999]], hidden: true }];
    assert.doesNotThrow(() => assertBoundaryDrawingBatchCapacity(existing, [circle()]));
    const before = structuredClone(existing);
    rejects(() => assertBoundaryDrawingBatchCapacity([...existing, { type: 'pin', points: [[0, 100]] }], [circle()]), 'budget');
    assert.deepEqual(existing, before);
    const malformed = { ...circle(), points: [...circle().points, [Infinity, 100]] };
    rejects(() => assertBoundaryDrawingBatchCapacity([], [circle(), malformed]), 'geometry');
});


test('ordinary legacy dual lists retain stored coordinates while controls define the displayed area', () => {
    const raw = { type: 'polygon', points: [[20, 120], [20, 124], [24, 124], [24, 120]],
        controlPoints: [[0, 100], [0, 104], [4, 104], [4, 100]] };
    const before = structuredClone(raw);
    const drawing = canonicalizeBoundaryDrawing(raw);
    assert.deepEqual(drawing.points, [[20, 120], [20, 124], [24, 124], [24, 120]]);
    assert.deepEqual(drawing.controlPoints, [[0, 100], [0, 104], [4, 104], [4, 100]]);
    const area = boundaryDrawingToArea(drawing);
    assert.equal(containsSpatialPoint(area, [2, 102]), true);
    assert.equal(containsSpatialPoint(area, [22, 122]), false);
    assert.equal(countBoundaryDrawingStoredPoints(drawing), 8);
    assert.deepEqual(raw, before);
});

test('sparse coordinate lists and malformed styles produce typed failures', () => {
    for (const raw of [{ ...circle(), points: Array(2) },
        { ...circle(), points: [[, 100], [1, 100]] }, { ...circle(), style: null }]) {
        rejects(() => canonicalizeBoundaryDrawing(raw), 'geometry');
    }
});


test('stored geometry limits remain 500 ordinary points, 200 controls and 1000 corners per KML part', () => {
    const points = Array.from({ length: 125 }, () => square).flat();
    const controlPoints = Array.from({ length: 50 }, () => square).flat();
    const ordinary = canonicalizeBoundaryDrawing({ type: 'polygon', points, controlPoints });
    assert.equal(ordinary.points.length, 500);
    assert.equal(ordinary.controlPoints.length, 200);
    assert.equal(countBoundaryDrawingStoredPoints(ordinary), 700);
    const part = Array.from({ length: 250 }, () => square).flat();
    const large = canonicalizeBoundaryDrawing(boundary(Array.from({ length: 10 }, () => part).flat(), Array.from({ length: 10 }, () => [1000])));
    assert.equal(countBoundaryDrawingStoredPoints(large), 20000);
    assert.doesNotThrow(() => assertBoundaryDrawingBatchCapacity([], [large]));
    rejects(() => assertBoundaryDrawingBatchCapacity([], [large, circle()]), 'budget');
    const oversized = { type: 'polygon', points: [...points, [1, 101]], controlPoints };
    const before = structuredClone(oversized);
    rejects(() => assertBoundaryDrawingBatchCapacity([oversized], [circle()]), 'vertices');
    assert.deepEqual(oversized, before);
});

test('capacity accepts an empty batch without changing the existing document', () => {
    const existing = [{ type: 'pin', points: [[0, 100]] }];
    const before = structuredClone(existing);
    assert.doesNotThrow(() => assertBoundaryDrawingBatchCapacity(existing, []));
    assert.deepEqual(existing, before);
});

for (const [field, fields] of [
    ['text', { text: { toString: 0 } }],
    ['style.color', { style: { color: { toString: 0 } } }],
    ['style.weight', { style: { weight: { valueOf: 0, toString: 0 } } }],
]) {
    test(`snapshot rejects malformed ${field} with a typed geometry error`, () => {
        rejects(() => canonicalizeBoundaryDrawing({ ...circle(), ...fields }), 'geometry');
    });
}

test('oversized point and control lists are rejected before reading any coordinates', () => {
    for (const field of ['points', 'controlPoints']) {
        const list = Array(field === 'points' ? 501 : 201);
        Object.defineProperty(list, 0, { get() { throw Error('excess coordinate list was traversed'); } });
        const raw = { type: 'polygon', points: square, [field]: list };
        rejects(() => canonicalizeBoundaryDrawing(raw), 'vertices');
    }
});

test('over-count batches reject before accessing any drawing', () => {
    const drawings = Array(201);
    Object.defineProperty(drawings, 0, { get() { throw Error('excess drawing batch was traversed'); } });
    rejects(() => assertBoundaryDrawingBatchCapacity([], drawings), 'count');
});

test('over-budget batches reject before reading the excess geometry coordinates or style', () => {
    const part = Array.from({ length: 250 }, () => square).flat();
    const large = boundary(Array.from({ length: 10 }, () => part).flat(), Array.from({ length: 10 }, () => [1000]));
    const excess = circle();
    Object.defineProperty(excess.points, 0, { get() { throw Error('excess coordinates were traversed'); } });
    Object.defineProperty(large, 'style', { get() { throw Error('geometry cloned before budget check'); } });
    rejects(() => assertBoundaryDrawingBatchCapacity([], [large, excess]), 'budget');
});
