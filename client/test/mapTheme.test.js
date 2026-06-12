import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CAREAROUND_BASEMAP_ATTRIBUTION,
    CAREAROUND_BASEMAP_LOGO_URL,
    CAREAROUND_BASEMAP_MAX_ZOOM,
    CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_MIN_ZOOM,
    CAREAROUND_BASEMAP_NATIVE_ZOOM,
    CAREAROUND_BASEMAP_URL,
} from '../src/lib/mapTheme.js';

test('CareAround maps use the cleaner OneMap Grey basemap with block numbers', () => {
    assert.equal(
        CAREAROUND_BASEMAP_URL,
        'https://www.onemap.gov.sg/maps/tiles/Grey_HD/{z}/{x}/{y}.png',
    );
});

test('OneMap attribution and zoom constraints stay intact', () => {
    assert.match(CAREAROUND_BASEMAP_ATTRIBUTION, /OneMap/);
    assert.match(CAREAROUND_BASEMAP_LOGO_URL, /onemap_logo\.svg$/);
    assert.equal(CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM, 11);
    assert.equal(CAREAROUND_BASEMAP_MIN_ZOOM, 10);
    assert.equal(CAREAROUND_BASEMAP_NATIVE_ZOOM, 19);
    assert.equal(CAREAROUND_BASEMAP_MAX_ZOOM, 19);
});
