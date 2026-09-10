import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LoaderCircle, Minus, Plus } from 'lucide-react';

import OneMapBadge from '../../components/OneMapBadge.jsx';
import MapSettingsControl from '../../components/MapSettingsControl.jsx';
import TownMapModeControl from '../../components/TownMapModeControl.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useMapStyle } from '../../contexts/MapStyleContext.jsx';
import homeAnchorImage from '../../assets/home-anchor.png';
import DiscoverDetailedBasemap, { DISCOVER_DETAILED_MAP_ENABLED } from './DiscoverDetailedBasemap.jsx';
import { DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM } from './discoverDetailedMap.js';
import { createPostalGroupParentPinIcon, createSavedPlacePinIcon } from './discoverUtils.js';
import {
    CAREAROUND_BASEMAP_ATTRIBUTION,
    CAREAROUND_BASEMAP_MAX_ZOOM,
    CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_MIN_ZOOM,
    CAREAROUND_BASEMAP_NATIVE_ZOOM,
    getCareAroundBasemapUrl,
} from '../../lib/mapTheme.js';
import {
    HALF_STEP_MAP_ZOOM_DELTA,
    formatMapZoomLevel,
    resolveResponsiveMapMinimumZoom,
    resolveTopAlignedMapCenterPoint,
} from '../../lib/mapZoom.js';

const DEFAULT_MAP_CENTER = [1.3521, 103.8198];
const DEFAULT_MAP_ZOOM = 12;
// Keep Discover fitBounds on fractional zoom steps. Whole-step zoom snapping caused UAT-visible jumps.
const DISCOVER_ZOOM_SNAP = 0.1;
const DISCOVER_OVERVIEW_MIN_ZOOM = 10;
const DISCOVER_OVERVIEW_MAX_ZOOM = 11.5;
const DISCOVER_OVERVIEW_WIDE_MAP_WIDTH = 900;
const DISCOVER_OVERVIEW_WIDE_MAP_HEIGHT = 500;
const DISCOVER_OVERVIEW_PADDING = [16, 16];
const DISCOVER_SINGAPORE_OVERVIEW_CENTER = [1.3521, 103.846];
const DISCOVER_SINGAPORE_OVERVIEW_BOUNDS = [
    [1.1589785722368189, 103.49945068359375],
    [1.5626114277758696, 104.117431640625],
];
// OneMap's first visible overview row begins at the native z12 row-2031 edge.
const DISCOVER_BASEMAP_VISIBLE_NORTH_EDGE = [1.4939713066293197, 103.846];
const DISCOVER_DEFAULT_SEA_BACKGROUND = '#6da8e4';
const DISCOVER_GRAY_SEA_BACKGROUND = '#cfd5dc';
const SINGLE_PIN_ZOOM = CAREAROUND_BASEMAP_MAX_ZOOM;
const ANCHOR_ONLY_ZOOM = 15;
const DESKTOP_FIT_MAX_ZOOM = CAREAROUND_BASEMAP_MAX_ZOOM;
const MOBILE_FIT_MAX_ZOOM = 18;
const DESKTOP_GROUP_FOCUS_MAX_ZOOM = 17;
const DESKTOP_FIT_PADDING_TOP_LEFT = [44, 60];
const DESKTOP_FIT_PADDING_BOTTOM_RIGHT = [18, 18];
const DESKTOP_ANCHOR_FIT_PADDING_TOP_LEFT = [24, 24];
const DESKTOP_ANCHOR_FIT_PADDING_BOTTOM_RIGHT = [40, 60];
const DESKTOP_GROUP_FOCUS_PADDING_TOP_LEFT = [40, 40];
const DESKTOP_GROUP_FOCUS_PADDING_BOTTOM_RIGHT = [40, 40];
const MOBILE_FIT_PADDING_TOP_LEFT = [60, 60];
const MOBILE_FIT_PADDING_BOTTOM_RIGHT = [112, 72];
const MOBILE_ANCHOR_FIT_PADDING_TOP_LEFT = [20, 60];
const MOBILE_ANCHOR_FIT_PADDING_BOTTOM_RIGHT = [88, 92];
const SINGLE_PIN_FOCUS_NOOP_DISTANCE_PX = 4;
const SINGLE_PIN_FOCUS_SETTLE_DISTANCE_PX = 22;
const SINGLE_PIN_FOCUS_SETTLE_ZOOM_DELTA = 0.18;

