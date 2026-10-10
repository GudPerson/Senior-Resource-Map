export function normalizeCareMapBearing(value) {
    const bearing = Number(value);
    return Number.isFinite(bearing) ? ((bearing % 360) + 360) % 360 : 0;
}

export function isCareMapGestureActive(map) {
    return Boolean(map?.touchGestures?._active || map?._rotating || map?._animatingZoom);
}
