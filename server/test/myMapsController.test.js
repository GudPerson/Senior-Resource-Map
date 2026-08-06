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
    updateMyMapCategoryOrder,
    updateMyMapPersonalPlace,
    updateMyMapPersonalPlaceShortDescriptor,
    updateMyMapAssetNotes,
    updateMyMapAssetShortDescriptor,
    unpublishMyMap,
} from '../src/controllers/myMapsController.js';
import {
    duplicateMyMap,
} from '../src/controllers/myMapCopiesController.js';
import {
    attachPersonalPlaceToMap,
    createPersonalPlaceCategory,
    deletePersonalPlace,
    ensureDefaultPersonalPlaceCategories,
    listPersonalPlaces,
    updatePersonalPlaceCategory,
} from '../src/controllers/personalPlacesController.js';
import {
    myMapAssetNotes,
    myMapAssetShortDescriptors,
    myMapAssets,
    myMapPersonalPlaceLinks,
    myMapPersonalPlaces,
    myMapPrintAnnotationDocuments,
    myMapShareSnapshots,
    myMaps,
    userPersonalPlaceCategories,
    userPersonalPlaces,
} from '../src/db/schema.js';

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
        categoryOrder: [],
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
        shortDescriptor: null,
        shortDescriptorTextColor: null,
        shortDescriptorHighlightColor: null,
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
        userId: DEFAULT_USER.id,
        categoryId: 2,
        legacyCategoryLabel: 'Shop',
        name: 'Useful coffee shop',
        logoUrl: 'https://res.cloudinary.com/example/useful-coffee-shop.png',
        address: '21 Choa Chu Kang Avenue 4 Singapore 689812',
        postalCode: '689812',
        lat: '1.3851000',
        lng: '103.7449000',
        shortDescription: 'Good rest stop after appointments.',
        legacyMapPersonalPlaceId: null,
        createdAt: new Date('2026-03-14T10:10:00.000Z'),
        updatedAt: new Date('2026-03-14T10:10:00.000Z'),
        ...overrides,
    };
}

function createPersonalPlaceCategoryFixture(overrides = {}) {
    return {
        id: 2,
        userId: DEFAULT_USER.id,
        name: 'Shop',
        normalizedName: 'shop',
        iconKey: 'shopping-bag',
        iconUrl: null,
        color: '#0F766E',
        sortOrder: 0,
        isArchived: false,
        createdAt: new Date('2026-03-14T09:50:00.000Z'),
        updatedAt: new Date('2026-03-14T09:50:00.000Z'),
        ...overrides,
    };
}

function createPersonalPlaceLink(overrides = {}) {
    return {
        id: 4,
        mapId: 3,
        personalPlaceId: 5,
        addedAt: new Date('2026-03-14T10:10:00.000Z'),
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
                shortDescriptors: state.mapAssetShortDescriptors
                    .filter((descriptor) => descriptor.mapAssetId === asset.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
            })),
        personalPlaceLinks: state.personalPlaceLinks
            .filter((link) => link.mapId === map.id)
            .map((link) => {
                const personalPlace = state.personalPlaces.find((place) => place.id === link.personalPlaceId);
                const category = state.personalPlaceCategories.find((item) => item.id === personalPlace?.categoryId) || null;
                return {
                    ...link,
                    personalPlace: personalPlace ? { ...personalPlace, category } : null,
                };
            }),
        printAnnotationDocument: state.printAnnotationDocuments
            .find((document) => document.mapId === map.id) || null,
    };
}

