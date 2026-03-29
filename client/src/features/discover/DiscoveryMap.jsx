import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import OneMapBadge from '../../components/OneMapBadge.jsx';
import { createSavedPlacePinIcon } from './discoverUtils.js';
import {
    CAREAROUND_BASEMAP_ATTRIBUTION,
    CAREAROUND_BASEMAP_MAX_ZOOM,
    CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_MIN_ZOOM,
    CAREAROUND_BASEMAP_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_URL,
} from '../../lib/mapTheme.js';

const DEFAULT_MAP_CENTER = [1.3521, 103.8198];
const DEFAULT_MAP_ZOOM = 12;
const SINGLE_PIN_ZOOM = CAREAROUND_BASEMAP_MAX_ZOOM;
const ANCHOR_ONLY_ZOOM = 15;
const DESKTOP_FIT_MAX_ZOOM = CAREAROUND_BASEMAP_MAX_ZOOM;
const MOBILE_FIT_MAX_ZOOM = 18;
const DESKTOP_GROUP_FOCUS_MAX_ZOOM = 17;
const DESKTOP_FIT_PADDING_TOP_LEFT = [24, 24];
const DESKTOP_FIT_PADDING_BOTTOM_RIGHT = [24, 24];
const DESKTOP_GROUP_FOCUS_PADDING_TOP_LEFT = [40, 40];
const DESKTOP_GROUP_FOCUS_PADDING_BOTTOM_RIGHT = [40, 40];
const MOBILE_FIT_PADDING_TOP_LEFT = [16, 56];
const MOBILE_FIT_PADDING_BOTTOM_RIGHT = [16, 24];