function renderLocationAnchorGlyph(isHome) {
    if (isHome) {
        return `
            <img
                src="${homeAnchorImage}"
                alt=""
                style="width:36px;height:36px;display:block;filter:drop-shadow(0 12px 20px rgba(15,118,110,0.24));"
            />
        `;
    }

    return `
        <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true" style="display:block;">
            <path d="M12 20.5c-.28 0-.56-.09-.78-.27C7.12 16.79 4 14.17 4 10.58 4 8.23 5.9 6.33 8.25 6.33c1.5 0 2.92.77 3.75 2.01.83-1.24 2.25-2.01 3.75-2.01C18.1 6.33 20 8.23 20 10.58c0 3.59-3.12 6.21-7.22 9.65-.22.18-.5.27-.78.27Z" fill="#f35f68" />
        </svg>
    `;
}

function createLocationAnchorIcon(anchorPoint = null) {
    const isHome = anchorPoint?.source === 'home' || anchorPoint?.kind === 'home';
    const ringColor = '#0f766e';
    const shellColor = '#ffffff';
    const haloColor = isHome ? 'rgba(249,115,22,0.34)' : 'rgba(249,115,22,0.28)';
    const pinScale = isHome ? 1.04 : 1;
    const pulseBump = isHome ? 0.09 : 0.08;
    const coreSize = isHome ? 38 : 34;
    const topOffset = isHome ? 4 : 6;

    return L.divIcon({
        className: '',
        html: `
            <div
                aria-hidden="true"
                class="saved-place-pin-marker saved-place-pin-marker--primary saved-place-pin-marker--location-anchor"
                style="
                    position:relative;
                    width:52px;
                    height:58px;
                    overflow:visible;
                    pointer-events:none;
                    --saved-pin-scale:${pinScale};
                    --saved-pin-pulse-bump:${pulseBump};
                    --saved-pin-halo-color:${haloColor};
                "
            >
                <div
                    class="saved-place-pin-marker__pin"
                    style="position:absolute;inset:0;z-index:1;display:flex;align-items:flex-start;justify-content:center;padding-top:${topOffset}px;"
                >
                    <div
                        style="
                            width:${coreSize}px;
                            height:${coreSize}px;
                            border-radius:999px;
                            background:${shellColor};
                            ${isHome ? '' : `border:4px solid ${ringColor};box-shadow:0 12px 24px rgba(15,118,110,0.24);`}
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            overflow:visible;
                        "
                    >
                        ${renderLocationAnchorGlyph(isHome)}
                    </div>
                </div>
            </div>
        `,
        iconSize: [52, 58],
        iconAnchor: [26, 23],
        popupAnchor: [0, -24],
    });
}

function buildPinSignature(savedPlacePins = []) {
    return savedPlacePins
        .map((pin) => `${pin.pinKey}:${pin.lat}:${pin.lng}`)
        .sort()
        .join('|');
}

function buildAnchorSignature(anchorPoint = null) {
    if (!anchorPoint) return '';
    return [
        anchorPoint.kind || anchorPoint.source || 'anchor',
        anchorPoint.postalCode || '',
        anchorPoint.lat,
        anchorPoint.lng,
    ].join(':');
}

function getCameraPoints(savedPlacePins = [], anchorPoint = null, { includeAnchorInBounds = true } = {}) {
    const points = savedPlacePins.map((pin) => [pin.lat, pin.lng]);
    if (anchorPoint && includeAnchorInBounds) {
        points.push([anchorPoint.lat, anchorPoint.lng]);
    }
    return points;
}

function getFitConfig(interactionMode, hasAnchor = false) {
    if (interactionMode === 'desktop') {
        return {
            maxZoom: DESKTOP_FIT_MAX_ZOOM,
            paddingTopLeft: DESKTOP_FIT_PADDING_TOP_LEFT,
            paddingBottomRight: DESKTOP_FIT_PADDING_BOTTOM_RIGHT,
        };
    }

    return {
        maxZoom: MOBILE_FIT_MAX_ZOOM,
        paddingTopLeft: MOBILE_FIT_PADDING_TOP_LEFT,
        paddingBottomRight: MOBILE_FIT_PADDING_BOTTOM_RIGHT,
    };
}

function getAnchorViewportPadding(interactionMode) {
    if (interactionMode === 'desktop') {
        return {
            paddingTopLeft: DESKTOP_ANCHOR_FIT_PADDING_TOP_LEFT,
            paddingBottomRight: DESKTOP_ANCHOR_FIT_PADDING_BOTTOM_RIGHT,
        };
    }

    return {
        paddingTopLeft: MOBILE_ANCHOR_FIT_PADDING_TOP_LEFT,
        paddingBottomRight: MOBILE_ANCHOR_FIT_PADDING_BOTTOM_RIGHT,
    };
}

function queueAnchorVisibilityPan(map, anchorPoint, interactionMode) {
    if (!anchorPoint) return;

    const anchorLatLng = L.latLng(anchorPoint.lat, anchorPoint.lng);
    const anchorPadding = getAnchorViewportPadding(interactionMode);

    map.once('moveend', () => {
        map.panInside(anchorLatLng, {
            animate: true,
            duration: 0.28,
            paddingTopLeft: anchorPadding.paddingTopLeft,
            paddingBottomRight: anchorPadding.paddingBottomRight,
        });
    });
}

