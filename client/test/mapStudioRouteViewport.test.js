import test from 'node:test';
import assert from 'node:assert/strict';

import {
    patchMapStudioRouteViewport,
    resolveMapStudioRouteViewport,
} from '../src/lib/mapStudioRouteViewport.js';

test('route viewport keeps temporary camera and committed height for the active map view', () => {
    const context = { mapId: 258, viewId: 'view-default', heightPreset: 'tall' };
    const cameraView = { center: [1.3345, 103.7432], zoom: 15 };
    const withCamera = patchMapStudioRouteViewport(null, context, { cameraView });
    const viewport = patchMapStudioRouteViewport(withCamera, context, { heightPx: 910.4 });

    assert.deepEqual(resolveMapStudioRouteViewport(viewport, context), {
        cameraView,
        heightPx: 910,
    });
    assert.notEqual(viewport.cameraView, cameraView);
});

test('route viewport never leaks camera or height into another map or named view', () => {
    const current = patchMapStudioRouteViewport(
        null,
        { mapId: 258, viewId: 'view-default', heightPreset: 'tall' },
        {
            cameraView: { center: [1.3345, 103.7432], zoom: 15 },
            heightPx: 900,
        },
    );

    assert.deepEqual(resolveMapStudioRouteViewport(current, {
        mapId: 258,
        viewId: 'view-secondary',
        heightPreset: 'tall',
    }), { cameraView: null, heightPx: null });
    assert.deepEqual(resolveMapStudioRouteViewport(current, {
        mapId: 259,
        viewId: 'view-default',
        heightPreset: 'tall',
    }), { cameraView: null, heightPx: null });
});

test('a layout height preset change resets only manual height and keeps the live camera', () => {
    const current = patchMapStudioRouteViewport(
        null,
        { mapId: 258, viewId: 'view-default', heightPreset: 'tall' },
        {
            cameraView: { center: [1.3345, 103.7432], zoom: 15 },
            heightPx: 900,
        },
    );

    assert.deepEqual(resolveMapStudioRouteViewport(current, {
        mapId: 258,
        viewId: 'view-default',
        heightPreset: 'standard',
    }), {
        cameraView: { center: [1.3345, 103.7432], zoom: 15 },
        heightPx: null,
    });
});

test('route viewport rejects out-of-range camera data before it reaches Leaflet', () => {
    const context = { mapId: 258, viewId: 'view-default', heightPreset: 'standard' };
    const viewport = patchMapStudioRouteViewport(null, context, {
        cameraView: { center: [999, 999], zoom: 99 },
    });

    assert.deepEqual(resolveMapStudioRouteViewport(viewport, context), {
        cameraView: null,
        heightPx: null,
    });
});
