import assert from 'node:assert/strict';
import test from 'node:test';
import { containsSpatialPoint, createSpatialAreaFromAnnotation, distanceMeters, escapeCsvCell,
    formatRadiusDistance, normalizeSpatialArea, serializeAddressSnapshotCsv, spatialAreaBounds } from '../src/lib/mapSpatialGeometry.js';

const square = [[1.3, 103.8], [1.3, 103.81], [1.31, 103.81], [1.31, 103.8]];

test('rotated rectangles follow the displayed corners rather than their old unrotated extent', () => {
    const area = createSpatialAreaFromAnnotation({ type: 'rectangle', points: [[1.3, 103.8], [1.302, 103.802]], rotationDegrees: 45 });
    assert.equal(area.type, 'Polygon');
    assert.equal(containsSpatialPoint(area, { lat: 1.301, lng: 103.801 }), true);
    assert.equal(containsSpatialPoint(area, [1.302, 103.802]), false);
    assert.equal(containsSpatialPoint(area, [1.3023, 103.801]), true);
    assert.equal(containsSpatialPoint(area, [1.3025, 103.801]), false);
});

test('rounded ordinary polygons exclude cut-off corners and include visible edges', () => {
    const area = createSpatialAreaFromAnnotation({ type: 'polygon', points: square, controlPoints: square });
    assert.equal(containsSpatialPoint(area, [1.305, 103.805]), true);
    assert.equal(containsSpatialPoint(area, [1.30001, 103.80001]), false);
    assert.equal(containsSpatialPoint(area, [1.3, 103.805]), true);
    assert.equal(containsSpatialPoint(area, [1.29999, 103.805]), false);
    assert.equal(area.coordinates[0].length, 21);
});

test('KML multipart areas preserve all rings, exclude hole interiors, and include their boundaries', () => {
    const hole = [[1.303, 103.803], [1.303, 103.807], [1.307, 103.807], [1.307, 103.803]];
    const island = square.map(([lat, lng]) => [lat + 0.02, lng + 0.02]);
    const points = [...square, ...hole, ...island];
    const area = createSpatialAreaFromAnnotation({ type: 'polygon', boundarySource: 'kml', points, controlPoints: points,
        boundaryParts: [[4, 4], [4]] });
    assert.equal(area.type, 'MultiPolygon');
    assert.deepEqual(area.coordinates.map(polygon => polygon.map(ring => ring.length)), [[5, 5], [5]]);
    assert.equal(containsSpatialPoint(area, [1.305, 103.805]), false);
    assert.equal(containsSpatialPoint(area, [1.303, 103.805]), true);
    assert.equal(containsSpatialPoint(area, [1.301, 103.801]), true);
    assert.equal(containsSpatialPoint(area, [1.325, 103.825]), true);
    assert.equal(containsSpatialPoint(area, [1.315, 103.815]), false);
    const overlapping = { type: 'MultiPolygon', coordinates: [...area.coordinates, [area.coordinates[0][0]]] };
    assert.equal(containsSpatialPoint(overlapping, [1.305, 103.805]), true);
});

test('circles use geographic metres, include their edge, and keep the visible minimum radius', () => {
    const center = [1.3, 103.8], edge = [1.301, 103.8];
    const area = createSpatialAreaFromAnnotation({ type: 'circle', points: [center, edge] });
    assert.ok(Math.abs(area.radiusMeters - 111.1949266) < 0.0001);
    assert.equal(containsSpatialPoint(area, edge), true);
    assert.equal(containsSpatialPoint(area, [1.301001, 103.8]), false);
    assert.equal(createSpatialAreaFromAnnotation({ type: 'circle', points: [center, center] }).radiusMeters, 1);
    assert.ok(spatialAreaBounds(area).north >= edge[0]);
    assert.ok(Math.abs(distanceMeters([0, 0], [0, 1]) - 111194.9266) < 0.001);
});

test('invalid coordinates, open/degenerate rings and unsupported annotations do not produce usable areas', () => {
    assert.equal(createSpatialAreaFromAnnotation({ type: 'pin', points: [[1.3, 103.8]] }), null);
    assert.equal(createSpatialAreaFromAnnotation({ type: 'circle', points: [['1.3', 103.8], [1.4, 103.8]] }), null);
    assert.equal(normalizeSpatialArea({ type: 'circle', center: [103.8, 1.3], radiusMeters: 100 }), null);
    assert.equal(normalizeSpatialArea({ type: 'Polygon', coordinates: [[[103, 1], [104, 1], [104, 2]]] }), null);
    assert.equal(normalizeSpatialArea({ type: 'Polygon', coordinates: [[[103, 1], [104, 1], [105, 1], [103, 1]]] }), null);
    assert.equal(containsSpatialPoint({ type: 'circle', center: [1, 103], radiusMeters: 1 }, [NaN, 103]), false);
});

test('circle bounds include dateline-wrapping and polar searches', () => {
    const dateline = { type: 'circle', center: [0, 179.99], radiusMeters: 10000 };
    assert.equal(spatialAreaBounds(dateline).west, -180);
    assert.equal(spatialAreaBounds(dateline).east, 180);
    assert.equal(containsSpatialPoint(dateline, [0, -179.99]), true);
    const polar = spatialAreaBounds({ type: 'circle', center: [89.99, 0], radiusMeters: 10000 });
    assert.equal(polar.north, 90);
    assert.equal(polar.west, -180);
});

test('CSV export quotes fields, protects spreadsheet formulas and leading-zero postal strings', () => {
    assert.equal(escapeCsvCell(' =HYPERLINK("evil")'), '"\' =HYPERLINK(""evil"")"');
    assert.equal(escapeCsvCell('comma, and\nnewline'), '"comma, and\nnewline"');
    const csv = serializeAddressSnapshotCsv([{ postalCode: '018906', block: '1', roadName: '+COMMAND', building: '', address: 'A, B', lat: 1.3, lng: 103.8 }]);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('"\'018906"'));
    assert.ok(csv.includes('"\'+COMMAND"'));
    assert.ok(csv.includes('"A, B"'));
    assert.equal(formatRadiusDistance(100), '100 m');
    assert.equal(formatRadiusDistance(1500), '1.5 km');
});
