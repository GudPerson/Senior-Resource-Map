import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKmlRing, appendKmlBoundaries, buildKmlBoundaryPreview } from '../src/lib/kmlBoundaries.js';
import { normalizePrintAnnotation, normalizePrintAnnotations, duplicatePrintAnnotation,
    buildPrintAnnotationPolygonPoints, translatePrintAnnotationPoints, rotatePrintAnnotationPoints,
    movePrintAnnotationControlPoint } from '../src/lib/printAnnotations.js';

const circle = (count, lat = 1.3, lng = 103.7) => Array.from({ length: count }, (_, i) => {
    const angle = i * 2 * Math.PI / count;
    return [lat + Math.sin(angle) * 0.001, lng + Math.cos(angle) * 0.001];
});
const square = [[1, 103], [1, 104], [2, 104], [2, 103]];
const hole = [[1.2, 103.2], [1.2, 103.4], [1.4, 103.4], [1.4, 103.2]];
const other = square.map(([lat, lng]) => [lat + 2, lng + 2]);
const boundary = { name: 'Two parts with a cut-out', points: [...square, ...hole, ...other], boundaryParts: [[4, 4], [4]], style: {} };

test('1,000 original corners import and reload intact; 1,001 is refused', () => {
    const points = circle(1000);
    const ring = [...points, points[0]].map(([lat, lng]) => `${lng},${lat},0`).join(' ');
    assert.deepEqual(parseKmlRing(ring), points);
    const batch = appendKmlBoundaries([], [{ name: 'Dense area', points, style: {} }]);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(batch))), batch);
    assert.equal(batch[0].controlPoints.length, 1000);
    assert.throws(() => appendKmlBoundaries([], [{ name: 'Too dense', points: circle(1001), style: {} }]), e => e.code === 'vertices');
});

test('part and hole structure survives saving, reload, duplicate and display', () => {
    const annotation = appendKmlBoundaries([], [boundary])[0];
    assert.deepEqual(annotation.boundaryParts, [[4, 4], [4]]);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify([annotation]))), [annotation]);
    assert.deepEqual(buildPrintAnnotationPolygonPoints(annotation), [[square, [...hole].reverse()], [other]]);
    const duplicate = duplicatePrintAnnotation(annotation, { offset: [0, 0] });
    assert.deepEqual(duplicate.boundaryParts, annotation.boundaryParts);
    assert.deepEqual(duplicate.points, boundary.points);
    assert.equal(duplicate.isShared, false);
});

test('large multipart transforms and late corner edits cannot truncate geometry', () => {
    const points = [...circle(900), ...circle(800, 1.4)];
    const annotation = appendKmlBoundaries([], [{ name: 'Dense multipart', points, boundaryParts: [[900], [800]], style: {} }])[0];
    const duplicate = duplicatePrintAnnotation(annotation);
    assert.equal(duplicate.points.length, 1700);
    assert.deepEqual(duplicate.boundaryParts, [[900], [800]]);
    const moved = translatePrintAnnotationPoints(points, points[0], [points[0][0] + 0.01, points[0][1]], 10000);
    const rotated = rotatePrintAnnotationPoints(moved, [1.3, 103.7], 45, 10000);
    const edited = movePrintAnnotationControlPoint('polygon', rotated, 1699, [1.5, 103.8], 10000);
    assert.equal(moved.length, 1700); assert.equal(rotated.length, 1700); assert.equal(edited.length, 1700);
    assert.deepEqual(edited[1699], [1.5, 103.8]);
    assert.deepEqual(normalizePrintAnnotation({ ...annotation, points: edited, controlPoints: edited }).boundaryParts, [[900], [800]]);
});

test('invalid ring structure is refused without dropping coordinates or granting drawing limits', () => {
    const annotation = appendKmlBoundaries([], [boundary])[0];
    for (const boundaryParts of [[[4], [4]], [[2, 6], [4]], [[4.5, 3.5], [4]], [], [[4, -4], [12]]]) {
        assert.equal(normalizePrintAnnotation({ ...annotation, boundaryParts }), null);
    }
    const changedPoints = annotation.points.slice(1);
    assert.equal(normalizePrintAnnotation({ ...annotation, points: changedPoints }), null);
});

test('multipart preview has a separate closed path per part and a subpath for each hole', () => {
    const preview = buildKmlBoundaryPreview([boundary])[0];
    assert.equal(preview.svgPaths.length, 2);
    assert.equal((preview.svgPaths[0].match(/M/g) || []).length, 2);
    assert.equal((preview.svgPaths[0].match(/Z/g) || []).length, 2);
    assert.equal((preview.svgPaths[1].match(/M/g) || []).length, 1);
});

test('all rings count against the unchanged 20,000-point budget and import is atomic', () => {
    const part = circle(1000);
    const geometry = { name: 'Large composite', points: Array.from({ length: 10 }, () => part).flat(), boundaryParts: Array.from({ length: 10 }, () => [1000]), style: {} };
    const batch = appendKmlBoundaries([], [geometry]);
    assert.equal(batch[0].points.length + batch[0].controlPoints.length, 20000);
    const before = JSON.stringify(batch);
    assert.throws(() => appendKmlBoundaries(batch, [boundary]), e => e.code === 'budget');
    assert.equal(JSON.stringify(batch), before);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(before)), batch);
});
