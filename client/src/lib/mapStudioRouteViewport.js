import { normalizePrintMapViewState } from './printMapState.js';

function normalizeContext(value = {}) {
    const mapId = String(value.mapId || '').trim();
    const viewId = String(value.viewId || '').trim();
    if (!mapId || !viewId) return null;
    return {
        mapId,
        viewId,
        heightPreset: String(value.heightPreset || 'standard').trim() || 'standard',
    };
}

function normalizeHeight(value) {
    const height = Number(value);
    return Number.isFinite(height) && height > 0 ? Math.round(height) : null;
}

function normalizeCameraView(value) {
    const cameraView = normalizePrintMapViewState(value);
    return cameraView
        && cameraView.center[0] >= -90
        && cameraView.center[0] <= 90
        && cameraView.center[1] >= -180
        && cameraView.center[1] <= 180
        && cameraView.zoom >= 0
        && cameraView.zoom <= 22
        ? cameraView
        : null;
}

function matchesContext(viewport, context) {
    return Boolean(
        viewport
        && context
        && viewport.mapId === context.mapId
        && viewport.viewId === context.viewId
    );
}

export function patchMapStudioRouteViewport(current, contextValue, patch = {}) {
    const context = normalizeContext(contextValue);
    if (!context) return current || null;
    const next = matchesContext(current, context)
        ? { ...current }
        : {
            mapId: context.mapId,
            viewId: context.viewId,
            cameraView: null,
            heightPx: null,
            heightPreset: context.heightPreset,
        };

    if (Object.prototype.hasOwnProperty.call(patch, 'cameraView')) {
        next.cameraView = normalizeCameraView(patch.cameraView);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'heightPx')) {
        next.heightPx = normalizeHeight(patch.heightPx);
        next.heightPreset = context.heightPreset;
    }
    return next;
}

export function resolveMapStudioRouteViewport(current, contextValue) {
    const context = normalizeContext(contextValue);
    if (!matchesContext(current, context)) {
        return { cameraView: null, heightPx: null };
    }
    return {
        cameraView: normalizeCameraView(current.cameraView),
        heightPx: current.heightPreset === context.heightPreset
            ? normalizeHeight(current.heightPx)
            : null,
    };
}
