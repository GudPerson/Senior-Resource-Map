import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnnotationLabelZoomScale } from '../src/lib/annotationLabelPresentation.js';
import { getCareAroundMapSeaColor } from '../src/lib/mapTheme.js';

test('stored label hierarchy has its original visual size at reference zoom16', () => {
    assert.equal(getAnnotationLabelZoomScale(16), 1);
    assert.equal(12 * getAnnotationLabelZoomScale(16), 12);
    assert.equal(24 * getAnnotationLabelZoomScale(16), 24);
});

test('labels halve across two zoom-out steps and preserve relative hierarchy', () => {
    assert.equal(getAnnotationLabelZoomScale(14), 0.5);
    assert.equal(getAnnotationLabelZoomScale(12), 0.25);
    assert.equal((24 * getAnnotationLabelZoomScale(13)) / (12 * getAnnotationLabelZoomScale(13)), 2);
});

test('fractional zoom changes label scale continuously', () => {
    assert.ok(getAnnotationLabelZoomScale(13.1) > getAnnotationLabelZoomScale(13));
    assert.ok(getAnnotationLabelZoomScale(13.1) < getAnnotationLabelZoomScale(13.5));
    assert.ok(Math.abs(getAnnotationLabelZoomScale(15) - Math.SQRT1_2) < 1e-12);
});

test('far zoom levels stay bounded instead of creating giant or vanishing labels', () => {
    assert.equal(getAnnotationLabelZoomScale(-1000), 0.25);
    assert.equal(getAnnotationLabelZoomScale(1000), 2);
    assert.equal(getAnnotationLabelZoomScale(18), 2);
});

test('invalid camera values retain the reference presentation', () => {
    for (const value of [undefined, null, NaN, Infinity, -Infinity, '16', {}]) {
        assert.equal(getAnnotationLabelZoomScale(value), 1);
    }
});

test('exposed map water follows the configured basemap theme', () => {
    assert.equal(getCareAroundMapSeaColor('default'), '#6da8e4');
    assert.equal(getCareAroundMapSeaColor('gray'), '#d1d1d1');
    assert.equal(getCareAroundMapSeaColor('unknown'), '#6da8e4');
});
