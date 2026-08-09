import { normalizeCareAroundMapStyle } from './mapTheme.js';
import {
    PRINT_MAP_ANNOTATION_LAYER_SHOW,
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LAYOUT_BALANCED,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_LAYOUT_FULL,
    PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX,
    PRINT_MAP_DEFAULT_HEIGHT_PX,
    PRINT_MAP_MIN_HEIGHT_PX,
    PRINT_MAP_PAGE_LAYOUT_FULL,
    PRINT_MAP_PAGE_LAYOUT_STANDARD,
    PRINT_MAP_PIN_SIZE_STANDARD,
    PRINT_MAP_QUALITY_STANDARD,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
    PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
    PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
    PRINT_MAP_SIDE_LEFT,
    PRINT_MAP_WIDTH_WIDE,
    clampPrintMapHeight,
    createOwnerPrintMapState,
    normalizePrintMapAnnotationLayer,
    normalizePrintMapHiddenLayerKeys,
    normalizePrintMapLabelDetail,
    normalizePrintMapLayoutPreset,
    normalizePrintMapMargin,
    normalizePrintMapPinSize,
    normalizePrintMapQuality,
    normalizePrintMapResourceColumnCount,
    normalizePrintMapResourceLayer,
    normalizePrintMapSide,
    normalizePrintMapSideResourceColumnCount,
    normalizePrintMapViewState,
    normalizePrintMapWidth,
} from './printMapState.js';

export const MAP_STUDIO_SCHEMA_VERSION = 2;
export const MAP_STUDIO_DEFAULT_VIEW_ID = 'view-default';
export const MAP_STUDIO_DEFAULT_VIEW_NAME = 'Default view';
export const MAP_STUDIO_MAX_VIEWS = 50;
export const MAP_STUDIO_MAX_VIEW_NAME_LENGTH = 80;

export const MAP_STUDIO_MODE_EXPLORE = 'explore';
export const MAP_STUDIO_MODE_DESIGN = 'design';
export const MAP_STUDIO_MODE_EXPORT = 'export';

export const MAP_STUDIO_CAMERA_FIT = 'fit';
export const MAP_STUDIO_CAMERA_FIXED = 'fixed';
export const MAP_STUDIO_DETAIL_AUTO = 'auto';
export const MAP_STUDIO_DETAIL_LIVE = 'live';
export const MAP_STUDIO_PIN_STYLE_BUBBLE = 'category-bubble';
export const MAP_STUDIO_PIN_STYLE_NUMBERED = 'numbered';
export const MAP_STUDIO_PIN_STYLE_CATEGORY_ICON = 'category-icon';
export const MAP_STUDIO_MAP_HEIGHT_COMPACT = 'compact';
export const MAP_STUDIO_MAP_HEIGHT_STANDARD = 'standard';
export const MAP_STUDIO_MAP_HEIGHT_TALL = 'tall';
export const MAP_STUDIO_RESOURCE_PANEL_RESPONSIVE = 'responsive';
export const MAP_STUDIO_RESOURCE_PANEL_BELOW = 'below-map';
export const MAP_STUDIO_RESOURCE_PANEL_BESIDE = 'beside-map';
export const MAP_STUDIO_EXPORT_MARGIN_NARROW = 'narrow';
export const MAP_STUDIO_EXPORT_MARGIN_STANDARD = 'standard';
export const MAP_STUDIO_EXPORT_MARGIN_WIDE = 'wide';

