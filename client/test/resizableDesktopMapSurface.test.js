import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    DESKTOP_MAP_HEIGHT_EXPANDED_MAX_PX,
    clampDesktopMapHeight,
    getDesktopMapHeightBounds,
    getDesktopMapStudioHeightBounds,
    resolveDesktopMapStudioHeightPreset,
} from '../src/lib/resizableMapFrame.js';
import { PRINT_MAP_FULL_PAGE_MAX_HEIGHT_PX } from '../src/lib/printMapState.js';

const resizableSurfaceSource = readFileSync(
    new URL('../src/components/ResizableDesktopMapSurface.jsx', import.meta.url),
    'utf8',
);
const directoryMapSource = readFileSync(
    new URL('../src/components/DirectoryMap.jsx', import.meta.url),
    'utf8',
);
const ownerScaffoldSource = readFileSync(
    new URL('../src/components/MyMapV2PreviewScaffold.jsx', import.meta.url),
    'utf8',
);
const directoryListSource = readFileSync(
    new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url),
    'utf8',
);

test('desktop map height bounds preserve the current frame and match the approved Export View ceiling', () => {
    assert.deepEqual(getDesktopMapHeightBounds(1000), {
        minimumHeight: 480,
        defaultHeight: 480,
        maximumHeight: 1440,
    });
    assert.deepEqual(getDesktopMapHeightBounds(768), {
        minimumHeight: 440,
        defaultHeight: 440,
        maximumHeight: 1440,
    });
    assert.deepEqual(getDesktopMapHeightBounds(1400), {
        minimumHeight: 672,
        defaultHeight: 672,
        maximumHeight: 1440,
    });
    assert.equal(DESKTOP_MAP_HEIGHT_EXPANDED_MAX_PX, PRINT_MAP_FULL_PAGE_MAX_HEIGHT_PX);
});

test('desktop map height stays within the resize bounds', () => {
    const bounds = getDesktopMapHeightBounds(1000);
    assert.equal(clampDesktopMapHeight(200, bounds), 480);
    assert.equal(clampDesktopMapHeight(620.4, bounds), 620);
    assert.equal(clampDesktopMapHeight(1200, bounds), 1200);
    assert.equal(clampDesktopMapHeight(2000, bounds), 1440);
});

test('Map Studio keeps existing preset start heights while every layout can extend to Export height', () => {
    const bounds = getDesktopMapStudioHeightBounds(1000);
    assert.deepEqual(bounds, {
        minimumHeight: 380,
        compactHeight: 380,
        defaultHeight: 480,
        maximumHeight: 1440,
        tallHeight: 920,
    });
    assert.equal(resolveDesktopMapStudioHeightPreset('compact', bounds), 380);
    assert.equal(resolveDesktopMapStudioHeightPreset('standard', bounds), 480);
    assert.equal(resolveDesktopMapStudioHeightPreset('tall', bounds), 920);
    assert.equal(getDesktopMapHeightBounds(1000).minimumHeight, 480);
});

test('Balanced, Map focus, and Full map all use the shared desktop extender endpoint', () => {
    assert.match(ownerScaffoldSource, /renderDesktopMap=\{\(\) => \([\s\S]*<ResizableDesktopMapSurface/);
    assert.match(directoryListSource, /interactiveLayoutPreset === 'map-focus'[\s\S]*renderDesktopMap\(\)/);
    assert.match(directoryListSource, /interactiveLayoutPreset === 'full-map'[\s\S]*renderDesktopMap\(\)/);
    assert.ok(
        (directoryListSource.match(/renderDesktopMap\(\)/g) || []).length >= 3,
        'every desktop layout branch should call the same map renderer',
    );
});

test('desktop resize handle supports pointer, keyboard, reset, and map callback continuity', () => {
    assert.match(resizableSurfaceSource, /role="separator"/);
    assert.match(resizableSurfaceSource, /aria-valuemin=\{bounds\.minimumHeight\}/);
    assert.match(resizableSurfaceSource, /aria-valuemax=\{bounds\.maximumHeight\}/);
    assert.match(resizableSurfaceSource, /aria-valuenow=\{height\}/);
    assert.match(resizableSurfaceSource, /setPointerCapture\(event\.pointerId\)/);
    assert.match(resizableSurfaceSource, /event\.key === 'ArrowDown'/);
    assert.match(resizableSurfaceSource, /event\.key === 'ArrowUp'/);
    assert.match(resizableSurfaceSource, /event\.key === 'Home'/);
    assert.match(resizableSurfaceSource, /event\.key === 'End'/);
    assert.match(resizableSurfaceSource, /onDoubleClick=\{resetHeight\}/);
    assert.match(resizableSurfaceSource, /observeFrameResize: true/);
    assert.match(resizableSurfaceSource, /onClusterChange,/);
    assert.match(resizableSurfaceSource, /data-map-resize-handle="true"/);
    assert.match(resizableSurfaceSource, /heightPreset = null/);
    assert.match(resizableSurfaceSource, /heightResetKey = ''/);
    assert.match(resizableSurfaceSource, /initialHeightPx = null/);
    assert.match(resizableSurfaceSource, /onHeightCommit = null/);
    assert.match(resizableSurfaceSource, /lastReportedHeightRef = useRef\(null\)/);
    assert.match(resizableSurfaceSource, /lastReportedHeightRef\.current = null;[\s\S]*reportHeight\(\)/);
    assert.match(resizableSurfaceSource, /lastReportedHeightRef\.current === resolvedHeight/);
    assert.match(resizableSurfaceSource, /onHeightCommitRef\.current\(resolvedHeight\)/);
    assert.match(resizableSurfaceSource, /const nextHeight = applyHeight\(Number\.isFinite\(suppliedHeight\)/);
    assert.match(resizableSurfaceSource, /reportHeight\(nextHeight\)/);
    assert.match(resizableSurfaceSource, /const nextHeight = applyHeight\(heightRef\.current\)/);
    assert.match(resizableSurfaceSource, /\[heightPreset, heightResetKey, initialHeightPx\]/);
    assert.match(resizableSurfaceSource, /resolveDesktopMapStudioHeightPreset/);
});

test('DirectoryMap frame resize sync is opt-in and preserves the current camera', () => {
    assert.match(directoryMapSource, /observeFrameResize = false/);
    assert.match(directoryMapSource, /typeof ResizeObserver === 'undefined'/);
    assert.match(directoryMapSource, /observer\.observe\(frame\)/);
    assert.match(directoryMapSource, /map\.invalidateSize\(\{ animate: false, pan: false \}\)/);
    assert.match(directoryMapSource, /enabled=\{observeFrameResize\}/);
});
