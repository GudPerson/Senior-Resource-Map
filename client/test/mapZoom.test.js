import assert from 'node:assert/strict';
import test from 'node:test';

import {
    HALF_STEP_MAP_ZOOM_DELTA,
    formatMapZoomLevel,
    normalizeMapZoomControlStep,
    resolveFractionalMapZoomLevel,
    resolveResponsiveMapMinimumZoom,
} from '../src/lib/mapZoom.js';

test('map zoom labels expose stable tenths without trailing decimal zeroes', () => {
    assert.equal(resolveFractionalMapZoomLevel(14.499999), 14.5);
    assert.equal(formatMapZoomLevel(14), '14');
    assert.equal(formatMapZoomLevel(14.5), '14.5');
    assert.equal(formatMapZoomLevel(14.56), '14.6');
    assert.equal(formatMapZoomLevel('not-a-zoom'), '—');
});

test('map zoom control steps preserve valid opt-in values and safe defaults', () => {
    assert.equal(HALF_STEP_MAP_ZOOM_DELTA, 0.5);
    assert.equal(normalizeMapZoomControlStep(0.5), 0.5);
    assert.equal(normalizeMapZoomControlStep(undefined), 1);
    assert.equal(normalizeMapZoomControlStep(0), 1);
});

test('responsive minimum zoom fits the Singapore overview and stops at half steps', () => {
    assert.equal(resolveResponsiveMapMinimumZoom({ fitZoom: 12.8 }), 12);
    assert.equal(resolveResponsiveMapMinimumZoom({ fitZoom: 11.9 }), 11.5);
    assert.equal(resolveResponsiveMapMinimumZoom({ fitZoom: 10.4 }), 10);
    assert.equal(resolveResponsiveMapMinimumZoom({ fitZoom: 9.8 }), 10);
    assert.equal(resolveResponsiveMapMinimumZoom({ fitZoom: null }), null);
});
