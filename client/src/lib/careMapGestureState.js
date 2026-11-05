export function normalizeCareMapBearing(value) {
    const bearing = Number(value);
    return Number.isFinite(bearing) ? ((bearing % 360) + 360) % 360 : 0;
}

const desktopPinchMaps = new WeakSet();

export function setCareMapDesktopPinchActive(map, active) {
    if (!map || (typeof map !== 'object' && typeof map !== 'function')) return;
    if (active) desktopPinchMaps.add(map); else desktopPinchMaps.delete(map);
}

export function isCareMapGestureActive(map) {
    return Boolean(map?.touchGestures?._active || map?._rotating || map?._animatingZoom
        || (map && desktopPinchMaps.has(map)));
}
