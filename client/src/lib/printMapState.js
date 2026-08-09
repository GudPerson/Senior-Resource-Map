import { normalizeCareAroundMapStyle } from './mapTheme.js';

export const PRINT_MAP_CANVAS_WIDTH_PX = 1480;
export const PRINT_MAP_PREVIEW_GUTTER_PX = 16;
export const PRINT_MAP_PREVIEW_MIN_SCALE = 0.2;
export const PRINT_MAP_DEFAULT_HEIGHT_PX = 360;
export const PRINT_MAP_MIN_HEIGHT_PX = 300;
export const PRINT_MAP_MAX_HEIGHT_PX = 720;
export const PRINT_MAP_HEIGHT_STEP_PX = 40;
export const PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX = 900;
export const PRINT_MAP_FULL_PAGE_MIN_HEIGHT_PX = 720;
export const PRINT_MAP_FULL_PAGE_MAX_HEIGHT_PX = 1440;

export const PRINT_MAP_PAGE_LAYOUT_STANDARD = 'standard';
export const PRINT_MAP_PAGE_LAYOUT_FULL = 'full-map-page';
export const PRINT_MAP_RESOURCE_PLACEMENT_BESIDE = 'beside';
export const PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE = 'next-page';
export const PRINT_MAP_QUALITY_STANDARD = 'standard';
export const PRINT_MAP_QUALITY_HIGH = 'high';
export const PRINT_MAP_MARGIN_NARROW = 'narrow';
export const PRINT_MAP_MARGIN_STANDARD = 'standard';
export const PRINT_MAP_MARGIN_WIDE = 'wide';
export const PRINT_MAP_RESOURCE_LAYER_SHOW = 'show';
export const PRINT_MAP_RESOURCE_LAYER_HIDE = 'hide';
export const PRINT_MAP_PIN_SIZE_STANDARD = 'standard';
export const PRINT_MAP_PIN_SIZE_LARGE = 'large';
export const PRINT_MAP_PIN_SIZE_EXTRA_LARGE = 'extra-large';
export const PRINT_MAP_ANNOTATION_LAYER_SHOW = 'show';
export const PRINT_MAP_ANNOTATION_LAYER_HIDE = 'hide';
export const PRINT_MAP_MAX_HIDDEN_LAYER_KEYS = 200;

export const PRINT_MAP_EXPORT_PIXEL_RATIO = 2;
export const PRINT_MAP_EXPORT_CANVAS_SCALE_STANDARD = 2;
export const PRINT_MAP_EXPORT_CANVAS_SCALE_HIGH = 2.5;
export const PRINT_MAP_EXPORT_MAX_DIMENSION_PX = 16384;
export const PRINT_MAP_EXPORT_MAX_PIXELS = 100_000_000;

export const PRINT_MAP_LAYOUT_BALANCED = 'balanced';
export const PRINT_MAP_LAYOUT_FOCUS = 'map-focus';
export const PRINT_MAP_LAYOUT_FULL = 'full-map';
export const PRINT_MAP_SIDE_LEFT = 'left';
export const PRINT_MAP_SIDE_RIGHT = 'right';
export const PRINT_MAP_WIDTH_WIDE = 'wide';
export const PRINT_MAP_WIDTH_EXTRA_WIDE = 'extra-wide';
export const PRINT_MAP_LABEL_DETAIL_NAMES = 'names';
export const PRINT_MAP_LABEL_DETAIL_LOGOS = 'names-logos';
export const PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES = 'names-addresses';
export const PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS = 'names-descriptions';
export const PRINT_MAP_LABEL_DETAIL_FULL = 'full';
export const PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT = 2;
export const PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT = 1;

export function normalizePrintMapPageLayout(value) {
    return value === PRINT_MAP_PAGE_LAYOUT_FULL
        ? PRINT_MAP_PAGE_LAYOUT_FULL
        : PRINT_MAP_PAGE_LAYOUT_STANDARD;
}

export function normalizePrintMapResourcePlacement(value) {
    return value === PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE
        ? PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE
        : PRINT_MAP_RESOURCE_PLACEMENT_BESIDE;
}

