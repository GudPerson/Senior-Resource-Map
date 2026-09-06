import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

import FixedTownSurfaceLayer from '../../components/FixedTownSurfaceLayer.jsx';
import {
    fetchFixedTownSurfaceManifest,
    fetchFixedTownSurfaceSource,
    normalizeFixedTownAssetBaseUrl,
    resolveFixedTownSurfaceAssetBaseUrl,
    resolveFixedTownSurfaceManifestPath,
    selectFixedTownSurfaceForViewport,
} from '../../lib/fixedTownSurface.js';
import {
    CAREAROUND_MAP_STYLE_DEFAULT,
    CAREAROUND_MAP_STYLE_GRAY,
    normalizeCareAroundMapStyle,
} from '../../lib/mapTheme.js';
import {
    DISCOVER_DETAILED_NATIVE_MIN_ZOOM,
    DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM,
    isDiscoverDetailedDerivativeEnabled,
    isDiscoverDetailedMapFeatureEnabled,
    resolveDiscoverDetailedContainmentCamera,
    resolveDiscoverDetailedBasemap,
    resolveDiscoverDetailedMaxDecodedBytes,
} from './discoverDetailedMap.js';

const DISCOVER_DETAILED_MAP_ENABLED = isDiscoverDetailedMapFeatureEnabled(import.meta.env);
const DISCOVER_DETAILED_DERIVATIVE_REQUESTED = isDiscoverDetailedDerivativeEnabled(
    import.meta.env,
);
const DISCOVER_DETAILED_ACTIVE_MAX_DECODED_BYTES = resolveDiscoverDetailedMaxDecodedBytes(import.meta.env);
const DISCOVER_DETAILED_OVERVIEW_ENABLED = DISCOVER_DETAILED_MAP_ENABLED
    && import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED === 'true';
const DISCOVER_STABLE_NATIVE_ASSET_BASE_URLS = Object.freeze({
    [CAREAROUND_MAP_STYLE_DEFAULT]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_TOWN_MAP_ASSET_BASE_URL || '',
    ),
    [CAREAROUND_MAP_STYLE_GRAY]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_TOWN_MAP_GRAY_ASSET_BASE_URL || '',
    ),
});
const DISCOVER_STABLE_OVERVIEW_ASSET_BASE_URLS = Object.freeze({
    [CAREAROUND_MAP_STYLE_DEFAULT]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL || '',
    ),
    [CAREAROUND_MAP_STYLE_GRAY]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL || '',
    ),
});
const DISCOVER_DERIVATIVE_NATIVE_ASSET_BASE_URLS = Object.freeze({
    [CAREAROUND_MAP_STYLE_DEFAULT]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_DISCOVER_DETAILED_DERIVATIVE_NATIVE_ASSET_BASE_URL || '',
    ),
    [CAREAROUND_MAP_STYLE_GRAY]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_NATIVE_ASSET_BASE_URL || '',
    ),
});
const DISCOVER_DERIVATIVE_OVERVIEW_ASSET_BASE_URLS = Object.freeze({
    [CAREAROUND_MAP_STYLE_DEFAULT]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_DISCOVER_DETAILED_DERIVATIVE_OVERVIEW_ASSET_BASE_URL || '',
    ),
    [CAREAROUND_MAP_STYLE_GRAY]: normalizeFixedTownAssetBaseUrl(
        import.meta.env.VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_OVERVIEW_ASSET_BASE_URL || '',
    ),
});
const DISCOVER_DETAILED_DERIVATIVE_ENABLED = DISCOVER_DETAILED_DERIVATIVE_REQUESTED
    && [
        ...Object.values(DISCOVER_DERIVATIVE_NATIVE_ASSET_BASE_URLS),
        ...Object.values(DISCOVER_DERIVATIVE_OVERVIEW_ASSET_BASE_URLS),
    ].every(Boolean);