const MAP_STUDIO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeRevision(value) {
    const revision = Number(value);
    return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function normalizeMode(value) {
    return [
        MAP_STUDIO_MODE_EXPLORE,
        MAP_STUDIO_MODE_DESIGN,
        MAP_STUDIO_MODE_EXPORT,
    ].includes(value)
        ? value
        : MAP_STUDIO_MODE_EXPLORE;
}

function normalizeDetailMode(value, fallback = MAP_STUDIO_DETAIL_AUTO) {
    if (value === MAP_STUDIO_DETAIL_LIVE) return MAP_STUDIO_DETAIL_LIVE;
    if (value === MAP_STUDIO_DETAIL_AUTO) return MAP_STUDIO_DETAIL_AUTO;
    return fallback === MAP_STUDIO_DETAIL_LIVE ? MAP_STUDIO_DETAIL_LIVE : MAP_STUDIO_DETAIL_AUTO;
}

function normalizePinStyle(value) {
    return [
        MAP_STUDIO_PIN_STYLE_NUMBERED,
        MAP_STUDIO_PIN_STYLE_CATEGORY_ICON,
    ].includes(value)
        ? value
        : MAP_STUDIO_PIN_STYLE_BUBBLE;
}

function normalizeMapHeight(value) {
    return [
        MAP_STUDIO_MAP_HEIGHT_COMPACT,
        MAP_STUDIO_MAP_HEIGHT_TALL,
    ].includes(value)
        ? value
        : MAP_STUDIO_MAP_HEIGHT_STANDARD;
}

function normalizeResourcePanel(value) {
    return [
        MAP_STUDIO_RESOURCE_PANEL_BELOW,
        MAP_STUDIO_RESOURCE_PANEL_BESIDE,
    ].includes(value)
        ? value
        : MAP_STUDIO_RESOURCE_PANEL_RESPONSIVE;
}

function normalizeExportMargin(value) {
    return [
        MAP_STUDIO_EXPORT_MARGIN_NARROW,
        MAP_STUDIO_EXPORT_MARGIN_WIDE,
    ].includes(value)
        ? value
        : MAP_STUDIO_EXPORT_MARGIN_STANDARD;
}

function normalizeViewId(value, fallback = '') {
    const id = String(value || '').trim();
    if (MAP_STUDIO_ID_PATTERN.test(id)) return id;
    if (fallback && MAP_STUDIO_ID_PATTERN.test(fallback)) return fallback;
    throw new TypeError('Map Studio view id must use 1-80 letters, numbers, colon, underscore, or hyphen characters.');
}

function normalizeViewName(value, fallback = MAP_STUDIO_DEFAULT_VIEW_NAME) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    return (name || fallback).slice(0, MAP_STUDIO_MAX_VIEW_NAME_LENGTH);
}

function normalizePlaceKey(value) {
    return String(value || '').trim().slice(0, 240);
}

function normalizePlaceKeys(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(normalizePlaceKey).filter(Boolean))].slice(0, 200);
}

function normalizeCameraView(value) {
    const candidate = normalizePrintMapViewState(value);
    return candidate
        && candidate.center[0] >= -90
        && candidate.center[0] <= 90
        && candidate.center[1] >= -180
        && candidate.center[1] <= 180
        && candidate.zoom >= 0
        && candidate.zoom <= 22
        ? candidate
        : null;
}

function normalizeCamera(value) {
    const view = normalizeCameraView(value?.view || value);
    const mode = value?.mode === MAP_STUDIO_CAMERA_FIXED && view
        ? MAP_STUDIO_CAMERA_FIXED
        : MAP_STUDIO_CAMERA_FIT;
    return {
        mode,
        view: mode === MAP_STUDIO_CAMERA_FIXED ? view : null,
    };
}

export function createMapStudioDesign({
    mapStyle = 'default',
    detailMode = MAP_STUDIO_DETAIL_AUTO,
} = {}) {
    return {
        basemap: {
            style: normalizeCareAroundMapStyle(mapStyle),
            detailMode: normalizeDetailMode(detailMode),
        },
        camera: {
            mode: MAP_STUDIO_CAMERA_FIT,
            view: null,
        },
        pins: {
            style: MAP_STUDIO_PIN_STYLE_BUBBLE,
            size: PRINT_MAP_PIN_SIZE_STANDARD,
        },
        labels: {
            detail: PRINT_MAP_LABEL_DETAIL_FULL,
        },
        layers: {
            resources: PRINT_MAP_RESOURCE_LAYER_SHOW,
            annotations: PRINT_MAP_ANNOTATION_LAYER_SHOW,
            hiddenResourceLayerKeys: [],
            hiddenAnnotationIds: [],
        },
        layout: {
            mapHeight: MAP_STUDIO_MAP_HEIGHT_STANDARD,
            preset: PRINT_MAP_LAYOUT_BALANCED,
            mapSide: PRINT_MAP_SIDE_LEFT,
            mapWidth: PRINT_MAP_WIDTH_WIDE,
            resourceColumnCount: 2,
            sideResourceColumnCount: 1,
        },
    };
}

