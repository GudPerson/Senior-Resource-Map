import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import OneMapBadge from './OneMapBadge.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import homeAnchorImage from '../assets/home-anchor.png';
import { createPostalGroupParentPinIcon, createSavedPlacePinIcon } from '../features/discover/discoverUtils.js';
import {
    CAREAROUND_BASEMAP_ATTRIBUTION,
    CAREAROUND_BASEMAP_MAX_ZOOM,
    CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_MIN_ZOOM,
    CAREAROUND_BASEMAP_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_URL,
} from '../lib/mapTheme.js';
import {
    buildClusterToken,
    getClusterActivationAction,
    getClusterCameraPlan,
    getClusterExpansionZoom,
    getClusterReframeDelays,
    isDuplicateClusterClick,
    shouldIgnoreClusterHover,
} from '../lib/mapClusterInteraction.js';
import { buildDirectoryMapClassNames } from '../lib/directoryMapPresentation.js';
import {
    getFocusedDirectoryCameraPins,
    shouldRefitDirectoryCameraAfterResize,
} from '../lib/directoryMapCamera.js';

const DEFAULT_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 11;
const DIRECTORY_FOCUS_ZOOM = 16;
const DIRECTORY_ANCHOR_ONLY_ZOOM = 15;
const DIRECTORY_FIT_PADDING_TOP_LEFT = [44, 72];
const DIRECTORY_FIT_PADDING_BOTTOM_RIGHT = [44, 52];
const DIRECTORY_CLUSTER_BOUNDS_PADDING = [56, 56];
const DIRECTORY_COMPACT_CLUSTER_PADDING_TOP_LEFT = [72, 118];
const DIRECTORY_COMPACT_CLUSTER_PADDING_BOTTOM_RIGHT = [72, 84];
const DIRECTORY_COMPACT_CLUSTER_FIT_PADDING_TOP_LEFT = [64, 54];
const DIRECTORY_COMPACT_CLUSTER_FIT_PADDING_BOTTOM_RIGHT = [64, 56];
const DIRECTORY_COMPACT_MAP_HEIGHT = 380;
const DIRECTORY_MOBILE_MAP_LAYOUT_TRANSITION_MS = 300;
const DIRECTORY_ASSET_SPREAD_CLUSTER_MAX_VISIBLE = 8;
const DIRECTORY_PRINT_BADGE_ICON_SIZE = 112;
const DIRECTORY_PRINT_BADGE_DIAMETER = 25.5;
const DIRECTORY_PRINT_BADGE_LOBE_SPACING = DIRECTORY_PRINT_BADGE_DIAMETER * 0.76;
const DIRECTORY_CATEGORY_BUBBLE_DIAMETER = 28;
const DIRECTORY_CATEGORY_BUBBLE_LOBE_SPACING = DIRECTORY_CATEGORY_BUBBLE_DIAMETER * 0.74;
const DIRECTORY_CATEGORY_BUBBLE_DOT_ZOOM_THRESHOLD = 13.25;
const DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER = 13;
const DIRECTORY_CATEGORY_BUBBLE_DOT_LOBE_SPACING = DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER * 0.58;
const DIRECTORY_PRINT_BADGE_BUBBLE_GAP = 1;
const DIRECTORY_PRINT_BADGE_BUBBLE_ITERATIONS = 56;
const DIRECTORY_PRINT_BADGE_BUBBLE_MAX_OFFSET = 44;
const DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_PADDING = 6;
const DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_ANCHOR_TOLERANCE = DIRECTORY_PRINT_BADGE_BUBBLE_MAX_OFFSET + DIRECTORY_PRINT_BADGE_DIAMETER;
const DIRECTORY_PRINT_BADGE_COLLISION_FOCUS_ZOOM = DIRECTORY_FOCUS_ZOOM - 0.25;
const DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS = 140;
const DIRECTORY_PRINT_BADGE_COLLISION_SCHEDULE_DELAYS = [0, 40, 120, 260, 520, 960, 1500, 2400];
const DIRECTORY_BUBBLE_MARKER_CORE_SELECTOR = '.directory-print-badge-marker__core, .directory-category-bubble-marker__core';
const DIRECTORY_BUBBLE_MARKER_LOBE_SELECTOR = '.directory-print-badge-marker__lobe, .directory-category-bubble-marker__lobe';

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

