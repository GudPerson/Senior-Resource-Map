import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildEmbedCategoryOptions,
    buildEmbeddedMapRuntime,
    buildEmbeddedMapPresentation,
    DEFAULT_EMBEDDED_MAP_PRESENTATION,
    filterEmbedDirectoryByCategories,
    findEmbedPreviewGroup,
    findEmbedPreviewGroups,
    getEmbedListOnlyResourceCount,
    buildEmbedResourcePreviewDetails,
} from '../src/lib/embedMapPresentation.js';

test('embedded map runtime maps the frozen public presentation to existing renderers', () => {
    assert.deepEqual(buildEmbeddedMapRuntime({
        version: 1,
        mapStyle: 'gray',
        detailMode: 'live',
        pinStyle: 'numbered',
        pinSize: 'extra-large',
        pinsVisible: false,
        annotationsVisible: false,
        numberedPinShapesByCategory: { 'active ageing centre': 'star' },
        layout: { preset: 'map-focus' },
    }), {
        version: 1,
        mapStyle: 'gray',
        detailMode: 'live',
        pinStyle: 'numbered',
        pinSize: 'extra-large',
        pinsVisible: false,
        annotationsVisible: false,
        markerMode: 'print-badge',
        markerScale: 1.5,
        printBadgeScale: 1.5,
        pinBadgeMode: 'none',
        pinCategoryIconMode: 'none',
        clusterMarkerMode: 'none',
    });
    assert.deepEqual(buildEmbeddedMapRuntime(null), {
        ...DEFAULT_EMBEDDED_MAP_PRESENTATION,
        markerMode: 'category-bubble',
        markerScale: 1,
        printBadgeScale: 1,
        pinBadgeMode: 'none',
        pinCategoryIconMode: 'none',
        clusterMarkerMode: 'none',
    });
});

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

test('embedded map resolves a shared category pin to every public resource at that postal location', () => {
    const directory = createDirectory();
    directory.places[1] = {
        ...directory.places[1],
        address: '1 Example Street Singapore 600001',
        lat: 1.3302,
        lng: 103.7402,
    };
    const presentation = buildEmbeddedMapPresentation(directory);
    const sharedPin = presentation.pins.find((pin) => pin.isPostalGroup);

    assert.equal(sharedPin.curatedCount, 2);
    assert.deepEqual(sharedPin.memberPlaceKeys, ['mapped-1', 'mapped-2']);
    assert.deepEqual(
        findEmbedPreviewGroups(presentation, sharedPin.placeKey).map((group) => group.placeKey),
        ['mapped-2', 'mapped-1'],
    );
    assert.deepEqual(
        findEmbedPreviewGroups(presentation, 'mapped-1').map((group) => group.placeKey),
        ['mapped-1'],
    );
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

test('resource preview consolidates identity, address, and optional hours', () => {
    const group = {
        name: 'Mapped care centre',
        address: '1 Example Street Singapore 600001',
    };

    assert.deepEqual(buildEmbedResourcePreviewDetails(group, {
        name: 'Mapped care centre',
        address: '1 Example Street Singapore 600001',
        resourceType: 'hard',
        descriptor: 'Mon-Fri: 8.30am-6.00pm',
        openProgrammeServiceCount: 4,
    }), {
        name: 'Mapped care centre',
        address: '1 Example Street Singapore 600001',
        scheduleText: 'Mon-Fri: 8.30am-6.00pm',
        scheduleLabelKey: 'operatingHours',
        openProgrammeServiceCount: 4,
    });

    assert.deepEqual(buildEmbedResourcePreviewDetails(group, {
        name: 'Falls prevention workshop',
        resourceType: 'soft',
        descriptor: 'Fridays, 10am',
    }), {
        name: 'Falls prevention workshop',
        address: '1 Example Street Singapore 600001',
        scheduleText: 'Fridays, 10am',
        scheduleLabelKey: 'schedule',
        openProgrammeServiceCount: 0,
    });
});
