import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const discoveryMapSource = readFileSync(
    new URL('../src/features/discover/DiscoveryMap.jsx', import.meta.url),
    'utf8',
);

function extractPaddingConstant(name) {
    const match = discoveryMapSource.match(new RegExp(`const ${name} = \\[(\\d+), (\\d+)\\]`));
    assert.ok(match, `${name} should be declared as a numeric padding tuple`);
    return [Number(match[1]), Number(match[2])];
}

test('Discover saved-place fit keeps the balanced UAT top padding for pin artwork', () => {
    const desktopTopLeft = extractPaddingConstant('DESKTOP_FIT_PADDING_TOP_LEFT');
    const mobileTopLeft = extractPaddingConstant('MOBILE_FIT_PADDING_TOP_LEFT');
    const mobileBottomRight = extractPaddingConstant('MOBILE_FIT_PADDING_BOTTOM_RIGHT');

    assert.deepEqual(desktopTopLeft, [44, 60]);
    assert.deepEqual(mobileTopLeft, [60, 60]);
    assert.deepEqual(mobileBottomRight, [112, 72]);
    assert.match(discoveryMapSource, /paddingTopLeft: fitConfig\.paddingTopLeft/);
    assert.match(discoveryMapSource, /paddingBottomRight: fitConfig\.paddingBottomRight/);
    assert.match(discoveryMapSource, /map\.flyToBounds\(bounds, \{/);
});

test('Discover saved-place fit uses fractional zoom steps to avoid padding threshold jumps', () => {
    assert.match(discoveryMapSource, /Whole-step zoom snapping caused UAT-visible jumps/);
    assert.match(discoveryMapSource, /const DISCOVER_ZOOM_SNAP = 0\.1;/);
    assert.match(discoveryMapSource, /zoomSnap=\{DISCOVER_ZOOM_SNAP\}/);
    assert.match(discoveryMapSource, /maxZoom: fitConfig\.maxZoom/);
    assert.doesNotMatch(discoveryMapSource, /zoomSnap=\{?1\}?/);
});

test('Discover locks wide maps at 11.5 to give the Singapore overview breathing room', () => {
    assert.match(discoveryMapSource, /function DiscoveryMinimumZoomLock/);
    assert.match(discoveryMapSource, /DISCOVER_OVERVIEW_WIDE_MAP_WIDTH = 900/);
    assert.match(discoveryMapSource, /DISCOVER_OVERVIEW_MAX_ZOOM = 11\.5/);
    assert.match(discoveryMapSource, /DISCOVER_SINGAPORE_OVERVIEW_CENTER = \[1\.3521, 103\.846\]/);
    assert.match(discoveryMapSource, /DISCOVER_BASEMAP_VISIBLE_NORTH_EDGE = \[1\.4939713066293197, 103\.846\]/);
    assert.match(discoveryMapSource, /resolveTopAlignedMapCenterPoint/);
    assert.match(discoveryMapSource, /L\.latLng\(DISCOVER_BASEMAP_VISIBLE_NORTH_EDGE\)/);
    assert.match(discoveryMapSource, /map\.unproject/);
    assert.match(discoveryMapSource, /resolveResponsiveMapMinimumZoom/);
    assert.match(discoveryMapSource, /map\.setMinZoom\(minimumZoom\)/);
    assert.match(discoveryMapSource, /map\.dragging\.disable\(\)/);
    assert.match(discoveryMapSource, /dataset\.discoverMinZoom/);
    assert.match(discoveryMapSource, /zoomDelta=\{HALF_STEP_MAP_ZOOM_DELTA\}/);
    assert.match(discoveryMapSource, /map\.zoomIn\(HALF_STEP_MAP_ZOOM_DELTA\)/);
    assert.match(discoveryMapSource, /map\.zoomOut\(HALF_STEP_MAP_ZOOM_DELTA\)/);
    assert.match(discoveryMapSource, /formatMapZoomLevel/);
});

test('Discover removes fractional tablet top gaps and paints uncovered canvas like the sea', () => {
    assert.match(discoveryMapSource, /centerMinimumCamera\(\{ onlyRemoveTopGap: true \}\)/);
    assert.match(discoveryMapSource, /Number\(map\.getZoom\(\)\) < DEFAULT_MAP_ZOOM/);
    assert.match(discoveryMapSource, /minimumPoint\.x = currentPoint\.x/);
    assert.match(discoveryMapSource, /DISCOVER_DEFAULT_SEA_BACKGROUND = '#6da8e4'/);
    assert.match(discoveryMapSource, /DISCOVER_GRAY_SEA_BACKGROUND = '#cfd5dc'/);
    assert.match(discoveryMapSource, /backgroundColor: mapCanvasBackground/);
});
