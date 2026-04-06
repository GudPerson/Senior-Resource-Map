import L from 'leaflet';
import {
    computePostalGroupAnchor,
    groupItemsByPostalCode,
    resolvePostalGroupCode,
} from '../../lib/postalGrouping.js';
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

function renderSavedPinCenterGlyph(iconUrl) {
    if (iconUrl) {
        return `
            <img
                src="${escapeSvgText(iconUrl)}"
                alt=""
                draggable="false"
                style="width:100%;height:100%;object-fit:contain;padding:0.5px;display:block;"
            />
        `;
    }

    return `
        <svg viewBox="0 0 24 24" width="15" height="15" focusable="false" aria-hidden="true" style="display:block;">
            <path
                d="M12 20.5c-.28 0-.56-.09-.78-.27C7.12 16.79 4 14.17 4 10.58 4 8.23 5.9 6.33 8.25 6.33c1.5 0 2.92.77 3.75 2.01.83-1.24 2.25-2.01 3.75-2.01C18.1 6.33 20 8.23 20 10.58c0 3.59-3.12 6.21-7.22 9.65-.22.18-.5.27-.78.27Z"
                fill="#f35f68"
            />
            <path
                d="M12 20.5c-.28 0-.56-.09-.78-.27C7.12 16.79 4 14.17 4 10.58 4 8.23 5.9 6.33 8.25 6.33c1.5 0 2.92.77 3.75 2.01.83-1.24 2.25-2.01 3.75-2.01C18.1 6.33 20 8.23 20 10.58c0 3.59-3.12 6.21-7.22 9.65-.22.18-.5.27-.78.27Z"
                fill="none"
                stroke="rgba(176,30,49,0.18)"
                stroke-width="0.75"
            />
        </svg>
    `;
}

export function createSavedPlacePinIcon({ count = 0, emphasis = 'default', tone = 'saved', iconUrl = null, placeKey = null } = {}) {
    const label = count > 99 ? '99+' : String(Math.max(0, count));
    const isPrimary = emphasis === 'primary';
    const isRelated = emphasis === 'related';
    const isHighlighted = isPrimary || isRelated;
    const isTemporary = tone === 'temporary';
    const selectedRing = isTemporary ? '#f97316' : '#f59e0b';
    const outerFill = isTemporary
        ? (isPrimary ? '#d97706' : isRelated ? '#f59e0b' : '#f2a43a')
        : (isPrimary ? '#109f95' : isRelated ? '#22c7bb' : '#17b6ab');
    const outerStroke = isHighlighted ? selectedRing : '#ffffff';
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
        : (isPrimary ? 'rgba(16, 159, 149, 0.45)' : isRelated ? 'rgba(45, 212, 191, 0.3)' : 'rgba(45, 212, 191, 0.18)');
    const stateClass = [
        'saved-place-pin-marker',
        `saved-place-pin-marker--${tone}`,
        isPrimary ? 'saved-place-pin-marker--primary' : '',
        isRelated ? 'saved-place-pin-marker--related' : '',
    ].filter(Boolean).join(' ');
    const pinScale = isPrimary ? 1.24 : isRelated ? 1.12 : 1;
    const pulseBump = isPrimary ? 0.12 : isRelated ? 0.07 : 0;
    const innerSheen = isTemporary ? '#fff0c2' : '#8ef0e6';
    const glyphMarkup = renderSavedPinCenterGlyph(iconUrl);

    const svg = `
        <div
            class="${stateClass}"
            style="
                position:relative;
                width:48px;
                height:64px;
                overflow:visible;
                pointer-events:none;
                --saved-pin-scale:${pinScale};
                --saved-pin-pulse-bump:${pulseBump};
                --saved-pin-halo-color:${haloColor};
            "
        >
            <div class="saved-place-pin-marker__pin" style="position:absolute;inset:0;z-index:1;display:flex;align-items:flex-start;justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 34 48" aria-hidden="true" style="overflow:visible; position:relative; z-index:1;">
                    <path
                        d="M17 2.4c-7.35 0-12.95 5.62-12.95 12.78 0 4.52 2.04 8.95 4.7 12.74 2.16 3.08 4.65 5.86 6.87 8.42a1.82 1.82 0 0 0 2.76 0c2.22-2.56 4.71-5.34 6.87-8.42 2.66-3.79 4.7-8.22 4.7-12.74C29.95 8.02 24.35 2.4 17 2.4Z"
                        fill="${outerFill}"
                        stroke="${outerStroke}"
                        stroke-width="${isPrimary ? 1.75 : isRelated ? 1.6 : 1.5}"
                        style="filter:drop-shadow(${outlineShadow});"
                    />
                    <ellipse cx="13.4" cy="11.4" rx="7.8" ry="5.9" fill="${innerSheen}" opacity="${isPrimary ? '0.34' : isRelated ? '0.28' : '0.22'}" />
                </svg>
                <div
                    class="saved-place-pin-marker__glyph"
                    style="
                        position:absolute;
                        top:6px;
                        left:50%;
                        z-index:2;
                        width:18.5px;
                        height:18.5px;
                        transform:translateX(-50%);
                        border-radius:999px;
                        background:#ffffff;
                        box-shadow:0 1px 4px rgba(15, 23, 42, 0.14);
                        overflow:hidden;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                    "
                >${glyphMarkup}</div>
                <div
                    class="saved-place-pin-marker__badge"
                    style="
                        position:absolute;
                        top:-3px;
                        right:-3px;
                        z-index:100;
                        min-width:20px;
                        height:20px;
                        padding:0 4px;
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
                        font-family:var(--font-heading);
                    "
                >${escapeSvgText(label)}</div>
            </div>
        </div>
    `;

    return L.divIcon({
        className: '',
        html: svg,
        iconSize: [44, 60],
        iconAnchor: [22, 54],
        popupAnchor: [0, -52],
        tooltipAnchor: [0, -48],
        placeKey,
    });
}

