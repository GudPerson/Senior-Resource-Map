import { containsSpatialPoint, createSpatialAreaFromAnnotation, spatialAreaBounds } from './mapSpatialGeometry.js';

export const hasMapLayerHits = result => ['resources', 'areas', 'annotations'].some(key => result?.[key]?.length);

// Compare only the readout and its anchor, never serialize stored geometry.
export function mapLayerInspectionKey(inspection) {
    if (!inspection) return '';
    return JSON.stringify([inspection.scopeKey, inspection.point, inspection.x, inspection.y,
        ...['resources', 'areas', 'annotations'].map(key => (inspection.result?.[key] || []).map(item =>
            [item.id, item.name, item.type, item.placeName, Boolean(item.cluster)]))]);
}

const insideRect = (rect, point, pad = 0) => Boolean(rect && point
    && point.x >= rect.left - pad && point.x <= rect.right + pad
    && point.y >= rect.top - pad && point.y <= rect.bottom + pad);

function pointBounds(points) {
    return points.reduce((b, p) => ({ left: Math.min(b.left, p.x), right: Math.max(b.right, p.x),
        top: Math.min(b.top, p.y), bottom: Math.max(b.bottom, p.y) }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
}

function segmentDistance(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

// Inputs are the already-rendered subset. This helper never decides visibility
// or reads the catalogue, so view-hidden and map-scoped content cannot leak in.
export function buildAnnotationInspectionIndex(annotations = [], { project, renderedStyles = new Map() } = {}) {
    return annotations.map((annotation, order) => {
        const area = createSpatialAreaFromAnnotation(annotation);
        const screenPoints = annotation.type === 'line' && project ? annotation.points.map(project) : null;
        const imageBounds = annotation.type === 'image' && annotation.points?.length === 2
            ? { south: Math.min(...annotation.points.map(p => p[0])), north: Math.max(...annotation.points.map(p => p[0])),
                west: Math.min(...annotation.points.map(p => p[1])), east: Math.max(...annotation.points.map(p => p[1])) } : null;
        return { id: annotation.id, name: String(annotation.text || ''), type: annotation.type, order,
            area, bounds: area ? spatialAreaBounds(area) : null, imageBounds,
            points: annotation.points || [], screenPoints,
            screenBounds: screenPoints ? pointBounds(screenPoints) : null,
            weight: Math.max(0, Number(annotation.style?.weight) || 0), renderedStyle: renderedStyles.get(annotation.id) };
    });
}

export function buildResourceInspectionIndex(presentation = {}) {
    const index = new Map();
    for (const group of presentation.mappedGroups || []) {
        const members = group.isPostalGroup ? group.nestedPlaces || [] : [group];
        const groupedRows = [];
        for (const member of members) {
            const rows = (member.rows || []).map((row, i) => ({
                id: `${member.placeKey}:${row.rowKey || row.assetKey || `${row.resourceType || ''}-${row.resourceId || i}`}`,
                name: String(row.name || ''), placeName: String(member.name || ''), placeKey: member.placeKey,
            }));
            index.set(member.placeKey, rows);
            groupedRows.push(...rows);
        }
        index.set(group.placeKey, groupedRows);
    }
    return index;
}

export function inspectMapLayers({ index = [], point, screenPoint, project,
    annotationFootprints = [], resourceIndex = new Map(), resourceFootprints = [] }) {
    const hits = new Set(annotationFootprints.filter(item => insideRect(item.rect, screenPoint)).map(item => item.id));
    const areas = [], annotations = [];
    for (const item of index) {
        const bounds = item.bounds;
        const areaHit = bounds && point && point[0] >= bounds.south && point[0] <= bounds.north
            && point[1] >= bounds.west && point[1] <= bounds.east && containsSpatialPoint(item.area, point);
        const imageHit = item.imageBounds && point && point[0] >= item.imageBounds.south && point[0] <= item.imageBounds.north
            && point[1] >= item.imageBounds.west && point[1] <= item.imageBounds.east;
        let hit = areaHit || imageHit || hits.has(item.id);
        if (!hit && item.type === 'line' && screenPoint) {
            // Leaflet's live options include the selected path's extra pixel.
            // The six-pixel pointer allowance remains independent of zoom.
            const tolerance = 6 + Math.max(0, Number(item.renderedStyle?.weight ?? item.weight) || 0) / 2;
            const points = item.screenPoints || (project ? item.points.map(project) : []);
            const bounds = item.screenBounds || pointBounds(points);
            hit = insideRect(bounds, screenPoint, tolerance)
                && points.some((p, i) => i > 0 && segmentDistance(screenPoint, points[i - 1], p) <= tolerance);
        }
        if (hit) (item.area ? areas : annotations).push({ id: item.id, name: item.name, type: item.type, order: item.order });
    }
    const resources = new Map();
    for (const footprint of resourceFootprints) {
        if (!insideRect(footprint.rect, screenPoint, 2)) continue;
        for (const key of footprint.placeKeys) {
            for (const row of resourceIndex.get(key) || []) resources.set(row.id, { ...row, cluster: Boolean(footprint.cluster) });
        }
    }
    return { point, resources: [...resources.values()],
        areas: areas.sort((a, b) => b.order - a.order), annotations: annotations.sort((a, b) => b.order - a.order) };
}
