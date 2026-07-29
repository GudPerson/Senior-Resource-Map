export const PRINT_ANNOTATION_SCHEMA_VERSION = 1;
export const PRINT_ANNOTATION_MAX_COUNT = 100;
export const PRINT_ANNOTATION_MAX_POINTS = 500;
export const PRINT_ANNOTATION_MAX_CONTROL_POINTS = 200;
export const PRINT_ANNOTATION_MAX_TOTAL_POINTS = 2000;

export const PRINT_ANNOTATION_TOOL_SELECT = 'select';
export const PRINT_ANNOTATION_TOOL_PIN = 'pin';
export const PRINT_ANNOTATION_TOOL_LINE = 'line';
export const PRINT_ANNOTATION_TOOL_RECTANGLE = 'rectangle';
export const PRINT_ANNOTATION_TOOL_CIRCLE = 'circle';
export const PRINT_ANNOTATION_TOOL_POLYGON = 'polygon';

export const PRINT_ANNOTATION_DRAW_TOOLS = new Set([
    PRINT_ANNOTATION_TOOL_PIN,
    PRINT_ANNOTATION_TOOL_LINE,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_POLYGON,
]);

export const PRINT_ANNOTATION_COLORS = [
    '#0F766E',
    '#2563EB',
    '#7C3AED',
    '#DB2777',
    '#DC2626',
    '#EA580C',
    '#CA8A04',
    '#334155',
];

export const DEFAULT_PRINT_ANNOTATION_STYLE = Object.freeze({
    color: '#0F766E',
    fillColor: '#14B8A6',
    fillOpacity: 0.14,
    weight: 3,
    dashed: false,
    textColor: '#0F172A',
    fontSize: 14,
});

function clamp(value, minimum, maximum, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
}

export function normalizePrintAnnotationStyle(style = {}) {
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
            0.6,
            DEFAULT_PRINT_ANNOTATION_STYLE.fillOpacity,
        ),
        weight: Math.round(clamp(
            style.weight,
            1,
            12,
            DEFAULT_PRINT_ANNOTATION_STYLE.weight,
        )),
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

function normalizePointList(points, maximum) {
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

export function normalizePrintAnnotation(annotation) {
    const type = String(annotation?.type || '');
    if (!PRINT_ANNOTATION_DRAW_TOOLS.has(type)) return null;
    const points = normalizePointList(annotation?.points, PRINT_ANNOTATION_MAX_POINTS);
    const requiredPoints = {
        pin: 1,
        line: 2,
        rectangle: 2,
        circle: 2,
        polygon: 3,
    }[type];
    if (points.length < requiredPoints) return null;

    const id = String(annotation?.id || '').trim();
    if (!/^[a-z0-9_-]{1,80}$/i.test(id)) return null;
    const text = String(annotation?.text || '').trim().slice(0, 240);
    if (type === PRINT_ANNOTATION_TOOL_PIN && !text) return null;
    const controlPoints = type === PRINT_ANNOTATION_TOOL_POLYGON
        ? normalizePointList(annotation?.controlPoints, PRINT_ANNOTATION_MAX_CONTROL_POINTS)
        : [];
    const polygonPoints = type === PRINT_ANNOTATION_TOOL_POLYGON && controlPoints.length >= 3
        ? controlPoints
        : points;
    return {
        id,
        type,
        points: type === PRINT_ANNOTATION_TOOL_PIN
            ? points.slice(0, 1)
            : [
                PRINT_ANNOTATION_TOOL_LINE,
                PRINT_ANNOTATION_TOOL_RECTANGLE,
                PRINT_ANNOTATION_TOOL_CIRCLE,
            ].includes(type)
                ? points.slice(0, 2)
                : polygonPoints,
        ...(type === PRINT_ANNOTATION_TOOL_POLYGON ? {
            controlPoints: polygonPoints.slice(0, PRINT_ANNOTATION_MAX_CONTROL_POINTS),
        } : {}),
        text,
        style: normalizePrintAnnotationStyle(annotation?.style),
    };
}

export function normalizePrintAnnotations(annotations = []) {
    const seen = new Set();
    const normalized = [];
    let totalPoints = 0;
    for (const annotation of annotations || []) {
        const next = normalizePrintAnnotation(annotation);
        if (!next || seen.has(next.id)) continue;
        const nextPointCount = next.points.length + (next.controlPoints?.length || 0);
        if (totalPoints + nextPointCount > PRINT_ANNOTATION_MAX_TOTAL_POINTS) break;
        seen.add(next.id);
        normalized.push(next);
        totalPoints += nextPointCount;
        if (normalized.length >= PRINT_ANNOTATION_MAX_COUNT) break;
    }
    return normalized;
}

export function createPrintAnnotationId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return `annotation_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;
    }
    return `annotation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createPrintAnnotation({
    type,
    points,
    text = '',
    style = DEFAULT_PRINT_ANNOTATION_STYLE,
}) {
    return normalizePrintAnnotation({
        id: createPrintAnnotationId(),
        type,
        points,
        ...(type === PRINT_ANNOTATION_TOOL_POLYGON ? { controlPoints: points } : {}),
        text,
        style,
    });
}

export function getPrintAnnotationCaptureKey(annotations = []) {
    return JSON.stringify(normalizePrintAnnotations(annotations));
}

export function getPrintAnnotationMinimumPointCount(tool) {
    return {
        pin: 1,
        line: 2,
        rectangle: 2,
        circle: 2,
        polygon: 3,
    }[tool] || 0;
}

export function appendBoundedAnnotationPoint(points, point, maximum = PRINT_ANNOTATION_MAX_POINTS) {
    const normalizedPoint = normalizePrintAnnotationPoint(point);
    if (!normalizedPoint) return points || [];
    return [...(points || []), normalizedPoint].slice(0, maximum);
}

export function getAnnotationLocalDraftKey(userId, mapId) {
    const normalizedUserId = Number(userId);
    const normalizedMapId = Number(mapId);
    if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0) return '';
    if (!Number.isSafeInteger(normalizedMapId) || normalizedMapId <= 0) return '';
    return `carearound:print-annotations:${normalizedUserId}:${normalizedMapId}`;
}
