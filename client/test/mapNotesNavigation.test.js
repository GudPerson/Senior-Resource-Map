import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMapNoteResources, rememberMapNotePin, resolveRecentMapNotePins } from '../src/lib/mapNotesNavigation.js';

const rows = [
    { assetKey: 'personal_place-1', name: 'Café Corner', address: '634 Choa Chu Kang North 6', postalCode: '680634' },
    { assetKey: 'hard-1', name: 'Support centre', bucket: 'Active Ageing', mapNoteContext: 'Choa Chu Kang' },
    { assetKey: 'soft-1', name: '中文活动', mapNoteContext: '邻里中心' },
];

test('search finds names, addresses, postcodes, categories and context without reordering identities', () => {
    assert.equal(filterMapNoteResources(rows, '  '), rows);
    assert.deepEqual(filterMapNoteResources(rows, 'CAFE'), [rows[0]]);
    assert.deepEqual(filterMapNoteResources(rows, '634 choa'), [rows[0]]);
    assert.deepEqual(filterMapNoteResources(rows, '680634'), [rows[0]]);
    assert.deepEqual(filterMapNoteResources(rows, 'ageing choa'), [rows[1]]);
    assert.deepEqual(filterMapNoteResources(rows, '邻里'), [rows[2]]);
    assert.deepEqual(filterMapNoteResources(rows, 'unknown'), []);
});

test('recent selections are unique, most recent first, bounded to five and stable on repeated selection', () => {
    let keys = [];
    for (let n = 1; n <= 7; n++) keys = rememberMapNotePin(keys, `pin-${n}`);
    assert.deepEqual(keys, ['pin-7', 'pin-6', 'pin-5', 'pin-4', 'pin-3']);
    assert.equal(rememberMapNotePin(keys, 'pin-7'), keys);
    assert.equal(rememberMapNotePin(keys, null), keys);
    assert.deepEqual(rememberMapNotePin(keys, 'pin-4'), ['pin-4', 'pin-7', 'pin-6', 'pin-5', 'pin-3']);
});

test('recent pin choices use current typed rows, prune removed/private rows and keep multipart pin resources', () => {
    const stale = { ...rows[0], name: 'Old name' };
    const pins = [{ key: 'pin-1', rows: [stale, rows[1], stale] }, { key: 'removed', rows: [rows[2]] }];
    assert.deepEqual(resolveRecentMapNotePins(pins, rows.slice(0, 2)), [{ key: 'pin-1', rows: rows.slice(0, 2) }]);
    assert.deepEqual(resolveRecentMapNotePins(pins, []), []);
    assert.equal(resolveRecentMapNotePins(pins, [rows[1]])[0].rows[0], rows[1]);
});
