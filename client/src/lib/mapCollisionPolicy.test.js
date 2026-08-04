import test from 'node:test';
import assert from 'node:assert/strict';

import { getCollisionPushDistances } from './mapCollisionPolicy.js';

test('collision spreading keeps a selected map pin fixed at its geographic anchor', () => {
    assert.deepEqual(getCollisionPushDistances({
        overlap: 18,
        leftMass: 1,
        rightMass: 3,
        leftFixed: true,
    }), {
        leftPush: 0,
        rightPush: 18,
    });

    assert.deepEqual(getCollisionPushDistances({
        overlap: 18,
        leftMass: 1,
        rightMass: 3,
        rightFixed: true,
    }), {
        leftPush: 18,
        rightPush: 0,
    });
});

test('collision spreading preserves weighted movement for unselected map pins', () => {
    assert.deepEqual(getCollisionPushDistances({
        overlap: 16,
        leftMass: 1,
        rightMass: 3,
    }), {
        leftPush: 12,
        rightPush: 4,
    });
});

test('collision spreading does not move either of two fixed map pins', () => {
    assert.deepEqual(getCollisionPushDistances({
        overlap: 20,
        leftMass: 1,
        rightMass: 1,
        leftFixed: true,
        rightFixed: true,
    }), {
        leftPush: 0,
        rightPush: 0,
    });
});
