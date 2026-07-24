import test from 'node:test';
import assert from 'node:assert/strict';

import {
    addAssetToMyMap,
    createMyMapPersonalPlace,
    createMyMap,
    deleteMyMapPersonalPlace,
    deleteMyMapRecord,
    getMyMapDetail,
    listMyMaps,
    publishMyMap,
    renameMyMap,
    updateMyMapPersonalPlace,
    updateMyMapAssetNotes,
    unpublishMyMap,
} from '../src/controllers/myMapsController.js';
import { myMapAssetNotes, myMapAssets, myMapPersonalPlaces, myMapShareSnapshots, myMaps } from '../src/db/schema.js';

const DEFAULT_USER = { id: 7, role: 'standard', postalCode: '680153' };
const PARTNER_USER = { ...DEFAULT_USER, role: 'partner' };
const DEFAULT_CONTEXT = {
    allowedPartnerAudienceIds: new Set(),
    allowedAudienceZoneIds: new Set(),
};

function createFavorite(overrides = {}) {
    return {
        id: 1,
        userId: DEFAULT_USER.id,
        resourceType: 'hard',
        resourceId: 29,
        snapshot: {
            name: 'Saved centre snapshot',
            subCategory: 'Active Ageing Centre',
            address: '153 Jalan Teck Whye Singapore 680153',
            lat: 1.38123,
            lng: 103.75001,
            detailPath: '/resource/hard/29',
        },
        createdAt: new Date('2026-03-14T09:00:00.000Z'),
        ...overrides,
    };
}

function createMap(overrides = {}) {
    return {
        id: 3,
        userId: DEFAULT_USER.id,
        name: 'Community planning',
        description: null,
        isShared: false,
        shareToken: null,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: null,
        createdAt: new Date('2026-03-14T10:00:00.000Z'),
        updatedAt: new Date('2026-03-14T10:00:00.000Z'),
        ...overrides,
    };
}

function createMapAsset(overrides = {}) {
    return {
        id: 9,
        mapId: 3,
        resourceType: 'hard',
        resourceId: 29,
        privateNote: null,
        handoffNote: null,
        notesUpdatedAt: null,
        snapshot: createFavorite().snapshot,
        addedAt: new Date('2026-03-14T10:05:00.000Z'),
        ...overrides,
    };
}

function createPersonalPlace(overrides = {}) {
    return {
        id: 5,
        mapId: 3,
        name: 'Useful coffee shop',
        categoryLabel: 'Shop',
        address: '21 Choa Chu Kang Avenue 4 Singapore 689812',
        postalCode: '689812',
        lat: '1.3851000',
        lng: '103.7449000',
        note: 'Good rest stop after appointments.',
        createdAt: new Date('2026-03-14T10:10:00.000Z'),
        updatedAt: new Date('2026-03-14T10:10:00.000Z'),
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
        personalPlaces: state.personalPlaces
            .filter((place) => place.mapId === map.id)
            .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id),
    };
}

