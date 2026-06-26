export function shouldRefitDirectoryCameraAfterResize({
    previousLayoutSignature = '',
    nextLayoutSignature = '',
    pointCount = 0,
    focusedPlaceKey = '',
    focusedPlaceKeys = [],
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

    if (focusedPlaceKey || focusedPlaceKeys?.length || activePlaceKey || hasActivePlaceKeys || activePlaceKeys?.length) {
        return false;
    }

    return true;
}

export function getFocusedDirectoryCameraPins(pins = [], focusedPlaceKeys = []) {
    const keySet = new Set((focusedPlaceKeys || [])
        .filter(Boolean)
        .map((value) => String(value)));
    if (!keySet.size) return [];

    return (pins || []).filter((pin) => {
        if (!pin) return false;
        const pinKeys = [pin.placeKey, ...(pin.memberPlaceKeys || [])]
            .filter(Boolean)
            .map((value) => String(value));
        return pinKeys.some((key) => keySet.has(key));
    });
}