export function shouldExportPrintMapAsSeparatePages(state = {}) {
    return normalizePrintMapLayoutPreset(state.layoutPreset) === PRINT_MAP_LAYOUT_FULL
        || (
            normalizePrintMapPageLayout(state.pageLayout) === PRINT_MAP_PAGE_LAYOUT_FULL
            && normalizePrintMapResourcePlacement(state.resourcePlacement) === PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE
        );
}

export function normalizePrintMapQuality(value) {
    return value === PRINT_MAP_QUALITY_HIGH ? PRINT_MAP_QUALITY_HIGH : PRINT_MAP_QUALITY_STANDARD;
}

export function normalizePrintMapMargin(value) {
    if (value === PRINT_MAP_MARGIN_NARROW) return PRINT_MAP_MARGIN_NARROW;
    if (value === PRINT_MAP_MARGIN_WIDE) return PRINT_MAP_MARGIN_WIDE;
    return PRINT_MAP_MARGIN_STANDARD;
}

export function normalizePrintMapResourceLayer(value) {
    return value === PRINT_MAP_RESOURCE_LAYER_HIDE
        ? PRINT_MAP_RESOURCE_LAYER_HIDE
        : PRINT_MAP_RESOURCE_LAYER_SHOW;
}

export function normalizePrintMapPinSize(value) {
    return [
        PRINT_MAP_PIN_SIZE_LARGE,
        PRINT_MAP_PIN_SIZE_EXTRA_LARGE,
    ].includes(value)
        ? value
        : PRINT_MAP_PIN_SIZE_STANDARD;
}

export function getPrintMapPinScale(value) {
    const pinSize = normalizePrintMapPinSize(value);
    if (pinSize === PRINT_MAP_PIN_SIZE_EXTRA_LARGE) return 1.5;
    if (pinSize === PRINT_MAP_PIN_SIZE_LARGE) return 1.25;
    return 1;
}

export function normalizePrintMapAnnotationLayer(value) {
    return value === PRINT_MAP_ANNOTATION_LAYER_HIDE
        ? PRINT_MAP_ANNOTATION_LAYER_HIDE
        : PRINT_MAP_ANNOTATION_LAYER_SHOW;
}

export function normalizePrintMapHiddenLayerKeys(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
        .map((item) => String(item || '').trim())
        .filter(Boolean))]
        .sort((left, right) => left.localeCompare(right))
        .slice(0, PRINT_MAP_MAX_HIDDEN_LAYER_KEYS);
}

export function getPrintMapPreviewScale(containerWidth) {
    const width = Number(containerWidth);
    if (!Number.isFinite(width) || width <= 0) return 1;

    const availableWidth = Math.max(1, width - (PRINT_MAP_PREVIEW_GUTTER_PX * 2));
    return Math.max(PRINT_MAP_PREVIEW_MIN_SCALE, availableWidth / PRINT_MAP_CANVAS_WIDTH_PX);
}

export function normalizePrintMapLayoutPreset(value) {
    return [
        PRINT_MAP_LAYOUT_BALANCED,
        PRINT_MAP_LAYOUT_FOCUS,
        PRINT_MAP_LAYOUT_FULL,
    ].includes(value)
        ? value
        : PRINT_MAP_LAYOUT_BALANCED;
}

export function normalizePrintMapSide(value) {
    return value === PRINT_MAP_SIDE_RIGHT ? PRINT_MAP_SIDE_RIGHT : PRINT_MAP_SIDE_LEFT;
}

export function normalizePrintMapWidth(value) {
    return value === PRINT_MAP_WIDTH_EXTRA_WIDE ? PRINT_MAP_WIDTH_EXTRA_WIDE : PRINT_MAP_WIDTH_WIDE;
}

export function normalizePrintMapLabelDetail(value) {
    return [
        PRINT_MAP_LABEL_DETAIL_NAMES,
        PRINT_MAP_LABEL_DETAIL_LOGOS,
        PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
        PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
        PRINT_MAP_LABEL_DETAIL_FULL,
    ].includes(value)
        ? value
        : PRINT_MAP_LABEL_DETAIL_FULL;
}

export function normalizePrintMapResourceColumnCount(value) {
    const count = Number(value);
    return [2, 3, 4, 5, 6].includes(count)
        ? count
        : PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT;
}

export function normalizePrintMapSideResourceColumnCount(value) {
    const count = Number(value);
    return [1, 2].includes(count)
        ? count
        : PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT;
}

