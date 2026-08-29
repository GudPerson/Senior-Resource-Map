import {
    MAP_STUDIO_CAMERA_FIXED,
    MAP_STUDIO_PIN_STYLE_CATEGORY_ICON,
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    normalizeMapStudioDesign,
} from './mapStudioState.js';
import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_LAYOUT_FULL,
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
    'pins.categoryShapes',
    'pins.categoryStyles',
    'labels.detail',
    'layers.resources',
    'layers.hiddenResourceLayerKeys',
    'layers.annotations',
    'layers.hiddenAnnotationIds',
    'layout.mapHeight',
    'layout.preset',
    'layout.mapSide',
    'layout.mapWidth',
    'layout.resourceColumnCount',
    'layout.sideResourceColumnCount',
    'layout.resourceDisplay',
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
    const pinStyle = normalizedDesign.pins.style;
    const isNumbered = pinStyle === MAP_STUDIO_PIN_STYLE_NUMBERED;
    const isCategoryIcon = pinStyle === MAP_STUDIO_PIN_STYLE_CATEGORY_ICON;
    const layoutPreset = normalizedDesign.layout.preset;

    return {
        directoryMap: {
            mapStyleOverride: normalizedDesign.basemap.style,
            basemapMode: normalizedDesign.basemap.detailMode,
            mapViewState: normalizedDesign.camera.mode === MAP_STUDIO_CAMERA_FIXED
                ? clone(normalizedDesign.camera.view)
                : null,
            markerMode: isNumbered
                ? 'print-badge'
                : isCategoryIcon
                    ? 'category-icon'
                    : 'category-bubble',
            markerScale: getPrintMapPinScale(normalizedDesign.pins.size),
            numberedPinShapesByCategory: clone(normalizedDesign.pins.categoryShapes),
            numberedPinStylesByCategory: clone(normalizedDesign.pins.categoryStyles),
            pinBadgeMode: 'none',
            pinCategoryIconMode: isCategoryIcon ? 'auto' : 'none',
            // Studio pin styles are all individual-marker presentations. The
            // numbered renderer reuses DirectoryMap's bubble collision solver,
            // while category icons keep the overlap-capable Discovery behavior.
            // Aggregate count clusters would replace the selected marker/card
            // identity and are therefore intentionally disabled here.
            clusterMarkerMode: 'none',
        },
        cardIdentity: {
            // Numbered Studio pins keep the approved Print View card language:
            // the resource logo remains the card identity while the matching
            // category-coloured number is rendered independently at the edge
            // nearest the map.
            mode: isCategoryIcon ? 'category-icon' : 'logo',
            showNumberBadge: isNumbered,
            numberedPinShapesByCategory: clone(normalizedDesign.pins.categoryShapes),
            numberedPinStylesByCategory: clone(normalizedDesign.pins.categoryStyles),
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
            preset: layoutPreset,
            resourcePanel: layoutPreset === PRINT_MAP_LAYOUT_FULL
                ? 'below-map'
                : layoutPreset === PRINT_MAP_LAYOUT_FOCUS
                    ? 'beside-map'
                    : 'responsive',
            mapSide: normalizedDesign.layout.mapSide,
            mapWidth: normalizedDesign.layout.mapWidth,
            resourceColumnCount: normalizedDesign.layout.resourceColumnCount,
            sideResourceColumnCount: normalizedDesign.layout.sideResourceColumnCount,
            resourceDisplay: normalizedDesign.layout.resourceDisplay,
            resourcePanelSupport: 'supported',
        },
        supportedPaths: [...MAP_STUDIO_INTERACTIVE_SUPPORTED_PATHS],
        deferredPaths: [...MAP_STUDIO_INTERACTIVE_DEFERRED_PATHS],
    };
}
