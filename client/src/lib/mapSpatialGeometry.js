import { buildPrintAnnotationPolygonPoints, buildPrintAnnotationRectanglePoints } from './printAnnotations.js';
import { distanceMeters, isSpatialCoordinate, normalizeSpatialArea } from '../../../shared/addressSnapshotSpatial.js';
export { SPATIAL_EARTH_RADIUS_METERS, SPATIAL_MAX_AREA_POINTS, distanceMeters, isSpatialCoordinate,
    normalizeSpatialArea, containsSpatialPoint, spatialAreaBounds } from '../../../shared/addressSnapshotSpatial.js';

function closedGeoJsonRing(points) {
    const ring = points.map(([lat, lng]) => [lng, lat]);
    if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push([...ring[0]]);
    return ring;
}

export function createSpatialAreaFromAnnotation(annotation) {
    if (!annotation || !Array.isArray(annotation.points) || !annotation.points.every(isSpatialCoordinate)) return null;
    if (annotation.type === 'circle' && annotation.points.length === 2) {
        return { type: 'circle', center: [...annotation.points[0]], radiusMeters: Math.max(1, distanceMeters(...annotation.points)) };
    }
    if (annotation.type === 'rectangle' && annotation.points.length === 2) {
        const points = buildPrintAnnotationRectanglePoints(annotation.points, annotation.rotationDegrees);
        return normalizeSpatialArea({ type: 'Polygon', coordinates: [closedGeoJsonRing(points)] });
    }
    if (annotation.type !== 'polygon' || annotation.points.length < 3) return null;
    if (annotation.controlPoints && (!Array.isArray(annotation.controlPoints) || !annotation.controlPoints.every(isSpatialCoordinate))) return null;
    const display = buildPrintAnnotationPolygonPoints(annotation);
    const parts = annotation.boundarySource === 'kml' && annotation.boundaryParts ? display : [[display]];
    return normalizeSpatialArea({ type: parts.length === 1 ? 'Polygon' : 'MultiPolygon',
        coordinates: parts.length === 1 ? parts[0].map(closedGeoJsonRing) : parts.map(rings => rings.map(closedGeoJsonRing)) });
}

export function formatRadiusDistance(meters) {
    if (!Number.isFinite(meters) || meters < 0) return '';
    return meters >= 1000 ? `${Number((meters / 1000).toFixed(2))} km` : `${Math.round(meters)} m`;
}

export function escapeCsvCell(value) {
    let text = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}

export function serializeAddressSnapshotCsv(rows) {
    const columns = ['postalCode', 'block', 'roadName', 'building', 'address', 'lat', 'lng'];
    // Prefix postal strings so spreadsheet apps retain leading zeroes.
    return '\uFEFF' + [columns.map(escapeCsvCell).join(','), ...rows.map(row => columns.map(column =>
        escapeCsvCell(column === 'postalCode' ? `'${row[column] ?? ''}` : row[column])).join(','))].join('\r\n') + '\r\n';
}