export function createPostalGroupParentPinIcon({ count = 0, badgeCount = 0, emphasis = 'default', placeKey = null } = {}) {
    const label = count > 99 ? '99+' : String(Math.max(0, count));
    const badgeLabel = badgeCount > 99 ? '99+' : String(Math.max(0, badgeCount));
    const isPrimary = emphasis === 'primary';
    const isRelated = emphasis === 'related';
    const outerFill = isPrimary ? '#f29a1f' : isRelated ? '#f4aa2b' : '#f5b43a';
    const outerStroke = isPrimary ? '#f97316' : isRelated ? '#f6ad34' : '#ffffff';
    const outlineShadow = isPrimary
        ? '0 14px 26px rgba(194, 65, 12, 0.34)'
        : isRelated
            ? '0 10px 20px rgba(194, 120, 3, 0.26)'
            : '0 6px 14px rgba(194, 120, 3, 0.22)';
    const badgeShadow = isPrimary
        ? '0 7px 16px rgba(13, 53, 61, 0.32)'
        : isRelated
            ? '0 5px 12px rgba(13, 53, 61, 0.24)'
            : '0 4px 10px rgba(15, 23, 42, 0.18)';
    const badgeBg = isPrimary ? '#0b6d70' : isRelated ? '#0d766f' : '#0f766e';
    const haloColor = isPrimary
        ? 'rgba(249, 115, 22, 0.42)'
        : isRelated
            ? 'rgba(251, 146, 60, 0.3)'
            : 'rgba(251, 146, 60, 0.2)';
    const stateClass = [
        'saved-place-pin-marker',
        'saved-place-pin-marker--grouped',
        isPrimary ? 'saved-place-pin-marker--primary' : '',
        isRelated ? 'saved-place-pin-marker--related' : '',
    ].filter(Boolean).join(' ');
    const pinScale = isPrimary ? 1.24 : isRelated ? 1.12 : 1;
    const pulseBump = isPrimary ? 0.12 : isRelated ? 0.07 : 0;

    return L.divIcon({
        className: '',
        html: `
            <div
                class="${stateClass}"
                style="
                    position:relative;
                    width:48px;
                    height:64px;
                    overflow:visible;
                    pointer-events:none;
                    --saved-pin-scale:${pinScale};
                    --saved-pin-pulse-bump:${pulseBump};
                    --saved-pin-halo-color:${haloColor};
                "
            >
                <div class="saved-place-pin-marker__pin" style="position:absolute;inset:0;z-index:1;display:flex;align-items:flex-start;justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 34 48" aria-hidden="true" style="overflow:visible; position:relative; z-index:1;">
                    <path
                        d="M17 2.4c-7.35 0-12.95 5.62-12.95 12.78 0 4.52 2.04 8.95 4.7 12.74 2.16 3.08 4.65 5.86 6.87 8.42a1.82 1.82 0 0 0 2.76 0c2.22-2.56 4.71-5.34 6.87-8.42 2.66-3.79 4.7-8.22 4.7-12.74C29.95 8.02 24.35 2.4 17 2.4Z"
                        fill="${outerFill}"
                        stroke="${outerStroke}"
                        stroke-width="${isPrimary ? 1.75 : isRelated ? 1.6 : 1.5}"
                        style="filter:drop-shadow(${outlineShadow});"
                    />
                    <ellipse cx="13.4" cy="11.4" rx="7.8" ry="5.9" fill="#ffe1a6" opacity="${isPrimary ? '0.34' : isRelated ? '0.28' : '0.22'}" />
                </svg>
                <div
                    style="
                        position:absolute;
                        top:6px;
                        left:50%;
                        transform:translateX(-50%);
                        z-index:2;
                        width:18.5px;
                        height:18.5px;
                        border-radius:999px;
                        background:#ffffff;
                        box-shadow:0 1px 4px rgba(15,23,42,0.14);
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:${label.length > 2 ? 9.5 : 12.5}px;
                        line-height:1;
                        font-weight:900;
                        color:#334155;
                        font-family:var(--font-heading);
                    "
                >${escapeSvgText(label)}</div>
                <div
                    class="saved-place-pin-marker__badge"
                    style="
                        position:absolute;
                        top:-3px;
                        right:-3px;
                        z-index:100;
                        min-width:20px;
                        height:20px;
                        padding:0 4px;
                        border-radius:999px;
                        background:${badgeBg};
                        border:1.5px solid #ffffff;
                        box-shadow:${badgeShadow};
                        color:#ffffff;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:${badgeLabel.length > 2 ? 8.5 : 10}px;
                        line-height:1;
                        font-weight:800;
                        letter-spacing:-0.02em;
                        transform-origin:center;
                        pointer-events:none;
                        font-family:var(--font-heading);
                    "
                >${escapeSvgText(badgeLabel)}</div>
                </div>
            </div>
        `,
        iconSize: [44, 60],
        iconAnchor: [22, 54],
        popupAnchor: [0, -52],
        tooltipAnchor: [0, -48],
        placeKey,
    });
}

