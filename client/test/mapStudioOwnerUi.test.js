import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readSource(relativePath) {
    return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const apiSource = readSource('../src/lib/api.js');
const panelSource = readSource('../src/components/MapStudioViewsPanel.jsx');
const ownerStateSource = readSource('../src/lib/mapStudioOwnerState.js');
const ownerPageSource = readSource('../src/pages/MyMapDetailPage.jsx');
const v2ScaffoldSource = readSource('../src/components/MyMapV2PreviewScaffold.jsx');
const sharedMapSource = readSource('../src/pages/SharedMapPage.jsx');
const embeddedMapSource = readSource('../src/pages/EmbeddedMapPage.jsx');

test('the client exposes only the owner Map Studio GET and atomic PUT contract', () => {
    assert.match(apiSource, /getMyMapStudio: \(id, options = \{\}\) => request\('GET', `\/my-maps\/\$\{id\}\/studio`/);
    assert.match(apiSource, /updateMyMapStudio: \(id, body\) => request\('PUT', `\/my-maps\/\$\{id\}\/studio`, body\)/);
    assert.doesNotMatch(apiSource, /shared-maps\/\$\{[^}]+\}\/studio/);
});

test('owner view management uses explicit save and discard with optimistic conflict recovery', () => {
    assert.match(panelSource, /prepareMapStudioOwnerSave\(ownerState\)/);
    assert.match(panelSource, /api\.updateMyMapStudio\(mapId, prepared\.payload\)/);
    assert.match(panelSource, /!dirty \|\| saving \|\| editorMode/);
    assert.match(panelSource, /error\?\.status === 409/);
    assert.match(panelSource, /discardOwnerMapStudioChanges\(ownerState\)/);
    assert.match(panelSource, /selectOwnerMapStudioView\(current, nextViewId\)/);
    assert.match(panelSource, /window\.addEventListener\('beforeunload'/);
    assert.match(panelSource, /data-map-studio-owner-panel="true"/);
});

test('owner panel exposes one gated runtime session and the owner page applies its adapter', () => {
    assert.match(panelSource, /onOwnerSessionChange = null/);
    assert.match(panelSource, /getMapStudioOwnerRuntimeSnapshot\(ownerState\)/);
    assert.match(panelSource, /ownerStateMapIdRef\.current === String\(mapId\)/);
    assert.match(panelSource, /loadRequestRef\.current/);
    assert.match(panelSource, /useImperativeHandle\(ref/);
    assert.match(panelSource, /patchOwnerMapStudioDraft/);
    assert.match(panelSource, /patchOwnerMapStudioExploration/);
    assert.match(ownerPageSource, /buildMapStudioInteractiveModel\(mapStudioRuntimeSnapshot\.design\)/);
    assert.match(ownerPageSource, /onOwnerSessionChange=\{handleOwnerMapStudioSessionChange\}/);
    assert.match(ownerPageSource, /mapStudioRuntime=\{ownerMapStudioRuntime\}/);
    assert.match(v2ScaffoldSource, /mapStyleOverride=\{directoryMapRuntime\?\.mapStyleOverride \?\? null\}/);
    assert.match(v2ScaffoldSource, /onMapViewStateChange=\{mapStudioRuntime\?\.onMapViewStateChange \?\? null\}/);
});

test('runtime design stays owner-scoped while exploration remains temporary', () => {
    assert.match(ownerPageSource, /mapStudioControllerRef\.current\?\.patchDesign\(/);
    assert.match(ownerPageSource, /\{ enterDesign: true \}/);
    assert.match(ownerPageSource, /\{ basemap: \{ detailMode: 'live' \} \}/);
    assert.match(ownerPageSource, /mapStudioControllerRef\.current\?\.patchExploration\(\{ cameraView \}\)/);
    assert.match(ownerPageSource, /query,[\s\S]*hoveredPlaceKey:[\s\S]*focusedPlaceKeys:[\s\S]*selectedPlaceKeys:/);
    assert.match(ownerPageSource, /interactiveMapStyle === CAREAROUND_MAP_STYLE_GRAY/);
    assert.match(ownerPageSource, /townMapManifestStates\[interactiveMapStyle\]/);
    assert.match(ownerPageSource, /filterPrintMapAnnotations\(printAnnotations\.annotations/);
    assert.match(ownerPageSource, /classicMapStudioMapProps/);
    assert.match(ownerPageSource, /mapStudioLayoutSignature/);
});

test('sharing publishes only the selected persisted view and blocks unsaved owner state', () => {
    assert.match(ownerPageSource, /mapStudioRuntimeSnapshot\?\.ownerDirty \|\| mapStudioRuntimeSnapshot\?\.designDirty/);
    assert.match(ownerPageSource, /t\('mapStudioSaveBeforeShare'\)/);
    assert.match(ownerPageSource, /await printAnnotations\.flushPendingChanges\(\)/);
    assert.match(ownerPageSource, /typeof options\?\.includeAnnotations === 'boolean'/);
    assert.match(ownerPageSource, /isShared: options\.includeAnnotations/);
    assert.match(ownerPageSource, /if \(!annotationsReadyForShare\)[\s\S]*setShareError\(t\('failedPublishShare'\)\)[\s\S]*return false;/);
    assert.match(ownerPageSource, /await printAnnotations\.flushPendingChanges\(\)[\s\S]*await api\.publishMyMapShare/);
    assert.match(ownerPageSource, /\{ studioViewId: mapStudioRuntimeSnapshot\.activeViewId \}/);
    assert.match(ownerPageSource, /await loadMap\(\);[\s\S]*return true;/);
    assert.match(ownerPageSource, /setShareError\(err\.message \|\| t\('failedPublishShare'\)\);[\s\S]*return false;/);
    assert.match(ownerStateSource, /documentRevision: Number\(state\.persistedDocument\.revision\) \|\| 0/);
});

test('the owner panel is additive to both My Map layouts and remains outside Print View', () => {
    assert.match(ownerPageSource, /import MapStudioViewsPanel from '\.\.\/components\/MapStudioViewsPanel\.jsx';/);
    assert.match(ownerPageSource, /const ownerMapStudioPanel = \(/);
    assert.match(ownerPageSource, /studioPanel=\{ownerMapStudioPanel\}/);
    assert.match(v2ScaffoldSource, /studioPanel = null/);
    assert.match(v2ScaffoldSource, /\{studioPanel\}/);

    const printBranch = ownerPageSource.slice(
        ownerPageSource.indexOf('if (isPrintView) {'),
        ownerPageSource.indexOf('if (isV2View) {'),
    );
    assert.doesNotMatch(printBranch, /ownerMapStudioPanel|MapStudioViewsPanel/);
    assert.doesNotMatch(panelSource, /DirectoryMap|DirectoryPrintView|printMapState/);
});

test('shared and embedded map routes do not import or render private Map Studio controls', () => {
    assert.doesNotMatch(sharedMapSource, /MapStudioViewsPanel|getMyMapStudio|updateMyMapStudio/);
    assert.doesNotMatch(embeddedMapSource, /MapStudioViewsPanel|getMyMapStudio|updateMyMapStudio/);
});
