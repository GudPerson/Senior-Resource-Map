import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    getFocusedDirectoryCameraPins,
    shouldCenterDirectoryMapAtMinimumZoom,
    shouldRefitDirectoryCameraAfterResize,
} from '../src/lib/directoryMapCamera.js';

const directoryMapSource = readFileSync(
    new URL('../src/components/DirectoryMap.jsx', import.meta.url),
    'utf8',
);

test('directory map refits when mobile collapse changes the map layout size', () => {
    assert.equal(shouldRefitDirectoryCameraAfterResize({
        previousLayoutSignature: 'mobile-map-expanded',
        nextLayoutSignature: 'mobile-map-collapsed',
        pointCount: 12,
    }), true);
});

test('directory map does not refit an active focused pin after resize', () => {
    assert.equal(shouldRefitDirectoryCameraAfterResize({
        previousLayoutSignature: 'mobile-map-collapsed',
        nextLayoutSignature: 'mobile-map-expanded',
        pointCount: 12,
        focusedPlaceKey: 'hard:123:zoom',
    }), false);
});

test('directory map does not refit an active focused pin group after resize', () => {
    assert.equal(shouldRefitDirectoryCameraAfterResize({
        previousLayoutSignature: 'mobile-map-collapsed',
        nextLayoutSignature: 'mobile-map-expanded',
        pointCount: 12,
        focusedPlaceKeys: ['hard-10', 'hard-20'],
    }), false);
});

test('directory map resolves focused pin groups to mapped pins only', () => {
    const focusedPins = getFocusedDirectoryCameraPins([
        { placeKey: 'hard-10', lat: 1.321, lng: 103.841 },
        { placeKey: 'postal-group:200200', memberPlaceKeys: ['hard-20', 'hard-30'], lat: 1.322, lng: 103.842 },
        { placeKey: 'hard-40', lat: null, lng: null },
    ], ['hard-10', 'hard-20', 'hard-404']);

    assert.deepEqual(focusedPins.map((pin) => pin.placeKey), ['hard-10', 'postal-group:200200']);
});

test('directory map does not refit while a cluster selection is active', () => {
    assert.equal(shouldRefitDirectoryCameraAfterResize({
        previousLayoutSignature: 'mobile-map-expanded',
        nextLayoutSignature: 'mobile-map-collapsed',
        pointCount: 12,
        hasActivePlaceKeys: true,
    }), false);
});

test('directory map keeps hooks stable when an empty map gains a distance anchor', () => {
    const componentSource = directoryMapSource.slice(
        directoryMapSource.indexOf('export default function DirectoryMap'),
    );
    const markerMemoIndex = componentSource.indexOf('const renderedMarkers = useMemo');
    const emptyMapReturnIndex = componentSource.indexOf('if (!pins.length && !anchorPoint && !onMapClick)');

    assert.ok(markerMemoIndex > 0, 'marker memo should exist');
    assert.ok(emptyMapReturnIndex > 0, 'empty-map return should exist');
    assert.ok(markerMemoIndex < emptyMapReturnIndex, 'empty-map return must not skip marker memo hooks');
});

test('owner proof recenters only when a settled zoom enters the configured minimum', () => {
    assert.equal(shouldCenterDirectoryMapAtMinimumZoom({
        previousZoom: 12,
        currentZoom: 11,
        minZoom: 11,
    }), true);
    assert.equal(shouldCenterDirectoryMapAtMinimumZoom({
        previousZoom: 11,
        currentZoom: 11,
        minZoom: 11,
    }), false);
    assert.equal(shouldCenterDirectoryMapAtMinimumZoom({
        previousZoom: 16,
        currentZoom: 15,
        minZoom: 11,
    }), false);
    assert.equal(shouldCenterDirectoryMapAtMinimumZoom({
        previousZoom: 11,
        currentZoom: 12,
        minZoom: 11,
    }), false);
    assert.equal(shouldCenterDirectoryMapAtMinimumZoom({
        previousZoom: 12,
        currentZoom: 11,
        minZoom: undefined,
    }), false);
    assert.equal(shouldCenterDirectoryMapAtMinimumZoom({
        previousZoom: undefined,
        currentZoom: 11,
        minZoom: 11,
    }), false);
});
