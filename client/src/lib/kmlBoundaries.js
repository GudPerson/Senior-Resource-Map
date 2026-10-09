import {
    createPrintAnnotationId, normalizePrintAnnotation,
    PRINT_ANNOTATION_MAX_COUNT, PRINT_ANNOTATION_MAX_CONTROL_POINTS,
    PRINT_ANNOTATION_MAX_TOTAL_POINTS,
} from './printAnnotations.js';

export const KML_MAX_BYTES = 2 * 1024 * 1024;
export const KML_MAX_PLACEMARKS = 200;
const KML_NAMESPACE = 'http://www.opengis.net/kml/2.2';

export class KmlBoundaryError extends Error {
    constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new KmlBoundaryError(code); };
const children = (element, name) => Array.from(element?.children || []).filter(
    child => child.localName === name && child.namespaceURI === element.namespaceURI,
);
const child = (element, name) => children(element, name)[0];
const text = (element, name) => child(element, name)?.textContent?.trim() || '';
const descendants = (element, name) => Array.from(element.getElementsByTagNameNS(element.namespaceURI, name));

export function parseKmlColor(value) {
    if (!/^[a-f0-9]{8}$/i.test(value)) fail('style');
    return { color: `#${value.slice(6, 8)}${value.slice(4, 6)}${value.slice(2, 4)}`.toUpperCase(), opacity: parseInt(value.slice(0, 2), 16) / 255 };
}

const cross = (a, b, c) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
const between = (a, b, p) => p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
function intersects(a, b, c, d) {
    const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
    return ((x > 0 && y < 0 || x < 0 && y > 0) && (z > 0 && w < 0 || z < 0 && w > 0))
        || x === 0 && between(a, b, c) || y === 0 && between(a, b, d)
        || z === 0 && between(c, d, a) || w === 0 && between(c, d, b);
}

export function parseKmlRing(value) {
    const tuples = String(value).trim().split(/\s+/);
    if (tuples.length > PRINT_ANNOTATION_MAX_CONTROL_POINTS + 1) fail('vertices');
    const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    const points = tuples.map(tuple => {
        const parts = tuple.split(',');
        if (parts.length < 2 || parts.length > 3 || parts.some(part => !number.test(part))) fail('coordinates');
        const [lng, lat, altitude = 0] = parts.map(Number);
        if (![lng, lat, altitude].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) fail('coordinates');
        if (altitude !== 0) fail('altitude');
        return [lat, lng];
    });
    if (points.length < 4 || points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1]) fail('ring');
    points.pop(); // Leaflet closes the outer ring; retain each original corner once.
    if (new Set(points.map(point => point.join(','))).size !== points.length) fail('ring');
    const origin = points[0];
    const area = points.reduce((sum, a, index) => sum + cross(origin, a, points[(index + 1) % points.length]), 0);
    if (Math.abs(area) < 1e-14) fail('ring');
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if (Math.abs(a[1] - b[1]) > 180) fail('coordinates');
        for (let j = i + 2; j < points.length; j++) {
            if (i === 0 && j === points.length - 1) continue;
            if (intersects(a, b, points[j], points[(j + 1) % points.length])) fail('ring');
        }
    }
    return points;
}

function readStyle(element, base) {
    if (!element) return base;
    const line = child(element, 'LineStyle'), fill = child(element, 'PolyStyle');
    if ([line, fill].some(style => text(style, 'colorMode') && text(style, 'colorMode') !== 'normal')) fail('style');
    const outline = text(line, 'color') ? parseKmlColor(text(line, 'color')) : null;
    const interior = text(fill, 'color') ? parseKmlColor(text(fill, 'color')) : null;
    const width = text(line, 'width') ? Number(text(line, 'width')) : base.weight;
    if (!Number.isFinite(width) || width < 0 || width > 12) fail('style');
    const fillFlag = text(fill, 'fill'), outlineFlag = text(fill, 'outline');
    if ([fillFlag, outlineFlag].some(flag => flag && !['0', '1'].includes(flag))) fail('style');
    return { ...base, ...(outline ? { color: outline.color, strokeOpacity: outline.opacity } : {}),
        ...(interior ? { fillColor: interior.color, fillOpacity: interior.opacity } : {}),
        weight: outlineFlag === '0' ? 0 : width,
        ...(fillFlag === '0' ? { fillOpacity: 0 } : {}) };
}

