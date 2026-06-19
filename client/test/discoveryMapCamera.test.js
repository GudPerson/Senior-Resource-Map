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

    assert.deepEqual(desktopTopLeft, [44, 60]);
    assert.deepEqual(mobileTopLeft, [24, 60]);
    assert.match(discoveryMapSource, /paddingTopLeft: fitConfig\.paddingTopLeft/);
    assert.match(discoveryMapSource, /map\.flyToBounds\(bounds, \{/);
});

test('Discover saved-place fit uses fractional zoom steps to avoid padding threshold jumps', () => {
    assert.match(discoveryMapSource, /const DISCOVER_ZOOM_SNAP = 0\.1;/);
    assert.match(discoveryMapSource, /zoomSnap=\{DISCOVER_ZOOM_SNAP\}/);
});
