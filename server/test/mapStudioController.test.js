import test from 'node:test';
import assert from 'node:assert/strict';

import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import {
    getMapStudioDocument,
    replaceMapStudioDocument,
} from '../src/controllers/mapStudioController.js';
import { myMapStudioDocuments, myMaps } from '../src/db/schema.js';

const OWNER = { id: 7, role: 'standard' };
const MAP_ID = 25;

function createDocument(overrides = {}) {
    return {
        ...createMapStudioDocument({
            viewId: 'view-default',
            viewName: 'Default view',
            mapStyle: 'default',
            detailMode: 'auto',
        }),
        ...overrides,
    };
}

function getWhereParamValues(value, output = []) {
    if (!value || typeof value !== 'object') return output;
    if (value.constructor?.name === 'Param') {
        output.push(value.value);
        return output;
    }
    if (Array.isArray(value.queryChunks)) {
        value.queryChunks.forEach((chunk) => getWhereParamValues(chunk, output));
    }
    return output;
}

function createFakeDb({ ownsMap = true, row = null } = {}) {
    const state = {
        row: row ? { ...row } : null,
        documentReadCount: 0,
        mapUpdateCount: 0,
    };
    return {
        state,
        query: {
            myMaps: {
                findFirst: async () => (ownsMap ? { id: MAP_ID } : null),
            },
            myMapStudioDocuments: {
                findFirst: async () => {
                    state.documentReadCount += 1;
                    return state.row;
                },
            },
        },
        insert(table) {
            assert.equal(table, myMapStudioDocuments);
            return {
                values(value) {
                    return {
                        onConflictDoNothing() {
                            return {
                                returning: async () => {
                                    if (state.row) return [];
                                    state.row = { ...value };
                                    return [state.row];
                                },
                            };
                        },
                    };
                },
            };
        },
        update(table) {
            if (table === myMaps) {
                state.mapUpdateCount += 1;
                throw new Error('Map Studio saves must not update my_maps');
            }
            assert.equal(table, myMapStudioDocuments);
            return {
                set(value) {
                    return {
                        where(where) {
                            const [mapId, revision] = getWhereParamValues(where);
                            return {
                                returning: async () => {
                                    if (
                                        !state.row
                                        || state.row.mapId !== mapId
                                        || state.row.revision !== revision
                                    ) {
                                        return [];
                                    }
                                    state.row = { ...state.row, ...value };
                                    return [state.row];
                                },
                            };
                        },
                    };
                },
            };
        },
    };
}

test('owners lazily fetch a null Map Studio document without creating rows', async () => {
    const db = createFakeDb();

    assert.deepEqual(await getMapStudioDocument(db, OWNER, MAP_ID), {
        mapId: MAP_ID,
        document: null,
        updatedAt: null,
    });
    assert.equal(db.state.row, null);
    assert.equal(db.state.documentReadCount, 1);
});

test('revision zero atomically creates the first private Map Studio document', async () => {
    const db = createFakeDb();
    const result = await replaceMapStudioDocument(db, OWNER, MAP_ID, createDocument());

    assert.equal(result.mapId, MAP_ID);
    assert.equal(result.document.revision, 1);
    assert.equal(db.state.row.revision, 1);
    assert.equal(db.state.row.schemaVersion, 1);
    assert.equal(Object.hasOwn(db.state.row.document, 'revision'), false);
    assert.equal(db.state.documentReadCount, 0, 'PUT must use compare-and-swap without a read-before-write');
    assert.equal(db.state.mapUpdateCount, 0, 'private design saves must not mark a frozen share stale');
});

test('subsequent saves compare-and-swap the external revision and reject stale writers', async () => {
    const initialDocument = createDocument();
    const db = createFakeDb({
        row: {
            mapId: MAP_ID,
            schemaVersion: 1,
            document: {
                schemaVersion: initialDocument.schemaVersion,
                defaultViewId: initialDocument.defaultViewId,
                views: initialDocument.views,
            },
            revision: 1,
            createdAt: new Date('2026-08-09T01:00:00.000Z'),
            updatedAt: new Date('2026-08-09T01:00:00.000Z'),
        },
    });
    const updatedBody = createDocument({
        revision: 1,
        views: initialDocument.views.map((view) => ({ ...view, name: 'Service planning' })),
    });

    const saved = await replaceMapStudioDocument(db, OWNER, MAP_ID, updatedBody);
    assert.equal(saved.document.revision, 2);
    assert.equal(saved.document.views[0].name, 'Service planning');
    assert.equal(db.state.documentReadCount, 0);
    assert.equal(db.state.mapUpdateCount, 0);

    await assert.rejects(
        () => replaceMapStudioDocument(db, OWNER, MAP_ID, updatedBody),
        (error) => error.status === 409 && /another session/.test(error.message),
    );
});

test('revision zero conflicts when another session already created a document', async () => {
    const document = createDocument();
    const db = createFakeDb({
        row: {
            mapId: MAP_ID,
            schemaVersion: 1,
            document: {
                schemaVersion: document.schemaVersion,
                defaultViewId: document.defaultViewId,
                views: document.views,
            },
            revision: 1,
        },
    });

    await assert.rejects(
        () => replaceMapStudioDocument(db, OWNER, MAP_ID, document),
        (error) => error.status === 409,
    );
});

test('Map Studio persistence rejects guests, foreign maps, and temporary state', async () => {
    const db = createFakeDb();
    await assert.rejects(
        () => getMapStudioDocument(db, { id: 7, role: 'guest' }, MAP_ID),
        (error) => error.status === 403,
    );
    await assert.rejects(
        () => replaceMapStudioDocument(
            createFakeDb({ ownsMap: false }),
            OWNER,
            MAP_ID,
            createDocument(),
        ),
        (error) => error.status === 404,
    );
    await assert.rejects(
        () => replaceMapStudioDocument(db, OWNER, MAP_ID, {
            ...createDocument(),
            exploration: { query: 'private search state' },
        }),
        (error) => error.status === 400,
    );
    assert.equal(db.state.row, null);
});
