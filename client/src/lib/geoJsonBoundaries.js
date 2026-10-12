import {
    KML_MAX_BYTES, KML_MAX_PLACEMARKS, KmlBoundaryError,
    validateBoundaryRing, validateBoundaryPolygonRings,
} from './kmlBoundaries.js';
import { normalizeKmlBoundaryParts } from '../../../shared/kmlBoundaryGeometry.js';

const fail = code => { throw new KmlBoundaryError(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const supportedCrs = new Set([
    'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:OGC::CRS84', 'OGC:CRS84',
    'EPSG:4326', 'urn:ogc:def:crs:EPSG::4326', 'urn:ogc:def:crs:EPSG:6.6:4326',
    'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
]);

function validateCrs(value) {
    if (!Object.hasOwn(value, 'crs')) return;
    if (!object(value.crs) || value.crs.type !== 'name'
        || !supportedCrs.has(value.crs.properties?.name)) fail('crs');
}

function readRing(coordinates) {
    if (!Array.isArray(coordinates)) fail('ring');
    const points = coordinates.map(position => {
        if (!Array.isArray(position) || position.length < 2 || position.length > 3
            || !position.every(value => typeof value === 'number' && Number.isFinite(value))) fail('coordinates');
        const [lng, lat, altitude = 0] = position;
        if (altitude !== 0) fail('altitude');
        return [lat, lng];
    });
    return validateBoundaryRing(points);
}

function readPolygon(coordinates) {
    if (!Array.isArray(coordinates) || !coordinates.length) fail('ring');
    return validateBoundaryPolygonRings(coordinates.map(readRing));
}

function readGeometry(geometry) {
    if (!object(geometry)) fail('geometry');
    validateCrs(geometry);
    if (geometry.type === 'Polygon') return [readPolygon(geometry.coordinates)];
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length) {
        return geometry.coordinates.map(readPolygon);
    }
    fail('geometry');
}

function readName(feature, index, unnamed) {
    const properties = object(feature.properties) ? feature.properties : {};
    for (const key of ['name', 'Name', 'NAME', 'ED_DESC_FU', 'ED_DESC', 'title']) {
        if (typeof properties[key] === 'string' && properties[key].trim()) return properties[key].trim().replace(/\s+/g, ' ');
    }
    return `${unnamed} ${index + 1}`;
}

export function parseGeoJsonBoundaries(json, { unnamed = 'Unnamed boundary' } = {}) {
    if (typeof json !== 'string' || new TextEncoder().encode(json).length > KML_MAX_BYTES) fail('size');
    let doc;
    try { doc = JSON.parse(json); } catch { fail('geojson'); }
    if (!object(doc)) fail('geojson');
    validateCrs(doc);
    const features = doc.type === 'FeatureCollection' && Array.isArray(doc.features) ? doc.features
        : doc.type === 'Feature' ? [doc]
        : ['Polygon', 'MultiPolygon'].includes(doc.type) ? [{ type: 'Feature', geometry: doc, properties: { name: doc.name } }]
        : null;
    if (!features) fail('geojson');
    if (features.length > KML_MAX_PLACEMARKS) fail('size');
    const boundaries = [], skipped = [];
    features.forEach((feature, index) => {
        const name = object(feature) ? readName(feature, index, unnamed) : `${unnamed} ${index + 1}`;
        const item = { key: `geojson_${index}`, name };
        try {
            if (!object(feature) || feature.type !== 'Feature') fail('geometry');
            validateCrs(feature);
            if (name.length > 240) fail('name');
            const parts = readGeometry(feature.geometry);
            const points = parts.flat(2);
            const boundaryParts = parts.map(rings => rings.map(ring => ring.length));
            if (!normalizeKmlBoundaryParts(boundaryParts, points.length)) fail('budget');
            boundaries.push({ ...item, format: 'geojson', folder: typeof doc.name === 'string' ? doc.name.slice(0, 160) : '', points,
                style: { color: '#0F766E', fillColor: '#14B8A6', fillOpacity: 0.14, strokeOpacity: 1, weight: 2 },
                ...(parts.length > 1 || parts[0].length > 1 ? { boundaryParts } : {}) });
        } catch (error) {
            if (!(error instanceof KmlBoundaryError)) throw error;
            skipped.push({ ...item, reason: error.code });
        }
    });
    return { boundaries, skipped, warnings: [] };
}
