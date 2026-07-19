import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    PRINT_MAP_CANVAS_WIDTH_PX,
    PRINT_MAP_DEFAULT_HEIGHT_PX,
    PRINT_MAP_MAX_HEIGHT_PX,
    PRINT_MAP_MIN_HEIGHT_PX,
    buildPrintMapCaptureKey,
    clampPrintMapHeight,
    createOwnerPrintMapState,
    resetOwnerPrintMapState,
} from '../src/lib/printMapState.js';

const printViewSource = readFileSync(new URL('../src/components/DirectoryPrintView.jsx', import.meta.url), 'utf8');
const exportButtonSource = readFileSync(new URL('../src/components/MapImageExportButton.jsx', import.meta.url), 'utf8');
const exportPanelSource = readFileSync(new URL('../src/components/MapDirectoryExportPanel.jsx', import.meta.url), 'utf8');
const ownerPageSource = readFileSync(new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url), 'utf8');
const directoryMapSource = readFileSync(new URL('../src/components/DirectoryMap.jsx', import.meta.url), 'utf8');

test('owner print map starts from a safe baseline while carrying only the global colour preference', () => {
    assert.deepEqual(createOwnerPrintMapState('gray'), {
        mapStyle: 'gray',
        basemapMode: 'live',
        view: null,
        height: PRINT_MAP_DEFAULT_HEIGHT_PX,
        resetVersion: 0,
    });
    assert.equal(clampPrintMapHeight(100), PRINT_MAP_MIN_HEIGHT_PX);
    assert.equal(clampPrintMapHeight(900), PRINT_MAP_MAX_HEIGHT_PX);
    assert.equal(PRINT_MAP_CANVAS_WIDTH_PX, 1480);
});

test('owner print reset clears camera and detail changes without losing the device colour preference', () => {
    const current = {
        mapStyle: 'default',
        basemapMode: 'auto',
        view: { center: [1.38, 103.75], zoom: 16 },
        height: 640,
        resetVersion: 2,
    };
    const reset = resetOwnerPrintMapState(current, 'gray');
    assert.equal(reset.mapStyle, 'gray');
    assert.equal(reset.basemapMode, 'live');
    assert.equal(reset.view, null);
    assert.equal(reset.height, PRINT_MAP_DEFAULT_HEIGHT_PX);
    assert.equal(reset.resetVersion, 3);
});

test('capture key changes for every visual print map setting', () => {
    const baseline = createOwnerPrintMapState('default');
    const keys = new Set([
        buildPrintMapCaptureKey(baseline),
        buildPrintMapCaptureKey({ ...baseline, mapStyle: 'gray' }),
        buildPrintMapCaptureKey({ ...baseline, basemapMode: 'auto' }),
        buildPrintMapCaptureKey({ ...baseline, height: 480 }),
        buildPrintMapCaptureKey({ ...baseline, view: { center: [1.38, 103.75], zoom: 16 } }),
    ]);
    assert.equal(keys.size, 5);
});

test('owner print preview exposes controlled zoom, detail, colour, camera, and height controls', () => {
    assert.match(printViewSource, /data-print-map-resize-handle="true"/);
    assert.match(printViewSource, /role="separator"/);
    assert.match(printViewSource, /showZoomControl=\{Boolean\(printMapState && interactive\)\}/);
    assert.match(printViewSource, /showZoomLevelCounter=\{Boolean\(printMapState && interactive\)\}/);
    assert.match(printViewSource, /mapStyleOverride=\{printMapState\?\.mapStyle \|\| null\}/);
    assert.match(printViewSource, /mapViewState=\{printMapState\?\.view \|\| null\}/);
    assert.match(printViewSource, /basemapMode=\{printMapState\?\.basemapMode \|\| 'live'\}/);
    assert.match(printViewSource, /fixedTownSurfaceManifest=\{fixedTownSurfaceManifest\}/);
    assert.match(printViewSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(printViewSource, /onFixedTownSurfaceViewportChange=\{onFixedTownSurfaceViewportChange\}/);
    assert.match(printViewSource, /mapHeightPx=\{printMapState \? clampPrintMapHeight\(printMapState\.height\) : null\}/);
});

test('visible preview and hidden image export consume the same frozen print map state and width', () => {
    assert.match(ownerPageSource, /printMapState=\{printMapState\}/g);
    assert.match(exportButtonSource, /const exportWidth = PRINT_MAP_CANVAS_WIDTH_PX/);
    assert.match(exportButtonSource, /printMapState=\{printMapState\}/);
    assert.match(exportButtonSource, /printMapCaptureKey/);
    assert.match(exportButtonSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(exportPanelSource, /printMapState=\{printMapState\}/);
    assert.match(exportPanelSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(printViewSource, /captureReadyKey=\{printMapState \? buildPrintMapCaptureKey\(printMapState\) : ''\}/);
    assert.match(ownerPageSource, /data-print-toolbar-actions="true"/);
    assert.match(ownerPageSource, /Your saved image will match this preview/);
    assert.doesNotMatch(ownerPageSource, /onClick=\{\(\) => window\.print\(\)\}/);
    assert.match(directoryMapSource, /right-\[13px\] top-3 z-\[1002\] lg:right-3/);
    assert.match(ownerPageSource, /printTownMapSurfaceResolving/);
    assert.match(ownerPageSource, /printTownMapSurfacePending/);
    assert.match(ownerPageSource, /fixedTownSurfacePending=\{printTownMapSurfacePending\}/);
    assert.match(ownerPageSource, /onFixedTownSurfaceViewportChange=\{setTownMapViewportBounds\}/);
});

test('DirectoryMap controlled print hooks stay optional for Shared Maps and existing callers', () => {
    assert.match(directoryMapSource, /mapStyleOverride = null/);
    assert.match(directoryMapSource, /mapHeightPx = null/);
    assert.match(directoryMapSource, /mapViewState = null/);
    assert.match(directoryMapSource, /captureReadyKey = ''/);
    assert.match(printViewSource, /printMapState = null/);
    assert.match(printViewSource, /printMapState=\{useV2OwnerPrint \? printMapState : null\}/);
});
