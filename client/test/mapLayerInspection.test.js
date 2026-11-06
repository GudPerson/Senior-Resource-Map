import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnnotationInspectionIndex, buildResourceInspectionIndex, inspectMapLayers, mapLayerInspectionKey, hasMapLayerHits } from '../src/lib/mapLayerInspection.js';

const square = [[1, 103], [1, 104], [2, 104], [2, 103]];
const polygon = (id, text, points = square) => ({ id, text, type: 'polygon', points, boundarySource: 'kml', boundaryParts: [[points.length]] });
const project = ([lat, lng]) => ({ x: lng * 100, y: lat * 100 });
const inspect = (annotations, point, extra = {}) => inspectMapLayers({
    index: buildAnnotationInspectionIndex(annotations), point, screenPoint: project(point), project, ...extra,
});

test('equivalent visible readouts deduplicate, while names, anchor, scope and hidden items change output', () => {
    const result = { resources: [], areas: [{ id: 'a', name: 'RHS', type: 'polygon' }], annotations: [] };
    const value = { point: [1.5, 103.5], x: 200, y: 300, scopeKey: 'map:view', result };
    assert.equal(mapLayerInspectionKey(value), mapLayerInspectionKey(structuredClone(value)));
    assert.notEqual(mapLayerInspectionKey(value), mapLayerInspectionKey({ ...value, scopeKey: 'map:other' }));
    assert.notEqual(mapLayerInspectionKey(value), mapLayerInspectionKey({ ...value, x: 201 }));
    assert.notEqual(mapLayerInspectionKey(value), mapLayerInspectionKey({ ...value, result: { ...result, areas: [{ ...result.areas[0], name: 'GRC' }] } }));
    assert.equal(hasMapLayerHits(result), true);
    assert.equal(hasMapLayerHits({ resources: [], areas: [], annotations: [] }), false);
});

test('all overlapping visible areas are returned, not just the topmost, and labels deduplicate', () => {
    const annotations = [polygon('rhs', 'RHS'), polygon('grc', 'GRC')];
    const result = inspect(annotations, [1.5, 103.5], { annotationFootprints: [{ id: 'rhs', rect: { left: 10300, right: 10400, top: 100, bottom: 200 } }] });
    assert.deepEqual(result.areas.map(item => item.id), ['grc', 'rhs']);
    assert.equal(result.annotations.length, 0);
    assert.equal(inspect(annotations.slice(0, 1), [1.5, 103.5]).areas.length, 1);
});

test('multipart holes exclude interiors, include edges, and retain a separate island', () => {
    const hole = [[1.2, 103.2], [1.2, 103.8], [1.8, 103.8], [1.8, 103.2]];
    const island = square.map(([lat, lng]) => [lat + 2, lng + 2]);
    const annotation = { ...polygon('hole', 'Holed'), points: [...square, ...hole, ...island], boundaryParts: [[4, 4], [4]] };
    assert.equal(inspect([annotation], [1.5, 103.5]).areas.length, 0);
    assert.equal(inspect([annotation], [1.2, 103.5]).areas.length, 1);
    assert.equal(inspect([annotation], [3.5, 105.5]).areas.length, 1);
});

test('circle and rotated rectangle use the renderer geometry; lines use screen-pixel tolerance', () => {
    const circle = { id: 'circle', type: 'circle', text: 'Radius', points: [[1.3, 103.8], [1.301, 103.8]] };
    assert.equal(inspect([circle], [1.3005, 103.8]).areas.length, 1);
    assert.equal(inspect([circle], [1.302, 103.8]).areas.length, 0);
    const rectangle = { id: 'r', type: 'rectangle', text: 'Rotated', points: [[1.3, 103.8], [1.302, 103.802]], rotationDegrees: 45 };
    assert.equal(inspect([rectangle], [1.302, 103.802]).areas.length, 0);
    const line = { id: 'line', type: 'line', text: 'Route', points: [[1, 103], [2, 103]], style: { weight: 2 } };
    assert.equal(inspect([line], [1.5, 103.05]).annotations.length, 1);
    assert.equal(inspect([line], [1.5, 103.2]).annotations.length, 0);
});

