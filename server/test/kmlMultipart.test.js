import test from 'node:test';
import assert from 'node:assert/strict';
import { appendKmlBoundaries } from '../../client/src/lib/kmlBoundaries.js';
import { validatePrintAnnotationDocumentInput, buildEmbeddedPrintAnnotationSnapshot, normalizeEmbeddedPrintAnnotationSnapshot } from '../src/controllers/printAnnotationsController.js';
const circle = count => Array.from({ length: count }, (_, i) => [1.3 + Math.sin(i * 2 * Math.PI / count) * 0.001, 103.7 + Math.cos(i * 2 * Math.PI / count) * 0.001]);
const validate = annotations => validatePrintAnnotationDocumentInput({ schemaVersion: 1, revision: 0, annotations });
const imported = (parts = [[900, 10], [800]]) => appendKmlBoundaries([], [{ name: 'Complex boundary', points: parts.flatMap(rings => rings.flatMap(circle)), boundaryParts: parts, style: {} }])[0];

test('owner validator preserves complete multipart coordinates and holes without schema migration', () => {
    const area = imported();
    const body = validate([area]);
    assert.deepEqual(body.annotations, [area]);
    assert.deepEqual(validate(JSON.parse(JSON.stringify(body.annotations))).annotations, [area]);
    assert.equal(area.points.length, 1710);
});
test('ring metadata cannot lose corners, exceed part limits or grant public sharing', () => {
    const area = imported();
    for (const patch of [{ boundaryParts: [[900], [800]] }, { boundaryParts: [[1001], [709]] },
        { boundaryParts: [[900, 810]] }, { boundaryParts: [[2, 908], [800]] }, { boundaryParts: [] },
        { controlPoints: area.controlPoints.slice(0, -1) }, { isShared: true }, { boundarySource: undefined }]) {
        assert.throws(() => validate([{ ...area, ...patch }]), /Print annotations is invalid/);
    }
});
test('1,000 simple corners accepted, drawings retain the 200-control-point cap', () => {
    const area = appendKmlBoundaries([], [{ name: 'Simple dense boundary', points: circle(1000), style: {} }])[0];
    assert.deepEqual(validate([area]).annotations, [area]);
    assert.throws(() => validate([{ ...area, boundarySource: undefined }]), /Print annotations is invalid/);
    const over = circle(1001);
    assert.throws(() => validate([{ ...area, points: over, controlPoints: over }]), /Print annotations is invalid/);
});
test('all parts and hole coordinates count against 20,000 stored points', () => {
    const area = imported(Array.from({ length: 10 }, () => [1000]));
    assert.equal(validate([area]).annotations[0].points.length, 10000);
    assert.throws(() => validate([area, { ...imported([[3]]), id: 'extra' }]), /Print annotations is invalid/);
});
test('complex private import and forged import metadata remain excluded from public snapshots', () => {
    const area = imported();
    assert.deepEqual(buildEmbeddedPrintAnnotationSnapshot([{ ...area, isShared: true }]), []);
    assert.deepEqual(normalizeEmbeddedPrintAnnotationSnapshot([{ ...area, isShared: true }]), []);
});
