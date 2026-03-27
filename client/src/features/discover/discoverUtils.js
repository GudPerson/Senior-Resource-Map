import L from 'leaflet';
export {
    aggregateSavedPlacePins,
    buildDerivedMapLocations,
    buildMarkerKey,
    buildSavedMapContributions,
    buildSavedPlacePins,
    findLocationForMarker,
    getAssetLocations,
    getBestLocation,
    hasValidCoordinates,
    resolveSavedPlaceKey,
} from './discoveryData.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function createColoredIcon(color = '#3b82f6', isFavorite = false) {
    return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:36px;height:36px;">
            <div style="
                position:absolute;
                left:2px;
                top:2px;
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                background: ${color};
                transform: rotate(-45deg);
                box-shadow: 0 2px 8px rgba(0,0,0,0.35);
                border: 3px solid white;
            "></div>
            ${isFavorite ? `<div style="
                position:absolute;
                right:-1px;
                top:-1px;
                width:16px;
                height:16px;
                border-radius:999px;
                background:#ffffff;
                border:1px solid #fecaca;
                color:#dc2626;
                font-size:10px;
                line-height:14px;
                text-align:center;
                font-weight:700;
                box-shadow:0 2px 6px rgba(0,0,0,0.15);
            ">&#10084;</div>` : ''}
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
    });
}

function escapeSvgText(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function createSavedPlacePinIcon({ count = 0, emphasis = 'default', tone = 'saved' } = {}) {
    const label = count > 99 ? '99+' : String(Math.max(0, count));
    const isPrimary = emphasis === 'primary';
    const isRelated = emphasis === 'related';
    const isTemporary = tone === 'temporary';
    const selectedRing = isTemporary ? '#f97316' : '#f59e0b';
    const outerFill = isTemporary
        ? (isPrimary ? '#d97706' : isRelated ? '#f59e0b' : '#f2a43a')
        : (isPrimary ? '#109f95' : isRelated ? '#22c7bb' : '#17b6ab');
    const outerStroke = isPrimary ? selectedRing : '#ffffff';
    const outlineShadow = isPrimary
        ? (isTemporary ? '0 14px 26px rgba(194, 65, 12, 0.34)' : '0 14px 26px rgba(194, 120, 3, 0.32)')
        : isRelated
            ? (isTemporary ? '0 10px 20px rgba(146, 64, 14, 0.24)' : '0 10px 20px rgba(15, 118, 110, 0.26)')
            : (isTemporary ? '0 6px 14px rgba(146, 64, 14, 0.18)' : '0 6px 14px rgba(15, 118, 110, 0.24)');
    const badgeShadow = isPrimary
        ? (isTemporary ? '0 7px 16px rgba(120, 53, 15, 0.28)' : '0 7px 16px rgba(13, 53, 61, 0.32)')
        : isRelated
            ? (isTemporary ? '0 5px 12px rgba(120, 53, 15, 0.22)' : '0 5px 12px rgba(13, 53, 61, 0.24)')
            : (isTemporary ? '0 4px 10px rgba(120, 53, 15, 0.2)' : '0 4px 10px rgba(15, 23, 42, 0.18)');
    const badgeBg = isTemporary
        ? (isPrimary ? '#9a3412' : isRelated ? '#b45309' : '#c26b0c')
        : (isPrimary ? '#0b6d70' : isRelated ? '#0d766f' : '#0f766e');
    const haloColor = isTemporary
        ? (isPrimary ? 'rgba(249, 115, 22, 0.42)' : isRelated ? 'rgba(251, 146, 60, 0.3)' : 'rgba(251, 146, 60, 0.18)')
        : (isPrimary ? 'rgba(245, 158, 11, 0.4)' : isRelated ? 'rgba(45, 212, 191, 0.3)' : 'rgba(45, 212, 191, 0.18)');
    const stateClass = [
        'saved-place-pin-marker',
        `saved-place-pin-marker--${tone}`,
        isPrimary ? 'saved-place-pin-marker--primary' : '',
        isRelated ? 'saved-place-pin-marker--related' : '',
    ].filter(Boolean).join(' ');
    const pinScale = isPrimary ? 1.24 : isRelated ? 1.12 : 1;
    const pulseBump = isPrimary ? 0.12 : isRelated ? 0.07 : 0;
    const innerSheen = isTemporary ? '#fff0c2' : '#8ef0e6';

    const svg = `
        <div
            class="${stateClass}"
            style="
                position:relative;
                width:40px;
                height:54px;
                overflow:visible;
                pointer-events:none;
                --saved-pin-scale:${pinScale};
                --saved-pin-pulse-bump:${pulseBump};
                --saved-pin-halo-color:${haloColor};
            "
        >
            <div class="saved-place-pin-marker__pin" style="position:absolute;inset:0;z-index:1;display:flex;align-items:flex-start;justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="48" viewBox="0 0 34 48" aria-hidden="true" style="overflow:visible;">
                    <path
                        d="M17 2.4c-7.35 0-12.95 5.62-12.95 12.78 0 4.52 2.04 8.95 4.7 12.74 2.16 3.08 4.65 5.86 6.87 8.42a1.82 1.82 0 0 0 2.76 0c2.22-2.56 4.71-5.34 6.87-8.42 2.66-3.79 4.7-8.22 4.7-12.74C29.95 8.02 24.35 2.4 17 2.4Z"
                        fill="${outerFill}"
                        stroke="${outerStroke}"
                        stroke-width="${isPrimary ? 2.45 : isRelated ? 2.25 : 2.15}"
                        style="filter:drop-shadow(${outlineShadow});"
                    />
                    <ellipse cx="13.4" cy="11.4" rx="7.8" ry="5.9" fill="${innerSheen}" opacity="${isPrimary ? '0.34' : isRelated ? '0.28' : '0.22'}" />
                    <circle cx="17" cy="14.9" r="6.95" fill="#ffffff" opacity="0.98" />
                    <path
                        d="M17 12.2c-1.12-1.6-3.88-1.82-5.18-.36-1.29 1.44-.99 3.87.66 5.25L17 20.74l4.52-3.63c1.65-1.38 1.95-3.81.66-5.25-1.3-1.46-4.06-1.24-5.18.36Z"
                        fill="#f35f68"
                    />
                    <path
                        d="M17 12.2c-1.12-1.6-3.88-1.82-5.18-.36-1.29 1.44-.99 3.87.66 5.25L17 20.74l4.52-3.63c1.65-1.38 1.95-3.81.66-5.25-1.3-1.46-4.06-1.24-5.18.36Z"
                        fill="none"
                        stroke="rgba(176,30,49,0.18)"
                        stroke-width="0.75"
                    />
                </svg>
                <div
                    class="saved-place-pin-marker__badge"
                    style="
                        position:absolute;
                        top:-1px;
                        right:0px;
                        z-index:10;
                        min-width:18px;
                        height:18px;
                        padding:0 5px;
                        border-radius:999px;
                        background:${badgeBg};
                        border:1.5px solid #ffffff;
                        box-shadow:${badgeShadow};
                        color:#ffffff;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:${label.length > 2 ? 8.5 : 10}px;
                        line-height:1;
                        font-weight:800;
                        letter-spacing:-0.02em;
                        transform-origin:center;
                        pointer-events:none;
                        font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    "
                >${escapeSvgText(label)}</div>
            </div>
        </div>
    `;

    return L.divIcon({
        className: '',
        html: svg,
        iconSize: [40, 54],
        iconAnchor: [20, 48],
        popupAnchor: [0, -44],
        tooltipAnchor: [0, -40],
    });
}
