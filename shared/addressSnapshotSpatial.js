// Match Leaflet's Earth distance model. Annotation points are [lat, lng];
// normalized polygon areas use GeoJSON's [lng, lat] coordinate order.
export const SPATIAL_EARTH_RADIUS_METERS = 6371000;
export const SPATIAL_MAX_AREA_POINTS = 10000;
const radians = degrees => degrees * Math.PI / 180;

export function isSpatialCoordinate(point) {
    return Array.isArray(point) && point.length === 2
        && point.every(value => typeof value === 'number' && Number.isFinite(value))
        && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;
}

function latLng(point) {
    return Array.isArray(point) ? point : [point?.lat, point?.lng];
}

export function distanceMeters(first, second) {
    const a = latLng(first), b = latLng(second);
    if (!isSpatialCoordinate(a) || !isSpatialCoordinate(b)) return NaN;
    const deltaLat = radians(b[0] - a[0]), deltaLng = radians(b[1] - a[1]);
    const value = Math.sin(deltaLat / 2) ** 2
        + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(deltaLng / 2) ** 2;
    return 2 * SPATIAL_EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)));
}

// Reject malformed or excessive geometry rather than clipping it into another area.
export function normalizeSpatialArea(area) {
    if (!area || typeof area !== 'object') return null;
    if (area.type === 'circle') {
        if (!isSpatialCoordinate(area.center) || typeof area.radiusMeters !== 'number'
            || !Number.isFinite(area.radiusMeters) || area.radiusMeters <= 0 || area.radiusMeters > 20000000) return null;
        return { type: 'circle', center: [...area.center], radiusMeters: area.radiusMeters };
    }
    if (!['Polygon', 'MultiPolygon'].includes(area.type)) return null;
    const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
    if (!Array.isArray(polygons) || !polygons.length) return null;
    let count = 0;
    for (const polygon of polygons) {
        if (!Array.isArray(polygon) || !polygon.length) return null;
        for (const ring of polygon) {
            if (!Array.isArray(ring) || ring.length < 4) return null;
            count += ring.length - 1;
            if (count > SPATIAL_MAX_AREA_POINTS) return null;
            if (!ring.every(point => Array.isArray(point) && point.length === 2 && isSpatialCoordinate([point[1], point[0]]))) return null;
            if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return null;
            // Planar GeoJSON containment is deliberately not an antimeridian model.
            if (Math.max(...ring.map(point => point[0])) - Math.min(...ring.map(point => point[0])) > 180) return null;
            const origin = ring[0];
            const signedArea = ring.slice(0, -1).reduce((sum, point, i) => {
                const next = ring[i + 1];
                return sum + (point[0] - origin[0]) * (next[1] - origin[1]) - (next[0] - origin[0]) * (point[1] - origin[1]);
            }, 0);
            if (Math.abs(signedArea) < 1e-18) return null;
        }
    }
    return { type: area.type, coordinates: area.coordinates };
}

function ringLocation(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j], [bx, by] = ring[i];
        const dx = bx - ax, dy = by - ay;
        if (dx === 0 && dy === 0) continue;
        const cross = (x - ax) * dy - (y - ay) * dx;
        if (Math.abs(cross) <= 1e-12 * Math.max(Math.abs(dx), Math.abs(dy))
            && x >= Math.min(ax, bx) - 1e-12 && x <= Math.max(ax, bx) + 1e-12
            && y >= Math.min(ay, by) - 1e-12 && y <= Math.max(ay, by) + 1e-12) return 0;
        if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay) / (by - ay) + ax)) inside = !inside;
    }
    return inside ? 1 : -1;
}

// Outer and hole boundaries are included; hole interiors are excluded.
// Overlapping multipart polygons form a union, matching the visible filled area.
export function containsSpatialPoint(area, point) {
    const [lat, lng] = latLng(point);
    if (!isSpatialCoordinate([lat, lng]) || !area) return false;
    if (area.type === 'circle') return distanceMeters(area.center, [lat, lng]) <= area.radiusMeters + 1e-7;
    const polygons = area.type === 'Polygon' ? [area.coordinates] : area.type === 'MultiPolygon' ? area.coordinates : [];
    return polygons.some(rings => ringLocation(rings[0], lng, lat) >= 0
        && !rings.slice(1).some(ring => ringLocation(ring, lng, lat) === 1));
}

export function spatialAreaBounds(area) {
    if (area.type === 'circle') {
        const [lat, lng] = area.center;
        const angular = area.radiusMeters / SPATIAL_EARTH_RADIUS_METERS;
        const latitudeDelta = angular * 180 / Math.PI;
        const reachesPole = lat - latitudeDelta <= -90 || lat + latitudeDelta >= 90;
        const longitudeDelta = reachesPole ? 180 : Math.asin(Math.min(1, Math.sin(angular) / Math.cos(radians(lat)))) * 180 / Math.PI;
        const crossesDateline = lng - longitudeDelta < -180 || lng + longitudeDelta > 180;
        return { south: Math.max(-90, lat - latitudeDelta), north: Math.min(90, lat + latitudeDelta),
            west: crossesDateline || reachesPole ? -180 : lng - longitudeDelta,
            east: crossesDateline || reachesPole ? 180 : lng + longitudeDelta };
    }
    const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
    let south = 90, north = -90, west = 180, east = -180;
    for (const polygon of polygons) for (const ring of polygon) for (const [lng, lat] of ring) {
        south = Math.min(south, lat); north = Math.max(north, lat); west = Math.min(west, lng); east = Math.max(east, lng);
    }
    return { south, north, west, east };
}
