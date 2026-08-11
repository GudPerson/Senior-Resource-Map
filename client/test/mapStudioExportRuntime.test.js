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
const mapStudioStateSource = readFileSync(
    new URL('../src/lib/mapStudioState.js', import.meta.url),
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
    assert.match(ownerPageSource, /mapStudioDesignLocked=\{Boolean\(activePrintStudioView\)\}/);
});

test('Map Studio Export receives the current route camera without persisting exploration state', () => {
    assert.match(ownerPageSource, /resolveMapStudioRouteViewport/);
    assert.match(ownerPageSource, /runtimeCameraView/);
    assert.match(ownerPageSource, /cameraView: runtimeCameraView/);
    assert.match(ownerPageSource, /heightPx: routeViewport\.heightPx/);
    assert.match(mapStudioStateSource, /const runtimeCameraView = normalizeCameraView\(runtime\?\.cameraView\)/);
    assert.match(mapStudioStateSource, /const runtimeHeight = Number\(runtime\?\.heightPx\)/);
    assert.doesNotMatch(mapStudioStateSource, /design\.camera\.view\s*=/);
});

test('Map Studio Export filters cards and pins from one directory and applies deterministic margins', () => {
    assert.match(printViewSource, /buildMapStudioResourceLayerCatalog\(unfilteredBasePresentation\)/);
    assert.match(printViewSource, /filterMapStudioDirectoryByLayers/);
    assert.match(printViewSource, /data-print-margins=\{margins\}/);
    assert.match(printViewSource, /printPagePaddingClassName/);
    assert.match(printViewSource, /printMapInteractive = variant === 'screen'[\s\S]*&& \(!mapStudioDesignLocked \|\| mapStudioViewportEditable\)/);
    assert.match(ownerPageSource, /mapStudioViewportEditable=\{Boolean\(activePrintStudioView\)\}/);
    assert.match(ownerPageSource, /data-map-studio-export-viewport-help="true"/);
    assert.match(printViewSource, /onMapViewStateChange=\{printMapState && interactive \? handleControlledMapViewChange : null\}/);
    assert.match(printViewSource, /showMapStyleControl=\{interactive && !designLocked\}/);
    assert.match(printViewSource, /onMapStyleOverrideChange=\{printMapState && interactive && !designLocked/);
    assert.match(printViewSource, /printMapState\?\.studioMarkerMode \|\| \(useV2Format \? 'print-badge' : 'number'\)/);
    assert.match(printViewSource, /usesOwnerPrintBadgePins/);
    assert.match(printViewSource, /studioMarkerMode === 'print-badge'/);
    assert.match(printViewSource, /markerScale=\{getPrintMapPinScale\(printMapState\?\.pinSize\)\}/);
});

test('Map Studio Export fixes high-resolution quality and wide margins without mounting duplicate layout controls', () => {
    assert.match(mapStudioStateSource, /imageQuality: normalizePrintMapQuality\(value\?\.imageQuality \?\? PRINT_MAP_QUALITY_HIGH\)/);
    assert.match(mapStudioStateSource, /value\?\.margins \?\? MAP_STUDIO_EXPORT_MARGIN_WIDE/);
    assert.doesNotMatch(ownerPageSource, /PrintLayoutControls/);
    assert.doesNotMatch(ownerPageSource, /data-print-layout-trigger/);
    assert.doesNotMatch(ownerPageSource, /Reset print map/);
});

test('private Map Studio documents remain absent from frozen Shared Map and embed routes', () => {
    assert.doesNotMatch(sharedMapSource, /MapStudio|mapStudio/);
    assert.doesNotMatch(embeddedMapSource, /MapStudio|mapStudio/);
    assert.match(embeddedMapSource, /embeddedPresentation/);
});