function sortPinsForPostalGroupReadingOrder(pins = []) {
    return [...pins].sort((left, right) => {
        const leftTitle = String(left?.title || left?.placeKey || '').toLowerCase();
        const rightTitle = String(right?.title || right?.placeKey || '').toLowerCase();
        return leftTitle.localeCompare(rightTitle);
    });
}

function buildExpandedPostalGroupMemberPins(group, interactionMode = 'desktop') {
    const members = sortPinsForPostalGroupReadingOrder(group.memberPins || []);
    const count = members.length;
    const anchorLat = group.anchorLat;
    const anchorLng = group.anchorLng;
    if (!count || anchorLat === null || anchorLng === null) {
        return members;
    }

    return members.map((pin, index) => {
        let displayLat = pin.lat;
        let displayLng = pin.lng;

        if (count <= 4) {
            const anglePresets = {
                1: [0],
                2: [-0.58, 0.58],
                3: [-0.82, 0, 0.82],
                4: [-1.02, -0.34, 0.34, 1.02],
            };
            const theta = anglePresets[count]?.[index] ?? 0;
            const horizontalRadius = interactionMode === 'desktop' ? 0.00024 : 0.0002;
            const verticalRadius = interactionMode === 'desktop' ? 0.00008 : 0.00007;
            const lift = interactionMode === 'desktop' ? 0.00011 : 0.000095;

            displayLng = anchorLng + (Math.sin(theta) * horizontalRadius);
            displayLat = anchorLat + lift + (Math.cos(theta) * verticalRadius);
        } else {
            const horizontalRadius = interactionMode === 'desktop' ? 0.0003 : 0.000255;
            const verticalRadius = interactionMode === 'desktop' ? 0.000095 : 0.00008;
            const lift = interactionMode === 'desktop' ? 0.00011 : 0.000095;
            const start = -1.12;
            const sweep = 2.24;
            const theta = count === 1 ? 0 : start + ((sweep / (count - 1)) * index);

            displayLng = anchorLng + (Math.sin(theta) * horizontalRadius);
            displayLat = anchorLat + lift + (Math.cos(theta) * verticalRadius);
        }

        return {
            ...pin,
            displayLat,
            displayLng,
            postalGroupKey: group.postalGroupKey,
            isExpandedChild: true,
            kind: 'place',
        };
    });
}

