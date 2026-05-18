export function buildClusterToken(placeKeys = []) {
    return [...new Set((placeKeys || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean))]
        .sort()
        .join('|');
}

export function getClusterActivationAction(clusterPlaceKeys = [], activePlaceKeys = [], selectedClusterToken = '') {
    const clusterToken = buildClusterToken(clusterPlaceKeys);
    if (!clusterToken) return 'select';
    return clusterToken === buildClusterToken(activePlaceKeys) || clusterToken === String(selectedClusterToken || '')
        ? 'zoom'
        : 'select';
}

export function isDuplicateClusterClick({
    eventType,
    token,
    now,
    lastEvent,
    thresholdMs = 350,
} = {}) {
    return eventType === 'clusterclick'
        && lastEvent?.eventType === 'clustermousedown'
        && lastEvent?.token === token
        && Number.isFinite(now)
        && Number.isFinite(lastEvent?.at)
        && now - lastEvent.at < thresholdMs;
}

export function shouldIgnoreClusterHover({
    pointerType = '',
    coarsePointer = false,
} = {}) {
    return Boolean(coarsePointer) || pointerType === 'touch' || pointerType === 'pen';
}

export function getNextClusterZoom(currentZoom = 0, maxZoom = 16) {
    const normalizedCurrent = Number.isFinite(currentZoom) ? currentZoom : 0;
    const normalizedMax = Number.isFinite(maxZoom) ? maxZoom : 16;
    const nextWholeZoom = Number.isInteger(normalizedCurrent)
        ? normalizedCurrent + 1
        : Math.ceil(normalizedCurrent) + 1;
    return Math.min(nextWholeZoom, normalizedMax);
}
