import { normalizeCareAroundMapStyle } from './mapTheme.js';

export const PRINT_MAP_CANVAS_WIDTH_PX = 1480;
export const PRINT_MAP_DEFAULT_HEIGHT_PX = 360;
export const PRINT_MAP_MIN_HEIGHT_PX = 300;
export const PRINT_MAP_MAX_HEIGHT_PX = 720;
export const PRINT_MAP_HEIGHT_STEP_PX = 40;

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
        Number(state?.resetVersion || 0),
    ].join('|');
}