export function normalizeMapStudioDesign(value, defaults = {}) {
    const baseline = createMapStudioDesign(defaults);
    return {
        basemap: {
            style: normalizeCareAroundMapStyle(value?.basemap?.style ?? baseline.basemap.style),
            detailMode: normalizeDetailMode(
                value?.basemap?.detailMode,
                baseline.basemap.detailMode,
            ),
        },
        camera: normalizeCamera(value?.camera),
        pins: {
            style: normalizePinStyle(value?.pins?.style),
            size: normalizePrintMapPinSize(value?.pins?.size),
        },
        labels: {
            detail: normalizePrintMapLabelDetail(value?.labels?.detail),
        },
        layers: {
            resources: normalizePrintMapResourceLayer(value?.layers?.resources),
            annotations: normalizePrintMapAnnotationLayer(value?.layers?.annotations),
            hiddenResourceLayerKeys: normalizePrintMapHiddenLayerKeys(
                value?.layers?.hiddenResourceLayerKeys,
            ),
            hiddenAnnotationIds: normalizePrintMapHiddenLayerKeys(
                value?.layers?.hiddenAnnotationIds,
            ),
        },
        layout: {
            mapHeight: normalizeMapHeight(value?.layout?.mapHeight),
            preset: normalizePrintMapLayoutPreset(value?.layout?.preset),
            mapSide: normalizePrintMapSide(value?.layout?.mapSide),
            mapWidth: normalizePrintMapWidth(value?.layout?.mapWidth),
            resourceColumnCount: normalizePrintMapResourceColumnCount(
                value?.layout?.resourceColumnCount,
            ),
            sideResourceColumnCount: normalizePrintMapSideResourceColumnCount(
                value?.layout?.sideResourceColumnCount,
            ),
        },
    };
}

function normalizeMapStudioView(value, defaults = {}) {
    return {
        id: normalizeViewId(value?.id),
        name: normalizeViewName(value?.name),
        revision: normalizeRevision(value?.revision),
        design: normalizeMapStudioDesign(value?.design, defaults),
    };
}

export function createMapStudioDocument({
    viewId = MAP_STUDIO_DEFAULT_VIEW_ID,
    viewName = MAP_STUDIO_DEFAULT_VIEW_NAME,
    mapStyle = 'default',
    detailMode = MAP_STUDIO_DETAIL_AUTO,
} = {}) {
    const id = normalizeViewId(viewId, MAP_STUDIO_DEFAULT_VIEW_ID);
    return {
        schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
        revision: 0,
        defaultViewId: id,
        views: [{
            id,
            name: normalizeViewName(viewName),
            revision: 0,
            design: createMapStudioDesign({ mapStyle, detailMode }),
        }],
    };
}

export function normalizeMapStudioDocument(value, defaults = {}) {
    const schemaVersion = Number(value?.schemaVersion);
    if (schemaVersion !== MAP_STUDIO_SCHEMA_VERSION) {
        throw new RangeError(`Unsupported Map Studio schema version: ${value?.schemaVersion ?? 'missing'}`);
    }

    const rawViews = Array.isArray(value?.views) ? value.views : [];
    if (!rawViews.length) {
        throw new RangeError('A Map Studio document must contain at least one view.');
    }
    if (rawViews.length > MAP_STUDIO_MAX_VIEWS) {
        throw new RangeError(`Map Studio supports at most ${MAP_STUDIO_MAX_VIEWS} views per map.`);
    }
    const seenIds = new Set();
    const views = rawViews.map((rawView) => {
        const view = normalizeMapStudioView(rawView, defaults);
        if (seenIds.has(view.id)) {
            throw new RangeError(`Duplicate Map Studio view id: ${view.id}`);
        }
        seenIds.add(view.id);
        return view;
    });

    const requestedDefaultViewId = String(value?.defaultViewId || '').trim();
    const defaultViewId = views.some((view) => view.id === requestedDefaultViewId)
        ? requestedDefaultViewId
        : views[0].id;

    return {
        schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
        revision: normalizeRevision(value?.revision),
        defaultViewId,
        views,
    };
}

