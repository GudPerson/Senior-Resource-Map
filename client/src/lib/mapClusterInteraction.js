export function buildClusterToken(placeKeys = []) {
    return [...new Set((placeKeys || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean))]
        .sort()
        .join('|');
}

export function getClusterActivationAction(clusterPlaceKeys = [], activePlaceKeys = [], selectedClusterToken = '') {
    const clusterToken = buildClusterToken(clusterPlaceKeys);
    return clusterToken ? 'zoom' : 'ignore';
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

export function getClusterExpansionZoom({
    currentZoom = 0,
    childCount = 0,
    maxZoom = 16,
} = {}) {
    const normalizedCurrent = Number.isFinite(currentZoom) ? currentZoom : 0;
    const normalizedMax = Number.isFinite(maxZoom) ? maxZoom : 16;
    const normalizedChildCount = Number.isFinite(childCount) ? childCount : 0;
    if (normalizedChildCount > 1 && normalizedChildCount <= 3) {
        return normalizedMax;
    }
    const desiredNextSplit = Number.isInteger(normalizedCurrent)
        ? normalizedCurrent + 2
        : Math.ceil(normalizedCurrent) + 1;
    return Math.min(desiredNextSplit, normalizedMax);
}

export function getClusterCameraPlan({
    currentZoom = 0,
    targetZoom = 16,
    childCount = 0,
    mapHeight = 0,
    compactMapHeight = 380,
} = {}) {
    const normalizedCurrent = Number.isFinite(currentZoom) ? currentZoom : 0;
    const normalizedTarget = Number.isFinite(targetZoom) ? targetZoom : 16;
    const normalizedChildCount = Number.isFinite(childCount) ? childCount : 0;
    const normalizedMapHeight = Number.isFinite(mapHeight) ? mapHeight : 0;
    const normalizedCompactHeight = Number.isFinite(compactMapHeight) ? compactMapHeight : 380;

    if (
        normalizedChildCount > 1
        && normalizedMapHeight > 0
        && normalizedMapHeight <= normalizedCompactHeight
        && normalizedTarget > normalizedCurrent
    ) {
        return {
            mode: 'zoom-then-fit-child-bounds',
            maxZoom: normalizedTarget,
        };
    }

    if (normalizedChildCount > 1 && normalizedMapHeight > 0 && normalizedMapHeight <= normalizedCompactHeight) {
        return {
            mode: 'fit-child-bounds',
            maxZoom: normalizedTarget,
        };
    }

    if (normalizedTarget > normalizedCurrent) {
        return {
            mode: 'center-cluster',
            maxZoom: normalizedTarget,
        };
    }

    return {
        mode: 'fit-child-bounds',
        maxZoom: normalizedTarget,
    };
}
