import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildEmbedCategoryOptions,
    buildEmbeddedMapPresentation,
    filterEmbedDirectoryByCategories,
    findEmbedPreviewGroup,
    getEmbedListOnlyResourceCount,
    shouldShowEmbedResourceName,
} from '../src/lib/embedMapPresentation.js';

function createDirectory() {
    return {
        categoryOrder: ['senior care centre', 'active ageing centre'],
        places: [
            {
                placeKey: 'mapped-1',
                name: 'Mapped care centre',
                address: '1 Example Street Singapore 600001',
                hasCoordinates: true,
                lat: 1.33,
                lng: 103.74,
                rows: [{
                    rowKey: 'hard-1',
                    resourceType: 'hard',
                    resourceId: 1,
                    name: 'Mapped care centre',
                    subCategory: 'Active Ageing Centre',
                    categoryColor: '#2563eb',
                    detailPath: '/resource/hard/1',
                }],
            },
            {
                placeKey: 'mapped-2',
                name: 'Rehabilitation centre',
                address: '2 Example Street Singapore 600002',
                hasCoordinates: true,
                lat: 1.34,
                lng: 103.75,
                rows: [{
                    rowKey: 'hard-2',
                    resourceType: 'hard',
                    resourceId: 2,
                    name: 'Rehabilitation centre',
                    subCategory: 'Senior Care Centre',
                    categoryColor: '#0f766e',
                    detailPath: '/resource/hard/2',
                }],
            },
            {
                placeKey: 'unmapped-3',
                name: 'Telephone support',
                hasCoordinates: false,
                lat: null,
                lng: null,
                rows: [{
                    rowKey: 'soft-3',
                    resourceType: 'soft',
                    resourceId: 3,
                    name: 'Telephone support',
                    subCategory: 'Support service',
                    detailPath: '/resource/soft/3',
                }],
            },
        ],
    };
}

test('embed category options respect the owner category sequence', () => {
    assert.deepEqual(
        buildEmbedCategoryOptions(createDirectory()).map((option) => option.label),
        ['Senior Care Centre', 'Active Ageing Centre', 'Support service'],
    );
});

test('embedded map presentation filters pins by category and text query', () => {
    const presentation = buildEmbeddedMapPresentation(createDirectory(), {
        selectedCategoryKeys: ['active ageing centre'],
        query: 'mapped',
    });

    assert.equal(presentation.pins.length, 1);
    assert.equal(presentation.pins[0].placeKey, 'mapped-1');
    assert.equal(findEmbedPreviewGroup(presentation, 'mapped-1')?.rows[0]?.resourceId, 1);
});

test('selecting a Group category reveals its mapped member resources', () => {
    const directory = createDirectory();
    directory.places.push({
        placeKey: 'unmapped-group-9',
        name: 'ICCP CCK3',
        hasCoordinates: false,
        lat: null,
        lng: null,
        rows: [{
            rowKey: 'soft-9',
            assetKey: 'soft-9',
            resourceType: 'soft',
            resourceId: 9,
            name: 'ICCP CCK3',
            subCategory: 'Integrated Community Care Provider (ICCP)',
            assetMode: 'group',
            groupMemberAssetKeys: ['hard-1', 'hard-2', 'soft-404'],
            mapFocusPlaceKeys: ['mapped-1', 'mapped-2', 'mapped-404'],
        }],
    });
    directory.places[0].rows[0].assetKey = 'hard-1';
    directory.places[1].rows[0].assetKey = 'hard-2';

    const filtered = filterEmbedDirectoryByCategories(directory, [
        'Integrated Community Care Provider (ICCP)',
    ]);
    const presentation = buildEmbeddedMapPresentation(directory, {
        selectedCategoryKeys: ['Integrated Community Care Provider (ICCP)'],
    });

    assert.deepEqual(
        filtered.places.map((place) => place.placeKey),
        ['mapped-1', 'mapped-2', 'unmapped-group-9'],
    );
    assert.deepEqual(
        presentation.mappedGroups.flatMap((group) => group.rows.map((row) => row.assetKey)).sort(),
        ['hard-1', 'hard-2'],
    );
    assert.equal(presentation.pins.length, 2);
});

test('map-only presentation reports resources without coordinates separately', () => {
    assert.equal(getEmbedListOnlyResourceCount(createDirectory()), 1);
});

test('resource preview suppresses only a redundant single resource name', () => {
    const singleGroup = {
        name: 'Mapped care centre',
        rows: [{ name: 'Mapped care centre' }],
    };
    assert.equal(shouldShowEmbedResourceName(singleGroup, singleGroup.rows[0]), false);

    const hostedGroup = {
        name: 'Mapped care centre',
        rows: [{ name: 'Falls prevention workshop' }],
    };
    assert.equal(shouldShowEmbedResourceName(hostedGroup, hostedGroup.rows[0]), true);

    const multiGroup = {
        name: 'Mapped care centre',
        rows: [{ name: 'Mapped care centre' }, { name: 'Meals service' }],
    };
    assert.equal(shouldShowEmbedResourceName(multiGroup, multiGroup.rows[0]), true);
});
