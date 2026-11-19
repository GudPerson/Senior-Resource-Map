import test from 'node:test';
import assert from 'node:assert/strict';
import { getMatchingSelectionState, updateMatchingSelection } from '../src/lib/matchingSelection.js';

test('master reports unique matching keys and the selected intersection', () => {
    const selected = new Set(['a', 'hidden']);
    for (const [matches, matchingCount, selectedMatchingCount, checked, mixed] of [
        [[], 0, 0, false, false], [['b'], 1, 0, false, false], [['a'], 1, 1, true, false],
        [['a', 'b', 'a'], 2, 1, false, true],
    ]) {
        assert.deepEqual(getMatchingSelectionState(selected, matches), { matchingCount, selectedMatchingCount, checked, mixed });
    }
});

test('checking and clearing return independent sets with outside keys preserved', () => {
    const selected = new Set(['a', 'hidden']);
    assert.deepEqual(updateMatchingSelection(selected, ['a', 'b'], true), new Set(['a', 'hidden', 'b']));
    assert.deepEqual(updateMatchingSelection(selected, new Set(['a', 'b']), false), new Set(['hidden']));
    assert.notEqual(updateMatchingSelection(selected, [], true), selected);
    assert.deepEqual(selected, new Set(['a', 'hidden']));
});
