import test from 'node:test';
import assert from 'node:assert/strict';

import { copySharedMapToMyMaps, getSharedMapDirectory } from '../src/controllers/sharedMapsController.js';
import { myMapAssetNotes, myMapAssets, myMaps } from '../src/db/schema.js';

const GUEST_USER = { role: 'guest' };
const OWNER_USER = { id: 7, role: 'standard', postalCode: '680153' };
const RECIPIENT_USER = { id: 12, role: 'standard', postalCode: '680153' };

function createSharedMap(overrides = {}) {
    return {
        id: 3,
        userId: OWNER_USER.id,
        name: 'Neighbourhood support',
        description: 'Helpful services around Teck Whye.',
        isShared: true,
        shareToken: 'shared-token',
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: new Date('2026-03-20T09:00:00.000Z'),
        createdAt: new Date('2026-03-19T09:00:00.000Z'),
        updatedAt: new Date('2026-03-20T09:00:00.000Z'),
        ...overrides,
    };
}

function createMapAsset(overrides = {}) {
    return {
        id: 11,
        mapId: 3,
        resourceType: 'hard',
        resourceId: 29,
        privateNote: null,
        handoffNote: null,
        notesUpdatedAt: null,
        snapshot: {
            name: 'Saved centre snapshot',
            subCategory: 'Active Ageing Centre',
            address: '153 Jalan Teck Whye Singapore 680153',
            lat: 1.38123,
            lng: 103.75001,
            detailPath: '/resource/hard/29',
        },
        addedAt: new Date('2026-03-20T09:05:00.000Z'),
        ...overrides,
    };
}

function createSnapshotDirectory(overrides = {}) {
    return {
        id: 3,
        name: 'Neighbourhood support',
        description: 'Helpful services around Teck Whye.',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
        summary: {
            resourceCount: 1,
            placeCount: 1,
            mappablePlaceCount: 1,
        },
        share: {
            isShared: true,
            shareToken: 'shared-token',
            sharePath: '/shared/maps/shared-token',
            shareIncludesHandoffNotes: false,
            shareUpdatedAt: '2026-03-20T09:00:00.000Z',
        },
        assets: [{
            assetKey: 'hard-29',
            resourceType: 'hard',
            resourceId: 29,
            status: 'available',
            notes: {
                items: [{ id: 1, text: 'Original shared note.', isShared: true }],
            },
        }],
        places: [{
            placeKey: 'hard-29',
            placeId: 29,
            name: 'Fei Yue Active Ageing Centre',
            address: '153 Jalan Teck Whye Singapore 680153',
            lat: 1.38123,
            lng: 103.75001,
            hasCoordinates: true,
            rows: [{
                rowKey: '11:hard-29',
                resourceType: 'hard',
                resourceId: 29,
                assetKey: 'hard-29',
                name: 'Fei Yue Active Ageing Centre',
                subCategory: 'Active Ageing Centre',
                status: 'available',
                detailPath: '/resource/hard/29',
                saveEligible: true,
                notes: {
                    items: [{ id: 1, text: 'Original shared note.', isShared: true }],
                },
            }],
        }],
        pins: [{
            placeKey: 'hard-29',
            lat: 1.38123,
            lng: 103.75001,
            count: 1,
        }],
        viewer: {
            isAuthenticated: false,
            isOwner: false,
            canSaveCopy: false,
            canSaveResources: false,
            copyDefaultName: null,
        },
        ...overrides,
    };
}

function createHardAsset(overrides = {}) {
    return {
        id: 29,
        name: 'Fei Yue Active Ageing Centre',
        subCategory: 'Active Ageing Centre',
        address: '153 Jalan Teck Whye Singapore 680153',
        lat: '1.38123',
        lng: '103.75001',
        hours: 'Mon-Fri 8am-6pm',
        logoUrl: null,
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
        partner: null,
        ...overrides,
    };
}

