import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAnnotationGroupName, ANNOTATION_GROUP_MAX_LENGTH } from '../../shared/annotationGroups.js';
import { assignAnnotationGroup, filterAnnotationLayers, annotationVisibilitySummary, setAnnotationMatchesVisible,
    canUndoAnnotationGroupOperation, canRetryAnnotationGroupOperation, planAnnotationVisibilityChange,
    cleanOldAnnotationVisibility } from '../src/lib/annotationLayerManager.js';
import { getAnnotationLayerMessages } from '../src/lib/annotationLayerMessages.js';
import { createPrintAnnotation, duplicatePrintAnnotation, normalizePrintAnnotation } from '../src/lib/printAnnotations.js';

const catalog = [
    { id: 'a', label: 'East district', type: 'polygon', boundarySource: 'kml', groupName: 'Health teams' },
    { id: 'b', label: 'West district', type: 'polygon', boundarySource: 'kml', groupName: 'Health teams' },
    { id: 'c', label: 'East walking area', type: 'circle' },
    { id: 'd', label: 'East label', type: 'pin', groupName: 'Other' },
];

test('annotation search intersects name/group, type and custom group filters without mutating the catalogue', () => {
    const before = structuredClone(catalog);
    assert.deepEqual(filterAnnotationLayers(catalog, { query: 'EAST', type: 'boundary', group: 'group:Health teams' }).map(a => a.id), ['a']);
    assert.deepEqual(filterAnnotationLayers(catalog, { query: 'health' }).map(a => a.id), ['a', 'b']);
    assert.deepEqual(filterAnnotationLayers(catalog, { group: 'ungrouped' }).map(a => a.id), ['c']);
    assert.deepEqual(filterAnnotationLayers(catalog, { type: 'circle' }).map(a => a.id), ['c']);
    assert.deepEqual(filterAnnotationLayers(catalog, { query: 'missing' }), []);
    assert.deepEqual(catalog, before);
});

test('filtered visibility supports unchecked, mixed and checked, including empty matches', () => {
    const matches = catalog.slice(0, 2);
    assert.deepEqual(annotationVisibilitySummary(matches, ['a']), { visible: 1, total: 2, checked: false, mixed: true });
    assert.equal(annotationVisibilitySummary(matches, ['a', 'b']).checked, false);
    assert.equal(annotationVisibilitySummary(matches, []).checked, true);
    assert.deepEqual(annotationVisibilitySummary([], []), { visible: 0, total: 0, checked: false, mixed: false });
});

test('show all matching changes only those ids and preserves off-filter and stale hidden ids', () => {
    assert.deepEqual(setAnnotationMatchesVisible(['a', 'd', 'retained-deleted-id'], catalog.slice(0, 2), true), ['d', 'retained-deleted-id']);
    assert.deepEqual(setAnnotationMatchesVisible(['d'], catalog.slice(0, 2), false), ['d', 'a', 'b']);
    assert.deepEqual(setAnnotationMatchesVisible(['d'], [], true), ['d']);
});

test('over-capacity visibility proposals cannot emit a truncated write; explicit cleanup uses the full catalogue', () => {
    const full = Array.from({ length: 200 }, (_, index) => ({ id: `current-${index}` }));
    const previous = ['old-deleted-id', full[199].id];
    assert.deepEqual(planAnnotationVisibilityChange(previous, full, false), { allowed: false, hiddenIds: null });
    assert.deepEqual(previous, ['old-deleted-id', full[199].id]);
    const filteredMatches = full.slice(0, 2);
    const cleaned = cleanOldAnnotationVisibility(previous, full);
    assert.deepEqual(cleaned, [full[199].id]); // Active off-filter setting is kept.
    assert.deepEqual(planAnnotationVisibilityChange(cleaned, filteredMatches, false).hiddenIds, [full[199].id, full[0].id, full[1].id]);
    assert.deepEqual(planAnnotationVisibilityChange(cleaned, full, false).hiddenIds.sort(), full.map(item => item.id).sort());
});

