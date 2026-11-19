import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createAreaAddressSearchIndex, filterAreaAddressSearchIndex, normalizeAreaAddressQuery,
} from '../src/lib/mapAreaAddressSearch.js';

const rows = Object.freeze([
    { id: 'north', building: 'Ａmber—Court', roadName: 'North Rd', address: 'Block 8', postalCode: '012345' },
    { id: 'nil', building: '  nIl ', roadName: 'North Rd', address: 'Unit 012345', postalCode: '123456' },
    { id: 'east', building: 'Amber Gate', roadName: 'East Rd', address: 'Zone 32', postalCode: '012345' },
    { id: 'tamil', building: 'அரசு', roadName: '中文路', address: 'Office', postalCode: '234567' },
].map(Object.freeze));

test('search normalizes Unicode, separates punctuation and whitespace, and retains combining marks', () => {
    assert.deepEqual(normalizeAreaAddressQuery('  ＡMBER／Court—Ｒｄ  '), ['amber', 'court', 'rd']);
    assert.deepEqual(normalizeAreaAddressQuery('   \t  '), []);
    const index = createAreaAddressSearchIndex(rows);
    assert.deepEqual(filterAreaAddressSearchIndex(index, normalizeAreaAddressQuery('அரசு 中文')), [rows[3]]);
});

test('all terms must match across the indexed fields, with source row identity and order', () => {
    const index = createAreaAddressSearchIndex(rows);
    for (const [query, expected] of [
        ['ambe  rd', ['north', 'east']], ['court block nor', ['north']], ['gate north', []], ['nil', []],
        ['012345', ['north', 'east']], ['012', ['north', 'nil', 'east']], ['8 012345', ['north']],
        [' ', ['north', 'nil', 'east', 'tamil']],
    ]) {
        const results = filterAreaAddressSearchIndex(index, normalizeAreaAddressQuery(query));
        assert.deepEqual(results.map(row => row.id), expected, query);
        for (const row of results) assert.equal(row, rows.find(original => original.id === row.id));
    }
    assert.equal(index[1].row, rows[1]);
});
