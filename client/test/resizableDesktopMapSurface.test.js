import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    clampDesktopMapHeight,
    getDesktopMapHeightBounds,
    getDesktopMapStudioHeightBounds,
    resolveDesktopMapStudioHeightPreset,
} from '../src/lib/resizableMapFrame.js';

const resizableSurfaceSource = readFileSync(
    new URL('../src/components/ResizableDesktopMapSurface.jsx', import.meta.url),
    'utf8',
);
const directoryMapSource = readFileSync(
    new URL('../src/components/DirectoryMap.jsx', import.meta.url),
    'utf8',
);

test('desktop map height bounds preserve the current frame and cap expansion to the viewport', () => {
    assert.deepEqual(getDesktopMapHeightBounds(1000), {
        minimumHeight: 480,
        defaultHeight: 480,
        maximumHeight: 780,
    });
    assert.deepEqual(getDesktopMapHeightBounds(768), {
        minimumHeight: 440,
        defaultHeight: 440,
        maximumHeight: 599,
    });
    assert.deepEqual(getDesktopMapHeightBounds(1400), {
        minimumHeight: 672,
        defaultHeight: 672,
        maximumHeight: 840,
    });
});

test('desktop map height stays within the resize bounds', () => {
    const bounds = getDesktopMapHeightBounds(1000);
    assert.equal(clampDesktopMapHeight(200, bounds), 480);
    assert.equal(clampDesktopMapHeight(620.4, bounds), 620);
    assert.equal(clampDesktopMapHeight(1200, bounds), 780);
});

test('Map Studio height presets extend the owner frame without changing legacy bounds', () => {
    const bounds = getDesktopMapStudioHeightBounds(1000);
    assert.deepEqual(bounds, {
        minimumHeight: 380,
        compactHeight: 380,
        defaultHeight: 480,
        maximumHeight: 780,
    });
    assert.equal(resolveDesktopMapStudioHeightPreset('compact', bounds), 380);
    assert.equal(resolveDesktopMapStudioHeightPreset('standard', bounds), 480);
    assert.equal(resolveDesktopMapStudioHeightPreset('tall', bounds), 780);
    assert.equal(getDesktopMapHeightBounds(1000).minimumHeight, 480);
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
    assert.match(resizableSurfaceSource, /\[heightPreset, heightResetKey\]/);
    assert.match(resizableSurfaceSource, /resolveDesktopMapStudioHeightPreset/);
});

test('DirectoryMap frame resize sync is opt-in and preserves the current camera', () => {
    assert.match(directoryMapSource, /observeFrameResize = false/);
    assert.match(directoryMapSource, /typeof ResizeObserver === 'undefined'/);
    assert.match(directoryMapSource, /observer\.observe\(frame\)/);
    assert.match(directoryMapSource, /map\.invalidateSize\(\{ animate: false, pan: false \}\)/);
    assert.match(directoryMapSource, /enabled=\{observeFrameResize\}/);
});