export function buildPostalGroupedSavedPlacePins(savedPlacePins = []) {
    const { groups, itemGroupKeyByItemKey } = groupItemsByPostalCode(savedPlacePins, {
        getItemKey: (pin) => pin?.pinKey,
        resolvePostalCode: (pin) => resolvePostalGroupCode({
            postalCode: pin?.postalCode || pin?.placeAsset?.postalCode,
            address: pin?.address || pin?.placeAsset?.address,
        }),
    });

    const postalGroups = groups.map((group) => {
        const members = sortPinsForPostalGroupReadingOrder(group.members || []);
        if (!group.isPostalGroup) {
            const singlePin = members[0] || null;
            return {
                postalGroupKey: group.postalGroupKey,
                postalCode: group.postalCode || '',
                isPostalGroup: false,
                memberPins: members,
                hardAssetCount: members.length,
                totalOfferingsCount: members.reduce((total, pin) => total + Math.max(0, Number(pin?.totalOfferingsCount || 0)), 0),
                anchorLat: singlePin?.lat ?? null,
                anchorLng: singlePin?.lng ?? null,
            };
        }

        const anchor = computePostalGroupAnchor(members);
        return {
            postalGroupKey: group.postalGroupKey,
            postalCode: group.postalCode,
            isPostalGroup: true,
            memberPins: members,
            hardAssetCount: members.length,
            totalOfferingsCount: members.reduce((total, pin) => total + Math.max(0, Number(pin?.totalOfferingsCount || 0)), 0),
            anchorLat: anchor.lat,
            anchorLng: anchor.lng,
        };
    });

    const postalGroupKeyByPinKey = new Map();
    itemGroupKeyByItemKey.forEach((value, key) => {
        postalGroupKeyByPinKey.set(String(key), value);
    });

    return {
        groups: postalGroups,
        postalGroupKeyByPinKey,
    };
}

export function buildRenderedPostalGroupedSavedPins(postalGroups = [], {
    expandedPostalGroupKey = null,
    interactionMode = 'desktop',
} = {}) {
    void expandedPostalGroupKey;
    void interactionMode;

    return postalGroups.flatMap((group) => {
        if (!group.isPostalGroup) {
            return group.memberPins.map((pin) => ({
                ...pin,
                displayLat: pin.lat,
                displayLng: pin.lng,
                kind: 'place',
            }));
        }

        return [{
            pinKey: group.postalGroupKey,
            placeKey: group.postalGroupKey,
            postalGroupKey: group.postalGroupKey,
            postalCode: group.postalCode,
            lat: group.anchorLat,
            lng: group.anchorLng,
            displayLat: group.anchorLat,
            displayLng: group.anchorLng,
            hardAssetCount: group.hardAssetCount,
            totalOfferingsCount: group.totalOfferingsCount,
            memberPins: group.memberPins,
            kind: 'postal-group',
        }];
    });
}