const DISCOVER_NATIVE_ASSET_BASE_URLS = DISCOVER_DETAILED_DERIVATIVE_ENABLED
    ? DISCOVER_DERIVATIVE_NATIVE_ASSET_BASE_URLS
    : DISCOVER_STABLE_NATIVE_ASSET_BASE_URLS;
const DISCOVER_OVERVIEW_ASSET_BASE_URLS = DISCOVER_DETAILED_DERIVATIVE_ENABLED
    ? DISCOVER_DERIVATIVE_OVERVIEW_ASSET_BASE_URLS
    : DISCOVER_STABLE_OVERVIEW_ASSET_BASE_URLS;

function createSourceState(status = 'idle') {
    return {
        status,
        sourceType: 'none',
        index: null,
        manifest: null,
    };
}

function readMapViewport(map) {
    const bounds = map.getBounds();
    return {
        zoom: Number(map.getZoom()),
        bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    };
}

function buildViewportKey(bounds) {
    return Array.isArray(bounds)
        ? bounds.map((value) => Number(value).toFixed(5)).join(',')
        : '';
}

function useDiscoverMapViewport() {
    const map = useMap();
    const [viewport, setViewport] = useState(() => readMapViewport(map));

    useEffect(() => {
        let frame = null;
        const updateViewport = () => {
            if (frame !== null) return;
            frame = window.requestAnimationFrame(() => {
                frame = null;
                setViewport(readMapViewport(map));
            });
        };

        updateViewport();
        map.on('zoom moveend resize', updateViewport);
        return () => {
            if (frame !== null) window.cancelAnimationFrame(frame);
            map.off('zoom moveend resize', updateViewport);
        };
    }, [map]);

    return viewport;
}

function DiscoverDetailedZoomContainmentSync({
    enabled,
    manifest,
    maxDecodedBytes,
}) {
    const map = useMap();
    const manifestRef = useRef(manifest);
    const pendingContainmentRef = useRef(false);
    const adjustingRef = useRef(false);
    const previousDisplayedZoomRef = useRef(Math.round(Number(map.getZoom())));

    useLayoutEffect(() => {
        manifestRef.current = manifest;
    }, [manifest]);

    const containCurrentViewport = useCallback(() => {
        const activeManifest = manifestRef.current;
        if (!enabled || !activeManifest || adjustingRef.current) return Boolean(activeManifest);

        const currentZoom = Number(map.getZoom());
        const camera = resolveDiscoverDetailedContainmentCamera({
            center: map.getCenter(),
            currentZoom,
            manifest: activeManifest,
            maxDecodedBytes,
            maximumZoom: Number(map.getMaxZoom()),
            project: (point, zoom) => map.project(point, zoom),
            unproject: (point, zoom) => map.unproject(point, zoom),
            viewportSize: map.getSize(),
        });
        if (!camera) return true;

        const currentCenter = map.getCenter();
        const centerChanged = Math.abs(Number(currentCenter.lat) - camera.center.lat) > 1e-9
            || Math.abs(Number(currentCenter.lng) - camera.center.lng) > 1e-9;
        const zoomChanged = Math.abs(currentZoom - camera.zoom) > 1e-9;
        if (!centerChanged && !zoomChanged) return true;

        adjustingRef.current = true;
        map.setView(camera.center, camera.zoom, { animate: false });
        window.requestAnimationFrame(() => {
            adjustingRef.current = false;
        });
        return true;
    }, [enabled, map, maxDecodedBytes]);

    useLayoutEffect(() => {
        if (!pendingContainmentRef.current || !manifest) return;
        pendingContainmentRef.current = false;
        containCurrentViewport();
    }, [containCurrentViewport, manifest]);

    useEffect(() => {
        if (!enabled) return undefined;

        let resizeFrame = null;
        const requestContainment = () => {
            pendingContainmentRef.current = !containCurrentViewport();
        };
        const handleZoomEnd = () => {
            const displayedZoom = Math.round(Number(map.getZoom()));
            const crossedIntoNative = previousDisplayedZoomRef.current
                < DISCOVER_DETAILED_NATIVE_MIN_ZOOM
                && displayedZoom >= DISCOVER_DETAILED_NATIVE_MIN_ZOOM;
            previousDisplayedZoomRef.current = displayedZoom;
            if (crossedIntoNative) requestContainment();
        };
        const handleResize = () => {
            if (Math.round(Number(map.getZoom())) < DISCOVER_DETAILED_NATIVE_MIN_ZOOM) return;
            if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(() => {
                resizeFrame = null;
                requestContainment();
            });
        };

        map.on('zoomend', handleZoomEnd);
        map.on('resize', handleResize);
        return () => {
            if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
            map.off('zoomend', handleZoomEnd);
            map.off('resize', handleResize);
        };
    }, [containCurrentViewport, enabled, map]);

    return null;
}

