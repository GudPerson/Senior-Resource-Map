import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseFixedTownOverviewAtRequestedScale } from '../src/lib/fixedTownZoomRecovery.js';
import { createOwnerPrintMapState, buildPrintMapCaptureKey } from '../src/lib/printMapState.js';

const bounds = [103.70, 1.30, 103.80, 1.40];
const viewportBounds = [103.72, 1.32, 103.78, 1.38];
const manifest = (count, size) => ({
    bounds: { surface: bounds },
    chunks: Array.from({ length: count }, (_, id) => ({ id, bounds, pixelSize: [size, size] })),
});
const input = {
    enabled: true,
    nativeManifest: manifest(5, 4096),
    overviewManifest: manifest(1, 1024),
    viewportBounds,
};

test('requested-scale recovery uses overview only when native exceeds the existing budget', () => {
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale(input), true);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, enabled: false }), false);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, nativeManifest: manifest(1, 4096) }), false);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, maxDecodedBytes: 384 * 1024 * 1024 }), false);
});

test('overview recovery is fail closed for missing coverage, missing overview, and excessive overview memory', () => {
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, overviewManifest: null }), false);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, viewportBounds: [103, 1, 104, 2] }), false);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, overviewManifest: manifest(5, 4096) }), false);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, viewportBounds: null }), false);
});

test('an exact native budget boundary remains native and a larger next footprint recovers', () => {
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, nativeManifest: manifest(4, 4096) }), false);
    assert.equal(shouldUseFixedTownOverviewAtRequestedScale({ ...input, nativeManifest: manifest(5, 4096) }), true);
});

test('a shared requested-scale change invalidates hidden capture readiness without changing the camera', () => {
    const state = createOwnerPrintMapState('default');
    assert.notEqual(buildPrintMapCaptureKey(state), buildPrintMapCaptureKey({ ...state, preserveRequestedMapScale: true }));
    assert.equal(state.preserveRequestedMapScale, undefined);
});
