import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import OneMapBadge from './OneMapBadge.jsx';
import homeAnchorImage from '../assets/home-anchor.png';
import { createSavedPlacePinIcon } from '../features/discover/discoverUtils.js';
import {
    CAREAROUND_BASEMAP_ATTRIBUTION,
    CAREAROUND_BASEMAP_MAX_ZOOM,
    CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_MIN_ZOOM,
    CAREAROUND_BASEMAP_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_URL,
} from '../lib/mapTheme.js';

const DEFAULT_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 11;
const DIRECTORY_FOCUS_ZOOM = 16;
const DIRECTORY_ANCHOR_ONLY_ZOOM = 15;
const DIRECTORY_FIT_PADDING_TOP_LEFT = [44, 44];
const DIRECTORY_FIT_PADDING_BOTTOM_RIGHT = [44, 52];
const DIRECTORY_CLUSTER_BOUNDS_PADDING = [56, 56];

function getBounds(points) {
    return L.latLngBounds(points.map((point) => [point.lat, point.lng]));
}

function normalizeAnchorPoint(anchor) {
    if (!anchor) return null;

    const lat = Number.parseFloat(anchor.lat);
    const lng = Number.parseFloat(anchor.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        ...anchor,
        lat,
        lng,
    };
}

function getDirectoryCameraPoints(pins = [], anchorPoint = null) {
    const points = pins.map((pin) => ({ lat: pin.lat, lng: pin.lng }));
    if (anchorPoint) {
        points.push({ lat: anchorPoint.lat, lng: anchorPoint.lng });
    }
    return points;
}

function buildDirectoryCameraSignature(pins = [], anchorPoint = null) {
    const pinSignature = pins.map((pin) => `${pin.placeKey}:${pin.lat}:${pin.lng}:${pin.curatedCount}`).join('|');
    const anchorSignature = anchorPoint
        ? `${anchorPoint.kind || 'anchor'}:${anchorPoint.postalCode || ''}:${anchorPoint.lat}:${anchorPoint.lng}`
        : '';
    return `${pinSignature}|${anchorSignature}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function createDirectoryAnchorIcon(anchorPoint = null) {
    const isHome = anchorPoint?.kind === 'home' || anchorPoint?.source === 'home';
    const ringColor = '#0f766e';
    const shellColor = '#ffffff';
    const glyphColor = '#e11d48';
    const haloColor = isHome ? 'rgba(15,118,110,0.24)' : 'rgba(15,118,110,0.18)';
    const iconSvg = isHome
        ? `
            <img src="${homeAnchorImage}" alt="" style="width:36px;height:36px;display:block;filter:drop-shadow(0 12px 20px rgba(15,118,110,0.24));" />
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
                <div style="position:absolute;inset:${isHome ? '1px' : '2px'};border-radius:999px;background:${haloColor};"></div>
                <div style="position:relative;z-index:1;width:${isHome ? '36px' : '34px'};height:${isHome ? '36px' : '34px'};${isHome ? '' : `border-radius:999px;background:${shellColor};border:4px solid ${ringColor};box-shadow:0 12px 24px rgba(15,118,110,0.24);`}display:flex;align-items:center;justify-content:center;overflow:visible;">
                    ${iconSvg}
                </div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
    });
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
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -24],
        tooltipAnchor: [0, -24],
    });
}

