import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegionalDiscoverySelection, regionalDiscoverySelectionReducer as reduce } from '../src/features/regional-discovery/regionalDiscoverySelection.js';
import { regionalDiscoveryMarkerEvent } from '../src/features/regional-discovery/regionalDiscoveryPresentation.js';

const one = { placeKeys: ['venue-a'], entryKeys: ['hard:101'] };
const group = { placeKeys: ['venue-a', 'venue-b'], entryKeys: ['hard:101', 'soft:201'] };
const initial = () => createRegionalDiscoverySelection();
test('leave_restores_list_immediately', () => {
    const hovered = reduce(initial(), { type: 'PIN_ENTER', ...one });
    assert.equal(hovered.pane, 'detail');
    const afterLeave = reduce(hovered, { type: 'PIN_LEAVE', ...one });
    assert.equal(afterLeave.pane, 'list');
    assert.equal(afterLeave.entryKey, null);
});
test('locked_detail_ignores_hover', () => {
    const locked = reduce(initial(), { type: 'PIN_ACTIVATE', ...one });
    assert.equal(locked.lock, 'detail');
    const afterOtherHover = reduce(locked, { type: 'PIN_ENTER', placeKeys: ['other'], entryKeys: ['soft:202'] });
    assert.equal(afterOtherHover.entryKey, locked.entryKey);
    assert.equal(reduce(locked, { type: 'PIN_LEAVE', ...one }), locked);
});
test('unplotted_view_service_opens_detail', () => {
    const detail = reduce(initial(), { type: 'VIEW_SERVICE', entryKey: 'soft:202', placeKeys: [] });
    assert.equal(detail.pane, 'detail');
    assert.equal(detail.entryKey, 'soft:202');
    assert.deepEqual(detail.placeKeys, []);
});
test('group_events_keep_all_services', () => {
    const event = regionalDiscoveryMarkerEvent('PIN_ACTIVATE', 'venue-a', { placeKeys: ['venue-a', 'venue-b'] }, {
        'venue-a': ['hard:101', 'soft:201'], 'venue-b': ['soft:201', 'soft:202'],
    });
    assert.deepEqual(event.entryKeys, ['hard:101', 'soft:201', 'soft:202']);
    assert.deepEqual(event.placeKeys, ['venue-a', 'venue-b']);
    const chooser = reduce(initial(), event);
    assert.equal(chooser.pane, 'chooser');
    assert.equal(chooser.lock, 'chooser');
});
test('row hover retains list; activation locks map without opening detail', () => {
    const hover = reduce(initial(), { type: 'ROW_ENTER', entryKey: 'hard:101', ...one });
    assert.equal(hover.pane, 'list');
    assert.equal(hover.entryKey, 'hard:101');
    assert.equal(reduce(hover, { type: 'ROW_LEAVE', entryKey: 'hard:101' }).entryKey, null);
    const locked = reduce(hover, { type: 'ROW_ACTIVATE', entryKey: 'hard:101', ...one });
    assert.equal(locked.lock, 'map');
    assert.equal(locked.pane, 'list');
    assert.equal(reduce(locked, { type: 'ROW_LEAVE', entryKey: 'hard:101' }), locked);
    assert.equal(reduce(locked, { type: 'PIN_ENTER', ...group }), locked);
});
test('chooser-owned detail Back returns to chooser; dismissal always returns to list', () => {
    const chooser = reduce(initial(), { type: 'PIN_ACTIVATE', ...group, listScrollTop: 154, focusReturnKey: 'hard:101' });
    const detail = reduce(chooser, { type: 'VIEW_SERVICE', entryKey: 'soft:201', placeKeys: ['venue-b'], chooserEntryKeys: group.entryKeys });
    assert.equal(detail.pane, 'detail');
    const back = reduce(detail, { type: 'BACK' });
    assert.equal(back.pane, 'chooser');
    assert.deepEqual(back.returnToChooser, null);
    assert.deepEqual(back.placeKeys, group.placeKeys);
    assert.deepEqual(reduce(back, { type: 'VIEW_SERVICE', entryKey: 'hard:101', placeKeys: ['venue-a'], chooserEntryKeys: group.entryKeys }).returnToChooser.entryKeys, group.entryKeys);
    const dismissed = reduce(detail, { type: 'DISMISS' });
    assert.equal(dismissed.pane, 'list');
    assert.equal(dismissed.lock, 'none');
    assert.equal(dismissed.listScrollTop, 154);
    assert.equal(dismissed.focusReturnKey, 'hard:101');
});
test('Back preserves list scroll and focus; stale leave cannot dismiss newer hover', () => {
    const detail = reduce(initial(), { type: 'VIEW_SERVICE', entryKey: 'soft:202', placeKeys: [], listScrollTop: 600, focusReturnKey: 'soft:202' });
    const back = reduce(detail, { type: 'BACK' });
    assert.equal(back.listScrollTop, 600);
    assert.equal(back.focusReturnKey, 'soft:202');
    const hover = reduce(initial(), { type: 'PIN_ENTER', ...one });
    assert.equal(reduce(hover, { type: 'PIN_LEAVE', placeKeys: ['other'] }), hover);
});
test('filter pruning removes hidden locks and prunes chooser membership and place keys', () => {
    const chooser = reduce(initial(), { type: 'PIN_ACTIVATE', ...group });
    const visible = { type: 'VISIBLE_ENTRIES_CHANGED', entryKeys: ['soft:201'], placeKeysByEntryKey: { 'soft:201': ['venue-b'] } };
    const pruned = reduce(chooser, visible);
    assert.deepEqual(pruned.returnToChooser, null);
    assert.deepEqual(pruned.placeKeys, ['venue-b']);
    assert.equal(pruned.pane, 'detail');
    assert.equal(pruned.entryKey, 'soft:201');
    const gone = reduce(pruned, { ...visible, entryKeys: [] });
    assert.equal(gone.pane, 'list');
    assert.equal(gone.lock, 'none');
    assert.equal(reduce(gone, { ...visible, entryKeys: [] }), gone);
});
test('Back cannot restore withdrawn or filtered chooser services or a removed venue', () => {
    const chooser = reduce(initial(), {type:'PIN_ACTIVATE', ...group});
    const detail = reduce(chooser, {type:'VIEW_SERVICE',entryKey:'hard:101',placeKeys:['venue-a'],chooserEntryKeys:group.entryKeys});
    const pruned = reduce(detail, {type:'VISIBLE_ENTRIES_CHANGED',entryKeys:group.entryKeys,
        placeKeysByEntryKey:{'hard:101':['venue-a'],'soft:201':[]}});
    assert.deepEqual(pruned.returnToChooser.entryKeys, ['hard:101']);
    const back = reduce(pruned, {type:'BACK'});
    assert.equal(back.pane, 'chooser');
    assert.deepEqual(back.placeKeys, ['venue-a']);
});
