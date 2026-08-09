import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controlsSource = readFileSync(
    new URL('../src/components/MapStudioDesignControls.jsx', import.meta.url),
    'utf8',
);
const panelSource = readFileSync(
    new URL('../src/components/MapStudioViewsPanel.jsx', import.meta.url),
    'utf8',
);
const ownerPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);

test('standalone Map Studio controls expose the complete adapter-ready interactive settings', () => {
    assert.match(controlsSource, /data-map-studio-design-controls="true"/);
    assert.match(controlsSource, /basemap: \{ style: 'default' \}/);
    assert.match(controlsSource, /basemap: \{ detailMode: 'auto' \}/);
    assert.match(controlsSource, /MAP_STUDIO_PIN_STYLE_BUBBLE/);
    assert.match(controlsSource, /MAP_STUDIO_PIN_STYLE_NUMBERED/);
    assert.match(controlsSource, /MAP_STUDIO_PIN_STYLE_CATEGORY_ICON/);
    assert.match(controlsSource, /MAP_STUDIO_MAP_HEIGHT_TALL/);
    assert.match(controlsSource, /MAP_STUDIO_CAMERA_FIXED/);
    assert.match(controlsSource, /PRINT_MAP_ANNOTATION_LAYER_HIDE/);
    assert.match(controlsSource, /PRINT_MAP_PIN_SIZE_EXTRA_LARGE/);
    assert.match(controlsSource, /labels: \{ detail: option\.value \}/);
    assert.match(controlsSource, /hiddenResourceLayerKeys/);
    assert.match(controlsSource, /PRINT_MAP_LAYOUT_BALANCED/);
    assert.match(controlsSource, /PRINT_MAP_LAYOUT_FOCUS/);
    assert.match(controlsSource, /PRINT_MAP_LAYOUT_FULL/);
    assert.match(controlsSource, /sideResourceColumnCount/);
    assert.match(controlsSource, /resourceColumnCount/);
    assert.match(controlsSource, /data-map-studio-resource-layers="true"/);
    assert.match(controlsSource, /data-map-studio-annotation-layers="true"/);
    assert.match(controlsSource, /hiddenAnnotationIds/);
    assert.match(controlsSource, /data-map-studio-resource-layer-controls="true"/);
    assert.match(controlsSource, /value\.layers\.resources === PRINT_MAP_RESOURCE_LAYER_SHOW \? \(/);
    assert.match(controlsSource, /onClose/);
    assert.doesNotMatch(controlsSource, /DirectoryMap|DirectoryPrintView|SharedMapDirectoryList/);
});

test('layout choices keep accessible touch controls without exposing a redundant mode switch', () => {
    assert.doesNotMatch(controlsSource, /data-map-studio-mode-switch="true"/);
    assert.doesNotMatch(controlsSource, /MAP_STUDIO_MODE_EXPLORE|MAP_STUDIO_MODE_DESIGN/);
    assert.match(controlsSource, /aria-pressed=\{selected\}/);
    assert.match(controlsSource, /min-h-11/);
    assert.match(controlsSource, /disabled=\{disabled \|\| !canUseCurrentFraming\}/);
});

test('the owner toolbar opens the floating layout controls through the narrow Studio controller', () => {
    assert.match(panelSource, /import MapStudioDesignControls from/);
    assert.match(panelSource, /ownerState\.session\.mode === MAP_STUDIO_MODE_DESIGN/);
    assert.match(panelSource, /design=\{ownerState\.session\.draftDesign\}/);
    assert.match(panelSource, /explorationCamera=\{ownerState\.session\.exploration\.cameraView\}/);
    assert.match(panelSource, /resourceLayerCatalog=\{resourceLayerCatalog\}/);
    assert.match(panelSource, /annotationLayerCatalog=\{annotationLayerCatalog\}/);
    assert.match(panelSource, /openLayoutSettings: \(\) => handleModeChange\(MAP_STUDIO_MODE_DESIGN\)/);
    assert.match(panelSource, /designSettingsOpen/);
    assert.match(panelSource, /lg:absolute/);
    assert.match(panelSource, /event\.key !== 'Escape'/);
    assert.doesNotMatch(panelSource, /MapStudioModeSwitch|data-map-studio-map-tools|onOpenExport/);
    assert.match(ownerPageSource, /data-owner-map-toolbar="true"/);
    assert.match(ownerPageSource, /data-owner-edit-content-menu="true"/);
    assert.match(ownerPageSource, /data-owner-map-title-edit="true"/);
    assert.match(ownerPageSource, /mapStudioControllerRef\.current\?\.openLayoutSettings\(\)/);
    assert.match(ownerPageSource, /t\('editContent'\)/);
    assert.match(ownerPageSource, /t\('editLayout'\)/);
    assert.match(ownerPageSource, /aria-haspopup="menu"/);
    assert.match(ownerPageSource, /event\.key !== 'Escape'/);
    assert.match(ownerPageSource, /inFlow/);
    assert.doesNotMatch(ownerPageSource, /MapStudioDesignControls|MapStudioModeSwitch/);
});
