import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mapSettingsSource = await readFile(
    new URL('../src/components/MapSettingsControl.jsx', import.meta.url),
    'utf8',
);
const mapStyleSource = await readFile(
    new URL('../src/components/MapStyleControl.jsx', import.meta.url),
    'utf8',
);
const townMapControlSource = await readFile(
    new URL('../src/components/TownMapModeControl.jsx', import.meta.url),
    'utf8',
);
const directoryMapSource = await readFile(
    new URL('../src/components/DirectoryMap.jsx', import.meta.url),
    'utf8',
);
const discoveryMapSource = await readFile(
    new URL('../src/features/discover/DiscoveryMap.jsx', import.meta.url),
    'utf8',
);

test('one shared Map settings trigger opens responsive map appearance controls', () => {
    assert.match(mapSettingsSource, /data-map-settings-control="true"/);
    assert.match(mapSettingsSource, /aria-label="Map settings"/);
    assert.match(mapSettingsSource, /aria-expanded=\{open\}/);
    assert.match(mapSettingsSource, /<MobileBottomSheet/);
    assert.match(mapSettingsSource, /useMediaQuery\('\(min-width: 1024px\)'\)/);
    assert.match(mapSettingsSource, /role="dialog"/);
    assert.match(mapSettingsSource, />Map appearance</);
    assert.match(mapSettingsSource, />\s*Map detail\s*</);
    assert.match(mapSettingsSource, /Detailed turns on automatically when you zoom in to level 15/);
    assert.match(mapSettingsSource, />\s*Map colour\s*</);
    assert.match(mapSettingsSource, /Your colour choice is used on every map/);
    assert.match(mapSettingsSource, /Close map settings/);
});

test('map choices use full-width panel variants without changing their state handlers', () => {
    assert.match(mapStyleSource, /variant === 'panel'/);
    assert.match(mapStyleSource, /inline-flex w-full/);
    assert.match(mapStyleSource, /onClick=\{\(\) => setMapStyle\(CAREAROUND_MAP_STYLE_DEFAULT\)\}/);
    assert.match(mapStyleSource, /onClick=\{\(\) => setMapStyle\(CAREAROUND_MAP_STYLE_GRAY\)\}/);
    assert.match(townMapControlSource, /variant === 'panel'/);
    assert.match(townMapControlSource, /aria-label="Map detail"/);
    assert.match(townMapControlSource, /onClick=\{handleLiveSelect\}/);
    assert.match(townMapControlSource, /onClick=\{handleTownSelect\}/);
    assert.match(townMapControlSource, /aria-live="polite"/);
});

test('Directory Map and Discover share settings placement while preserving map internals', () => {
    assert.match(directoryMapSource, /<MapSettingsControl/);
    assert.match(directoryMapSource, /mapModeControl=\{resolvedMapModeControl\}/);
    assert.match(directoryMapSource, /showMapStyleControl=\{showMapStyleControl\}/);
    assert.match(directoryMapSource, /showRecenterControl \? 'top-\[52px\]/);
    assert.doesNotMatch(directoryMapSource, /left-\[52px\] right-2 top-14/);

    assert.match(discoveryMapSource, /<MapSettingsControl showMapStyleControl \/>/);
    assert.match(discoveryMapSource, /leaflet-top leaflet-left/);
    assert.match(discoveryMapSource, /canResetMap \? 'top-\[52px\]/);
    assert.doesNotMatch(discoveryMapSource, /left-12 right-12 top-2\.5/);

    assert.match(directoryMapSource, /<MapContainer/);
    assert.match(discoveryMapSource, /<MapContainer/);
    assert.doesNotMatch(directoryMapSource, /<MapContainer[^>]*key=/s);
    assert.match(discoveryMapSource, /key=\{`carearound-discover:\$\{mapStyle\}`\}/);
});
