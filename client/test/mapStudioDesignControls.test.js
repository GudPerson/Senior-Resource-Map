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

test('Explore and Design remain explicit modes with accessible touch controls', () => {
    assert.match(controlsSource, /data-map-studio-mode-switch="true"/);
    assert.match(controlsSource, /MAP_STUDIO_MODE_EXPLORE/);
    assert.match(controlsSource, /MAP_STUDIO_MODE_DESIGN/);
    assert.match(controlsSource, /aria-pressed=\{selected\}/);
    assert.match(controlsSource, /min-h-11/);
    assert.match(controlsSource, /disabled=\{disabled \|\| !canUseCurrentFraming\}/);
});

test('approved runtime mounts controls only inside the owner Map Studio panel', () => {
    assert.match(panelSource, /import MapStudioDesignControls, \{ MapStudioModeSwitch \}/);
    assert.match(panelSource, /ownerState\.session\.mode === MAP_STUDIO_MODE_DESIGN/);
    assert.match(panelSource, /design=\{ownerState\.session\.draftDesign\}/);
    assert.match(panelSource, /explorationCamera=\{ownerState\.session\.exploration\.cameraView\}/);
    assert.match(panelSource, /resourceLayerCatalog=\{resourceLayerCatalog\}/);
    assert.match(panelSource, /annotationLayerCatalog=\{annotationLayerCatalog\}/);
    assert.match(panelSource, /data-map-studio-design-settings-trigger="true"/);
    assert.match(panelSource, /designSettingsOpen/);
    assert.match(panelSource, /lg:absolute/);
    assert.match(panelSource, /event\.key !== 'Escape'/);
    assert.match(panelSource, /data-map-studio-map-tools="true"/);
    assert.match(panelSource, /onToggleAnnotations/);
    assert.match(panelSource, /onOpenExport/);
    assert.doesNotMatch(ownerPageSource, /MapStudioDesignControls|MapStudioModeSwitch/);
});
