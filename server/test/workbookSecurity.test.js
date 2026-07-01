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

test('workbook parser preserves WhatsApp contact fields across resource sheets', async () => {
    const placeFile = mockUpload('places.csv', [
        'externalKey,name,country,postalCode,ownershipMode,whatsappContact',
        'place-1,Test Place,SG,160024,system,87654321',
    ].join('\n'));
    const standaloneFile = mockUpload('standalone_offerings.csv', [
        'externalKey,name,bucket,subCategory,ownershipMode,audienceMode,whatsappContact',
        'offering-1,Test Service,Services,Health,system,public,https://wa.me/6587654321',
    ].join('\n'));
    const rolloutFile = mockUpload('template_rollouts.csv', [
        'templateExternalKey,hostExternalKey,whatsappContact',
        'template-1,place-1,+65 8765 4321',
    ].join('\n'));

    const placeRows = await parseWorkbookRows(placeFile, 'places');
    const standaloneRows = await parseWorkbookRows(standaloneFile, 'standalone-offerings');
    const rolloutRows = await parseWorkbookRows(rolloutFile, 'template-rollouts');

    assert.equal(String(placeRows[0].whatsappContact), '87654321');
    assert.equal(standaloneRows[0].whatsappContact, 'https://wa.me/6587654321');
    assert.equal(rolloutRows[0].whatsappContact, '+65 8765 4321');
});

test('workbook parser preserves public contact and social fields for direct asset sheets', async () => {
    const placeFile = mockUpload('places.csv', [
        'externalKey,name,country,postalCode,ownershipMode,contactEmail,facebookUrl,instagramUrl,tiktokUrl,youtubeUrl,linkedinUrl',
        'place-1,Test Place,SG,160024,system,hello@example.org,https://facebook.com/place,https://instagram.com/place,https://tiktok.com/@place,https://youtube.com/@place,https://linkedin.com/company/place',
    ].join('\n'));
    const standaloneFile = mockUpload('standalone_offerings.csv', [
        'externalKey,name,bucket,subCategory,ownershipMode,audienceMode,website,facebookUrl',
        'offering-1,Test Service,Services,Health,system,public,https://example.org,https://facebook.com/offering',
    ].join('\n'));
    const templateFile = mockUpload('templates.csv', [
        'externalKey,name,bucket,subCategory,ownershipMode,audienceMode,website,contactPhone,whatsappContact,contactEmail,instagramUrl',
        'template-1,Template Service,Services,Health,system,public,https://template.example,+65 6000 0000,https://wa.me/6560000000,template@example.org,https://instagram.com/template',
    ].join('\n'));

    const placeRows = await parseWorkbookRows(placeFile, 'places');
    const standaloneRows = await parseWorkbookRows(standaloneFile, 'standalone-offerings');
    const templateRows = await parseWorkbookRows(templateFile, 'templates');

    assert.equal(placeRows[0].contactEmail, 'hello@example.org');
    assert.equal(placeRows[0].facebookUrl, 'https://facebook.com/place');
    assert.equal(placeRows[0].instagramUrl, 'https://instagram.com/place');
    assert.equal(placeRows[0].tiktokUrl, 'https://tiktok.com/@place');
    assert.equal(placeRows[0].youtubeUrl, 'https://youtube.com/@place');
    assert.equal(placeRows[0].linkedinUrl, 'https://linkedin.com/company/place');
    assert.equal(standaloneRows[0].website, 'https://example.org');
    assert.equal(standaloneRows[0].facebookUrl, 'https://facebook.com/offering');
    assert.equal(templateRows[0].website, 'https://template.example');
    assert.equal(templateRows[0].contactPhone, '+65 6000 0000');
    assert.equal(templateRows[0].whatsappContact, 'https://wa.me/6560000000');
    assert.equal(templateRows[0].contactEmail, 'template@example.org');
    assert.equal(templateRows[0].instagramUrl, 'https://instagram.com/template');
});
