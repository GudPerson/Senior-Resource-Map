import {
    FIXED_TOWN_OVERVIEW_MIN_ZOOM,
    FIXED_TOWN_SURFACE_DEFAULT_MAX_DECODED_BYTES,
    getFixedTownChunksDecodedBytes,
    isFixedTownSurfaceViewportCovered,
    isFixedTownSurfaceZoomEligible,
    resolveFixedTownDisplayZoomStep,
    resolveFixedTownSurfaceTier,
    selectVisibleFixedTownChunks,
} from '../../lib/fixedTownSurface.js';

export const DISCOVER_DETAILED_NATIVE_MIN_ZOOM = 15;
export const DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM = FIXED_TOWN_OVERVIEW_MIN_ZOOM;
export const DISCOVER_DETAILED_MAX_DECODED_BYTES = FIXED_TOWN_SURFACE_DEFAULT_MAX_DECODED_BYTES;
export const DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES = 300 * 1024 * 1024;

export function isDiscoverDetailedMapFeatureEnabled(environment = {}) {
    return environment.VITE_DISCOVER_DETAILED_MAP_ENABLED === 'true'
        && environment.VITE_TOWN_MAP_PROOF_ENABLED === 'true';
}

export function resolveDiscoverDetailedMaxDecodedBytes(environment = {}) {
    const uatCeilingEnabled = isDiscoverDetailedMapFeatureEnabled(environment)
        && environment.VITE_DISCOVER_DETAILED_MAP_UAT_300_MIB_ENABLED === 'true';
    return uatCeilingEnabled
        ? DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES
        : DISCOVER_DETAILED_MAX_DECODED_BYTES;
}

function liveDecision({ displayedZoom, reason, tier = 'live', pending = false }) {
    return {
        displayedZoom,
        tier,
        mode: 'live',
        pending,
        reason,
        renderLiveTiles: !pending,
        renderSurface: false,
        manifest: null,
        assetBaseUrl: '',
        surfaceId: '',
        visibleChunkCount: 0,
        visibleDecodedBytes: 0,
    };
}

export function resolveDiscoverDetailedBasemap({
    enabled = false,
    zoom,
    viewportBounds,
    native = null,
    overview = null,
    faultReason = '',
    maxDecodedBytes = DISCOVER_DETAILED_MAX_DECODED_BYTES,
} = {}) {
    const displayedZoom = resolveFixedTownDisplayZoomStep({ zoom });
    if (!enabled) {
        return liveDecision({ displayedZoom, reason: 'feature-disabled' });
    }

    if (!isFixedTownSurfaceZoomEligible(displayedZoom, DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM)) {
        return liveDecision({ displayedZoom, reason: 'zoom-below-detailed' });
    }

    const overviewConfigured = Boolean(overview?.configured);
    const tier = resolveFixedTownSurfaceTier({
        zoom: displayedZoom,
        nativeMinZoom: DISCOVER_DETAILED_NATIVE_MIN_ZOOM,
        overviewMinZoom: DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM,
        overviewConfigured,
    });
    const tierMinZoom = tier === 'overview'
        ? DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM
        : DISCOVER_DETAILED_NATIVE_MIN_ZOOM;
    if (!isFixedTownSurfaceZoomEligible(displayedZoom, tierMinZoom)) {
        return liveDecision({
            displayedZoom,
            reason: 'surface-not-configured',
            tier,
        });
    }

    const surface = tier === 'overview' ? overview : native;
    if (!surface?.configured) {
        return liveDecision({
            displayedZoom,
            reason: 'surface-not-configured',
            tier,
        });
    }
    if (surface.status === 'loading') {
        return liveDecision({
            displayedZoom,
            reason: 'surface-loading',
            tier,
            pending: surface.candidate !== false,
        });
    }
    if (surface.status === 'outside') {
        return liveDecision({
            displayedZoom,
            reason: 'outside-coverage',
            tier,
        });
    }
    if (surface.status === 'error') {
        return liveDecision({
            displayedZoom,
            reason: 'surface-load-error',
            tier,
        });
    }
    if (faultReason) {
        return liveDecision({
            displayedZoom,
            reason: faultReason,
            tier,
        });
    }

    const manifest = surface.manifest;
    const assetBaseUrl = surface.assetBaseUrl || '';
    if (!manifest || !assetBaseUrl) {
        return liveDecision({
            displayedZoom,
            reason: 'manifest-unavailable',
            tier,
        });
    }
    if (isFixedTownSurfaceViewportCovered(manifest, viewportBounds) !== true) {
        return liveDecision({
            displayedZoom,
            reason: 'outside-coverage',
            tier,
        });
    }

    const visibleChunks = selectVisibleFixedTownChunks(manifest.chunks, viewportBounds);
    const visibleDecodedBytes = getFixedTownChunksDecodedBytes(visibleChunks);
    const normalizedMaxDecodedBytes = Number(maxDecodedBytes);
    const decodedByteLimit = Number.isFinite(normalizedMaxDecodedBytes)
        && normalizedMaxDecodedBytes > 0
        ? normalizedMaxDecodedBytes
        : DISCOVER_DETAILED_MAX_DECODED_BYTES;
    if (visibleDecodedBytes > decodedByteLimit) {
        return liveDecision({
            displayedZoom,
            reason: 'viewport-memory-limit',
            tier,
        });
    }

    return {
        displayedZoom,
        tier,
        mode: 'detailed',
        pending: false,
        reason: 'surface-ready',
        renderLiveTiles: false,
        renderSurface: true,
        manifest,
        assetBaseUrl,
        surfaceId: String(surface.surfaceId || manifest.map?.id || ''),
        visibleChunkCount: visibleChunks.length,
        visibleDecodedBytes,
    };
}
