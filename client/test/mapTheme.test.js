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
    CAREAROUND_DEFAULT_BASEMAP_URL,
    CAREAROUND_MAP_STYLE_DEFAULT,
    CAREAROUND_MAP_STYLE_GRAY,
    getCareAroundBasemapUrl,
    normalizeCareAroundMapStyle,
} from '../src/lib/mapTheme.js';

test('CareAround exposes the native OneMap Gray basemap with block numbers', () => {
    assert.equal(
        CAREAROUND_BASEMAP_URL,
        'https://www.onemap.gov.sg/maps/tiles/Grey_HD/{z}/{x}/{y}.png',
    );
});

test('CareAround exposes the native OneMap Default style', () => {
    assert.equal(
        CAREAROUND_DEFAULT_BASEMAP_URL,
        'https://www.onemap.gov.sg/maps/tiles/Default_HD/{z}/{x}/{y}.png',
    );
});

test('map style selection defaults safely and resolves both native tile styles', () => {
    assert.equal(normalizeCareAroundMapStyle('gray'), CAREAROUND_MAP_STYLE_GRAY);
    assert.equal(normalizeCareAroundMapStyle('default'), CAREAROUND_MAP_STYLE_DEFAULT);
    assert.equal(normalizeCareAroundMapStyle('unknown'), CAREAROUND_MAP_STYLE_DEFAULT);
    assert.equal(getCareAroundBasemapUrl('gray'), CAREAROUND_BASEMAP_URL);
    assert.equal(getCareAroundBasemapUrl('default'), CAREAROUND_DEFAULT_BASEMAP_URL);
});

test('OneMap attribution and zoom constraints stay intact', () => {
    assert.match(CAREAROUND_BASEMAP_ATTRIBUTION, /OneMap/);
    assert.match(CAREAROUND_BASEMAP_LOGO_URL, /onemap_logo\.svg$/);
    assert.equal(CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM, 11);
    assert.equal(CAREAROUND_BASEMAP_MIN_ZOOM, 10);
    assert.equal(CAREAROUND_BASEMAP_NATIVE_ZOOM, 19);
    assert.equal(CAREAROUND_BASEMAP_MAX_ZOOM, 19);
});
