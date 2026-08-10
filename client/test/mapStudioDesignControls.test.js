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
    assert.doesNotMatch(controlsSource, /mapStudioMapDetail|detailMode:/);
    assert.match(controlsSource, /MAP_STUDIO_PIN_STYLE_BUBBLE/);
    assert.match(controlsSource, /MAP_STUDIO_PIN_STYLE_NUMBERED/);
    assert.match(controlsSource, /MAP_STUDIO_PIN_STYLE_CATEGORY_ICON/);
    assert.doesNotMatch(controlsSource, /MAP_STUDIO_MAP_HEIGHT_(?:COMPACT|STANDARD|TALL)/);
    assert.doesNotMatch(controlsSource, /MAP_STUDIO_CAMERA_(?:FIT|FIXED)/);
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
    assert.match(controlsSource, /<details[^>]+data-map-studio-resource-layers="true"/);
    assert.match(controlsSource, /mapStudioResourceCategoriesSummary/);
    assert.match(controlsSource, /data-map-studio-annotation-layers="true"/);
    assert.match(controlsSource, /<details[^>]+data-map-studio-annotation-layers="true"/);
    assert.match(controlsSource, /annotationLayerCatalog\.filter\(\(annotation\) => !hiddenAnnotationIds\.has\(annotation\.id\)\)\.length/);
    assert.match(controlsSource, /ChevronDown/);
    assert.match(controlsSource, /group-open:rotate-180/);
    assert.match(controlsSource, /hiddenAnnotationIds/);
    assert.match(controlsSource, /data-map-studio-resource-layer-controls="true"/);
    assert.match(controlsSource, /value\.layers\.resources === PRINT_MAP_RESOURCE_LAYER_SHOW \? \(/);
    assert.match(controlsSource, /onClose/);
    assert.match(controlsSource, /PanelLeft/);
    assert.match(controlsSource, /PanelRight/);
    assert.match(controlsSource, /aria-pressed=\{panelSide === MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT\}/);
    assert.match(controlsSource, /aria-pressed=\{panelSide === MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT\}/);
    assert.doesNotMatch(controlsSource, /DirectoryMap|DirectoryPrintView|SharedMapDirectoryList/);
});

test('layout choices keep accessible touch controls without exposing a redundant mode switch', () => {
    assert.doesNotMatch(controlsSource, /data-map-studio-mode-switch="true"/);
    assert.doesNotMatch(controlsSource, /MAP_STUDIO_MODE_EXPLORE|MAP_STUDIO_MODE_DESIGN/);
    assert.match(controlsSource, /aria-pressed=\{selected\}/);
    assert.match(controlsSource, /min-h-11/);
    assert.doesNotMatch(controlsSource, /explorationCamera|cameraCandidate|canUseCurrentFraming/);
});

test('the owner toolbar opens the floating layout controls through the narrow Studio controller', () => {
    assert.match(panelSource, /import MapStudioDesignControls from/);
    assert.match(panelSource, /ownerState\.session\.mode === MAP_STUDIO_MODE_DESIGN/);
    assert.match(panelSource, /design=\{ownerState\.session\.draftDesign\}/);
    assert.doesNotMatch(panelSource, /explorationCamera=/);
    assert.match(panelSource, /resourceLayerCatalog=\{resourceLayerCatalog\}/);
    assert.match(panelSource, /annotationLayerCatalog=\{annotationLayerCatalog\}/);
    assert.match(panelSource, /openLayoutSettings: \(\) => \{[\s\S]*setDesignSettingsCollapsed\(false\);[\s\S]*handleModeChange\(MAP_STUDIO_MODE_DESIGN\);/);
    assert.match(panelSource, /designSettingsOpen/);
    assert.match(panelSource, /designSettingsCollapsed/);
    assert.match(panelSource, /document\.addEventListener\('pointerdown', handleDesignSettingsOutsidePointer, true\)/);
    assert.match(panelSource, /setDesignSettingsCollapsed\(true\)/);
    assert.match(panelSource, /data-map-studio-design-settings-state=\{designSettingsCollapsed \? 'collapsed' : 'expanded'\}/);
    assert.match(panelSource, /onClick=\{\(\) => setDesignSettingsCollapsed\(false\)\}/);
    assert.match(panelSource, /onClick=\{closeDesignSettings\}/);
    assert.match(panelSource, /readMapStudioLayoutPanelSide/);
    assert.match(panelSource, /writeMapStudioLayoutPanelSide/);
    assert.match(panelSource, /data-map-studio-design-settings-side=\{designSettingsSide\}/);
    assert.match(panelSource, /lg:left-4 lg:right-auto/);
    assert.match(panelSource, /lg:right-4 lg:left-auto/);
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
