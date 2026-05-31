import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildClusterToken,
    getClusterActivationAction,
    getClusterCameraPlan,
    getClusterExpansionZoom,
    isDuplicateClusterClick,
    shouldIgnoreClusterHover,
} from '../src/lib/mapClusterInteraction.js';

test('getClusterActivationAction zooms every tapped cluster immediately', () => {
    const clusterKeys = ['place-8-a', 'place-8-b', 'place-8-c'];

    assert.equal(getClusterActivationAction(clusterKeys, []), 'zoom');
    assert.equal(getClusterActivationAction(clusterKeys, ['place-8-c', 'place-8-a', 'place-8-b']), 'zoom');
    assert.equal(getClusterActivationAction(clusterKeys, [], buildClusterToken(clusterKeys)), 'zoom');
    assert.equal(getClusterActivationAction(clusterKeys, ['place-9']), 'zoom');
    assert.equal(getClusterActivationAction([], ['place-9']), 'ignore');
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

test('getClusterExpansionZoom jumps far enough to reveal the next visible cluster layer', () => {
    assert.equal(getClusterExpansionZoom({ currentZoom: 10.7, childCount: 8, maxZoom: 16 }), 12);
    assert.equal(getClusterExpansionZoom({ currentZoom: 12, childCount: 8, maxZoom: 16 }), 14);
    assert.equal(getClusterExpansionZoom({ currentZoom: 12, childCount: 3, maxZoom: 16 }), 16);
    assert.equal(getClusterExpansionZoom({ currentZoom: 12, childCount: 2, maxZoom: 16 }), 16);
    assert.equal(getClusterExpansionZoom({ currentZoom: 13, maxZoom: 16 }), 15);
    assert.equal(getClusterExpansionZoom({ currentZoom: 15.4, maxZoom: 16 }), 16);
    assert.equal(getClusterExpansionZoom({ currentZoom: 16, maxZoom: 16 }), 16);
});

test('compact mobile cluster activation zooms before fitting child pins', () => {
    assert.deepEqual(getClusterCameraPlan({
        currentZoom: 13,
        targetZoom: 16,
        childCount: 8,
        mapHeight: 128,
    }), {
        mode: 'zoom-then-fit-child-bounds',
        maxZoom: 16,
    });
});
