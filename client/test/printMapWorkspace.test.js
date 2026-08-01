import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    PRINT_MAP_CANVAS_WIDTH_PX,
    PRINT_MAP_DEFAULT_HEIGHT_PX,
    PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX,
    PRINT_MAP_FULL_PAGE_MAX_HEIGHT_PX,
    PRINT_MAP_FULL_PAGE_MIN_HEIGHT_PX,
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    PRINT_MAP_LAYOUT_BALANCED,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_LAYOUT_FULL,
    PRINT_MAP_MAX_HEIGHT_PX,
    PRINT_MAP_MIN_HEIGHT_PX,
    PRINT_MAP_PAGE_LAYOUT_FULL,
    PRINT_MAP_PAGE_LAYOUT_STANDARD,
    PRINT_MAP_QUALITY_HIGH,
    PRINT_MAP_QUALITY_STANDARD,
    PRINT_MAP_ANNOTATION_LAYER_SHOW,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
    PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT,
    PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT,
    PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
    PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
    PRINT_MAP_SIDE_LEFT,
    PRINT_MAP_SIDE_RIGHT,
    PRINT_MAP_WIDTH_EXTRA_WIDE,
    PRINT_MAP_WIDTH_WIDE,
    buildPrintMapCaptureKey,
    clampPrintMapHeight,
    createOwnerPrintMapState,
    getPrintMapExportConfig,
    getOwnerPrintLayoutConfig,
    getPrintMapPreviewScale,
    normalizePrintMapLabelDetail,
    normalizePrintMapResourceColumnCount,
    normalizePrintMapSideResourceColumnCount,
    resetOwnerPrintMapState,
    shouldExportPrintMapAsSeparatePages,
    splitPrintResourceGroups,
    splitPrintSideResourceGroups,
} from '../src/lib/printMapState.js';

