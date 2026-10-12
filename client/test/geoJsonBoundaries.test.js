import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeoJsonBoundaries } from '../src/lib/geoJsonBoundaries.js';
import { appendKmlBoundaries, getKmlImportCapacity, buildKmlBoundaryPreview } from '../src/lib/kmlBoundaries.js';
import { normalizePrintAnnotations, duplicatePrintAnnotation, buildPrintAnnotationPolygonPoints } from '../src/lib/printAnnotations.js';
import { getKmlBoundaryMessages } from '../src/lib/kmlBoundaryMessages.js';

const outer = [[103.7, 1.3], [103.8, 1.3], [103.8, 1.4], [103.7, 1.4], [103.7, 1.3]];
const hole = [[103.72, 1.32], [103.74, 1.32], [103.74, 1.34], [103.72, 1.34], [103.72, 1.32]];
const island = outer.map(([x, y]) => [x + 0.2, y]);
const feature = (coordinates = [outer], properties = { name: 'Fictional area' }, type = 'Polygon') =>
    ({ type: 'Feature', properties, geometry: { type, coordinates } });
const parse = doc => parseGeoJsonBoundaries(JSON.stringify(doc));
const collection = features => ({ type: 'FeatureCollection', features });
const circle = (count, radius = 0.01) => {
    const ring = Array.from({ length: count }, (_, i) => [103.7 + Math.cos(i * Math.PI * 2 / count) * radius, 1.3 + Math.sin(i * Math.PI * 2 / count) * radius]);
    return [...ring, ring[0]];
};
const code = expected => error => error.code === expected;

test('GeoJSON collections, features and bare polygon geometries retain longitude/latitude exactly', () => {
    const precise = outer.map(([x, y]) => [x + 0.0000000001234567, y + 0.0000000007654321]);
    for (const doc of [collection([feature([precise])]), feature([precise]), { type: 'Polygon', coordinates: [precise] }]) {
        const result = parse(doc);
        assert.equal(result.skipped.length, 0);
        assert.deepEqual(result.boundaries[0].points, precise.slice(0, -1).map(([x, y]) => [y, x]));
        assert.equal(result.boundaries[0].format, 'geojson');
    }
});

test('multipart features keep their holes, grouping and every source corner through import, reload and duplicate', () => {
    const geometry = feature([[outer, hole], [island]], { Name: 'Fictional mainland and island' }, 'MultiPolygon');
    const parsed = parse(geometry);
    assert.equal(parsed.boundaries.length, 1);
    assert.deepEqual(parsed.boundaries[0].boundaryParts, [[4, 4], [4]]);
    const expected = [outer, hole, island].flatMap(ring => ring.slice(0, -1).map(([x, y]) => [y, x]));
    assert.deepEqual(parsed.boundaries[0].points, expected);
    const document = appendKmlBoundaries([], parsed.boundaries);
    // Existing installed clients recognize this imported-boundary discriminator.
    assert.equal(document[0].boundarySource, 'kml');
    assert.equal(document[0].isShared, false);
    assert.deepEqual(document[0].points, expected);
    assert.deepEqual(document[0].controlPoints, expected);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(document))), document);
    const duplicate = duplicatePrintAnnotation(document[0], { offset: [0, 0] });
    assert.deepEqual(duplicate.points, expected);
    assert.deepEqual(duplicate.boundaryParts, [[4, 4], [4]]);
    assert.equal(duplicate.boundarySource, 'kml');
    const paths = buildPrintAnnotationPolygonPoints(document[0]);
    assert.equal(paths.length, 2);
    assert.equal(paths[0].length, 2);
    assert.equal(paths[0][1].length, 4);
});

test('bare MultiPolygon and reversed winding preserve their supplied ring order', () => {
    const doc = { type: 'MultiPolygon', coordinates: [[outer.toReversed(), hole.toReversed()], [island]] };
    const parsed = parse(doc);
    assert.deepEqual(parsed.boundaries[0].points.slice(0, 4), outer.toReversed().slice(0, -1).map(([x, y]) => [y, x]));
    assert.deepEqual(parsed.boundaries[0].boundaryParts, [[4, 4], [4]]);
    const preview = buildKmlBoundaryPreview(parsed.boundaries)[0];
    assert.equal(preview.svgPaths.length, 2);
    assert.equal((preview.svgPaths[0].match(/M/g) || []).length, 2);
});

test('compatible legacy CRS84 declarations are accepted, while projected or conflicting coordinates are refused', () => {
    const crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } };
    assert.equal(parse({ ...collection([feature()]), crs }).boundaries.length, 1);
    assert.equal(parse({ ...feature(), crs: { type: 'name', properties: { name: 'EPSG:4326' } } }).boundaries.length, 1);
    assert.throws(() => parse({ ...collection([feature()]), crs: { type: 'name', properties: { name: 'EPSG:3414' } } }), code('crs'));
    const result = parse(collection([{ ...feature(), geometry: { ...feature().geometry, crs: { type: 'link', properties: { href: 'https://example.invalid/crs' } } } }]));
    assert.equal(result.boundaries.length, 0); assert.equal(result.skipped[0].reason, 'crs');
});

test('arbitrary JSON, malformed documents, excess items and excess bytes fail clearly', () => {
    for (const text of ['{', '[]', 'null', '{"name":"not geographic"}', '{"type":"FeatureCollection","features":{}}']) {
        assert.throws(() => parseGeoJsonBoundaries(text), code('geojson'));
    }
    assert.throws(() => parse(collection(Array.from({ length: 201 }, () => feature()))), code('size'));
    assert.throws(() => parseGeoJsonBoundaries(' '.repeat(2 * 1024 * 1024 + 1)), code('size'));
    assert.deepEqual(parse(collection([])), { boundaries: [], skipped: [], warnings: [] });
});