function getDirectoryPinMapPoint(pin = {}) {
    const lat = Number.parseFloat(pin.displayLat ?? pin.lat);
    const lng = Number.parseFloat(pin.displayLng ?? pin.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function getPinBasePoint(pin = {}) {
    const lat = Number.parseFloat(pin.lat);
    const lng = Number.parseFloat(pin.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function getDirectoryCameraPoints(pins = [], anchorPoint = null) {
    const points = pins.map(getDirectoryPinMapPoint).filter(Boolean);
    if (anchorPoint) {
        points.push({ lat: anchorPoint.lat, lng: anchorPoint.lng });
    }
    return points;
}

function pinMatchesPlaceKeys(pin, placeKeys = new Set()) {
    if (!pin || !placeKeys?.size) return false;
    const pinKeys = [pin.placeKey, ...(pin.memberPlaceKeys || [])]
        .filter(Boolean)
        .map((value) => String(value));
    return pinKeys.some((key) => placeKeys.has(key));
}

function buildDirectoryCameraSignature(pins = [], anchorPoint = null) {
    const pinSignature = pins.map((pin) => {
        const point = getDirectoryPinMapPoint(pin);
        return `${pin.placeKey}:${point?.lat ?? ''}:${point?.lng ?? ''}:${pin.curatedCount}`;
    }).join('|');
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

function normalizeMarkerColor(value, fallback = '#0f766e') {
    const text = String(value || '').trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : fallback;
}

function normalizeMarkerOffset(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function normalizeStylePixel(value) {
    const number = Number.parseFloat(String(value || '0').replace('px', ''));
    return Number.isFinite(number) ? number : 0;
}

function normalizePrintBadgeItems(number, items = null, fallbackColor = '#0f766e') {
    const fallbackLabel = String(number || '?').trim() || '?';
    const sourceItems = Array.isArray(items) && items.length
        ? items
        : [{ label: fallbackLabel, color: fallbackColor }];

    return sourceItems.map((item, index) => {
        const label = String(item?.label ?? item?.number ?? (index + 1)).trim() || '?';
        return {
            label,
            color: normalizeMarkerColor(item?.color || item?.categoryColor, fallbackColor),
            placeKey: item?.placeKey || null,
        };
    });
}

function normalizeCategoryBubbleItems(items = null, pin = {}) {
    const sourceItems = Array.isArray(items) && items.length
        ? items
        : [{
            placeKey: pin.placeKey || null,
            color: pin.categoryColor || null,
            iconUrl: pin.categoryIconUrl || null,
            label: pin.title || '',
        }];

    return sourceItems
        .map((item, index) => ({
            placeKey: item?.placeKey || pin.placeKey || null,
            color: normalizeMarkerColor(item?.color || item?.categoryColor || pin.categoryColor, '#0f766e'),
            iconUrl: item?.iconUrl || item?.categoryIconUrl || null,
            label: String(item?.label || item?.title || index + 1),
        }))
        .filter((item) => item.placeKey);
}

function getBubbleLobeLayout(count, {
    diameter = DIRECTORY_PRINT_BADGE_DIAMETER,
    spacing = DIRECTORY_PRINT_BADGE_LOBE_SPACING,
} = {}) {
    const safeCount = Math.max(1, Number(count) || 1);
    let centers;

    if (safeCount === 1) {
        centers = [{ x: 0, y: 0 }];
    } else if (safeCount === 2) {
        centers = [
            { x: -spacing / 2, y: 0 },
            { x: spacing / 2, y: 0 },
        ];
    } else if (safeCount === 3) {
        centers = [
            { x: 0, y: -spacing * 0.56 },
            { x: -spacing / 2, y: spacing * 0.42 },
            { x: spacing / 2, y: spacing * 0.42 },
        ];
    } else if (safeCount === 4) {
        centers = [
            { x: -spacing / 2, y: -spacing / 2 },
            { x: spacing / 2, y: -spacing / 2 },
            { x: -spacing / 2, y: spacing / 2 },
            { x: spacing / 2, y: spacing / 2 },
        ];
    } else if (safeCount === 5) {
        centers = [
            { x: -spacing, y: -spacing / 2 },
            { x: 0, y: -spacing / 2 },
            { x: spacing, y: -spacing / 2 },
            { x: -spacing / 2, y: spacing / 2 },
            { x: spacing / 2, y: spacing / 2 },
        ];
    } else {
        const columns = Math.ceil(Math.sqrt(safeCount));
        const rows = Math.ceil(safeCount / columns);
        centers = Array.from({ length: safeCount }, (_, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            return {
                x: (column - ((columns - 1) / 2)) * spacing,
                y: (row - ((rows - 1) / 2)) * spacing,
            };
        });
    }

    const radius = diameter / 2;
    const minX = Math.min(...centers.map((center) => center.x - radius));
    const maxX = Math.max(...centers.map((center) => center.x + radius));
    const minY = Math.min(...centers.map((center) => center.y - radius));
    const maxY = Math.max(...centers.map((center) => center.y + radius));

    return {
        width: maxX - minX,
        height: maxY - minY,
        lobes: centers.map((center) => ({
            left: center.x - radius - minX,
            top: center.y - radius - minY,
        })),
    };
}

function getPrintBadgeLobeLayout(count) {
    return getBubbleLobeLayout(count);
}

function getCategoryBubbleLobeLayout(count, compact = false) {
    return getBubbleLobeLayout(count, {
        diameter: compact ? DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER : DIRECTORY_CATEGORY_BUBBLE_DIAMETER,
        spacing: compact ? DIRECTORY_CATEGORY_BUBBLE_DOT_LOBE_SPACING : DIRECTORY_CATEGORY_BUBBLE_LOBE_SPACING,
    });
}

function getDirectoryPinAssetCount(pin = {}) {
    if (Number.isFinite(pin.postalGroupCount) && pin.postalGroupCount > 0) {
        return pin.postalGroupCount;
    }
    const memberCount = Array.isArray(pin.memberPlaceKeys) ? pin.memberPlaceKeys.length : 0;
    return Math.max(1, memberCount || 1);
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

function createPrintResourceBadgeMarker(number, {
    color = null,
    emphasis = 'default',
    placeKey = null,
    items = null,
    offsetX = 0,
    offsetY = 0,
} = {}) {
    const isSelected = emphasis === 'primary';
    const badgeColor = normalizeMarkerColor(color);
    const x = normalizeMarkerOffset(offsetX);
    const y = normalizeMarkerOffset(offsetY);
    const label = String(number || '?').trim() || '?';
    const badgeItems = normalizePrintBadgeItems(number, items, badgeColor);
    const markerKey = badgeItems.map((item) => `${item.placeKey || ''}:${item.label}`).join('|') || placeKey || label;
    const lobeLayout = getPrintBadgeLobeLayout(badgeItems.length);
    const shadowColor = isSelected ? '0 10px 18px rgba(194, 65, 12, 0.28)' : '0 6px 12px rgba(15, 23, 42, 0.18)';
    const focusGlow = isSelected ? ', 0 0 0 5px rgba(249,115,22,0.24)' : '';
    const lobeHtml = badgeItems.map((item, index) => {
        const lobe = lobeLayout.lobes[index] || { left: 0, top: 0 };
        const fontSize = item.label.length > 2 ? 7 : (item.label.length > 1 ? 8.5 : 10);
        return `
            <span
                class="directory-print-badge-marker__lobe"
                data-print-lobe-place-key="${escapeHtml(item.placeKey || '')}"
                style="
                    position:absolute;
                    left:${lobe.left}px;
                    top:${lobe.top}px;
                    width:${DIRECTORY_PRINT_BADGE_DIAMETER}px;
                    height:${DIRECTORY_PRINT_BADGE_DIAMETER}px;
                    box-sizing:border-box;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border:2px solid rgba(255,255,255,0.96);
                    border-radius:999px;
                    background:${item.color};
                    color:#ffffff;
                    font-family:var(--font-heading);
                    font-size:${fontSize}px;
                    font-weight:900;
                    line-height:1;
                    text-shadow:0 1px 2px rgba(15,23,42,0.18);
                    box-shadow:${shadowColor}${focusGlow};
                    pointer-events:auto;
                "
            >
                ${escapeHtml(item.label)}
            </span>
        `;
    }).join('');

    return L.divIcon({
        className: 'directory-print-badge-leaflet-icon',
        placeKey,
        categoryColor: badgeColor,
        html: `
            <div
                class="directory-print-badge-marker"
                style="
                    position:relative;
                    width:${lobeLayout.width}px;
                    height:${lobeLayout.height}px;
                    pointer-events:none;
                "
            >
                <div
                    class="directory-print-badge-marker__core"
                    data-print-marker-key="${escapeHtml(markerKey)}"
                    data-print-number="${escapeHtml(label)}"
                    data-print-lobe-count="${badgeItems.length}"
                    data-print-icon-width="${lobeLayout.width}"
                    data-print-icon-height="${lobeLayout.height}"
                    data-print-offset-x="${x}"
                    data-print-offset-y="${y}"
                    style="
                        --print-badge-offset-x:${x}px;
                        --print-badge-offset-y:${y}px;
                        position:absolute;
                        left:50%;
                        top:50%;
                        width:${lobeLayout.width}px;
                        min-width:${lobeLayout.width}px;
                        height:${lobeLayout.height}px;
                        transform:translate(calc(-50% + var(--print-badge-offset-x)), calc(-50% + var(--print-badge-offset-y)));
                        pointer-events:none;
                    "
                >
                    ${lobeHtml}
                </div>
            </div>
        `,
        iconSize: [lobeLayout.width, lobeLayout.height],
        iconAnchor: [lobeLayout.width / 2, lobeLayout.height / 2],
        popupAnchor: [0, -20],
        tooltipAnchor: [0, -20],
    });
}

function renderCategoryBubbleFallbackIcon() {
    return `
        <svg class="directory-category-bubble-marker__fallback" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M12 20.5c-.28 0-.56-.09-.78-.27C7.12 16.79 4 14.17 4 10.58 4 8.23 5.9 6.33 8.25 6.33c1.5 0 2.92.77 3.75 2.01.83-1.24 2.25-2.01 3.75-2.01C18.1 6.33 20 8.23 20 10.58c0 3.59-3.12 6.21-7.22 9.65-.22.18-.5.27-.78.27Z" />
        </svg>
    `;
}

function createCategoryBubbleMarker(pin = {}, {
    emphasis = 'default',
    activePlaceKeys = new Set(),
    compact = false,
} = {}) {
    const bubbleItems = normalizeCategoryBubbleItems(pin.categoryBubbleItems || null, pin);
    const lobeLayout = getCategoryBubbleLobeLayout(bubbleItems.length, compact);
    const lobeDiameter = compact ? DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER : DIRECTORY_CATEGORY_BUBBLE_DIAMETER;
    const lobeClassName = compact
        ? 'directory-category-bubble-marker__lobe directory-category-bubble-marker__lobe--compact-dot'
        : 'directory-category-bubble-marker__lobe';
    const markerKey = bubbleItems.map((item) => `${item.placeKey || ''}:${item.color || ''}:${item.iconUrl || ''}`).join('|') || pin.placeKey || '';
    const markerNumber = Number(pin.number) || Number.MAX_SAFE_INTEGER;
    const markerSelected = emphasis === 'primary';
    const activeKeys = activePlaceKeys instanceof Set ? activePlaceKeys : new Set(activePlaceKeys || []);
    const lobeHtml = bubbleItems.map((item, index) => {
        const lobe = lobeLayout.lobes[index] || { left: 0, top: 0 };
        const isSelected = markerSelected || activeKeys.has(String(item.placeKey)) || activeKeys.has(String(pin.placeKey));
        const shadowColor = isSelected
            ? '0 12px 20px rgba(194,65,12,0.34), 0 0 0 6px rgba(249,115,22,0.24)'
            : '0 8px 16px rgba(15,23,42,0.2)';
        const content = item.iconUrl
            ? `<img class="directory-category-bubble-marker__icon" src="${escapeHtml(item.iconUrl)}" alt="" />`
            : renderCategoryBubbleFallbackIcon();
        return `
            <span
                class="${lobeClassName}"
                data-category-bubble-place-key="${escapeHtml(item.placeKey || '')}"
                style="
                    position:absolute;
                    left:${lobe.left}px;
                    top:${lobe.top}px;
                    width:${lobeDiameter}px;
                    height:${lobeDiameter}px;
                    box-sizing:border-box;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border:0;
                    border-radius:999px;
                    background:#ffffff;
                    color:${item.color};
                    box-shadow:${shadowColor};
                    overflow:hidden;
                    pointer-events:auto;
                "
            >
                <span class="directory-category-bubble-marker__content">
                    ${content}
                </span>
                <span
                    class="directory-category-bubble-marker__ring"
                    style="border-color:${item.color};"
                    aria-hidden="true"
                ></span>
            </span>
        `;
    }).join('');

    return L.divIcon({
        className: 'directory-category-bubble-leaflet-icon',
        placeKey: pin.placeKey,
        categoryColor: pin.categoryColor || null,
        html: `
            <div
                class="directory-category-bubble-marker"
                style="
                    position:relative;
                    width:${lobeLayout.width}px;
                    height:${lobeLayout.height}px;
                    pointer-events:none;
                "
            >
                <div
                    class="directory-category-bubble-marker__core"
                    data-print-marker-key="${escapeHtml(markerKey)}"
                    data-print-number="${escapeHtml(markerNumber)}"
                    data-print-lobe-count="${bubbleItems.length}"
                    data-print-icon-width="${lobeLayout.width}"
                    data-print-icon-height="${lobeLayout.height}"
                    data-print-offset-x="0"
                    data-print-offset-y="0"
                    style="
                        --print-badge-offset-x:0px;
                        --print-badge-offset-y:0px;
                        position:absolute;
                        left:50%;
                        top:50%;
                        width:${lobeLayout.width}px;
                        min-width:${lobeLayout.width}px;
                        height:${lobeLayout.height}px;
                        transform:translate(calc(-50% + var(--print-badge-offset-x)), calc(-50% + var(--print-badge-offset-y)));
                        pointer-events:none;
                    "
                >
                    ${lobeHtml}
                </div>
            </div>
        `,
        iconSize: [lobeLayout.width, lobeLayout.height],
        iconAnchor: [lobeLayout.width / 2, lobeLayout.height / 2],
        popupAnchor: [0, -20],
        tooltipAnchor: [0, -20],
    });
}

function getCategoryBubblePlaceKeyFromEvent(event, fallbackPlaceKey) {
    const target = event?.originalEvent?.target;
    const element = target?.closest?.('.directory-category-bubble-marker__lobe[data-category-bubble-place-key]');
    return element?.dataset?.categoryBubblePlaceKey || fallbackPlaceKey || null;
}

function getDirectoryClusterAssetCount(children = []) {
    return children.reduce((total, marker) => {
        const assetCount = Number(marker.options?.icon?.options?.assetCount || marker.options?.assetCount || 0);
        return total + (Number.isFinite(assetCount) && assetCount > 0 ? assetCount : 1);
    }, 0);
}

function getDirectoryClusterPlaceKey(children = []) {
    return `cluster:${children
        .map((marker) => marker.options?.icon?.options?.placeKey || marker.options?.placeKey)
        .filter(Boolean)
        .sort()
        .join('|')}`;
}

function getAssetSpreadPlaceKeyFromEvent(event) {
    const originalEvent = event?.originalEvent;
    const target = originalEvent?.target;
    if (!target || typeof target.closest !== 'function') return null;
    const directPinElement = target.closest('.directory-asset-spread-cluster__pin[data-place-key]');
    const clusterElement = target.closest('.directory-asset-spread-cluster');
    const clientX = Number(originalEvent.clientX);
    const clientY = Number(originalEvent.clientY);

    if (
        clusterElement
        && Number.isFinite(clientX)
        && Number.isFinite(clientY)
        && typeof clusterElement.querySelectorAll === 'function'
    ) {
        const candidates = Array.from(clusterElement.querySelectorAll('.directory-asset-spread-cluster__hit-zone[data-place-key]'))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const containsPointer = (
                    clientX >= rect.left - 2
                    && clientX <= rect.right + 2
                    && clientY >= rect.top - 2
                    && clientY <= rect.bottom + 2
                );
                return {
                    element,
                    containsPointer,
                    distance: Math.hypot(clientX - centerX, clientY - centerY),
                };
            })
            .filter((candidate) => candidate.containsPointer)
            .sort((left, right) => left.distance - right.distance);

        return candidates[0]?.element?.getAttribute('data-place-key') || null;
    }

    return directPinElement?.getAttribute('data-place-key') || null;
}

function getDirectoryAssetSpreadLayout(count = 0) {
    const visibleCount = Math.min(Math.max(1, count), DIRECTORY_ASSET_SPREAD_CLUSTER_MAX_VISIBLE);
    if (visibleCount === 1) {
        return {
            iconSize: [72, 78],
            pins: [{ x: 0, y: 0, scale: 0.92 }],
        };
    }

    if (visibleCount <= 4) {
        const layouts = {
            2: [
                { x: -7, y: 2, scale: 0.94, rotate: -4 },
                { x: 7, y: 2, scale: 0.94, rotate: 4 },
            ],
            3: [
                { x: -12, y: 8, scale: 0.86, rotate: -5 },
                { x: 0, y: -5, scale: 0.92, rotate: 0 },
                { x: 12, y: 8, scale: 0.86, rotate: 5 },
            ],
            4: [
                { x: -13, y: -5, scale: 0.8, rotate: -5 },
                { x: 13, y: -5, scale: 0.8, rotate: 5 },
                { x: -8, y: 13, scale: 0.78, rotate: -3 },
                { x: 8, y: 13, scale: 0.78, rotate: 3 },
            ],
        };

        return {
            iconSize: [86, 86],
            pins: layouts[visibleCount],
        };
    }

    const radius = visibleCount <= 6 ? 42 : 50;
    const scale = visibleCount <= 6 ? 0.68 : 0.62;
    return {
        iconSize: [156, 148],
        pins: Array.from({ length: visibleCount }, (_, index) => {
            const angle = (-Math.PI / 2) + ((Math.PI * 2) / visibleCount) * index;
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                scale,
            };
        }),
    };
}

function createDirectoryAssetSpreadClusterIcon(children = [], emphasizedPlaceKeys = new Set()) {
    const sortedChildren = [...children].sort((left, right) => {
        const leftKey = String(left.options?.icon?.options?.placeKey || left.options?.placeKey || '');
        const rightKey = String(right.options?.icon?.options?.placeKey || right.options?.placeKey || '');
        const leftActive = emphasizedPlaceKeys.has(leftKey) ? 1 : 0;
        const rightActive = emphasizedPlaceKeys.has(rightKey) ? 1 : 0;
        if (leftActive !== rightActive) return leftActive - rightActive;
        return leftKey.localeCompare(rightKey);
    });
    const visibleChildren = sortedChildren.slice(0, DIRECTORY_ASSET_SPREAD_CLUSTER_MAX_VISIBLE);
    const layout = getDirectoryAssetSpreadLayout(visibleChildren.length);
    const [width, height] = layout.iconSize;
    const hasHiddenChildren = sortedChildren.length > visibleChildren.length;
    const isHighlighted = visibleChildren.some((marker) => {
        const placeKey = String(marker.options?.icon?.options?.placeKey || marker.options?.placeKey || '');
        return emphasizedPlaceKeys.has(placeKey);
    });
    const pinMarkup = visibleChildren.map((marker, index) => {
        const iconOptions = marker.options?.icon?.options || {};
        const placeKey = iconOptions.placeKey || marker.options?.placeKey || '';
        const html = iconOptions.html || createSavedPlacePinIcon({
            count: iconOptions.curatedCount || 0,
            emphasis: emphasizedPlaceKeys.has(String(placeKey)) ? 'primary' : 'default',
            tone: 'saved',
            iconUrl: iconOptions.categoryIconUrl || null,
            color: iconOptions.categoryColor || null,
            colorSegments: iconOptions.categoryColorSegments || [],
            placeKey,
            showBadge: false,
        }).options.html;
        const position = layout.pins[index] || { x: 0, y: 0, scale: 0.72, rotate: 0 };
        const zIndex = emphasizedPlaceKeys.has(String(placeKey)) ? 90 : 10 + index;
        return `
            <div
                class="directory-asset-spread-cluster__pin"
                data-place-key="${escapeHtml(placeKey)}"
                style="
                    position:absolute;
                    left:50%;
                    top:50%;
                    width:48px;
                    height:64px;
                    transform:translate(-50%, -50%) translate(${position.x}px, ${position.y}px) rotate(${position.rotate || 0}deg) scale(${position.scale});
                    transform-origin:center bottom;
                    z-index:${zIndex};
                    pointer-events:auto;
                    cursor:pointer;
                "
            >
                <div
                    class="directory-asset-spread-cluster__hit-zone"
                    data-place-key="${escapeHtml(placeKey)}"
                    aria-hidden="true"
                    style="
                        position:absolute;
                        left:50%;
                        top:4px;
                        width:30px;
                        height:43px;
                        transform:translateX(-50%);
                        border-radius:999px 999px 18px 18px;
                        pointer-events:none;
                    "
                ></div>
                ${html}
            </div>
        `;
    }).join('');
    const hiddenMarkup = hasHiddenChildren
        ? `
            <div
                class="directory-asset-spread-cluster__more"
                style="
                    position:absolute;
                    right:10px;
                    bottom:8px;
                    z-index:110;
                    min-width:28px;
                    height:24px;
                    padding:0 7px;
                    border-radius:999px;
                    border:2px solid #ffffff;
                    background:#0f766e;
                    color:#ffffff;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:11px;
                    line-height:1;
                    font-weight:900;
                    box-shadow:0 10px 20px rgba(15,23,42,0.18);
                    font-family:var(--font-heading);
                "
            >+${escapeHtml(sortedChildren.length - visibleChildren.length)}</div>
        `
        : '';

    return L.divIcon({
        className: '',
        html: `
            <div
                class="directory-asset-spread-cluster ${isHighlighted ? 'directory-asset-spread-cluster--active' : ''}"
                style="
                    position:relative;
                    width:${width}px;
                    height:${height}px;
                    overflow:visible;
                    pointer-events:auto;
                "
            >
                ${pinMarkup}
                ${hiddenMarkup}
            </div>
        `,
        iconSize: [width, height],
        iconAnchor: [Math.round(width / 2), Math.round(height / 2)],
        popupAnchor: [0, -Math.round(height / 2)],
        tooltipAnchor: [0, -Math.round(height / 2)],
        placeKey: getDirectoryClusterPlaceKey(children),
    });
}

function createDirectoryClusterIcon(cluster, emphasizedPlaceKeys = new Set(), clusterMarkerMode = 'bubble') {
    const count = cluster.getChildCount();
    const children = cluster.getAllChildMarkers();
    const assetCount = getDirectoryClusterAssetCount(children);
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

    if (clusterMarkerMode === 'asset-spread') {
        return createDirectoryAssetSpreadClusterIcon(children, emphasizedPlaceKeys);
    }

    if (clusterMarkerMode === 'saved-pin') {
        const icon = createSavedPlacePinIcon({
            count,
            emphasis: isHighlighted ? 'primary' : 'default',
            tone: 'saved',
            placeKey: getDirectoryClusterPlaceKey(children),
        });

        return icon;
    }

    if (clusterMarkerMode === 'postal-group') {
        const icon = createPostalGroupParentPinIcon({
            count: assetCount,
            badgeCount: 0,
            emphasis: isHighlighted ? 'primary' : 'default',
            placeKey: getDirectoryClusterPlaceKey(children),
            showBadge: false,
        });

        return icon;
    }

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

function spreadPinsForDisplay(pins, interactive, shouldSpread = true) {
    if (!shouldSpread) {
        return pins.map((pin) => {
            const point = getPinBasePoint(pin);
            return {
                ...pin,
                displayLat: point?.lat ?? pin.lat,
                displayLng: point?.lng ?? pin.lng,
            };
        });
    }

    const groupedPins = new Map();

    pins.forEach((pin) => {
        const point = getPinBasePoint(pin);
        const key = point ? `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}` : `${pin.placeKey || pin.pinKey || ''}`;
        const group = groupedPins.get(key) || [];
        group.push(pin);
        groupedPins.set(key, group);
    });

    return pins.map((pin) => {
        const point = getPinBasePoint(pin);
        const key = point ? `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}` : `${pin.placeKey || pin.pinKey || ''}`;
        const group = groupedPins.get(key) || [];

        if (group.length <= 1 || !point) {
            return {
                ...pin,
                displayLat: point?.lat ?? pin.lat,
                displayLng: point?.lng ?? pin.lng,
            };
        }

        const index = group.findIndex((candidate) => candidate.placeKey === pin.placeKey);
        const angle = ((Math.PI * 2) / group.length) * index;
        const offset = interactive ? 0.00018 : 0.00014;

        return {
            ...pin,
            displayLat: point.lat + Math.sin(angle) * offset,
            displayLng: point.lng + Math.cos(angle) * offset,
        };
    });
}

function getPrintBadgeBubbleCircles(item, offset) {
    const deltaX = (offset.x - item.initialOffsetX) * item.scaleX;
    const deltaY = (offset.y - item.initialOffsetY) * item.scaleY;
    return item.lobes.map((lobe) => ({
        x: item.centerX + lobe.x + deltaX,
        y: item.centerY + lobe.y + deltaY,
        radius: lobe.radius,
    }));
}

function getPrintBadgeBubbleBounds(item, offset) {
    const circles = getPrintBadgeBubbleCircles(item, offset);
    return circles.reduce((bounds, circle) => ({
        left: Math.min(bounds.left, circle.x - circle.radius),
        right: Math.max(bounds.right, circle.x + circle.radius),
        top: Math.min(bounds.top, circle.y - circle.radius),
        bottom: Math.max(bounds.bottom, circle.y + circle.radius),
    }), {
        left: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
    });
}

function getPrintBadgeBubbleFallbackVector(leftItem, rightItem) {
    const anchorX = rightItem.centerX - leftItem.centerX;
    const anchorY = rightItem.centerY - leftItem.centerY;
    const anchorDistance = Math.hypot(anchorX, anchorY);
    if (anchorDistance > 0.01) {
        return { x: anchorX / anchorDistance, y: anchorY / anchorDistance };
    }

    const numberDelta = (rightItem.printNumber || 1) - (leftItem.printNumber || 0);
    const angle = ((Number.isFinite(numberDelta) ? numberDelta : 1) * 137.508) * (Math.PI / 180);
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

function isPrintBadgeAnchorNearMap(item, mapBounds) {
    if (!mapBounds) return true;

    const tolerance = DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_ANCHOR_TOLERANCE;
    return (
        item.centerX >= mapBounds.left - tolerance
        && item.centerX <= mapBounds.right + tolerance
        && item.centerY >= mapBounds.top - tolerance
        && item.centerY <= mapBounds.bottom + tolerance
    );
}

function isLeafletMapCameraMoving(map) {
    return Boolean(
        map?._animatingZoom
        || map?._panAnim?._inProgress
        || map?._flyToFrame
    );
}

function limitPrintBadgeBubbleOffset(item, offset) {
    const deltaX = (offset.x - item.initialOffsetX) * item.scaleX;
    const deltaY = (offset.y - item.initialOffsetY) * item.scaleY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= DIRECTORY_PRINT_BADGE_BUBBLE_MAX_OFFSET || distance <= 0.01) {
        return offset;
    }

    const scale = DIRECTORY_PRINT_BADGE_BUBBLE_MAX_OFFSET / distance;
    return {
        x: item.initialOffsetX + ((deltaX * scale) / item.scaleX),
        y: item.initialOffsetY + ((deltaY * scale) / item.scaleY),
    };
}

function keepPrintBadgeBubbleInsideMap(item, offset, mapBounds) {
    if (!mapBounds) return offset;
    if (!isPrintBadgeAnchorNearMap(item, mapBounds)) return offset;

    const bounds = getPrintBadgeBubbleBounds(item, offset);
    const minLeft = mapBounds.left + DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_PADDING;
    const maxRight = mapBounds.right - DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_PADDING;
    const minTop = mapBounds.top + DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_PADDING;
    const maxBottom = mapBounds.bottom - DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_PADDING;
    let nextX = offset.x;
    let nextY = offset.y;

    if (bounds.left < minLeft) nextX += (minLeft - bounds.left) / item.scaleX;
    if (bounds.right > maxRight) nextX -= (bounds.right - maxRight) / item.scaleX;
    if (bounds.top < minTop) nextY += (minTop - bounds.top) / item.scaleY;
    if (bounds.bottom > maxBottom) nextY -= (bounds.bottom - maxBottom) / item.scaleY;

    return { x: nextX, y: nextY };
}

function settlePrintBadgeBubbleOffset(item, offset, mapBounds) {
    return keepPrintBadgeBubbleInsideMap(item, limitPrintBadgeBubbleOffset(item, offset), mapBounds);
}

function resolvePrintBadgeBubbleLayout(items, mapBounds = null) {
    const states = items.map((item) => ({
        item,
        mass: Math.max(1, item.lobes.length * 1.45),
        offset: {
            x: item.layoutOffsetX ?? item.initialOffsetX,
            y: item.layoutOffsetY ?? item.initialOffsetY,
        },
    }));

    for (let iteration = 0; iteration < DIRECTORY_PRINT_BADGE_BUBBLE_ITERATIONS; iteration += 1) {
        let moved = false;

        for (let leftIndex = 0; leftIndex < states.length - 1; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < states.length; rightIndex += 1) {
                const leftState = states[leftIndex];
                const rightState = states[rightIndex];
                const leftCircles = getPrintBadgeBubbleCircles(leftState.item, leftState.offset);
                const rightCircles = getPrintBadgeBubbleCircles(rightState.item, rightState.offset);

                leftCircles.forEach((leftCircle) => {
                    rightCircles.forEach((rightCircle) => {
                        const dx = rightCircle.x - leftCircle.x;
                        const dy = rightCircle.y - leftCircle.y;
                        const distance = Math.hypot(dx, dy);
                        const minimumDistance = leftCircle.radius + rightCircle.radius + DIRECTORY_PRINT_BADGE_BUBBLE_GAP;
                        if (distance >= minimumDistance) return;

                        const vector = distance > 0.01
                            ? { x: dx / distance, y: dy / distance }
                            : getPrintBadgeBubbleFallbackVector(leftState.item, rightState.item);
                        const overlap = minimumDistance - Math.max(distance, 0.01);
                        const leftInverseMass = 1 / leftState.mass;
                        const rightInverseMass = 1 / rightState.mass;
                        const inverseMassTotal = leftInverseMass + rightInverseMass;
                        const leftPush = overlap * (leftInverseMass / inverseMassTotal);
                        const rightPush = overlap * (rightInverseMass / inverseMassTotal);

                        leftState.offset.x -= (vector.x * leftPush) / leftState.item.scaleX;
                        leftState.offset.y -= (vector.y * leftPush) / leftState.item.scaleY;
                        rightState.offset.x += (vector.x * rightPush) / rightState.item.scaleX;
                        rightState.offset.y += (vector.y * rightPush) / rightState.item.scaleY;
                        moved = true;
                    });
                });
            }
        }

        states.forEach((state) => {
            state.offset = settlePrintBadgeBubbleOffset(state.item, state.offset, mapBounds);
        });

        if (!moved) break;
    }

    return states.map(({ item, offset }) => ({
        item,
        offset: {
            x: Math.round(offset.x * 10) / 10,
            y: Math.round(offset.y * 10) / 10,
        },
    }));
}

function ensurePrintBadgeBaseMargins(markerElement) {
    if (!markerElement) {
        return { left: 0, top: 0 };
    }

    if (!markerElement.dataset.printCollisionBaseMarginLeft) {
        markerElement.dataset.printCollisionBaseMarginLeft = String(normalizeStylePixel(markerElement.style.marginLeft));
    }
    if (!markerElement.dataset.printCollisionBaseMarginTop) {
        markerElement.dataset.printCollisionBaseMarginTop = String(normalizeStylePixel(markerElement.style.marginTop));
    }

    return {
        left: normalizeStylePixel(markerElement.dataset.printCollisionBaseMarginLeft),
        top: normalizeStylePixel(markerElement.dataset.printCollisionBaseMarginTop),
    };
}

function getPrintBadgeStoredOffset(markerKey, solvedOffsets) {
    if (!markerKey || !solvedOffsets?.has(markerKey)) {
        return null;
    }

    const offset = solvedOffsets.get(markerKey);
    if (!Number.isFinite(offset?.x) || !Number.isFinite(offset?.y)) {
        return null;
    }

    return offset;
}

function hasPrintBadgeStoredOffsetDrift(markerElement, coreElement, solvedOffsets) {
    if (!markerElement || !coreElement || !solvedOffsets?.size) return false;

    const markerKey = coreElement.dataset.printMarkerKey || coreElement.dataset.printNumber || '';
    const storedOffset = getPrintBadgeStoredOffset(markerKey, solvedOffsets);
    if (!storedOffset) return false;

    const baseMargins = ensurePrintBadgeBaseMargins(markerElement);
    const expectedLeft = baseMargins.left + storedOffset.x;
    const expectedTop = baseMargins.top + storedOffset.y;
    const currentLeft = normalizeStylePixel(markerElement.style.marginLeft);
    const currentTop = normalizeStylePixel(markerElement.style.marginTop);

    return Math.abs(currentLeft - expectedLeft) > 0.5 || Math.abs(currentTop - expectedTop) > 0.5;
}

function hasAnyPrintBadgeStoredOffsetDrift(markerPane, solvedOffsets) {
    if (!markerPane || !solvedOffsets?.size) return false;

    return [...markerPane.querySelectorAll(DIRECTORY_BUBBLE_MARKER_CORE_SELECTOR)].some((coreElement) => {
        const markerElement = coreElement.closest('.leaflet-marker-icon');
        return hasPrintBadgeStoredOffsetDrift(markerElement, coreElement, solvedOffsets);
    });
}

function restorePrintBadgeStoredOffsets(markerPane, solvedOffsets) {
    if (!markerPane || !solvedOffsets?.size) return;

    [...markerPane.querySelectorAll(DIRECTORY_BUBBLE_MARKER_CORE_SELECTOR)].forEach((coreElement) => {
        const markerElement = coreElement.closest('.leaflet-marker-icon');
        if (!markerElement) return;

        const markerKey = coreElement.dataset.printMarkerKey || coreElement.dataset.printNumber || '';
        const storedOffset = getPrintBadgeStoredOffset(markerKey, solvedOffsets);
        if (!storedOffset) return;

        const baseMargins = ensurePrintBadgeBaseMargins(markerElement);
        markerElement.style.marginLeft = `${baseMargins.left + storedOffset.x}px`;
        markerElement.style.marginTop = `${baseMargins.top + storedOffset.y}px`;
        markerElement.dataset.printCollisionSolved = 'true';
        coreElement.style.setProperty('--print-badge-offset-x', '0px');
        coreElement.style.setProperty('--print-badge-offset-y', '0px');
    });
}

function applyPrintBadgeMarkerOffset(item, offset, solvedOffsets = null) {
    if (!item?.markerElement) return;

    item.markerElement.style.marginLeft = `${item.baseMarginLeft + offset.x}px`;
    item.markerElement.style.marginTop = `${item.baseMarginTop + offset.y}px`;
    item.markerElement.dataset.printCollisionSolved = 'true';
    if (item.markerKey && solvedOffsets) {
        solvedOffsets.set(item.markerKey, { x: offset.x, y: offset.y });
    }
    item.coreElement.style.setProperty('--print-badge-offset-x', '0px');
    item.coreElement.style.setProperty('--print-badge-offset-y', '0px');
}

function DirectoryCategoryBubbleZoomClassSync({ enabled, onCompactChange }) {
    const map = useMap();

    useEffect(() => {
        const container = map?.getContainer?.();
        if (!container) return undefined;

        const syncCompactClass = () => {
            const zoom = Number(map.getZoom?.());
            const shouldShowDots = enabled
                && Number.isFinite(zoom)
                && zoom <= DIRECTORY_CATEGORY_BUBBLE_DOT_ZOOM_THRESHOLD;
            container.classList.toggle('directory-map--category-bubbles-compact', shouldShowDots);
            onCompactChange?.(shouldShowDots);
        };

        syncCompactClass();
        map.on('zoomend', syncCompactClass);
        map.on('moveend', syncCompactClass);

        return () => {
            map.off('zoomend', syncCompactClass);
            map.off('moveend', syncCompactClass);
            container.classList.remove('directory-map--category-bubbles-compact');
            onCompactChange?.(false);
        };
    }, [enabled, map, onCompactChange]);

    return null;
}

function DirectoryPrintBadgeCollisionSync({ enabled, refreshKey = '', preserveSolvedOffsets = false }) {
    const map = useMap();
    const mapTransitionUntilRef = useRef(0);
    const solvedOffsetsRef = useRef(new Map());

    useEffect(() => {
        if (!enabled || !map) return undefined;

        const markerPane = map.getPanes?.()?.markerPane;
        if (!markerPane) return undefined;

        const timeouts = new Set();
        const markMapTransitioning = () => {
            mapTransitionUntilRef.current = Date.now() + DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS;
        };
        const isMapTransitioning = () => (
            Date.now() < mapTransitionUntilRef.current || isLeafletMapCameraMoving(map)
        );

        const resolveCollisions = () => {
            const mapBounds = map.getContainer?.()?.getBoundingClientRect?.() || null;
            const markerElements = [...markerPane.querySelectorAll('.leaflet-marker-icon')]
                .map((markerElement) => {
                    const coreElement = markerElement.querySelector(DIRECTORY_BUBBLE_MARKER_CORE_SELECTOR);
                    if (!coreElement) return null;

                    const baseMargins = ensurePrintBadgeBaseMargins(markerElement);
                    const initialOffsetX = normalizeMarkerOffset(coreElement.dataset.printOffsetX);
                    const initialOffsetY = normalizeMarkerOffset(coreElement.dataset.printOffsetY);
                    const markerKey = coreElement.dataset.printMarkerKey || coreElement.dataset.printNumber || '';
                    const storedOffset = getPrintBadgeStoredOffset(markerKey, solvedOffsetsRef.current);
                    const isFocusedZoom = typeof map.getZoom === 'function' && map.getZoom() >= DIRECTORY_PRINT_BADGE_COLLISION_FOCUS_ZOOM;
                    if (isFocusedZoom && storedOffset) {
                        markerElement.style.marginLeft = `${baseMargins.left + storedOffset.x}px`;
                        markerElement.style.marginTop = `${baseMargins.top + storedOffset.y}px`;
                        markerElement.dataset.printCollisionSolved = 'true';
                        coreElement.style.setProperty('--print-badge-offset-x', '0px');
                        coreElement.style.setProperty('--print-badge-offset-y', '0px');
                        return null;
                    }

                    const markerRect = markerElement.getBoundingClientRect();
                    const markerCenterX = markerRect.left + (markerRect.width / 2);
                    const markerCenterY = markerRect.top + (markerRect.height / 2);
                    const hasSolvedOffset = markerElement.dataset.printCollisionSolved === 'true';
                    if (hasSolvedOffset && !isPrintBadgeAnchorNearMap({ centerX: markerCenterX, centerY: markerCenterY }, mapBounds)) {
                        return null;
                    }

                    markerElement.style.marginLeft = `${baseMargins.left + initialOffsetX}px`;
                    markerElement.style.marginTop = `${baseMargins.top + initialOffsetY}px`;
                    coreElement.style.setProperty('--print-badge-offset-x', '0px');
                    coreElement.style.setProperty('--print-badge-offset-y', '0px');

                    return {
                        markerElement,
                        coreElement,
                        baseMargins,
                        initialOffsetX,
                        initialOffsetY,
                        layoutOffsetX: preserveSolvedOffsets ? (storedOffset?.x ?? initialOffsetX) : initialOffsetX,
                        layoutOffsetY: preserveSolvedOffsets ? (storedOffset?.y ?? initialOffsetY) : initialOffsetY,
                        markerKey,
                    };
                })
                .filter(Boolean);

            const badgeItems = markerElements
                .map((markerElement) => {
                    const {
                        markerElement: markerNode,
                        coreElement,
                        baseMargins,
                        initialOffsetX,
                        initialOffsetY,
                        layoutOffsetX,
                        layoutOffsetY,
                        markerKey,
                    } = markerElement;

                    const markerRect = markerNode.getBoundingClientRect();
                    const iconWidth = normalizeMarkerOffset(coreElement.dataset.printIconWidth) || DIRECTORY_PRINT_BADGE_DIAMETER;
                    const iconHeight = normalizeMarkerOffset(coreElement.dataset.printIconHeight) || DIRECTORY_PRINT_BADGE_DIAMETER;
                    const scaleX = markerRect.width / iconWidth || 1;
                    const scaleY = markerRect.height / iconHeight || 1;
                    const printNumber = Number.parseFloat(coreElement.dataset.printNumber);
                    const lobeElements = [...coreElement.querySelectorAll(DIRECTORY_BUBBLE_MARKER_LOBE_SELECTOR)];
                    const fallbackRect = coreElement.getBoundingClientRect();
                    const markerCenterX = markerRect.left + (markerRect.width / 2);
                    const markerCenterY = markerRect.top + (markerRect.height / 2);
                    const lobes = (lobeElements.length ? lobeElements : [coreElement])
                        .map((lobeElement) => {
                            const lobeRect = lobeElement === coreElement ? fallbackRect : lobeElement.getBoundingClientRect();
                            const width = lobeRect.width || DIRECTORY_PRINT_BADGE_DIAMETER;
                            const height = lobeRect.height || DIRECTORY_PRINT_BADGE_DIAMETER;
                            return {
                                x: lobeRect.left + (width / 2) - markerCenterX,
                                y: lobeRect.top + (height / 2) - markerCenterY,
                                radius: (Math.max(width, height) / 2) + 0.5,
                            };
                        });

                    return {
                        markerElement: markerNode,
                        coreElement,
                        markerKey,
                        printNumber: Number.isFinite(printNumber) ? printNumber : Number.MAX_SAFE_INTEGER,
                        centerX: markerCenterX,
                        centerY: markerCenterY,
                        lobes,
                        initialOffsetX,
                        initialOffsetY,
                        layoutOffsetX,
                        layoutOffsetY,
                        baseMarginLeft: baseMargins.left,
                        baseMarginTop: baseMargins.top,
                        scaleX,
                        scaleY,
                    };
                })
                .filter(Boolean)
                .sort((left, right) => left.printNumber - right.printNumber);

            resolvePrintBadgeBubbleLayout(badgeItems, mapBounds).forEach(({ item, offset }) => {
                applyPrintBadgeMarkerOffset(item, offset, solvedOffsetsRef.current);
            });
        };

        const scheduleCollisionPass = (delay = 80, { force = false } = {}) => {
            const resolvedDelay = typeof delay === 'number' ? delay : 80;
            const timeout = window.setTimeout(() => {
                timeouts.delete(timeout);
                if (!force && isMapTransitioning()) {
                    restorePrintBadgeStoredOffsets(markerPane, solvedOffsetsRef.current);
                    const remainingDelay = Math.max(40, mapTransitionUntilRef.current - Date.now() + 40);
                    scheduleCollisionPass(Math.min(remainingDelay, DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS));
                    return;
                }
                resolveCollisions();
            }, resolvedDelay);
            timeouts.add(timeout);
        };
        const restoreDriftedStoredOffsets = () => {
            if (!preserveSolvedOffsets) return false;
            if (!hasAnyPrintBadgeStoredOffsetDrift(markerPane, solvedOffsetsRef.current)) return false;

            restorePrintBadgeStoredOffsets(markerPane, solvedOffsetsRef.current);
            return true;
        };
        const handleMapSettled = () => {
            markMapTransitioning();
            scheduleCollisionPass(DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS);
            scheduleCollisionPass(DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS + 180);
            scheduleCollisionPass(DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS + 360, { force: true });
        };
        let observer = null;

        DIRECTORY_PRINT_BADGE_COLLISION_SCHEDULE_DELAYS.forEach(scheduleCollisionPass);
        if (preserveSolvedOffsets && typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(() => {
                if (!restoreDriftedStoredOffsets()) return;
                scheduleCollisionPass(80);
            });
            observer.observe(markerPane, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                childList: true,
                subtree: true,
            });
        }
        map.on('movestart', markMapTransitioning);
        map.on('zoomstart', markMapTransitioning);
        map.on('move', markMapTransitioning);
        map.on('zoom', markMapTransitioning);
        map.on('moveend', handleMapSettled);
        map.on('zoomend', handleMapSettled);
        map.on('layeradd', scheduleCollisionPass);

        return () => {
            observer?.disconnect();
            timeouts.forEach((timeout) => window.clearTimeout(timeout));
            timeouts.clear();
            map.off('movestart', markMapTransitioning);
            map.off('zoomstart', markMapTransitioning);
            map.off('move', markMapTransitioning);
            map.off('zoom', markMapTransitioning);
            map.off('moveend', handleMapSettled);
            map.off('zoomend', handleMapSettled);
            map.off('layeradd', scheduleCollisionPass);
        };
    }, [enabled, map, preserveSolvedOffsets, refreshKey]);

    return null;
}

function fitDirectoryCamera(map, pins, anchorPoint, {
    animate = false,
    duration = 0.6,
    paddingTopLeft = DIRECTORY_FIT_PADDING_TOP_LEFT,
    paddingBottomRight = DIRECTORY_FIT_PADDING_BOTTOM_RIGHT,
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
            paddingTopLeft,
            paddingBottomRight,
            maxZoom: 16,
            duration,
        });
    } else {
        map.fitBounds(bounds, {
            paddingTopLeft,
            paddingBottomRight,
            maxZoom: 16,
            animate: false,
        });
    }

    return true;
}

function DirectoryMapRecenterControl({
    activeAnchor,
    pins,
    interactive,
    fitPaddingTopLeft,
    fitPaddingBottomRight,
    onResetView,
}) {
    const map = useMap();
    const { t } = useLocale();
    const anchorPoint = normalizeAnchorPoint(activeAnchor);
    const totalPointCount = (pins?.length || 0) + (anchorPoint ? 1 : 0);
    if (!interactive || totalPointCount <= 1) return null;
    
    return (
        <div className="leaflet-top leaflet-right z-[1000] pointer-events-auto mt-2.5 mr-2.5 sm:mt-3 sm:mr-3 absolute right-0 top-0">
            <div className="leaflet-control leaflet-bar border-none shadow-none mt-0 mr-0">
                <button
                    type="button"
                    title={t('mapResetView')}
                    aria-label={t('mapResetView')}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-brand-700"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onResetView?.();
                        fitDirectoryCamera(map, pins, anchorPoint, {
                            animate: true,
                            duration: 0.6,
                            paddingTopLeft: fitPaddingTopLeft,
                            paddingBottomRight: fitPaddingBottomRight,
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

function DirectoryClusterHoverSync({
    clusterGroupRef,
    enabled = true,
    clusterMarkerMode = 'bubble',
    activePlaceKeys = [],
    onPlaceActivate,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onHoverClusterStart,
    onHoverClusterEnd,
    onClusterSelect,
}) {
    const lastActivationRef = useRef({ token: null, at: 0 });
    const lastAssetSpreadHoverRef = useRef(null);

    useEffect(() => {
        const clusterGroup = clusterGroupRef.current;
        if (!enabled || !clusterGroup) return undefined;

        const resolveClusterPlaceKeys = (cluster) => cluster.getAllChildMarkers()
            .map((marker) => marker.options?.icon?.options?.placeKey || marker.options?.placeKey)
            .filter(Boolean);

        const shouldSkipHoverEvent = (event) => shouldIgnoreClusterHover({
            pointerType: event.originalEvent?.pointerType || '',
            coarsePointer: Boolean(event.originalEvent?.touches?.length)
                || Boolean(event.originalEvent?.changedTouches?.length)
                || Boolean(window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches),
        });

        const setAssetSpreadHover = (nextPlaceKey) => {
            const normalizedNextPlaceKey = nextPlaceKey ? String(nextPlaceKey) : null;
            const previousPlaceKey = lastAssetSpreadHoverRef.current;
            if (previousPlaceKey === normalizedNextPlaceKey) return;
            if (previousPlaceKey) {
                onHoverPlaceEnd?.(previousPlaceKey);
            }
            lastAssetSpreadHoverRef.current = normalizedNextPlaceKey;
            if (normalizedNextPlaceKey) {
                onHoverPlaceStart?.(normalizedNextPlaceKey);
            }
        };

        const updateAssetSpreadHover = (event) => {
            setAssetSpreadHover(getAssetSpreadPlaceKeyFromEvent(event));
        };

        const handleClusterMouseOver = (event) => {
            if (shouldSkipHoverEvent(event)) return;
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            if (clusterMarkerMode === 'asset-spread') {
                updateAssetSpreadHover(event);
                return;
            }
            onHoverClusterStart?.(resolveClusterPlaceKeys(cluster));
        };

        const handleClusterMouseMove = (event) => {
            if (clusterMarkerMode !== 'asset-spread') return;
            if (shouldSkipHoverEvent(event)) return;
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            updateAssetSpreadHover(event);
        };

        const handleClusterMouseOut = (event) => {
            if (shouldSkipHoverEvent(event)) return;
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            if (clusterMarkerMode === 'asset-spread') {
                setAssetSpreadHover(null);
                return;
            }
            onHoverClusterEnd?.(resolveClusterPlaceKeys(cluster));
        };

        const handleClusterActivate = (event) => {
            const cluster = event.layer;
            if (!cluster || typeof cluster.getChildCount !== 'function' || cluster.getChildCount() <= 1) return;
            event.originalEvent?.preventDefault?.();
            event.originalEvent?.stopPropagation?.();
            const assetSpreadPlaceKey = clusterMarkerMode === 'asset-spread'
                ? getAssetSpreadPlaceKeyFromEvent(event)
                : null;
            if (assetSpreadPlaceKey) {
                onPlaceActivate?.(assetSpreadPlaceKey);
                return;
            }
            const placeKeys = resolveClusterPlaceKeys(cluster);
            const token = buildClusterToken(placeKeys);
            const eventType = event.type || event.originalEvent?.type || '';
            const now = Date.now();

            if (isDuplicateClusterClick({
                eventType,
                token,
                now,
                lastEvent: lastActivationRef.current,
            })) {
                return;
            }

            lastActivationRef.current = { token, eventType, at: now };
            const mapInstance = clusterGroup._map || cluster._map;
            const activationAction = getClusterActivationAction(placeKeys, activePlaceKeys);
            if (activationAction === 'ignore') return;
            onClusterSelect?.(placeKeys);

            const currentZoom = typeof mapInstance?.getZoom === 'function' ? mapInstance.getZoom() : 0;
            if (currentZoom >= 16 && typeof cluster.spiderfy === 'function') {
                cluster.spiderfy();
                return;
            }
            const mapMaxZoom = typeof mapInstance?.getMaxZoom === 'function' ? mapInstance.getMaxZoom() : 16;
            const targetZoom = getClusterExpansionZoom({
                currentZoom,
                childCount: placeKeys.length,
                maxZoom: Math.min(mapMaxZoom, 16),
            });
            const childPoints = typeof cluster.getAllChildMarkers === 'function'
                ? cluster.getAllChildMarkers()
                    .map((marker) => marker.getLatLng?.())
                    .filter(Boolean)
                : [];
            const bounds = childPoints.length ? L.latLngBounds(childPoints) : null;
            const mapSize = typeof mapInstance?.getSize === 'function' ? mapInstance.getSize() : null;
            const compactMap = mapSize?.y && mapSize.y <= DIRECTORY_COMPACT_MAP_HEIGHT;
            const cameraPlan = getClusterCameraPlan({
                currentZoom,
                targetZoom,
                childCount: placeKeys.length,
                mapHeight: mapSize?.y || 0,
                compactMapHeight: DIRECTORY_COMPACT_MAP_HEIGHT,
            });

            const reframeClusterChildren = () => {
                if (!mapInstance || !bounds?.isValid?.()) return;
                const nextMapSize = typeof mapInstance.getSize === 'function' ? mapInstance.getSize() : mapSize;
                const nextCompactMap = nextMapSize?.y && nextMapSize.y <= DIRECTORY_COMPACT_MAP_HEIGHT;
                if (nextCompactMap) {
                    if (typeof mapInstance.fitBounds === 'function') {
                        mapInstance.fitBounds(bounds, {
                            paddingTopLeft: DIRECTORY_COMPACT_CLUSTER_FIT_PADDING_TOP_LEFT,
                            paddingBottomRight: DIRECTORY_COMPACT_CLUSTER_FIT_PADDING_BOTTOM_RIGHT,
                            maxZoom: cameraPlan.maxZoom,
                            animate: true,
                        });
                        return;
                    }
                    if (typeof mapInstance.panInsideBounds === 'function') {
                        mapInstance.panInsideBounds(bounds, {
                            paddingTopLeft: DIRECTORY_COMPACT_CLUSTER_PADDING_TOP_LEFT,
                            paddingBottomRight: DIRECTORY_COMPACT_CLUSTER_PADDING_BOTTOM_RIGHT,
                            animate: true,
                        });
                        return;
                    }
                    if (typeof mapInstance.panTo === 'function') {
                        mapInstance.panTo(bounds.getCenter(), { animate: true });
                    }
                    return;
                }
                if (typeof mapInstance.fitBounds === 'function') {
                    mapInstance.fitBounds(bounds, {
                        padding: DIRECTORY_CLUSTER_BOUNDS_PADDING,
                        maxZoom: cameraPlan.maxZoom,
                    });
                }
            };

            const center = cluster.getLatLng?.();
            if (
                mapInstance
                && cameraPlan.mode === 'zoom-then-fit-child-bounds'
                && center
                && typeof mapInstance.setView === 'function'
            ) {
                const reframeDelays = getClusterReframeDelays({
                    mode: cameraPlan.mode,
                    mapHeight: mapSize?.y || 0,
                    compactMapHeight: DIRECTORY_COMPACT_MAP_HEIGHT,
                    layoutTransitionMs: DIRECTORY_MOBILE_MAP_LAYOUT_TRANSITION_MS,
                });
                let scheduledReframes = false;
                const scheduleReframesOnce = () => {
                    if (scheduledReframes) return;
                    scheduledReframes = true;
                    reframeDelays.forEach((delay) => {
                        window.setTimeout(reframeClusterChildren, delay);
                    });
                };
                if (typeof mapInstance.once === 'function') {
                    mapInstance.once('zoomend', scheduleReframesOnce);
                }
                window.setTimeout(scheduleReframesOnce, 450);
                mapInstance.setView(center, cameraPlan.maxZoom, { animate: true });
                return;
            }

            if (
                mapInstance
                && cameraPlan.mode === 'fit-child-bounds'
                && bounds?.isValid?.()
                && typeof mapInstance.fitBounds === 'function'
            ) {
                mapInstance.fitBounds(bounds, compactMap
                    ? {
                        paddingTopLeft: DIRECTORY_COMPACT_CLUSTER_PADDING_TOP_LEFT,
                        paddingBottomRight: DIRECTORY_COMPACT_CLUSTER_PADDING_BOTTOM_RIGHT,
                        maxZoom: cameraPlan.maxZoom,
                    }
                    : {
                        padding: DIRECTORY_CLUSTER_BOUNDS_PADDING,
                        maxZoom: cameraPlan.maxZoom,
                    });
                return;
            }

            if (mapInstance && center && targetZoom > currentZoom && typeof mapInstance.setView === 'function') {
                mapInstance.setView(center, targetZoom, { animate: true });
                return;
            }
            if (mapInstance && typeof mapInstance.fitBounds === 'function') {
                if (bounds?.isValid?.()) {
                    mapInstance.fitBounds(bounds, compactMap
                        ? {
                            paddingTopLeft: DIRECTORY_COMPACT_CLUSTER_PADDING_TOP_LEFT,
                            paddingBottomRight: DIRECTORY_COMPACT_CLUSTER_PADDING_BOTTOM_RIGHT,
                            maxZoom: 17,
                        }
                        : {
                            padding: DIRECTORY_CLUSTER_BOUNDS_PADDING,
                        });
                    return;
                }
            }
            if (typeof cluster.zoomToBounds === 'function') {
                cluster.zoomToBounds({ padding: DIRECTORY_CLUSTER_BOUNDS_PADDING });
            }
        };

        clusterGroup.on('clustermouseover', handleClusterMouseOver);
        clusterGroup.on('clustermousemove', handleClusterMouseMove);
        clusterGroup.on('clustermouseout', handleClusterMouseOut);
        clusterGroup.on('clustermousedown', handleClusterActivate);
        clusterGroup.on('clusterclick', handleClusterActivate);

        return () => {
            setAssetSpreadHover(null);
            clusterGroup.off('clustermouseover', handleClusterMouseOver);
            clusterGroup.off('clustermousemove', handleClusterMouseMove);
            clusterGroup.off('clustermouseout', handleClusterMouseOut);
            clusterGroup.off('clustermousedown', handleClusterActivate);
            clusterGroup.off('clusterclick', handleClusterActivate);
        };
    }, [
        activePlaceKeys,
        clusterGroupRef,
        clusterMarkerMode,
        enabled,
        onClusterSelect,
        onHoverClusterEnd,
        onHoverClusterStart,
        onHoverPlaceEnd,
        onHoverPlaceStart,
        onPlaceActivate,
    ]);

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

function DirectoryMapController({
    activeAnchor,
    pins,
    focusedPlaceKey,
    focusedPlaceKeys = [],
    activePlaceKey,
    activePlaceKeys = [],
    interactive,
    layoutSignature = 'default',
    fitPaddingTopLeft = DIRECTORY_FIT_PADDING_TOP_LEFT,
    fitPaddingBottomRight = DIRECTORY_FIT_PADDING_BOTTOM_RIGHT,
    onMapSettled,
    onFocusHandled,
}) {
    const map = useMap();
    const previousSignatureRef = useRef('');
    const previousLayoutSignatureRef = useRef(layoutSignature);
    const anchorPoint = useMemo(() => normalizeAnchorPoint(activeAnchor), [activeAnchor]);
    const hasActivePlaceKeys = Boolean(activePlaceKeys?.length);

    const signature = useMemo(
        () => buildDirectoryCameraSignature(pins, anchorPoint),
        [anchorPoint, pins]
    );

    useEffect(() => {
        const previousLayoutSignature = previousLayoutSignatureRef.current;
        previousLayoutSignatureRef.current = layoutSignature;
        const shouldRefitAfterResize = shouldRefitDirectoryCameraAfterResize({
            previousLayoutSignature,
            nextLayoutSignature: layoutSignature,
            pointCount: getDirectoryCameraPoints(pins, anchorPoint).length,
            focusedPlaceKey,
            focusedPlaceKeys,
            activePlaceKey,
            hasActivePlaceKeys,
        });
        const resizeMap = () => {
            map.invalidateSize({ animate: false });
            if (shouldRefitAfterResize) {
                fitDirectoryCamera(map, pins, anchorPoint, {
                    animate: false,
                    paddingTopLeft: fitPaddingTopLeft,
                    paddingBottomRight: fitPaddingBottomRight,
                });
            }
        };
        const immediateResize = window.setTimeout(resizeMap, 0);
        const settledResize = window.setTimeout(resizeMap, 330);

        return () => {
            window.clearTimeout(immediateResize);
            window.clearTimeout(settledResize);
        };
    }, [activePlaceKey, anchorPoint, fitPaddingBottomRight, fitPaddingTopLeft, focusedPlaceKey, focusedPlaceKeys, hasActivePlaceKeys, layoutSignature, map, pins, signature]);

    useEffect(() => {
        if (!pins.length && !anchorPoint) return;
        if (previousSignatureRef.current === signature) return;
        previousSignatureRef.current = signature;

        fitDirectoryCamera(map, pins, anchorPoint, {
            animate: false,
            paddingTopLeft: fitPaddingTopLeft,
            paddingBottomRight: fitPaddingBottomRight,
        });
        window.setTimeout(() => onMapSettled?.(), 250);
    }, [anchorPoint, fitPaddingBottomRight, fitPaddingTopLeft, map, onMapSettled, pins, signature]);

    useEffect(() => {
        if (!focusedPlaceKey) return;
        if (!interactive) return;

        const isDeepZoom = String(focusedPlaceKey).endsWith(':zoom');
        const cleanKey = isDeepZoom ? String(focusedPlaceKey).replace(':zoom', '') : focusedPlaceKey;

        const pin = pins.find((item) => String(item.placeKey) === String(cleanKey));
        if (!pin) return;
        const targetPoint = getDirectoryPinMapPoint(pin);
        if (!targetPoint) return;

        const targetZoom = isDeepZoom ? 18 : DIRECTORY_FOCUS_ZOOM;

        map.flyTo([targetPoint.lat, targetPoint.lng], targetZoom, {
            animate: true,
            duration: 0.5,
        });
        onFocusHandled?.(focusedPlaceKey);
    }, [focusedPlaceKey, interactive, map, onFocusHandled, pins]);

    useEffect(() => {
        if (!focusedPlaceKeys?.length) return;
        if (!interactive) return;

        const focusedPins = getFocusedDirectoryCameraPins(pins, focusedPlaceKeys);
        if (!focusedPins.length) return;

        fitDirectoryCamera(map, focusedPins, null, {
            animate: true,
            duration: 0.5,
            paddingTopLeft: fitPaddingTopLeft,
            paddingBottomRight: fitPaddingBottomRight,
        });
        onFocusHandled?.(focusedPlaceKeys.join('|'));
    }, [fitPaddingBottomRight, fitPaddingTopLeft, focusedPlaceKeys, interactive, map, onFocusHandled, pins]);

    return null;
}

export default function DirectoryMap({
    pins = [],
    activeAnchor = null,
    focusedPlaceKey = null,
    focusedPlaceKeys = [],
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
    pinBadgeMode = 'count',
    pinCategoryIconMode = 'auto',
    clusterMarkerMode = 'bubble',
    spreadCoincidentPins = true,
    placeNumberByKey = null,
    showPopup = true,
    showZoomControl = interactive,
    showAttribution = true,
    showProviderBadgeLogo = true,
    mapHeightClassName = 'h-[340px]',
    layoutSignature = 'default',
    fitPaddingTopLeft = DIRECTORY_FIT_PADDING_TOP_LEFT,
    fitPaddingBottomRight = DIRECTORY_FIT_PADDING_BOTTOM_RIGHT,
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
    const displayPins = useMemo(() => spreadPinsForDisplay(pins, interactive, spreadCoincidentPins), [interactive, pins, spreadCoincidentPins]);
    const shouldCluster = clusterMarkerMode !== 'none' && displayPins.length > 1;
    const clusterGroupRef = useRef(null);
    const lastPlaceActivationRef = useRef({ token: null, at: 0 });
    const lastCategoryBubbleHoverKeyRef = useRef(null);
    const activePlaceKeySet = useMemo(() => new Set((activePlaceKeys || []).map((value) => String(value))), [activePlaceKeys]);
    const [compactCategoryBubbles, setCompactCategoryBubbles] = useState(false);
    const printBadgeLayoutRefreshKey = useMemo(() => {
        if (markerMode !== 'print-badge' && markerMode !== 'category-bubble') return '';

        const activeKeys = [...activePlaceKeySet].sort().join('|');
        const markerKeys = displayPins.map((pin) => {
            const itemKey = (pin.printBadgeItems || [])
                .map((item) => `${item?.label ?? item?.number ?? ''}:${item?.color ?? item?.categoryColor ?? ''}:${item?.placeKey ?? ''}`)
                .join(',');
            const categoryItemKey = (pin.categoryBubbleItems || [])
                .map((item) => `${item?.placeKey ?? ''}:${item?.color ?? item?.categoryColor ?? ''}:${item?.iconUrl ?? item?.categoryIconUrl ?? ''}`)
                .join(',');
            return `${pin.pinKey || pin.placeKey}:${pin.placeKey}:${pin.number || ''}:${itemKey}:${categoryItemKey}`;
        }).join(';');

        const focusedKeys = (focusedPlaceKeys || []).map((value) => String(value)).sort().join('|');
        return `${activePlaceKey || ''}::${focusedPlaceKey || ''}::${focusedKeys}::${activeKeys}::${compactCategoryBubbles ? 'compact' : 'full'}::${markerKeys}`;
    }, [activePlaceKey, activePlaceKeySet, compactCategoryBubbles, displayPins, focusedPlaceKey, focusedPlaceKeys, markerMode]);
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
    }, [anchorPoint, clusterMarkerMode, markerMode, onMapCaptureError, onMapReadyForCapture, pinBadgeMode, pinCategoryIconMode, pins, placeNumberByKey, spreadCoincidentPins]);

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

    const getMarkerEventPlaceKey = (event, pin) => (
        markerMode === 'category-bubble'
            ? getCategoryBubblePlaceKeyFromEvent(event, pin.placeKey)
            : pin.placeKey
    );

    const handleMarkerHoverStart = (event, pin) => {
        const placeKey = getMarkerEventPlaceKey(event, pin);
        if (markerMode === 'category-bubble') {
            lastCategoryBubbleHoverKeyRef.current = placeKey ? String(placeKey) : null;
        }
        onHoverPlaceStart?.(placeKey);
    };

    const handleMarkerHoverEnd = (event, pin) => {
        const placeKey = markerMode === 'category-bubble'
            ? (lastCategoryBubbleHoverKeyRef.current || getMarkerEventPlaceKey(event, pin))
            : getMarkerEventPlaceKey(event, pin);
        if (markerMode === 'category-bubble') {
            lastCategoryBubbleHoverKeyRef.current = null;
        }
        onHoverPlaceEnd?.(placeKey);
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
                    iconCreateFunction={(cluster) => createDirectoryClusterIcon(cluster, activePlaceKeySet, clusterMarkerMode)}
                >
                    {displayPins.map((pin) => {
                        const activeKey = activePlaceKey ?? focusedPlaceKey;
                        const isDeepZoom = String(activeKey).endsWith(':zoom');
                        const cleanKey = isDeepZoom ? String(activeKey).replace(':zoom', '') : activeKey;
                        const isMatched = String(cleanKey) === String(pin.placeKey)
                            || pinMatchesPlaceKeys(pin, activePlaceKeySet);

                        const icon = markerMode === 'print-badge'
                            ? createPrintResourceBadgeMarker(
                                pin.printNumberLabel || pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                                {
                                    color: pin.categoryColor || null,
                                    emphasis: isMatched ? 'primary' : 'default',
                                    placeKey: pin.placeKey,
                                    items: pin.printBadgeItems || null,
                                    offsetX: pin.printOffsetX || 0,
                                    offsetY: pin.printOffsetY || 0,
                                }
                            )
                            : markerMode === 'category-bubble'
                            ? createCategoryBubbleMarker(
                                {
                                    ...pin,
                                    categoryBubbleItems: pin.categoryBubbleItems || null,
                                },
                                {
                                    emphasis: isMatched ? 'primary' : 'default',
                                    activePlaceKeys: activePlaceKeySet,
                                    compact: compactCategoryBubbles,
                                }
                            )
                            : markerMode === 'number'
                            ? createDirectoryNumberMarker(
                                pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                                isMatched ? 'primary' : 'default',
                                pin.placeKey
                            )
                            : (() => {
                                const savedPinIcon = createSavedPlacePinIcon({
                                    count: pin.curatedCount,
                                    emphasis: isMatched ? 'primary' : 'default',
                                    tone: 'saved',
                                    iconUrl: pinCategoryIconMode === 'none' ? null : (pin.categoryIconUrl || null),
                                    color: pin.categoryColor || null,
                                    colorSegments: pin.categoryColorSegments || [],
                                    placeKey: pin.placeKey,
                                    showBadge: pinBadgeMode !== 'none',
                                });
                                savedPinIcon.options.assetCount = getDirectoryPinAssetCount(pin);
                                savedPinIcon.options.categoryIconUrl = pin.categoryIconUrl || null;
                                savedPinIcon.options.categoryColor = pin.categoryColor || null;
                                savedPinIcon.options.categoryColorSegments = pin.categoryColorSegments || [];
                                savedPinIcon.options.curatedCount = pin.curatedCount;
                                return savedPinIcon;
                            })();

                        return (
                            <Marker
                                key={pin.pinKey || pin.placeKey}
                                position={[pin.displayLat, pin.displayLng]}
                                icon={icon}
                                zIndexOffset={markerMode === 'print-badge' ? 100000 + ((Number(pin.number) || 0) * 1000) : undefined}
                                eventHandlers={interactive ? {
                                    mousedown: (event) => handlePlaceActivate(getMarkerEventPlaceKey(event, pin)),
                                    click: (event) => handlePlaceActivate(getMarkerEventPlaceKey(event, pin)),
                                    mouseover: (event) => handleMarkerHoverStart(event, pin),
                                    mouseout: (event) => handleMarkerHoverEnd(event, pin),
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
            const isMatched = String(cleanKey) === String(pin.placeKey)
                || pinMatchesPlaceKeys(pin, activePlaceKeySet);

            const icon = markerMode === 'print-badge'
                ? createPrintResourceBadgeMarker(
                    pin.printNumberLabel || pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                    {
                        color: pin.categoryColor || null,
                        emphasis: isMatched ? 'primary' : 'default',
                        placeKey: pin.placeKey,
                        items: pin.printBadgeItems || null,
                        offsetX: pin.printOffsetX || 0,
                        offsetY: pin.printOffsetY || 0,
                    }
                )
                : markerMode === 'category-bubble'
                ? createCategoryBubbleMarker(
                    {
                        ...pin,
                        categoryBubbleItems: pin.categoryBubbleItems || null,
                    },
                    {
                        emphasis: isMatched ? 'primary' : 'default',
                        activePlaceKeys: activePlaceKeySet,
                        compact: compactCategoryBubbles,
                    }
                )
                : markerMode === 'number'
                ? createDirectoryNumberMarker(
                    pin.number || placeNumberByKey?.[pin.placeKey] || '?',
                    isMatched ? 'primary' : 'default',
                    pin.placeKey
                )
                : (() => {
                    const savedPinIcon = createSavedPlacePinIcon({
                        count: pin.curatedCount,
                        emphasis: isMatched ? 'primary' : 'default',
                        tone: 'saved',
                        iconUrl: pinCategoryIconMode === 'none' ? null : (pin.categoryIconUrl || null),
                        color: pin.categoryColor || null,
                        colorSegments: pin.categoryColorSegments || [],
                        placeKey: pin.placeKey,
                        showBadge: pinBadgeMode !== 'none',
                    });
                    savedPinIcon.options.assetCount = getDirectoryPinAssetCount(pin);
                    savedPinIcon.options.categoryIconUrl = pin.categoryIconUrl || null;
                    savedPinIcon.options.categoryColor = pin.categoryColor || null;
                    savedPinIcon.options.categoryColorSegments = pin.categoryColorSegments || [];
                    savedPinIcon.options.curatedCount = pin.curatedCount;
                    return savedPinIcon;
                })();

            return (
                <Marker
                    key={pin.pinKey || pin.placeKey}
                    position={[pin.displayLat, pin.displayLng]}
                    icon={icon}
                    zIndexOffset={markerMode === 'print-badge' ? 100000 + ((Number(pin.number) || 0) * 1000) : undefined}
                    eventHandlers={interactive ? {
                        mousedown: (event) => handlePlaceActivate(getMarkerEventPlaceKey(event, pin)),
                        click: (event) => handlePlaceActivate(getMarkerEventPlaceKey(event, pin)),
                        mouseover: (event) => handleMarkerHoverStart(event, pin),
                        mouseout: (event) => handleMarkerHoverEnd(event, pin),
                    } : undefined}
                />
            );
        });
    }, [shouldCluster, displayPins, markerMode, pinBadgeMode, pinCategoryIconMode, clusterMarkerMode, placeNumberByKey, focusedPlaceKey, activePlaceKey, activePlaceKeySet, compactCategoryBubbles, interactive, handlePlaceActivate, onHoverPlaceStart, onHoverPlaceEnd]);

    if (!pins.length && !anchorPoint) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                {emptyLabel}
            </div>
        );
    }

    const { frameClassName, containerClassName } = buildDirectoryMapClassNames({
        mapHeightClassName,
        className,
        interactive,
    });

    return (
        <div className={frameClassName}>
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
                className={containerClassName}
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
                    pins={displayPins}
                    focusedPlaceKey={focusedPlaceKey}
                    focusedPlaceKeys={focusedPlaceKeys}
                    activePlaceKey={activePlaceKey}
                    activePlaceKeys={activePlaceKeys}
                    interactive={interactive}
                    layoutSignature={layoutSignature}
                    fitPaddingTopLeft={fitPaddingTopLeft}
                    fitPaddingBottomRight={fitPaddingBottomRight}
                    onFocusHandled={onFocusHandled}
                    onMapSettled={onMapReadyForCapture ? () => {
                        mapSettledRef.current = true;
                        tryNotifyReady();
                    } : undefined}
                />
                <DirectoryMapRecenterControl
                    activeAnchor={anchorPoint}
                    pins={displayPins}
                    interactive={interactive}
                    fitPaddingTopLeft={fitPaddingTopLeft}
                    fitPaddingBottomRight={fitPaddingBottomRight}
                    onResetView={onResetView}
                />
                <DirectoryClusterHoverSync
                    clusterGroupRef={clusterGroupRef}
                    enabled={interactive && shouldCluster}
                    clusterMarkerMode={clusterMarkerMode}
                    activePlaceKeys={activePlaceKeys}
                    onPlaceActivate={handlePlaceActivate}
                    onHoverPlaceStart={onHoverPlaceStart}
                    onHoverPlaceEnd={onHoverPlaceEnd}
                    onHoverClusterStart={onHoverClusterStart}
                    onHoverClusterEnd={onHoverClusterEnd}
                    onClusterSelect={onClusterSelect}
                />
                <DirectoryClusterStateSync onClusterChange={onClusterChange} />
                <DirectoryCategoryBubbleZoomClassSync
                    enabled={markerMode === 'category-bubble'}
                    onCompactChange={setCompactCategoryBubbles}
                />
                <DirectoryPrintBadgeCollisionSync
                    enabled={markerMode === 'print-badge' || markerMode === 'category-bubble'}
                    preserveSolvedOffsets={markerMode === 'category-bubble'}
                    refreshKey={printBadgeLayoutRefreshKey}
                />
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
            <OneMapBadge showLogo={showProviderBadgeLogo} />
        </div>
    );
}