function fitCameraTargets(
    map,
    savedPlacePins,
    anchorPoint,
    interactionMode,
    { includeAnchorInBounds = true, keepAnchorVisible = true } = {},
) {
    const size = map.getSize();
    if (!size?.x || !size?.y) {
        map.invalidateSize(false);
        return false;
    }

    if (savedPlacePins.length === 1 && !anchorPoint) {
        const [pin] = savedPlacePins;
        map.flyTo([pin.lat, pin.lng], SINGLE_PIN_ZOOM, { animate: true, duration: 0.8 });
        return true;
    }

    if (!savedPlacePins.length && anchorPoint) {
        map.flyTo([anchorPoint.lat, anchorPoint.lng], anchorPoint.zoom ?? ANCHOR_ONLY_ZOOM, {
            animate: true,
            duration: 0.8,
        });
        return true;
    }

    const points = getCameraPoints(savedPlacePins, anchorPoint, { includeAnchorInBounds });
    if (!points.length) return false;

    const bounds = L.latLngBounds(points);
    const fitConfig = getFitConfig(interactionMode);
    if (keepAnchorVisible) {
        queueAnchorVisibilityPan(map, anchorPoint, interactionMode);
    }
    map.flyToBounds(bounds, {
        animate: true,
        duration: 0.8,
        paddingTopLeft: fitConfig.paddingTopLeft,
        paddingBottomRight: fitConfig.paddingBottomRight,
        maxZoom: fitConfig.maxZoom,
    });

    return true;
}

function focusMapRequest(map, focusRequest, interactionMode) {
    if (!focusRequest) return true;

    const size = map.getSize();
    if (!size?.x || !size?.y) {
        map.invalidateSize(false);
        return false;
    }

    if (focusRequest.kind === 'single-pin') {
        const zoom = focusRequest.zoom ?? SINGLE_PIN_ZOOM;
        const offsetPx = focusRequest.offsetPx || null;
        let targetCenter = L.latLng(focusRequest.lat, focusRequest.lng);

        if (offsetPx && (offsetPx.x || offsetPx.y)) {
            const targetPoint = map.project([focusRequest.lat, focusRequest.lng], zoom);
            const offsetPoint = L.point(offsetPx.x || 0, offsetPx.y || 0);
            targetCenter = map.unproject(targetPoint.subtract(offsetPoint), zoom);
        }

        const currentCenterPoint = map.project(map.getCenter(), zoom);
        const targetCenterPoint = map.project(targetCenter, zoom);
        const distancePx = currentCenterPoint.distanceTo(targetCenterPoint);
        const zoomDelta = Math.abs(map.getZoom() - zoom);

        if (distancePx <= SINGLE_PIN_FOCUS_NOOP_DISTANCE_PX && zoomDelta <= 0.01) {
            return true;
        }

        map.stop();

        if (distancePx <= SINGLE_PIN_FOCUS_SETTLE_DISTANCE_PX && zoomDelta <= SINGLE_PIN_FOCUS_SETTLE_ZOOM_DELTA) {
            map.setView(targetCenter, zoom, {
                animate: false,
            });
            return true;
        }

        map.flyTo(targetCenter, zoom, {
            animate: true,
            duration: 0.55,
        });
        return true;
    }

    if (focusRequest.kind === 'saved-fit') {
        return fitCameraTargets(
            map,
            focusRequest.savedPlacePins || [],
            focusRequest.anchorPoint || null,
            interactionMode,
            {
                includeAnchorInBounds: focusRequest.includeAnchorInBounds ?? false,
                keepAnchorVisible: focusRequest.keepAnchorVisible ?? true,
            },
        );
    }

    const fitConfig = getFitConfig(interactionMode);
    const isDesktopGroupFocus = interactionMode === 'desktop' && focusRequest.kind === 'pin-group';
    const paddingTopLeft = isDesktopGroupFocus ? DESKTOP_GROUP_FOCUS_PADDING_TOP_LEFT : fitConfig.paddingTopLeft;
    const paddingBottomRight = isDesktopGroupFocus ? DESKTOP_GROUP_FOCUS_PADDING_BOTTOM_RIGHT : fitConfig.paddingBottomRight;
    const maxZoom = isDesktopGroupFocus
        ? Math.min(focusRequest.maxZoom ?? DESKTOP_GROUP_FOCUS_MAX_ZOOM, DESKTOP_GROUP_FOCUS_MAX_ZOOM)
        : (focusRequest.maxZoom ?? fitConfig.maxZoom);
    const bounds = L.latLngBounds(focusRequest.points);
    map.flyToBounds(bounds, {
        animate: true,
        duration: 0.8,
        paddingTopLeft,
        paddingBottomRight,
        maxZoom,
    });
    return true;
}

