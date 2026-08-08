import { useEffect, useMemo, useRef, useState } from 'react';

import {
    fetchFixedTownSurfaceManifest,
    fetchFixedTownSurfaceSource,
    normalizeFixedTownAssetBaseUrl,
    resolveFixedTownSurfaceAssetBaseUrl,
    resolveFixedTownSurfaceManifestPath,
    selectFixedTownSurfaceForViewport,
} from '../lib/fixedTownSurface.js';

const EMBED_DETAILED_MAP_ENABLED = import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED === 'true';
const EMBED_NATIVE_ASSET_BASE_URL = normalizeFixedTownAssetBaseUrl(
    import.meta.env.VITE_TOWN_MAP_ASSET_BASE_URL || '',
);
const EMBED_OVERVIEW_ENABLED = EMBED_DETAILED_MAP_ENABLED
    && import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED === 'true';
const EMBED_OVERVIEW_ASSET_BASE_URL = normalizeFixedTownAssetBaseUrl(
    import.meta.env.VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL || '',
);

function createSourceState(status = 'idle') {
    return {
        status,
        sourceType: 'none',
        index: null,
        manifest: null,
    };
}

function createManifestState(status = 'idle') {
    return {
        status,
        surfaceId: '',
        manifest: null,
        assetBaseUrl: '',
    };
}

function useEmbeddedFixedSurface({
    enabled,
    assetBaseUrl,
    viewportBounds,
    coveragePoints,
}) {
    const [sourceState, setSourceState] = useState(() => createSourceState());
    const [manifestState, setManifestState] = useState(() => createManifestState());
    const manifestCacheRef = useRef(new Map());

    useEffect(() => {
        manifestCacheRef.current.clear();
        setManifestState(createManifestState());
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
        return selectFixedTownSurfaceForViewport(
            sourceState.index,
            viewportBounds,
            coveragePoints,
        );
    }, [coveragePoints, sourceState, viewportBounds]);
    const selectedSurfaceId = selectedSurface?.id || '';
    const selectedManifestPath = selectedSurface
        ? resolveFixedTownSurfaceManifestPath(selectedSurface)
        : '';
    const selectedAssetBaseUrl = selectedSurface
        ? resolveFixedTownSurfaceAssetBaseUrl(assetBaseUrl, selectedSurface)
        : '';

    useEffect(() => {
        if (!enabled || !assetBaseUrl || sourceState.status !== 'ready') {
            setManifestState(createManifestState());
            return undefined;
        }

        if (sourceState.sourceType === 'manifest') {
            setManifestState({
                status: 'ready',
                surfaceId: sourceState.manifest?.map?.id || '',
                manifest: sourceState.manifest,
                assetBaseUrl,
            });
            return undefined;
        }

        if (!selectedSurfaceId || !selectedManifestPath || !selectedAssetBaseUrl) {
            setManifestState(createManifestState());
            return undefined;
        }

        const cachedManifest = manifestCacheRef.current.get(selectedSurfaceId);
        if (cachedManifest) {
            setManifestState({
                status: 'ready',
                surfaceId: selectedSurfaceId,
                manifest: cachedManifest,
                assetBaseUrl: selectedAssetBaseUrl,
            });
            return undefined;
        }

        const controller = new AbortController();
        setManifestState({
            status: 'loading',
            surfaceId: selectedSurfaceId,
            manifest: null,
            assetBaseUrl: selectedAssetBaseUrl,
        });
        fetchFixedTownSurfaceManifest(assetBaseUrl, {
            manifestPath: selectedManifestPath,
            signal: controller.signal,
        })
            .then((manifest) => {
                manifestCacheRef.current.set(selectedSurfaceId, manifest);
                setManifestState({
                    status: 'ready',
                    surfaceId: selectedSurfaceId,
                    manifest,
                    assetBaseUrl: selectedAssetBaseUrl,
                });
            })
            .catch((error) => {
                if (error?.name === 'AbortError') return;
                setManifestState({
                    status: 'error',
                    surfaceId: selectedSurfaceId,
                    manifest: null,
                    assetBaseUrl: selectedAssetBaseUrl,
                });
            });

        return () => controller.abort();
    }, [
        assetBaseUrl,
        enabled,
        selectedAssetBaseUrl,
        selectedManifestPath,
        selectedSurfaceId,
        sourceState,
    ]);

    const sourcePending = sourceState.status === 'loading';
    const manifestPending = sourceState.sourceType === 'index'
        && Boolean(selectedSurfaceId)
        && manifestState.status === 'loading';

    return {
        manifest: manifestState.manifest,
        assetBaseUrl: manifestState.assetBaseUrl || assetBaseUrl,
        available: manifestState.status === 'ready' && Boolean(manifestState.manifest),
        pending: sourcePending || manifestPending,
    };
}

export function useEmbeddedDetailedMap(pins = []) {
    const [viewportBounds, setViewportBounds] = useState(null);
    const coveragePoints = useMemo(() => (pins || [])
        .map((pin) => ({
            id: String(pin?.placeKey || pin?.pinKey || ''),
            lat: Number(pin?.lat),
            lng: Number(pin?.lng),
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)), [pins]);
    const enabled = EMBED_DETAILED_MAP_ENABLED && Boolean(EMBED_NATIVE_ASSET_BASE_URL);
    const native = useEmbeddedFixedSurface({
        enabled,
        assetBaseUrl: EMBED_NATIVE_ASSET_BASE_URL,
        viewportBounds,
        coveragePoints,
    });
    const overview = useEmbeddedFixedSurface({
        enabled: enabled && EMBED_OVERVIEW_ENABLED && Boolean(EMBED_OVERVIEW_ASSET_BASE_URL),
        assetBaseUrl: EMBED_OVERVIEW_ASSET_BASE_URL,
        viewportBounds,
        coveragePoints,
    });

    return {
        enabled,
        native,
        overview,
        setViewportBounds,
    };
}
