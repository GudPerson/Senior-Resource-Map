import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import {
    isFixedTownSurfaceZoomEligible,
    resolveFixedTownChunkUrl,
    selectVisibleFixedTownChunks,
} from '../lib/fixedTownSurface.js';

export const FIXED_TOWN_SURFACE_MIN_ZOOM = 15;

const FIXED_TOWN_SURFACE_PANE = 'carearound-fixed-town-surface';
const FIXED_TOWN_SURFACE_BACKDROP_PANE = 'carearound-fixed-town-surface-backdrop';
const FIXED_TOWN_SURFACE_PANE_Z_INDEX = 210;
const FIXED_TOWN_SURFACE_BACKDROP_PANE_Z_INDEX = FIXED_TOWN_SURFACE_PANE_Z_INDEX - 1;
const FIXED_TOWN_SURFACE_SEAM_OVERLAP_CSS_PX = 0.55;
const FIXED_TOWN_SURFACE_PRUNE_SETTLE_MS = 180;
const FIXED_TOWN_SURFACE_RETENTION_PAD = 0.5;
const FIXED_TOWN_SURFACE_LOW_ZOOM_RANGE = 1;
const FIXED_TOWN_SURFACE_MAX_DECODED_BYTES = 256 * 1024 * 1024;

function getDecodedBytes(chunks) {
    return chunks.reduce((sum, chunk) => {
        const [width, height] = Array.isArray(chunk.pixelSize) ? chunk.pixelSize.map(Number) : [0, 0];
        return sum + (Number.isFinite(width) && Number.isFinite(height) ? width * height * 4 : 0);
    }, 0);
}

function toLeafletBounds(bounds) {
    if (!Array.isArray(bounds) || bounds.length !== 4) return null;
    const [west, south, east, north] = bounds.map(Number);
    if (![west, south, east, north].every(Number.isFinite)) return null;
    return L.latLngBounds([south, west], [north, east]);
}

