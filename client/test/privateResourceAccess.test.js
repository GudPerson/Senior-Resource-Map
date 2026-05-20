import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PRIVATE_VIEWER_ALL_OPTION_VALUE,
    buildPrivateViewerOptions,
    resolvePrivateViewerUserIds,
} from '../src/lib/privateResourceAccess.js';

const candidates = [
    { id: 64, name: 'SR-CLW1', username: 'CCK1' },
    { id: 65, name: 'SR-CLW2', username: 'CCK2' },
    { id: 66, name: 'SR-CLW3', username: 'CCK3' },
];

test('buildPrivateViewerOptions includes an All option before eligible users', () => {
    assert.deepEqual(buildPrivateViewerOptions(candidates), [
        {
            value: PRIVATE_VIEWER_ALL_OPTION_VALUE,
            label: 'All eligible read-only viewers',
            isSelectAll: true,
        },
        { value: 64, label: 'SR-CLW1 (@CCK1)' },
        { value: 65, label: 'SR-CLW2 (@CCK2)' },
        { value: 66, label: 'SR-CLW3 (@CCK3)' },
    ]);
});

test('resolvePrivateViewerUserIds expands All into current eligible candidate ids', () => {
    assert.deepEqual(
        resolvePrivateViewerUserIds([
            { value: PRIVATE_VIEWER_ALL_OPTION_VALUE },
        ], candidates),
        [64, 65, 66],
    );
});

test('resolvePrivateViewerUserIds keeps explicit viewer choices explicit', () => {
    assert.deepEqual(
        resolvePrivateViewerUserIds([
            { value: 65 },
            { value: 66 },
        ], candidates),
        [65, 66],
    );
});
