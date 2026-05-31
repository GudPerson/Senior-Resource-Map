import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRefitDirectoryCameraAfterResize } from '../src/lib/directoryMapCamera.js';

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

test('directory map does not refit while a cluster selection is active', () => {
    assert.equal(shouldRefitDirectoryCameraAfterResize({
        previousLayoutSignature: 'mobile-map-expanded',
        nextLayoutSignature: 'mobile-map-collapsed',
        pointCount: 12,
        hasActivePlaceKeys: true,
    }), false);
});
