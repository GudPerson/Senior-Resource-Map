import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_ANNOTATION_LAYER_SHOW,
} from '../src/lib/printMapState.js';
import {
    PRINT_MAP_RESOURCE_GROUP_CAREAROUND,
    PRINT_MAP_RESOURCE_GROUP_PERSONAL,
    buildPrintMapResourceLayers,
    filterPrintMapAnnotations,
    filterPrintMapResourcePins,
    getPrintResourceCategoryLayerKey,
    getVisiblePrintResourcePlaceKeys,
} from '../src/lib/printMapLayers.js';

const presentation = {
    displayGroups: [
        {
            placeKey: 'hard:1',
            name: 'Care centre',
            hasCoordinates: true,
            categoryLabel: 'Senior Care Centre',
            rows: [{ resourceType: 'hard' }],
        },
        {
            placeKey: 'hard:2',
            name: 'Community club',
            hasCoordinates: true,
            categoryLabel: 'Community Club',
            rows: [{ resourceType: 'hard' }],
        },
        {
            placeKey: 'personal:3',
            name: 'Pickup point',
            hasCoordinates: true,
            categoryLabel: 'Pickup Point',
            rows: [{ resourceType: 'personal_place' }],
        },
        {
            placeKey: 'unmapped:4',
            name: 'Telephone service',
            hasCoordinates: false,
            categoryLabel: 'Support line',
            rows: [{ resourceType: 'soft' }],
        },
    ],
};

test('print resource layers group mapped CareAround and personal-place categories', () => {
    const model = buildPrintMapResourceLayers(presentation);

    assert.deepEqual(
        model.groups.map(({ key, count }) => ({ key, count })),
        [
            { key: PRINT_MAP_RESOURCE_GROUP_CAREAROUND, count: 2 },
            { key: PRINT_MAP_RESOURCE_GROUP_PERSONAL, count: 1 },
        ],
    );
    assert.deepEqual(
        model.groups[0].categories.map(({ label, count }) => ({ label, count })),
        [
            { label: 'Community Club', count: 1 },
            { label: 'Senior Care Centre', count: 1 },
        ],
    );
    assert.equal(model.layerKeyByPlaceKey['personal:3'], getPrintResourceCategoryLayerKey(
        PRINT_MAP_RESOURCE_GROUP_PERSONAL,
        'Pickup Point',
    ));
    assert.equal(Object.hasOwn(model.layerKeyByPlaceKey, 'unmapped:4'), false);
});

test('resource layer visibility preserves original badge numbers in mixed-coordinate pins', () => {
    const model = buildPrintMapResourceLayers(presentation);
    const hiddenLayerKeys = [
        getPrintResourceCategoryLayerKey(
            PRINT_MAP_RESOURCE_GROUP_CAREAROUND,
            'Senior Care Centre',
        ),
    ];
    const visiblePlaceKeys = getVisiblePrintResourcePlaceKeys(model, hiddenLayerKeys);
    const pins = [{
        pinKey: 'print:shared-coordinate',
        placeKey: 'print-group:shared-coordinate',
        number: 1,
        printNumberLabel: '1',
        categoryColor: '#2563EB',
        memberPlaceKeys: ['hard:1', 'personal:3'],
        printBadgeItems: [
            { number: 1, label: '1', color: '#2563EB', placeKey: 'hard:1' },
            { number: 3, label: '3', color: '#0F766E', placeKey: 'personal:3' },
        ],
    }];

    const visiblePins = filterPrintMapResourcePins(pins, visiblePlaceKeys);

    assert.equal(visiblePins.length, 1);
    assert.equal(visiblePins[0].number, 3);
    assert.equal(visiblePins[0].printNumberLabel, '3');
    assert.equal(visiblePins[0].categoryColor, '#0F766E');
    assert.deepEqual(visiblePins[0].memberPlaceKeys, ['personal:3']);
    assert.deepEqual(visiblePins[0].printBadgeItems.map((item) => item.label), ['3']);
    assert.deepEqual(pins[0].printBadgeItems.map((item) => item.label), ['1', '3']);
});

test('resource group visibility removes only its markers without changing the layer model', () => {
    const model = buildPrintMapResourceLayers(presentation);
    const visiblePlaceKeys = getVisiblePrintResourcePlaceKeys(model, [
        PRINT_MAP_RESOURCE_GROUP_CAREAROUND,
    ]);

    assert.deepEqual([...visiblePlaceKeys], ['personal:3']);
    assert.equal(model.groups[0].count, 2);
    assert.equal(model.groups[1].count, 1);
});

test('annotation layer visibility is presentation-only and preserves source ordering', () => {
    const annotations = [
        { id: 'annotation_1', type: 'polygon', text: 'Walking area' },
        { id: 'annotation_2', type: 'line', text: '' },
        { id: 'annotation_3', type: 'pin', text: 'Pickup' },
    ];

    assert.deepEqual(
        filterPrintMapAnnotations(annotations, {
            annotationLayer: PRINT_MAP_ANNOTATION_LAYER_SHOW,
            hiddenAnnotationIds: ['annotation_2'],
        }).map((annotation) => annotation.id),
        ['annotation_1', 'annotation_3'],
    );
    assert.deepEqual(
        filterPrintMapAnnotations(annotations, {
            annotationLayer: PRINT_MAP_ANNOTATION_LAYER_HIDE,
            hiddenAnnotationIds: [],
        }),
        [],
    );
    assert.deepEqual(annotations.map((annotation) => annotation.id), [
        'annotation_1',
        'annotation_2',
        'annotation_3',
    ]);
});
