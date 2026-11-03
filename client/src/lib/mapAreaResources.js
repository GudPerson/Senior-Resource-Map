import { getAssetLocations } from '../features/discover/discoveryData.js';
import { containsSpatialPoint } from './mapSpatialGeometry.js';

function coordinates(location) {
    if (location?.lat === null || location?.lat === undefined || location?.lat === ''
        || location?.lng === null || location?.lng === undefined || location?.lng === '') return null;
    const lat = Number(location.lat), lng = Number(location.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        ? { lat, lng } : null;
}

/** Only classify rows already returned by the existing visible-catalogue endpoints. */
export function classifyMapAreaResources(hardAssets, softAssets, area) {
    const inside = [], unassessed = [], seen = new Set();
    for (const [type, rows] of [['hard', hardAssets], ['soft', softAssets]]) {
        for (const asset of Array.isArray(rows) ? rows : []) {
            const id = Number(asset?.id);
            if (!Number.isSafeInteger(id) || id <= 0 || seen.has(`${type}:${id}`)) continue;
            const key = `${type}:${id}`;
            seen.add(key);
            const locations = getAssetLocations({ ...asset, _type: type });
            const valid = locations.map(location => ({ location, point: coordinates(location) })).filter(entry => entry.point);
            const matches = valid.filter(entry => containsSpatialPoint(area, entry.point)).map(entry => entry.location);
            const row = { id: key, resourceId: id, resourceType: type, name: String(asset.name || ''),
                detailPath: `/resource/${type}/${id}`, locations: matches,
                access: asset.access || asset.eligibility || null };
            if (matches.length) inside.push(row);
            if (!valid.length || valid.length < locations.length) unassessed.push(row);
        }
    }
    return { inside, unassessed, total: seen.size };
}