function attachAssets(state, map) {
    if (!map) return null;
    return {
        ...map,
        assets: state.mapAssets
            .filter((asset) => asset.mapId === map.id)
            .map((asset) => ({
                ...asset,
                notes: state.mapAssetNotes
                    .filter((note) => note.mapAssetId === asset.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
            })),
        shareSnapshot: state.shareSnapshots.find((snapshot) => snapshot.mapId === map.id) || null,
    };
}

function createFakeDb({
    maps = [],
    mapAssets = [],
    mapAssetNotes = [],
    shareSnapshots = [],
    hardAsset = null,
} = {}) {
    const state = {
        maps: maps.map((item) => ({ ...item })),
        mapAssets: mapAssets.map((item) => ({ ...item })),
        mapAssetNotes: mapAssetNotes.map((item) => ({ ...item })),
        shareSnapshots: shareSnapshots.map((item) => ({ ...item })),
        hardAsset,
        nextMapId: maps.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetId: mapAssets.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetNoteId: mapAssetNotes.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
    };

    return {
        state,
        query: {
            myMaps: {
                findMany: async ({ where } = {}) => {
                    void where;
                    return state.maps.map((map) => attachAssets(state, map));
                },
                findFirst: async () => attachAssets(
                    state,
                    state.maps.find((map) => map.isShared && map.shareToken) || null
                ),
            },
            hardAssets: {
                findFirst: async () => state.hardAsset,
            },
            softAssets: {
                findFirst: async () => null,
            },
        },
        insert(table) {
            if (table === myMaps) {
                return {
                    values(value) {
                        const row = {
                            id: state.nextMapId,
                            createdAt: new Date('2026-03-20T10:00:00.000Z'),
                            updatedAt: new Date('2026-03-20T10:00:00.000Z'),
                            ...value,
                        };
                        state.nextMapId += 1;
                        state.maps.unshift(row);
                        return {
                            returning: async () => [row],
                        };
                    },
                };
            }

            if (table === myMapAssets) {
                return {
                    values(value) {
                        const rows = (Array.isArray(value) ? value : [value]).map((item) => ({
                            id: state.nextMapAssetId += 1,
                            addedAt: new Date('2026-03-20T10:05:00.000Z'),
                            ...item,
                        }));
                        state.mapAssets.push(...rows);
                        return {
                            returning: async () => rows,
                        };
                    },
                };
            }

            if (table === myMapAssetNotes) {
                return {
                    values(value) {
                        const rows = (Array.isArray(value) ? value : [value]).map((item) => ({
                            id: state.nextMapAssetNoteId++,
                            createdAt: new Date('2026-03-20T10:06:00.000Z'),
                            updatedAt: new Date('2026-03-20T10:06:00.000Z'),
                            ...item,
                        }));
                        state.mapAssetNotes.push(...rows);
                        return {
                            returning: async () => rows,
                        };
                    },
                };
            }

            throw new Error('Unexpected table insert');
        },
        update(table) {
            assert.equal(table, myMapAssets);
            return {
                set(values) {
                    return {
                        where: async () => {
                            if (!state.mapAssets[0]) return [];
                            state.mapAssets[0] = {
                                ...state.mapAssets[0],
                                ...values,
                            };
                            return [state.mapAssets[0]];
                        },
                    };
                },
            };
        },
    };
}

test('getSharedMapDirectory returns a public grouped directory payload', async () => {
    const db = createFakeDb({
        maps: [createSharedMap()],
        mapAssets: [createMapAsset()],
        hardAsset: createHardAsset(),
    });

    const directory = await getSharedMapDirectory(db, 'shared-token', GUEST_USER);

    assert.equal(directory.name, 'Neighbourhood support');
    assert.equal(directory.summary.resourceCount, 1);
    assert.equal(directory.summary.placeCount, 1);
    assert.equal(directory.share.isShared, true);
    assert.equal(directory.pins.length, 1);
    assert.equal(directory.places[0].rows[0].name, 'Fei Yue Active Ageing Centre');
    assert.equal(directory.places[0].rows[0].notes, undefined);
    assert.equal(directory.assets[0].notes, undefined);
});

test('getSharedMapDirectory includes only handoff notes when sharing opts in', async () => {
    const db = createFakeDb({
        maps: [createSharedMap({ shareIncludesHandoffNotes: true })],
        mapAssets: [createMapAsset({
            privateNote: 'Do not show this internal reminder.',
            handoffNote: 'Please call before visiting.',
        })],
        hardAsset: createHardAsset(),
    });

    const directory = await getSharedMapDirectory(db, 'shared-token', GUEST_USER);

    assert.deepEqual(
        directory.places[0].rows[0].notes.items.map((note) => ({ text: note.text, isShared: note.isShared })),
        [{ text: 'Please call before visiting.', isShared: true }],
    );
    assert.deepEqual(
        directory.assets[0].notes.items.map((note) => ({ text: note.text, isShared: note.isShared })),
        [{ text: 'Please call before visiting.', isShared: true }],
    );
});

test('getSharedMapDirectory returns the frozen share snapshot until the owner reshares', async () => {
    const db = createFakeDb({
        maps: [createSharedMap({ shareIncludesHandoffNotes: true })],
        mapAssets: [createMapAsset({
            handoffNote: 'Updated live note that has not been reshared.',
        })],
        shareSnapshots: [{
            mapId: 3,
            shareToken: 'shared-token',
            snapshot: createSnapshotDirectory(),
        }],
        hardAsset: createHardAsset(),
    });

    const directory = await getSharedMapDirectory(db, 'shared-token', GUEST_USER);

    assert.equal(directory.places[0].rows[0].notes.items[0].text, 'Original shared note.');
    assert.equal(directory.assets[0].notes.items[0].text, 'Original shared note.');
});

test('getSharedMapDirectory returns a clean unavailable error when a token is invalid', async () => {
    const db = createFakeDb({ maps: [] });

    await assert.rejects(
        () => getSharedMapDirectory(db, 'missing-token', GUEST_USER),
        (err) => {
            assert.equal(err.status, 404);
            assert.equal(err.message, 'This shared directory is no longer available');
            return true;
        }
    );
});

test('copySharedMapToMyMaps creates a new private copy for logged-in recipients', async () => {
    const db = createFakeDb({
        maps: [createSharedMap({ shareIncludesHandoffNotes: true })],
        mapAssets: [createMapAsset({
            privateNote: 'Owner-only note.',
            handoffNote: 'Bring referral letter.',
        })],
    });

    const copied = await copySharedMapToMyMaps(db, RECIPIENT_USER, 'shared-token');

    assert.equal(copied.name, 'Copy of Neighbourhood support');
    assert.equal(copied.assetCount, 1);
    assert.equal(db.state.maps[0].userId, RECIPIENT_USER.id);
    assert.equal(db.state.maps[0].isShared, false);
    assert.equal(db.state.maps[0].shareIncludesHandoffNotes, false);
    assert.equal(db.state.mapAssets.length, 2);
    assert.equal(db.state.mapAssets[1].privateNote, null);
    assert.equal(db.state.mapAssets[1].handoffNote, null);
    assert.equal(db.state.mapAssetNotes[0].noteText, 'Bring referral letter.');
    assert.equal(db.state.mapAssetNotes[0].isShared, false);
});

test('copySharedMapToMyMaps rejects the original owner', async () => {
    const db = createFakeDb({
        maps: [createSharedMap()],
        mapAssets: [createMapAsset()],
    });

    await assert.rejects(
        () => copySharedMapToMyMaps(db, OWNER_USER, 'shared-token'),
        (err) => {
            assert.equal(err.status, 409);
            assert.equal(err.message, 'You already own this map');
            return true;
        }
    );
});