function createFakeDb({
    favorites = [],
    maps = [],
    mapAssets = [],
    mapAssetNotes = [],
    personalPlaces = [],
    shareSnapshots = [],
    hardAsset = null,
    denyOwnedMaps = false,
} = {}) {
    const state = {
        favorites: favorites.map((item) => ({ ...item })),
        maps: maps.map((item) => ({ ...item })),
        mapAssets: mapAssets.map((item) => ({ ...item })),
        mapAssetNotes: mapAssetNotes.map((item) => ({ ...item })),
        personalPlaces: personalPlaces.map((item) => ({ ...item })),
        shareSnapshots: shareSnapshots.map((item) => ({ ...item })),
        hardAsset,
        nextMapId: maps.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetId: mapAssets.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetNoteId: mapAssetNotes.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextPersonalPlaceId: personalPlaces.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextShareSnapshotId: shareSnapshots.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
    };

    return {
        state,
        query: {
            myMaps: {
                findMany: async () => state.maps.map((map) => attachAssets(state, map)),
                findFirst: async () => (denyOwnedMaps ? null : attachAssets(state, state.maps[0] || null)),
            },
            myMapAssets: {
                findFirst: async () => {
                    const asset = state.mapAssets[0] || null;
                    if (!asset) return null;
                    return {
                        ...asset,
                        notes: state.mapAssetNotes
                            .filter((note) => note.mapAssetId === asset.id)
                            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
                    };
                },
            },
            myMapShareSnapshots: {
                findFirst: async () => state.shareSnapshots[0] || null,
            },
            myMapPersonalPlaces: {
                findFirst: async () => state.personalPlaces[0] || null,
            },
            userFavorites: {
                findFirst: async () => state.favorites[0] || null,
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
                            createdAt: new Date('2026-03-14T11:00:00.000Z'),
                            updatedAt: new Date('2026-03-14T11:00:00.000Z'),
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
                            id: state.nextMapAssetId++,
                            addedAt: new Date('2026-03-14T11:05:00.000Z'),
                            ...item,
                        }));
                        state.mapAssets.push(...rows);
                        const chain = {
                            returning: async () => rows,
                        };
                        return chain;
                    },
                };
            }

            if (table === myMapAssetNotes) {
                return {
                    values(value) {
                        const rows = (Array.isArray(value) ? value : [value]).map((item) => ({
                            id: state.nextMapAssetNoteId++,
                            createdAt: new Date('2026-03-14T11:06:00.000Z'),
                            updatedAt: new Date('2026-03-14T11:06:00.000Z'),
                            ...item,
                        }));
                        state.mapAssetNotes.push(...rows);
                        return {
                            returning: async () => rows,
                        };
                    },
                };
            }

            if (table === myMapPersonalPlaces) {
                return {
                    values(value) {
                        const row = {
                            id: state.nextPersonalPlaceId++,
                            createdAt: new Date('2026-03-14T11:07:00.000Z'),
                            updatedAt: new Date('2026-03-14T11:07:00.000Z'),
                            ...value,
                        };
                        state.personalPlaces.push(row);
                        return {
                            returning: async () => [row],
                        };
                    },
                };
            }

            if (table === myMapShareSnapshots) {
                return {
                    values(value) {
                        const row = {
                            id: state.nextShareSnapshotId++,
                            createdAt: new Date('2026-03-14T11:08:00.000Z'),
                            updatedAt: new Date('2026-03-14T11:08:00.000Z'),
                            ...value,
                        };
                        state.shareSnapshots.push(row);
                        return {
                            returning: async () => [row],
                        };
                    },
                };
            }

            throw new Error('Unexpected table insert');
        },
        update(table) {
            if (table === myMaps) {
                return {
                    set(values) {
                        return {
                            where: async () => {
                                if (!state.maps[0]) return [];
                                state.maps[0] = {
                                    ...state.maps[0],
                                    ...values,
                                };
                                return [state.maps[0]];
                            },
                        };
                    },
                };
            }

            if (table === myMapAssets) {
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
            }

            if (table === myMapPersonalPlaces) {
                return {
                    set(values) {
                        return {
                            where: async () => {
                                if (!state.personalPlaces[0]) return [];
                                state.personalPlaces[0] = {
                                    ...state.personalPlaces[0],
                                    ...values,
                                };
                                return [state.personalPlaces[0]];
                            },
                        };
                    },
                };
            }

            if (table === myMapShareSnapshots) {
                return {
                    set(values) {
                        return {
                            where: async () => {
                                if (!state.shareSnapshots[0]) return [];
                                state.shareSnapshots[0] = {
                                    ...state.shareSnapshots[0],
                                    ...values,
                                };
                                return [state.shareSnapshots[0]];
                            },
                        };
                    },
                };
            }

            throw new Error('Unexpected table update');
        },
        delete(table) {
            if (table === myMaps) {
                return {
                    where: async () => {
                        state.maps = [];
                        state.mapAssets = [];
                        state.personalPlaces = [];
                    },
                };
            }

            if (table === myMapAssets) {
                return {
                    where: async () => {
                        state.mapAssets = [];
                        state.mapAssetNotes = [];
                    },
                };
            }

            if (table === myMapAssetNotes) {
                return {
                    where: async () => {
                        state.mapAssetNotes = [];
                    },
                };
            }

            if (table === myMapPersonalPlaces) {
                return {
                    where: async () => {
                        state.personalPlaces = [];
                    },
                };
            }

            if (table === myMapShareSnapshots) {
                return {
                    where: async () => {
                        state.shareSnapshots = [];
                    },
                };
            }

            throw new Error('Unexpected table delete');
        },
    };
}

test('listMyMaps returns user maps with asset counts', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
    });

    const maps = await listMyMaps(db, DEFAULT_USER);

    assert.equal(maps.length, 1);
    assert.equal(maps[0].name, 'Community planning');
    assert.equal(maps[0].assetCount, 1);
});

test('non-guest authenticated users can access My Maps', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
    });

    const maps = await listMyMaps(db, PARTNER_USER);

    assert.equal(maps.length, 1);
    assert.equal(maps[0].assetCount, 1);
});

test('createMyMap creates a named map and can seed it from saved assets', async () => {
    const db = createFakeDb({
        favorites: [createFavorite()],
    });

    const created = await createMyMap(db, DEFAULT_USER, {
        name: 'Weekend support',
        assets: [{ resourceType: 'hard', resourceId: 29 }],
    }, DEFAULT_CONTEXT);

    assert.equal(created.name, 'Weekend support');
    assert.equal(created.assetCount, 1);
    assert.equal(db.state.maps.length, 1);
    assert.equal(db.state.mapAssets.length, 1);
    assert.equal(db.state.mapAssets[0].snapshot.name, 'Saved centre snapshot');
});