function getPrintResourceCategoryRunKey(group) {
    const categoryKey = String(group?.categorySortKey || group?.categoryLabel || '')
        .trim()
        .toLowerCase();
    if (!categoryKey) return '';
    return `${group?.isUnmappedGroup ? 'unmapped' : 'mapped'}:${categoryKey}`;
}

function splitPrintResourceGroupsByCount(groups, columnCount) {
    const columns = Array.from({ length: columnCount }, () => []);
    const weightedGroups = (groups || []).map((group) => ({
        group,
        weight: Math.max(1, (group?.rows || []).length) + 1,
        categoryRunKey: getPrintResourceCategoryRunKey(group),
    }));
    if (!weightedGroups.length) return columns;

    const activeColumnCount = Math.min(columnCount, weightedGroups.length);
    const totalWeight = weightedGroups.reduce((total, item) => total + item.weight, 0);
    const targetWeight = totalWeight / activeColumnCount;
    const categorySplitPenalty = targetWeight * targetWeight * 2;
    const prefixWeights = [0];
    weightedGroups.forEach((item) => {
        prefixWeights.push(prefixWeights[prefixWeights.length - 1] + item.weight);
    });

    const costs = Array.from(
        { length: activeColumnCount + 1 },
        () => Array(weightedGroups.length + 1).fill(Number.POSITIVE_INFINITY),
    );
    const previousBoundaries = Array.from(
        { length: activeColumnCount + 1 },
        () => Array(weightedGroups.length + 1).fill(-1),
    );
    costs[0][0] = 0;

    for (let usedColumns = 1; usedColumns <= activeColumnCount; usedColumns += 1) {
        const minEnd = usedColumns;
        const maxEnd = weightedGroups.length - (activeColumnCount - usedColumns);
        for (let end = minEnd; end <= maxEnd; end += 1) {
            for (let start = usedColumns - 1; start < end; start += 1) {
                const previousCost = costs[usedColumns - 1][start];
                if (!Number.isFinite(previousCost)) continue;

                const segmentWeight = prefixWeights[end] - prefixWeights[start];
                const deviation = segmentWeight - targetWeight;
                const splitsCategory = start > 0
                    && Boolean(weightedGroups[start].categoryRunKey)
                    && weightedGroups[start].categoryRunKey === weightedGroups[start - 1].categoryRunKey;
                const candidateCost = previousCost
                    + (deviation * deviation)
                    + (splitsCategory ? categorySplitPenalty : 0);

                if (candidateCost < costs[usedColumns][end]) {
                    costs[usedColumns][end] = candidateCost;
                    previousBoundaries[usedColumns][end] = start;
                }
            }
        }
    }

    const boundaries = [weightedGroups.length];
    let end = weightedGroups.length;
    for (let usedColumns = activeColumnCount; usedColumns > 0; usedColumns -= 1) {
        const start = previousBoundaries[usedColumns][end];
        boundaries.push(start);
        end = start;
    }
    boundaries.reverse();

    for (let columnIndex = 0; columnIndex < activeColumnCount; columnIndex += 1) {
        columns[columnIndex] = weightedGroups
            .slice(boundaries[columnIndex], boundaries[columnIndex + 1])
            .map((item) => item.group);
    }

    return columns;
}

export function splitPrintResourceGroups(groups = [], requestedColumnCount = PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT) {
    return splitPrintResourceGroupsByCount(
        groups,
        normalizePrintMapResourceColumnCount(requestedColumnCount),
    );
}

export function splitPrintSideResourceGroups(
    groups = [],
    requestedColumnCount = PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT,
) {
    return splitPrintResourceGroupsByCount(
        groups,
        normalizePrintMapSideResourceColumnCount(requestedColumnCount),
    );
}