test('pins, lines and mixed GeometryCollections are skipped without partially importing a feature', () => {
    const result = parse(collection([feature(), { type: 'Feature', geometry: { type: 'Point', coordinates: outer[0] } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: outer } },
        { type: 'Feature', geometry: { type: 'GeometryCollection', geometries: [feature().geometry] } }]));
    assert.equal(result.boundaries.length, 1);
    assert.deepEqual(result.skipped.map(item => item.reason), ['geometry', 'geometry', 'geometry']);
});

test('invalid coordinates, altitude, open, crossing and repeated rings are skipped without repair', () => {
    const inputs = [
        [outer.slice(0, -1), 'ring'],
        [[[103, 1], [104, 2], [103, 2], [104, 1], [103, 1]], 'ring'],
        [[[103, 1], [104, 1], [103, 1], [104, 2], [103, 1]], 'ring'],
        [outer.map(([x, y]) => [String(x), y]), 'coordinates'],
        [outer.map(([x]) => [x, 91]), 'coordinates'],
        [outer.map(([x, y]) => [x, y, 10]), 'altitude'],
        [[[179, 1], [-179, 1], [-179, 2], [179, 2], [179, 1]], 'coordinates'],
    ];
    for (const [ring, reason] of inputs) {
        const result = parse(feature([ring]));
        assert.equal(result.boundaries.length, 0); assert.equal(result.skipped[0].reason, reason);
    }
    assert.equal(parse(feature([outer.map(([x, y]) => [x, y, 0])])).boundaries.length, 1);
});

test('holes outside, crossing, overlapping or nested are refused while corner-touching remains compatible', () => {
    for (const holes of [[island], [outer.map(([x, y]) => [x + 0.05, y + 0.05])], [hole, hole],
        [hole, hole.map(([x, y]) => [103.73 + (x - 103.73) / 2, 1.33 + (y - 1.33) / 2])]]) {
        const result = parse(feature([outer, ...holes]));
        assert.equal(result.boundaries.length, 0); assert.equal(result.skipped[0].reason, 'holes');
    }
    const touching = [[103.7, 1.3], [103.72, 1.31], [103.71, 1.32], [103.7, 1.3]];
    assert.equal(parse(feature([outer, touching])).boundaries.length, 1);
});

test('1,000 corners include the holes of each part, with no simplification or incomplete multipart import', () => {
    assert.equal(parse(feature([circle(1000)])).boundaries[0].points.length, 1000);
    const over = parse(feature([circle(1001)]));
    assert.equal(over.boundaries.length, 0); assert.equal(over.skipped[0].reason, 'vertices');
    assert.equal(parse(feature([circle(990), circle(11, 0.001)])).skipped[0].reason, 'vertices');
    const complete = parse(feature([[circle(900)], [circle(900).map(([x, y]) => [x + 0.1, y])]], {}, 'MultiPolygon'));
    assert.equal(complete.boundaries[0].points.length, 1800);
    assert.equal(parse(feature([[outer], [circle(1001)]], {}, 'MultiPolygon')).boundaries.length, 0);
});

test('GeoJSON uses the unchanged combined 20,000 stored-point and 100-annotation limits', () => {
    const parsed = parse(collection(Array.from({ length: 10 }, (_, i) => feature([circle(1000)], { name: `Area ${i}` }))));
    const full = appendKmlBoundaries([], parsed.boundaries);
    assert.equal(full.reduce((sum, item) => sum + item.points.length + item.controlPoints.length, 0), 20000);
    const before = JSON.stringify(full);
    assert.throws(() => appendKmlBoundaries(full, parse(feature()).boundaries), code('budget'));
    assert.equal(JSON.stringify(full), before);
    assert.equal(getKmlImportCapacity(Array.from({ length: 100 }, () => ({ points: [] })), parse(feature()).boundaries), 'count');
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(before)), full);
});

test('labels are plain text and absent names receive a localized fallback; external properties are ignored', () => {
    const result = parse(collection([feature([outer], { ED_DESC: 'Electoral area' }), feature([outer], {}),
        feature([outer], { Name: '<img src=x onerror=alert(1)>', description: '<script>bad</script>', url: 'https://example.invalid' })]));
    assert.equal(result.boundaries[0].name, 'Electoral area');
    assert.equal(result.boundaries[1].name, 'Unnamed boundary 2');
    assert.equal(result.boundaries[2].name, '<img src=x onerror=alert(1)>');
    assert.equal(result.boundaries[2].description, undefined);
    assert.equal(result.boundaries[2].url, undefined);
    assert.equal(parseGeoJsonBoundaries(JSON.stringify(feature([outer], {})), { unnamed: '未命名项目' }).boundaries[0].name, '未命名项目 1');
});

test('all four locales describe GeoJSON support and provide coordinate-system and malformed-JSON errors', () => {
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        const copy = getKmlBoundaryMessages(locale);
        assert.match(copy.intro, /\.geojson/); assert.match(copy.intro, /\.json/);
        assert.match(copy.limits, /GeoJSON/); assert.match(copy.errors.crs, /WGS84/);
        assert.ok(copy.errors.geojson); assert.ok(copy.errors.ring); assert.ok(copy.errors.holes);
    }
});
