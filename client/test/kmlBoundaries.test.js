import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKmlColor, parseKmlRing, appendKmlBoundaries, getKmlImportCapacity, buildKmlBoundaryPreview } from '../src/lib/kmlBoundaries.js';
import { normalizePrintAnnotation, normalizePrintAnnotations, duplicatePrintAnnotation, buildPrintAnnotationPolygonPoints, buildRoundedPrintAnnotationPolygon } from '../src/lib/printAnnotations.js';
import { getKmlBoundaryMessages } from '../src/lib/kmlBoundaryMessages.js';
const ring = '103.7,1.3,0 103.8,1.3,0 103.8,1.4,0 103.7,1.4,0 103.7,1.3,0';
const points = parseKmlRing(ring);
const area = { name: 'Test boundary', points, style: { color: '#F97316', fillColor: '#FFD600', fillOpacity: 0.52, strokeOpacity: 0.6, weight: 0.001 } };
const code = expected => error => error.code === expected;

test('KML colour uses AABBGGRR and retains independent alpha', () => {
    assert.deepEqual(parseKmlColor('85aabbcc'), { color: '#CCBBAA', opacity: 133 / 255 });
    assert.throws(() => parseKmlColor('#aabbcc'), code('style'));
});
test('KML longitude/latitude converts exactly and removes only the closing duplicate', () => {
    assert.deepEqual(points, [[1.3, 103.7], [1.3, 103.8], [1.4, 103.8], [1.4, 103.7]]);
    assert.deepEqual(parseKmlRing(ring.replaceAll(',0', '')), points);
    assert.deepEqual(parseKmlRing('1e2,1e0 1.01e2,1 101,2 100,2 1e2,1e0'), [[1, 100], [1, 101], [2, 101], [2, 100]]);
});
test('invalid, open, duplicate, crossing, zero-area and altitude rings are refused', () => {
    for (const input of ['103,1 104,1 104,2', '103,1 104,1 103,1 104,2 103,1',
        '103,1 104,2 103,2 104,1 103,1', '103,1 104,1 105,1 103,1']) assert.throws(() => parseKmlRing(input), code('ring'));
    for (const input of ['103,91 104,1 104,2 103,91', 'NaN,1 104,1 104,2 NaN,1', '181,1 104,1 104,2 181,1',
        '179,1 -179,1 -179,2 179,2 179,1', '103,1, 104,1 104,2 103,1,']) assert.throws(() => parseKmlRing(input), code('coordinates'));
    assert.throws(() => parseKmlRing(ring.replace(',0', ',10')), code('altitude'));
});
test('dense boundaries fail before normalization can truncate any corner', () => {
    const huge = Array.from({ length: 201 }, (_, i) => [1.3 + i / 1000, 103.7]);
    assert.throws(() => appendKmlBoundaries([], [{ ...area, points: huge }]), code('vertices'));
    assert.throws(() => parseKmlRing([...huge, huge[0]].map(([lat, lng]) => `${lng},${lat}`).join(' ')), code('vertices'));
});
test('import batch retains exact geometry, source appearance and private metadata through reload and duplicate', () => {
    const batch = appendKmlBoundaries([], [area, { ...area, name: 'Second', style: { ...area.style, fillOpacity: 1, weight: 1.2 } }]);
    assert.equal(batch.length, 2); assert.notEqual(batch[0].id, batch[1].id);
    assert.deepEqual(batch[0].points, points); assert.deepEqual(batch[0].controlPoints, points);
    assert.equal(batch[0].style.weight, 0.001); assert.equal(batch[0].style.strokeOpacity, 0.6);
    assert.equal(batch[1].style.fillOpacity, 1); assert.equal(batch[1].style.weight, 1.2);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(batch))), batch);
    const sharedAttempt = normalizePrintAnnotation({ ...batch[0], isShared: true });
    assert.equal(sharedAttempt.isShared, false);
    const duplicate = duplicatePrintAnnotation(batch[0], { offset: [0, 0] });
    assert.equal(duplicate.boundarySource, 'kml'); assert.deepEqual(duplicate.points, points); assert.deepEqual(duplicate.style, batch[0].style);
});
test('exact display and transform previews bypass rounding while hand-drawn polygons stay rounded', () => {
    const imported = appendKmlBoundaries([], [area])[0];
    assert.deepEqual(buildPrintAnnotationPolygonPoints(imported), points);
    const moved = points.map(([lat, lng]) => [lat + 0.01, lng + 0.01]);
    assert.deepEqual(buildPrintAnnotationPolygonPoints(imported, moved), moved);
    const drawing = normalizePrintAnnotation({ ...imported, boundarySource: undefined, isShared: true });
    assert.equal(drawing.isShared, true); assert.equal(drawing.style.weight, 1); assert.equal(drawing.style.strokeOpacity, undefined);
    assert.deepEqual(buildPrintAnnotationPolygonPoints(drawing), buildRoundedPrintAnnotationPolygon(points));
    assert.notDeepEqual(buildPrintAnnotationPolygonPoints(drawing), points);
});
test('count and combined corner budgets reject the entire import without changing existing document', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({ id: `a_${i}`, points: [[1, 103]] }));
    const before = JSON.stringify(existing);
    assert.equal(getKmlImportCapacity(existing, [area]), 'count');
    assert.throws(() => appendKmlBoundaries(existing, [area]), code('count'));
    assert.equal(JSON.stringify(existing), before);
    const dense = [{ points: Array(19998).fill([1, 103]) }];
    assert.throws(() => appendKmlBoundaries(dense, [area]), code('budget'));
    assert.equal(getKmlImportCapacity([], []), 'selection');
    assert.equal(getKmlImportCapacity([{ points: Array(19992).fill([1, 103]) }], [area]), null);
});
test('50 detailed boundaries retain all 20,000 stored points through import and reload; overflow is atomic', () => {
    const corners = Array.from({ length: 200 }, (_, index) => {
        const angle = index * Math.PI * 2 / 200;
        return [1.3 + Math.sin(angle) * 0.001, 103.7 + Math.cos(angle) * 0.001];
    });
    const boundaries = Array.from({ length: 50 }, (_, index) => ({ ...area, name: `Detailed area ${index}`, points: corners }));
    const imported = appendKmlBoundaries([], boundaries);
    assert.equal(imported.reduce((sum, item) => sum + item.points.length + item.controlPoints.length, 0), 20000);
    assert.deepEqual(normalizePrintAnnotations(JSON.parse(JSON.stringify(imported))), imported);
    for (const item of imported) {
        assert.deepEqual(item.points, corners);
        assert.deepEqual(item.controlPoints, corners);
        assert.equal(item.isShared, false);
    }
    const before = JSON.stringify(imported);
    assert.equal(getKmlImportCapacity(imported, [area]), 'budget');
    assert.throws(() => appendKmlBoundaries(imported, [area]), code('budget'));
    assert.equal(JSON.stringify(imported), before);
});
test('preview preserves corner count and geographic proportions without mutating source coordinates', () => {
    const before = JSON.stringify(area);
    const preview = buildKmlBoundaryPreview([area])[0];
    assert.equal(preview.svgPoints.split(' ').length, 4);
    assert.equal(JSON.stringify(area), before); assert.deepEqual(buildKmlBoundaryPreview([]), []);
});
test('all import controls and actionable refusal reasons have four locale translations', () => {
    const en = getKmlBoundaryMessages('en');
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        const m = getKmlBoundaryMessages(locale);
        assert.deepEqual(Object.keys(m).sort(), Object.keys(en).sort());
        assert.deepEqual(Object.keys(m.errors).sort(), Object.keys(en.errors).sort());
        for (const value of [...Object.values(m).filter(v => typeof v === 'string'), ...Object.values(m.errors)]) assert.ok(value.length > 0);
        if (locale !== 'en') assert.notEqual(m.import, en.import);
    }
});