export function parseKmlBoundaries(xml, { Parser = globalThis.DOMParser } = {}) {
    if (typeof xml !== 'string' || new TextEncoder().encode(xml).length > KML_MAX_BYTES) fail('size');
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) fail('xml');
    if (typeof Parser !== 'function') fail('xml');
    const doc = new Parser().parseFromString(xml, 'application/xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'kml' || root.namespaceURI !== KML_NAMESPACE
        || doc.getElementsByTagName('parsererror').length || doc.getElementsByTagNameNS('*', 'parsererror').length) fail('xml');
    if (doc.getElementsByTagName('*').length > 10000) fail('size');
    const placemarks = descendants(root, 'Placemark');
    if (placemarks.length > KML_MAX_PLACEMARKS) fail('size');
    const styles = new Map();
    for (const element of [...descendants(root, 'Style'), ...descendants(root, 'StyleMap')]) {
        const id = element.getAttribute('id');
        if (!id) continue;
        if (styles.has(id)) fail('xml');
        styles.set(id, element);
    }
    const warnings = new Set();
    if (descendants(root, 'NetworkLink').length) warnings.add('external');
    const defaultStyle = { color: '#FFFFFF', fillColor: '#FFFFFF', fillOpacity: 1, strokeOpacity: 1, weight: 1 };
    function resolveStyle(url, seen = new Set()) {
        if (!url) return defaultStyle;
        if (!url.startsWith('#') || !styles.has(url.slice(1))) { warnings.add('external'); return defaultStyle; }
        if (seen.has(url) || seen.size >= 8) fail('style');
        seen.add(url);
        const element = styles.get(url.slice(1));
        if (element.localName === 'Style') return readStyle(element, defaultStyle);
        const normal = children(element, 'Pair').find(pair => text(pair, 'key') === 'normal');
        if (!normal) fail('style');
        return readStyle(child(normal, 'Style'), resolveStyle(text(normal, 'styleUrl'), seen));
    }
    const boundaries = [], skipped = [];
    placemarks.forEach((placemark, index) => {
        const name = text(placemark, 'name').replace(/\s+/g, ' ');
        const item = { key: `kml_${index}`, name };
        try {
            const polygons = children(placemark, 'Polygon');
            if (polygons.length !== 1 || children(placemark, 'MultiGeometry').length) fail('geometry');
            const polygon = polygons[0];
            if (children(polygon, 'innerBoundaryIs').length) fail('holes');
            if (!name || name.length > 240) fail('name');
            const outer = children(polygon, 'outerBoundaryIs');
            const rings = outer.length === 1 ? children(outer[0], 'LinearRing') : [];
            if (rings.length !== 1 || children(rings[0], 'coordinates').length !== 1) fail('ring');
            const points = parseKmlRing(text(rings[0], 'coordinates'));
            const style = readStyle(child(placemark, 'Style'), resolveStyle(text(placemark, 'styleUrl')));
            let folder = placemark.parentElement;
            while (folder && folder.localName !== 'Folder') folder = folder.parentElement;
            boundaries.push({ ...item, folder: text(folder, 'name').slice(0, 160), points, style });
        } catch (error) {
            if (!(error instanceof KmlBoundaryError)) throw error;
            skipped.push({ ...item, reason: error.code });
        }
    });
    return { boundaries, skipped, warnings: [...warnings] };
}

export function getKmlImportCapacity(existing = [], boundaries = []) {
    if (!boundaries.length) return 'selection';
    if (existing.length + boundaries.length > PRINT_ANNOTATION_MAX_COUNT) return 'count';
    const existingPoints = existing.reduce((sum, item) => sum + item.points.length + (item.controlPoints?.length || 0), 0);
    if (existingPoints + boundaries.reduce((sum, item) => sum + item.points.length * 2, 0) > PRINT_ANNOTATION_MAX_TOTAL_POINTS) return 'budget';
    return null;
}

export function appendKmlBoundaries(existing, boundaries) {
    if (boundaries.some(item => item.points.length > PRINT_ANNOTATION_MAX_CONTROL_POINTS)) fail('vertices');
    const capacity = getKmlImportCapacity(existing, boundaries);
    if (capacity) fail(capacity);
    const imported = boundaries.map(boundary => normalizePrintAnnotation({
        id: createPrintAnnotationId(), type: 'polygon', boundarySource: 'kml', isShared: false,
        points: boundary.points, controlPoints: boundary.points, text: boundary.name, style: boundary.style,
    }));
    if (imported.some((item, index) => !item || item.points.length !== boundaries[index].points.length
        || item.controlPoints.length !== boundaries[index].points.length)) fail('vertices');
    return [...existing, ...imported];
}

export function buildKmlBoundaryPreview(boundaries) {
    const all = boundaries.flatMap(item => item.points);
    if (!all.length) return [];
    const lats = all.map(point => point[0]), lngs = all.map(point => point[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const longitudeScale = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    const scale = Math.min(560 / Math.max((maxLng - minLng) * longitudeScale, 1e-8), 260 / Math.max(maxLat - minLat, 1e-8));
    const xOffset = (600 - (maxLng - minLng) * longitudeScale * scale) / 2;
    const yOffset = (300 - (maxLat - minLat) * scale) / 2;
    return boundaries.map(boundary => ({ ...boundary, svgPoints: boundary.points.map(([lat, lng]) => `${xOffset + (lng - minLng) * longitudeScale * scale},${yOffset + (maxLat - lat) * scale}`).join(' ') }));
}