const printViewSource = readFileSync(new URL('../src/components/DirectoryPrintView.jsx', import.meta.url), 'utf8');
const printLayoutControlsSource = readFileSync(new URL('../src/components/PrintLayoutControls.jsx', import.meta.url), 'utf8');
const exportButtonSource = readFileSync(new URL('../src/components/MapImageExportButton.jsx', import.meta.url), 'utf8');
const exportPanelSource = readFileSync(new URL('../src/components/MapDirectoryExportPanel.jsx', import.meta.url), 'utf8');
const ownerPageSource = readFileSync(new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url), 'utf8');
const directoryMapSource = readFileSync(new URL('../src/components/DirectoryMap.jsx', import.meta.url), 'utf8');
const sharedMapDirectorySource = readFileSync(new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.js', import.meta.url), 'utf8');
const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('owner print map starts from a safe baseline while carrying only the global colour preference', () => {
    assert.deepEqual(createOwnerPrintMapState('gray'), {
        mapStyle: 'gray',
        basemapMode: 'live',
        view: null,
        height: PRINT_MAP_DEFAULT_HEIGHT_PX,
        pageLayout: PRINT_MAP_PAGE_LAYOUT_STANDARD,
        resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
        mapQuality: PRINT_MAP_QUALITY_STANDARD,
        resourceLayer: PRINT_MAP_RESOURCE_LAYER_SHOW,
        annotationLayer: PRINT_MAP_ANNOTATION_LAYER_SHOW,
        hiddenResourceLayerKeys: [],
        hiddenAnnotationIds: [],
        layoutPreset: PRINT_MAP_LAYOUT_BALANCED,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        labelDetail: PRINT_MAP_LABEL_DETAIL_FULL,
        resourceColumnCount: PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT,
        sideResourceColumnCount: PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT,
        resetVersion: 0,
    });
    assert.equal(clampPrintMapHeight(100), PRINT_MAP_MIN_HEIGHT_PX);
    assert.equal(clampPrintMapHeight(900), PRINT_MAP_MAX_HEIGHT_PX);
    assert.equal(
        clampPrintMapHeight(100, { pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL }),
        PRINT_MAP_FULL_PAGE_MIN_HEIGHT_PX,
    );
    assert.equal(
        clampPrintMapHeight(2000, { pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL }),
        PRINT_MAP_FULL_PAGE_MAX_HEIGHT_PX,
    );
    assert.equal(PRINT_MAP_CANVAS_WIDTH_PX, 1480);
});

test('owner print map can request Detailed automatically without changing the safe helper default', () => {
    assert.equal(createOwnerPrintMapState('default').basemapMode, 'live');
    assert.equal(createOwnerPrintMapState('default', { basemapMode: 'auto' }).basemapMode, 'auto');
    assert.equal(createOwnerPrintMapState('default', { basemapMode: 'town' }).basemapMode, 'live');
    assert.match(ownerPageSource, /OWNER_PRINT_BASEMAP_OPTIONS = TOWN_MAP_PROOF_ENABLED/);
    assert.match(ownerPageSource, /createOwnerPrintMapState\(mapStyle, OWNER_PRINT_BASEMAP_OPTIONS\)/);
    assert.match(ownerPageSource, /resetOwnerPrintMapState\(current, mapStyle\)/);
});

test('owner print reset clears camera and detail changes without losing the device colour preference', () => {
    const current = {
        mapStyle: 'default',
        basemapMode: 'auto',
        view: { center: [1.38, 103.75], zoom: 16 },
        height: 640,
        pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL,
        resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
        mapQuality: PRINT_MAP_QUALITY_HIGH,
        resourceLayer: PRINT_MAP_RESOURCE_LAYER_HIDE,
        annotationLayer: 'hide',
        hiddenResourceLayerKeys: ['resource:carearound'],
        hiddenAnnotationIds: ['annotation_1'],
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_RIGHT,
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
        labelDetail: PRINT_MAP_LABEL_DETAIL_NAMES,
        resourceColumnCount: 4,
        sideResourceColumnCount: 2,
        resetVersion: 2,
    };
    const reset = resetOwnerPrintMapState(current, 'gray');
    assert.equal(reset.mapStyle, 'gray');
    assert.equal(reset.basemapMode, 'live');
    assert.equal(reset.view, null);
    assert.equal(reset.height, PRINT_MAP_DEFAULT_HEIGHT_PX);
    assert.equal(reset.pageLayout, PRINT_MAP_PAGE_LAYOUT_STANDARD);
    assert.equal(reset.resourcePlacement, PRINT_MAP_RESOURCE_PLACEMENT_BESIDE);
    assert.equal(reset.mapQuality, PRINT_MAP_QUALITY_STANDARD);
    assert.equal(reset.resourceLayer, PRINT_MAP_RESOURCE_LAYER_SHOW);
    assert.equal(reset.annotationLayer, PRINT_MAP_ANNOTATION_LAYER_SHOW);
    assert.deepEqual(reset.hiddenResourceLayerKeys, []);
    assert.deepEqual(reset.hiddenAnnotationIds, []);
    assert.equal(reset.layoutPreset, PRINT_MAP_LAYOUT_BALANCED);
    assert.equal(reset.mapSide, PRINT_MAP_SIDE_LEFT);
    assert.equal(reset.mapWidth, PRINT_MAP_WIDTH_WIDE);
    assert.equal(reset.labelDetail, PRINT_MAP_LABEL_DETAIL_FULL);
    assert.equal(reset.resourceColumnCount, PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT);
    assert.equal(reset.sideResourceColumnCount, PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT);
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
        buildPrintMapCaptureKey({ ...baseline, pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL }),
        buildPrintMapCaptureKey({ ...baseline, resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE }),
        buildPrintMapCaptureKey({ ...baseline, mapQuality: PRINT_MAP_QUALITY_HIGH }),
        buildPrintMapCaptureKey({ ...baseline, resourceLayer: PRINT_MAP_RESOURCE_LAYER_HIDE }),
        buildPrintMapCaptureKey({ ...baseline, annotationLayer: 'hide' }),
        buildPrintMapCaptureKey({ ...baseline, hiddenResourceLayerKeys: ['resource:carearound'] }),
        buildPrintMapCaptureKey({ ...baseline, hiddenAnnotationIds: ['annotation_1'] }),
        buildPrintMapCaptureKey({ ...baseline, layoutPreset: PRINT_MAP_LAYOUT_FOCUS }),
        buildPrintMapCaptureKey({ ...baseline, mapSide: PRINT_MAP_SIDE_RIGHT }),
        buildPrintMapCaptureKey({ ...baseline, mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE }),
        buildPrintMapCaptureKey({ ...baseline, labelDetail: PRINT_MAP_LABEL_DETAIL_NAMES }),
        buildPrintMapCaptureKey({ ...baseline, labelDetail: PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS }),
        buildPrintMapCaptureKey({ ...baseline, resourceColumnCount: 4 }),
        buildPrintMapCaptureKey({ ...baseline, sideResourceColumnCount: 2 }),
    ]);
    assert.equal(keys.size, 19);
});

test('Full layout exports the map and resources as separate image pages', () => {
    assert.equal(shouldExportPrintMapAsSeparatePages({
        layoutPreset: PRINT_MAP_LAYOUT_FULL,
    }), true);
    assert.equal(shouldExportPrintMapAsSeparatePages({
        pageLayout: PRINT_MAP_PAGE_LAYOUT_STANDARD,
        resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
    }), false);
    assert.equal(shouldExportPrintMapAsSeparatePages({
        pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL,
        resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
    }), false);
    assert.equal(shouldExportPrintMapAsSeparatePages({
        pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL,
        resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
    }), true);
});

