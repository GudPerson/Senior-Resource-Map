import assert from 'node:assert/strict';
import test from 'node:test';

import * as XLSX from '@e965/xlsx';

import { parseWorkbookRows } from '../src/controllers/workbookController.js';

function toArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function mockUpload(name, body, overrides = {}) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    return {
        name,
        size: buffer.byteLength,
        arrayBuffer: async () => toArrayBuffer(buffer),
        ...overrides,
    };
}

function buildPlacesCsv(rows) {
    return [
        'externalKey,name,country,postalCode,ownershipMode',
        ...rows,
    ].join('\n');
}

test('workbook import rejects unsupported file extensions before parsing', async () => {
    const file = mockUpload('places.xls', buildPlacesCsv(['place-1,Test Place,SG,160024,system']));

    await assert.rejects(
        () => parseWorkbookRows(file, 'places'),
        /Upload a \.xlsx or \.csv file/,
    );
});

test('workbook import rejects files over the import size limit', async () => {
    const file = mockUpload('places.csv', buildPlacesCsv(['place-1,Test Place,SG,160024,system']), {
        size: 10 * 1024 * 1024 + 1,
    });

    await assert.rejects(
        () => parseWorkbookRows(file, 'places'),
        /under 10 MB/,
    );
});

test('workbook import rejects too many data rows', async () => {
    const rows = Array.from({ length: 5001 }, (_, index) => `place-${index},Test ${index},SG,160024,system`);
    const file = mockUpload('places.csv', buildPlacesCsv(rows));

    await assert.rejects(
        () => parseWorkbookRows(file, 'places'),
        /up to 5,000 data rows/,
    );
});

test('workbook import rejects rows with too many columns', async () => {
    const header = Array.from({ length: 81 }, (_, index) => index < 5
        ? ['externalKey', 'name', 'country', 'postalCode', 'ownershipMode'][index]
        : `extra${index}`);
    const row = Array.from({ length: 81 }, (_, index) => index < 5
        ? ['place-1', 'Test Place', 'SG', '160024', 'system'][index]
        : 'extra');
    const file = mockUpload('places.csv', `${header.join(',')}\n${row.join(',')}`);

    await assert.rejects(
        () => parseWorkbookRows(file, 'places'),
        /too many columns/,
    );
});

test('workbook import accepts template-shaped xlsx rows after parser hardening', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
        ['externalKey', 'name', 'country', 'postalCode', 'ownershipMode'],
        ['place-1', 'Test Place', 'SG', '160024', 'system'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const file = mockUpload('places.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

    const rows = await parseWorkbookRows(file, 'places');

    assert.equal(rows.length, 1);
    assert.equal(rows[0].externalKey, 'place-1');
    assert.equal(rows[0].name, 'Test Place');
});
