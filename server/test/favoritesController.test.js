import test from 'node:test';
import assert from 'node:assert/strict';

import {
    listSavedAssets,
    listSavedSoftAssets,
    toggleSavedAsset,
} from '../src/controllers/favoritesController.js';
import { userFavorites } from '../src/db/schema.js';
import { hydrateSavedAssetRecord } from '../src/utils/savedAssets.js';

const DEFAULT_CONTEXT = {
    allowedPartnerAudienceIds: new Set(),
    allowedAudienceZoneIds: new Set(),
};

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

function createFavorite(overrides = {}) {
    return {
        id: 1,
        userId: 7,
        resourceType: 'hard',
        resourceId: 29,
        createdAt: new Date('2026-03-14T09:00:00.000Z'),
        snapshot: null,
        ...overrides,
    };
}

function createSoftAsset(id, overrides = {}) {
    return {
        id,
        name: `Activity ${id}`,
        subCategory: 'Programmes',
        audienceMode: 'public',
        isMemberOnly: false,
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
        assetMode: 'standalone',
        partnerId: null,
        subregionId: null,
        hostHardAssetId: null,
        partner: null,
        parent: null,
        audienceZones: [],
        hostHardAsset: null,
        locations: [],
        ...overrides,
    };
}

function createFakeDb({
    favorites = [],
    hardAsset = null,
    hardAssets = hardAsset ? [hardAsset] : [],
    hardAssetError = null,
    hardAssetBatchError = null,
    softAsset = null,
    softAssets = softAsset ? [softAsset] : [],
    softAssetError = null,
    softAssetBatchError = null,
    audienceContextError = null,
    raceConflict = false,
} = {}) {
    const state = {
        favorites: favorites.map((favorite) => ({ ...favorite })),
        hardAsset,
        hardAssets,
        hardAssetError,
        hardAssetBatchError,
        softAsset,
        softAssets,
        softAssetError,
        softAssetBatchError,
        audienceContextError,
        nextId: favorites.reduce((maxId, favorite) => Math.max(maxId, favorite.id || 0), 0) + 1,
        raceConflict,
        favoriteLookupCount: 0,
        favoriteListCount: 0,
        hardAssetLookupCount: 0,
        hardAssetBatchLookupCount: 0,
        softAssetLookupCount: 0,
        softAssetBatchLookupCount: 0,
    };

    return {
        state,
        query: {
            userFavorites: {
                findMany: async () => {
                    state.favoriteListCount += 1;
                    return [...state.favorites];
                },
                findFirst: async () => {
                    state.favoriteLookupCount += 1;
                    if (state.raceConflict && state.favoriteLookupCount === 1) {
                        return undefined;
                    }
                    return state.favorites[0];
                },
            },
            hardAssets: {
                findFirst: async () => {
                    state.hardAssetLookupCount += 1;
                    if (state.hardAssetError) throw state.hardAssetError;
                    return state.hardAsset;
                },
                findMany: async (query) => {
                    assert.ok(query?.where, 'hard asset batch must stay scoped to saved ids');
                    state.hardAssetBatchLookupCount += 1;
                    if (state.hardAssetBatchError) throw state.hardAssetBatchError;
                    return [...state.hardAssets];
                },
            },
            softAssets: {
                findFirst: async () => {
                    state.softAssetLookupCount += 1;
                    if (state.softAssetError) throw state.softAssetError;
                    return state.softAsset;
                },
                findMany: async (query) => {
                    assert.ok(query?.where, 'soft asset batch must stay scoped to saved ids');
                    state.softAssetBatchLookupCount += 1;
                    if (state.softAssetBatchError) throw state.softAssetBatchError;
                    return [...state.softAssets];
                },
            },
        },
        select() {
            throw state.audienceContextError || new Error('Unexpected audience-context lookup');
        },
        insert(table) {
            assert.equal(table, userFavorites);
            return {
                values: async (value) => {
                    if (state.raceConflict) {
                        const err = new Error('duplicate key value violates unique constraint');
                        err.code = '23505';
                        throw err;
                    }

                    const duplicate = state.favorites.find((favorite) =>
                        favorite.userId === value.userId
                        && favorite.resourceType === value.resourceType
                        && favorite.resourceId === value.resourceId
                    );

                    if (duplicate) {
                        const err = new Error('duplicate key value violates unique constraint');
                        err.code = '23505';
                        throw err;
                    }

                    const row = {
                        id: state.nextId,
                        createdAt: new Date('2026-03-14T09:30:00.000Z'),
                        ...value,
                    };
                    state.nextId += 1;
                    state.favorites.push(row);
                    return [row];
                },
            };
        },
        delete(table) {
            assert.equal(table, userFavorites);
            return {
                where: async () => {
                    state.favorites = [];
                },
            };
        },
    };
}