test('print layout presets keep Balanced and Side stable while Full owns the separate-page composition', () => {
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
    assert.deepEqual(getOwnerPrintLayoutConfig({
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        sideResourceColumnCount: 2,
    }), {
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_LEFT,
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        mapMaxWidthPx: 740,
        gridClassName: 'grid-cols-[0px_minmax(0,1fr)_620px]',
    });
    assert.deepEqual(getOwnerPrintLayoutConfig({
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_RIGHT,
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
        sideResourceColumnCount: 2,
    }), {
        layoutPreset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: PRINT_MAP_SIDE_RIGHT,
        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
        mapMaxWidthPx: 800,
        gridClassName: 'grid-cols-[560px_minmax(0,1fr)_0px]',
    });
    assert.deepEqual(getOwnerPrintLayoutConfig({
        layoutPreset: PRINT_MAP_LAYOUT_FULL,
    }), {
        layoutPreset: PRINT_MAP_LAYOUT_FULL,
        mapSide: 'center',
        mapWidth: PRINT_MAP_WIDTH_WIDE,
        mapMaxWidthPx: 1400,
        gridClassName: 'grid-cols-[0px_minmax(0,1fr)_0px]',
        resourcesBelow: true,
    });
});

test('Full layout supports two to six ordered resource columns', () => {
    const groups = Array.from({ length: 8 }, (_, index) => ({
        name: `Place ${index + 1}`,
        rows: Array.from({ length: index % 3 }, () => ({})),
    }));
    const equalGroups = Array.from({ length: 22 }, (_, index) => ({
        name: `Equal place ${index + 1}`,
        rows: [],
    }));

    assert.equal(normalizePrintMapResourceColumnCount(2), 2);
    assert.equal(normalizePrintMapResourceColumnCount('3'), 3);
    assert.equal(normalizePrintMapResourceColumnCount(4), 4);
    assert.equal(normalizePrintMapResourceColumnCount(5), 5);
    assert.equal(normalizePrintMapResourceColumnCount(6), 6);
    assert.equal(normalizePrintMapResourceColumnCount(7), PRINT_MAP_RESOURCE_COLUMN_COUNT_DEFAULT);
    assert.deepEqual(
        splitPrintResourceGroups(groups, 4).flat().map((group) => group.name),
        groups.map((group) => group.name),
    );
    assert.equal(splitPrintResourceGroups(groups, 4).length, 4);
    assert.deepEqual(
        splitPrintResourceGroups(equalGroups, 3).map((column) => column.length).sort((a, b) => a - b),
        [7, 7, 8],
    );
    assert.deepEqual(
        splitPrintResourceGroups(equalGroups.slice(0, 2), 4).map((column) => column.length),
        [1, 1, 0, 0],
    );
    assert.equal(splitPrintResourceGroups(equalGroups, 6).length, 6);
});

test('Side layout supports one or two ordered category-aware card columns', () => {
    const groups = [
        ...Array.from({ length: 2 }, (_, index) => ({
            name: `Category A ${index + 1}`,
            categoryLabel: 'Category A',
            categorySortKey: 'Category A',
            rows: [],
        })),
        ...Array.from({ length: 2 }, (_, index) => ({
            name: `Category B ${index + 1}`,
            categoryLabel: 'Category B',
            categorySortKey: 'Category B',
            rows: [],
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
            name: `Category C ${index + 1}`,
            categoryLabel: 'Category C',
            categorySortKey: 'Category C',
            rows: [],
        })),
    ];

    assert.equal(normalizePrintMapSideResourceColumnCount(1), 1);
    assert.equal(normalizePrintMapSideResourceColumnCount('2'), 2);
    assert.equal(
        normalizePrintMapSideResourceColumnCount(3),
        PRINT_MAP_SIDE_RESOURCE_COLUMN_COUNT_DEFAULT,
    );
    assert.deepEqual(
        splitPrintSideResourceGroups(groups, 2).flat().map((group) => group.name),
        groups.map((group) => group.name),
    );
    assert.equal(splitPrintSideResourceGroups(groups, 2).length, 2);
    assert.equal(
        splitPrintSideResourceGroups(groups, 2)
            .filter((column) => column.some((group) => group.categoryLabel === 'Category A'))
            .length,
        1,
    );
});

