import {
    MAP_STUDIO_CAMERA_FIXED,
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    normalizeMapStudioDesign,
} from './mapStudioState.js';
import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
    getPrintMapPinScale,
} from './printMapState.js';

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export const MAP_STUDIO_INTERACTIVE_SUPPORTED_PATHS = Object.freeze([
    'basemap.style',
    'basemap.detailMode',
    'camera',
    'pins.style',
    'pins.size',
    'labels.detail',
    'layers.resources',
    'layers.hiddenResourceLayerKeys',
    'layers.annotations',
    'layers.hiddenAnnotationIds',
    'layout.mapHeight',
    'layout.resourcePanel',
]);

export const MAP_STUDIO_INTERACTIVE_DEFERRED_PATHS = Object.freeze([]);

/**
 * Translate a normalized Map Studio design into existing interactive renderer
 * seams. This adapter is intentionally renderer-neutral: it does not import a
 * React component, change a global map preference, or mutate the design.
 *
 * Settings listed in `deferredPaths` must not be exposed as working owner
 * controls until their interactive map, card, and mobile behavior has parity
 * coverage. Export may still support them through `buildMapStudioPrintState`.
 */
export function buildMapStudioInteractiveModel(design, defaults = {}) {
    const normalizedDesign = normalizeMapStudioDesign(design, defaults);

    return {
        directoryMap: {
            mapStyleOverride: normalizedDesign.basemap.style,
            basemapMode: normalizedDesign.basemap.detailMode,
            mapViewState: normalizedDesign.camera.mode === MAP_STUDIO_CAMERA_FIXED
                ? clone(normalizedDesign.camera.view)
                : null,
            markerMode: normalizedDesign.pins.style === MAP_STUDIO_PIN_STYLE_NUMBERED
                ? 'number'
                : 'category-bubble',
            markerScale: getPrintMapPinScale(normalizedDesign.pins.size),
        },
        annotationLayer: {
            visible: normalizedDesign.layers.annotations !== PRINT_MAP_ANNOTATION_LAYER_HIDE,
            hiddenAnnotationIds: clone(normalizedDesign.layers.hiddenAnnotationIds),
        },
        resourceLayer: {
            visible: normalizedDesign.layers.resources !== PRINT_MAP_RESOURCE_LAYER_HIDE,
            hiddenResourceLayerKeys: clone(normalizedDesign.layers.hiddenResourceLayerKeys),
            interactiveSupport: 'supported',
        },
        labels: {
            detail: normalizedDesign.labels.detail,
        },
        layout: {
            mapHeight: normalizedDesign.layout.mapHeight,
            resourcePanel: normalizedDesign.layout.resourcePanel,
            resourcePanelSupport: 'supported',
        },
        supportedPaths: [...MAP_STUDIO_INTERACTIVE_SUPPORTED_PATHS],
        deferredPaths: [...MAP_STUDIO_INTERACTIVE_DEFERRED_PATHS],
    };
}