test('listSavedAssets returns enriched flat saved-asset items', async () => {
    const db = createFakeDb({
        favorites: [createFavorite()],
        hardAsset: createHardAsset(),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const items = await listSavedAssets(db, user, DEFAULT_CONTEXT);

    assert.equal(items.length, 1);
    assert.deepEqual(
        Object.keys(items[0]).sort(),
        [
            'address',
            'assetKey',
            'createdAt',
            'hasCoordinates',
            'hostHardAssetIds',
            'id',
            'lat',
            'lng',
            'name',
            'resourceId',
            'resourceType',
            'status',
            'subCategory',
            'detailPath',
            'userId',
        ].sort()
    );
    assert.equal(items[0].assetKey, 'hard-29');
    assert.equal(items[0].status, 'available');
    assert.equal(items[0].name, 'Fei Yue Active Ageing Centre');
    assert.equal(items[0].detailPath, '/resource/hard/29');
});

test('listSavedAssets falls back to snapshot when the live asset is unavailable', async () => {
    const db = createFakeDb({
        favorites: [createFavorite({
            snapshot: {
                name: 'Saved centre snapshot',
                subCategory: 'Active Ageing Centre',
                address: 'Old address',
                lat: 1.3,
                lng: 103.8,
                detailPath: '/resource/hard/29',
            },
        })],
        hardAsset: null,
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const [item] = await listSavedAssets(db, user, DEFAULT_CONTEXT);

    assert.equal(item.status, 'unavailable');
    assert.equal(item.name, 'Saved centre snapshot');
    assert.equal(item.address, 'Old address');
    assert.equal(item.detailPath, '/resource/hard/29');
    assert.equal(item.hasCoordinates, true);
    assert.equal(Object.hasOwn(item, 'snapshot'), false);
});

test('listSavedAssets batches a large mixed list and preserves favorite order', async () => {
    const favorites = Array.from({ length: 80 }, (_, index) => {
        const resourceType = index % 2 === 0 ? 'hard' : 'soft';
        return createFavorite({
            id: index + 1,
            resourceType,
            resourceId: index + 100,
        });
    });
    const hardAssets = favorites
        .filter((favorite) => favorite.resourceType === 'hard')
        .map((favorite) => createHardAsset({
            id: favorite.resourceId,
            name: `Place ${favorite.resourceId}`,
        }))
        .reverse();
    const softAssets = favorites
        .filter((favorite) => favorite.resourceType === 'soft')
        .map((favorite) => createSoftAsset(favorite.resourceId))
        .reverse();
    const db = createFakeDb({ favorites, hardAssets, softAssets });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const items = await listSavedAssets(db, user, DEFAULT_CONTEXT);

    assert.equal(items.length, 80);
    assert.deepEqual(
        items.map((item) => item.assetKey),
        favorites.map((favorite) => `${favorite.resourceType}-${favorite.resourceId}`),
    );
    assert.equal(items.every((item) => item.status === 'available'), true);
    assert.equal(db.state.favoriteListCount, 1);
    assert.equal(db.state.hardAssetBatchLookupCount, 1);
    assert.equal(db.state.softAssetBatchLookupCount, 1);
    assert.equal(db.state.hardAssetLookupCount, 0);
    assert.equal(db.state.softAssetLookupCount, 0);
});

test('listSavedAssets keeps soft assets live when the hard batch fails', async () => {
    const hardFavorite = createFavorite({
        id: 1,
        snapshot: {
            name: 'Saved Place snapshot',
            address: 'Saved Place address',
        },
    });
    const softFavorite = createFavorite({
        id: 2,
        resourceType: 'soft',
        resourceId: 44,
        snapshot: { name: 'Saved Offering snapshot' },
    });
    const db = createFakeDb({
        favorites: [hardFavorite, softFavorite],
        hardAssetBatchError: new Error('hard batch failed'),
        softAssets: [createSoftAsset(44)],
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const [hardItem, softItem] = await listSavedAssets(db, user, DEFAULT_CONTEXT);

    assert.equal(hardItem.status, 'unavailable');
    assert.equal(hardItem.name, 'Saved Place snapshot');
    assert.equal(softItem.status, 'available');
    assert.equal(softItem.name, 'Activity 44');
});

test('listSavedAssets keeps hard assets live when the soft batch fails', async () => {
    const hardFavorite = createFavorite({ id: 1 });
    const softFavorite = createFavorite({
        id: 2,
        resourceType: 'soft',
        resourceId: 44,
        snapshot: { name: 'Saved Offering snapshot' },
    });
    const db = createFakeDb({
        favorites: [hardFavorite, softFavorite],
        hardAssets: [createHardAsset()],
        softAssetBatchError: new Error('soft batch failed'),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const [hardItem, softItem] = await listSavedAssets(db, user, DEFAULT_CONTEXT);

    assert.equal(hardItem.status, 'available');
    assert.equal(hardItem.name, 'Fei Yue Active Ageing Centre');
    assert.equal(softItem.status, 'unavailable');
    assert.equal(softItem.name, 'Saved Offering snapshot');
});

test('listSavedAssets uses a fail-closed context when audience lookup fails', async () => {
    const restrictedSoftAsset = createSoftAsset(44, {
        audienceMode: 'audience_zones',
        audienceZones: [{
            audienceZone: {
                id: 91,
                zoneCode: 'TEST',
                name: 'Test audience',
                partnerUserId: null,
            },
        }],
    });
    const db = createFakeDb({
        favorites: [
            createFavorite(),
            createFavorite({
                id: 2,
                resourceType: 'soft',
                resourceId: 44,
            }),
        ],
        hardAssets: [createHardAsset()],
        softAssets: [restrictedSoftAsset],
        audienceContextError: new Error('audience context unavailable'),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const [publicItem, restrictedItem] = await listSavedAssets(db, user);

    assert.equal(publicItem.status, 'available');
    assert.equal(publicItem.assetKey, 'hard-29');
    assert.equal(restrictedItem.status, 'unavailable');
    assert.equal(restrictedItem.assetKey, 'soft-44');
    assert.equal(db.state.hardAssetBatchLookupCount, 1);
    assert.equal(db.state.softAssetBatchLookupCount, 1);
});

test('hydrateSavedAssetRecord preserves its snapshot when a single live lookup throws', async () => {
    const favorite = createFavorite({
        snapshot: {
            name: 'Snapshot fallback centre',
            address: 'Saved address',
            lat: 1.31,
            lng: 103.82,
        },
    });
    const db = createFakeDb({
        hardAssetError: new Error('single live lookup failed'),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const item = await hydrateSavedAssetRecord(db, user, favorite, DEFAULT_CONTEXT);

    assert.equal(item.status, 'unavailable');
    assert.equal(item.name, 'Snapshot fallback centre');
    assert.equal(item.address, 'Saved address');
    assert.equal(item.hasCoordinates, true);
});

test('listSavedSoftAssets batches large saved activity lists into one asset lookup', async () => {
    const favorites = Array.from({ length: 75 }, (_, index) => createFavorite({
        id: index + 1,
        resourceType: 'soft',
        resourceId: index + 100,
    }));
    const db = createFakeDb({
        favorites,
        softAssets: favorites.map((favorite) => createSoftAsset(favorite.resourceId)),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const items = await listSavedSoftAssets(db, user, DEFAULT_CONTEXT);

    assert.equal(items.length, 75);
    assert.equal(items[0].assetKey, 'soft-100');
    assert.equal(items[74].assetKey, 'soft-174');
    assert.equal(items.every((item) => item.status === 'available'), true);
    assert.equal(db.state.favoriteListCount, 1);
    assert.equal(db.state.softAssetBatchLookupCount, 1);
    assert.equal(db.state.softAssetLookupCount, 0);
});

test('toggleSavedAsset returns final saved state with item payload on save', async () => {
    const db = createFakeDb({
        hardAsset: createHardAsset(),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const result = await toggleSavedAsset(db, user, 'hard', 29, DEFAULT_CONTEXT);

    assert.equal(result.success, true);
    assert.equal(result.action, 'added');
    assert.equal(result.saved, true);
    assert.equal(result.resourceType, 'hard');
    assert.equal(result.resourceId, 29);
    assert.equal(result.item?.assetKey, 'hard-29');
    assert.equal(db.state.favorites.length, 1);
    assert.deepEqual(db.state.favorites[0].snapshot, {
        name: 'Fei Yue Active Ageing Centre',
        subCategory: 'Active Ageing Centre',
        address: '153 Jalan Teck Whye Singapore 680153',
        lat: 1.38123,
        lng: 103.75001,
        detailPath: '/resource/hard/29',
        hostHardAssetIds: [],
    });
});

test('toggleSavedAsset returns final saved state on remove', async () => {
    const db = createFakeDb({
        favorites: [createFavorite()],
        hardAsset: createHardAsset(),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const result = await toggleSavedAsset(db, user, 'hard', 29, DEFAULT_CONTEXT);

    assert.equal(result.success, true);
    assert.equal(result.action, 'removed');
    assert.equal(result.saved, false);
    assert.equal(result.item, null);
    assert.equal(db.state.favorites.length, 0);
});

test('toggleSavedAsset reconciles unique-conflict races into the final saved state', async () => {
    const db = createFakeDb({
        favorites: [createFavorite()],
        hardAsset: createHardAsset(),
        raceConflict: true,
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const result = await toggleSavedAsset(db, user, 'hard', 29, DEFAULT_CONTEXT);

    assert.equal(result.success, true);
    assert.equal(result.saved, true);
    assert.equal(result.item?.assetKey, 'hard-29');
    assert.equal(db.state.favorites.length, 1);
});

test('toggleSavedAsset stays consistent across rapid sequential save and unsave clicks', async () => {
    const db = createFakeDb({
        hardAsset: createHardAsset(),
    });
    const user = { id: 7, role: 'standard', postalCode: '680153' };

    const saveOne = await toggleSavedAsset(db, user, 'hard', 29, DEFAULT_CONTEXT);
    const remove = await toggleSavedAsset(db, user, 'hard', 29, DEFAULT_CONTEXT);
    const saveTwo = await toggleSavedAsset(db, user, 'hard', 29, DEFAULT_CONTEXT);

    assert.equal(saveOne.saved, true);
    assert.equal(remove.saved, false);
    assert.equal(saveTwo.saved, true);
    assert.equal(saveTwo.item?.assetKey, 'hard-29');
    assert.equal(db.state.favorites.length, 1);
});