test('Full layout keeps ordinary category runs together and only splits long categories', () => {
    const makeCategoryGroups = (categoryLabel, count) => Array.from({ length: count }, (_, index) => ({
        name: `${categoryLabel} ${index + 1}`,
        categoryLabel,
        categorySortKey: categoryLabel,
        rows: [],
    }));
    const categoryGroups = [
        ...makeCategoryGroups('Active Ageing Centre', 3),
        ...makeCategoryGroups('Community Club', 2),
        ...makeCategoryGroups('Outdoor', 1),
        ...makeCategoryGroups('PA Resident Network', 6),
        ...makeCategoryGroups('Personal place', 1),
        ...makeCategoryGroups('Senior Care Centre', 3),
        ...makeCategoryGroups('Senior Citizen Fitness Corner', 2),
        ...makeCategoryGroups('Shopping Mall', 3),
        ...makeCategoryGroups('SportSG Facilities', 1),
    ];
    const categoryColumns = splitPrintResourceGroups(categoryGroups, 4);
    const categoryColumnIndexes = (categoryLabel) => categoryColumns
        .map((column, index) => (
            column.some((group) => group.categoryLabel === categoryLabel) ? index : -1
        ))
        .filter((index) => index >= 0);

    assert.deepEqual(
        categoryColumns.map((column) => column.length).sort((a, b) => a - b),
        [4, 6, 6, 6],
    );
    assert.equal(categoryColumnIndexes('PA Resident Network').length, 1);
    assert.equal(categoryColumnIndexes('Senior Citizen Fitness Corner').length, 1);

    const longCategoryGroups = [
        ...makeCategoryGroups('Long category', 12),
        ...makeCategoryGroups('Other A', 1),
        ...makeCategoryGroups('Other B', 1),
        ...makeCategoryGroups('Other C', 1),
    ];
    const longCategoryColumns = splitPrintResourceGroups(longCategoryGroups, 4);
    assert.ok(
        longCategoryColumns.filter((column) => (
            column.some((group) => group.categoryLabel === 'Long category')
        )).length > 1,
    );
});

test('Name and description is a normalized owner print label mode', () => {
    assert.equal(
        normalizePrintMapLabelDetail(PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS),
        PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    );
    assert.equal(normalizePrintMapLabelDetail('unknown'), PRINT_MAP_LABEL_DETAIL_FULL);
});

test('screen preview fills wide viewports without changing the fixed export canvas', () => {
    assert.equal(getPrintMapPreviewScale(1512), 1);
    assert.ok(getPrintMapPreviewScale(1840) > 1);
    assert.equal(getPrintMapPreviewScale(100), 0.2);
    assert.equal(PRINT_MAP_CANVAS_WIDTH_PX, 1480);
});

test('high-resolution image export increases output while capping very long pages safely', () => {
    const standard = getPrintMapExportConfig({ mapQuality: PRINT_MAP_QUALITY_STANDARD }, {
        width: 1480,
        height: 1000,
    });
    const high = getPrintMapExportConfig({ mapQuality: PRINT_MAP_QUALITY_HIGH }, {
        width: 1480,
        height: 1000,
    });
    const capped = getPrintMapExportConfig({ mapQuality: PRINT_MAP_QUALITY_HIGH }, {
        width: 1480,
        height: 10000,
    });
    assert.equal(standard.outputScale, 4);
    assert.equal(high.outputScale, 5);
    assert.equal(high.isCapped, false);
    assert.equal(capped.isCapped, true);
    assert.ok(capped.outputScale < high.outputScale);
});

test('print layout controls use a compact mobile-safe three-mode layout with progressive disclosure', () => {
    assert.match(printLayoutControlsSource, /t\('printLayout'\)/);
    assert.match(printLayoutControlsSource, /t\('printPageFullMap'\)/);
    assert.match(printLayoutControlsSource, /t\('printResourcePinsHide'\)/);
    assert.match(printLayoutControlsSource, /t\('printLayoutBalanced'\)/);
    assert.match(printLayoutControlsSource, /t\('printLayoutMapFocus'\)/);
    assert.match(printLayoutControlsSource, /t\('printMapPosition'\)/);
    assert.match(printLayoutControlsSource, /t\('printMapWidth'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesOnly'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesLogos'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesAddresses'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelNamesDescriptions'\)/);
    assert.match(printLayoutControlsSource, /t\('printLabelFullDetails'\)/);
    assert.match(printLayoutControlsSource, /data-print-resource-column-controls="true"/);
    assert.match(printLayoutControlsSource, /resourceColumnCount: count/);
    assert.match(printLayoutControlsSource, /\[2, 3, 4, 5, 6\]/);
    assert.match(printLayoutControlsSource, /data-print-side-resource-column-controls="true"/);
    assert.match(printLayoutControlsSource, /sideResourceColumnCount: count/);
    assert.match(printLayoutControlsSource, /\[1, 2\]/);
    assert.match(printLayoutControlsSource, /layoutPreset === PRINT_MAP_LAYOUT_FOCUS/);
    assert.match(printLayoutControlsSource, /layoutPreset === PRINT_MAP_LAYOUT_FULL/);
    assert.match(printLayoutControlsSource, /data-print-map-width-controls="true"/);
    assert.match(printLayoutControlsSource, /grid-cols-3 gap-2/);
    assert.match(printLayoutControlsSource, /min-h-11/);
    assert.match(printLayoutControlsSource, /touch-manipulation/);
    assert.match(printLayoutControlsSource, /overflow-hidden/);
    assert.match(ownerPageSource, /grid w-full grid-cols-2 gap-2 sm:flex/);
    assert.match(ownerPageSource, /className="min-h-11 w-full px-3 text-xs sm:w-auto sm:text-sm"/);
    assert.doesNotMatch(printLayoutControlsSource, /data-print-page-layout-controls/);
    assert.doesNotMatch(printLayoutControlsSource, /data-print-resource-placement-controls/);
    assert.doesNotMatch(printLayoutControlsSource, /data-print-image-quality-controls/);
});