export function migrateMapStudioDocument(value, defaults = {}) {
    if (value === null || value === undefined) {
        return createMapStudioDocument(defaults);
    }
    if (Number(value?.schemaVersion) === 1 && MAP_STUDIO_SCHEMA_VERSION === 2) {
        const migratedViews = (Array.isArray(value.views) ? value.views : []).map((view) => {
            const legacyResourcePanel = normalizeResourcePanel(view?.design?.layout?.resourcePanel);
            const preset = legacyResourcePanel === MAP_STUDIO_RESOURCE_PANEL_BELOW
                ? PRINT_MAP_LAYOUT_FULL
                : legacyResourcePanel === MAP_STUDIO_RESOURCE_PANEL_BESIDE
                    ? PRINT_MAP_LAYOUT_FOCUS
                    : PRINT_MAP_LAYOUT_BALANCED;
            return {
                ...view,
                design: {
                    ...(view?.design || {}),
                    layout: {
                        mapHeight: view?.design?.layout?.mapHeight,
                        preset,
                        mapSide: PRINT_MAP_SIDE_LEFT,
                        mapWidth: PRINT_MAP_WIDTH_WIDE,
                        resourceColumnCount: 2,
                        sideResourceColumnCount: 1,
                    },
                },
            };
        });
        return normalizeMapStudioDocument({
            ...value,
            schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
            views: migratedViews,
        }, defaults);
    }
    return normalizeMapStudioDocument(value, defaults);
}

function requireView(document, viewId) {
    const normalizedDocument = normalizeMapStudioDocument(document);
    const normalizedViewId = normalizeViewId(viewId);
    const view = normalizedDocument.views.find((candidate) => candidate.id === normalizedViewId);
    if (!view) throw new RangeError(`Map Studio view not found: ${normalizedViewId}`);
    return { document: normalizedDocument, view };
}

export function createMapStudioView(document, {
    id,
    name = 'Untitled view',
    sourceViewId,
} = {}) {
    const normalizedDocument = normalizeMapStudioDocument(document);
    if (normalizedDocument.views.length >= MAP_STUDIO_MAX_VIEWS) {
        throw new RangeError(`Map Studio supports at most ${MAP_STUDIO_MAX_VIEWS} views per map.`);
    }
    const viewId = normalizeViewId(id);
    if (normalizedDocument.views.some((view) => view.id === viewId)) {
        throw new RangeError(`Map Studio view already exists: ${viewId}`);
    }
    const sourceView = sourceViewId
        ? requireView(normalizedDocument, sourceViewId).view
        : normalizedDocument.views.find((view) => view.id === normalizedDocument.defaultViewId);
    const nextView = {
        id: viewId,
        name: normalizeViewName(name, 'Untitled view'),
        revision: 0,
        design: clone(sourceView?.design || createMapStudioDesign()),
    };
    return {
        ...normalizedDocument,
        revision: normalizedDocument.revision + 1,
        views: [...normalizedDocument.views, nextView],
    };
}

export function duplicateMapStudioView(document, sourceViewId, {
    id,
    name,
} = {}) {
    const { document: normalizedDocument, view: sourceView } = requireView(document, sourceViewId);
    return createMapStudioView(normalizedDocument, {
        id,
        name: name || `${sourceView.name} copy`,
        sourceViewId: sourceView.id,
    });
}

export function renameMapStudioView(document, viewId, name) {
    const { document: normalizedDocument, view } = requireView(document, viewId);
    const nextName = normalizeViewName(name, view.name);
    if (nextName === view.name) return normalizedDocument;
    return {
        ...normalizedDocument,
        revision: normalizedDocument.revision + 1,
        views: normalizedDocument.views.map((candidate) => (
            candidate.id === view.id
                ? { ...candidate, name: nextName, revision: candidate.revision + 1 }
                : candidate
        )),
    };
}

