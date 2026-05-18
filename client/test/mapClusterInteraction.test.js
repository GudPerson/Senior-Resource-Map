import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildClusterToken,
    getClusterActivationAction,
    getNextClusterZoom,
    isDuplicateClusterClick,
    shouldIgnoreClusterHover,
} from '../src/lib/mapClusterInteraction.js';

test('getClusterActivationAction selects a new cluster before zooming it', () => {
    const clusterKeys = ['place-8-a', 'place-8-b', 'place-8-c'];

    assert.equal(getClusterActivationAction(clusterKeys, []), 'select');
    assert.equal(getClusterActivationAction(clusterKeys, ['place-8-c', 'place-8-a', 'place-8-b']), 'zoom');
    assert.equal(getClusterActivationAction(clusterKeys, [], buildClusterToken(clusterKeys)), 'zoom');
    assert.equal(getClusterActivationAction(clusterKeys, ['place-9']), 'select');
});

test('isDuplicateClusterClick ignores only the click that follows the same tap mousedown', () => {
    const token = buildClusterToken(['place-8-a', 'place-8-b']);
    const lastMousedown = { token, eventType: 'clustermousedown', at: 1000 };

    assert.equal(isDuplicateClusterClick({
        eventType: 'clusterclick',
        token,
        now: 1120,
        lastEvent: lastMousedown,
    }), true);

    assert.equal(isDuplicateClusterClick({
        eventType: 'clustermousedown',
        token,
        now: 1120,
        lastEvent: lastMousedown,
    }), false);

    assert.equal(isDuplicateClusterClick({
        eventType: 'clusterclick',
        token,
        now: 1500,
        lastEvent: lastMousedown,
    }), false);
});

test('shouldIgnoreClusterHover treats touch-first devices as tap driven', () => {
    assert.equal(shouldIgnoreClusterHover({ coarsePointer: true }), true);
    assert.equal(shouldIgnoreClusterHover({ pointerType: 'touch' }), true);
    assert.equal(shouldIgnoreClusterHover({ pointerType: 'mouse', coarsePointer: false }), false);
});

test('getNextClusterZoom moves to the next zoom level without exceeding max', () => {
    assert.equal(getNextClusterZoom(10.7, 16), 12);
    assert.equal(getNextClusterZoom(11, 16), 12);
    assert.equal(getNextClusterZoom(15.4, 16), 16);
    assert.equal(getNextClusterZoom(16, 16), 16);
});
