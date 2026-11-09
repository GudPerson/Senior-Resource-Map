export { SPATIAL_EARTH_RADIUS_METERS, SPATIAL_MAX_AREA_POINTS, distanceMeters, isSpatialCoordinate,
    normalizeSpatialArea, containsSpatialPoint, spatialAreaBounds } from '../../../shared/addressSnapshotSpatial.js';
export { createSpatialAreaFromAnnotation } from '../../../shared/boundaryDrawingGeometry.js';

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
