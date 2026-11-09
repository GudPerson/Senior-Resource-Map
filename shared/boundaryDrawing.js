import { PRINT_ANNOTATION_DOCUMENT_MAX_COUNT } from './printAnnotationLimits.js';
import { KML_MAX_GEOMETRY_POINTS, KML_MAX_POLYGON_CORNERS, normalizeKmlBoundaryParts } from './kmlBoundaryGeometry.js';
import { normalizeAnnotationGroupName } from './annotationGroups.js';
import { isSpatialCoordinate, normalizeSpatialArea } from './addressSnapshotSpatial.js';
import { PRINT_ANNOTATION_MAX_POINTS, PRINT_ANNOTATION_MAX_CONTROL_POINTS, PRINT_ANNOTATION_MAX_TOTAL_POINTS,
    normalizePrintAnnotationStyle, normalizePrintAnnotationRotation, createSpatialAreaFromAnnotation } from './boundaryDrawingGeometry.js';

export const BOUNDARY_DRAWING_SCHEMA_VERSION = 1;

export class BoundaryDrawingError extends Error {
    constructor(code) {
        super(`Boundary drawing rejected: ${code}`);
        this.name = 'BoundaryDrawingError';
        this.code = code;
    }
}
const fail = code => { throw new BoundaryDrawingError(code); };

function validatePointListLength(points, maximum, minimum) {
    if (!Array.isArray(points)) fail('geometry');
    if (points.length > maximum) fail('vertices');
    if (points.length < minimum) fail('geometry');
}