export function setDefaultMapStudioView(document, viewId) {
    const { document: normalizedDocument, view } = requireView(document, viewId);
    if (normalizedDocument.defaultViewId === view.id) return normalizedDocument;
    return {
        ...normalizedDocument,
        revision: normalizedDocument.revision + 1,
        defaultViewId: view.id,
    };
}

export function deleteMapStudioView(document, viewId) {
    const { document: normalizedDocument, view } = requireView(document, viewId);
    if (normalizedDocument.views.length === 1) {
        throw new RangeError('A My Map must retain at least one Map Studio view.');
    }
    const views = normalizedDocument.views.filter((candidate) => candidate.id !== view.id);
    return {
        ...normalizedDocument,
        revision: normalizedDocument.revision + 1,
        defaultViewId: normalizedDocument.defaultViewId === view.id
            ? views[0].id
            : normalizedDocument.defaultViewId,
        views,
    };
}

export function createMapStudioExplorationState(value = {}) {
    return {
        query: String(value?.query || '').slice(0, 240),
        hoveredPlaceKey: normalizePlaceKey(value?.hoveredPlaceKey) || null,
        focusedPlaceKeys: normalizePlaceKeys(value?.focusedPlaceKeys),
        selectedPlaceKeys: normalizePlaceKeys(value?.selectedPlaceKeys),
        cameraView: normalizeCameraView(value?.cameraView),
    };
}

export function createMapStudioSession(document, {
    activeViewId,
    mode = MAP_STUDIO_MODE_EXPLORE,
    exploration,
} = {}) {
    const normalizedDocument = normalizeMapStudioDocument(document);
    const requestedViewId = String(activeViewId || normalizedDocument.defaultViewId).trim();
    const activeView = normalizedDocument.views.find((view) => view.id === requestedViewId)
        || normalizedDocument.views.find((view) => view.id === normalizedDocument.defaultViewId)
        || normalizedDocument.views[0];
    return {
        schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
        mode: normalizeMode(mode),
        activeViewId: activeView.id,
        baseViewRevision: activeView.revision,
        savedDesign: clone(activeView.design),
        draftDesign: clone(activeView.design),
        dirty: false,
        exploration: createMapStudioExplorationState(exploration),
    };
}

export function selectMapStudioView(document, session, viewId, {
    discardDraft = false,
} = {}) {
    if (session?.dirty && !discardDraft) {
        throw new Error('Save or discard the current Map Studio draft before switching views.');
    }
    const { document: normalizedDocument, view } = requireView(document, viewId);
    return createMapStudioSession(normalizedDocument, {
        activeViewId: view.id,
        mode: session?.mode,
    });
}

export function setMapStudioMode(session, mode) {
    return {
        ...clone(session),
        mode: normalizeMode(mode),
    };
}

export function patchMapStudioDraft(session, patch = {}) {
    const currentDesign = normalizeMapStudioDesign(session?.draftDesign);
    const savedDesign = normalizeMapStudioDesign(session?.savedDesign);
    const draftDesign = normalizeMapStudioDesign({
        ...currentDesign,
        ...patch,
        basemap: { ...currentDesign.basemap, ...patch.basemap },
        camera: { ...currentDesign.camera, ...patch.camera },
        pins: { ...currentDesign.pins, ...patch.pins },
        labels: { ...currentDesign.labels, ...patch.labels },
        layers: { ...currentDesign.layers, ...patch.layers },
        layout: { ...currentDesign.layout, ...patch.layout },
    });
    return {
        ...clone(session),
        draftDesign,
        dirty: JSON.stringify(draftDesign) !== JSON.stringify(savedDesign),
    };
}

export function patchMapStudioExploration(session, patch = {}) {
    return {
        ...clone(session),
        exploration: createMapStudioExplorationState({
            ...session?.exploration,
            ...patch,
        }),
    };
}