export function getOwnerPrintLayoutConfig(state = {}) {
    const pageLayout = normalizePrintMapPageLayout(state.pageLayout);
    const resourcePlacement = normalizePrintMapResourcePlacement(state.resourcePlacement);
    const layoutPreset = normalizePrintMapLayoutPreset(state.layoutPreset);
    const mapWidth = normalizePrintMapWidth(state.mapWidth);
    if (
        layoutPreset === PRINT_MAP_LAYOUT_FULL
        || (
            pageLayout === PRINT_MAP_PAGE_LAYOUT_FULL
            && resourcePlacement === PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE
        )
    ) {
        return {
            layoutPreset: PRINT_MAP_LAYOUT_FULL,
            mapSide: 'center',
            mapWidth,
            mapMaxWidthPx: 1400,
            gridClassName: 'grid-cols-[0px_minmax(0,1fr)_0px]',
            resourcesBelow: true,
        };
    }

    if (layoutPreset === PRINT_MAP_LAYOUT_BALANCED) {
        const extraWide = mapWidth === PRINT_MAP_WIDTH_EXTRA_WIDE;
        return {
            layoutPreset,
            mapSide: 'center',
            mapWidth,
            mapMaxWidthPx: extraWide ? 760 : 680,
            gridClassName: extraWide
                ? 'grid-cols-[300px_minmax(0,1fr)_300px]'
                : 'grid-cols-[340px_minmax(0,1fr)_340px]',
        };
    }

    const mapSide = normalizePrintMapSide(state.mapSide);
    const extraWide = mapWidth === PRINT_MAP_WIDTH_EXTRA_WIDE;
    const sideResourceColumnCount = normalizePrintMapSideResourceColumnCount(
        state.sideResourceColumnCount,
    );
    const twoResourceColumns = sideResourceColumnCount === 2;
    return {
        layoutPreset,
        mapSide,
        mapWidth,
        mapMaxWidthPx: twoResourceColumns
            ? (extraWide ? 800 : 740)
            : (extraWide ? 1020 : 940),
        gridClassName: mapSide === PRINT_MAP_SIDE_RIGHT
            ? (twoResourceColumns
                ? (extraWide
                    ? 'grid-cols-[560px_minmax(0,1fr)_0px]'
                    : 'grid-cols-[620px_minmax(0,1fr)_0px]')
                : (extraWide
                    ? 'grid-cols-[320px_minmax(0,1fr)_0px]'
                    : 'grid-cols-[400px_minmax(0,1fr)_0px]'))
            : (twoResourceColumns
                ? (extraWide
                    ? 'grid-cols-[0px_minmax(0,1fr)_560px]'
                    : 'grid-cols-[0px_minmax(0,1fr)_620px]')
                : (extraWide
                    ? 'grid-cols-[0px_minmax(0,1fr)_320px]'
                    : 'grid-cols-[0px_minmax(0,1fr)_400px]')),
    };
}

export function getPrintMapHeightBounds(state = {}) {
    if (
        normalizePrintMapLayoutPreset(state.layoutPreset) === PRINT_MAP_LAYOUT_FULL
        || normalizePrintMapPageLayout(state.pageLayout) === PRINT_MAP_PAGE_LAYOUT_FULL
    ) {
        return {
            defaultHeight: PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX,
            minHeight: PRINT_MAP_FULL_PAGE_MIN_HEIGHT_PX,
            maxHeight: PRINT_MAP_FULL_PAGE_MAX_HEIGHT_PX,
        };
    }
    return {
        defaultHeight: PRINT_MAP_DEFAULT_HEIGHT_PX,
        minHeight: PRINT_MAP_MIN_HEIGHT_PX,
        maxHeight: PRINT_MAP_MAX_HEIGHT_PX,
    };
}

export function clampPrintMapHeight(value, state = {}) {
    const { defaultHeight, minHeight, maxHeight } = getPrintMapHeightBounds(state);
    const height = Number(value);
    if (!Number.isFinite(height)) return defaultHeight;
    return Math.round(Math.min(Math.max(height, minHeight), maxHeight));
}

