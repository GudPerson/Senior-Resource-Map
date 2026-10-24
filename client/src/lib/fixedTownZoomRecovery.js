import {
    FIXED_TOWN_SURFACE_DEFAULT_MAX_DECODED_BYTES,
    getFixedTownChunksDecodedBytes,
    isFixedTownSurfaceViewportCovered,
    selectVisibleFixedTownChunks,
} from './fixedTownSurface.js';

// Export may preserve an explicitly requested scale using the overview. Both
// surfaces use the renderer's exact coverage and decoded-image safety rules.
export function shouldUseFixedTownOverviewAtRequestedScale({
    enabled = false,
    nativeManifest = null,
    overviewManifest = null,
    viewportBounds = null,
    maxDecodedBytes = null,
} = {}) {
    if (!enabled || !viewportBounds) return false;
    const configuredLimit = Number(maxDecodedBytes);
    const limit = Number.isFinite(configuredLimit) && configuredLimit > 0
        ? configuredLimit
        : FIXED_TOWN_SURFACE_DEFAULT_MAX_DECODED_BYTES;
    const fits = (manifest) => isFixedTownSurfaceViewportCovered(manifest, viewportBounds) === true
        && getFixedTownChunksDecodedBytes(selectVisibleFixedTownChunks(
            manifest.chunks,
            viewportBounds,
        )) <= limit;
    return !fits(nativeManifest) && fits(overviewManifest);
}
