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
const globalStylesSource = await readFile(
    new URL('../src/index.css', import.meta.url),
    'utf8',
);
const mobilePrintControlsSource = await readFile(
    new URL('../src/components/DirectoryMapMobileControlDock.jsx', import.meta.url),
    'utf8',
);
const printViewSource = await readFile(
    new URL('../src/components/DirectoryPrintView.jsx', import.meta.url),
    'utf8',
);

test('one shared Map settings trigger opens responsive map appearance controls', () => {
    assert.match(mapSettingsSource, /data-map-settings-control="true"/);
    assert.match(mapSettingsSource, /aria-label="Map settings"/);
    assert.match(mapSettingsSource, /aria-expanded=\{open\}/);
    assert.match(mapSettingsSource, /h-\[30px\] w-\[30px\] min-w-\[30px\] touch-manipulation/);
    assert.doesNotMatch(mapSettingsSource, /<span>Map<\/span>/);
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
    assert.match(mapStyleSource, /const handleChange = onChange \|\| setMapStyle/);
    assert.match(mapStyleSource, /onClick=\{\(\) => handleChange\(CAREAROUND_MAP_STYLE_DEFAULT\)\}/);
    assert.match(mapStyleSource, /onClick=\{\(\) => handleChange\(CAREAROUND_MAP_STYLE_GRAY\)\}/);
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
    assert.match(directoryMapSource, /carearound-map-control-rail--\$\{mapControlRailDepth\}/);
    assert.match(directoryMapSource, /hasMapSettingsControl=\{hasMapSettingsControl\}/);
    assert.match(directoryMapSource, /carearound-map-recenter-control--with-settings/);
    assert.match(directoryMapSource, /totalPointCount <= 1/);
    assert.match(directoryMapSource, /displayPins\.length \+ \(anchorPoint \? 1 : 0\)\) > 1/);
    assert.doesNotMatch(directoryMapSource, /left-\[52px\] right-2 top-14/);

    assert.match(discoveryMapSource, /<MapSettingsControl showMapStyleControl \/>/);
    assert.match(discoveryMapSource, /data-map-zoom-level="true"/);
    assert.match(discoveryMapSource, /carearound-discovery-zoom-control--\$\{desktopZoomRailDepth\}/);
    assert.match(discoveryMapSource, /carearound-discovery-recenter-control/);
    assert.doesNotMatch(discoveryMapSource, /left-12 right-12 top-2\.5/);

    assert.match(globalStylesSource, /\.carearound-map-recenter-control--with-settings/);
    assert.match(globalStylesSource, /\.carearound-discovery-zoom-control--two/);
    assert.match(globalStylesSource, /height: 30px !important/);
    assert.match(globalStylesSource, /top: 50px !important/);
    assert.match(globalStylesSource, /right: 12px !important/);
    assert.match(globalStylesSource, /top: 88px !important/);
    assert.match(globalStylesSource, /\.carearound-map-control-rail \.leaflet-top\.leaflet-left[\s\S]*left: auto;[\s\S]*right: 0;/);

    assert.match(directoryMapSource, /<MapContainer/);
    assert.match(discoveryMapSource, /<MapContainer/);
    assert.doesNotMatch(directoryMapSource, /<MapContainer[^>]*key=/s);
    assert.match(discoveryMapSource, /key=\{`carearound-discover:\$\{mapStyle\}`\}/);
});

test('mobile owner Print View uses an unscaled accessible map-control dock', () => {
    assert.match(printViewSource, /data-print-mobile-map-control-target="true"/);
    assert.match(printViewSource, /mobileControlPortalTarget=\{useV2OwnerPrint && variant === 'screen'/);
    assert.match(directoryMapSource, /data-external-mobile-map-controls=\{mobileControlPortalTarget \? 'true' : undefined\}/);
    assert.match(directoryMapSource, /<DirectoryMapMobileControlDock/);
    assert.match(mobilePrintControlsSource, /createPortal/);
    assert.match(mobilePrintControlsSource, /data-print-mobile-map-controls="true"/);
    assert.match(mobilePrintControlsSource, /aria-label="Print map controls"/);
    assert.match(mobilePrintControlsSource, /aria-label="Zoom out"/);
    assert.match(mobilePrintControlsSource, /aria-label="Zoom in"/);
    assert.match(mobilePrintControlsSource, /h-12 w-12/);
    assert.match(mobilePrintControlsSource, /text-base font-black tabular-nums/);
    assert.match(mapSettingsSource, /triggerSize = 'compact'/);
    assert.match(mapSettingsSource, /triggerSize === 'touch'/);
    assert.match(globalStylesSource, /\[data-external-mobile-map-controls="true"\] \.leaflet-control-zoom/);
});
