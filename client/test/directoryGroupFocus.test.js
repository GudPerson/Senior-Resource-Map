import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeGroupFocusDetailsIntoDirectory } from '../src/lib/directoryGroupFocus.js';

function mappedPlace(id, name = `Place ${id}`) {
    return {
        placeKey: `hard-${id}`,
        placeId: id,
        name,
        hasCoordinates: true,
        lat: '1.3500',
        lng: '103.7500',
        rows: [
            {
                rowKey: `hard-${id}:hard`,
                assetKey: `hard-${id}`,
                resourceType: 'hard',
                resourceId: id,
                name,
                status: 'available',
            },
        ],
    };
}

function listOnlySoftPlace(row) {
    return {
        placeKey: `fallback-soft-${row.resourceId}`,
        placeId: null,
        name: row.name,
        hasCoordinates: false,
        lat: null,
        lng: null,
        rows: [
            {
                rowKey: `soft-${row.resourceId}:fallback`,
                assetKey: `soft-${row.resourceId}`,
                resourceType: 'soft',
                status: 'list_only',
                ...row,
            },
        ],
    };
}

test('merges public Group detail places into old My Map payloads as focus keys', () => {
    const directory = {
        id: 87,
        places: [
            mappedPlace(10, 'Fei Yue Active Ageing Centre'),
            listOnlySoftPlace({
                resourceId: 203,
                name: 'ICCP CCK3',
                subCategory: 'Integrated Community Care Provider (ICCP)',
            }),
        ],
    };
    const enriched = mergeGroupFocusDetailsIntoDirectory(directory, new Map([
        [203, {
            id: 203,
            assetMode: 'group',
            groupMembers: {
                places: [
                    { id: 10, name: 'Fei Yue Active Ageing Centre' },
                    { id: 404, name: 'Not on this map' },
                ],
                programmes: [{ id: 20, name: 'Not a Place member' }],
            },
        }],
    ]));
    const groupRow = enriched.places[1].rows[0];

    assert.deepEqual(groupRow.mapFocusPlaceKeys, ['hard-10']);
    assert.equal(directory.places[1].rows[0].mapFocusPlaceKeys, undefined);
});

test('does not add focus keys for non-Group soft details or Groups with no mapped Places', () => {
    const directory = {
        id: 88,
        places: [
            mappedPlace(10),
            listOnlySoftPlace({ resourceId: 204, name: 'Standalone programme' }),
            listOnlySoftPlace({ resourceId: 205, name: 'Unmapped Group' }),
        ],
    };
    const enriched = mergeGroupFocusDetailsIntoDirectory(directory, new Map([
        [204, {
            id: 204,
            assetMode: 'standalone',
            groupMembers: { places: [{ id: 10 }] },
        }],
        [205, {
            id: 205,
            assetMode: 'group',
            groupMembers: { places: [{ id: 999 }] },
        }],
    ]));

    assert.equal(enriched.places[1].rows[0].mapFocusPlaceKeys, undefined);
    assert.equal(enriched.places[2].rows[0].mapFocusPlaceKeys, undefined);
});