function createDirectoryClusterIcon(cluster, emphasizedPlaceKeys = new Set()) {
    const count = cluster.getChildCount();
    const children = cluster.getAllChildMarkers();
    const dominantColor = getClusterColorData(children) || {
        core: '#0f766e',
        bg: 'rgba(15,118,110,0.12)',
        border: 'rgba(13,148,136,0.24)',
        glow: 'rgba(15,118,110,0.16)'
    };
    const isHighlighted = children.some((marker) => {
        const placeKey = marker.options?.icon?.options?.placeKey || marker.options?.placeKey;
        return placeKey && emphasizedPlaceKeys.has(String(placeKey));
    });
    const outerBackground = isHighlighted ? 'rgba(249,115,22,0.14)' : dominantColor.bg;
    const outerBorder = isHighlighted ? 'rgba(249,115,22,0.38)' : dominantColor.border;
    const outerShadow = isHighlighted ? '0 18px 36px rgba(249,115,22,0.26)' : `0 16px 34px ${dominantColor.glow}`;
    const innerBackground = isHighlighted ? '#f97316' : dominantColor.core;

    return L.divIcon({
        className: '',
        html: `
            <div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;">
                <div style="width:42px;height:42px;border-radius:999px;background:${outerBackground};display:flex;align-items:center;justify-content:center;border:1px solid ${outerBorder};box-shadow:${outerShadow};">
                    <div style="width:32px;height:32px;border-radius:999px;background:${innerBackground};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;line-height:1;font-family:var(--font-heading);">
                        ${escapeHtml(count)}
                    </div>
                </div>
            </div>
        `,
        iconSize: [54, 54],
        iconAnchor: [27, 27],
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

function fitDirectoryCamera(map, pins, anchorPoint, {
    animate = false,
    duration = 0.6,
} = {}) {
    const points = getDirectoryCameraPoints(pins, anchorPoint);
    if (!points.length) return false;

    if (points.length === 1) {
        const [point] = points;
        const zoom = pins.length === 1 && !anchorPoint ? DIRECTORY_FOCUS_ZOOM : DIRECTORY_ANCHOR_ONLY_ZOOM;
        if (animate) {
            map.flyTo([point.lat, point.lng], zoom, { animate: true, duration });
        } else {
            map.setView([point.lat, point.lng], zoom, { animate: false });
        }
        return true;
    }

    const bounds = getBounds(points);
    if (animate) {
        map.flyToBounds(bounds, {
            paddingTopLeft: DIRECTORY_FIT_PADDING_TOP_LEFT,
            paddingBottomRight: DIRECTORY_FIT_PADDING_BOTTOM_RIGHT,
            maxZoom: 16,
            duration,
        });
    } else {
        map.fitBounds(bounds, {
            paddingTopLeft: DIRECTORY_FIT_PADDING_TOP_LEFT,
            paddingBottomRight: DIRECTORY_FIT_PADDING_BOTTOM_RIGHT,
            maxZoom: 16,
            animate: false,
        });
    }

    return true;
}

function DirectoryMapRecenterControl({ activeAnchor, pins, interactive, onResetView }) {
    const map = useMap();
    const anchorPoint = normalizeAnchorPoint(activeAnchor);
    const totalPointCount = (pins?.length || 0) + (anchorPoint ? 1 : 0);
    if (!interactive || totalPointCount <= 1) return null;
    
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
                        onResetView?.();
                        fitDirectoryCamera(map, pins, anchorPoint, { animate: true, duration: 0.6 });
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

function DirectoryClusterHoverSync({ clusterGroupRef, enabled = true, onHoverClusterStart, onHoverClusterEnd, onClusterSelect }) {
    const lastActivationRef = useRef({ token: null, at: 0 });

    useEffect(() => {
        const clusterGroup = clusterGroupRef.current;
        if (!enabled || !clusterGroup) return undefined;

        const resolveClusterPlaceKeys = (cluster) => cluster.getAllChildMarkers()
            .map((marker) => marker.options?.icon?.options?.placeKey || marker.options?.placeKey)
            .filter(Boolean);

        const handleClusterMouseOver = (event) => {
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            onHoverClusterStart?.(resolveClusterPlaceKeys(cluster));
        };

        const handleClusterMouseOut = (event) => {
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            onHoverClusterEnd?.(resolveClusterPlaceKeys(cluster));
        };

        const handleClusterActivate = (event) => {
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            event.originalEvent?.preventDefault?.();
            event.originalEvent?.stopPropagation?.();
            const placeKeys = resolveClusterPlaceKeys(cluster);
            const token = placeKeys.map((value) => String(value)).sort().join('|');
            const now = Date.now();

            if (
                lastActivationRef.current.token === token
                && now - lastActivationRef.current.at < 300
            ) {
                return;
            }

            lastActivationRef.current = { token, at: now };
            onClusterSelect?.(placeKeys);
            const mapInstance = clusterGroup._map || cluster._map;
            const currentZoom = typeof mapInstance?.getZoom === 'function' ? mapInstance.getZoom() : 0;
            if (currentZoom >= 16 && typeof cluster.spiderfy === 'function') {
                cluster.spiderfy();
                return;
            }
            if (typeof cluster.zoomToBounds === 'function') {
                cluster.zoomToBounds({ padding: DIRECTORY_CLUSTER_BOUNDS_PADDING });
            }
        };

        clusterGroup.on('clustermouseover', handleClusterMouseOver);
        clusterGroup.on('clustermouseout', handleClusterMouseOut);
        clusterGroup.on('clustermousedown', handleClusterActivate);
        clusterGroup.on('clusterclick', handleClusterActivate);

        return () => {
            clusterGroup.off('clustermouseover', handleClusterMouseOver);
            clusterGroup.off('clustermouseout', handleClusterMouseOut);
            clusterGroup.off('clustermousedown', handleClusterActivate);
            clusterGroup.off('clusterclick', handleClusterActivate);
        };
    }, [clusterGroupRef, enabled, onClusterSelect, onHoverClusterEnd, onHoverClusterStart]);

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

function DirectoryMapController({ activeAnchor, pins, focusedPlaceKey, interactive, onMapSettled, onFocusHandled }) {
    const map = useMap();
    const previousSignatureRef = useRef('');
    const anchorPoint = useMemo(() => normalizeAnchorPoint(activeAnchor), [activeAnchor]);

    const signature = useMemo(
        () => buildDirectoryCameraSignature(pins, anchorPoint),
        [anchorPoint, pins]
    );

    useEffect(() => {
        window.setTimeout(() => {
            map.invalidateSize({ animate: false });
        }, 0);
    }, [map, signature]);

    useEffect(() => {
        if (!pins.length && !anchorPoint) return;
        if (previousSignatureRef.current === signature) return;
        previousSignatureRef.current = signature;

        fitDirectoryCamera(map, pins, anchorPoint, { animate: false });
        window.setTimeout(() => onMapSettled?.(), 250);
    }, [anchorPoint, map, onMapSettled, pins, signature]);

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
        onFocusHandled?.(focusedPlaceKey);
    }, [focusedPlaceKey, interactive, map, onFocusHandled, pins]);

    return null;
}

export default function DirectoryMap({
    pins = [],
    activeAnchor = null,
    focusedPlaceKey = null,
    activePlaceKey = null,
    activePlaceKeys = [],
    onViewSection,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onHoverClusterStart,
    onHoverClusterEnd,
    onClusterSelect,
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
    onFocusHandled,
    onResetView,
}) {
    const hasReportedReadyRef = useRef(false);
    const mapSettledRef = useRef(false);
    const tileLoadedRef = useRef(false);
    const readyTimeoutRef = useRef(null);
    const captureErrorRef = useRef(null);
    const displayPins = useMemo(() => spreadPinsForDisplay(pins, interactive), [interactive, pins]);
    const shouldCluster = displayPins.length > 1;
    const clusterGroupRef = useRef(null);
    const lastPlaceActivationRef = useRef({ token: null, at: 0 });
    const activePlaceKeySet = useMemo(() => new Set((activePlaceKeys || []).map((value) => String(value))), [activePlaceKeys]);
    const anchorPoint = useMemo(() => normalizeAnchorPoint(activeAnchor), [activeAnchor]);

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
    }, [anchorPoint, markerMode, onMapCaptureError, onMapReadyForCapture, pins, placeNumberByKey]);

    if (!pins.length && !anchorPoint) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                {emptyLabel}
            </div>
        );
    }

    const handlePlaceActivate = (placeKey) => {
        if (!interactive || !placeKey) return;

        const token = String(placeKey);
        const now = Date.now();
        if (
            lastPlaceActivationRef.current.token === token
            && now - lastPlaceActivationRef.current.at < 300
        ) {
            return;
        }

        lastPlaceActivationRef.current = { token, at: now };
        onViewSection?.(placeKey);
    };

    const renderedMarkers = useMemo(() => {
        if (shouldCluster) {
            return (
                <MarkerClusterGroup
                    ref={clusterGroupRef}
                    showCoverageOnHover={false}
                    spiderfyOnMaxZoom={false}
                    zoomToBoundsOnClick={false}
                    removeOutsideVisibleBounds={false}
                    disableClusteringAtZoom={16}
                    maxClusterRadius={42}
                    iconCreateFunction={(cluster) => createDirectoryClusterIcon(cluster, activePlaceKeySet)}
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
                                iconUrl: pin.categoryIconUrl || null,
                                placeKey: pin.placeKey,
                            });

                        return (
                            <Marker
                                key={pin.pinKey || pin.placeKey}
                                position={[pin.displayLat, pin.displayLng]}
                                icon={icon}
                                eventHandlers={interactive ? {
                                    mousedown: () => handlePlaceActivate(pin.placeKey),
                                    click: () => handlePlaceActivate(pin.placeKey),
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
                    iconUrl: pin.categoryIconUrl || null,
                    placeKey: pin.placeKey,
                });

            return (
                <Marker
                    key={pin.pinKey || pin.placeKey}
                    position={[pin.displayLat, pin.displayLng]}
                    icon={icon}
                    eventHandlers={interactive ? {
                        mousedown: () => handlePlaceActivate(pin.placeKey),
                        click: () => handlePlaceActivate(pin.placeKey),
                        mouseover: () => onHoverPlaceStart?.(pin.placeKey),
                        mouseout: () => onHoverPlaceEnd?.(pin.placeKey),
                    } : undefined}
                />
            );
        });
    }, [shouldCluster, displayPins, markerMode, placeNumberByKey, focusedPlaceKey, activePlaceKey, activePlaceKeySet, interactive, handlePlaceActivate, onHoverPlaceStart, onHoverPlaceEnd]);

    return (
        <div className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm ${className}`}>
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                minZoom={CAREAROUND_BASEMAP_MIN_ZOOM}
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
                    minNativeZoom={CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM}
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
                    activeAnchor={anchorPoint}
                    pins={pins}
                    focusedPlaceKey={focusedPlaceKey}
                    interactive={interactive}
                    onFocusHandled={onFocusHandled}
                    onMapSettled={onMapReadyForCapture ? () => {
                        mapSettledRef.current = true;
                        tryNotifyReady();
                    } : undefined}
                />
                <DirectoryMapRecenterControl activeAnchor={anchorPoint} pins={displayPins} interactive={interactive} onResetView={onResetView} />
                <DirectoryClusterHoverSync clusterGroupRef={clusterGroupRef} enabled={interactive && shouldCluster} onHoverClusterStart={onHoverClusterStart} onHoverClusterEnd={onHoverClusterEnd} onClusterSelect={onClusterSelect} />
                <DirectoryClusterStateSync onClusterChange={onClusterChange} />
                {anchorPoint ? (
                    <Marker position={[anchorPoint.lat, anchorPoint.lng]} icon={createDirectoryAnchorIcon(anchorPoint)} zIndexOffset={1200}>
                        {showPopup ? (
                            <Popup>
                                <div className="p-1 font-bold text-sm">
                                    {anchorPoint.kind === 'home' ? 'Home postal code' : 'Set location'}
                                </div>
                            </Popup>
                        ) : null}
                    </Marker>
                ) : null}
                {renderedMarkers}
            </MapContainer>
            <OneMapBadge />
        </div>
    );
}