export function saveMapStudioView(document, session) {
    const { document: normalizedDocument, view } = requireView(document, session?.activeViewId);
    if (view.revision !== normalizeRevision(session?.baseViewRevision)) {
        throw new Error('Map Studio view changed after this editing session started. Reload before saving.');
    }
    const design = normalizeMapStudioDesign(session?.draftDesign);
    const changed = JSON.stringify(design) !== JSON.stringify(view.design);
    if (!changed) {
        return {
            document: normalizedDocument,
            session: createMapStudioSession(normalizedDocument, {
                activeViewId: view.id,
                mode: session?.mode,
                exploration: session?.exploration,
            }),
        };
    }

    const nextDocument = {
        ...normalizedDocument,
        revision: normalizedDocument.revision + 1,
        views: normalizedDocument.views.map((candidate) => (
            candidate.id === view.id
                ? { ...candidate, revision: candidate.revision + 1, design }
                : candidate
        )),
    };
    return {
        document: nextDocument,
        session: createMapStudioSession(nextDocument, {
            activeViewId: view.id,
            mode: session?.mode,
            exploration: session?.exploration,
        }),
    };
}

export function createMapStudioExportSettings(value = {}) {
    return {
        schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
        imageQuality: normalizePrintMapQuality(value?.imageQuality ?? PRINT_MAP_QUALITY_STANDARD),
        margins: normalizePrintMapMargin(normalizeExportMargin(value?.margins)),
    };
}

export function buildMapStudioPrintState(design, exportSettings = {}) {
    const normalizedDesign = normalizeMapStudioDesign(design);
    const normalizedExport = createMapStudioExportSettings(exportSettings);
    const usesFullMapLayout = normalizedDesign.layout.preset === PRINT_MAP_LAYOUT_FULL;
    const pageLayout = usesFullMapLayout
        ? PRINT_MAP_PAGE_LAYOUT_FULL
        : PRINT_MAP_PAGE_LAYOUT_STANDARD;
    const resourcePlacement = usesFullMapLayout
        ? PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE
        : PRINT_MAP_RESOURCE_PLACEMENT_BESIDE;
    const designHeight = normalizedDesign.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_COMPACT
        ? PRINT_MAP_MIN_HEIGHT_PX
        : normalizedDesign.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_TALL
            ? 560
            : PRINT_MAP_DEFAULT_HEIGHT_PX;
    const height = clampPrintMapHeight(
        usesFullMapLayout
            ? PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX
            : designHeight,
        { pageLayout, layoutPreset: normalizedDesign.layout.preset },
    );
    return {
        ...createOwnerPrintMapState(normalizedDesign.basemap.style, {
            basemapMode: normalizedDesign.basemap.detailMode,
        }),
        mapStyle: normalizedDesign.basemap.style,
        basemapMode: normalizedDesign.basemap.detailMode,
        view: normalizedDesign.camera.mode === MAP_STUDIO_CAMERA_FIXED
            ? clone(normalizedDesign.camera.view)
            : null,
        height,
        pageLayout,
        resourcePlacement,
        mapQuality: normalizedExport.imageQuality,
        margins: normalizedExport.margins,
        resourceLayer: normalizedDesign.layers.resources,
        pinSize: normalizedDesign.pins.size,
        studioMarkerMode: normalizedDesign.pins.style === MAP_STUDIO_PIN_STYLE_NUMBERED
            ? 'print-badge'
            : normalizedDesign.pins.style === MAP_STUDIO_PIN_STYLE_CATEGORY_ICON
                ? 'category-icon'
                : 'category-bubble',
        annotationLayer: normalizedDesign.layers.annotations,
        hiddenResourceLayerKeys: clone(normalizedDesign.layers.hiddenResourceLayerKeys),
        hiddenAnnotationIds: clone(normalizedDesign.layers.hiddenAnnotationIds),
        layoutPreset: normalizedDesign.layout.preset,
        mapSide: normalizedDesign.layout.mapSide,
        mapWidth: normalizedDesign.layout.mapWidth,
        labelDetail: normalizedDesign.labels.detail,
        resourceColumnCount: normalizedDesign.layout.resourceColumnCount,
        sideResourceColumnCount: normalizedDesign.layout.sideResourceColumnCount,
    };
}

export function isMapStudioViewDirty(document, session) {
    try {
        const { view } = requireView(document, session?.activeViewId);
        return JSON.stringify(view.design) !== JSON.stringify(
            normalizeMapStudioDesign(session?.draftDesign),
        );
    } catch {
        return true;
    }
}
