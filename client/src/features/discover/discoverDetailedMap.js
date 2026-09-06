import {
    FIXED_TOWN_OVERVIEW_MIN_ZOOM,
    FIXED_TOWN_SURFACE_DEFAULT_MAX_DECODED_BYTES,
    FIXED_TOWN_SURFACE_EXTENDED_MAX_DECODED_BYTES,
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
export const DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES = FIXED_TOWN_SURFACE_EXTENDED_MAX_DECODED_BYTES;

export function isDiscoverDetailedMapFeatureEnabled(environment = {}) {
    return environment.VITE_DISCOVER_DETAILED_MAP_ENABLED === 'true'
        && environment.VITE_TOWN_MAP_PROOF_ENABLED === 'true';
}

export function isDiscoverDetailedDerivativeEnabled(environment = {}) {
    return isDiscoverDetailedMapFeatureEnabled(environment)
        && environment.VITE_DISCOVER_DETAILED_DERIVATIVE_ENABLED === 'true';
}

export function resolveDiscoverDetailedMaxDecodedBytes(environment = {}) {
    if (isDiscoverDetailedDerivativeEnabled(environment)) {
        return DISCOVER_DETAILED_MAX_DECODED_BYTES;
    }
    const uatCeilingEnabled = isDiscoverDetailedMapFeatureEnabled(environment)
        && environment.VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED === 'true';
    return uatCeilingEnabled
        ? DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES
        : DISCOVER_DETAILED_MAX_DECODED_BYTES;
}

export function resolveDiscoverDetailedContainmentCamera({
    center,
    chunks,
    currentZoom,
    manifest,
    maxDecodedBytes = DISCOVER_DETAILED_MAX_DECODED_BYTES,
    maximumZoom,
    project,
    unproject,
    viewportSize,
} = {}) {
    const surfaceBounds = manifest?.bounds?.surface || manifest?.bounds?.nominal;
    const normalizedCenter = {
        lat: Number(center?.lat),
        lng: Number(center?.lng),
    };
    const normalizedCurrentZoom = Number(currentZoom);
    const normalizedMaximumZoom = Number(maximumZoom);
    const viewportWidth = Number(viewportSize?.x);
    const viewportHeight = Number(viewportSize?.y);
    if (
        !Array.isArray(surfaceBounds)
        || surfaceBounds.length !== 4
        || !surfaceBounds.every((value) => Number.isFinite(Number(value)))
        || !Number.isFinite(normalizedCenter.lat)
        || !Number.isFinite(normalizedCenter.lng)
        || !Number.isFinite(normalizedCurrentZoom)
        || !Number.isFinite(viewportWidth)
        || viewportWidth <= 0
        || !Number.isFinite(viewportHeight)
        || viewportHeight <= 0
        || typeof project !== 'function'
        || typeof unproject !== 'function'
    ) {
        return null;
    }

    const [west, south, east, north] = surfaceBounds.map(Number);
    if (
        normalizedCenter.lng < west
        || normalizedCenter.lng > east
        || normalizedCenter.lat < south
        || normalizedCenter.lat > north
    ) {
        return null;
    }

    const displayedZoom = resolveFixedTownDisplayZoomStep({ zoom: normalizedCurrentZoom });
    if (!isFixedTownSurfaceZoomEligible(displayedZoom, DISCOVER_DETAILED_NATIVE_MIN_ZOOM)) {
        return null;
    }

    const decodedByteLimit = Number.isFinite(Number(maxDecodedBytes))
        && Number(maxDecodedBytes) > 0
        ? Number(maxDecodedBytes)
        : DISCOVER_DETAILED_MAX_DECODED_BYTES;
    const resolvedMaximumZoom = Number.isFinite(normalizedMaximumZoom)
        ? normalizedMaximumZoom
        : normalizedCurrentZoom;
    const viewportHalf = {
        x: viewportWidth / 2,
        y: viewportHeight / 2,
    };
    const zoomStep = 0.1;
    const inset = 2;

    for (
        let candidateZoom = normalizedCurrentZoom;
        candidateZoom <= resolvedMaximumZoom + Number.EPSILON;
        candidateZoom = Math.round((candidateZoom + zoomStep) * 10) / 10
    ) {
        if (resolveFixedTownDisplayZoomStep({ zoom: candidateZoom }) !== displayedZoom) break;

        const surfaceNorthWest = project({ lat: north, lng: west }, candidateZoom);
        const surfaceSouthEast = project({ lat: south, lng: east }, candidateZoom);
        const projectedCenter = project(normalizedCenter, candidateZoom);
        if (
            ![surfaceNorthWest?.x, surfaceNorthWest?.y, surfaceSouthEast?.x, surfaceSouthEast?.y,
                projectedCenter?.x, projectedCenter?.y].every((value) => Number.isFinite(Number(value)))
        ) {
            continue;
        }

        const minimumX = Number(surfaceNorthWest.x) + viewportHalf.x + inset;
        const maximumX = Number(surfaceSouthEast.x) - viewportHalf.x - inset;
        const minimumY = Number(surfaceNorthWest.y) + viewportHalf.y + inset;
        const maximumY = Number(surfaceSouthEast.y) - viewportHalf.y - inset;
        if (minimumX > maximumX || minimumY > maximumY) continue;

        const candidateCenterPoint = {
            x: Math.min(maximumX, Math.max(minimumX, Number(projectedCenter.x))),
            y: Math.min(maximumY, Math.max(minimumY, Number(projectedCenter.y))),
        };
        const candidateNorthWest = unproject({
            x: candidateCenterPoint.x - viewportHalf.x,
            y: candidateCenterPoint.y - viewportHalf.y,
        }, candidateZoom);
        const candidateSouthEast = unproject({
            x: candidateCenterPoint.x + viewportHalf.x,
            y: candidateCenterPoint.y + viewportHalf.y,
        }, candidateZoom);
        const candidateCenter = unproject(candidateCenterPoint, candidateZoom);
        const candidateBounds = [
            Number(candidateNorthWest?.lng),
            Number(candidateSouthEast?.lat),
            Number(candidateSouthEast?.lng),
            Number(candidateNorthWest?.lat),
        ];
        if (
            !candidateBounds.every(Number.isFinite)
            || !Number.isFinite(Number(candidateCenter?.lat))
            || !Number.isFinite(Number(candidateCenter?.lng))
            || isFixedTownSurfaceViewportCovered(manifest, candidateBounds) !== true
        ) {
            continue;
        }

        const visibleChunks = selectVisibleFixedTownChunks(chunks || manifest.chunks, candidateBounds);
        if (
            visibleChunks.length > 0
            && getFixedTownChunksDecodedBytes(visibleChunks) <= decodedByteLimit
        ) {
            return {
                center: {
                    lat: Number(candidateCenter.lat),
                    lng: Number(candidateCenter.lng),
                },
                zoom: candidateZoom,
                viewportBounds: candidateBounds,
                visibleChunkCount: visibleChunks.length,
                visibleDecodedBytes: getFixedTownChunksDecodedBytes(visibleChunks),
            };
        }
    }

    return null;
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
