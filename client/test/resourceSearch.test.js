import test from 'node:test';
import assert from 'node:assert/strict';

import {
    matchesResourceSearchGroups,
    parseResourceSearchGroups,
} from '../src/lib/resourceSearch.js';

test('Manage Resources search parses comma as AND and slash as OR', () => {
    assert.deepEqual(parseResourceSearchGroups('rn, rc / aac'), [
        ['rn', 'rc'],
        ['aac'],
    ]);
});

test('Manage Resources search matches any slash group only when all comma phrases match', () => {
    const groups = parseResourceSearchGroups('rn, rc / aac');

    assert.equal(matchesResourceSearchGroups([
        'Fernvale RC RN',
        'Residents Network',
    ], groups), true);
    assert.equal(matchesResourceSearchGroups([
        'FRCS AAC',
        'Community programme',
    ], groups), true);
    assert.equal(matchesResourceSearchGroups([
        'Residents Network',
        'Community club',
    ], groups), false);
});
