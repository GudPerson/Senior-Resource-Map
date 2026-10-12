import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeoJsonBoundaries } from '../../client/src/lib/geoJsonBoundaries.js';
import { appendKmlBoundaries } from '../../client/src/lib/kmlBoundaries.js';
import { validatePrintAnnotationDocumentInput, buildEmbeddedPrintAnnotationSnapshot, normalizeEmbeddedPrintAnnotationSnapshot } from '../src/controllers/printAnnotationsController.js';

const outer = [[103.7, 1.3], [103.8, 1.3], [103.8, 1.4], [103.7, 1.4], [103.7, 1.3]];
const hole = [[103.72, 1.32], [103.74, 1.32], [103.74, 1.34], [103.72, 1.34], [103.72, 1.32]];
const area = () => appendKmlBoundaries([], parseGeoJsonBoundaries(JSON.stringify({ type: 'Feature', properties: { Name: 'Private boundary' },
    geometry: { type: 'MultiPolygon', coordinates: [[outer, hole], [outer.map(([x, y]) => [x + 0.2, y])]] } })).boundaries)[0];
const validate = annotations => validatePrintAnnotationDocumentInput({ schemaVersion: 1, revision: 0, annotations });

test('GeoJSON owner input retains exact ring coordinates and the backward-compatible boundary document in the current schema', () => {
    const imported = area();
    assert.deepEqual(validate([imported]).annotations, [imported]);
    assert.deepEqual(validate(JSON.parse(JSON.stringify([imported]))).annotations, [imported]);
    assert.equal(imported.boundarySource, 'kml'); assert.equal(imported.isShared, false);
    assert.deepEqual(imported.boundaryParts, [[4, 4], [4]]);
});

test('GeoJSON provenance cannot permit sharing, malformed rings, changed coordinates or non-polygon types', () => {
    const imported = area();
    for (const patch of [{ isShared: true }, { boundarySource: 'other' }, { boundaryParts: [[4], [4]] },
        { boundaryParts: [[1001]] }, { controlPoints: undefined },
        { controlPoints: imported.points.map(([lat, lng]) => [lat + 0.01, lng]) },
        { type: 'line', points: imported.points.slice(0, 2), controlPoints: undefined }]) {
        assert.throws(() => validate([{ ...imported, ...patch }]), /Print annotations is invalid/);
    }
});

test('GeoJSON private annotations are excluded from both public snapshot paths even with forged sharing', () => {
    const imported = area();
    for (const snapshot of [buildEmbeddedPrintAnnotationSnapshot, normalizeEmbeddedPrintAnnotationSnapshot]) {
        assert.deepEqual(snapshot([imported]), []);
        assert.deepEqual(snapshot([{ ...imported, isShared: true }]), []);
    }
});

test('the unchanged server budget includes both coordinate arrays for GeoJSON and existing annotations', () => {
    const imported = area();
    const annotations = Array.from({ length: 100 }, (_, i) => ({ ...imported, id: `area_${i}` }));
    assert.equal(validate(annotations).annotations.length, 100);
    assert.throws(() => validate([...annotations, { ...imported, id: 'extra' }]), /Print annotations is invalid/);
    const points = Array.from({ length: 1000 }, (_, i) => [1.3 + Math.sin(i * Math.PI * 2 / 1000) * 0.001, 103.7 + Math.cos(i * Math.PI * 2 / 1000) * 0.001]);
    const full = appendKmlBoundaries([], [{ name: 'Full exact geometry', points: Array.from({ length: 10 }, () => points).flat(),
        boundaryParts: Array.from({ length: 10 }, () => [1000]), style: {} }])[0];
    assert.equal(validate([full]).annotations[0].points.length, 10000);
    assert.throws(() => validate([full, imported]), /Print annotations is invalid/);
});
