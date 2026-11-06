import assert from 'node:assert/strict';
import test from 'node:test';
import { isOwnerMapSecondaryActivation } from '../src/lib/ownerMapMarkerActivation.js';

test('only opted-in owner secondary native activation is suppressed', () => {
    const secondary = { originalEvent: { button: 2 } };
    assert.equal(isOwnerMapSecondaryActivation(secondary, true), true);
    assert.equal(isOwnerMapSecondaryActivation(secondary, false), false);
    assert.equal(isOwnerMapSecondaryActivation(secondary), false);
    assert.equal(isOwnerMapSecondaryActivation({ originalEvent: { button: 0 } }, true), false);
    assert.equal(isOwnerMapSecondaryActivation({ originalEvent: { button: 1 } }, true), false);
});

test('keyboard/programmatic events preserve their existing activation behavior', () => {
    assert.equal(isOwnerMapSecondaryActivation({}, true), false);
    assert.equal(isOwnerMapSecondaryActivation({ originalEvent: { type: 'keydown' } }, true), false);
    assert.equal(isOwnerMapSecondaryActivation({ originalEvent: { button: -1 } }, true), false);
});