test('print label detail choices retain the numbered map key while controlling address and resource rows', () => {
    assert.match(sharedMapDirectorySource, /showPrintAddress/);
    assert.match(sharedMapDirectorySource, /showPrintResourceRows/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_FULL/);
    assert.match(printViewSource, /cardBadgeMode=\{useV2OwnerPrint \? \(showPrintLogos \? 'logo' : 'none'\) : 'number'\}/);
    assert.match(printViewSource, /showPrintNumberBadges=\{useV2OwnerPrint\}/);
    assert.match(sharedMapDirectorySource, /PRINT_MAP_LABEL_DETAIL_NAMES/);
    assert.match(sharedMapDirectorySource, /useCompactNamesOnlyCard \? 'rounded-xl px-2 py-1\.5'/);
    assert.match(sharedMapDirectorySource, /printNumberBadgePosition="end"/);
    assert.match(sharedMapDirectorySource, /printNumberBadgePosition="start"/);
    assert.match(sharedMapDirectorySource, /renderPrintResourceColumn\(groups, 'start'\)/);
    assert.match(sharedMapDirectorySource, /data-print-resource-columns=\{normalizedPrintResourceColumnCount\}/);
    assert.match(sharedMapDirectorySource, /data-print-side-resource-columns=\{normalizedPrintColumnCount\}/);
    assert.match(printViewSource, /printResourceColumnCount=\{resourceColumnCount\}/);
    assert.match(printViewSource, /const effectiveSideResourceColumnCount = printLayoutConfig\.layoutPreset === PRINT_MAP_LAYOUT_FOCUS/);
    assert.match(printViewSource, /data-print-side-resource-columns=\{effectiveSideResourceColumnCount\}/);
    assert.match(printViewSource, /printSideResourceColumnCount=\{effectiveSideResourceColumnCount\}/);
});

