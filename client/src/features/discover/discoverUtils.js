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

export function createSavedPlacePinIcon(count = 0, selected = false) {
    const label = count > 99 ? '99+' : String(Math.max(0, count));
    const fill = selected ? '#0b6d70' : '#14b8a6';
    const stroke = selected ? '#0f3f42' : '#ffffff';
    const shadow = selected
        ? 'drop-shadow(0 8px 14px rgba(11,109,112,0.38))'
        : 'drop-shadow(0 6px 12px rgba(15,163,154,0.28))';

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58" aria-hidden="true">
            <defs>
                <filter id="saved-pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="rgba(15,23,42,0.2)"/>
                </filter>
            </defs>
            <g filter="url(#saved-pin-shadow)" style="filter:${shadow};">
                <path
                    d="M24 2C14.059 2 6 9.961 6 19.78c0 13.32 15.248 27.244 17.114 28.899a1.5 1.5 0 0 0 1.772 0C26.752 47.024 42 33.1 42 19.78 42 9.96 33.941 2 24 2Z"
                    fill="${fill}"
                    stroke="${stroke}"
                    stroke-width="2.5"
                />
                <path
                    d="M24 17.4c-1.73-2.9-6.64-3.59-9.26-.92-2.53 2.58-2.34 6.97.44 9.26l7.74 6.38a1.67 1.67 0 0 0 2.12 0l7.74-6.38c2.78-2.29 2.97-6.68.44-9.26-2.62-2.67-7.53-1.98-9.22.92Z"
                    fill="#ffffff"
                />
                <text
                    x="24"
                    y="24.2"
                    text-anchor="middle"
                    font-size="${label.length > 2 ? 10 : 12}"
                    font-weight="800"
                    font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    fill="#0b6d70"
                >${escapeSvgText(label)}</text>
            </g>
        </svg>
    `;

    return L.divIcon({
        className: '',
        html: svg,
        iconSize: [48, 58],
        iconAnchor: [24, 52],
        popupAnchor: [0, -48],
        tooltipAnchor: [0, -42],
    });
}