function SavedMapCameraController({ baseAnchorPoint = null, focusRequest, interactionMode, layoutSignature = 'default', savedPlacePins }) {
    const map = useMap();
    const lastFitSignatureRef = useRef('');
    const lastSavedSignatureRef = useRef('');
    const lastFocusRequestIdRef = useRef(null);
    const lastLayoutSignatureRef = useRef(layoutSignature);
    const suppressInitialFitRef = useRef(false);

    useEffect(() => {
        const nextSignature = `${buildPinSignature(savedPlacePins)}|${buildAnchorSignature(baseAnchorPoint)}`;
        if (nextSignature !== lastSavedSignatureRef.current) {
            lastSavedSignatureRef.current = nextSignature;
            lastFitSignatureRef.current = '';
            suppressInitialFitRef.current = false;
        }

        if (!savedPlacePins.length && !baseAnchorPoint) {
            lastFitSignatureRef.current = '';
            lastSavedSignatureRef.current = '';
            suppressInitialFitRef.current = false;
        }
    }, [baseAnchorPoint, savedPlacePins]);

    useEffect(() => {
        if (!focusRequest) return;
        if (focusRequest.requestId === lastFocusRequestIdRef.current) return;

        lastFocusRequestIdRef.current = focusRequest.requestId;
        suppressInitialFitRef.current = true;

        let frameId = null;

        const attemptFocus = () => {
            if (focusMapRequest(map, focusRequest, interactionMode)) {
                return;
            }

            frameId = window.requestAnimationFrame(attemptFocus);
        };

        attemptFocus();

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [focusRequest, interactionMode, map]);

    useEffect(() => {
        if (!savedPlacePins.length && !baseAnchorPoint) return;
        if (suppressInitialFitRef.current) return;

        const nextSignature = `${buildPinSignature(savedPlacePins)}|${buildAnchorSignature(baseAnchorPoint)}`;
        if (!nextSignature || nextSignature === lastFitSignatureRef.current) return;

        let frameId = null;

        const attemptFit = () => {
            if (fitCameraTargets(map, savedPlacePins, baseAnchorPoint, interactionMode, {
                includeAnchorInBounds: false,
                keepAnchorVisible: false,
            })) {
                lastFitSignatureRef.current = nextSignature;
                return;
            }

            frameId = window.requestAnimationFrame(attemptFit);
        };

        attemptFit();

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [baseAnchorPoint, interactionMode, map, savedPlacePins]);

    useEffect(() => {
        if (layoutSignature === lastLayoutSignatureRef.current) return undefined;

        lastLayoutSignatureRef.current = layoutSignature;

        if (!savedPlacePins.length && !baseAnchorPoint && !focusRequest) {
            return undefined;
        }

        let frameOneId = null;
        let frameTwoId = null;

        const reapplyCamera = () => {
            map.invalidateSize(false);

            frameTwoId = window.requestAnimationFrame(() => {
                if (focusRequest) {
                    focusMapRequest(map, focusRequest, interactionMode);
                    return;
                }

                fitCameraTargets(map, savedPlacePins, baseAnchorPoint, interactionMode, {
                    includeAnchorInBounds: false,
                    keepAnchorVisible: false,
                });
            });
        };

        frameOneId = window.requestAnimationFrame(reapplyCamera);

        return () => {
            if (frameOneId !== null) {
                window.cancelAnimationFrame(frameOneId);
            }
            if (frameTwoId !== null) {
                window.cancelAnimationFrame(frameTwoId);
            }
        };
    }, [baseAnchorPoint, focusRequest, interactionMode, layoutSignature, map, savedPlacePins]);

    return null;
}

function MapBackgroundEvents({ enabled = true, onBackgroundClick, onMapMoveEnd }) {
    useMapEvents({
        click(event) {
            const clickTarget = event.originalEvent?.target;
            if (
                clickTarget instanceof Element
                && (clickTarget.closest('.saved-place-pin-marker') || clickTarget.closest('.leaflet-marker-icon'))
            ) {
                return;
            }
            if (enabled) {
                onBackgroundClick?.();
            }
        },
        moveend(event) {
            const map = event.target;
            const center = map.getCenter();
            const bounds = map.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            // Estimate radius in km (using rough lat degree length ~111km)
            const radius = Math.round(Math.min(
                100, // Cap at 100km
                Math.max(
                    0.2, // Min 200m
                    (ne.lat - sw.lat) * 111 / 2
                )
            ) * 10) / 10;
            onMapMoveEnd?.({ lat: center.lat, lng: center.lng, radius });
        }
    });

    return null;
}

function TrackedPinLayoutReporter({ trackedPinKey = null, pins = [], onTrackedPinLayoutChange }) {
    const map = useMap();
    const pinLookup = useMemo(() => new Map((pins || []).map((pin) => [pin.pinKey, pin])), [pins]);

    useEffect(() => {
        if (!onTrackedPinLayoutChange) return undefined;

        const emitLayout = () => {
            if (!trackedPinKey) {
                onTrackedPinLayoutChange(null);
                return;
            }

            const pin = pinLookup.get(trackedPinKey);
            if (!pin) {
                onTrackedPinLayoutChange(null);
                return;
            }

            const point = map.latLngToContainerPoint([pin.displayLat ?? pin.lat, pin.displayLng ?? pin.lng]);
            const size = map.getSize();

            onTrackedPinLayoutChange({
                pinKey: trackedPinKey,
                x: point.x,
                y: point.y,
                width: size.x,
                height: size.y,
            });
        };

        emitLayout();
        map.on('move', emitLayout);
        map.on('zoom', emitLayout);
        map.on('resize', emitLayout);

        return () => {
            map.off('move', emitLayout);
            map.off('zoom', emitLayout);
            map.off('resize', emitLayout);
        };
    }, [map, onTrackedPinLayoutChange, pinLookup, trackedPinKey]);

    return null;
}

function DiscoveryMinimumZoomLock() {
    const map = useMap();

    useLayoutEffect(() => {
        const bounds = L.latLngBounds(DISCOVER_SINGAPORE_OVERVIEW_BOUNDS);
        const minimumCenter = L.latLng(DISCOVER_SINGAPORE_OVERVIEW_CENTER);
        const container = map.getContainer();
        let minimumZoom = DISCOVER_OVERVIEW_MIN_ZOOM;
        let draggingDisabledByLock = false;
        let centering = false;
        let resizeFrame = null;

        const restoreDragging = () => {
            if (!draggingDisabledByLock) return;
            map.dragging?.enable?.();
            draggingDisabledByLock = false;
        };
        const resolveMinimumCenter = (zoom = map.getZoom()) => {
            const viewportSize = map.getSize();
            const horizontalCenterPoint = map.project(minimumCenter, zoom);
            const coverageNorthPoint = map.project(L.latLng(DISCOVER_BASEMAP_VISIBLE_NORTH_EDGE), zoom);
            const alignedCenterPoint = resolveTopAlignedMapCenterPoint({
                horizontalCenterPoint,
                coverageNorthPoint,
                viewportHeight: viewportSize.y,
            });

            return alignedCenterPoint
                ? map.unproject(L.point(alignedCenterPoint.x, alignedCenterPoint.y), zoom)
                : minimumCenter;
        };
        const centerMinimumCamera = ({ onlyRemoveTopGap = false } = {}) => {
            if (centering) return;
            const currentCenter = map.getCenter();
            const zoom = map.getZoom();
            const currentPoint = map.project(currentCenter, zoom);
            const topAlignedMinimumCenter = resolveMinimumCenter(zoom);
            const minimumPoint = map.project(topAlignedMinimumCenter, zoom);
            if (onlyRemoveTopGap) {
                // Fractional tablet fits can settle just above the responsive floor.
                // Remove only exposed northern canvas and retain the fitted longitude.
                if (currentPoint.y >= minimumPoint.y - 1) return;
                minimumPoint.x = currentPoint.x;
            }
            if (currentPoint.distanceTo(minimumPoint) <= 1) return;
            centering = true;
            map.panTo(map.unproject(minimumPoint, zoom), { animate: false });
            centering = false;
        };
        const syncLock = () => {
            const atMinimum = Number(map.getZoom()) <= minimumZoom + 0.01;
            if (!atMinimum) {
                restoreDragging();
                if (Number(map.getZoom()) < DEFAULT_MAP_ZOOM) {
                    centerMinimumCamera({ onlyRemoveTopGap: true });
                }
                return;
            }
            if (map.dragging?.enabled?.()) {
                map.dragging.disable();
                draggingDisabledByLock = true;
            }
            centerMinimumCamera();
        };
        const resolveMinimumZoom = () => {
            const size = map.getSize();
            if (size.x >= DISCOVER_OVERVIEW_WIDE_MAP_WIDTH && size.y >= DISCOVER_OVERVIEW_WIDE_MAP_HEIGHT) {
                return DISCOVER_OVERVIEW_MAX_ZOOM;
            }
            return resolveResponsiveMapMinimumZoom({
                fitZoom: map.getBoundsZoom(bounds, false, L.point(DISCOVER_OVERVIEW_PADDING)),
                minimumZoom: DISCOVER_OVERVIEW_MIN_ZOOM,
                maximumZoom: DISCOVER_OVERVIEW_MAX_ZOOM,
            }) ?? DISCOVER_OVERVIEW_MIN_ZOOM;
        };
        const applyMinimumZoom = () => {
            minimumZoom = resolveMinimumZoom();
            map.setMinZoom(minimumZoom);
            container.dataset.discoverMinZoom = String(minimumZoom);
            if (Number(map.getZoom()) < minimumZoom - 0.01) {
                map.setView(resolveMinimumCenter(minimumZoom), minimumZoom, { animate: false });
            }
            syncLock();
        };
        const scheduleMinimumZoom = () => {
            if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(() => {
                resizeFrame = null;
                applyMinimumZoom();
            });
        };

        applyMinimumZoom();
        map.on('zoomend', syncLock);
        map.on('moveend', syncLock);
        map.on('resize', scheduleMinimumZoom);

        return () => {
            if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
            map.off('zoomend', syncLock);
            map.off('moveend', syncLock);
            map.off('resize', scheduleMinimumZoom);
            map.setMinZoom(CAREAROUND_BASEMAP_MIN_ZOOM);
            restoreDragging();
            delete container.dataset.discoverMinZoom;
        };
    }, [map]);

    return null;
}

function readDiscoveryZoomState(map) {
    const zoom = Number(map.getZoom());
    const minZoom = Number(map.getMinZoom());
    const maxZoom = Number(map.getMaxZoom());
    return {
        label: formatMapZoomLevel(zoom),
        canZoomOut: Number.isFinite(zoom) && Number.isFinite(minZoom) ? zoom > minZoom + 0.01 : true,
        canZoomIn: Number.isFinite(zoom) && Number.isFinite(maxZoom) ? zoom < maxZoom - 0.01 : true,
    };
}

function DiscoveryMapControlStack({ canReset = false, onResetView }) {
    const map = useMap();
    const { t } = useLocale();
    const [zoomState, setZoomState] = useState(() => readDiscoveryZoomState(map));

    useEffect(() => {
        const updateZoomLevel = () => setZoomState(readDiscoveryZoomState(map));

        updateZoomLevel();
        map.on('zoom', updateZoomLevel);
        map.on('zoomlevelschange', updateZoomLevel);
        return () => {
            map.off('zoom', updateZoomLevel);
            map.off('zoomlevelschange', updateZoomLevel);
        };
    }, [map]);

    const desktopZoomRailDepth = canReset ? 'two' : 'one';

    return (
        <>
            <div className={`carearound-discovery-zoom-control carearound-discovery-zoom-control--${desktopZoomRailDepth} leaflet-top leaflet-left z-[1000] pointer-events-auto absolute`}>
                <div className="leaflet-control leaflet-bar m-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:rounded-[10px]">
                    <div
                        role="status"
                        aria-live="polite"
                        aria-label={zoomState.label === '—' ? 'Zoom level unavailable' : `Zoom level ${zoomState.label}`}
                        data-map-zoom-level="true"
                        className="flex h-[22px] w-[30px] select-none items-center justify-center border-b border-slate-200 bg-white text-[10px] font-extrabold tabular-nums leading-none text-slate-500 lg:h-6 lg:w-8 lg:text-[10px]"
                        title="Current zoom level"
                    >
                        {zoomState.label}
                    </div>
                    <button
                        type="button"
                        title={t('mapZoomIn')}
                        aria-label={t('mapZoomIn')}
                        disabled={!zoomState.canZoomIn}
                        className="flex h-[30px] w-[30px] touch-manipulation items-center justify-center border-b border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 lg:h-8 lg:w-8"
                        onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            map.zoomIn(HALF_STEP_MAP_ZOOM_DELTA);
                        }}
                    >
                        <Plus size={15} className="lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        title={t('mapZoomOut')}
                        aria-label={t('mapZoomOut')}
                        disabled={!zoomState.canZoomOut}
                        className="flex h-[30px] w-[30px] touch-manipulation items-center justify-center bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 lg:h-8 lg:w-8"
                        onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            map.zoomOut(HALF_STEP_MAP_ZOOM_DELTA);
                        }}
                    >
                        <Minus size={15} className="lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
                    </button>
                </div>
            </div>
            {canReset ? (
                <div className="carearound-discovery-recenter-control leaflet-top leaflet-right z-[1000] pointer-events-auto absolute">
                    <div className="leaflet-control leaflet-bar border-none shadow-none mt-0 mr-0">
                        <button
                            type="button"
                            title={t('mapResetView')}
                            aria-label={t('mapResetView')}
                            className="flex h-[30px] w-[30px] touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 lg:h-[34px] lg:w-[34px] lg:rounded-[10px]"
                            onClick={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                onResetView?.();
                            }}
                        >
                            <svg className="h-[15px] w-[15px] lg:h-[18px] lg:w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7M15 21h6v-6M9 3H3v6M21 21l-7-7M3 3l7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function getDiscoverDetailedStatusMessage(status) {
    if (!status?.requested) return '';
    if (status.loading) return 'Loading the Detailed map. You can keep using the regular map.';
    if (status.reason === 'zoom-below-detailed') {
        return `Zoom in to level ${DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM}. Detailed will turn on automatically.`;
    }
    if (status.reason === 'outside-coverage') {
        return 'Detailed is not ready for this area. The regular map is still shown here.';
    }
    if (['surface-load-error', 'surface-unavailable', 'viewport-memory-limit', 'manifest-unavailable'].includes(status.reason)) {
        return 'Detailed could not load. The regular map is still shown.';
    }
    return '';
}

