import L from 'leaflet';
import { getDistance } from '../../lib/geo.js';

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

export function buildDerivedMapLocations(hardAssets = [], softAssets = []) {
    const hardLocations = hardAssets
        .filter((asset) => asset?.lat && asset?.lng)
        .map((asset) => ({
            id: asset.id,
            locationId: asset.id,
            title: asset.name,
            category: asset.subCategory,
            lat: asset.lat,
            lng: asset.lng,
            asset_type: 'hard',
        }));

    const softLocations = softAssets.flatMap((asset) => {
        const linkedLocations = Array.isArray(asset.locations) && asset.locations.length > 0
            ? asset.locations
            : (asset.location ? [asset.location] : []);

        return linkedLocations
            .filter((location) => location?.lat && location?.lng)
            .map((location) => ({
                id: asset.id,
                locationId: location.id,
                title: asset.name,
                category: asset.subCategory,
                lat: location.lat,
                lng: location.lng,
                asset_type: 'soft',
            }));
    });

    return [...hardLocations, ...softLocations];
}

export function hasValidCoordinates(item) {
    return Number.isFinite(parseFloat(item?.lat)) && Number.isFinite(parseFloat(item?.lng));
}

export function getAssetLocations(asset) {
    if (!asset) return [];
    if (asset._type === 'hard' || asset.asset_type === 'hard') return [asset];
    if (Array.isArray(asset.locations) && asset.locations.length > 0) return asset.locations;
    if (asset.location) return [asset.location];
    return [];
}

export function getBestLocation(asset, referencePoint = null) {
    const locations = getAssetLocations(asset);
    if (locations.length === 0) return null;
    if (!referencePoint) return locations[0];

    const validLocations = locations.filter(hasValidCoordinates);
    if (validLocations.length === 0) return locations[0];

    return validLocations.reduce((best, current) => {
        const bestDistance = getDistance(referencePoint.lat, referencePoint.lng, parseFloat(best.lat), parseFloat(best.lng));
        const currentDistance = getDistance(referencePoint.lat, referencePoint.lng, parseFloat(current.lat), parseFloat(current.lng));
        return currentDistance < bestDistance ? current : best;
    });
}

export function findLocationForMarker(asset, marker) {
    if (!asset) return null;
    if (asset._type === 'hard' || asset.asset_type === 'hard') return asset;

    const locations = getAssetLocations(asset);
    if (locations.length === 0) return null;

    if (marker?.locationId) {
        const byId = locations.find((location) => location.id === marker.locationId);
        if (byId) return byId;
    }

    const lat = Number.parseFloat(marker?.lat);
    const lng = Number.parseFloat(marker?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const byCoordinates = locations.find((location) => {
            const locationLat = Number.parseFloat(location.lat);
            const locationLng = Number.parseFloat(location.lng);
            return Number.isFinite(locationLat)
                && Number.isFinite(locationLng)
                && Math.abs(locationLat - lat) < 0.000001
                && Math.abs(locationLng - lng) < 0.000001;
        });

        if (byCoordinates) return byCoordinates;
    }

    return locations[0];
}

export function buildMarkerKey(item) {
    const type = item?.asset_type || item?._type || 'asset';
    const id = item?.id ?? 'unknown';
    const locationId = item?.locationId ?? item?.linkedLocationId;
    if (locationId) return `${type}-${id}-${locationId}`;

    const lat = Number.parseFloat(item?.lat);
    const lng = Number.parseFloat(item?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `${type}-${id}-${lat.toFixed(6)}-${lng.toFixed(6)}`;
    }

    return `${type}-${id}`;
}
