import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_ANNOTATION_DOCUMENT_MAX_COUNT } from '../../shared/printAnnotationLimits.js';
import { PRINT_ANNOTATION_MAX_COUNT, canAddPrintAnnotation, createPrintAnnotation,
    duplicatePrintAnnotation, getPrintAnnotationCaptureKey, normalizePrintAnnotations } from '../src/lib/printAnnotations.js';
import { appendKmlBoundaries, getKmlImportCapacity } from '../src/lib/kmlBoundaries.js';
import { getKmlBoundaryMessages } from '../src/lib/kmlBoundaryMessages.js';
import { getAnnotationToolMessages } from '../src/lib/annotationToolMessages.js';
import { normalizeMapStudioDesign } from '../src/lib/mapStudioState.js';
import { setAnnotationMatchesVisible } from '../src/lib/annotationLayerManager.js';

const circle = index => ({ ...createPrintAnnotation({ type: 'circle',
    points: [[1.3, 103.8], [1.301, 103.8]], text: `Circle ${index}` }), id: `capacity_${index}` });

test('one Care Map collection accepts200 saved annotations without clipping during reload or capture', () => {
    assert.equal(PRINT_ANNOTATION_DOCUMENT_MAX_COUNT, 200);
    assert.equal(PRINT_ANNOTATION_MAX_COUNT, PRINT_ANNOTATION_DOCUMENT_MAX_COUNT);
    const annotations = Array.from({ length: 200 }, (_, index) => circle(index));
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(annotations))), annotations);
    assert.equal(JSON.parse(getPrintAnnotationCaptureKey(annotations)).length, 200);
    assert.equal(canAddPrintAnnotation(annotations.slice(0, 199), 'circle'), true);
    assert.equal(canAddPrintAnnotation(annotations, 'circle'), false);
    const duplicate = duplicatePrintAnnotation(annotations.at(-1));
    assert.equal(duplicate.type, 'circle');
    assert.equal(canAddPrintAnnotation(annotations.slice(0, 199), duplicate.type), true);
});

test('each named view can hide all200 shared annotation IDs without removing saved objects', () => {
    const catalog = Array.from({ length: 200 }, (_, index) => ({ id: `capacity_${index}` }));
    const hidden = setAnnotationMatchesVisible([], catalog, false);
    assert.equal(normalizeMapStudioDesign({ layers: { hiddenAnnotationIds: hidden } }).layers.hiddenAnnotationIds.length, 200);
    const visibleInOtherView = normalizeMapStudioDesign({ layers: { hiddenAnnotationIds: [] } });
    assert.deepEqual(visibleInOtherView.layers.hiddenAnnotationIds, []);
    assert.equal(catalog.length, 200);
});

test('whole-batch boundary import accepts200 and rejects201 without changing the prior collection', () => {
    const area = { name: 'Capacity boundary', points: [[1.3, 103.7], [1.3, 103.71], [1.31, 103.71], [1.31, 103.7]], style: {} };
    const areas = Array.from({ length: 200 }, (_, index) => ({ ...area, name: `Boundary ${index}` }));
    const imported = appendKmlBoundaries([], areas);
    assert.equal(imported.length, 200);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(imported))), imported);
    const before = JSON.stringify(imported);
    assert.equal(getKmlImportCapacity(imported, [area]), 'count');
    assert.throws(() => appendKmlBoundaries(imported, [area]), error => error.code === 'count');
    assert.equal(JSON.stringify(imported), before);
});

test('capacity copy across all locales follows the shared document limit while geometry and file limits stay distinct', () => {
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        assert.ok(getKmlBoundaryMessages(locale).errors.count.includes(String(PRINT_ANNOTATION_MAX_COUNT)));
        assert.ok(getKmlBoundaryMessages(locale).errors.size.includes('2 MB'));
    }
    for (const locale of ['en', 'zh', 'ms', 'ta']) {
        assert.ok(getAnnotationToolMessages(locale).capacity.includes(String(PRINT_ANNOTATION_MAX_COUNT)));
    }
});
