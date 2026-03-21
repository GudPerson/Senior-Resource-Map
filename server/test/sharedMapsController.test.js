import test from 'node:test';
import assert from 'node:assert/strict';

import { copySharedMapToMyMaps, getSharedMapDirectory } from '../src/controllers/sharedMapsController.js';
import { myMapAssets, myMaps } from '../src/db/schema.js';

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
        assets: state.mapAssets.filter((asset) => asset.mapId === map.id),
    };
}

function createFakeDb({
    maps = [],
    mapAssets = [],
    hardAsset = null,
} = {}) {
    const state = {
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
        maps: [createSharedMap()],
        mapAssets: [createMapAsset()],
    });

    const copied = await copySharedMapToMyMaps(db, RECIPIENT_USER, 'shared-token');

    assert.equal(copied.name, 'Copy of Neighbourhood support');
    assert.equal(copied.assetCount, 1);
    assert.equal(db.state.maps[0].userId, RECIPIENT_USER.id);
    assert.equal(db.state.maps[0].isShared, false);
    assert.equal(db.state.mapAssets.length, 2);
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
