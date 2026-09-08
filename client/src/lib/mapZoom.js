export const HALF_STEP_MAP_ZOOM_DELTA = 0.5;

export function normalizeMapZoomControlStep(value, fallback = 1) {
    const normalizedValue = Number(value);
    return Number.isFinite(normalizedValue) && normalizedValue > 0
        ? normalizedValue
        : fallback;
}

export function resolveFractionalMapZoomLevel(zoom) {
    const normalizedZoom = Number(zoom);
    if (!Number.isFinite(normalizedZoom)) return null;
    return Math.round((normalizedZoom + Number.EPSILON) * 10) / 10;
}

export function formatMapZoomLevel(zoom) {
    const normalizedZoom = resolveFractionalMapZoomLevel(zoom);
    if (!Number.isFinite(normalizedZoom)) return '—';
    return Number.isInteger(normalizedZoom)
        ? String(normalizedZoom)
        : normalizedZoom.toFixed(1);
}

export function resolveTopAlignedMapCenterPoint({
    horizontalCenterPoint,
    coverageNorthPoint,
    viewportHeight,
} = {}) {
    const horizontalCenterX = Number(horizontalCenterPoint?.x);
    const coverageNorthY = Number(coverageNorthPoint?.y);
    const normalizedViewportHeight = Number(viewportHeight);

    if (
        !Number.isFinite(horizontalCenterX)
        || !Number.isFinite(coverageNorthY)
        || !Number.isFinite(normalizedViewportHeight)
        || normalizedViewportHeight <= 0
    ) {
        return null;
    }

    return {
        x: horizontalCenterX,
        y: coverageNorthY + (normalizedViewportHeight / 2),
    };
}

export function resolveResponsiveMapMinimumZoom({
    fitZoom,
    minimumZoom = 10,
    maximumZoom = 12,
    step = HALF_STEP_MAP_ZOOM_DELTA,
} = {}) {
    if (fitZoom === null || fitZoom === undefined || fitZoom === '') {
        return null;
    }
    const normalizedFitZoom = Number(fitZoom);
    const normalizedMinimumZoom = Number(minimumZoom);
    const normalizedMaximumZoom = Number(maximumZoom);
    const normalizedStep = normalizeMapZoomControlStep(step, HALF_STEP_MAP_ZOOM_DELTA);
    if (
        !Number.isFinite(normalizedFitZoom)
        || !Number.isFinite(normalizedMinimumZoom)
        || !Number.isFinite(normalizedMaximumZoom)
        || normalizedMaximumZoom < normalizedMinimumZoom
    ) {
        return null;
    }

    const steppedZoom = Math.floor(
        (normalizedFitZoom + Number.EPSILON) / normalizedStep,
    ) * normalizedStep;
    return Math.min(
        normalizedMaximumZoom,
        Math.max(normalizedMinimumZoom, steppedZoom),
    );
}