function createFakeDb({
    favorites = [],
    maps = [],
    mapAssets = [],
    mapAssetNotes = [],
    mapAssetShortDescriptors = [],
    personalPlaces = [],
    personalPlaceCategories = [],
    personalPlaceLinks = [],
    printAnnotationDocuments = [],
    legacyPersonalPlaces = [],
    shareSnapshots = [],
    hardAsset = null,
    denyOwnedMaps = false,
} = {}) {
    const state = {
        favorites: favorites.map((item) => ({ ...item })),
        maps: maps.map((item) => ({ ...item })),
        mapAssets: mapAssets.map((item) => ({ ...item })),
        mapAssetNotes: mapAssetNotes.map((item) => ({ ...item })),
        mapAssetShortDescriptors: mapAssetShortDescriptors.map((item) => ({ ...item })),
        personalPlaces: personalPlaces.map((item) => ({ ...item })),
        personalPlaceCategories: personalPlaceCategories.map((item) => ({ ...item })),
        personalPlaceLinks: personalPlaceLinks.map((item) => ({ ...item })),
        printAnnotationDocuments: printAnnotationDocuments.map((item) => ({ ...item })),
        legacyPersonalPlaces: legacyPersonalPlaces.map((item) => ({ ...item })),
        shareSnapshots: shareSnapshots.map((item) => ({ ...item })),
        hardAsset,
        nextMapId: maps.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetId: mapAssets.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetNoteId: mapAssetNotes.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextMapAssetShortDescriptorId: mapAssetShortDescriptors.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextPersonalPlaceId: personalPlaces.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextPersonalPlaceCategoryId: personalPlaceCategories.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextPersonalPlaceLinkId: personalPlaceLinks.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextPrintAnnotationDocumentId: printAnnotationDocuments.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextShareSnapshotId: shareSnapshots.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
    };

    return {
        state,
        query: {
            myMaps: {
                findMany: async () => state.maps.map((map) => attachAssets(state, map)),
                findFirst: async ({ where } = {}) => {
                    if (denyOwnedMaps) return null;
                    const [mapId, userId] = getWhereParamValues(where);
                    const map = state.maps.find((item) => (
                        (!mapId || item.id === mapId) && (!userId || item.userId === userId)
                    )) || null;
                    return attachAssets(state, map);
                },
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
                        shortDescriptors: state.mapAssetShortDescriptors
                            .filter((descriptor) => descriptor.mapAssetId === asset.id)
                            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
                    };
                },
            },
            myMapShareSnapshots: {
                findFirst: async () => state.shareSnapshots[0] || null,
            },
            myMapPersonalPlaceLinks: {
                findFirst: async ({ where } = {}) => {
                    const values = getWhereParamValues(where);
                    return state.personalPlaceLinks.find((link) => (
                        values.length === 0
                        || (values.includes(link.mapId) && values.includes(link.personalPlaceId))
                    )) || null;
                },
            },
            userPersonalPlaceCategories: {
                findMany: async () => [...state.personalPlaceCategories],
                findFirst: async ({ where } = {}) => {
                    const values = getWhereParamValues(where);
                    const normalizedName = values.find((value) => typeof value === 'string');
                    if (normalizedName) {
                        const userId = values.find((value) => typeof value === 'number');
                        return state.personalPlaceCategories.find((category) => (
                            category.userId === userId && category.normalizedName === normalizedName
                        )) || null;
                    }
                    const [categoryId, userId] = values;
                    return state.personalPlaceCategories.find((category) => (
                        (!categoryId || category.id === categoryId)
                        && (!userId || category.userId === userId)
                    )) || null;
                },
            },
            userPersonalPlaces: {
                findMany: async () => state.personalPlaces.map((place) => ({
                    ...place,
                    category: state.personalPlaceCategories.find((item) => item.id === place.categoryId) || null,
                    mapLinks: state.personalPlaceLinks
                        .filter((link) => link.personalPlaceId === place.id)
                        .map((link) => ({
                            ...link,
                            map: state.maps.find((map) => map.id === link.mapId) || null,
                        })),
                })),
                findFirst: async ({ where } = {}) => {
                    const [personalPlaceId, userId] = getWhereParamValues(where);
                    const place = state.personalPlaces.find((item) => (
                        (!personalPlaceId || item.id === personalPlaceId)
                        && (!userId || item.userId === userId)
                    )) || null;
                    if (!place) return null;
                    return {
                        ...place,
                        category: state.personalPlaceCategories.find((item) => item.id === place.categoryId) || null,
                        mapLinks: state.personalPlaceLinks
                            .filter((link) => link.personalPlaceId === place.id)
                            .map((link) => ({
                                ...link,
                                map: state.maps.find((map) => map.id === link.mapId) || null,
                            })),
                    };
                },
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

            if (table === myMapAssetShortDescriptors) {
                return {
                    values(value) {
                        const rows = (Array.isArray(value) ? value : [value]).map((item) => ({
                            id: state.nextMapAssetShortDescriptorId++,
                            createdAt: new Date('2026-03-14T11:06:15.000Z'),
                            updatedAt: new Date('2026-03-14T11:06:15.000Z'),
                            ...item,
                        }));
                        state.mapAssetShortDescriptors.push(...rows);
                        return {
                            returning: async () => rows,
                        };
                    },
                };
            }

            if (table === userPersonalPlaceCategories) {
                return {
                    values(value) {
                        const pendingRows = (Array.isArray(value) ? value : [value]).map((item) => ({
                            createdAt: new Date('2026-03-14T11:06:30.000Z'),
                            updatedAt: new Date('2026-03-14T11:06:30.000Z'),
                            ...item,
                        }));
                        const insertRows = ({ ignoreConflicts = false } = {}) => {
                            const inserted = [];
                            for (const pendingRow of pendingRows) {
                                const duplicate = state.personalPlaceCategories.some((category) => (
                                    category.userId === pendingRow.userId
                                    && category.normalizedName === pendingRow.normalizedName
                                ));
                                if (duplicate && ignoreConflicts) continue;
                                if (duplicate) {
                                    const error = new Error('duplicate personal place category');
                                    error.code = '23505';
                                    throw error;
                                }
                                const row = {
                                    id: state.nextPersonalPlaceCategoryId++,
                                    ...pendingRow,
                                };
                                state.personalPlaceCategories.push(row);
                                inserted.push(row);
                            }
                            return inserted;
                        };
                        return {
                            returning: async () => insertRows(),
                            onConflictDoNothing: async () => insertRows({ ignoreConflicts: true }),
                        };
                    },
                };
            }

            if (table === userPersonalPlaces) {
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

            if (table === myMapPersonalPlaceLinks) {
                return {
                    values(value) {
                        const rows = (Array.isArray(value) ? value : [value]).map((item) => ({
                            id: state.nextPersonalPlaceLinkId++,
                            addedAt: new Date('2026-03-14T11:07:30.000Z'),
                            ...item,
                        }));
                        state.personalPlaceLinks.push(...rows);
                        return {
                            returning: async () => rows,
                        };
                    },
                };
            }

            if (table === myMapPrintAnnotationDocuments) {
                return {
                    values(value) {
                        const row = {
                            id: state.nextPrintAnnotationDocumentId++,
                            createdAt: new Date('2026-03-14T11:07:45.000Z'),
                            updatedAt: new Date('2026-03-14T11:07:45.000Z'),
                            ...value,
                        };
                        state.printAnnotationDocuments.push(row);
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

            if (table === userPersonalPlaces) {
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

            if (table === myMapPersonalPlaceLinks) {
                return {
                    set(values) {
                        return {
                            where: async (where) => {
                                const whereValues = getWhereParamValues(where);
                                const linkIndex = state.personalPlaceLinks.findIndex((link) => (
                                    whereValues.includes(link.mapId)
                                    && whereValues.includes(link.personalPlaceId)
                                ));
                                if (linkIndex < 0) return [];
                                state.personalPlaceLinks[linkIndex] = {
                                    ...state.personalPlaceLinks[linkIndex],
                                    ...values,
                                };
                                return [state.personalPlaceLinks[linkIndex]];
                            },
                        };
                    },
                };
            }

            if (table === userPersonalPlaceCategories) {
                return {
                    set(values) {
                        return {
                            where: async () => {
                                if (!state.personalPlaceCategories[0]) return [];
                                state.personalPlaceCategories[0] = {
                                    ...state.personalPlaceCategories[0],
                                    ...values,
                                };
                                return [state.personalPlaceCategories[0]];
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
                        state.personalPlaceLinks = [];
                    },
                };
            }

            if (table === myMapAssets) {
                return {
                    where: async () => {
                        state.mapAssets = [];
                        state.mapAssetNotes = [];
                        state.mapAssetShortDescriptors = [];
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

            if (table === myMapAssetShortDescriptors) {
                return {
                    where: async () => {
                        state.mapAssetShortDescriptors = [];
                    },
                };
            }

            if (table === userPersonalPlaces) {
                return {
                    where: async () => {
                        state.personalPlaces = [];
                        state.personalPlaceLinks = [];
                    },
                };
            }

            if (table === myMapPersonalPlaceLinks) {
                return {
                    where: async (where) => {
                        const values = getWhereParamValues(where);
                        state.personalPlaceLinks = state.personalPlaceLinks.filter((link) => (
                            !values.includes(link.mapId) || !values.includes(link.personalPlaceId)
                        ));
                    },
                };
            }

            if (table === myMapPersonalPlaces) {
                return {
                    where: async (where) => {
                        const values = getWhereParamValues(where);
                        state.legacyPersonalPlaces = state.legacyPersonalPlaces.filter((place) => (
                            !values.includes(place.id) || !values.includes(place.mapId)
                        ));
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

test('duplicateMyMap creates a private owner copy with independent map child rows', async () => {
    const db = createFakeDb({
        maps: [createMap({
            description: 'Planning around Teck Whye.',
            isShared: true,
            shareToken: 'live-token',
            shareIncludesHandoffNotes: true,
            shareUpdatedAt: new Date('2026-03-14T10:20:00.000Z'),
            categoryOrder: ['home care', 'active ageing centre'],
        })],
        mapAssets: [createMapAsset({
            shortDescriptor: 'Use the side entrance.',
            shortDescriptorTextColor: '#0F766E',
            shortDescriptorHighlightColor: '#FEF3C7',
            privateNote: 'Internal reminder.',
            handoffNote: 'Bring referral letter.',
            notesUpdatedAt: new Date('2026-03-14T10:30:00.000Z'),
        })],
        mapAssetNotes: [
            {
                id: 20,
                mapAssetId: 9,
                noteText: 'Bring referral letter.',
                isShared: true,
                sortOrder: 0,
                createdAt: new Date('2026-03-14T10:31:00.000Z'),
                updatedAt: new Date('2026-03-14T10:31:00.000Z'),
            },
            {
                id: 21,
                mapAssetId: 9,
                noteText: 'Internal reminder.',
                isShared: false,
                sortOrder: 1,
                createdAt: new Date('2026-03-14T10:32:00.000Z'),
                updatedAt: new Date('2026-03-14T10:32:00.000Z'),
            },
        ],
        mapAssetShortDescriptors: [{
            id: 30,
            mapAssetId: 9,
            descriptorText: 'Use the side entrance.',
            textColor: '#0F766E',
            highlightColor: '#FEF3C7',
            sortOrder: 0,
            createdAt: new Date('2026-03-14T10:33:00.000Z'),
            updatedAt: new Date('2026-03-14T10:33:00.000Z'),
        }],
        personalPlaces: [createPersonalPlace()],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [createPersonalPlaceLink({
            shortDescriptors: [{
                text: 'Meet beside the sheltered entrance.',
                textColor: '#1D4ED8',
                highlightColor: '#DBEAFE',
                sortOrder: 0,
            }],
        })],
        printAnnotationDocuments: [{
            mapId: 3,
            schemaVersion: 1,
            annotations: [{
                id: 'annotation_pin_1',
                type: 'pin',
                points: [[1.381, 103.741]],
                text: 'Meet here',
                style: {
                    color: '#0F766E',
                    fillColor: '#14B8A6',
                    fillOpacity: 0.14,
                    weight: 3,
                    dashed: false,
                    textColor: '#0F172A',
                    fontSize: 14,
                },
            }],
            revision: 4,
            createdAt: new Date('2026-03-14T10:34:00.000Z'),
            updatedAt: new Date('2026-03-14T10:34:00.000Z'),
        }],
        shareSnapshots: [{
            id: 40,
            mapId: 3,
            shareToken: 'live-token',
            snapshot: { name: 'Published copy' },
            createdAt: new Date('2026-03-14T10:35:00.000Z'),
            updatedAt: new Date('2026-03-14T10:35:00.000Z'),
        }],
    });

    const copied = await duplicateMyMap(db, DEFAULT_USER, 3);
    const sourceAsset = db.state.mapAssets.find((asset) => asset.mapId === 3);
    const copiedAsset = db.state.mapAssets.find((asset) => asset.mapId === copied.id);
    const copiedNotes = db.state.mapAssetNotes
        .filter((note) => note.mapAssetId === copiedAsset.id)
        .sort((left, right) => left.sortOrder - right.sortOrder);
    const copiedDescriptors = db.state.mapAssetShortDescriptors
        .filter((descriptor) => descriptor.mapAssetId === copiedAsset.id);
    const copiedLinks = db.state.personalPlaceLinks.filter((link) => link.mapId === copied.id);
    const copiedAnnotationDocument = db.state.printAnnotationDocuments
        .find((document) => document.mapId === copied.id);

    assert.equal(copied.name, 'Copy of Community planning');
    assert.equal(copied.description, 'Planning around Teck Whye.');
    assert.equal(copied.isShared, false);
    assert.equal(copied.shareToken, null);
    assert.equal(copied.sharePath, null);
    assert.equal(copied.assetCount, 2);
    assert.equal(copied.savedResourceCount, 1);
    assert.equal(copied.personalPlaceCount, 1);
    assert.equal(db.state.maps.length, 2);
    assert.deepEqual(db.state.maps.find((map) => map.id === copied.id).categoryOrder, [
        'home care',
        'active ageing centre',
    ]);
    assert.equal(copiedAsset.resourceType, 'hard');
    assert.equal(copiedAsset.resourceId, 29);
    assert.equal(copiedAsset.shortDescriptor, 'Use the side entrance.');
    assert.notEqual(copiedAsset.id, sourceAsset.id);
    copiedAsset.snapshot.name = 'Changed copied snapshot';
    assert.equal(sourceAsset.snapshot.name, 'Saved centre snapshot');
    assert.deepEqual(
        copiedNotes.map((note) => ({ text: note.noteText, isShared: note.isShared, sortOrder: note.sortOrder })),
        [
            { text: 'Bring referral letter.', isShared: true, sortOrder: 0 },
            { text: 'Internal reminder.', isShared: false, sortOrder: 1 },
        ],
    );
    assert.deepEqual(
        copiedDescriptors.map((descriptor) => ({
            text: descriptor.descriptorText,
            textColor: descriptor.textColor,
            highlightColor: descriptor.highlightColor,
        })),
        [{
            text: 'Use the side entrance.',
            textColor: '#0F766E',
            highlightColor: '#FEF3C7',
        }],
    );
    assert.equal(copiedLinks.length, 1);
    assert.equal(copiedLinks[0].personalPlaceId, 5);
    assert.deepEqual(copiedLinks[0].shortDescriptors, [{
        text: 'Meet beside the sheltered entrance.',
        textColor: '#1D4ED8',
        highlightColor: '#DBEAFE',
        sortOrder: 0,
    }]);
    assert.equal(db.state.personalPlaces.length, 1);
    assert.deepEqual(copiedAnnotationDocument.annotations[0].points, [[1.381, 103.741]]);
    assert.equal(copiedAnnotationDocument.revision, 1);
    assert.equal(db.state.shareSnapshots.length, 1);
    assert.equal(db.state.shareSnapshots[0].mapId, 3);
});

test('duplicateMyMap creates a unique private copy name', async () => {
    const db = createFakeDb({
        maps: [
            createMap({ id: 3, name: 'Community planning' }),
            createMap({ id: 4, name: 'Copy of Community planning' }),
            createMap({ id: 5, name: 'Copy of Community planning (2)' }),
        ],
    });

    const copied = await duplicateMyMap(db, DEFAULT_USER, 3);

    assert.equal(copied.name, 'Copy of Community planning (3)');
});

test('duplicateMyMap rejects guests and maps not owned by the user', async () => {
    const db = createFakeDb({
        maps: [createMap()],
    });
    const foreignDb = createFakeDb({
        maps: [createMap()],
        denyOwnedMaps: true,
    });

    await assert.rejects(
        () => duplicateMyMap(db, { id: 11, role: 'guest' }, 3),
        (err) => {
            assert.equal(err.status, 403);
            return true;
        },
    );
    await assert.rejects(
        () => duplicateMyMap(foreignDb, { id: 99, role: 'standard' }, 3),
        (err) => {
            assert.equal(err.status, 404);
            return true;
        },
    );
});

test('getMyMapDetail falls back to snapshot data for unavailable assets', async () => {
    const db = createFakeDb({
        maps: [createMap({ categoryOrder: ['home care', 'active ageing centre'] })],
        mapAssets: [createMapAsset()],
        hardAsset: null,
    });

    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(detail.name, 'Community planning');
    assert.deepEqual(detail.categoryOrder, ['home care', 'active ageing centre']);
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
        logoUrl: 'https://res.cloudinary.com/example/useful-coffee-shop.png',
        address: '21 Choa Chu Kang Avenue 4 Singapore 689812',
        postalCode: '689812',
        lat: 1.3851,
        lng: 103.7449,
        shortDescription: 'Good rest stop after appointments.',
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
    assert.equal(personalRow.logoUrl, 'https://res.cloudinary.com/example/useful-coffee-shop.png');
    assert.equal(personalRow.descriptor, 'Good rest stop after appointments.');
    assert.equal(personalRow.saveEligible, false);
    assert.equal(detail.pins.some((pin) => pin.placeKey === 'personal-place-1'), true);
});

test('uncategorized legacy personal places keep a category badge icon', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        personalPlaces: [createPersonalPlace({
            categoryId: null,
            legacyCategoryLabel: null,
        })],
        personalPlaceLinks: [createPersonalPlaceLink()],
    });

    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);
    const personalRow = detail.places
        .flatMap((place) => place.rows)
        .find((row) => row.resourceType === 'personal_place');

    assert.equal(personalRow.subCategory, 'Personal place');
    assert.equal(personalRow.categoryIconKey, 'map-pin');
    assert.equal(personalRow.categoryColor, '#64748b');
});

test('personal places can be updated and deleted on owned maps', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        personalPlaces: [createPersonalPlace()],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [createPersonalPlaceLink()],
    });

    const updated = await updateMyMapPersonalPlace(db, DEFAULT_USER, 3, 5, {
        name: 'Updated pickup point',
        categoryId: 2,
        logoUrl: 'https://res.cloudinary.com/example/updated-pickup-point.png',
        address: '10 Choa Chu Kang Avenue 4 Singapore 689810',
        postalCode: '689810',
        lat: 1.3862,
        lng: 103.7452,
        shortDescription: 'Better shelter.',
    });
    const deleted = await deleteMyMapPersonalPlace(db, DEFAULT_USER, 3, 5);

    assert.equal(updated.name, 'Updated pickup point');
    assert.equal(updated.logoUrl, 'https://res.cloudinary.com/example/updated-pickup-point.png');
    assert.equal(updated.categoryLabel, 'Shop');
    assert.equal(deleted.success, true);
    assert.equal(db.state.personalPlaces.length, 1);
    assert.equal(db.state.personalPlaceLinks.length, 0);
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

test('personal places can be reused across more than one owned map', async () => {
    const db = createFakeDb({
        maps: [
            createMap({ id: 3, name: 'Appointments' }),
            createMap({ id: 4, name: 'Errands' }),
        ],
        personalPlaces: [createPersonalPlace()],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [createPersonalPlaceLink({ mapId: 3 })],
    });

    const attached = await attachPersonalPlaceToMap(db, DEFAULT_USER, 4, 5);
    const places = await listPersonalPlaces(db, DEFAULT_USER);

    assert.equal(attached.attached, true);
    assert.deepEqual(places[0].mapIds.sort(), [3, 4]);
    assert.equal(db.state.personalPlaces.length, 1);
    assert.equal(db.state.personalPlaceLinks.length, 2);
});

test('detaching a migrated personal place removes its legacy map row without deleting the reusable place', async () => {
    const db = createFakeDb({
        maps: [
            createMap({ id: 3, name: 'Appointments' }),
            createMap({ id: 4, name: 'Errands' }),
        ],
        personalPlaces: [createPersonalPlace({ legacyMapPersonalPlaceId: 41 })],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [
            createPersonalPlaceLink({ id: 4, mapId: 3 }),
            createPersonalPlaceLink({ id: 5, mapId: 4 }),
        ],
        legacyPersonalPlaces: [{
            id: 41,
            mapId: 3,
            name: 'Useful coffee shop',
        }],
    });

    const deleted = await deleteMyMapPersonalPlace(db, DEFAULT_USER, 3, 5);

    assert.equal(deleted.success, true);
    assert.equal(db.state.personalPlaces.length, 1);
    assert.equal(db.state.legacyPersonalPlaces.length, 0);
    assert.deepEqual(db.state.personalPlaceLinks.map((link) => link.mapId), [4]);
});

test('custom category icon and colour update the shared library record', async () => {
    const db = createFakeDb();
    const created = await createPersonalPlaceCategory(db, DEFAULT_USER, {
        name: 'Pharmacy',
        iconKey: 'shopping-bag',
        iconUrl: 'https://res.cloudinary.com/example/pharmacy.png',
        color: '#BE123C',
    });
    const updated = await updatePersonalPlaceCategory(db, DEFAULT_USER, created.id, {
        name: 'Medication',
        iconKey: 'package-check',
        iconUrl: 'https://res.cloudinary.com/example/medication.png',
        color: '#2563EB',
    });

    assert.equal(updated.name, 'Medication');
    assert.equal(updated.iconKey, 'package-check');
    assert.equal(updated.iconUrl, 'https://res.cloudinary.com/example/medication.png');
    assert.equal(updated.color, '#2563EB');
});

test('map owners can add a short descriptor without changing the source resource', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        hardAsset: null,
    });

    const updated = await updateMyMapAssetShortDescriptor(db, DEFAULT_USER, 3, {
        resourceType: 'hard',
        resourceId: 29,
        shortDescriptor: 'Use the side entrance after 6 pm.',
        shortDescriptorTextColor: '#0f766e',
        shortDescriptorHighlightColor: '#fef3c7',
    });
    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(updated.shortDescriptor, 'Use the side entrance after 6 pm.');
    assert.equal(updated.shortDescriptorTextColor, '#0F766E');
    assert.equal(updated.shortDescriptorHighlightColor, '#FEF3C7');
    assert.equal(detail.assets[0].shortDescriptor, 'Use the side entrance after 6 pm.');
    assert.equal(detail.assets[0].shortDescriptorTextColor, '#0F766E');
    assert.equal(detail.assets[0].shortDescriptorHighlightColor, '#FEF3C7');
    assert.equal(detail.places[0].rows[0].mapShortDescriptor, 'Use the side entrance after 6 pm.');
    assert.equal(detail.places[0].rows[0].mapShortDescriptorTextColor, '#0F766E');
    assert.equal(detail.places[0].rows[0].mapShortDescriptorHighlightColor, '#FEF3C7');
    assert.equal(detail.places[0].rows[0].descriptor, null);
});

test('map owners can keep multiple independently styled short descriptions in order', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        hardAsset: null,
    });

    const updated = await updateMyMapAssetShortDescriptor(db, DEFAULT_USER, 3, {
        resourceType: 'hard',
        resourceId: 29,
        shortDescriptors: [
            {
                text: 'Use the side entrance after 6 pm.',
                textColor: '#0f766e',
                highlightColor: '#fef3c7',
            },
            {
                text: 'Registration is on level two.',
                textColor: '#1d4ed8',
                highlightColor: '#dbeafe',
            },
        ],
    });
    const detail = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.deepEqual(
        updated.shortDescriptors.map(({ text, textColor, highlightColor, sortOrder }) => ({
            text,
            textColor,
            highlightColor,
            sortOrder,
        })),
        [
            {
                text: 'Use the side entrance after 6 pm.',
                textColor: '#0F766E',
                highlightColor: '#FEF3C7',
                sortOrder: 0,
            },
            {
                text: 'Registration is on level two.',
                textColor: '#1D4ED8',
                highlightColor: '#DBEAFE',
                sortOrder: 1,
            },
        ],
    );
    assert.equal(detail.assets[0].shortDescriptors.length, 2);
    assert.equal(detail.places[0].rows[0].mapShortDescriptors.length, 2);
    assert.equal(detail.places[0].rows[0].mapShortDescriptors[1].text, 'Registration is on level two.');
});

test('personal place short descriptions use the general editor data without changing other maps', async () => {
    const db = createFakeDb({
        maps: [createMap({ id: 3 }), createMap({ id: 4 })],
        personalPlaces: [createPersonalPlace({ shortDescription: 'Legacy library description.' })],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [
            createPersonalPlaceLink({ id: 4, mapId: 3, shortDescriptors: [] }),
            createPersonalPlaceLink({ id: 5, mapId: 4, shortDescriptors: [] }),
        ],
    });

    const updated = await updateMyMapPersonalPlaceShortDescriptor(db, DEFAULT_USER, 3, 5, {
        shortDescriptors: [{
            text: 'Meet beside the sheltered entrance.',
            textColor: '#1d4ed8',
            highlightColor: '#dbeafe',
        }],
    });
    const firstMap = await getMyMapDetail(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);
    const secondMap = await getMyMapDetail(db, DEFAULT_USER, 4, DEFAULT_CONTEXT);
    const firstRow = firstMap.places.flatMap((place) => place.rows)
        .find((row) => row.resourceType === 'personal_place');
    const secondRow = secondMap.places.flatMap((place) => place.rows)
        .find((row) => row.resourceType === 'personal_place');

    assert.equal(updated.shortDescriptor, 'Meet beside the sheltered entrance.');
    assert.equal(updated.shortDescriptorTextColor, '#1D4ED8');
    assert.equal(updated.shortDescriptorHighlightColor, '#DBEAFE');
    assert.equal(firstRow.mapShortDescriptor, 'Meet beside the sheltered entrance.');
    assert.equal(firstRow.mapShortDescriptors.length, 1);
    assert.equal(secondRow.mapShortDescriptor, null);
    assert.equal(db.state.personalPlaces[0].shortDescription, 'Legacy library description.');
});

test('map descriptor updates preserve existing colours when an older client omits style fields', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset({
            shortDescriptor: 'Original context.',
            shortDescriptorTextColor: '#1D4ED8',
            shortDescriptorHighlightColor: '#DBEAFE',
        })],
        hardAsset: null,
    });

    const updated = await updateMyMapAssetShortDescriptor(db, DEFAULT_USER, 3, {
        resourceType: 'hard',
        resourceId: 29,
        shortDescriptor: 'Updated context.',
    });

    assert.equal(updated.shortDescriptor, 'Updated context.');
    assert.equal(updated.shortDescriptorTextColor, '#1D4ED8');
    assert.equal(updated.shortDescriptorHighlightColor, '#DBEAFE');
});