export function getPrintMapExportConfig(state = {}, dimensions = {}) {
    const width = Math.max(1, Number(dimensions.width) || PRINT_MAP_CANVAS_WIDTH_PX);
    const height = Math.max(1, Number(dimensions.height) || PRINT_MAP_DEFAULT_HEIGHT_PX);
    const requestedCanvasScale = normalizePrintMapQuality(state.mapQuality) === PRINT_MAP_QUALITY_HIGH
        ? PRINT_MAP_EXPORT_CANVAS_SCALE_HIGH
        : PRINT_MAP_EXPORT_CANVAS_SCALE_STANDARD;
    const requestedOutputScale = requestedCanvasScale * PRINT_MAP_EXPORT_PIXEL_RATIO;
    const maxOutputScaleByDimension = PRINT_MAP_EXPORT_MAX_DIMENSION_PX / Math.max(width, height);
    const maxOutputScaleByPixels = Math.sqrt(PRINT_MAP_EXPORT_MAX_PIXELS / (width * height));
    const outputScale = Math.max(
        1,
        Math.min(requestedOutputScale, maxOutputScaleByDimension, maxOutputScaleByPixels),
    );

    return {
        pixelRatio: PRINT_MAP_EXPORT_PIXEL_RATIO,
        canvasScale: outputScale / PRINT_MAP_EXPORT_PIXEL_RATIO,
        outputScale,
        isCapped: outputScale < requestedOutputScale,
    };
}

export function normalizePrintMapViewState(value) {
    const lat = Number(value?.center?.[0]);
    const lng = Number(value?.center?.[1]);
    const zoom = Number(value?.zoom);
    if (![lat, lng, zoom].every(Number.isFinite)) return null;
    return { center: [lat, lng], zoom };
}

export function createOwnerPrintMapState(mapStyle, {
    basemapMode = 'live',
} = {}) {
    return {
        mapStyle: normalizeCareAroundMapStyle(mapStyle),
        basemapMode: basemapMode === 'auto' ? 'auto' : 'live',
        view: null,
        height: PRINT_MAP_DEFAULT_HEIGHT_PX,
        pageLayout: PRINT_MAP_PAGE_LAYOUT_STANDARD,
        resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
        mapQuality: PRINT_MAP_QUALITY_STANDARD,
        margins: PRINT_MAP_MARGIN_STANDARD,
        resourceLayer: PRINT_MAP_RESOURCE_LAYER_SHOW,
        pinSize: PRINT_MAP_PIN_SIZE_STANDARD,
        annotationLayer: PRINT_MAP_ANNOTATION_LAYER_SHOW,
        hiddenResourceLayerKeys: [],
        hiddenAnnotationIds: [],
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        labelDetail: PRINT_MAP_LABEL_DETAIL_FULL,
        resourceColumnCount: PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT,
        sideResourceColumnCount: PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT,
        resetVersion: 0,
    };
}

export function resetOwnerPrintMapState(current, mapStyle) {
    return {
        ...createOwnerPrintMapState(mapStyle),
        resetVersion: Number(current?.resetVersion || 0) + 1,
    };
}

export function buildPrintMapCaptureKey(state) {
    const view = normalizePrintMapViewState(state?.view);
    return [
        normalizeCareAroundMapStyle(state?.mapStyle),
        state?.basemapMode === 'auto' ? 'auto' : 'live',
        clampPrintMapHeight(state?.height, state),
        view ? view.center.map((value) => value.toFixed(7)).join(',') : 'fit',
        view ? view.zoom.toFixed(3) : 'fit',
        normalizePrintMapPageLayout(state?.pageLayout),
        normalizePrintMapResourcePlacement(state?.resourcePlacement),
        normalizePrintMapQuality(state?.mapQuality),
        normalizePrintMapMargin(state?.margins),
        normalizePrintMapResourceLayer(state?.resourceLayer),
        normalizePrintMapPinSize(state?.pinSize),
        ['category-bubble', 'number'].includes(state?.studioMarkerMode)
            ? state.studioMarkerMode
            : 'legacy-print-badge',
        normalizePrintMapAnnotationLayer(state?.annotationLayer),
        JSON.stringify(normalizePrintMapHiddenLayerKeys(state?.hiddenResourceLayerKeys)),
        JSON.stringify(normalizePrintMapHiddenLayerKeys(state?.hiddenAnnotationIds)),
        normalizePrintMapLayoutPreset(state?.layoutPreset),
        normalizePrintMapSide(state?.mapSide),
        normalizePrintMapWidth(state?.mapWidth),
        normalizePrintMapLabelDetail(state?.labelDetail),
        normalizePrintMapResourceColumnCount(state?.resourceColumnCount),
        normalizePrintMapSideResourceColumnCount(state?.sideResourceColumnCount),
        Number(state?.resetVersion || 0),
    ].join('|');
}