test('custom group assignment and removal preserve exact geometry, ids, style, links and unaffected references', () => {
    const annotation = createPrintAnnotation({ type: 'circle', points: [[1.3, 103.7], [1.31, 103.71]], text: 'Circle' });
    const source = [annotation, { ...annotation, id: 'unaffected' }];
    const result = assignAnnotationGroup(source, [annotation.id], '  Local   teams  ');
    assert.equal(result[0].groupName, 'Local teams');
    const { groupName, ...withoutGroup } = result[0];
    void groupName;
    assert.deepEqual(withoutGroup, annotation);
    assert.equal(result[0].points, annotation.points);
    assert.equal(result[0].style, annotation.style);
    assert.equal(result[1], source[1]);
    assert.deepEqual(assignAnnotationGroup(result, [annotation.id], ''), source);
    assert.equal(assignAnnotationGroup(result, [annotation.id], 'Local teams')[0], result[0]);
});

test('optional group metadata survives normalization and duplication, while legacy drawing shape stays exact', () => {
    const legacy = createPrintAnnotation({ type: 'circle', points: [[1.3, 103.7], [1.31, 103.71]], text: 'Circle' });
    assert.equal(Object.hasOwn(legacy, 'groupName'), false);
    assert.deepEqual(normalizePrintAnnotation({ ...legacy, groupName: '' }), legacy);
    assert.deepEqual(normalizePrintAnnotation({ ...legacy, groupName: { name: 'Ignored' } }), legacy);
    const grouped = normalizePrintAnnotation({ ...legacy, groupName: '  Review\n team  ' });
    assert.equal(grouped.groupName, 'Review team');
    assert.equal(duplicatePrintAnnotation(grouped).groupName, 'Review team');
    assert.equal(normalizeAnnotationGroupName('x'.repeat(100)).length, ANNOTATION_GROUP_MAX_LENGTH);
});

test('new annotation manager copy is complete in every supported locale', () => {
    const english = getAnnotationLayerMessages('en');
    for (const locale of ['zh', 'ms', 'ta']) {
        const translated = getAnnotationLayerMessages(locale);
        assert.deepEqual(Object.keys(translated), Object.keys(english));
        assert.ok(Object.values(translated).every(value => typeof value === 'string' && value.length));
    }
});

test('group recovery requires this owner map and the exact latest annotation document', () => {
    const annotations = [createPrintAnnotation({ type: 'circle', points: [[1.3, 103.7], [1.31, 103.71]], text: 'Circle' })];
    const operation = { mapId: 3, failed: true, reverted: false, expectedDocument: JSON.stringify(annotations) };
    const context = { mapId: 3, annotations, ownerReady: true, canUndo: true };
    assert.equal(canUndoAnnotationGroupOperation(operation, context), true);
    assert.equal(canRetryAnnotationGroupOperation(operation, context), true);
    for (const changed of [{ ...context, ownerReady: false }, { ...context, mapId: 4 },
        { ...context, annotations: [{ ...annotations[0], groupName: 'Another edit' }] },
        { ...context, annotations: [{ ...annotations[0], points: [[1.4, 103.7], [1.41, 103.71]] }] }]) {
        assert.equal(canUndoAnnotationGroupOperation(operation, changed), false);
        assert.equal(canRetryAnnotationGroupOperation(operation, changed), false);
    }
    assert.equal(canUndoAnnotationGroupOperation(operation, { ...context, canUndo: false }), false);
    assert.equal(canUndoAnnotationGroupOperation({ ...operation, reverted: true }, context), false);
    assert.equal(canRetryAnnotationGroupOperation({ ...operation, failed: false }, context), false);
    assert.equal(canRetryAnnotationGroupOperation(null, context), false); // Initial load failure is never a group save.
    assert.equal(canUndoAnnotationGroupOperation(null, { ...context, mapId: undefined }), false);
});