test('starter personal place categories remain unique when first loads race', async () => {
    const db = createFakeDb();

    const [firstLoad, secondLoad] = await Promise.all([
        ensureDefaultPersonalPlaceCategories(db, DEFAULT_USER.id),
        ensureDefaultPersonalPlaceCategories(db, DEFAULT_USER.id),
    ]);

    assert.equal(firstLoad.length, 6);
    assert.equal(secondLoad.length, 6);
    assert.equal(db.state.personalPlaceCategories.length, 6);
    assert.equal(
        new Set(db.state.personalPlaceCategories.map((category) => category.normalizedName)).size,
        6
    );
});

test('deleting a library place removes all map links but not the maps', async () => {
    const db = createFakeDb({
        maps: [createMap({ id: 3 }), createMap({ id: 4 })],
        personalPlaces: [createPersonalPlace()],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [
            createPersonalPlaceLink({ id: 4, mapId: 3 }),
            createPersonalPlaceLink({ id: 6, mapId: 4 }),
        ],
    });

    const result = await deletePersonalPlace(db, DEFAULT_USER, 5);

    assert.deepEqual(result.removedFromMapIds.sort(), [3, 4]);
    assert.equal(db.state.personalPlaces.length, 0);
    assert.equal(db.state.personalPlaceLinks.length, 0);
    assert.equal(db.state.maps.length, 2);
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

test('updateMyMapCategoryOrder persists only normalized category keys for the owner', async () => {
    const db = createFakeDb({ maps: [createMap()] });

    const result = await updateMyMapCategoryOrder(db, DEFAULT_USER, 3, {
        categoryOrder: [
            ' Home care ',
            'ACTIVE AGEING CENTRE',
            'home care',
        ],
    });

    assert.deepEqual(result.categoryOrder, [
        'home care',
        'active ageing centre',
    ]);
    assert.deepEqual(db.state.maps[0].categoryOrder, result.categoryOrder);
    assert.ok(db.state.maps[0].updatedAt instanceof Date);
});

test('updateMyMapCategoryOrder keeps owner authorization intact', async () => {
    const db = createFakeDb({ maps: [createMap()] });

    await assert.rejects(
        () => updateMyMapCategoryOrder(db, { id: 9, role: 'guest' }, 3, {
            categoryOrder: ['home care'],
        }),
        (error) => error.status === 403,
    );
});

test('publishMyMap enables a reusable share link', async () => {
    const db = createFakeDb({
        maps: [createMap({ categoryOrder: ['home care', 'active ageing centre'] })],
        mapAssets: [createMapAsset()],
    });

    const published = await publishMyMap(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    assert.equal(published.isShared, true);
    assert.equal(published.shareIncludesHandoffNotes, false);
    assert.equal(typeof published.shareToken, 'string');
    assert.match(published.sharePath, /^\/shared\/maps\//);
    assert.deepEqual(db.state.shareSnapshots[0].snapshot.categoryOrder, [
        'home care',
        'active ageing centre',
    ]);
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
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [createPersonalPlaceLink()],
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

test('publishMyMap excludes owner-only resource short descriptors', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset({
            shortDescriptor: 'Private map context.',
            shortDescriptorTextColor: '#1D4ED8',
            shortDescriptorHighlightColor: '#DBEAFE',
        })],
        hardAsset: createHardAsset(),
    });

    await publishMyMap(db, DEFAULT_USER, 3, DEFAULT_CONTEXT);

    const snapshot = db.state.shareSnapshots[0].snapshot;
    assert.equal(snapshot.assets[0].shortDescriptor, undefined);
    assert.equal(snapshot.assets[0].shortDescriptorTextColor, undefined);
    assert.equal(snapshot.assets[0].shortDescriptorHighlightColor, undefined);
    assert.equal(snapshot.assets[0].shortDescriptors, undefined);
    assert.equal(snapshot.places[0].rows[0].mapShortDescriptor, null);
    assert.equal(snapshot.places[0].rows[0].mapShortDescriptorTextColor, null);
    assert.equal(snapshot.places[0].rows[0].mapShortDescriptorHighlightColor, null);
    assert.deepEqual(snapshot.places[0].rows[0].mapShortDescriptors, []);
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

test('deleteMyMapRecord removes map links but preserves reusable personal places', async () => {
    const db = createFakeDb({
        maps: [createMap()],
        mapAssets: [createMapAsset()],
        personalPlaces: [createPersonalPlace()],
        personalPlaceCategories: [createPersonalPlaceCategoryFixture()],
        personalPlaceLinks: [createPersonalPlaceLink()],
    });

    const result = await deleteMyMapRecord(db, DEFAULT_USER, 3);

    assert.equal(result.success, true);
    assert.equal(db.state.maps.length, 0);
    assert.equal(db.state.mapAssets.length, 0);
    assert.equal(db.state.personalPlaceLinks.length, 0);
    assert.equal(db.state.personalPlaces.length, 1);
});
