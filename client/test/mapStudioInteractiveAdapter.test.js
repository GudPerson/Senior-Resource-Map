import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAP_STUDIO_INTERACTIVE_DEFERRED_PATHS,
    MAP_STUDIO_INTERACTIVE_SUPPORTED_PATHS,
    buildMapStudioInteractiveModel,
} from '../src/lib/mapStudioInteractiveAdapter.js';
import {
    MAP_STUDIO_CAMERA_FIXED,
    MAP_STUDIO_MAP_HEIGHT_TALL,
    MAP_STUDIO_PIN_STYLE_CATEGORY_ICON,
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    createMapStudioDesign,
} from '../src/lib/mapStudioState.js';
import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_PIN_SIZE_LARGE,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
} from '../src/lib/printMapState.js';

test('interactive model preserves the locked category-bubble defaults', () => {
    const model = buildMapStudioInteractiveModel(createMapStudioDesign({
        mapStyle: 'gray',
        detailMode: 'auto',
    }));

    assert.deepEqual(model.directoryMap, {
        mapStyleOverride: 'gray',
        basemapMode: 'auto',
        mapViewState: null,
        markerMode: 'category-bubble',
        markerScale: 1,
        numberedPinShapesByCategory: {},
        numberedPinStylesByCategory: {},
        pinBadgeMode: 'none',
        pinCategoryIconMode: 'none',
        clusterMarkerMode: 'none',
    });
    assert.deepEqual(model.annotationLayer, {
        visible: true,
        hiddenAnnotationIds: [],
    });
    assert.equal(model.layout.mapHeight, 'standard');
    assert.deepEqual(model.supportedPaths, MAP_STUDIO_INTERACTIVE_SUPPORTED_PATHS);
    assert.deepEqual(model.deferredPaths, MAP_STUDIO_INTERACTIVE_DEFERRED_PATHS);
    assert.deepEqual(model.cardIdentity, {
        mode: 'logo',
        showNumberBadge: false,
        numberedPinShapesByCategory: {},
        numberedPinStylesByCategory: {},
    });
});

test('interactive model maps only proven DirectoryMap design seams', () => {
    const design = createMapStudioDesign();
    design.camera = {
        mode: MAP_STUDIO_CAMERA_FIXED,
        view: { center: [1.385, 103.744], zoom: 16.5 },
    };
    design.pins.style = MAP_STUDIO_PIN_STYLE_NUMBERED;
    design.pins.size = PRINT_MAP_PIN_SIZE_LARGE;
    design.pins.categoryShapes = { 'active ageing centre (aac)': 'triangle' };
    design.pins.categoryStyles = {
        'active ageing centre (aac)': { fillColor: '#123456', ringColor: '#ABCDEF' },
    };
    design.layers.resources = PRINT_MAP_RESOURCE_LAYER_HIDE;
    design.layers.annotations = PRINT_MAP_ANNOTATION_LAYER_HIDE;
    design.layers.hiddenResourceLayerKeys = ['resource:carearound'];
    design.layers.hiddenAnnotationIds = ['annotation-1'];
    design.layout.mapHeight = MAP_STUDIO_MAP_HEIGHT_TALL;
    design.layout.preset = 'map-focus';
    design.layout.mapSide = 'right';
    design.layout.mapWidth = 'extra-wide';
    design.layout.resourceColumnCount = 4;
    design.layout.sideResourceColumnCount = 2;
    design.layout.resourceDisplay = 'table';

    const model = buildMapStudioInteractiveModel(design);

    assert.deepEqual(model.directoryMap, {
        mapStyleOverride: 'default',
        basemapMode: 'auto',
        mapViewState: { center: [1.385, 103.744], zoom: 16.5 },
        markerMode: 'print-badge',
        markerScale: 1.25,
        numberedPinShapesByCategory: { 'active ageing centre (aac)': 'triangle' },
        numberedPinStylesByCategory: {
            'active ageing centre (aac)': { fillColor: '#123456', ringColor: '#ABCDEF' },
        },
        pinBadgeMode: 'none',
        pinCategoryIconMode: 'none',
        clusterMarkerMode: 'none',
    });
    assert.deepEqual(model.annotationLayer, {
        visible: false,
        hiddenAnnotationIds: ['annotation-1'],
    });
    assert.deepEqual(model.resourceLayer, {
        visible: false,
        hiddenResourceLayerKeys: ['resource:carearound'],
        interactiveSupport: 'supported',
    });
    assert.deepEqual(model.labels, { detail: 'full' });
    assert.deepEqual(model.layout, {
        mapHeight: 'tall',
        preset: 'map-focus',
        resourcePanel: 'beside-map',
        mapSide: 'right',
        mapWidth: 'extra-wide',
        resourceColumnCount: 4,
        sideResourceColumnCount: 2,
        resourceDisplay: 'table',
        resourcePanelSupport: 'supported',
    });
    assert.deepEqual(model.deferredPaths, []);
});

test('category icon pins and cards share one identity without aggregate clustering', () => {
    const design = createMapStudioDesign();
    design.pins.style = MAP_STUDIO_PIN_STYLE_CATEGORY_ICON;
    const model = buildMapStudioInteractiveModel(design);

    assert.equal(model.directoryMap.markerMode, 'category-icon');
    assert.equal(model.directoryMap.pinCategoryIconMode, 'auto');
    assert.equal(model.directoryMap.clusterMarkerMode, 'none');
    assert.equal(model.cardIdentity.mode, 'category-icon');
    assert.equal(model.cardIdentity.showNumberBadge, false);
});

test('numbered pins keep individual collision-managed bubble identities', () => {
    const design = createMapStudioDesign();
    design.pins.style = MAP_STUDIO_PIN_STYLE_NUMBERED;
    const model = buildMapStudioInteractiveModel(design);

    assert.equal(model.directoryMap.markerMode, 'print-badge');
    assert.equal(model.directoryMap.clusterMarkerMode, 'none');
    assert.equal(model.cardIdentity.mode, 'logo');
    assert.equal(model.cardIdentity.showNumberBadge, true);
    assert.deepEqual(model.cardIdentity.numberedPinShapesByCategory, {});
    assert.deepEqual(model.cardIdentity.numberedPinStylesByCategory, {});
});

test('interactive model returns cloned camera and layer arrays', () => {
    const design = createMapStudioDesign();
    design.camera = {
        mode: MAP_STUDIO_CAMERA_FIXED,
        view: { center: [1.3, 103.8], zoom: 14 },
    };
    design.layers.hiddenAnnotationIds = ['annotation-1'];

    const model = buildMapStudioInteractiveModel(design);
    model.directoryMap.mapViewState.center[0] = 0;
    model.annotationLayer.hiddenAnnotationIds.push('annotation-2');

    assert.deepEqual(design.camera.view.center, [1.3, 103.8]);
    assert.deepEqual(design.layers.hiddenAnnotationIds, ['annotation-1']);
});