function useDiscoverFixedSurface({
    enabled,
    assetBaseUrl,
    viewportBounds,
}) {
    const [sourceState, setSourceState] = useState(() => createSourceState());
    const [manifestRevision, setManifestRevision] = useState(0);
    const manifestCacheRef = useRef(new Map());
    const manifestErrorRef = useRef(new Map());
    const manifestInFlightRef = useRef(new Map());

    useEffect(() => {
        manifestCacheRef.current.clear();
        manifestErrorRef.current.clear();
        manifestInFlightRef.current.clear();
        setManifestRevision((current) => current + 1);
        if (!enabled || !assetBaseUrl) {
            setSourceState(createSourceState());
            return undefined;
        }

        const controller = new AbortController();
        setSourceState(createSourceState('loading'));
        fetchFixedTownSurfaceSource(assetBaseUrl, { signal: controller.signal })
            .then((source) => {
                setSourceState(source.type === 'index'
                    ? {
                        status: 'ready',
                        sourceType: 'index',
                        index: source.index,
                        manifest: null,
                    }
                    : {
                        status: 'ready',
                        sourceType: 'manifest',
                        index: null,
                        manifest: source.manifest,
                    });
            })
            .catch((error) => {
                if (error?.name === 'AbortError') return;
                setSourceState(createSourceState('error'));
            });

        return () => controller.abort();
    }, [assetBaseUrl, enabled]);

    const selectedSurface = useMemo(() => {
        if (sourceState.status !== 'ready' || sourceState.sourceType !== 'index') return null;
        return selectFixedTownSurfaceForViewport(sourceState.index, viewportBounds);
    }, [sourceState, viewportBounds]);
    const selectedSurfaceId = selectedSurface?.id || '';
    const selectedManifestPath = selectedSurface
        ? resolveFixedTownSurfaceManifestPath(selectedSurface)
        : '';
    const selectedAssetBaseUrl = selectedSurface
        ? resolveFixedTownSurfaceAssetBaseUrl(assetBaseUrl, selectedSurface)
        : '';

    useEffect(() => {
        if (
            !enabled
            || !assetBaseUrl
            || sourceState.status !== 'ready'
            || sourceState.sourceType !== 'index'
            || !selectedSurfaceId
            || !selectedManifestPath
            || !selectedAssetBaseUrl
            || manifestCacheRef.current.has(selectedSurfaceId)
            || manifestErrorRef.current.has(selectedSurfaceId)
        ) {
            return undefined;
        }

        let request = manifestInFlightRef.current.get(selectedSurfaceId);
        if (!request) {
            request = fetchFixedTownSurfaceManifest(assetBaseUrl, {
                manifestPath: selectedManifestPath,
            })
                .then((manifest) => {
                    manifestCacheRef.current.set(selectedSurfaceId, manifest);
                    return manifest;
                })
                .catch((error) => {
                    manifestErrorRef.current.set(selectedSurfaceId, error);
                    return null;
                })
                .finally(() => {
                    manifestInFlightRef.current.delete(selectedSurfaceId);
                });
            manifestInFlightRef.current.set(selectedSurfaceId, request);
        }

        let active = true;
        request.then(() => {
            if (active) setManifestRevision((current) => current + 1);
        });
        return () => {
            active = false;
        };
    }, [
        assetBaseUrl,
        enabled,
        selectedAssetBaseUrl,
        selectedManifestPath,
        selectedSurfaceId,
        sourceState,
    ]);

    if (!enabled || !assetBaseUrl) {
        return { configured: false, status: 'idle', candidate: false };
    }
    if (sourceState.status === 'loading' || sourceState.status === 'idle') {
        return { configured: true, status: 'loading', candidate: null };
    }
    if (sourceState.status === 'error') {
        return { configured: true, status: 'error', candidate: null };
    }
    if (sourceState.sourceType === 'manifest') {
        return {
            configured: true,
            status: 'ready',
            candidate: true,
            surfaceId: sourceState.manifest?.map?.id || '',
            manifest: sourceState.manifest,
            assetBaseUrl,
        };
    }
    if (!selectedSurfaceId || !selectedManifestPath || !selectedAssetBaseUrl) {
        return { configured: true, status: 'outside', candidate: false };
    }

    // Reading this state is what causes a completed retained request to be
    // reflected without restarting it when the same surface is selected again.
    void manifestRevision;
    const manifest = manifestCacheRef.current.get(selectedSurfaceId) || null;
    if (manifest) {
        return {
            configured: true,
            status: 'ready',
            candidate: true,
            surfaceId: selectedSurfaceId,
            manifest,
            assetBaseUrl: selectedAssetBaseUrl,
        };
    }
    if (manifestErrorRef.current.has(selectedSurfaceId)) {
        return {
            configured: true,
            status: 'error',
            candidate: true,
            surfaceId: selectedSurfaceId,
        };
    }
    return {
        configured: true,
        status: 'loading',
        candidate: true,
        surfaceId: selectedSurfaceId,
        assetBaseUrl: selectedAssetBaseUrl,
    };
}