test('line hit tolerance follows canonical and live selected stroke weights without reprojection', () => {
    const line = { id: 'line', type: 'line', points: [[1, 103], [2, 103]], style: { weight: 12 } };
    assert.equal(inspect([line], [1.5, 103.0625]).annotations.length, 1);
    const style = { weight: 13 };
    const index = buildAnnotationInspectionIndex([line], { project, renderedStyles: new Map([['line', style]]) });
    const query = () => inspectMapLayers({ index, point: [1.5, 103.1225], screenPoint: project([1.5, 103.1225]) });
    assert.equal(query().annotations.length, 1);
    style.weight = 12;
    assert.equal(query().annotations.length, 0);
});

test('text, pins and images require their actual painted footprint and hidden IDs cannot leak', () => {
    const pin = { id: 'p', type: 'pin', text: '<safe text>', points: [[1, 103]] };
    const footprint = { id: 'p', rect: { left: 10345, right: 10355, top: 145, bottom: 155 } };
    assert.equal(inspect([pin], [1.5, 103.5]).annotations.length, 0);
    assert.equal(inspect([pin], [1.5, 103.5], { annotationFootprints: [footprint] }).annotations[0].name, '<safe text>');
    assert.equal(inspect([], [1.5, 103.5], { annotationFootprints: [footprint] }).annotations.length, 0);
    const image = { id: 'image', type: 'image', points: [[1.4, 103.4], [1.6, 103.6]] };
    assert.equal(inspect([image], [1.5, 103.5]).annotations[0].type, 'image');
    assert.equal(inspect([image], [1.7, 103.5]).annotations.length, 0);
});

test('co-located resources include every scoped row, not the three-name pin preview or unmapped rows', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ rowKey: `soft-${i}`, name: `Resource ${i}` }));
    const resources = buildResourceInspectionIndex({ mappedGroups: [{ placeKey: 'inside', name: 'Venue', rows }], unmappedRows: [{ rowKey: 'online', name: 'Online' }] });
    const rect = { left: 10345, right: 10355, top: 145, bottom: 155 };
    const result = inspect([], [1.5, 103.5], { resourceIndex: resources, resourceFootprints: [{ placeKeys: ['inside', 'outside'], rect }] });
    assert.equal(result.resources.length, 5);
    assert.equal(inspect([], [1.5, 103.5], { resourceIndex: resources, resourceFootprints: [] }).resources.length, 0);
});

test('postal member rows and a cluster return only current mapped membership, deduplicated', () => {
    const resources = buildResourceInspectionIndex({ mappedGroups: [{ placeKey: 'postal', isPostalGroup: true, nestedPlaces: [
        { placeKey: 'a', name: 'A', rows: [{ assetKey: 'hard-1', name: 'One' }] },
        { placeKey: 'b', name: 'B', rows: [{ assetKey: 'soft-2', name: 'Two' }] },
    ] }] });
    const rect = { left: 10300, right: 10400, top: 100, bottom: 200 };
    const result = inspect([], [1.5, 103.5], { resourceIndex: resources, resourceFootprints: [{ placeKeys: ['postal', 'a'], rect, cluster: true }] });
    assert.deepEqual(result.resources.map(item => item.name), ['One', 'Two']);
    assert.ok(result.resources.every(item => item.cluster));
});

test('200 annotations and 20,000 points project once per viewport index, never per hover query', () => {
    let projections = 0;
    const annotations = Array.from({ length: 200 }, (_, id) => ({ id: String(id), type: 'line', text: `Line ${id}`,
        points: Array.from({ length: 100 }, (_, n) => [1 + n / 1000, 103 + id / 1000]) }));
    const project = point => { projections++; return { x: point[1] * 1000, y: point[0] * 1000 }; };
    const index = buildAnnotationInspectionIndex(annotations, { project });
    assert.equal(projections, 20000);
    for (let i = 0; i < 20; i++) {
        inspectMapLayers({ index, point: [1.05, 103.1], screenPoint: { x: 103100, y: 1050 }, project });
    }
    assert.equal(projections, 20000);
    assert.equal(index.length, 200);
});
