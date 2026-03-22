import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { createSavedPlacePinIcon } from '../features/discover/discoverUtils.js';
import { CAREAROUND_BASEMAP_ATTRIBUTION, CAREAROUND_BASEMAP_URL } from '../lib/mapTheme.js';

const DEFAULT_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 11;

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

function createDirectoryNumberMarker(number, emphasis = 'default') {
    const isSelected = emphasis === 'primary';

    return L.divIcon({
        className: '',
        html: `
            <div
                class="directory-number-marker ${isSelected ? 'directory-number-marker--selected' : ''}"
                style="
                    --directory-number-marker-ring:${isSelected ? '#f59e0b' : '#ffffff'};
                    --directory-number-marker-glow:${isSelected ? 'rgba(245, 158, 11, 0.34)' : 'rgba(15, 118, 110, 0.16)'};
                    --directory-number-marker-shadow:${isSelected ? '0 14px 26px rgba(194, 65, 12, 0.34)' : '0 10px 18px rgba(15, 118, 110, 0.24)'};
                "
            >
                <div class="directory-number-marker__pulse"></div>
                <div class="directory-number-marker__core">
                    ${escapeHtml(number)}
                </div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -16],
        tooltipAnchor: [0, -16],
    });
}

function createDirectoryClusterIcon(count) {
    return L.divIcon({
        className: '',
        html: `
            <div style="width:42px;height:42px;border-radius:999px;background:rgba(15,118,110,0.12);display:flex;align-items:center;justify-content:center;border:1px solid rgba(13,148,136,0.24);box-shadow:0 16px 34px rgba(15,118,110,0.18);">
                <div style="width:32px;height:32px;border-radius:999px;background:#0f766e;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;line-height:1;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
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
            paddingTopLeft: [28, 28],
            paddingBottomRight: [28, 28],
            maxZoom: 16,
            animate: false,
        });
        window.setTimeout(() => onMapSettled?.(), 250);
    }, [map, onMapSettled, pins, signature]);

    useEffect(() => {
        if (!focusedPlaceKey) return;
        if (!interactive) return;
        const pin = pins.find((item) => item.placeKey === focusedPlaceKey);
        if (!pin) return;

        map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 17), {
            animate: true,
            duration: 0.5,
        });
    }, [focusedPlaceKey, interactive, map, pins]);

    return null;
}

export default function DirectoryMap({
    pins = [],
    focusedPlaceKey = null,
    onViewSection,
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
}) {
    const hasReportedReadyRef = useRef(false);
    const mapSettledRef = useRef(false);
    const tileLoadedRef = useRef(false);
    const readyTimeoutRef = useRef(null);
    const captureErrorRef = useRef(null);
    const displayPins = useMemo(() => spreadPinsForDisplay(pins, interactive), [interactive, pins]);
    const shouldCluster = interactive && displayPins.length > 1;

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

    return (
        <div className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm ${className}`}>
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom={false}
                dragging={interactive}
                touchZoom={interactive}
                doubleClickZoom={interactive}
                boxZoom={interactive}
                keyboard={interactive}
                zoomControl={showZoomControl}
                className={`carearound-map ${mapHeightClassName} w-full ${interactive ? '' : 'pointer-events-none'}`}
                attributionControl={showAttribution}
            >
                <TileLayer
                    attribution={CAREAROUND_BASEMAP_ATTRIBUTION}
                    url={CAREAROUND_BASEMAP_URL}
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
                {(shouldCluster ? (
                    <MarkerClusterGroup
                        showCoverageOnHover={false}
                        spiderfyOnMaxZoom={true}
                        removeOutsideVisibleBounds={false}
                        disableClusteringAtZoom={16}
                        maxClusterRadius={42}
                        iconCreateFunction={(cluster) => createDirectoryClusterIcon(cluster.getChildCount())}
                    >
                        {displayPins.map((pin) => {
                            const icon = markerMode === 'number'
                                ? createDirectoryNumberMarker(
                                    pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                                    focusedPlaceKey === pin.placeKey ? 'primary' : 'default'
                                )
                                : createSavedPlacePinIcon({
                                    count: pin.curatedCount,
                                    emphasis: focusedPlaceKey === pin.placeKey ? 'primary' : 'default',
                                    tone: 'saved',
                                });

                            return (
                                <Marker
                                    key={pin.pinKey || pin.placeKey}
                                    position={[pin.displayLat, pin.displayLng]}
                                    icon={icon}
                                    eventHandlers={interactive && onViewSection ? {
                                        click: () => onViewSection(pin.placeKey),
                                    } : undefined}
                                />
                            );
                        })}
                    </MarkerClusterGroup>
                ) : displayPins.map((pin) => {
                    const icon = markerMode === 'number'
                        ? createDirectoryNumberMarker(
                            pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                            focusedPlaceKey === pin.placeKey ? 'primary' : 'default'
                        )
                        : createSavedPlacePinIcon({
                            count: pin.curatedCount,
                            emphasis: focusedPlaceKey === pin.placeKey ? 'primary' : 'default',
                            tone: 'saved',
                        });

                    return (
                        <Marker
                            key={pin.pinKey || pin.placeKey}
                            position={[pin.displayLat, pin.displayLng]}
                            icon={icon}
                            eventHandlers={interactive && onViewSection ? {
                                click: () => onViewSection(pin.placeKey),
                            } : undefined}
                        />
                    );
                }))}
            </MapContainer>
        </div>
    );
}