function DiscoverDetailedLoadingIndicator({ status }) {
    if (!status?.requested || !status.loading) return null;
    const visibleCount = Number(status.visibleChunkCount || 0);
    const loadedCount = Number(status.loadedChunkCount || 0);
    const progress = visibleCount > 0
        ? Math.min(100, Math.max(0, Math.round((loadedCount / visibleCount) * 100)))
        : null;

    return (
        <div className="pointer-events-none absolute left-16 right-16 top-3 z-[1001] flex justify-center">
            <div
                role="status"
                aria-live="polite"
                data-discover-detailed-loading="true"
                className="w-full max-w-xs rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur"
            >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <LoaderCircle size={15} className="shrink-0 animate-spin text-brand-600" aria-hidden="true" />
                    <span>Loading detailed map…</span>
                    {progress !== null ? <span className="ml-auto tabular-nums text-slate-500">{progress}%</span> : null}
                </div>
                <div
                    role={progress === null ? undefined : 'progressbar'}
                    aria-label={progress === null ? undefined : 'Detailed map loading progress'}
                    aria-valuemin={progress === null ? undefined : 0}
                    aria-valuemax={progress === null ? undefined : 100}
                    aria-valuenow={progress === null ? undefined : progress}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
                >
                    <div
                        className={`h-full rounded-full bg-brand-500 ${progress === null ? 'w-1/3 animate-pulse' : ''}`}
                        style={progress === null ? undefined : { width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

export function DiscoveryMap({
    cameraAnchor = null,
    focusRequest = null,
    interactionMode = 'desktop',
    layoutSignature = 'default',
    onBackgroundClick,
    onMapHoverEnd,
    onMapHoverStart,
    onMapMoveEnd,
    onResetView,
    onTrackedPinLayoutChange,
    onSelectGroupPin,
    onSelectPin,
    pinEmphasisByKey = new Map(),
    renderedSavedPlacePins = null,
    savedPlacePins,
    trackedPinKey = null,
    transientPlacePins = [],
    userLocation,
}) {
    const { mapStyle } = useMapStyle();
    const [detailedRequested, setDetailedRequested] = useState(true);
    const [detailedStatus, setDetailedStatus] = useState(() => ({
        requested: true,
        enabled: DISCOVER_DETAILED_MAP_ENABLED,
        loading: false,
        mode: 'live',
        tier: 'live',
        reason: 'zoom-below-detailed',
        visibleChunkCount: 0,
        loadedChunkCount: 0,
    }));
    const emphasisLookup = useMemo(() => pinEmphasisByKey, [pinEmphasisByKey]);
    const renderedPins = useMemo(
        () => [...(renderedSavedPlacePins || savedPlacePins), ...transientPlacePins],
        [renderedSavedPlacePins, savedPlacePins, transientPlacePins]
    );
    const canResetMap = Boolean(onResetView && (savedPlacePins.length > 0 || cameraAnchor));
    const mapCanvasBackground = mapStyle === 'gray'
        ? DISCOVER_GRAY_SEA_BACKGROUND
        : DISCOVER_DEFAULT_SEA_BACKGROUND;

    return (
        <div className="relative h-full w-full" style={{ backgroundColor: mapCanvasBackground }}>
            <MapContainer
                center={DEFAULT_MAP_CENTER}
                zoom={DEFAULT_MAP_ZOOM}
                className="carearound-map"
                style={{ width: '100%', height: '100%', zIndex: 0, backgroundColor: mapCanvasBackground }}
                zoomControl={false}
                minZoom={CAREAROUND_BASEMAP_MIN_ZOOM}
                maxZoom={CAREAROUND_BASEMAP_MAX_ZOOM}
                zoomDelta={HALF_STEP_MAP_ZOOM_DELTA}
                zoomSnap={DISCOVER_ZOOM_SNAP}
            >
                <DiscoveryMinimumZoomLock />
                <DiscoverDetailedBasemap
                    detailedRequested={detailedRequested}
                    mapStyle={mapStyle}
                    onStatusChange={setDetailedStatus}
                    liveTiles={(
                        <TileLayer
                            key={`carearound-discover:${mapStyle}`}
                            attribution={CAREAROUND_BASEMAP_ATTRIBUTION}
                            minNativeZoom={CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM}
                            url={getCareAroundBasemapUrl(mapStyle)}
                            maxNativeZoom={CAREAROUND_BASEMAP_NATIVE_ZOOM}
                        />
                    )}
                />
                <SavedMapCameraController
                    baseAnchorPoint={cameraAnchor}
                    focusRequest={focusRequest}
                    interactionMode={interactionMode}
                    layoutSignature={layoutSignature}
                    savedPlacePins={savedPlacePins}
                />
                <TrackedPinLayoutReporter
                    trackedPinKey={trackedPinKey}
                    pins={renderedPins}
                    onTrackedPinLayoutChange={onTrackedPinLayoutChange}
                />
                <MapBackgroundEvents 
                    enabled={Boolean(onBackgroundClick)} 
                    onBackgroundClick={onBackgroundClick} 
                    onMapMoveEnd={onMapMoveEnd}
                />
                <DiscoveryMapControlStack
                    canReset={canResetMap}
                    onResetView={onResetView}
                />
                {renderedPins.map((pin) => {
                    const markerKey = pin.pinKey;
                    const emphasis = emphasisLookup.get(markerKey) || 'default';
                    const isPostalGroup = pin.kind === 'postal-group';
                    const baseZIndexOffset = isPostalGroup ? 800 : (pin.isExpandedChild ? 1000 : 900);
                    const zIndexOffset = emphasis === 'primary'
                        ? baseZIndexOffset + 1200
                        : emphasis === 'related'
                            ? baseZIndexOffset + 600
                            : baseZIndexOffset;
                    const icon = isPostalGroup
                        ? createPostalGroupParentPinIcon({
                            count: pin.hardAssetCount,
                            badgeCount: pin.totalOfferingsCount,
                            emphasis,
                            placeKey: pin.placeKey || pin.pinKey,
                        })
                        : createSavedPlacePinIcon({
                            count: pin.totalOfferingsCount,
                            emphasis,
                            tone: pin.tone || 'saved',
                            iconUrl: pin.categoryIconUrl || null,
                            placeKey: pin.placeKey || pin.pinKey,
                        });

                    return (
                        <Marker
                            key={markerKey}
                            position={[pin.displayLat ?? pin.lat, pin.displayLng ?? pin.lng]}
                            icon={icon}
                            zIndexOffset={zIndexOffset}
                            eventHandlers={{
                                click: (event) => {
                                    event.originalEvent?.stopPropagation?.();
                                    if (isPostalGroup) {
                                        onSelectGroupPin?.(pin);
                                        return;
                                    }
                                    onSelectPin?.(pin);
                                },
                                mouseover: () => {
                                    if (interactionMode === 'desktop') {
                                        onMapHoverStart?.(markerKey, { kind: isPostalGroup ? 'postal-group' : 'place' });
                                    }
                                },
                                mouseout: () => {
                                    if (interactionMode === 'desktop') {
                                        onMapHoverEnd?.(markerKey, { kind: isPostalGroup ? 'postal-group' : 'place' });
                                    }
                                },
                            }}
                        />
                    );
                })}
                {userLocation ? (
                    <Marker
                        position={[userLocation.lat, userLocation.lng]}
                        icon={createLocationAnchorIcon(cameraAnchor || userLocation)}
                        zIndexOffset={1200}
                    >
                        <Popup>
                            <div className="p-1 font-bold text-sm">
                                {cameraAnchor?.source === 'home' ? 'Home postal code' : 'Your Search Location'}
                            </div>
                        </Popup>
                    </Marker>
                ) : null}
            </MapContainer>
            <DiscoverDetailedLoadingIndicator status={detailedStatus} />
            <div className="absolute right-3 top-3 z-[1002]">
                <MapSettingsControl
                    detailedMinZoom={DISCOVER_DETAILED_OVERVIEW_MIN_ZOOM}
                    mapDetailDescription="Choose Standard at any zoom, or Detailed from level 14."
                    mapModeControl={DISCOVER_DETAILED_MAP_ENABLED ? (
                        <TownMapModeControl
                            mode={detailedRequested ? 'town' : 'live'}
                            townAvailable
                            statusMessage={getDiscoverDetailedStatusMessage(detailedStatus)}
                            onModeChange={(mode) => setDetailedRequested(mode === 'town')}
                            variant="panel"
                        />
                    ) : null}
                    showMapStyleControl
                />
            </div>
            <div className="hidden lg:block">
                <OneMapBadge />
            </div>
        </div>
    );
}

export default DiscoveryMap;