export default function DiscoverDetailedBasemap({
    liveTiles,
    mapStyle,
}) {
    const map = useMap();
    const viewport = useDiscoverMapViewport();
    const resolvedMapStyle = normalizeCareAroundMapStyle(mapStyle);
    const defaultNative = useDiscoverFixedSurface({
        enabled: DISCOVER_DETAILED_MAP_ENABLED,
        assetBaseUrl: DISCOVER_NATIVE_ASSET_BASE_URLS[CAREAROUND_MAP_STYLE_DEFAULT],
        viewportBounds: viewport.bounds,
    });
    const grayNative = useDiscoverFixedSurface({
        enabled: DISCOVER_DETAILED_MAP_ENABLED,
        assetBaseUrl: DISCOVER_NATIVE_ASSET_BASE_URLS[CAREAROUND_MAP_STYLE_GRAY],
        viewportBounds: viewport.bounds,
    });
    const defaultOverview = useDiscoverFixedSurface({
        enabled: DISCOVER_DETAILED_OVERVIEW_ENABLED,
        assetBaseUrl: DISCOVER_OVERVIEW_ASSET_BASE_URLS[CAREAROUND_MAP_STYLE_DEFAULT],
        viewportBounds: viewport.bounds,
    });
    const grayOverview = useDiscoverFixedSurface({
        enabled: DISCOVER_DETAILED_OVERVIEW_ENABLED,
        assetBaseUrl: DISCOVER_OVERVIEW_ASSET_BASE_URLS[CAREAROUND_MAP_STYLE_GRAY],
        viewportBounds: viewport.bounds,
    });
    const native = resolvedMapStyle === CAREAROUND_MAP_STYLE_GRAY ? grayNative : defaultNative;
    const overview = resolvedMapStyle === CAREAROUND_MAP_STYLE_GRAY ? grayOverview : defaultOverview;
    const surfaceKey = [
        resolvedMapStyle,
        native.surfaceId || '',
        overview.surfaceId || '',
        buildViewportKey(viewport.bounds),
    ].join(':');
    const [fault, setFault] = useState(null);
    const activeFaultReason = fault?.key === surfaceKey ? fault.reason : '';
    const decision = resolveDiscoverDetailedBasemap({
        enabled: DISCOVER_DETAILED_MAP_ENABLED,
        zoom: viewport.zoom,
        viewportBounds: viewport.bounds,
        native,
        overview,
        faultReason: activeFaultReason,
        maxDecodedBytes: DISCOVER_DETAILED_ACTIVE_MAX_DECODED_BYTES,
    });
    const [metrics, setMetrics] = useState(null);

    useEffect(() => {
        if (decision.renderSurface) return;
        setMetrics(null);
    }, [decision.renderSurface, decision.surfaceId, decision.tier]);

    useEffect(() => {
        const container = map.getContainer();
        container.dataset.discoverBasemapMode = decision.mode;
        container.dataset.discoverDetailedTier = decision.tier;
        container.dataset.discoverDetailedStatus = decision.reason;
        container.dataset.discoverDetailedSurfaceId = decision.surfaceId;
        container.dataset.discoverDetailedVisibleChunks = String(metrics?.visibleChunkCount ?? decision.visibleChunkCount);
        container.dataset.discoverDetailedLoadedChunks = String(metrics?.loadedChunkCount ?? 0);
        container.dataset.discoverDetailedDecodedBytes = String(metrics?.visibleDecodedBytes ?? decision.visibleDecodedBytes);
        container.dataset.discoverDetailedAssetEdition = DISCOVER_DETAILED_DERIVATIVE_ENABLED
            ? 'derivative-v1'
            : 'stable';
        return () => {
            delete container.dataset.discoverBasemapMode;
            delete container.dataset.discoverDetailedTier;
            delete container.dataset.discoverDetailedStatus;
            delete container.dataset.discoverDetailedSurfaceId;
            delete container.dataset.discoverDetailedVisibleChunks;
            delete container.dataset.discoverDetailedLoadedChunks;
            delete container.dataset.discoverDetailedDecodedBytes;
            delete container.dataset.discoverDetailedAssetEdition;
        };
    }, [decision, map, metrics]);

    const handleFallback = useCallback((details = {}) => {
        setFault({
            key: surfaceKey,
            reason: details.reason || 'surface-unavailable',
        });
    }, [surfaceKey]);

    return (
        <>
            <DiscoverDetailedZoomContainmentSync
                enabled={DISCOVER_DETAILED_MAP_ENABLED}
                manifest={native.manifest || null}
                maxDecodedBytes={DISCOVER_DETAILED_ACTIVE_MAX_DECODED_BYTES}
            />
            {decision.renderSurface ? (
                <FixedTownSurfaceLayer
                    key={`discover-detailed:${resolvedMapStyle}:${decision.tier}:${decision.surfaceId}`}
                    manifest={decision.manifest}
                    assetBaseUrl={decision.assetBaseUrl}
                    minZoom={decision.tier === 'overview'
                        ? DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM
                        : DISCOVER_DETAILED_NATIVE_MIN_ZOOM}
                    grayscale={resolvedMapStyle === CAREAROUND_MAP_STYLE_GRAY}
                    lockMinZoom={false}
                    fallbackBelowMinZoom={false}
                    maxDecodedBytes={DISCOVER_DETAILED_ACTIVE_MAX_DECODED_BYTES}
                    onFallback={handleFallback}
                    onMetricsChange={setMetrics}
                />
            ) : null}
            {decision.renderLiveTiles ? liveTiles : null}
        </>
    );
}
