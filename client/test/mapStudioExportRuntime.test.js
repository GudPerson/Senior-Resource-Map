import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ownerPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const printViewSource = readFileSync(
    new URL('../src/components/DirectoryPrintView.jsx', import.meta.url),
    'utf8',
);
const printControlsSource = readFileSync(
    new URL('../src/components/PrintLayoutControls.jsx', import.meta.url),
    'utf8',
);
const sharedMapSource = readFileSync(
    new URL('../src/pages/SharedMapPage.jsx', import.meta.url),
    'utf8',
);
const embeddedMapSource = readFileSync(
    new URL('../src/pages/EmbeddedMapPage.jsx', import.meta.url),
    'utf8',
);

test('Map Studio Export snapshots the active draft and restores saved named views on reload', () => {
    assert.match(ownerPageSource, /buildMapStudioPrintState/);
    assert.match(ownerPageSource, /createMapStudioExportSettings/);
    assert.match(ownerPageSource, /pendingPrintStudioViewRef/);
    assert.match(ownerPageSource, /nextParams\.set\('studioView', studioSnapshot\.id\)/);
    assert.match(ownerPageSource, /api\.getMyMapStudio\(mapId\)/);
    assert.match(ownerPageSource, /document\?\.views\?\.find\(\(view\) => view\.id === printStudioViewId\)/);
    assert.match(ownerPageSource, /mapStudioExport=\{Boolean\(activePrintStudioView\)\}/);
    assert.match(ownerPageSource, /mapStudioDesignLocked=\{Boolean\(activePrintStudioView\)\}/);
});

test('Map Studio Export filters cards and pins from one directory and applies deterministic margins', () => {
    assert.match(printViewSource, /buildMapStudioResourceLayerCatalog\(unfilteredBasePresentation\)/);
    assert.match(printViewSource, /filterMapStudioDirectoryByLayers/);
    assert.match(printViewSource, /data-print-margins=\{margins\}/);
    assert.match(printViewSource, /printPagePaddingClassName/);
    assert.match(printViewSource, /printMapInteractive = variant === 'screen' && !mapStudioDesignLocked/);
    assert.match(printViewSource, /showMapStyleControl=\{interactive && !designLocked\}/);
    assert.match(printViewSource, /printMapState\?\.studioMarkerMode \|\| \(useV2Format \? 'print-badge' : 'number'\)/);
    assert.match(printViewSource, /markerScale=\{getPrintMapPinScale\(printMapState\?\.pinSize\)\}/);
});

test('Map Studio Export exposes export-only quality and margin controls without changing legacy Print View defaults', () => {
    assert.match(printControlsSource, /mapStudioExport = false/);
    assert.match(printControlsSource, /data-map-studio-export-settings="true"/);
    assert.match(printControlsSource, /data-print-image-quality-controls="true"/);
    assert.match(printControlsSource, /data-print-margin-controls="true"/);
    assert.match(printControlsSource, /\{!mapStudioExport \? \(/);
});

test('Map Studio view state remains absent from frozen Shared Map and embed routes', () => {
    assert.doesNotMatch(sharedMapSource, /MapStudio|mapStudio/);
    assert.doesNotMatch(embeddedMapSource, /MapStudio|mapStudio/);
});