function createLocationAnchorIcon(anchorPoint = null) {
    const isHome = anchorPoint?.source === 'home' || anchorPoint?.kind === 'home';
    const ringColor = '#0f766e';
    const shellColor = '#ffffff';
    const glyphColor = '#e11d48';
    const haloColor = isHome ? 'rgba(15,118,110,0.24)' : 'rgba(15,118,110,0.18)';
    const iconSvg = isHome
        ? `
            <svg viewBox="0 0 40 40" width="30" height="30" focusable="false" aria-hidden="true">
                <circle cx="20" cy="20" r="18" fill="${ringColor}" />
                <path d="M11.3 18.9 20 11.7l8.7 7.2c.58.48.24 1.42-.51 1.42h-1.53v8.01c0 .85-.69 1.54-1.54 1.54H14.81c-.85 0-1.54-.69-1.54-1.54v-8.01h-1.46c-.75 0-1.09-.94-.51-1.42Z" fill="${shellColor}" />
                <path d="M24.77 13.35v3.24h3.1v-6.33a1.13 1.13 0 0 0-1.13-1.13H25.9a1.13 1.13 0 0 0-1.13 1.13z" fill="${shellColor}" />
                <path d="M20 25.2c-.27 0-.54-.09-.75-.26-1.59-1.31-2.79-2.34-2.79-3.7a1.93 1.93 0 0 1 3.53-1.08 1.93 1.93 0 0 1 3.54 1.08c0 1.36-1.2 2.39-2.79 3.7-.21.17-.48.26-.74.26Z" fill="${glyphColor}" />
            </svg>
        `
        : `
            <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true">
                <path d="M12 20.5c-.28 0-.56-.09-.78-.27C7.12 16.79 4 14.17 4 10.58 4 8.23 5.9 6.33 8.25 6.33c1.5 0 2.92.77 3.75 2.01.83-1.24 2.25-2.01 3.75-2.01C18.1 6.33 20 8.23 20 10.58c0 3.59-3.12 6.21-7.22 9.65-.22.18-.5.27-.78.27Z" fill="${glyphColor}" />
            </svg>
        `;

    return L.divIcon({
        className: '',
        html: `
            <div aria-hidden="true" style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
                <div style="position:absolute;inset:2px;border-radius:999px;background:${haloColor};"></div>
                <div style="position:relative;z-index:1;width:34px;height:34px;${isHome ? '' : `border-radius:999px;background:${shellColor};border:4px solid ${ringColor};`}box-shadow:0 12px 24px rgba(15,118,110,0.24);display:flex;align-items:center;justify-content:center;overflow:visible;">
                    ${iconSvg}
                </div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
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

function getCameraPoints(savedPlacePins = [], anchorPoint = null) {
    const points = savedPlacePins.map((pin) => [pin.lat, pin.lng]);
    if (anchorPoint) {
        points.push([anchorPoint.lat, anchorPoint.lng]);
    }
    return points;
}

function getFitConfig(interactionMode) {
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

function fitCameraTargets(map, savedPlacePins, anchorPoint, interactionMode) {
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

    const points = getCameraPoints(savedPlacePins, anchorPoint);
    if (!points.length) return false;

    const bounds = L.latLngBounds(points);
    const fitConfig = getFitConfig(interactionMode);
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

        if (offsetPx && (offsetPx.x || offsetPx.y)) {
            const targetPoint = map.project([focusRequest.lat, focusRequest.lng], zoom);
            const offsetPoint = L.point(offsetPx.x || 0, offsetPx.y || 0);
            const targetCenter = map.unproject(targetPoint.subtract(offsetPoint), zoom);

            map.flyTo(targetCenter, zoom, {
                animate: true,
                duration: 0.8,
            });
            return true;
        }

        map.flyTo([focusRequest.lat, focusRequest.lng], zoom, {
            animate: true,
            duration: 0.8,
        });
        return true;
    }

    if (focusRequest.kind === 'saved-fit') {
        return fitCameraTargets(map, focusRequest.savedPlacePins || [], focusRequest.anchorPoint || null, interactionMode);
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

function SavedMapCameraController({ baseAnchorPoint = null, focusRequest, interactionMode, savedPlacePins }) {
    const map = useMap();
    const lastFitSignatureRef = useRef('');
    const lastSavedSignatureRef = useRef('');
    const lastFocusRequestIdRef = useRef(null);
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
            if (fitCameraTargets(map, savedPlacePins, baseAnchorPoint, interactionMode)) {
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

    return null;
}

function MapBackgroundEvents({ enabled = true, onBackgroundClick }) {
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
    });

    return null;
}

export function DiscoveryMap({
    cameraAnchor = null,
    focusRequest = null,
    interactionMode = 'desktop',
    onBackgroundClick,
    onMapHoverEnd,
    onMapHoverStart,
    onSelectPin,
    pinEmphasisByKey = new Map(),
    savedPlacePins,
    transientPlacePins = [],
    userLocation,
}) {
    const emphasisLookup = useMemo(() => pinEmphasisByKey, [pinEmphasisByKey]);
    const renderedPins = useMemo(
        () => [...savedPlacePins, ...transientPlacePins],
        [savedPlacePins, transientPlacePins]
    );

    return (
        <div className="relative h-full w-full">
            <MapContainer
                center={DEFAULT_MAP_CENTER}
                zoom={DEFAULT_MAP_ZOOM}
                className="carearound-map"
                style={{ width: '100%', height: '100%', zIndex: 0 }}
                zoomControl={false}
                minZoom={CAREAROUND_BASEMAP_MIN_ZOOM}
                maxZoom={CAREAROUND_BASEMAP_MAX_ZOOM}
            >
                <TileLayer
                    attribution={CAREAROUND_BASEMAP_ATTRIBUTION}
                    minNativeZoom={CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM}
                    url={CAREAROUND_BASEMAP_URL}
                    maxNativeZoom={CAREAROUND_BASEMAP_NATIVE_ZOOM}
                />
                <SavedMapCameraController
                    baseAnchorPoint={cameraAnchor}
                    focusRequest={focusRequest}
                    interactionMode={interactionMode}
                    savedPlacePins={savedPlacePins}
                />
                <MapBackgroundEvents enabled={Boolean(onBackgroundClick)} onBackgroundClick={onBackgroundClick} />
                {renderedPins.map((pin) => {
                    const markerKey = pin.pinKey;
                    const emphasis = emphasisLookup.get(markerKey) || 'default';
                    const isTransient = pin.tone === 'temporary' || pin.isTransient;

                    return (
                        <Marker
                            key={markerKey}
                            position={[pin.lat, pin.lng]}
                            icon={createSavedPlacePinIcon({
                                count: pin.totalOfferingsCount,
                                emphasis,
                                tone: pin.tone || 'saved',
                            })}
                            eventHandlers={isTransient ? undefined : {
                                click: (event) => {
                                    event.originalEvent?.stopPropagation?.();
                                    onSelectPin?.(pin);
                                },
                                mouseover: () => {
                                    if (interactionMode === 'desktop') {
                                        onMapHoverStart?.(markerKey);
                                    }
                                },
                                mouseout: () => {
                                    if (interactionMode === 'desktop') {
                                        onMapHoverEnd?.(markerKey);
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
            <div className="hidden lg:block">
                <OneMapBadge />
            </div>
        </div>
    );
}

export default DiscoveryMap;
