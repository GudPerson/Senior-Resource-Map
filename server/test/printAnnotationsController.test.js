import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    getPrintAnnotationDocument,
    PRINT_ANNOTATION_MAX_CONTROL_POINTS,
    replacePrintAnnotationDocument,
    validatePrintAnnotationDocumentInput,
} from '../src/controllers/printAnnotationsController.js';
import { myMapPrintAnnotationDocuments } from '../src/db/schema.js';

const OWNER = { id: 7, role: 'standard' };
const MAP_ID = 3;

function createPolygon(overrides = {}) {
    const points = [
        [1.381, 103.741],
        [1.384, 103.746],
        [1.379, 103.749],
    ];
    return {
        id: 'annotation_boundary_1',
        type: 'polygon',
        points,
        controlPoints: points,
        text: 'Walking area',
        style: {
            color: '#0F766E',
            fillColor: '#14B8A6',
            fillOpacity: 0.14,
            weight: 3,
            dashed: false,
            textColor: '#0F172A',
            fontSize: 14,
        },
        ...overrides,
    };
}

function createFakeDb({ ownsMap = true } = {}) {
    const state = {
        document: null,
    };
    return {
        state,
        query: {
            myMaps: {
                findFirst: async () => (ownsMap ? { id: MAP_ID } : null),
            },
            myMapPrintAnnotationDocuments: {
                findFirst: async () => state.document,
            },
        },
        insert(table) {
            assert.equal(table, myMapPrintAnnotationDocuments);
            return {
                values(value) {
                    state.document = { ...value };
                    return {
                        returning: async () => [state.document],
                    };
                },
            };
        },
        update(table) {
            assert.equal(table, myMapPrintAnnotationDocuments);
            return {
                set(value) {
                    return {
                        where() {
                            state.document = { ...state.document, ...value };
                            return {
                                returning: async () => [state.document],
                            };
                        },
                    };
                },
            };
        },
    };
}

function createBoundaryPoints(count) {
    return Array.from({ length: count }, (unused, index) => [
        1.3 + (index * 0.000001),
        103.7 + (index * 0.000001),
    ]);
}

test('print annotation validation accepts sparse polygon control anchors', () => {
    const input = {
        schemaVersion: 1,
        revision: 2,
        annotations: [
            createPolygon(),
        ],
    };

    assert.deepEqual(validatePrintAnnotationDocumentInput(input), input);
});

test('print annotation validation accepts two hundred polygon control anchors', () => {
    const points = createBoundaryPoints(PRINT_ANNOTATION_MAX_CONTROL_POINTS);
    const input = {
        schemaVersion: 1,
        annotations: [
            createPolygon({
                points,
                controlPoints: points,
            }),
        ],
    };

    assert.equal(PRINT_ANNOTATION_MAX_CONTROL_POINTS, 200);
    assert.deepEqual(validatePrintAnnotationDocumentInput(input), input);
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [
                createPolygon({
                    points: createBoundaryPoints(PRINT_ANNOTATION_MAX_CONTROL_POINTS + 1),
                    controlPoints: createBoundaryPoints(PRINT_ANNOTATION_MAX_CONTROL_POINTS + 1),
                }),
            ],
        }),
        /Print annotations is invalid/,
    );
});

test('print annotation validation accepts bounded lines, circles, and typography', () => {
    const circleAnnotation = createPolygon({
        id: 'annotation_circle_1',
        type: 'circle',
        points: [
            [1.381, 103.741],
            [1.382, 103.742],
        ],
        controlPoints: undefined,
        text: 'Meeting zone',
        rotationDegrees: -45,
        style: {
            ...createPolygon().style,
            textColor: '#123456',
            fontSize: 22,
        },
    });
    const lineAnnotation = createPolygon({
        id: 'annotation_line_1',
        type: 'line',
        points: [
            [1.381, 103.741],
            [1.382, 103.742],
        ],
        controlPoints: undefined,
        text: '',
    });
    const input = {
        schemaVersion: 1,
        annotations: [circleAnnotation, lineAnnotation],
    };

    assert.deepEqual(validatePrintAnnotationDocumentInput(input), input);
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [{
                ...circleAnnotation,
                style: { ...circleAnnotation.style, fontSize: 40 },
            }],
        }),
        /Print annotations is invalid/,
    );
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [{
                ...circleAnnotation,
                rotationDegrees: 181,
            }],
        }),
        /Print annotations is invalid/,
    );
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [{
                ...lineAnnotation,
                rotationDegrees: 20,
            }],
        }),
        /Print annotations is invalid/,
    );
});

