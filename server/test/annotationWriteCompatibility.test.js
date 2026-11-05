import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getPrintAnnotationDocument, replacePrintAnnotationDocument, validatePrintAnnotationDocumentInput,
} from '../src/controllers/printAnnotationsController.js';
import { myMapPrintAnnotationDocuments, myMaps } from '../src/db/schema.js';
import { PRINT_ANNOTATION_CLIENT_CAPABILITIES as clientCapabilities } from '../../shared/annotationWriteCompatibility.js';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';

const user = { id: 7, role: 'standard' }, mapId = 3;
const circle = index => ({ ...createPrintAnnotation({ type: 'circle', points: [[1.3, 103.7], [1.31, 103.71]] }), id: `circle-${index}` });
const expanded = Array.from({ length: 200 }, (_, index) => circle(index));
function database(annotations = null) {
    const state = { document: annotations && { mapId, schemaVersion: 1, revision: 4, annotations: structuredClone(annotations) }, writes: [] };
    return {
        state,
        query: { myMaps: { findFirst: async () => ({ id: mapId }) }, myMapPrintAnnotationDocuments: { findFirst: async () => state.document } },
        update(table) { return { set(value) { return { where() {
            state.writes.push({ table: table === myMaps ? 'map' : 'annotations', value });
            if (table === myMaps) return Promise.resolve();
            assert.equal(table, myMapPrintAnnotationDocuments);
            state.document = { ...state.document, ...value };
            return { returning: async () => [state.document] };
        } }; } }; },
        insert(table) { assert.equal(table, myMapPrintAnnotationDocuments); return { values(value) {
            state.writes.push({ table: 'annotations', value }); state.document = { ...value };
            return { returning: async () => [state.document] };
        } }; },
    };
}
const input = (annotations, extra = {}) => validatePrintAnnotationDocumentInput({ schemaVersion: 1, revision: 4, annotations, ...extra });
const refreshRequired = error => error.status === 428 && error.code === 'ANNOTATION_CLIENT_REFRESH_REQUIRED';

test('a legacy GET→truncate→PUT cannot erase annotations101..200 and causes zero database writes', async () => {
    const db = database(expanded), before = structuredClone(db.state.document);
    const loaded = await getPrintAnnotationDocument(db, user, mapId);
    const oldClientBody = input(loaded.annotations.slice(0, 100));
    await assert.rejects(replacePrintAnnotationDocument(db, user, mapId, oldClientBody), refreshRequired);
    assert.deepEqual(db.state.writes, []);
    assert.deepEqual(db.state.document, before);
});

test('legacy clients cannot drop stored group metadata or create unsupported new feature documents', async () => {
    const grouped = [{ ...circle(0), groupName: 'Private owner group' }], db = database(grouped);
    const loaded = await getPrintAnnotationDocument(db, user, mapId);
    const oldClientAnnotations = loaded.annotations.map(({ groupName, ...annotation }) => { void groupName; return annotation; });
    for (const capabilities of [undefined, {}, { maxCount: 100, groups: true }, { maxCount: 200, groups: false }]) {
        await assert.rejects(replacePrintAnnotationDocument(db, user, mapId, input(oldClientAnnotations, { clientCapabilities: capabilities })), refreshRequired);
    }
    assert.deepEqual(db.state.document.annotations, grouped);
    assert.deepEqual(db.state.writes, []);
    const legacyDb = database([circle(0)]);
    await assert.rejects(replacePrintAnnotationDocument(legacyDb, user, mapId, input(grouped)), refreshRequired);
    await assert.rejects(replacePrintAnnotationDocument(legacyDb, user, mapId, input(expanded)), refreshRequired);
    assert.deepEqual(legacyDb.state.writes, []);
});

test('current clients persist all200 and groups through the existing revision queue without storing capability flags', async () => {
    const db = database(expanded);
    const annotations = expanded.map((annotation, index) => index === 199 ? { ...annotation, groupName: 'Team areas' } : annotation);
    const saved = await replacePrintAnnotationDocument(db, user, mapId, input(annotations, { clientCapabilities }));
    assert.equal(saved.annotations.length, 200);
    assert.equal(saved.annotations[199].groupName, 'Team areas');
    assert.equal(saved.revision, 5);
    assert.deepEqual(saved.annotations, annotations);
    assert.equal(Object.hasOwn(db.state.document, 'clientCapabilities'), false);
    assert.equal((await getPrintAnnotationDocument(db, user, mapId)).annotations.length, 200);
});

test('unchanged legacy documents remain writable without capabilities and existing stale-revision409 takes precedence', async () => {
    const annotations = Array.from({ length: 100 }, (_, index) => circle(index)), db = database(annotations);
    const saved = await replacePrintAnnotationDocument(db, user, mapId, input(annotations));
    assert.deepEqual(saved.annotations, annotations);
    assert.equal(saved.revision, 5);
    const protectedDb = database(expanded);
    await assert.rejects(replacePrintAnnotationDocument(protectedDb, user, mapId,
        input(annotations, { revision: 3 })), error => error.status === 409);
    assert.deepEqual(protectedDb.state.writes, []);
});
