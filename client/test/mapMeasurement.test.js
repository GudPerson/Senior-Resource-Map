import test from 'node:test';
import assert from 'node:assert/strict';
import { appendMapMeasurementPoint, createMapMeasurement, mapMeasurementGeometry } from '../src/lib/mapMeasurement.js';
import { getAnnotationToolMessages } from '../src/lib/annotationToolMessages.js';
import { distanceMeters } from '../../shared/addressSnapshotSpatial.js';

test('distance and radius measurements use the same geographic scale as saved circles', () => {
    const first = [1.3, 103.8], second = [1.305, 103.8];
    for (const kind of ['distance', 'radius']) {
        const measurement = appendMapMeasurementPoint(appendMapMeasurementPoint(createMapMeasurement(kind), first), second);
        const geometry = mapMeasurementGeometry(measurement);
        assert.equal(geometry.complete, true);
        assert.equal(geometry.meters, distanceMeters(first, second));
        assert.ok(geometry.meters > 550 && geometry.meters < 560);
        assert.equal(Object.hasOwn(measurement, 'id'), false);
        assert.equal(Object.hasOwn(measurement, 'isShared'), false);
    }
});

test('pointer preview does not commit a point or complete the measurement', () => {
    const measurement = appendMapMeasurementPoint(createMapMeasurement('radius'), [1.3, 103.8]);
    const before = structuredClone(measurement);
    const preview = mapMeasurementGeometry(measurement, [1.301, 103.8]);
    assert.equal(preview.complete, false);
    assert.ok(preview.meters > 100);
    assert.deepEqual(measurement, before);
    assert.equal(mapMeasurementGeometry(measurement).meters, null);
});

test('measurement rejects invalid points, copies coordinates and retains a completed result until cleared', () => {
    const initial = createMapMeasurement();
    for (const point of [[NaN, 103.8], [1, 181], ['1.3', 103.8], [1], null]) {
        assert.equal(appendMapMeasurementPoint(initial, point), initial);
    }
    const point = [1.3, 103.8];
    const first = appendMapMeasurementPoint(initial, point);
    point[0] = 9;
    assert.equal(first.points[0][0], 1.3);
    const complete = appendMapMeasurementPoint(first, [1.301, 103.8]);
    assert.equal(appendMapMeasurementPoint(complete, [1.302, 103.8]), complete);
    assert.deepEqual(createMapMeasurement('unknown'), { kind: 'distance', points: [] });
});

test('all supported locales explain saved drawings, temporary measurements and the per-map capacity', () => {
    const keys = Object.keys(getAnnotationToolMessages('en')).sort();
    for (const locale of ['en', 'zh', 'ms', 'ta']) {
        const messages = getAnnotationToolMessages(locale);
        assert.deepEqual(Object.keys(messages).sort(), keys);
        assert.ok(Object.values(messages).every(value => typeof value === 'string' && value.trim()));
        assert.match(messages.capacity, /200/);
    }
    assert.equal(getAnnotationToolMessages('zh-SG'), getAnnotationToolMessages('zh'));
    assert.match(getAnnotationToolMessages('en').temporaryHelp, /Not saved or exported/);
});