function validatePoints(points) {
    for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        if (!isSpatialCoordinate(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number') fail('geometry');
    }
}

// Length-only preflight: no coordinate traversal, snapshot allocation or spatial projection.
function storedGeometrySize(raw, closedOnly) {
    if (!raw || typeof raw !== 'object') fail('unsupported');
    const supported = closedOnly ? ['circle', 'rectangle', 'polygon'] : ['pin', 'line', 'circle', 'rectangle', 'polygon', 'image'];
    if (!supported.includes(raw.type)) fail('unsupported');
    const polygon = raw.type === 'polygon';
    const boundary = polygon && raw.boundarySource === 'kml';
    if (raw.boundarySource !== undefined && !boundary) fail('geometry');
    if (raw.boundaryParts !== undefined && !boundary) fail('geometry');
    validatePointListLength(raw.points, boundary ? KML_MAX_GEOMETRY_POINTS : PRINT_ANNOTATION_MAX_POINTS,
        polygon ? 3 : raw.type === 'pin' ? 1 : 2);
    if (!polygon && raw.points.length !== (raw.type === 'pin' ? 1 : 2)) fail('geometry');
    if (raw.controlPoints !== undefined) {
        if (!polygon) fail('geometry');
        validatePointListLength(raw.controlPoints, boundary ? KML_MAX_GEOMETRY_POINTS : PRINT_ANNOTATION_MAX_CONTROL_POINTS, 3);
    }
    return raw.points.length + (raw.controlPoints?.length || 0);
}

function validateStoredGeometry(raw, closedOnly) {
    storedGeometrySize(raw, closedOnly);
    validatePoints(raw.points);
    if (raw.controlPoints !== undefined) validatePoints(raw.controlPoints);
    const boundary = raw.type === 'polygon' && raw.boundarySource === 'kml';
    if (boundary) {
        // Bound layout traversal before inspecting individual ring counts.
        if (raw.boundaryParts !== undefined) {
            if (!Array.isArray(raw.boundaryParts) || !raw.boundaryParts.length
                || raw.boundaryParts.length > raw.points.length / 3) fail('geometry');
            for (const rings of raw.boundaryParts) {
                if (!Array.isArray(rings) || !rings.length || rings.length > KML_MAX_POLYGON_CORNERS / 3) fail('geometry');
            }
        }
        // Ring limits are independent of the larger multipart geometry limit.
        if (Array.isArray(raw.boundaryParts) && raw.boundaryParts.some(rings => Array.isArray(rings)
            && rings.every(Number.isInteger) && rings.reduce((sum, count) => sum + count, 0) > KML_MAX_POLYGON_CORNERS)) fail('vertices');
        if (raw.boundaryParts === undefined && raw.points.length > KML_MAX_POLYGON_CORNERS) fail('vertices');
        if (!normalizeKmlBoundaryParts(raw.boundaryParts, raw.points.length)
            || !Array.isArray(raw.controlPoints) || raw.controlPoints.length !== raw.points.length
            || raw.points.some((point, index) => point[0] !== raw.controlPoints[index][0] || point[1] !== raw.controlPoints[index][1])) fail('geometry');
    }
    if (raw.rotationDegrees !== undefined && (typeof raw.rotationDegrees !== 'number' || !Number.isFinite(raw.rotationDegrees))) fail('geometry');
}

function validateSnapshotFields(raw) {
    for (const field of ['text', 'name', 'groupName']) {
        if (raw[field] !== undefined && typeof raw[field] !== 'string') fail('geometry');
    }
    if (raw.style === undefined) return;
    if (!raw.style || typeof raw.style !== 'object' || Array.isArray(raw.style)) fail('geometry');
    for (const field of ['color', 'fillColor', 'textColor']) {
        if (raw.style[field] !== undefined && typeof raw.style[field] !== 'string') fail('geometry');
    }
    for (const field of ['fillOpacity', 'weight', 'strokeOpacity', 'fontSize']) {
        if (raw.style[field] !== undefined && (typeof raw.style[field] !== 'number' || !Number.isFinite(raw.style[field]))) fail('geometry');
    }
    if (raw.style.dashed !== undefined && typeof raw.style.dashed !== 'boolean') fail('geometry');
}

/** ID-less, deeply owned snapshot. Ordinary controls retain their legacy rendering precedence. */
export function canonicalizeBoundaryDrawing(raw) {
    validateStoredGeometry(raw, true);
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== BOUNDARY_DRAWING_SCHEMA_VERSION) fail('geometry');
    const boundary = raw.boundarySource === 'kml';
    validateSnapshotFields(raw);
    const rotationDegrees = normalizePrintAnnotationRotation(raw.rotationDegrees);
    const groupName = normalizeAnnotationGroupName(raw.groupName);
    const drawing = {
        schemaVersion: BOUNDARY_DRAWING_SCHEMA_VERSION,
        type: raw.type,
        ...(boundary ? { boundarySource: 'kml' } : {}),
        ...(raw.boundaryParts !== undefined ? { boundaryParts: raw.boundaryParts.map(rings => [...rings]) } : {}),
        points: raw.points.map(point => [...point]),
        ...(raw.controlPoints !== undefined ? { controlPoints: raw.controlPoints.map(point => [...point]) } : {}),
        ...(rotationDegrees ? { rotationDegrees } : {}),
        ...(typeof raw.name === 'string' && raw.name.trim() ? { name: raw.name.trim().slice(0, 240) } : {}),
        text: String(raw.text || '').trim().slice(0, 240),
        ...(groupName ? { groupName } : {}),
        style: normalizePrintAnnotationStyle(raw.style, { boundary }),
    };
    if (!normalizeSpatialArea(createSpatialAreaFromAnnotation(drawing))) fail('geometry');
    return drawing;
}

/** Geographic projection is exactly the existing displayed area, including rounded corners and holes. */
export function boundaryDrawingToArea(drawing) {
    return createSpatialAreaFromAnnotation(canonicalizeBoundaryDrawing(drawing));
}

export function countBoundaryDrawingStoredPoints(drawing) {
    const canonical = canonicalizeBoundaryDrawing(drawing);
    return canonical.points.length + (canonical.controlPoints?.length || 0);
}

/** Call on the complete latest canonical document, including hidden annotations, before any mutation. */
export function assertBoundaryDrawingBatchCapacity(existingCanonicalAnnotations, drawings) {
    if (!Array.isArray(existingCanonicalAnnotations) || !Array.isArray(drawings)) fail('geometry');
    if (existingCanonicalAnnotations.length + drawings.length > PRINT_ANNOTATION_DOCUMENT_MAX_COUNT) fail('count');
    let total = 0;
    for (const [items, closedOnly] of [[existingCanonicalAnnotations, false], [drawings, true]]) {
        for (let index = 0; index < items.length; index += 1) {
            total += storedGeometrySize(items[index], closedOnly);
            if (total > PRINT_ANNOTATION_MAX_TOTAL_POINTS) fail('budget');
        }
    }
    // Only bounded inputs reach full validation. Nothing is appended or retained on rejection.
    for (const annotation of existingCanonicalAnnotations) validateStoredGeometry(annotation, false);
    for (const drawing of drawings) canonicalizeBoundaryDrawing(drawing);
}
