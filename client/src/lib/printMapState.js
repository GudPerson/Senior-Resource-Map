import { normalizeCareAroundMapStyle } from './mapTheme.js';

export const PRINT_MAP_CANVAS_WIDTH_PX = 1480;
export const PRINT_MAP_DEFAULT_HEIGHT_PX = 360;
export const PRINT_MAP_MIN_HEIGHT_PX = 300;
export const PRINT_MAP_MAX_HEIGHT_PX = 720;
export const PRINT_MAP_HEIGHT_STEP_PX = 40;

export const PRINT_MAP_LAYOUT_BALANCED = 'balanced';
export const PRINT_MAP_LAYOUT_FOCUS = 'map-focus';
export const PRINT_MAP_SIDE_LEFT = 'left';
export const PRINT_MAP_SIDE_RIGHT = 'right';
export const PRINT_MAP_WIDTH_WIDE = 'wide';
export const PRINT_MAP_WIDTH_EXTRA_WIDE = 'extra-wide';
export const PRINT_MAP_LABEL_DETAIL_NAMES = 'names';
export const PRINT_MAP_LABEL_DETAIL_LOGOS = 'names-logos';
export const PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES = 'names-addresses';
export const PRINT_MAP_LABEL_DETAIL_FULL = 'full';

export function normalizePrintMapLayoutPreset(value) {
    return value === PRINT_MAP_LAYOUT_FOCUS ? PRINT_MAP_LAYOUT_FOCUS : PRINT_MAP_LAYOUT_BALANCED;
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
        PRINT_MAP_LABEL_DETAIL_FULL,
    ].includes(value)
        ? value
        : PRINT_MAP_LABEL_DETAIL_FULL;
}

export function getOwnerPrintLayoutConfig(state = {}) {
    const layoutPreset = normalizePrintMapLayoutPreset(state.layoutPreset);
    const mapWidth = normalizePrintMapWidth(state.mapWidth);
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
    return {
        layoutPreset,
        mapSide,
        mapWidth,
        mapMaxWidthPx: extraWide ? 1020 : 940,
        gridClassName: mapSide === PRINT_MAP_SIDE_RIGHT
            ? (extraWide
                ? 'grid-cols-[320px_minmax(0,1fr)_0px]'
                : 'grid-cols-[400px_minmax(0,1fr)_0px]')
            : (extraWide
                ? 'grid-cols-[0px_minmax(0,1fr)_320px]'
                : 'grid-cols-[0px_minmax(0,1fr)_400px]'),
    };
}

export function clampPrintMapHeight(value) {
    const height = Number(value);
    if (!Number.isFinite(height)) return PRINT_MAP_DEFAULT_HEIGHT_PX;
    return Math.round(Math.min(Math.max(height, PRINT_MAP_MIN_HEIGHT_PX), PRINT_MAP_MAX_HEIGHT_PX));
}

export function normalizePrintMapViewState(value) {
    const lat = Number(value?.center?.[0]);
    const lng = Number(value?.center?.[1]);
    const zoom = Number(value?.zoom);
    if (![lat, lng, zoom].every(Number.isFinite)) return null;
    return { center: [lat, lng], zoom };
}

export function createOwnerPrintMapState(mapStyle) {
    return {
        mapStyle: normalizeCareAroundMapStyle(mapStyle),
        basemapMode: 'live',
        view: null,
        height: PRINT_MAP_DEFAULT_HEIGHT_PX,
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        labelDetail: PRINT_MAP_LABEL_DETAIL_FULL,
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
        clampPrintMapHeight(state?.height),
        view ? view.center.map((value) => value.toFixed(7)).join(',') : 'fit',
        view ? view.zoom.toFixed(3) : 'fit',
        normalizePrintMapLayoutPreset(state?.layoutPreset),
        normalizePrintMapSide(state?.mapSide),
        normalizePrintMapWidth(state?.mapWidth),
        normalizePrintMapLabelDetail(state?.labelDetail),
        Number(state?.resetVersion || 0),
    ].join('|');
}
