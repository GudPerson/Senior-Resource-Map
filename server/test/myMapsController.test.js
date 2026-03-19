import test from 'node:test';
import assert from 'node:assert/strict';

import {
    addAssetToMyMap,
    createMyMap,
    deleteMyMapRecord,
    getMyMapDetail,
    listMyMaps,
    renameMyMap,
} from '../src/controllers/myMapsController.js';
import { myMapAssets, myMaps } from '../src/db/schema.js';

const DEFAULT_USER = { id: 7, role: 'standard', postalCode: '680153' };
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
        snapshot: createFavorite().snapshot,
        addedAt: new Date('2026-03-14T10:05:00.000Z'),
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
        assets: state.mapAssets.filter((asset) => asset.mapId === map.id),
    };
}

function createFakeDb({
    favorites = [],
    maps = [],
    mapAssets = [],
    hardAsset = null,
} = {}) {
    const state = {
        favorites: favorites.map((item) => ({ ...item })),
        maps: maps.map((item) => ({ ...item })),
        mapAssets: mapAssets.map((item) => ({ ...item })),
        hardAsset,
        nextMapId: maps.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetId: mapAssets.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
    };

    return {
        state,
        query: {
            myMaps: {
                findMany: async () => state.maps.map((map) => attachAssets(state, map)),
                findFirst: async () => attachAssets(state, state.maps[0] || null),
            },
            myMapAssets: {
                findFirst: async () => state.mapAssets[0] || null,
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

            throw new Error('Unexpected table insert');
        },
        update(table) {
            assert.equal(table, myMaps);
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
        },
        delete(table) {
            if (table === myMaps) {
                return {
                    where: async () => {
                        state.maps = [];
                        state.mapAssets = [];
                    },
                };
            }

            if (table === myMapAssets) {
                return {
                    where: async () => {
                        state.mapAssets = [];
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
    assert.equal(detail.assetCount, 1);
    assert.equal(detail.assets[0].status, 'unavailable');
    assert.equal(detail.assets[0].name, 'Saved centre snapshot');
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

test('deleteMyMapRecord removes the map and all of its asset associations', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
    });

    const result = await deleteMyMapRecord(db, DEFAULT_USER, 3);

    assert.equal(result.success, true);
    assert.equal(db.state.maps.length, 0);
    assert.equal(db.state.mapAssets.length, 0);
});
