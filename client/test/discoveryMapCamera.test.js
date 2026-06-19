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

test('Discover saved-place fit keeps enough top padding for pin artwork', () => {
    const desktopTopLeft = extractPaddingConstant('DESKTOP_FIT_PADDING_TOP_LEFT');
    const mobileTopLeft = extractPaddingConstant('MOBILE_FIT_PADDING_TOP_LEFT');

    assert.ok(
        desktopTopLeft[1] >= 72,
        `desktop fit top padding should keep tall saved-place pins inside the map, got ${desktopTopLeft[1]}px`,
    );
    assert.ok(
        mobileTopLeft[1] >= 72,
        `mobile fit top padding should keep tall saved-place pins inside the map, got ${mobileTopLeft[1]}px`,
    );
    assert.match(discoveryMapSource, /paddingTopLeft: fitConfig\.paddingTopLeft/);
    assert.match(discoveryMapSource, /map\.flyToBounds\(bounds, \{/);
});
