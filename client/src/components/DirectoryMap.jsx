import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import OneMapBadge from './OneMapBadge.jsx';
import { createSavedPlacePinIcon } from '../features/discover/discoverUtils.js';
import {
    CAREAROUND_BASEMAP_ATTRIBUTION,
    CAREAROUND_BASEMAP_MAX_ZOOM,
    CAREAROUND_BASEMAP_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_URL,
} from '../lib/mapTheme.js';

const DEFAULT_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 11;
const DIRECTORY_FOCUS_ZOOM = 16;
const CLUSTER_HOVER_REVEAL_DELAY_MS = 700;

function getBounds(points) {
    return L.latLngBounds(points.map((point) => [point.lat, point.lng]));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const PALETTE = [
    { core: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', border: 'rgba(37, 99, 235, 0.24)', glow: 'rgba(37, 99, 235, 0.16)' }, // Blue
    { core: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)', border: 'rgba(234, 88, 12, 0.24)', glow: 'rgba(234, 88, 12, 0.16)' },  // Orange
    { core: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)', border: 'rgba(147, 51, 234, 0.24)', glow: 'rgba(147, 51, 234, 0.16)' }, // Purple
    { core: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)', border: 'rgba(22, 163, 74, 0.24)', glow: 'rgba(22, 163, 74, 0.16)' },   // Green
    { core: '#db2777', bg: 'rgba(219, 39, 119, 0.12)', border: 'rgba(219, 39, 119, 0.24)', glow: 'rgba(219, 39, 119, 0.16)' }, // Pink
    { core: '#ca8a04', bg: 'rgba(202, 138, 4, 0.12)', border: 'rgba(202, 138, 4, 0.24)', glow: 'rgba(202, 138, 4, 0.16)' },   // Yellow
    { core: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', border: 'rgba(8, 145, 178, 0.24)', glow: 'rgba(8, 145, 178, 0.16)' },   // Cyan
    { core: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.24)', glow: 'rgba(220, 38, 38, 0.16)' },   // Red
    { core: '#4f46e5', bg: 'rgba(79, 70, 229, 0.12)', border: 'rgba(79, 70, 229, 0.24)', glow: 'rgba(79, 70, 229, 0.16)' },  // Indigo
    { core: '#65a30d', bg: 'rgba(101, 163, 13, 0.12)', border: 'rgba(101, 163, 13, 0.24)', glow: 'rgba(101, 163, 13, 0.16)' }, // Lime
    { core: '#c026d3', bg: 'rgba(192, 38, 211, 0.12)', border: 'rgba(192, 38, 211, 0.24)', glow: 'rgba(192, 38, 211, 0.16)' }, // Fuchsia
    { core: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)', border: 'rgba(13, 148, 136, 0.24)', glow: 'rgba(13, 148, 136, 0.16)' }, // Teal
    { core: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', border: 'rgba(124, 58, 237, 0.24)', glow: 'rgba(124, 58, 237, 0.16)' }, // Violet
    { core: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)', border: 'rgba(225, 29, 72, 0.24)', glow: 'rgba(225, 29, 72, 0.16)' },   // Rose
    { core: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', border: 'rgba(2, 132, 199, 0.24)', glow: 'rgba(2, 132, 199, 0.16)' },   // Sky
];

function getClusterColorData(children) {
    if (!children || !children.length) return null;
    const sortedKeys = children
        .map((m) => m.options?.icon?.options?.placeKey || m.options?.placeKey)
        .filter(Boolean)
        .sort();
    
    if (!sortedKeys.length) return PALETTE[0];
    
    const headKey = sortedKeys[0];
    let hash = 0;
    for (let i = 0; i < headKey.length; i++) {
        hash = headKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
}

function createDirectoryNumberMarker(number, emphasis = 'default', placeKey = null) {
    const isSelected = emphasis === 'primary';
    const coreColor = '#0f766e';
    const ringColor = isSelected ? '#f97316' : '#ffffff';
    const glowColor = isSelected ? 'rgba(249, 115, 22, 0.34)' : 'rgba(15, 118, 110, 0.16)';
    const shadowColor = isSelected ? '0 14px 26px rgba(194, 65, 12, 0.38)' : '0 10px 18px rgba(15, 118, 110, 0.24)';

    return L.divIcon({
        className: '',
        placeKey: placeKey,
        html: `
            <div
                class="directory-number-marker ${isSelected ? 'directory-number-marker--selected' : ''}"
                style="
                    --directory-number-marker-core:${coreColor};
                    --directory-number-marker-ring:${ringColor};
                    --directory-number-marker-glow:${glowColor};
                    --directory-number-marker-shadow:${shadowColor};
                "
            >
                <div class="directory-number-marker__pulse"></div>
                <div class="directory-number-marker__core">
                    ${escapeHtml(number)}
                </div>
            </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
        tooltipAnchor: [0, -18],
    });
}

function createDirectoryClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const children = cluster.getAllChildMarkers();
    const dominantColor = getClusterColorData(children) || {
        core: '#0f766e',
        bg: 'rgba(15,118,110,0.12)',
        border: 'rgba(13,148,136,0.24)',
        glow: 'rgba(15,118,110,0.16)'
    };

    return L.divIcon({
        className: '',
        html: `
            <div style="width:42px;height:42px;border-radius:999px;background:${dominantColor.bg};display:flex;align-items:center;justify-content:center;border:1px solid ${dominantColor.border};box-shadow:0 16px 34px ${dominantColor.glow};">
                <div style="width:32px;height:32px;border-radius:999px;background:${dominantColor.core};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;line-height:1;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    ${escapeHtml(count)}
                </div>
            </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
    });
}

function spreadPinsForDisplay(pins, interactive) {
    const groupedPins = new Map();

    pins.forEach((pin) => {
        const key = `${pin.lat.toFixed(6)}:${pin.lng.toFixed(6)}`;
        const group = groupedPins.get(key) || [];
        group.push(pin);
        groupedPins.set(key, group);
    });

    return pins.map((pin) => {
        const key = `${pin.lat.toFixed(6)}:${pin.lng.toFixed(6)}`;
        const group = groupedPins.get(key) || [];

        if (group.length <= 1) {
            return {
                ...pin,
                displayLat: pin.lat,
                displayLng: pin.lng,
            };
        }

        const index = group.findIndex((candidate) => candidate.placeKey === pin.placeKey);
        const angle = ((Math.PI * 2) / group.length) * index;
        const offset = interactive ? 0.00018 : 0.00014;

        return {
            ...pin,
            displayLat: pin.lat + Math.sin(angle) * offset,
            displayLng: pin.lng + Math.cos(angle) * offset,
        };
    });
}

function DirectoryMapRecenterControl({ pins, interactive }) {
    const map = useMap();
    if (!interactive || !pins || pins.length <= 1) return null;
    
    return (
        <div className="leaflet-top leaflet-right z-[1000] pointer-events-auto mt-2.5 mr-2.5 sm:mt-3 sm:mr-3 absolute right-0 top-0">
            <div className="leaflet-control leaflet-bar border-none shadow-none mt-0 mr-0">
                <button
                    type="button"
                    title="Reset map view"
                    aria-label="Reset map view"
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-brand-700"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        map.flyToBounds(getBounds(pins), {
                            paddingTopLeft: [16, 16],
                            paddingBottomRight: [16, 16],
                            maxZoom: 16,
                            duration: 0.6
                        });
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7M15 21h6v-6M9 3H3v6M21 21l-7-7M3 3l7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

function DirectoryClusterHoverController({ clusterGroupRef, enabled = true }) {
    const map = useMap();
    const hoverTimeoutRef = useRef(null);
    const activeClusterRef = useRef(null);
    const previousViewRef = useRef(null);

    useEffect(() => {
        const clusterGroup = clusterGroupRef.current;
        if (!enabled || !clusterGroup) return undefined;

        const clearHoverTimer = () => {
            if (hoverTimeoutRef.current) {
                window.clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
            }
        };

        const restorePreviousView = () => {
            if (!previousViewRef.current) return;
            const { center, zoom } = previousViewRef.current;
            previousViewRef.current = null;
            activeClusterRef.current = null;
            map.flyTo(center, zoom, { animate: true, duration: 0.35 });
        };

        const handleClusterMouseOver = (event) => {
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;

            clearHoverTimer();
            hoverTimeoutRef.current = window.setTimeout(() => {
                if (activeClusterRef.current === cluster) return;
                previousViewRef.current = { center: map.getCenter(), zoom: map.getZoom() };
                activeClusterRef.current = cluster;
                if (map.getZoom() >= 16 && typeof cluster.spiderfy === 'function') {
                    cluster.spiderfy();
                    return;
                }
                if (typeof cluster.zoomToBounds === 'function') {
                    cluster.zoomToBounds({ padding: [40, 40] });
                }
            }, CLUSTER_HOVER_REVEAL_DELAY_MS);
        };

        const handleClusterMouseOut = (event) => {
            const cluster = event.layer;
            clearHoverTimer();
            if (activeClusterRef.current && cluster === activeClusterRef.current) {
                if (typeof cluster.unspiderfy === 'function') {
                    cluster.unspiderfy();
                }
                restorePreviousView();
            }
        };

        const handleMapMoveStart = () => {
            if (!activeClusterRef.current) return;
            clearHoverTimer();
        };

        clusterGroup.on('clustermouseover', handleClusterMouseOver);
        clusterGroup.on('clustermouseout', handleClusterMouseOut);
        map.on('movestart', handleMapMoveStart);

        return () => {
            clearHoverTimer();
            clusterGroup.off('clustermouseover', handleClusterMouseOver);
            clusterGroup.off('clustermouseout', handleClusterMouseOut);
            map.off('movestart', handleMapMoveStart);
        };
    }, [clusterGroupRef, enabled, map]);

    return null;
}

function DirectoryClusterStateSync({ onClusterChange }) {
    const map = useMap();
    
    useEffect(() => {
        if (!onClusterChange) return undefined;

        let activeTimeout = null;

        const updateClusters = () => {
            const clusterMapping = {};
            
            map.eachLayer((layer) => {
                if (layer && typeof layer.getAllChildMarkers === 'function') {
                    const children = layer.getAllChildMarkers();
                    const colorData = getClusterColorData(children);
                    if (colorData) {
                        children.forEach((marker) => {
                            const pk = marker.options?.icon?.options?.placeKey || marker.options?.placeKey;
                            if (pk) {
                                clusterMapping[pk] = colorData;
                            }
                        });
                    }
                }
            });
            
            onClusterChange(clusterMapping);
        };

        const handleUpdate = () => {
            if (activeTimeout) window.clearTimeout(activeTimeout);
            activeTimeout = window.setTimeout(updateClusters, 300);
        };

        map.on('moveend', handleUpdate);
        map.on('zoomend', handleUpdate);
        map.on('layeradd', handleUpdate);

        handleUpdate();

        return () => {
            if (activeTimeout) window.clearTimeout(activeTimeout);
            map.off('moveend', handleUpdate);
            map.off('zoomend', handleUpdate);
            map.off('layeradd', handleUpdate);
        };
    }, [map, onClusterChange]);

    return null;
}

function DirectoryMapController({ pins, focusedPlaceKey, interactive, onMapSettled }) {
    const map = useMap();
    const previousSignatureRef = useRef('');

    const signature = useMemo(
        () => pins.map((pin) => `${pin.placeKey}:${pin.lat}:${pin.lng}:${pin.curatedCount}`).join('|'),
        [pins]
    );

    useEffect(() => {
        window.setTimeout(() => {
            map.invalidateSize({ animate: false });
        }, 0);
    }, [map, signature]);

    useEffect(() => {
        if (!pins.length) return;
        if (previousSignatureRef.current === signature) return;
        previousSignatureRef.current = signature;

        if (pins.length === 1) {
            map.setView([pins[0].lat, pins[0].lng], 16, { animate: false });
            window.setTimeout(() => onMapSettled?.(), 250);
            return;
        }

        map.fitBounds(getBounds(pins), {
            paddingTopLeft: [16, 16],
            paddingBottomRight: [16, 16],
            maxZoom: 16,
            animate: false,
        });
        window.setTimeout(() => onMapSettled?.(), 250);
    }, [map, onMapSettled, pins, signature]);

    useEffect(() => {
        if (!focusedPlaceKey) return;
        if (!interactive) return;

        const isDeepZoom = String(focusedPlaceKey).endsWith(':zoom');
        const cleanKey = isDeepZoom ? String(focusedPlaceKey).replace(':zoom', '') : focusedPlaceKey;

        const pin = pins.find((item) => String(item.placeKey) === String(cleanKey));
        if (!pin) return;

        const targetZoom = isDeepZoom ? 18 : DIRECTORY_FOCUS_ZOOM;

        map.flyTo([pin.lat, pin.lng], targetZoom, {
            animate: true,
            duration: 0.5,
        });
    }, [focusedPlaceKey, interactive, map, pins]);

    return null;
}

export default function DirectoryMap({
    pins = [],
    focusedPlaceKey = null,
    activePlaceKey = null,
    onViewSection,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    interactive = true,
    className = '',
    emptyLabel = 'This directory does not have any mappable places yet.',
    markerMode = 'count',
    placeNumberByKey = null,
    showPopup = true,
    showZoomControl = interactive,
    showAttribution = true,
    mapHeightClassName = 'h-[340px]',
    onMapReadyForCapture,
    onMapCaptureError,
    onClusterChange,
}) {
    const hasReportedReadyRef = useRef(false);
    const mapSettledRef = useRef(false);
    const tileLoadedRef = useRef(false);
    const readyTimeoutRef = useRef(null);
    const captureErrorRef = useRef(null);
    const displayPins = useMemo(() => spreadPinsForDisplay(pins, interactive), [interactive, pins]);
    const shouldCluster = displayPins.length > 1;
    const clusterGroupRef = useRef(null);

    const notifyReady = useMemo(() => () => {
        if (hasReportedReadyRef.current) return;
        hasReportedReadyRef.current = true;
        if (readyTimeoutRef.current) {
            window.clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
        }
        onMapReadyForCapture?.();
    }, [onMapReadyForCapture]);

    const tryNotifyReady = useMemo(() => () => {
        if (hasReportedReadyRef.current) return;
        if (!mapSettledRef.current) return;
        if (!tileLoadedRef.current) return;
        notifyReady();
    }, [notifyReady]);

    useEffect(() => {
        hasReportedReadyRef.current = false;
        mapSettledRef.current = false;
        tileLoadedRef.current = false;
        captureErrorRef.current = null;
        if (readyTimeoutRef.current) {
            window.clearTimeout(readyTimeoutRef.current);
        }
        if (!onMapReadyForCapture) return undefined;

        readyTimeoutRef.current = window.setTimeout(() => {
            if (!hasReportedReadyRef.current) {
                const error = new Error('Directory map did not finish loading for capture.');
                captureErrorRef.current = error;
                onMapCaptureError?.(error);
            }
        }, 5000);

        return () => {
            if (readyTimeoutRef.current) {
                window.clearTimeout(readyTimeoutRef.current);
                readyTimeoutRef.current = null;
            }
        };
    }, [markerMode, onMapCaptureError, onMapReadyForCapture, pins, placeNumberByKey]);

    if (!pins.length) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                {emptyLabel}
            </div>
        );
    }

    const renderedMarkers = useMemo(() => {
        if (shouldCluster) {
            return (
                <MarkerClusterGroup
                    ref={clusterGroupRef}
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={false}
                    removeOutsideVisibleBounds={false}
                    disableClusteringAtZoom={16}
                    maxClusterRadius={42}
                    iconCreateFunction={createDirectoryClusterIcon}
                >
                    {displayPins.map((pin) => {
                        const activeKey = activePlaceKey ?? focusedPlaceKey;
                        const isDeepZoom = String(activeKey).endsWith(':zoom');
                        const cleanKey = isDeepZoom ? String(activeKey).replace(':zoom', '') : activeKey;
                        const isMatched = String(cleanKey) === String(pin.placeKey);

                        const icon = markerMode === 'number'
                            ? createDirectoryNumberMarker(
                                pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                                isMatched ? 'primary' : 'default',
                                pin.placeKey
                            )
                            : createSavedPlacePinIcon({
                                count: pin.curatedCount,
                                emphasis: isMatched ? 'primary' : 'default',
                                tone: 'saved',
                            });

                        return (
                            <Marker
                                key={pin.pinKey || pin.placeKey}
                                position={[pin.displayLat, pin.displayLng]}
                                icon={icon}
                                eventHandlers={interactive ? {
                                    click: () => onViewSection?.(pin.placeKey),
                                    mouseover: () => onHoverPlaceStart?.(pin.placeKey),
                                    mouseout: () => onHoverPlaceEnd?.(pin.placeKey),
                                } : undefined}
                            />
                        );
                    })}
                </MarkerClusterGroup>
            );
        }

        return displayPins.map((pin) => {
            const activeKey = activePlaceKey ?? focusedPlaceKey;
                        const isDeepZoom = String(activeKey).endsWith(':zoom');
                        const cleanKey = isDeepZoom ? String(activeKey).replace(':zoom', '') : activeKey;
                        const isMatched = String(cleanKey) === String(pin.placeKey);

            const icon = markerMode === 'number'
                ? createDirectoryNumberMarker(
                    pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                    isMatched ? 'primary' : 'default',
                    pin.placeKey
                )
                : createSavedPlacePinIcon({
                    count: pin.curatedCount,
                    emphasis: isMatched ? 'primary' : 'default',
                    tone: 'saved',
                });

            return (
                <Marker
                    key={pin.pinKey || pin.placeKey}
                    position={[pin.displayLat, pin.displayLng]}
                    icon={icon}
                    eventHandlers={interactive ? {
                                    click: () => onViewSection?.(pin.placeKey),
                                    mouseover: () => onHoverPlaceStart?.(pin.placeKey),
                                    mouseout: () => onHoverPlaceEnd?.(pin.placeKey),
                                } : undefined}
                />
            );
        });
    }, [shouldCluster, displayPins, markerMode, placeNumberByKey, focusedPlaceKey, interactive, onViewSection]);

    return (
        <div className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm ${className}`}>
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                zoomSnap={0.1}
                scrollWheelZoom={false}
                dragging={interactive}
                touchZoom={interactive}
                doubleClickZoom={interactive}
                boxZoom={interactive}
                keyboard={interactive}
                zoomControl={showZoomControl}
                className={`carearound-map ${mapHeightClassName} w-full ${interactive ? '' : 'pointer-events-none cursor-default selection:bg-transparent'}`}
                attributionControl={showAttribution}
                maxZoom={CAREAROUND_BASEMAP_MAX_ZOOM}
            >
                <TileLayer
                    attribution={CAREAROUND_BASEMAP_ATTRIBUTION}
                    url={CAREAROUND_BASEMAP_URL}
                    maxNativeZoom={CAREAROUND_BASEMAP_NATIVE_ZOOM}
                    eventHandlers={onMapReadyForCapture ? {
                        load: () => {
                            tileLoadedRef.current = true;
                            tryNotifyReady();
                        },
                        tileerror: () => {
                            if (hasReportedReadyRef.current) return;
                            if (captureErrorRef.current) return;
                            const error = new Error('Directory map tiles failed to load for capture.');
                            captureErrorRef.current = error;
                            onMapCaptureError?.(error);
                        },
                    } : undefined}
                />
                <DirectoryMapController
                    pins={pins}
                    focusedPlaceKey={focusedPlaceKey}
                    interactive={interactive}
                    onMapSettled={onMapReadyForCapture ? () => {
                        mapSettledRef.current = true;
                        tryNotifyReady();
                    } : undefined}
                />
                <DirectoryMapRecenterControl pins={displayPins} interactive={interactive} />
                <DirectoryClusterHoverController clusterGroupRef={clusterGroupRef} enabled={interactive && shouldCluster} />
                <DirectoryClusterStateSync onClusterChange={onClusterChange} />
                {renderedMarkers}
            </MapContainer>
            <OneMapBadge />
        </div>
    );
}
