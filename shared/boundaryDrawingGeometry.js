// Existing pure annotation math, shared by rendering and immutable boundary snapshots.
import { splitKmlBoundaryParts, orientKmlBoundaryDisplayParts } from './kmlBoundaryGeometry.js';
import { distanceMeters, isSpatialCoordinate, normalizeSpatialArea } from './addressSnapshotSpatial.js';

export const PRINT_ANNOTATION_MAX_POINTS = 500;
export const PRINT_ANNOTATION_MAX_CONTROL_POINTS = 200;
export const PRINT_ANNOTATION_MAX_TOTAL_POINTS = 20000;

export const DEFAULT_PRINT_ANNOTATION_STYLE = Object.freeze({
    color: '#0F766E',
    fillColor: '#14B8A6',
    fillOpacity: 0.14,
    weight: 3,
    dashed: false,
    textColor: '#0F172A',
    fontSize: 14,
});

export function clamp(value, minimum, maximum, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
}

export function normalizePrintAnnotationStyle(style = {}, { boundary = false } = {}) {
    const color = /^#[0-9a-f]{6}$/i.test(String(style.color || ''))
        ? String(style.color).toUpperCase()
        : DEFAULT_PRINT_ANNOTATION_STYLE.color;
    const fillColor = /^#[0-9a-f]{6}$/i.test(String(style.fillColor || ''))
        ? String(style.fillColor).toUpperCase()
        : color;
    return {
        color,
        fillColor,
        fillOpacity: clamp(
            style.fillOpacity,
            0,
            boundary ? 1 : 0.6,
            DEFAULT_PRINT_ANNOTATION_STYLE.fillOpacity,
        ),
        weight: (boundary ? Number : Math.round)(clamp(
            style.weight,
            boundary ? 0 : 1,
            12,
            DEFAULT_PRINT_ANNOTATION_STYLE.weight,
        )),
        ...(boundary ? { strokeOpacity: clamp(style.strokeOpacity, 0, 1, 1) } : {}),
        dashed: Boolean(style.dashed),
        textColor: /^#[0-9a-f]{6}$/i.test(String(style.textColor || ''))
            ? String(style.textColor).toUpperCase()
            : DEFAULT_PRINT_ANNOTATION_STYLE.textColor,
        fontSize: Math.round(clamp(
            style.fontSize,
            10,
            32,
            DEFAULT_PRINT_ANNOTATION_STYLE.fontSize,
        )),
    };
}

export function normalizePrintAnnotationPoint(point) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
}

export function normalizePrintAnnotationRotation(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const wrapped = ((((numeric + 180) % 360) + 360) % 360) - 180;
    if (Math.abs(wrapped) < 0.001) return 0;
    return Math.round(wrapped * 1000) / 1000;
}

export function normalizePointList(points, maximum) {
    return (points || [])
        .map(normalizePrintAnnotationPoint)
        .filter(Boolean)
        .slice(0, maximum);
}

function interpolatePoint(start, end, amount) {
    return [
        start[0] + ((end[0] - start[0]) * amount),
        start[1] + ((end[1] - start[1]) * amount),
    ];
}

export function buildRoundedPrintAnnotationPolygon(
    points = [],
    {
        cornerRatio = 0.16,
        curveSteps = 4,
    } = {},
) {
    const normalized = normalizePointList(points, PRINT_ANNOTATION_MAX_POINTS);
    if (normalized.length < 3) return normalized;

    const ratio = clamp(cornerRatio, 0.04, 0.3, 0.16);
    const maximumSteps = Math.floor(PRINT_ANNOTATION_MAX_POINTS / normalized.length) - 1;
    const steps = Math.min(
        Math.round(clamp(curveSteps, 1, 8, 4)),
        maximumSteps,
    );
    if (steps < 1) return normalized;

    const rounded = [];
    normalized.forEach((current, index) => {
        const previous = normalized[(index - 1 + normalized.length) % normalized.length];
        const next = normalized[(index + 1) % normalized.length];
        const entry = interpolatePoint(current, previous, ratio);
        const exit = interpolatePoint(current, next, ratio);
        rounded.push(entry);

        for (let step = 1; step <= steps; step += 1) {
            const progress = step / steps;
            const inverse = 1 - progress;
            rounded.push([
                (inverse * inverse * entry[0])
                    + (2 * inverse * progress * current[0])
                    + (progress * progress * exit[0]),
                (inverse * inverse * entry[1])
                    + (2 * inverse * progress * current[1])
                    + (progress * progress * exit[1]),
            ]);
        }
    });
    return rounded;
}

export function buildPrintAnnotationPolygonPoints(annotation, points = annotation.controlPoints || annotation.points) {
    if (annotation.boundarySource === 'kml') {
        return annotation.boundaryParts ? orientKmlBoundaryDisplayParts(splitKmlBoundaryParts(points, annotation.boundaryParts)) : points;
    }
    return buildRoundedPrintAnnotationPolygon(points);
}

export function getPrintAnnotationPointBoundsCenter(points = [], maximum = PRINT_ANNOTATION_MAX_POINTS) {
    const currentPoints = normalizePointList(points, maximum);
    if (!currentPoints.length) return null;
    const latitudes = currentPoints.map(([lat]) => lat);
    const longitudes = currentPoints.map(([, lng]) => lng);
    return [
        (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
        (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    ];
}

export function rotatePrintAnnotationPoints(points, centerPoint, angleDegrees, maximum = PRINT_ANNOTATION_MAX_POINTS) {
    const currentPoints = normalizePointList(points, maximum);
    const center = normalizePrintAnnotationPoint(centerPoint);
    const angle = Number(angleDegrees);
    if (!currentPoints.length || !center || !Number.isFinite(angle)) return currentPoints;
    const radians = angle * (Math.PI / 180);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const rotated = currentPoints.map(([lat, lng]) => {
        const latDelta = lat - center[0];
        const lngDelta = lng - center[1];
        return normalizePrintAnnotationPoint([
            center[0] + (latDelta * cosine) + (lngDelta * sine),
            center[1] + (lngDelta * cosine) - (latDelta * sine),
        ]);
    });
    return rotated.every(Boolean) ? rotated : currentPoints;
}

export function buildPrintAnnotationRectanglePoints(points, rotationDegrees = 0) {
    const currentPoints = normalizePointList(points, 2);
    if (currentPoints.length < 2) return currentPoints;
    const [first, second] = currentPoints;
    const corners = [
        [first[0], first[1]],
        [first[0], second[1]],
        [second[0], second[1]],
        [second[0], first[1]],
    ];
    const rotation = normalizePrintAnnotationRotation(rotationDegrees);
    if (!rotation) return corners;
    return rotatePrintAnnotationPoints(
        corners,
        getPrintAnnotationPointBoundsCenter(currentPoints),
        rotation,
    );
}

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