test('Print View owns one-shot short-description editing without leaking controls into exports', () => {
    const nestedMapPropsStart = printViewSource.indexOf('function PrintDirectoryMap({');
    const nestedMapProps = printViewSource.slice(
        nestedMapPropsStart,
        printViewSource.indexOf('}) {', nestedMapPropsStart),
    );
    const printViewPropsStart = printViewSource.indexOf('export default function DirectoryPrintView({');
    const printViewProps = printViewSource.slice(
        printViewPropsStart,
        printViewSource.indexOf('}) {', printViewPropsStart),
    );

    assert.match(ownerPageSource, /data-print-short-description-trigger="true"/);
    assert.match(ownerPageSource, /setPrintShortDescriptionMode\(\(current\) => !current\)/);
    assert.match(ownerPageSource, /onEditResourceShortDescription=\{printShortDescriptionMode[\s\S]*handleEditResourceShortDescription[\s\S]*: null\}/);
    assert.match(printViewProps, /onEditResourceShortDescription = null/);
    assert.doesNotMatch(nestedMapProps, /onEditResourceShortDescription/);
    assert.match(printViewSource, /onEditResourceShortDescription=\{variant === 'screen'[\s\S]*\? onEditResourceShortDescription[\s\S]*: null\}/);
    assert.match(sharedMapDirectorySource, /data-print-short-description-action="true"/);
    assert.match(sharedMapDirectorySource, /printShortDescriptionEditing \|\| hasRowShortDescription\(row\)/);
    assert.ok(
        (ownerPageSource.match(/setPrintShortDescriptionMode\(false\)/g) || []).length >= 4,
        'the one-shot mode should close after save, cancel, navigation, and competing tools',
    );
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
    assert.match(printViewSource, /fixedTownSurfaceSnapToMinZoom=\{Boolean\(printMapState && interactive\)\}/);
    assert.match(printViewSource, /fixedTownSurfaceContainOnResize=\{Boolean\(printMapState && interactive\)\}/);
    assert.match(printViewSource, /PRINT_FULL_MAP_FIXED_SURFACE_MAX_DECODED_BYTES = 384 \* 1024 \* 1024/);
    assert.match(printViewSource, /fixedTownSurfaceMaxDecodedBytes=\{printMapState\?\.pageLayout === PRINT_MAP_PAGE_LAYOUT_FULL/);
    assert.match(printViewSource, /onFixedTownSurfaceViewportChange=\{interactive \? onFixedTownSurfaceViewportChange : null\}/);
    assert.match(printViewSource, /mapHeightPx=\{printMapState \? clampPrintMapHeight\(printMapState\.height, printMapState\) : null\}/);
    assert.match(printViewSource, /pins=\{presentation\.pins\}/);
    assert.match(printViewSource, /renderPins=\{visibleResourcePins\}/);
    assert.match(printViewSource, /showPins=\{showResourcePins\}/);
    assert.match(printViewSource, /printResourcesBelow=\{printResourcesBelow\}/);
    assert.match(sharedMapDirectorySource, /data-print-full-map-page="true"/);
    assert.match(sharedMapDirectorySource, /data-print-resource-page="true"/);
    assert.match(sharedMapDirectorySource, /data-print-export-page="map"/);
    assert.match(sharedMapDirectorySource, /data-print-export-page="resources"/);
    assert.match(printViewSource, /data-print-resource-page-header="true"/);
});

test('visible preview and hidden image export consume the same frozen print map state and width', () => {
    assert.match(ownerPageSource, /printMapState=\{printMapState\}/g);
    assert.match(ownerPageSource, /<PrintLayoutControls/);
    assert.match(ownerPageSource, /ownerInteractiveDirectoryUrl/);
    assert.match(ownerPageSource, /nextParams\.delete\('view'\)/);
    assert.match(ownerPageSource, /const printQrDirectoryUrl = sharedDirectoryUrl \|\| ownerInteractiveDirectoryUrl/);
    assert.match(printViewSource, /mode === 'shared' \|\| mode === 'owner' \|\| directory\?\.share\?\.isShared/);
    assert.match(exportButtonSource, /const exportWidth = PRINT_MAP_CANVAS_WIDTH_PX/);
    assert.match(exportButtonSource, /getPrintMapExportConfig\(captureState/);
    assert.match(exportButtonSource, /shouldExportPrintMapAsSeparatePages\(printMapState\)/);
    assert.match(exportButtonSource, /querySelector\('\[data-print-export-page="map"\]'\)/);
    assert.match(exportButtonSource, /querySelector\('\[data-print-export-page="resources"\]'\)/);
    assert.match(exportButtonSource, /buildFileName\(directory\?\.name, name\)/);
    assert.match(exportButtonSource, /data-print-export-page-action="resources"/);
    assert.match(exportButtonSource, /data-print-export-page-action="map"/);
    assert.match(exportButtonSource, /handleImageExport\('resources'\)/);
    assert.match(exportButtonSource, /handleImageExport\('map'\)/);
    assert.match(exportButtonSource, /t\('saveResourcePng'\)/);
    assert.match(exportButtonSource, /t\('saveMapPng'\)/);
    assert.match(exportButtonSource, /t\('saveAsImage'\)/);
    assert.doesNotMatch(exportButtonSource, /saveAsImages/);
    assert.match(exportButtonSource, /captureExportPages\(\{ forceHighQuality: true \}\)/);
    assert.match(exportButtonSource, /downloadPrintMapPdf\(\{ pages, directoryName: directory\?\.name \}\)/);
    assert.match(exportButtonSource, /data-print-pdf-export="a3"/);
    assert.match(exportButtonSource, /t\('savePrintPdf'\)/);
    assert.doesNotMatch(exportButtonSource, /data-print-pdf-export="print-master-100"/);
    assert.doesNotMatch(exportButtonSource, /t\('savePrintMasterPdf'\)/);
    assert.doesNotMatch(exportButtonSource, /fetchPrintMasterManifest/);
    assert.doesNotMatch(exportButtonSource, /upgradeCapturedPageWithPrintMaster/);
    assert.doesNotMatch(exportButtonSource, /printMasterPdfHelp/);
    assert.match(exportButtonSource, /canvasWidth: Math\.round\(width \* exportConfig\.canvasScale\)/);
    assert.match(exportButtonSource, /printMapState=\{printMapState\}/);
    assert.match(exportButtonSource, /printMapCaptureKey/);
    assert.match(exportButtonSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(exportButtonSource, /const exportFormat = pageName \? `\$\{pageName\}-image` : 'image'/);
    assert.match(exportButtonSource, /await mountExportSurface\(exportFormat\)/);
    assert.match(exportButtonSource, /await mountExportSurface\('pdf'\)/);
    assert.match(exportButtonSource, /\{exportRoot \? createPortal\(/);
    assert.match(exportButtonSource, /<div ref=\{handleExportNodeRef\}>/);
    assert.match(exportPanelSource, /printMapState=\{printMapState\}/);
    assert.match(exportPanelSource, /fixedTownSurfacePending=\{fixedTownSurfacePending\}/);
    assert.match(exportPanelSource, /onMapViewportSnapshot=\{onMapViewportSnapshot\}/);
    assert.match(printViewSource, /captureReadyKey=\{printMapState \? buildPrintMapCaptureKey\(printMapState\) : ''\}/);
    assert.match(printViewSource, /getOwnerPrintLayoutConfig\(printMapState\)/);
    assert.match(printViewSource, /printLabelDetail=\{labelDetail\}/);
    assert.match(printViewSource, /mapMaxWidthPx=\{printLayoutConfig\.mapMaxWidthPx\}/);
    assert.match(
        ownerPageSource,
        /className="sticky top-\[56px\] z-\[1150\][^"]*print:hidden sm:top-\[64px\]"/,
    );
    assert.match(ownerPageSource, /data-owner-print-toolbar="true"/);
    assert.match(ownerPageSource, /data-print-toolbar-actions="true"/);
    assert.match(ownerPageSource, /data-print-layout-panel="true"/);
    assert.match(
        ownerPageSource,
        /lg:absolute lg:right-4 lg:top-\[calc\(100%\+12px\)\][^"]*lg:max-h-\[calc\(100dvh-12rem\)\][^"]*lg:w-\[400px\][^"]*lg:overflow-y-auto/,
    );
    assert.match(ownerPageSource, /if \(!isPrintView \|\| !printLayoutOpen\) return undefined/);
    assert.match(ownerPageSource, /event\.key !== 'Escape'/);
    assert.match(ownerPageSource, /window\.addEventListener\('keydown', handlePrintLayoutKeyDown\)/);
    assert.match(ownerPageSource, /Your saved image will match this preview/);
    assert.doesNotMatch(ownerPageSource, /onClick=\{\(\) => window\.print\(\)\}/);
    assert.match(directoryMapSource, /right-\[13px\] top-3 z-\[1002\] lg:right-3/);
    assert.match(directoryMapSource, /data-print-export-map-frame=\{onMapReadyForCapture \? 'true' : undefined\}/);
    assert.match(directoryMapSource, /onMapViewportSnapshot\(\{/);
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
    assert.match(directoryMapSource, /showPins = true/);
    assert.match(directoryMapSource, /renderPins = null/);
    assert.match(directoryMapSource, /const markerPins = useMemo/);
    assert.match(directoryMapSource, /pins=\{displayPins\}/);
    assert.match(directoryMapSource, /if \(!showPins\) return null/);
    assert.match(printViewSource, /printMapState = null/);
    assert.match(printViewSource, /printMapState=\{useV2OwnerPrint \? printMapState : null\}/);
});

test('Full map owns a session-only resource and annotation layer panel', () => {
    const layersControlSource = readFileSync(
        new URL('../src/components/PrintMapLayersControl.jsx', import.meta.url),
        'utf8',
    );
    const layersModelSource = readFileSync(
        new URL('../src/lib/printMapLayers.js', import.meta.url),
        'utf8',
    );

    assert.match(printViewSource, /<PrintMapLayersControl/);
    assert.match(printViewSource, /filterPrintMapResourcePins/);
    assert.match(printViewSource, /filterPrintMapAnnotations/);
    assert.match(printViewSource, /data-print-map-layers-enabled="true"/);
    assert.match(layersControlSource, /data-print-map-layers-control="true"/);
    assert.match(layersModelSource, /CareAround resources/);
    assert.match(layersModelSource, /Personal places/);
    assert.match(layersControlSource, /Annotations/);
    assert.match(layersControlSource, /Reset layers/);
    assert.doesNotMatch(layersControlSource, /Delete annotation/);
    assert.doesNotMatch(ownerPageSource, /updateMyMapPrintLayer|savePrintLayer/);
});

test('owner print PDF action uses concise PDF wording in every locale', () => {
    assert.match(i18nSource, /savePrintPdf: 'Save PDF'/);
    assert.match(i18nSource, /savePrintPdf: '保存 PDF'/);
    assert.match(i18nSource, /savePrintPdf: 'Simpan PDF'/);
    assert.match(i18nSource, /savePrintPdf: 'PDF ஐ சேமி'/);
    assert.doesNotMatch(i18nSource, /savePrintPdf: '[^']*A3[^']*'/);
});

test('image capture readiness survives harmless map rerenders and cached tile loads', () => {
    assert.match(directoryMapSource, /const capturePinSignature = useMemo/);
    assert.match(directoryMapSource, /load: handleCaptureTilesLoaded/);
    assert.match(directoryMapSource, /mapSettledRef\.current = true;\s+tryNotifyReady\(\);/);
    assert.match(directoryMapSource, /DIRECTORY_CAPTURE_READY_TIMEOUT_MS = 10000/);
    assert.match(directoryMapSource, /waitForFixedTownSurfaceCapturePaint/);
    assert.match(directoryMapSource, /img\.fixed-town-surface__chunk/);
    assert.match(directoryMapSource, /image\.decode\(\)/);
    assert.doesNotMatch(
        directoryMapSource,
        /\[anchorPoint, captureReadyKey[^\]]*\bpins\b[^\]]*\bplaceNumberByKey\b/,
    );
});

test('map image export rejects blank map captures and saves large PNGs as blobs', () => {
    assert.match(exportButtonSource, /MAP_CAPTURE_RETRY_DELAY_MS = 750/);
    assert.match(exportButtonSource, /isMapCaptureVisiblyBlank/);
    assert.match(exportButtonSource, /MAP_CAPTURE_BLANK_MAX_AVERAGE_DISTANCE/);
    assert.match(exportButtonSource, /querySelector\('\[data-print-export-map-frame="true"\]'\)/);
    assert.match(exportButtonSource, /cacheBust: Boolean\(mapFrameNode\)/);
    assert.match(exportButtonSource, /Image export failed because the map image was still blank/);
    assert.match(exportButtonSource, /async function savePngDataUrl/);
    assert.match(exportButtonSource, /const blob = await response\.blob\(\)/);
    assert.match(exportButtonSource, /waitForExportSurface\(\{ waitForMap: pageName !== 'resources' \}\)/);
    assert.match(exportButtonSource, /captureExportPages\(\{ pageName \}\)/);
    assert.match(exportButtonSource, /style=\{\{ zIndex: -1, opacity: 0\.01 \}\}/);
});

test('map downloads wait for a verified export surface while resource PNG stays available', () => {
    assert.match(exportButtonSource, /MAP_READINESS_PROBE_MAX_ATTEMPTS/);
    assert.match(exportButtonSource, /verifyMapDownloadReadiness/);
    assert.match(exportButtonSource, /await isMapCaptureVisiblyBlank/);
    assert.match(exportButtonSource, /data-print-export-readiness=\{mapDownloadStatus\}/);
    assert.match(exportButtonSource, /role="progressbar"/);
    assert.match(exportButtonSource, /disabled=\{exporting \|\| !mapDownloadReady\}/g);
    assert.match(exportButtonSource, /onClick=\{\(\) => handleImageExport\('resources'\)\}[\s\S]*?disabled=\{exporting\}[\s\S]*?data-print-export-page-action="resources"/);
    assert.match(exportButtonSource, /t\('retryMapDownloadPreparation'\)/);
    assert.match(exportButtonSource, /\{exportRoot \? createPortal\(/);
});

test('separate map and resource PNG labels are available in every locale', () => {
    assert.match(i18nSource, /saveMapPng: 'Save Map PNG'/);
    assert.match(i18nSource, /saveResourcePng: 'Save Resource PNG'/);
    assert.match(i18nSource, /saveMapPng: '保存地图 PNG'/);
    assert.match(i18nSource, /saveResourcePng: '保存资源 PNG'/);
    assert.match(i18nSource, /saveMapPng: 'Simpan PNG peta'/);
    assert.match(i18nSource, /saveResourcePng: 'Simpan PNG sumber'/);
    assert.match(i18nSource, /saveMapPng: 'வரைபட PNG ஆக சேமி'/);
    assert.match(i18nSource, /saveResourcePng: 'வள PNG ஆக சேமி'/);
});

test('local print-master client keeps the existing Detailed map runtime enabled', () => {
    const command = rootPackage.scripts['dev:print-master-client'];
    assert.match(command, /VITE_TOWN_MAP_PROOF_ENABLED=true/);
    assert.match(command, /VITE_TOWN_MAP_ASSET_BASE_URL=http:\/\/127\.0\.0\.1:4174\/v2\/native-scale-20260722\/default/);
    assert.match(command, /VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=http:\/\/127\.0\.0\.1:4174\/v2\/native-scale-20260722\/gray/);
    assert.match(command, /VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL=http:\/\/127\.0\.0\.1:4175\/default/);
    assert.match(command, /VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL=http:\/\/127\.0\.0\.1:4175\/gray/);
});