function getViewportBounds(map, padRatio = 0) {
    const rawBounds = map.getBounds();
    const bounds = padRatio > 0 ? rawBounds.pad(padRatio) : rawBounds;
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

function getChunkRenderBounds(map, chunk, sourceZoom) {
    const worldPixelBounds = Array.isArray(chunk?.worldPixelBounds)
        ? chunk.worldPixelBounds.map(Number)
        : null;
    const currentZoom = Number(map.getZoom());

    if (
        worldPixelBounds?.length === 4
        && worldPixelBounds.every(Number.isFinite)
        && Number.isFinite(sourceZoom)
        && Number.isFinite(currentZoom)
    ) {
        const [left, top, right, bottom] = worldPixelBounds;
        const overlap = FIXED_TOWN_SURFACE_SEAM_OVERLAP_CSS_PX * (2 ** (sourceZoom - currentZoom));
        const northWest = map.unproject(L.point(left - overlap, top - overlap), sourceZoom);
        const southEast = map.unproject(L.point(right + overlap, bottom + overlap), sourceZoom);
        return L.latLngBounds(southEast, northWest);
    }

    return toLeafletBounds(chunk?.bounds);
}

export default function FixedTownSurfaceLayer({
    manifest,
    assetBaseUrl,
    minZoom = FIXED_TOWN_SURFACE_MIN_ZOOM,
    grayscale = false,
    lockMinZoom = true,
    fallbackBelowMinZoom = true,
    onFallback,
    onMetricsChange,
}) {
    const map = useMap();
    const onFallbackRef = useRef(onFallback);
    const onMetricsChangeRef = useRef(onMetricsChange);

    useEffect(() => {
        onFallbackRef.current = onFallback;
    }, [onFallback]);

    useEffect(() => {
        onMetricsChangeRef.current = onMetricsChange;
    }, [onMetricsChange]);

    useEffect(() => {
        if (!manifest || !assetBaseUrl) {
            onFallbackRef.current?.({ reason: 'manifest-unavailable' });
            return undefined;
        }

        const pane = map.getPane(FIXED_TOWN_SURFACE_PANE) || map.createPane(FIXED_TOWN_SURFACE_PANE);
        pane.style.zIndex = String(FIXED_TOWN_SURFACE_PANE_Z_INDEX);
        pane.style.pointerEvents = 'none';
        const backdropPane = map.getPane(FIXED_TOWN_SURFACE_BACKDROP_PANE)
            || map.createPane(FIXED_TOWN_SURFACE_BACKDROP_PANE);
        backdropPane.style.zIndex = String(FIXED_TOWN_SURFACE_BACKDROP_PANE_Z_INDEX);
        backdropPane.style.pointerEvents = 'none';

        const overlays = new Map();
        const loadedChunkIds = new Set();
        const sourceZoom = Number(manifest.source?.zoom ?? 19);
        const previousMinZoom = Number(map.getMinZoom?.());
        const configuredMinZoom = Number(minZoom);
        const townMinZoom = Math.max(
            Number.isFinite(previousMinZoom) ? previousMinZoom : FIXED_TOWN_SURFACE_MIN_ZOOM,
            Number.isFinite(configuredMinZoom) ? configuredMinZoom : FIXED_TOWN_SURFACE_MIN_ZOOM,
        );
        const surfaceBounds = toLeafletBounds(manifest.bounds?.surface || manifest.bounds?.nominal);
        const attribution = String(manifest.attribution?.html || '').trim();
        let backdrop = null;
        let frame = null;
        let disposed = false;
        let failed = false;
        let zooming = false;
        let pruneRequested = false;
        let pruneTimeout = null;

        if (lockMinZoom) {
            map.setMinZoom(townMinZoom);
            if (Number(map.getZoom()) < townMinZoom) {
                map.setView(map.getCenter(), townMinZoom, { animate: false });
            }
        }

        if (surfaceBounds) {
            backdrop = L.rectangle(surfaceBounds, {
                pane: FIXED_TOWN_SURFACE_BACKDROP_PANE,
                stroke: false,
                fill: true,
                fillColor: grayscale
                    ? '#f3f4f6'
                    : (manifest.presentation?.backgroundColor || '#f4f2ed'),
                fillOpacity: 1,
                interactive: false,
            }).addTo(map);
        }

        if (attribution && map.attributionControl) {
            map.attributionControl.addAttribution(attribution);
        }

        const emitMetrics = () => {
            const visibleChunks = [...overlays.values()].map(({ chunk }) => chunk);
            onMetricsChangeRef.current?.({
                zoom: Number(map.getZoom()),
                visibleChunkCount: visibleChunks.length,
                loadedChunkCount: loadedChunkIds.size,
                visibleTransferBytes: visibleChunks.reduce((sum, chunk) => sum + Number(chunk.byteSize || 0), 0),
                visibleDecodedBytes: getDecodedBytes(visibleChunks),
            });
        };

        const removeOverlay = (chunkId) => {
            const entry = overlays.get(chunkId);
            if (!entry) return;
            map.removeLayer(entry.overlay);
            entry.overlay.off();
            overlays.delete(chunkId);
            loadedChunkIds.delete(chunkId);
        };

        const removeAllOverlays = () => {
            [...overlays.keys()].forEach(removeOverlay);
            emitMetrics();
        };

        const fallback = (reason, details = {}) => {
            if (failed || disposed) return;
            failed = true;
            removeAllOverlays();
            onFallbackRef.current?.({ reason, ...details });
        };

        const reconcile = ({ pruneOffscreen = false } = {}) => {
            frame = null;
            if (disposed || failed) return;

            const zoom = Number(map.getZoom());
            if (!isFixedTownSurfaceZoomEligible(zoom, townMinZoom)) {
                if (pruneOffscreen) {
                    if (fallbackBelowMinZoom) {
                        fallback('zoom-too-low', { zoom, minZoom: townMinZoom });
                    } else {
                        removeAllOverlays();
                    }
                }
                return;
            }

            const viewportBounds = getViewportBounds(map);
            const visibleChunks = selectVisibleFixedTownChunks(manifest.chunks, viewportBounds);
            if (!visibleChunks.length) {
                if (pruneOffscreen) fallback('outside-surface');
                return;
            }
            const visibleDecodedBytes = getDecodedBytes(visibleChunks);
            if (visibleDecodedBytes > FIXED_TOWN_SURFACE_MAX_DECODED_BYTES) {
                fallback('viewport-memory-limit', {
                    zoom,
                    visibleChunkCount: visibleChunks.length,
                    visibleDecodedBytes,
                });
                return;
            }

            const visibleIds = new Set(visibleChunks.map((chunk) => String(chunk.id)));
            if (zooming) {
                const nextActiveChunks = new Map(
                    [...overlays.entries()].map(([chunkId, { chunk }]) => [chunkId, chunk]),
                );
                visibleChunks.forEach((chunk) => nextActiveChunks.set(String(chunk.id), chunk));
                if (
                    getDecodedBytes([...nextActiveChunks.values()])
                    > FIXED_TOWN_SURFACE_MAX_DECODED_BYTES
                ) {
                    [...overlays.keys()].forEach((chunkId) => {
                        if (!visibleIds.has(chunkId)) removeOverlay(chunkId);
                    });
                }
            }
            if (pruneOffscreen || !zooming) {
                const retentionPad = zoom <= townMinZoom + FIXED_TOWN_SURFACE_LOW_ZOOM_RANGE
                    ? 0
                    : FIXED_TOWN_SURFACE_RETENTION_PAD;
                const paddedChunks = pruneOffscreen || retentionPad === 0
                    ? visibleChunks
                    : selectVisibleFixedTownChunks(
                        manifest.chunks,
                        getViewportBounds(map, retentionPad),
                    );
                const retainedChunks = getDecodedBytes(paddedChunks)
                    <= FIXED_TOWN_SURFACE_MAX_DECODED_BYTES
                    ? paddedChunks
                    : visibleChunks;
                const retainedIds = new Set(retainedChunks.map((chunk) => String(chunk.id)));
                [...overlays.keys()].forEach((chunkId) => {
                    if (!retainedIds.has(chunkId)) removeOverlay(chunkId);
                });
            }

            visibleChunks.forEach((chunk) => {
                const chunkId = String(chunk.id);
                const renderBounds = getChunkRenderBounds(map, chunk, sourceZoom);
                if (!renderBounds) {
                    fallback('invalid-chunk-bounds', { chunkId });
                    return;
                }

                const existing = overlays.get(chunkId);
                if (existing) {
                    existing.overlay.setBounds(renderBounds);
                    return;
                }

                const overlay = L.imageOverlay(
                    resolveFixedTownChunkUrl(assetBaseUrl, chunk.url),
                    renderBounds,
                    {
                        pane: FIXED_TOWN_SURFACE_PANE,
                        interactive: false,
                        opacity: 1,
                        crossOrigin: true,
                        alt: '',
                        className: 'fixed-town-surface__chunk',
                    },
                );

                overlay.on('load', () => {
                    if (disposed || failed) return;
                    loadedChunkIds.add(chunkId);
                    emitMetrics();
                });
                overlay.on('error', () => fallback('chunk-load-error', { chunkId }));
                overlays.set(chunkId, { chunk, overlay });
                overlay.addTo(map);
                const overlayElement = overlay.getElement();
                if (grayscale && overlayElement) {
                    overlayElement.style.filter = 'grayscale(1)';
                }
            });

            emitMetrics();
        };

        const scheduleReconcile = (shouldPrune = false) => {
            if (disposed || failed) return;
            pruneRequested = pruneRequested || shouldPrune;
            if (frame !== null) return;
            frame = window.requestAnimationFrame(() => {
                const pruneOffscreen = pruneRequested;
                pruneRequested = false;
                reconcile({ pruneOffscreen });
            });
        };

        const handleMapMove = () => {
            if (pruneTimeout !== null) {
                window.clearTimeout(pruneTimeout);
                pruneTimeout = null;
            }
            scheduleReconcile(false);
        };
        const handleMapMoveEnd = () => {
            if (pruneTimeout !== null) window.clearTimeout(pruneTimeout);
            pruneTimeout = window.setTimeout(() => {
                pruneTimeout = null;
                scheduleReconcile(true);
            }, FIXED_TOWN_SURFACE_PRUNE_SETTLE_MS);
        };
        const handleMapResize = () => {
            handleMapMove();
            handleMapMoveEnd();
        };
        const handleMapZoomStart = () => {
            zooming = true;
            handleMapMove();
        };
        const handleMapZoomEnd = () => {
            zooming = false;
            handleMapMoveEnd();
        };

        map.on('move zoom', handleMapMove);
        map.on('moveend', handleMapMoveEnd);
        map.on('zoomstart', handleMapZoomStart);
        map.on('zoomend', handleMapZoomEnd);
        map.on('resize', handleMapResize);
        scheduleReconcile(true);

        return () => {
            disposed = true;
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
                frame = null;
            }
            if (pruneTimeout !== null) {
                window.clearTimeout(pruneTimeout);
                pruneTimeout = null;
            }
            map.off('move zoom', handleMapMove);
            map.off('moveend', handleMapMoveEnd);
            map.off('zoomstart', handleMapZoomStart);
            map.off('zoomend', handleMapZoomEnd);
            map.off('resize', handleMapResize);
            [...overlays.keys()].forEach(removeOverlay);
            if (backdrop) map.removeLayer(backdrop);
            if (attribution && map.attributionControl) {
                map.attributionControl.removeAttribution(attribution);
            }
            if (lockMinZoom && Number.isFinite(previousMinZoom)) map.setMinZoom(previousMinZoom);
        };
    }, [assetBaseUrl, fallbackBelowMinZoom, grayscale, lockMinZoom, manifest, map, minZoom]);

    return null;
}
