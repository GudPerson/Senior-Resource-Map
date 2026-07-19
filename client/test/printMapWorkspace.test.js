import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    PRINT_MAP_CANVAS_WIDTH_PX,
    PRINT_MAP_DEFAULT_HEIGHT_PX,
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LAYOUT_BALANCED,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_MAX_HEIGHT_PX,
    PRINT_MAP_MIN_HEIGHT_PX,
    PRINT_MAP_SIDE_LEFT,
    PRINT_MAP_SIDE_RIGHT,
    PRINT_MAP_WIDTH_EXTRA_WIDE,
    PRINT_MAP_WIDTH_WIDE,
    buildPrintMapCaptureKey,
    clampPrintMapHeight,
    createOwnerPrintMapState,
    getOwnerPrintLayoutConfig,
    resetOwnerPrintMapState,
} from '../src/lib/printMapState.js';

const printViewSource = readFileSync(new URL('../src/components/DirectoryPrintView.jsx', import.meta.url), 'utf8');
const printLayoutControlsSource = readFileSync(new URL('../src/components/PrintLayoutControls.jsx', import.meta.url), 'utf8');
const exportButtonSource = readFileSync(new URL('../src/components/MapImageExportButton.jsx', import.meta.url), 'utf8');
const exportPanelSource = readFileSync(new URL('../src/components/MapDirectoryExportPanel.jsx', import.meta.url), 'utf8');
const ownerPageSource = readFileSync(new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url), 'utf8');
const directoryMapSource = readFileSync(new URL('../src/components/DirectoryMap.jsx', import.meta.url), 'utf8');
const sharedMapDirectorySource = readFileSync(new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url), 'utf8');

test('owner print map starts from a safe baseline while carrying only the global colour preference', () => {
    assert.deepEqual(createOwnerPrintMapState('gray'), {
        mapStyle: 'gray',
        basemapMode: 'live',
        view: null,
        height: PRINT_MAP_DEFAULT_HEIGHT_PX,
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        labelDetail: PRINT_MAP_LABEL_DETAIL_FULL,
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
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_RIGHT,
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
        labelDetail: PRINT_MAP_LABEL_DETAIL_NAMES,
        resetVersion: 2,
    };
    const reset = resetOwnerPrintMapState(current, 'gray');
    assert.equal(reset.mapStyle, 'gray');
    assert.equal(reset.basemapMode, 'live');
    assert.equal(reset.view, null);
    assert.equal(reset.height, PRINT_MAP_DEFAULT_HEIGHT_PX);
    assert.equal(reset.layoutPreset, PRINT_MAP_LAYOUT_BALANCED);
    assert.equal(reset.mapSide, PRINT_MAP_SIDE_LEFT);
    assert.equal(reset.mapWidth, PRINT_MAP_WIDTH_WIDE);
    assert.equal(reset.labelDetail, PRINT_MAP_LABEL_DETAIL_FULL);
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
        buildPrintMapCaptureKey({ ...baseline, layoutPreset: PRINT_MAP_LAYOUT_FOCUS }),
        buildPrintMapCaptureKey({ ...baseline, mapSide: PRINT_MAP_SIDE_RIGHT }),
        buildPrintMapCaptureKey({ ...baseline, mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE }),
        buildPrintMapCaptureKey({ ...baseline, labelDetail: PRINT_MAP_LABEL_DETAIL_NAMES }),
    ]);
    assert.equal(keys.size, 9);
});

test('print layout presets keep Balanced stable while allowing an explicit wider map', () => {
    assert.deepEqual(getOwnerPrintLayoutConfig({ layoutPreset: PRINT_MAP_LAYOUT_BALANCED }), {
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapSide: 'center',
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        mapMaxWidthPx: 680,
        gridClassName: 'grid-cols-[340px_minmax(0,1fr)_340px]',
    });
    assert.deepEqual(getOwnerPrintLayoutConfig({
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
    }), {
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapSide: 'center',
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
        mapMaxWidthPx: 760,
        gridClassName: 'grid-cols-[300px_minmax(0,1fr)_300px]',
    });
    assert.equal(getOwnerPrintLayoutConfig({
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
    }).mapMaxWidthPx, 940);
    assert.equal(getOwnerPrintLayoutConfig({
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_RIGHT,
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
    }).mapMaxWidthPx, 1020);
});

test('print layout controls use progressive disclosure and layman label-detail choices', () => {
    assert.match(printLayoutControlsSource, /t\('printLayout'\)/);
    assert.match(printLayoutControlsSource, /t\('printLayoutBalanced'\)/);
    assert.match(printLayoutControlsSource, /t\('printLayoutMapFocus'\)/);
    assert.match(printLayoutControlsSource, /t\('printMapPosition'\)/);
    assert.match(printLayoutControlsSource, /t\('printMapWidth'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesOnly'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesLogos'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesAddresses'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelFullDetails'\)/);
    assert.match(printLayoutControlsSource, /layoutPreset === PRINT_MAP_LAYOUT_FOCUS/);
    assert.match(printLayoutControlsSource, /data-print-map-width-controls="true"/);
});

test('print label detail choices retain the numbered map key while controlling address and resource rows', () => {
    assert.match(sharedMapDirectorySource, /showPrintAddress/);
    assert.match(sharedMapDirectorySource, /showPrintResourceRows/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_FULL/);
    assert.match(printViewSource, /cardBadgeMode=\{useV2OwnerPrint \? \(showPrintLogos \? 'logo' : 'none'\) : 'number'\}/);
    assert.match(printViewSource, /showPrintNumberBadges=\{useV2OwnerPrint\}/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_NAMES/);
    assert.match(sharedMapDirectorySource, /useCompactNamesOnlyCard \? 'rounded-xl px-2 py-1\.5'/);
    assert.match(sharedMapDirectorySource, /printNumberBadgePosition="end"/);
    assert.match(sharedMapDirectorySource, /printNumberBadgePosition="start"/);
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
    assert.match(ownerPageSource, /<PrintLayoutControls/);
    assert.match(exportButtonSource, /const exportWidth = PRINT_MAP_CANVAS_WIDTH_PX/);
    assert.match(exportButtonSource, /printMapState=\{printMapState\}/);
    assert.match(exportButtonSource, /printMapCaptureKey/);
    assert.match(exportButtonSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(exportPanelSource, /printMapState=\{printMapState\}/);
    assert.match(exportPanelSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(printViewSource, /captureReadyKey=\{printMapState \? buildPrintMapCaptureKey\(printMapState\) : ''\}/);
    assert.match(printViewSource, /getOwnerPrintLayoutConfig\(printMapState\)/);
    assert.match(printViewSource, /printLabelDetail=\{labelDetail\}/);
    assert.match(printViewSource, /mapMaxWidthPx=\{printLayoutConfig\.mapMaxWidthPx\}/);
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

test('image capture readiness survives harmless map rerenders and cached tile loads', () => {
    assert.match(directoryMapSource, /const capturePinSignature = useMemo/);
    assert.match(directoryMapSource, /load: handleCaptureTilesLoaded/);
    assert.match(directoryMapSource, /mapSettledRef\.current = true;\s+tryNotifyReady\(\);/);
    assert.doesNotMatch(
        directoryMapSource,
        /\[anchorPoint, captureReadyKey[^\]]*\bpins\b[^\]]*\bplaceNumberByKey\b/,
    );
});
