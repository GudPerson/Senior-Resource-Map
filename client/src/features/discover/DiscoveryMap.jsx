import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { createSavedPlacePinIcon } from './discoverUtils.js';
import { CAREAROUND_BASEMAP_ATTRIBUTION, CAREAROUND_BASEMAP_URL } from '../../lib/mapTheme.js';

const DEFAULT_MAP_CENTER = [1.3521, 103.8198];
const DEFAULT_MAP_ZOOM = 12;
const SINGLE_PIN_ZOOM = 18;
const DESKTOP_FIT_MAX_ZOOM = 18;
const MOBILE_FIT_MAX_ZOOM = 17;
const DESKTOP_FIT_PADDING_TOP_LEFT = [24, 24];
const DESKTOP_FIT_PADDING_BOTTOM_RIGHT = [24, 24];
const MOBILE_FIT_PADDING_TOP_LEFT = [16, 56];
const MOBILE_FIT_PADDING_BOTTOM_RIGHT = [16, 24];

function createUserLocationIcon() {
    return L.divIcon({
        className: '',
        html: `
            <div class="map-location-heart-marker" aria-hidden="true">
                <div class="map-location-heart-marker__pulse"></div>
                <div class="map-location-heart-marker__core">
                    <svg viewBox="0 0 24 24" class="map-location-heart-marker__icon" focusable="false" aria-hidden="true">
                        <path d="M12 20.4 4.95 14.1C2.52 11.91 2.1 8.25 4 6.08c1.89-2.17 5.34-2.3 7.23-.33L12 6.54l.77-.79c1.89-1.97 5.34-1.84 7.23.33 1.9 2.17 1.48 5.83-.95 8.02L12 20.4Z"></path>
                    </svg>
                </div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
    });
}

function buildPinSignature(savedPlacePins = []) {
    return savedPlacePins
        .map((pin) => `${pin.pinKey}:${pin.lat}:${pin.lng}`)
        .sort()
        .join('|');
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

function fitSavedPins(map, savedPlacePins, interactionMode) {
    const size = map.getSize();
    if (!size?.x || !size?.y) {
        map.invalidateSize(false);
        return false;
    }

    if (savedPlacePins.length === 1) {
        const [pin] = savedPlacePins;
        map.flyTo([pin.lat, pin.lng], SINGLE_PIN_ZOOM, { animate: true, duration: 0.8 });
        return true;
    }

    const bounds = L.latLngBounds(savedPlacePins.map((pin) => [pin.lat, pin.lng]));
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
        return fitSavedPins(map, focusRequest.savedPlacePins || [], interactionMode);
    }

    const fitConfig = getFitConfig(interactionMode);
    const bounds = L.latLngBounds(focusRequest.points);
    map.flyToBounds(bounds, {
        animate: true,
        duration: 0.8,
        paddingTopLeft: fitConfig.paddingTopLeft,
        paddingBottomRight: fitConfig.paddingBottomRight,
        maxZoom: focusRequest.maxZoom ?? fitConfig.maxZoom,
    });
    return true;
}

function SavedMapCameraController({ focusRequest, interactionMode, savedPlacePins }) {
    const map = useMap();
    const lastFitSignatureRef = useRef('');
    const lastSavedSignatureRef = useRef('');
    const lastFocusRequestIdRef = useRef(null);
    const suppressInitialFitRef = useRef(false);

    useEffect(() => {
        const nextSignature = buildPinSignature(savedPlacePins);
        if (nextSignature !== lastSavedSignatureRef.current) {
            lastSavedSignatureRef.current = nextSignature;
            lastFitSignatureRef.current = '';
            suppressInitialFitRef.current = false;
        }

        if (!savedPlacePins.length) {
            lastFitSignatureRef.current = '';
            lastSavedSignatureRef.current = '';
            suppressInitialFitRef.current = false;
        }
    }, [savedPlacePins]);

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
        if (!savedPlacePins.length) return;
        if (suppressInitialFitRef.current) return;

        const nextSignature = buildPinSignature(savedPlacePins);
        if (!nextSignature || nextSignature === lastFitSignatureRef.current) return;

        let frameId = null;

        const attemptFit = () => {
            if (fitSavedPins(map, savedPlacePins, interactionMode)) {
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
    }, [interactionMode, map, savedPlacePins]);

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
        <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            className="carearound-map"
            style={{ width: '100%', height: '100%', zIndex: 0 }}
            zoomControl={false}
        >
            <TileLayer
                attribution={CAREAROUND_BASEMAP_ATTRIBUTION}
                url={CAREAROUND_BASEMAP_URL}
            />
            <SavedMapCameraController
                focusRequest={focusRequest}
                interactionMode={interactionMode}
                savedPlacePins={savedPlacePins}
            />
            <MapBackgroundEvents enabled={Boolean(onBackgroundClick)} onBackgroundClick={onBackgroundClick} />
            {userLocation ? (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserLocationIcon()}>
                    <Popup>
                        <div className="p-1 font-bold text-sm">Your Search Location</div>
                    </Popup>
                </Marker>
            ) : null}
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
        </MapContainer>
    );
}

export default DiscoveryMap;