test('getMyMapDetail falls back to snapshot data for unavailable assets', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        hardAsset: null,
    });

    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(detail.name, 'Community planning');
    assert.equal(detail.summary.resourceCount, 1);
    assert.equal(detail.assets[0].status, 'unavailable');
    assert.equal(detail.places[0].rows[0].name, 'Saved centre snapshot');
});

test('personal places can be created and appear only in owner directory shape', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        hardAsset: null,
    });

    const created = await createMyMapPersonalPlace(db, DEFAULT_USER, 3, {
        name: 'Useful coffee shop',
        categoryLabel: 'Shop',
        address: '21 Choa Chu Kang Avenue 4 Singapore 689812',
        postalCode: '689812',
        lat: 1.3851,
        lng: 103.7449,
        note: 'Good rest stop after appointments.',
    });
    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);
    const personalRow = detail.places.flatMap((place) => place.rows).find((row) => row.resourceType === 'personal_place');

    assert.equal(created.mapId, 3);
    assert.equal(created.name, 'Useful coffee shop');
    assert.equal(detail.summary.resourceCount, 2);
    assert.equal(detail.summary.savedResourceCount, 1);
    assert.equal(detail.summary.personalPlaceCount, 1);
    assert.equal(detail.assets.length, 1);
    assert.equal(detail.personalPlaces.length, 1);
    assert.equal(personalRow.name, 'Useful coffee shop');
    assert.equal(personalRow.saveEligible, false);
    assert.equal(detail.pins.some((pin) => pin.placeKey === 'personal-place-1'), true);
});

test('personal places can be updated and deleted on owned maps', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        personalPlaces: [createPersonalPlace()],
    });

    const updated = await updateMyMapPersonalPlace(db, DEFAULT_USER, 3, 5, {
        name: 'Updated pickup point',
        categoryLabel: 'Pickup point',
        address: '10 Choa Chu Kang Avenue 4 Singapore 689810',
        postalCode: '689810',
        lat: 1.3862,
        lng: 103.7452,
        note: 'Better shelter.',
    });
    const deleted = await deleteMyMapPersonalPlace(db, DEFAULT_USER, 3, 5);

    assert.equal(updated.name, 'Updated pickup point');
    assert.equal(updated.categoryLabel, 'Pickup point');
    assert.equal(deleted.success, true);
    assert.equal(db.state.personalPlaces.length, 0);
});

test('personal place mutations reject guests and maps not owned by the user', async () => {
    const guestDb = createFakeDb({
        maps: [createMap()],
    });
    const foreignDb = createFakeDb({
        maps: [createMap()],
        denyOwnedMaps: true,
    });
    const body = {
        name: 'Useful shop',
        lat: 1.3851,
        lng: 103.7449,
    };

    await assert.rejects(
        () => createMyMapPersonalPlace(guestDb, { id: 11, role: 'guest' }, 3, body),
        (err) => {
            assert.equal(err.status, 403);
            return true;
        }
    );
    await assert.rejects(
        () => createMyMapPersonalPlace(foreignDb, { id: 99, role: 'standard' }, 3, body),
        (err) => {
            assert.equal(err.status, 404);
            return true;
        }
    );
});

test('updateMyMapAssetNotes stores multiple simple notes with per-note sharing', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        hardAsset: null,
    });

    const updated = await updateMyMapAssetNotes(db, DEFAULT_USER, 3, {
        resourceType: 'hard',
        resourceId: 29,
        notes: [
            { text: 'Call before visiting.', isShared: true },
            { text: 'Internal planning reminder.', isShared: false },
        ],
    });
    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.deepEqual(
        updated.notes.items.map((note) => ({ text: note.text, isShared: note.isShared })),
        [
            { text: 'Call before visiting.', isShared: true },
            { text: 'Internal planning reminder.', isShared: false },
        ],
    );
    assert.deepEqual(
        detail.places[0].rows[0].notes.items.map((note) => ({ text: note.text, isShared: note.isShared })),
        [
            { text: 'Call before visiting.', isShared: true },
            { text: 'Internal planning reminder.', isShared: false },
        ],
    );
    assert.deepEqual(
        detail.assets[0].notes.items.map((note) => ({ text: note.text, isShared: note.isShared })),
        [
            { text: 'Call before visiting.', isShared: true },
            { text: 'Internal planning reminder.', isShared: false },
        ],
    );
});

test('renameMyMap updates description when provided', async () => {
    const db = createFakeDb({
        maps: [createMap()],
    });

    const updated = await renameMyMap(db, DEFAULT_USER, 3, {
        name: 'Community planning',
        description: 'Curated support options around Teck Whye.',
    });

    assert.equal(updated.description, 'Curated support options around Teck Whye.');
});

