import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildManageMapResourceCatalog,
    filterManageMapResourceCatalog,
    loadManageMapResourceCatalog,
    MANAGE_MAP_CATALOG_RESULT_LIMIT,
} from '../src/lib/manageMapResourceCatalog.js';

test('manage-map catalogue normalizes Places and Offerings and removes duplicates', () => {
    const catalog = buildManageMapResourceCatalog({
        hardAssets: [
            { id: 12, name: 'Community Club', address: '12 Example Road', lat: '1.3', lng: '103.8' },
            { id: 12, name: 'Duplicate Community Club' },
        ],
        softAssets: [
            {
                id: 44,
                name: 'Chair Zumba',
                subCategory: 'Active Ageing Programme',
                locations: [{ address: '12 Example Road', lat: 1.3, lng: 103.8 }],
            },
        ],
    });

    assert.equal(catalog.length, 2);
    assert.deepEqual(catalog.map((asset) => `${asset.resourceType}-${asset.resourceId}`), ['hard-12', 'soft-44']);
    assert.equal(catalog[0].hasCoordinates, true);
    assert.equal(catalog[1].address, '12 Example Road');
});

test('manage-map catalogue search excludes saved items and respects type and result limits', () => {
    const catalog = buildManageMapResourceCatalog({
        hardAssets: Array.from({ length: MANAGE_MAP_CATALOG_RESULT_LIMIT + 5 }, (_, index) => ({
            id: index + 1,
            name: `Senior support place ${String(index + 1).padStart(2, '0')}`,
            subCategory: 'Support',
        })),
        softAssets: [{ id: 90, name: 'Senior support programme', subCategory: 'Programme' }],
    });

    assert.deepEqual(filterManageMapResourceCatalog({ catalog, query: 's' }), []);

    const places = filterManageMapResourceCatalog({
        catalog,
        query: 'senior support',
        filter: 'hard',
        savedAssetKeys: new Set(['hard-1']),
    });
    assert.equal(places.length, MANAGE_MAP_CATALOG_RESULT_LIMIT);
    assert.equal(places.some((asset) => asset.resourceId === 1), false);

    const offerings = filterManageMapResourceCatalog({
        catalog,
        query: 'programme',
        filter: 'soft',
    });
    assert.deepEqual(offerings.map((asset) => asset.resourceId), [90]);
});

test('manage-map catalogue loader uses public Discovery cache and appends Groups', async () => {
    let hardFallbackCalls = 0;
    const catalog = await loadManageMapResourceCatalog({
        getDiscoveryCache: async () => ([
            { asset_type: 'hard', id: 7, name: 'Cached Place', address: '7 Sample Street' },
            { asset_type: 'soft', id: 8, name: 'Cached Programme', location_address: '7 Sample Street' },
        ]),
        getHardAssets: async () => {
            hardFallbackCalls += 1;
            return [];
        },
        getSoftAssets: async () => [],
        fetchAll: async (fetchPage, params = {}) => (
            params.assetMode === 'group'
                ? [{ id: 9, name: 'Support Group', assetMode: 'group' }]
                : fetchPage(params)
        ),
    });

    assert.equal(hardFallbackCalls, 0);
    assert.deepEqual(catalog.map((asset) => `${asset.resourceType}-${asset.resourceId}`), [
        'hard-7',
        'soft-8',
        'soft-9',
    ]);
});

test('manage-map catalogue loader falls back to paginated resource lists when cache is unavailable', async () => {
    const calls = [];
    const getHardAssets = async () => [];
    const getSoftAssets = async () => [];
    const catalog = await loadManageMapResourceCatalog({
        getDiscoveryCache: async () => {
            throw new Error('cache unavailable');
        },
        getHardAssets,
        getSoftAssets,
        fetchAll: async (fetchPage, params = {}) => {
            calls.push([fetchPage, params]);
            if (params.assetMode === 'group') return [];
            if (fetchPage === getHardAssets) return [{ id: 21, name: 'Fallback Place' }];
            return [{ id: 22, name: 'Fallback Offering' }];
        },
    });

    assert.deepEqual(catalog.map((asset) => `${asset.resourceType}-${asset.resourceId}`), ['hard-21', 'soft-22']);
    assert.equal(calls.length, 3);
});