test('print annotation validation rejects freehand data and duplicate or oversized shapes', () => {
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [createPolygon({ type: 'lasso' })],
        }),
        /Print annotations is invalid/,
    );
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [createPolygon({
                id: 'retired_arrow',
                type: 'arrow',
                points: createPolygon().points.slice(0, 2),
                controlPoints: undefined,
            })],
        }),
        /Print annotations is invalid/,
    );
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: [
                createPolygon(),
                createPolygon(),
            ],
        }),
        /Annotation ids must be unique/,
    );
    assert.throws(
        () => validatePrintAnnotationDocumentInput({
            schemaVersion: 1,
            annotations: Array.from({ length: 5 }, (_, index) => createPolygon({
                id: `large_boundary_${index}`,
                points: Array.from({ length: 500 }, (unused, pointIndex) => (
                    [1.3 + pointIndex * 0.000001, 103.7 + pointIndex * 0.000001]
                )),
            })),
        }),
        /at most 2000 total points/,
    );
});

test('owners can fetch and revision-save private print annotation documents', async () => {
    const db = createFakeDb();
    const empty = await getPrintAnnotationDocument(db, OWNER, MAP_ID);
    assert.deepEqual(empty.annotations, []);
    assert.equal(empty.revision, 0);

    const firstBody = validatePrintAnnotationDocumentInput({
        schemaVersion: 1,
        revision: 0,
        annotations: [createPolygon()],
    });
    const first = await replacePrintAnnotationDocument(db, OWNER, MAP_ID, firstBody);
    assert.equal(first.revision, 1);
    assert.equal(first.annotations[0].controlPoints.length, 3);

    const secondBody = validatePrintAnnotationDocumentInput({
        schemaVersion: 1,
        revision: 1,
        annotations: [createPolygon({ text: 'Updated walking area' })],
    });
    const second = await replacePrintAnnotationDocument(db, OWNER, MAP_ID, secondBody);
    assert.equal(second.revision, 2);
    assert.equal(second.annotations[0].text, 'Updated walking area');

    await assert.rejects(
        replacePrintAnnotationDocument(db, OWNER, MAP_ID, firstBody),
        (error) => error.status === 409,
    );
});

test('guests and non-owners cannot read or mutate print annotations', async () => {
    const db = createFakeDb();
    await assert.rejects(
        getPrintAnnotationDocument(db, { id: 9, role: 'guest' }, MAP_ID),
        (error) => error.status === 403,
    );
    await assert.rejects(
        replacePrintAnnotationDocument(db, { id: 9, role: 'guest' }, MAP_ID, {
            annotations: [],
        }),
        (error) => error.status === 403,
    );

    const foreignDb = createFakeDb({ ownsMap: false });
    await assert.rejects(
        getPrintAnnotationDocument(foreignDb, OWNER, MAP_ID),
        (error) => error.status === 404,
    );
    await assert.rejects(
        replacePrintAnnotationDocument(foreignDb, OWNER, MAP_ID, {
            annotations: [],
        }),
        (error) => error.status === 404,
    );
});

test('shared map generation has no print annotation dependency and map deletion cascades', () => {
    const schemaSource = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
    const sharedControllerSource = fs.readFileSync(
        new URL('../src/controllers/myMapsController.js', import.meta.url),
        'utf8',
    );
    const routeSource = fs.readFileSync(
        new URL('../src/routes/myMaps.js', import.meta.url),
        'utf8',
    );

    assert.match(
        schemaSource,
        /my_map_print_annotation_documents[\s\S]*references\(\(\) => myMaps\.id, \{ onDelete: 'cascade' \}\)/,
    );
    assert.doesNotMatch(routeSource, /print-annotations\/refine-roads/);
    assert.doesNotMatch(sharedControllerSource, /myMapPrintAnnotationDocuments|printAnnotationDocument/);
});
