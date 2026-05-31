export function shouldRefitDirectoryCameraAfterResize({
    previousLayoutSignature = '',
    nextLayoutSignature = '',
    pointCount = 0,
    focusedPlaceKey = '',
    activePlaceKey = '',
    activePlaceKeys = [],
    hasActivePlaceKeys = false,
} = {}) {
    if (!previousLayoutSignature || previousLayoutSignature === nextLayoutSignature) {
        return false;
    }

    if (!Number.isFinite(pointCount) || pointCount <= 0) {
        return false;
    }

    if (focusedPlaceKey || activePlaceKey || hasActivePlaceKeys || activePlaceKeys?.length) {
        return false;
    }

    return true;
}
