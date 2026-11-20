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

test('sparse selection checks only selected keys in a prepared result set', () => {
    let probes = 0;
    class CountedSet extends Set {
        has(key) { probes++; return super.has(key); }
    }
    const matches = new CountedSet(Array.from({ length: 1000 }, (_, i) => i));
    const selected = new CountedSet([42, 'off-filter']);
    assert.deepEqual(getMatchingSelectionState(selected, matches), {
        matchingCount: 1000, selectedMatchingCount: 1, checked: false, mixed: true,
    });
    assert.equal(probes, selected.size);
});
