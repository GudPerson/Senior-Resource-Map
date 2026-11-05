import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_ANNOTATION_DOCUMENT_MAX_COUNT } from '../../shared/printAnnotationLimits.js';
import { buildEmbeddedPrintAnnotationSnapshot, normalizeEmbeddedPrintAnnotationSnapshot,
    PRINT_ANNOTATION_MAX_COUNT, validatePrintAnnotationDocumentInput } from '../src/controllers/printAnnotationsController.js';
import { createPrintAnnotation, normalizePrintAnnotations } from '../../client/src/lib/printAnnotations.js';

const circle = index => ({ ...createPrintAnnotation({ type: 'circle',
    points: [[1.3, 103.8], [1.301, 103.8]], text: `Circle ${index}` }), id: `capacity_${index}`, isShared: true });

test('owner API validates exactly200 saved annotations and rejects201 without returning a truncated success', () => {
    assert.equal(PRINT_ANNOTATION_MAX_COUNT, PRINT_ANNOTATION_DOCUMENT_MAX_COUNT);
    assert.equal(PRINT_ANNOTATION_MAX_COUNT, 200);
    const annotations = Array.from({ length: 200 }, (_, index) => circle(index));
    const validated = validatePrintAnnotationDocumentInput({ schemaVersion: 1, revision: 7, annotations });
    assert.deepEqual(validated.annotations, annotations);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(validated.annotations))), annotations);
    assert.throws(() => validatePrintAnnotationDocumentInput({ schemaVersion: 1, revision: 7,
        annotations: [...annotations, circle(200)] }), error => error.status === 400);
});

test('public shared snapshots retain all200 eligible shapes while stripping owner-only organization metadata', () => {
    const annotations = Array.from({ length: 200 }, (_, index) => ({ ...circle(index), groupName: 'Private owner group' }));
    for (const snapshot of [buildEmbeddedPrintAnnotationSnapshot, normalizeEmbeddedPrintAnnotationSnapshot]) {
        const result = snapshot(annotations);
        assert.equal(result.length, 200);
        assert.deepEqual(result.map(item => item.id), annotations.map(item => item.id));
        assert.ok(result.every(item => !Object.hasOwn(item, 'groupName')));
        assert.deepEqual(snapshot([...annotations, circle(200)]), [], 'oversized public input must not be clipped into a partial snapshot');
    }
});

test('the200 count increase leaves existing image and aggregate geometry admission unchanged', () => {
    const valid = Array.from({ length: 200 }, (_, index) => circle(index));
    const repeated = Array.from({ length: 200 }, (_, index) => [1.3 + index * .000001, 103.8]);
    const dense = valid.slice(0, 51).map(item => ({ ...item, type: 'polygon', points: repeated, controlPoints: repeated }));
    assert.throws(() => validatePrintAnnotationDocumentInput({ schemaVersion: 1, annotations: dense }), /Print annotations is invalid/);
});
