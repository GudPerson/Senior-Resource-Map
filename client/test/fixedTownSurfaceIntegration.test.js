import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const directoryMapSource = await readFile(
    new URL('../src/components/DirectoryMap.jsx', import.meta.url),
    'utf8',
);
const fixedTownSurfaceSource = await readFile(
    new URL('../src/components/FixedTownSurfaceLayer.jsx', import.meta.url),
    'utf8',
);
const townMapControlSource = await readFile(
    new URL('../src/components/TownMapModeControl.jsx', import.meta.url),
    'utf8',
);
const zoomLevelControlSource = await readFile(
    new URL('../src/components/DirectoryMapZoomLevelControl.jsx', import.meta.url),
    'utf8',
);
const ownerPageSource = await readFile(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const ownerScaffoldSource = await readFile(
    new URL('../src/components/MyMapV2PreviewScaffold.jsx', import.meta.url),
    'utf8',
);
const sharedMapPageSource = await readFile(
    new URL('../src/pages/SharedMapPage.jsx', import.meta.url),
    'utf8',
);
const discoveryMapSource = await readFile(
    new URL('../src/features/discover/DiscoveryMap.jsx', import.meta.url),
    'utf8',
);

test('directory map keeps Live as the default and resolves Town locally from settled zoom', () => {
    assert.match(directoryMapSource, /basemapMode = 'live'/);
    assert.match(directoryMapSource, /resolveFixedTownBasemapMode\(/);
    assert.match(directoryMapSource, /function DirectoryMapZoomSync/);
    assert.match(directoryMapSource, /normalizeFixedTownStandardZoom/);
    assert.match(directoryMapSource, /normalizeStandardZoomBelow=\{shouldGateTownRequestedLiveTiles/);
    assert.match(directoryMapSource, /map\.setView\(map\.getCenter\(\), normalizedZoom, \{ animate: false \}\)/);
    assert.match(directoryMapSource, /map\.on\('zoom', handleZoom\)/);
    assert.match(directoryMapSource, /map\.on\('zoomend', handleZoomEnd\)/);
    assert.match(directoryMapSource, /effectiveBasemapMode === 'town' \? \(/);
    assert.match(directoryMapSource, /typeof mapModeControl === 'function'/);
    assert.match(directoryMapSource, /configuredFixedTownSurfaceAvailable/);
    assert.match(directoryMapSource, /fixedTownManualLiveOverride/);
    assert.match(directoryMapSource, /else if \(townMapZoomEligible\)/);
    assert.match(directoryMapSource, /if \(!townMapZoomEligible\)/);
    assert.match(directoryMapSource, /fixedTownSurfaceFallbackScope === 'local'/);
    assert.match(directoryMapSource, /<FixedTownSurfaceLayer/);
    assert.match(directoryMapSource, /\) : \(\s*<TileLayer/);
    assert.match(directoryMapSource, /basemapUrl = CAREAROUND_BASEMAP_URL/);
    assert.match(directoryMapSource, /\['auto', 'town'\]\.includes\(fixedTownBasemapPreference\)/);
    assert.match(directoryMapSource, /town-request-live-gated/);
    assert.match(directoryMapSource, /:\$\{basemapUrl\}/);
    assert.match(directoryMapSource, /maxZoom=\{shouldGateTownRequestedLiveTiles/);
    assert.match(directoryMapSource, /fixedTownSurfaceFaultReason === 'viewport-memory-limit'/);
    assert.match(directoryMapSource, /currentTileZoom > fixedTownSurfaceFaultTileZoomRef\.current/);
    assert.match(directoryMapSource, /<DirectoryMapController/);
    assert.match(directoryMapSource, /<DirectoryMapRecenterControl/);
    assert.match(directoryMapSource, /mapMinZoom = CAREAROUND_BASEMAP_MIN_ZOOM/);
    assert.match(directoryMapSource, /showZoomLevelCounter = false/);
    assert.match(directoryMapSource, /minimumZoomCenter = null/);
    assert.match(directoryMapSource, /lockMinimumZoomCamera = false/);
    assert.match(directoryMapSource, /minZoom=\{resolvedMapMinZoom\}/);
    assert.match(directoryMapSource, /url=\{basemapUrl\}/);
    assert.match(directoryMapSource, /<DirectoryMapZoomLevelControl/);
    assert.doesNotMatch(directoryMapSource, /<MapContainer[^>]*key=/s);
});

test('owner proof zoom counter sits above native controls and recenters only at its minimum step', () => {
    assert.match(zoomLevelControlSource, /data-map-zoom-level/);
    assert.match(zoomLevelControlSource, /zoomControlContainer\.insertBefore\(counter, zoomControlContainer\.firstChild\)/);
    assert.match(zoomLevelControlSource, /Math\.round\(Number\(map\.getZoom\(\)\)\)/);
    assert.match(zoomLevelControlSource, /map\.on\('zoom', updateCounter\)/);
    assert.match(zoomLevelControlSource, /map\.on\('zoomend', handleZoomEnd\)/);
    assert.match(zoomLevelControlSource, /map\.on\('moveend', handleMoveEnd\)/);
    assert.match(zoomLevelControlSource, /shouldCenterDirectoryMapAtMinimumZoom/);
    assert.match(zoomLevelControlSource, /map\.dragging\.disable\(\)/);
    assert.match(zoomLevelControlSource, /map\.dragging\?\.enable\?\.\(\)/);
    assert.match(zoomLevelControlSource, /minimumCenterCorrectionInProgress/);
    assert.match(zoomLevelControlSource, /currentCenterPoint\.distanceTo\(minimumCenterPoint\) <= 1/);
    assert.match(zoomLevelControlSource, /map\.panTo\(\[minimumCenter\.lat, minimumCenter\.lng\], \{ animate: false \}\)/);
});

test('fixed town surface culls chunks and removes overlays without becoming a tile pyramid', () => {
    assert.match(fixedTownSurfaceSource, /FIXED_TOWN_SURFACE_MIN_ZOOM = 15/);
    assert.match(fixedTownSurfaceSource, /selectVisibleFixedTownChunks\(manifest\.chunks, viewportBounds\)/);
    assert.match(fixedTownSurfaceSource, /map\.removeLayer\(entry\.overlay\)/);
    assert.match(fixedTownSurfaceSource, /map\.removeLayer\(entry\.overlay\);\s*entry\.overlay\.off\(\)/);
    assert.match(fixedTownSurfaceSource, /FIXED_TOWN_SURFACE_RETENTION_PAD = 0\.5/);
    assert.match(fixedTownSurfaceSource, /FIXED_TOWN_SURFACE_MAX_DECODED_BYTES = 256 \* 1024 \* 1024/);
    assert.match(fixedTownSurfaceSource, /zoom <= townMinZoom \+ FIXED_TOWN_SURFACE_LOW_ZOOM_RANGE/);
    assert.match(fixedTownSurfaceSource, /getViewportBounds\(map, retentionPad\)/);
    assert.match(fixedTownSurfaceSource, /getDecodedBytes\(paddedChunks\)/);
    assert.match(fixedTownSurfaceSource, /const nextActiveChunks = new Map/);
    assert.match(fixedTownSurfaceSource, /getDecodedBytes\(\[\.\.\.nextActiveChunks\.values\(\)\]\)/);
    assert.match(fixedTownSurfaceSource, /map\.on\('move zoom', handleMapMove\)/);
    assert.match(fixedTownSurfaceSource, /map\.on\('zoomstart', handleMapZoomStart\)/);
    assert.match(fixedTownSurfaceSource, /map\.on\('zoomend', handleMapZoomEnd\)/);
    assert.match(fixedTownSurfaceSource, /map\.on\('resize', handleMapResize\)/);
    assert.match(fixedTownSurfaceSource, /if \(pruneOffscreen\)/);
    assert.match(fixedTownSurfaceSource, /FIXED_TOWN_SURFACE_PRUNE_SETTLE_MS = 180/);
    assert.match(fixedTownSurfaceSource, /map\.setMinZoom\(townMinZoom\)/);
    assert.match(fixedTownSurfaceSource, /map\.setView\(map\.getCenter\(\), townMinZoom/);
    assert.match(fixedTownSurfaceSource, /if \(lockMinZoom\)/);
    assert.match(fixedTownSurfaceSource, /if \(fallbackBelowMinZoom\)/);
    assert.match(fixedTownSurfaceSource, /overlayElement\.style\.filter = 'grayscale\(1\)'/);
    assert.match(fixedTownSurfaceSource, /L\.imageOverlay\(/);
    assert.doesNotMatch(fixedTownSurfaceSource, /TileLayer|GridLayer|\/\{z\}\/\{x\}\/\{y\}/);
    assert.match(fixedTownSurfaceSource, /map\.attributionControl\.addAttribution\(attribution\)/);
    assert.match(fixedTownSurfaceSource, /fallback\('zoom-too-low'/);
    assert.match(fixedTownSurfaceSource, /fallback\('chunk-load-error'/);
});

test('town map proof is owner-only, local-flagged, and keeps full owner coverage for fallback', () => {
    assert.match(ownerPageSource, /VITE_TOWN_MAP_PROOF_ENABLED/);
    assert.match(ownerPageSource, /VITE_TOWN_MAP_ASSET_BASE_URL/);
    assert.match(ownerPageSource, /VITE_TOWN_MAP_GRAYSCALE/);
    assert.match(ownerPageSource, /VITE_TOWN_MAP_GRAYSCALE === 'true'/);
    assert.match(ownerPageSource, /CAREAROUND_DEFAULT_BASEMAP_URL/);
    assert.match(ownerPageSource, /mapMinZoom=\{TOWN_MAP_PROOF_ENABLED \? CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM : undefined\}/);
    assert.match(ownerPageSource, /showZoomLevelCounter=\{TOWN_MAP_PROOF_ENABLED\}/);
    assert.match(ownerPageSource, /minimumZoomCenter=\{TOWN_MAP_PROOF_ENABLED \? TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER : null\}/);
    assert.match(ownerPageSource, /TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER = \[1\.3521, 103\.846\]/);
    assert.match(ownerPageSource, /lockMinimumZoomCamera=\{TOWN_MAP_PROOF_ENABLED\}/);
    assert.match(ownerPageSource, /preserveMobileMapFrameInFlow=\{TOWN_MAP_PROOF_ENABLED\}/);
    assert.match(ownerPageSource, /resolveFixedTownManifestUrl\(TOWN_MAP_ASSET_BASE_URL\)/);
    assert.match(ownerPageSource, /buildDirectoryPresentation\(directory, \{ activeAnchor, presentationMode: 'v2-cards' \}\)/);
    assert.match(ownerPageSource, /isPointWithinWsenBounds\(point, nominalBounds\)/);
    assert.match(ownerPageSource, /setBasemapMode\('live'\)/);
    assert.match(ownerPageSource, /setBasemapMode\('auto'\)/);
    assert.match(ownerPageSource, /const mapModeControl = TOWN_MAP_PROOF_ENABLED \? renderTownMapModeControl : null/);
    assert.match(ownerPageSource, /townMapFallbackReason !== 'outside-coverage'/);
    assert.match(ownerPageSource, /onFixedTownSurfaceFallback=\{handleFixedTownSurfaceFallback\}/);
    assert.match(ownerScaffoldSource, /basemapMode=\{basemapMode\}/);
    assert.match(ownerScaffoldSource, /fixedTownSurfaceAvailable=\{fixedTownSurfaceAvailable\}/);
    assert.match(ownerPageSource, /fixedTownSurfaceLockMinZoom=\{false\}/);
    assert.match(ownerPageSource, /fixedTownSurfaceFallbackBelowMinZoom=\{false\}/);
    assert.match(ownerPageSource, /fixedTownSurfaceFallbackScope="local"/);
    assert.match(ownerPageSource, /onBasemapModeChange=\{handleBasemapModeChange\}/);
    assert.doesNotMatch(sharedMapPageSource, /fixedTownSurface|TownMapModeControl|VITE_TOWN_MAP/);
    assert.doesNotMatch(discoveryMapSource, /fixedTownSurface|TownMapModeControl|VITE_TOWN_MAP/);
});

test('owner mode control uses compact layman labels and aligns automatic guidance in one row', () => {
    assert.match(townMapControlSource, /aria-label="Map style"/);
    assert.match(townMapControlSource, />\s*Standard\s*</);
    assert.match(townMapControlSource, />\s*Detailed\s*</);
    assert.match(townMapControlSource, /flex-nowrap items-center/);
    assert.match(townMapControlSource, /compactStatusMessage/);
    assert.match(ownerPageSource, /Zoom in to level.*Detailed map will turn on automatically/);
    assert.match(ownerPageSource, /Zoom in to.*for Detailed/);
    assert.doesNotMatch(townMapControlSource, /easy[- ]read/i);
    assert.doesNotMatch(ownerPageSource, /easy[- ]read/i);
    assert.match(townMapControlSource, /aria-disabled=\{!townAvailable\}/);
    assert.match(townMapControlSource, /onClick=\{handleLiveSelect\}/);
    assert.match(townMapControlSource, /onClick=\{handleTownSelect\}/);
    assert.match(townMapControlSource, /setShowTownUnavailableMessage\(Boolean\(townUnavailableMessage\)\)/);
    assert.match(townMapControlSource, /aria-live="polite"/);
    assert.doesNotMatch(townMapControlSource, /\sdisabled=\{!townAvailable\}/);
    assert.match(townMapControlSource, /aria-pressed=\{mode === 'town'\}/);
});
