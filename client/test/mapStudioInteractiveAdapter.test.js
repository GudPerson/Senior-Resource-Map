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
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    MAP_STUDIO_RESOURCE_PANEL_BESIDE,
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
    });
    assert.deepEqual(model.annotationLayer, {
        visible: true,
        hiddenAnnotationIds: [],
    });
    assert.equal(model.layout.mapHeight, 'standard');
    assert.deepEqual(model.supportedPaths, MAP_STUDIO_INTERACTIVE_SUPPORTED_PATHS);
    assert.deepEqual(model.deferredPaths, MAP_STUDIO_INTERACTIVE_DEFERRED_PATHS);
    assert.equal('clusterMarkerMode' in model.directoryMap, false);
    assert.equal('pinBadgeMode' in model.directoryMap, false);
    assert.equal('pinCategoryIconMode' in model.directoryMap, false);
});

test('interactive model maps only proven DirectoryMap design seams', () => {
    const design = createMapStudioDesign();
    design.camera = {
        mode: MAP_STUDIO_CAMERA_FIXED,
        view: { center: [1.385, 103.744], zoom: 16.5 },
    };
    design.pins.style = MAP_STUDIO_PIN_STYLE_NUMBERED;
    design.pins.size = PRINT_MAP_PIN_SIZE_LARGE;
    design.layers.resources = PRINT_MAP_RESOURCE_LAYER_HIDE;
    design.layers.annotations = PRINT_MAP_ANNOTATION_LAYER_HIDE;
    design.layers.hiddenResourceLayerKeys = ['resource:carearound'];
    design.layers.hiddenAnnotationIds = ['annotation-1'];
    design.layout.mapHeight = MAP_STUDIO_MAP_HEIGHT_TALL;
    design.layout.resourcePanel = MAP_STUDIO_RESOURCE_PANEL_BESIDE;

    const model = buildMapStudioInteractiveModel(design);

    assert.deepEqual(model.directoryMap, {
        mapStyleOverride: 'default',
        basemapMode: 'auto',
        mapViewState: { center: [1.385, 103.744], zoom: 16.5 },
        markerMode: 'print-badge',
        markerScale: 1.25,
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
        resourcePanel: 'beside-map',
        resourcePanelSupport: 'supported',
    });
    assert.deepEqual(model.deferredPaths, []);
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
