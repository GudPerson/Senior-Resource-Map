import test from 'node:test';
import assert from 'node:assert/strict';
import { updateMatchingSavedSelection } from '../src/lib/manageMapSavedSelection.js';

const west = { resourceType: 'hard', resourceId: 1, name: 'West Hall', address: 'West' };
const east = { resourceType: 'hard', resourceId: 2, name: 'East Hall', address: 'East' };
const annex = { ...east, resourceId: 3, name: 'Annex' };
const group = { resourceType: 'group', resourceId: 1 };
const offering = { resourceType: 'soft', resourceId: 1, hostHardAssetIds: [1, 999], address: 'East' };
const neighbour = { resourceType: 'soft', resourceId: 2, address: '  East  ' };
const saved = [west, east, annex, group, offering, neighbour];

test('checking matching offerings adds only available implied hosts, respecting explicit ID precedence', () => {
    const current = new Set(['group-9']);
    assert.deepEqual(updateMatchingSavedSelection(current, [offering, group], saved, true), {
        selectedKeys: new Set(['group-9', 'soft-1', 'group-1', 'hard-1']), retainedHostNames: [],
    });
    assert.deepEqual(updateMatchingSavedSelection(current, [neighbour], saved, true).selectedKeys,
        new Set(['group-9', 'soft-2', 'hard-2', 'hard-3']));
    const single = { ...offering, hostHardAssetIds: undefined, hostHardAssetId: 2 };
    assert.deepEqual(updateMatchingSavedSelection(current, [single], [...saved, single], true).selectedKeys,
        new Set(['group-9', 'soft-1', 'hard-2']));
    assert.deepEqual(current, new Set(['group-9']));
});

test('clearing places retained by a hidden offering gives feedback for protected matching places', () => {
    const current = new Set(['soft-2', 'hard-2', 'hard-3', 'group-1', 'hard-99']);
    assert.deepEqual(updateMatchingSavedSelection(current, [east, group], saved, false), {
        selectedKeys: new Set(['soft-2', 'hard-2', 'hard-3', 'hard-99']), retainedHostNames: ['East Hall'],
    });
});

test('clearing an offering and its only host together removes both and leaves all outside keys', () => {
    assert.deepEqual(updateMatchingSavedSelection(new Set(['hard-1', 'soft-1', 'group-1']), [west, offering], saved, false), {
        selectedKeys: new Set(['group-1']), retainedHostNames: [],
    });
});

test('clearing matches retains only already-selected places even for older incomplete memberships', () => {
    const current = new Set(['soft-2', 'group-1']);
    assert.deepEqual(updateMatchingSavedSelection(current, [east, group], saved, false), {
        selectedKeys: new Set(['soft-2']), retainedHostNames: [],
    });
});
