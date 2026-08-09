import test from 'node:test';
import assert from 'node:assert/strict';

import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import {
    MAP_STUDIO_SCHEMA_VERSION,
    MAP_STUDIO_MAX_LAYER_REFERENCES,
    MAP_STUDIO_MAX_REVISION,
    buildMapStudioStoredDocument,
    formatMapStudioDocument,
    validateMapStudioDocumentInput,
} from '../src/utils/mapStudioDocument.js';

function createDocument() {
    return createMapStudioDocument({
        viewId: 'view-default',
        viewName: 'Default view',
        mapStyle: 'gray',
        detailMode: 'auto',
    });
}

test('server persistence validation accepts the normalized client Map Studio document', () => {
    const document = createDocument();

    assert.deepEqual(validateMapStudioDocumentInput(document), document);
});

test('server persistence rejects temporary exploration and export state', () => {
    const document = createDocument();

    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            exploration: { query: 'private search' },
        }),
        /Map Studio design is invalid/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            export: { pageLayout: 'standard' },
        }),
        /Map Studio design is invalid/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            views: document.views.map((view) => ({
                ...view,
                design: {
                    ...view.design,
                    annotations: [{ id: 'private-geometry' }],
                },
            })),
        }),
        /Map Studio design is invalid/,
    );
});

test('server persistence fails closed for unknown versions and invalid view identity', () => {
    const document = createDocument();

    assert.throws(
        () => validateMapStudioDocumentInput({ ...document, schemaVersion: MAP_STUDIO_SCHEMA_VERSION + 1 }),
        /Map Studio design is invalid/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            defaultViewId: 'missing-view',
        }),
        /Default view must reference a view in this document/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            views: [document.views[0], { ...document.views[0] }],
        }),
        /View ids must be unique/,
    );
});

test('server persistence enforces bounded valid cameras and layer references', () => {
    const document = createDocument();
    const view = document.views[0];

    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            views: [{
                ...view,
                design: {
                    ...view.design,
                    camera: {
                        mode: 'fixed',
                        view: { center: [1.38, 103.74], zoom: 99 },
                    },
                },
            }],
        }),
        /Map Studio design is invalid/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            views: [{
                ...view,
                design: {
                    ...view.design,
                    layers: {
                        ...view.design.layers,
                        hiddenResourceLayerKeys: ['category:aac', 'category:aac'],
                    },
                },
            }],
        }),
        /Layer references must be unique/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            views: [{
                ...view,
                design: {
                    ...view.design,
                    layers: {
                        ...view.design.layers,
                        hiddenResourceLayerKeys: Array.from(
                            { length: MAP_STUDIO_MAX_LAYER_REFERENCES + 1 },
                            (_, index) => `layer:${index}`,
                        ),
                    },
                },
            }],
        }),
        /Map Studio design is invalid/,
    );
});

test('server persistence bounds revisions to the PostgreSQL compare-and-swap range', () => {
    const document = createDocument();

    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            revision: MAP_STUDIO_MAX_REVISION + 1,
        }),
        /Map Studio design is invalid/,
    );
    assert.throws(
        () => validateMapStudioDocumentInput({
            ...document,
            views: document.views.map((view) => ({
                ...view,
                revision: MAP_STUDIO_MAX_REVISION + 1,
            })),
        }),
        /Map Studio design is invalid/,
    );
});

test('stored documents keep revision metadata outside JSON and round-trip safely', () => {
    const document = createDocument();
    const stored = buildMapStudioStoredDocument(document);
    const updatedAt = new Date('2026-08-09T02:00:00.000Z');

    assert.equal(Object.hasOwn(stored, 'revision'), false);
    assert.deepEqual(formatMapStudioDocument(25, {
        document: stored,
        revision: 7,
        updatedAt,
    }), {
        mapId: 25,
        document: {
            ...document,
            revision: 7,
        },
        updatedAt,
    });
    assert.deepEqual(formatMapStudioDocument(25), {
        mapId: 25,
        document: null,
        updatedAt: null,
    });
});

test('invalid stored Map Studio data fails closed instead of reaching the owner UI', () => {
    assert.throws(
        () => formatMapStudioDocument(25, {
            document: { schemaVersion: MAP_STUDIO_SCHEMA_VERSION, views: [] },
            revision: 1,
        }),
        (error) => error.status === 500 && /Stored Map Studio design is invalid/.test(error.message),
    );
    assert.throws(
        () => formatMapStudioDocument(25, {
            schemaVersion: MAP_STUDIO_SCHEMA_VERSION + 1,
            document: buildMapStudioStoredDocument(createDocument()),
            revision: 1,
        }),
        (error) => error.status === 500 && /metadata is invalid/.test(error.message),
    );
    assert.throws(
        () => formatMapStudioDocument(25, {
            schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
            document: buildMapStudioStoredDocument(createDocument()),
            revision: 0,
        }),
        (error) => error.status === 500 && /metadata is invalid/.test(error.message),
    );
});

test('stored schema v1 documents are returned as additive schema v2 views', () => {
    const current = createDocument();
    const legacy = {
        schemaVersion: 1,
        defaultViewId: current.defaultViewId,
        views: current.views.map((view) => ({
            ...view,
            design: {
                ...view.design,
                layout: { mapHeight: 'tall', resourcePanel: 'beside-map' },
            },
        })),
    };
    const formatted = formatMapStudioDocument(25, {
        schemaVersion: 1,
        document: legacy,
        revision: 4,
    });

    assert.equal(formatted.document.schemaVersion, MAP_STUDIO_SCHEMA_VERSION);
    assert.deepEqual(formatted.document.views[0].design.layout, {
        mapHeight: 'tall',
        preset: 'map-focus',
        mapSide: 'left',
        mapWidth: 'wide',
        resourceColumnCount: 2,
        sideResourceColumnCount: 1,
    });
});