test('publishMyMap enables a reusable share link', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
    });

    const published = await publishMyMap(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(published.isShared, true);
    assert.equal(published.shareIncludesHandoffNotes, false);
    assert.equal(typeof published.shareToken, 'string');
    assert.match(published.sharePath, /^\/shared\/maps\//);
});

test('publishMyMap snapshots only notes marked for sharing', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        hardAsset: createHardAsset(),
    });
    await updateMyMapAssetNotes(db, DEFAULT_USER, 3, {
        resourceType: 'hard',
        resourceId: 29,
        notes: [
            { text: 'Bring referral letter.', isShared: true },
            { text: 'Internal planning reminder.', isShared: false },
        ],
    });

    const published = await publishMyMap(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(published.isShared, true);
    assert.equal(published.shareIncludesHandoffNotes, false);
    assert.equal(db.state.shareSnapshots.length, 1);
    assert.deepEqual(
        db.state.shareSnapshots[0].snapshot.assets[0].notes.items.map((note) => note.text),
        ['Bring referral letter.'],
    );
});

test('publishMyMap excludes owner personal places from shared snapshots', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        personalPlaces: [createPersonalPlace()],
        hardAsset: createHardAsset(),
    });

    await publishMyMap(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(db.state.shareSnapshots.length, 1);
    const snapshot = db.state.shareSnapshots[0].snapshot;
    assert.equal(snapshot.summary.personalPlaceCount, 0);
    assert.equal(snapshot.personalPlaces.length, 0);
    assert.equal(
        snapshot.places.flatMap((place) => place.rows).some((row) => row.resourceType === 'personal_place'),
        false,
    );
});

test('unpublishMyMap clears the active share token', async () => {
    const db = createFakeDb({
        maps: [createMap({ isShared: true, shareToken: 'live-token' })],
        mapAssets: [createMapAsset()],
    });

    const unpublished = await unpublishMyMap(db, DEFAULT_USER, 3);

    assert.equal(unpublished.isShared, false);
    assert.equal(unpublished.shareToken, null);
});

test('republishMyMap generates a fresh token after a map is unpublished', async () => {
    const db = createFakeDb({
        maps: [createMap({ isShared: true, shareToken: 'live-token' })],
        mapAssets: [createMapAsset()],
    });

    const unpublished = await unpublishMyMap(db, DEFAULT_USER, 3);
    const republished = await publishMyMap(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(unpublished.isShared, false);
    assert.equal(unpublished.shareToken, null);
    assert.equal(republished.isShared, true);
    assert.equal(typeof republished.shareToken, 'string');
    assert.notEqual(republished.shareToken, 'live-token');
});

test('renameMyMap rejects blank names', async () => {
    const db = createFakeDb({
        maps: [createMap()],
    });

    await assert.rejects(
        () => renameMyMap(db, DEFAULT_USER, 3, { name: '   ' }),
        (err) => {
            assert.equal(err.status, 400);
            assert.equal(err.message, 'Map name is required');
            return true;
        }
    );
});

test('addAssetToMyMap rejects assets that are not saved by the user', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        favorites: [],
    });

    await assert.rejects(
        () => addAssetToMyMap(db, DEFAULT_USER, 3, { resourceType: 'hard', resourceId: 29 }),
        (err) => {
            assert.equal(err.status, 400);
            assert.equal(err.message, 'You can only add assets that are already saved');
            return true;
        }
    );
});

test('addAssetToMyMap rejects duplicate assets in the same map', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        favorites: [createFavorite()],
    });

    await assert.rejects(
        () => addAssetToMyMap(db, DEFAULT_USER, 3, { resourceType: 'hard', resourceId: 29 }),
        (err) => {
            assert.equal(err.status, 409);
            assert.equal(err.message, 'This asset is already in the map');
            return true;
        }
    );
});

test('addAssetToMyMap adds a saved asset and returns a serialized record', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        favorites: [createFavorite()],
        mapAssets: [],
    });

    const created = await addAssetToMyMap(db, DEFAULT_USER, 3, { resourceType: 'hard', resourceId: 29 });

    assert.equal(created.mapId, 3);
    assert.equal(created.resourceType, 'hard');
    assert.equal(created.resourceId, 29);
    assert.equal(created.assetKey, 'hard-29');
    assert.equal(created.snapshot.name, 'Saved centre snapshot');
    assert.equal(db.state.mapAssets.length, 1);
});

test('deleteMyMapRecord removes the map and all of its asset associations', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        personalPlaces: [createPersonalPlace()],
    });

    const result = await deleteMyMapRecord(db, DEFAULT_USER, 3);

    assert.equal(result.success, true);
    assert.equal(db.state.maps.length, 0);
    assert.equal(db.state.mapAssets.length, 0);
    assert.equal(db.state.personalPlaces.length, 0);
});
