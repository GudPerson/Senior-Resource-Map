import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '@e965/xlsx';
import {
    PERSONAL_PLACE_IMPORT_MAX_BYTES, PERSONAL_PLACE_IMPORT_TEMPLATE,
    applyPersonalPlaceImportLookup, lookupPersonalPlaceImportLocations, markPersonalPlaceImportRejectedBatch,
    parsePersonalPlaceImportGrid, personalPlaceImportPayload,
    readPersonalPlaceImportBatchResults, readPersonalPlaceImportFile,
    reconcilePersonalPlaceImportRows, reviewPersonalPlaceImportRows as reviewImportRows,
    validatePersonalPlaceImportLookup,
} from '../src/lib/personalPlaceImport.js';

function csvFile(source, name = 'places.csv') {
    return { name, size: Buffer.byteLength(source), text: async () => source };
}

function workbookFile(sheets, name = 'places.xlsx') {
    const workbook = XLSX.utils.book_new();
    for (const [title, grid] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, Array.isArray(grid) ? XLSX.utils.aoa_to_sheet(grid) : grid, title);
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: name.endsWith('.xls') ? 'biff8' : 'xlsx' });
    return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

const location = { postalCode: '070001', address: '1 SAMPLE ROAD SINGAPORE 070001', lat: 1.3, lng: 103.8 };
function readyRow(values = {}) {
    return { ...applyPersonalPlaceImportLookup(parsePersonalPlaceImportGrid([['Name', 'Postal Code', 'Short Description'], ['Care point', '070001', 'Weekly meetup']])[0], { location }), ...values };
}

function fixtureOwnerDto(place) {
    return { ...place, importShortDescription: Object.hasOwn(place, 'importShortDescription')
        ? place.importShortDescription : place.shortDescription ?? place.note ?? '' };
}

function reviewPersonalPlaceImportRows(rows, options = {}) {
    return reviewImportRows(rows, { ...options, personalPlaces: options.personalPlaces?.map(fixtureOwnerDto) });
}

function context(place, mapPlaces = [{ personalPlaceId: place.id }]) {
    return { personalPlaces: [fixtureOwnerDto(place)], map: { id: 7, personalPlaces: mapPlaces } };
}

test('CSV template has only the requested three columns and no fabricated places', () => {
    assert.equal(PERSONAL_PLACE_IMPORT_TEMPLATE, 'Name,Postal Code,Short Description\r\n');
});

test('CSV keeps quoted commas, leading zero postal text and omitted description column', async () => {
    const first = await readPersonalPlaceImportFile(csvFile('Name,Postal Code,Short Description\r\n"Care, point",070001,"Weekly, meetup"'));
    assert.equal(first.rows[0].name, 'Care, point');
    assert.equal(first.rows[0].postalCode, '070001');
    assert.equal(first.rows[0].shortDescription, 'Weekly, meetup');
    assert.deepEqual(first.rows[0].parseErrors, []);
    const second = await readPersonalPlaceImportFile(csvFile('Name,Postal Code\nCare point,070001'));
    assert.equal(second.rows[0].shortDescription, '');
    assert.equal(second.rows[0].categoryId, null);
});

test('header normalization accepts BOM, required markers and canonical aliases', () => {
    const rows = parsePersonalPlaceImportGrid([['\uFEFF* Place Name', '* Post Code', 'short_description'], [' Point ', '070001', ' Details ']]);
    assert.equal(rows[0].name, 'Point'); assert.equal(rows[0].shortDescription, 'Details');
    assert.deepEqual(rows[0].parseErrors, []);
});

test('duplicate, missing and unexpected headers are refused', () => {
    for (const headers of [['Name', 'Postal Code', 'Postal'], ['Name', 'Address'], ['Name', 'Postal Code', 'Category'], ['Name', 'Postal Code', 'Latitude']]) {
        assert.throws(() => parsePersonalPlaceImportGrid([headers, ['Point', '070001', 'x']]), /Duplicate|Unexpected|needs Name/);
    }
});

test('blank records are skipped and errors retain original spreadsheet row numbers', () => {
    const rows = parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ['', ''], ['', '12345'], ['Point', '123456']]);
    assert.equal(rows.length, 2); assert.equal(rows[0].rowNumber, 3); assert.equal(rows[1].rowNumber, 4);
    assert.match(rows[0].parseErrors.join(' '), /Name is required/);
    assert.match(rows[0].parseErrors.join(' '), /six digits/);
});

test('plain text lengths, formula-like values, scalar cells and extra data are validated', () => {
    const rows = parsePersonalPlaceImportGrid([['Name', 'Postal Code', 'Short Description'], ['x'.repeat(161), '070001', 'x'.repeat(241)], ['=HYPERLINK("url")', '070001'], ['Point', '070001', { nested: true }], ['Point', '070001', '', 'extra']]);
    assert.match(rows[0].parseErrors.join(' '), /160.*240/);
    assert.match(rows[1].parseErrors.join(' '), /Formula/);
    assert.match(rows[2].parseErrors.join(' '), /plain text/);
    assert.match(rows[3].parseErrors.join(' '), /outside/);
});

test('CSV malformed quotes block file reading instead of importing a partial parse', async () => {
    await assert.rejects(readPersonalPlaceImportFile(csvFile('Name,Postal Code\n"Unclosed,070001')), /CSV could not be read/);
});

test('file types, byte limit, empty files and 501 data rows are refused', async () => {
    await assert.rejects(readPersonalPlaceImportFile(csvFile('x', 'places.pdf')), /Choose a CSV/);
    await assert.rejects(readPersonalPlaceImportFile({ name: 'places.csv', size: PERSONAL_PLACE_IMPORT_MAX_BYTES + 1 }), /2 MB/);
    await assert.rejects(readPersonalPlaceImportFile(csvFile('')), /empty/);
    assert.throws(() => parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ...Array.from({ length: 501 }, () => ['Point', '070001'])]), /at most 500/);
});

test('500 valid data rows remain supported', () => {
    assert.equal(parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ...Array.from({ length: 500 }, () => ['Point', '070001'])]).length, 500);
});

test('XLSX and legacy XLS use the same columns and preserve formatted leading zeros', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Name', 'Postal Code'], ['Point', 70001]]);
    sheet.B2.z = '000000';
    for (const name of ['places.xlsx', 'places.xls']) {
        const parsed = await readPersonalPlaceImportFile(workbookFile({ Data: sheet }, name));
        assert.equal(parsed.rows[0].postalCode, '070001', name);
        assert.deepEqual(parsed.rows[0].parseErrors, [], name);
    }
});

test('unformatted five-digit Excel postal numbers are not silently padded', async () => {
    const parsed = await readPersonalPlaceImportFile(workbookFile({ Data: [['Name', 'Postal Code'], ['Point', 70001]] }));
    assert.equal(parsed.rows[0].postalCode, '70001'); assert.match(parsed.rows[0].parseErrors.join(' '), /six digits/);
});

test('multiple data sheets require an explicit selection', async () => {
    const file = workbookFile({ First: [['Name', 'Postal Code'], ['First point', '070001']], Second: [['Name', 'Postal Code'], ['Second point', '070002']] });
    const preview = await readPersonalPlaceImportFile(file);
    assert.deepEqual(preview.sheetNames, ['First', 'Second']); assert.deepEqual(preview.rows, []);
    assert.equal((await readPersonalPlaceImportFile(file, { sheetName: 'Second' })).rows[0].name, 'Second point');
    await assert.rejects(readPersonalPlaceImportFile(file, { sheetName: 'Missing' }), /Choose one/);
});

test('Excel formula metadata and cell errors are refused even with cached scalar values', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Name', 'Postal Code'], ['Point', '070001']]);
    sheet.A2 = { t: 's', v: 'Point', f: '"Point"' };
    await assert.rejects(readPersonalPlaceImportFile(workbookFile({ Data: sheet })), /Formula cell A2/);
    sheet.A2 = { t: 'e', v: 7 };
    await assert.rejects(readPersonalPlaceImportFile(workbookFile({ Data: sheet })), /Cell A2/);
});

test('Excel range limits reject extra columns and oversized worksheet ranges', async () => {
    const wide = XLSX.utils.aoa_to_sheet([['Name', 'Postal Code'], ['Point', '070001']]); wide.V2 = { t: 's', v: 'x' }; wide['!ref'] = 'A1:V2';
    await assert.rejects(readPersonalPlaceImportFile(workbookFile({ Data: wide })), /too many columns/);
    const tall = XLSX.utils.aoa_to_sheet([['Name', 'Postal Code'], ...Array.from({ length: 501 }, () => ['Point', '070001'])]);
    await assert.rejects(readPersonalPlaceImportFile(workbookFile({ Data: tall })), /at most 500/);
});

test('lookup requires exact postal equality and complete finite coordinates', () => {
    assert.deepEqual(validatePersonalPlaceImportLookup('070001', location), location);
    for (const result of [null, { ...location, postalCode: '070002' }, { ...location, address: '' }, { ...location, lat: null }, { ...location, lat: '' }, { ...location, lat: false }, { ...location, lng: Infinity }, { ...location, lat: 100 }]) {
        assert.throws(() => validatePersonalPlaceImportLookup('070001', result), /matched exactly|complete location/);
    }
});

test('same-postal lookup retry preserves edited address, chosen category and exclusion', () => {
    const row = readyRow({ address: `${location.address} #02-05`, addressEdited: true, categoryId: 12, excluded: true });
    const failed = applyPersonalPlaceImportLookup(row, { error: 'Temporary lookup failure' });
    const retried = applyPersonalPlaceImportLookup(failed, { location: { ...location, address: 'LOOKUP BASE ADDRESS' } });
    assert.equal(retried.address, row.address); assert.equal(retried.categoryId, 12); assert.equal(retried.excluded, true);
    assert.equal(retried.lookupStatus, 'ready'); assert.equal(retried.lookupError, '');
});

test('postal lookup deduplicates postals, bounds requests to three and stops scheduling after cancellation', async () => {
    const rows = Array.from({ length: 8 }, (_, index) => readyRow({ id: `row-${index}`, postalCode: `07000${index}` }));
    rows.push({ ...rows[0], id: 'duplicate' });
    let concurrent = 0; let maximum = 0; const called = []; const results = [];
    await lookupPersonalPlaceImportLocations(rows, async (postalCode) => { called.push(postalCode); concurrent += 1; maximum = Math.max(maximum, concurrent); await new Promise((resolve) => setTimeout(resolve, 2)); concurrent -= 1; return { ...location, postalCode }; }, (postalCode) => results.push(postalCode));
    assert.equal(called.length, 8); assert.equal(results.length, 8); assert.equal(maximum, 3);
    let active = true; let started = 0; let callbacks = 0;
    await lookupPersonalPlaceImportLocations(rows, async () => { started += 1; active = false; return location; }, () => { callbacks += 1; }, () => active);
    assert.equal(started, 1); assert.equal(callbacks, 0);
});

test('review defaults to generic category and category refresh never changes draft edits', () => {
    const row = readyRow({ address: 'Reviewed #02-05', addressEdited: true, categoryId: 12 });
    const first = reviewPersonalPlaceImportRows([row], { categories: [{ id: 12, isArchived: false }] })[0];
    assert.equal(first.reviewStatus, 'ready');
    const second = reviewPersonalPlaceImportRows([row], { categories: [{ id: 12, isArchived: true }, { id: 15 }] })[0];
    assert.equal(second.reviewStatus, 'invalid'); assert.equal(second.categoryId, 12); assert.equal(second.address, row.address);
    assert.equal(personalPlaceImportPayload(readyRow()).categoryId, null);
});

test('review permits exact owner-place reuse and distinct unit addresses without overwriting conflicts', () => {
    const row = readyRow(); const existing = { ...row, id: 91, mapIds: [7] };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [existing], mapId: 7 })[0].previewAction, 'already_added');
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [{ ...existing, mapIds: [] }], mapId: 7 })[0].previewAction, 'attached');
    assert.equal(reviewPersonalPlaceImportRows([readyRow({ address: `${location.address} #02-05` })], { personalPlaces: [existing], mapId: 7 })[0].previewAction, 'created');
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [{ ...existing, shortDescription: 'Different' }], mapId: 7 })[0].reviewStatus, 'invalid');
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [existing, { ...existing, id: 92 }], mapId: 7 })[0].reviewStatus, 'invalid');
});

test('legacy private category labels and note fallback cannot silently change through import reuse', () => {
    const row = readyRow();
    const legacy = { ...row, id: 91, mapIds: [], categoryId: null, categoryLabel: 'Family' };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [legacy] })[0].reviewStatus, 'invalid');
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [{ ...legacy, categoryLabel: 'Personal place', shortDescription: null, note: row.shortDescription }] })[0].previewAction, 'attached');
});

test('duplicate file rows are reported while incompatible details require explicit skipping', () => {
    const first = readyRow(); const second = readyRow({ id: 'row-3', rowNumber: 3 });
    assert.equal(reviewPersonalPlaceImportRows([first, second])[1].previewAction, 'duplicate');
    const conflict = { ...second, shortDescription: 'Different' };
    assert.equal(reviewPersonalPlaceImportRows([first, conflict])[1].reviewStatus, 'invalid');
    assert.equal(reviewPersonalPlaceImportRows([{ ...first, excluded: true }, conflict])[1].reviewStatus, 'ready');
});

test('batch result validation rejects incomplete, duplicate-index and unsupported outcomes', () => {
    const rows = [readyRow(), readyRow({ id: 'row-3' })];
    const valid = { results: [{ index: 1, status: 'attached', placeId: 92 }, { index: 0, status: 'created', placeId: 91 }] };
    assert.equal(readPersonalPlaceImportBatchResults(valid, rows)[0].id, 'row-3');
    for (const response of [{}, { results: [valid.results[0]] }, { results: [valid.results[0], valid.results[0]] }, { results: [valid.results[0], { index: 0, status: 'failed', placeId: 91 }] }, { results: [valid.results[0], { index: 0, status: 'created', placeId: null }] }]) {
        assert.throws(() => readPersonalPlaceImportBatchResults(response, rows), /incomplete/);
    }
});

test('saved results require matching map, library link and canonical map membership', () => {
    const row = readyRow({ result: { status: 'created', placeId: 91, confirmed: false } }); const place = { ...row, id: 91, mapIds: [7] };
    assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result.confirmed, true);
    for (const state of [undefined, { personalPlaces: [place], map: { id: 8, personalPlaces: [{ personalPlaceId: 91 }] } }, context(place, []), context({ ...place, mapIds: [] }), context({ ...place, id: 92 })]) {
        assert.throws(() => reconcilePersonalPlaceImportRows([row], state, 7), /refreshed|not confirmed/);
    }
});

test('uncertain attempted rows reconcile exact saved content while unsent and conflicting rows remain pending', () => {
    const row = readyRow({ attempted: true }); const place = { ...row, id: 91, mapIds: [7] };
    const refreshed = reconcilePersonalPlaceImportRows([row], context(place), 7)[0];
    assert.deepEqual(refreshed.result, { status: 'already_added', placeId: 91, confirmed: true });
    assert.equal(reconcilePersonalPlaceImportRows([{ ...row, attempted: false }], context(place), 7)[0].result, null);
    assert.equal(reconcilePersonalPlaceImportRows([row], context({ ...place, address: 'Different unit' }), 7)[0].result, null);
    assert.equal(reconcilePersonalPlaceImportRows([row], context(place, []), 7)[0].result, null);
});

test('one exact match among multiple same-location records is still ambiguous', () => {
    const row = readyRow(); const place = { ...row, id: 91, mapIds: [7] };
    const personalPlaces = [place, { ...place, id: 92, shortDescription: 'Different details' }];
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces, mapId: 7 })[0].reviewStatus, 'invalid');
    assert.throws(() => reconcilePersonalPlaceImportRows([{ ...row, attempted: true }], { personalPlaces: personalPlaces.map(fixtureOwnerDto), map: { id: 7, personalPlaces: [{ personalPlaceId: 91 }, { resourceId: 92 }] } }, 7), /More than one/);
});

test('coordinate conflicts cannot be reported ready or confirmed after an uncertain request', () => {
    const row = readyRow({ attempted: true });
    const place = { ...personalPlaceImportPayload(row), id: 91, mapIds: [7], lat: 1.31, lng: location.lng };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].reviewStatus, 'invalid');
    assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result, null);
    assert.throws(() => reconcilePersonalPlaceImportRows([{ ...row, result: { status: 'attached', placeId: 91, confirmed: false } }], context(place), 7), /not confirmed/);
    const roundedMatch = { ...place, lat: location.lat + 0.000000001 };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [roundedMatch], mapId: 7 })[0].previewAction, 'already_added');
});

test('description spacing follows canonical server one-line normalization', () => {
    const row = readyRow({ shortDescription: 'Weekly  meetup\nwith neighbours' });
    const place = { ...personalPlaceImportPayload(row), shortDescription: 'Weekly meetup with neighbours', lat: location.lat, lng: location.lng, id: 91, mapIds: [7] };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].previewAction, 'already_added');
    const parsed = parsePersonalPlaceImportGrid([['Name', 'Postal Code', 'Short Description'], ['Weekly  point', '070001', 'Weekly  meetup\nwith neighbours']])[0];
    assert.equal(parsed.name, 'Weekly point'); assert.equal(parsed.shortDescription, 'Weekly meetup with neighbours');
});

test('a shifted worksheet cannot silently lose rows at the bounded parser cutoff', async () => {
    const grid = [...Array.from({ length: 5 }, () => []), ['Name', 'Postal Code'], ...Array.from({ length: 500 }, () => ['Point', '070001'])];
    await assert.rejects(readPersonalPlaceImportFile(workbookFile({ Data: grid })), /headers on the first row/);
});

test('PostgreSQL decimal coordinate ties reconcile successful saves with half-away-from-zero rounding', () => {
    const cases = [
        [1.30000005, 103.80000005, '1.3000001', '103.8000001'],
        [-1.30000005, -103.80000005, '-1.3000001', '-103.8000001'],
        [5e-8, 7.5e-7, '0.0000001', '0.0000008'],
        [-5e-8, -4e-8, '-0.0000001', '0.0000000'],
        [1.23456784, 103.12345674, '1.2345678', '103.1234567'],
        [1.23456785, 103.12345675, '1.2345679', '103.1234568'],
        [Number.MIN_VALUE, -Number.MIN_VALUE, '0.0000000', '0.0000000'],
        [-0, 0, '0.0000000', '0.0000000'],
    ];
    for (const [lat, lng, savedLat, savedLng] of cases) {
        const row = readyRow({ attempted: true, location: { ...location, lat, lng } });
        const place = { ...personalPlaceImportPayload(row), id: 91, mapIds: [7], lat: savedLat, lng: savedLng };
        assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].previewAction, 'already_added', `lookup ${lat}/${lng}`);
        const knownResult = { ...row, result: { status: 'created', placeId: 91, confirmed: false } };
        assert.equal(reconcilePersonalPlaceImportRows([knownResult], context(place), 7)[0].result.confirmed, true, `saved ${savedLat}/${savedLng}`);
        assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result.confirmed, true);
    }
});

test('invalid stored coordinate values cannot become matching numeric zero or other coerced values', () => {
    const row = readyRow({ attempted: true, location: { ...location, lat: 0, lng: 0 } });
    for (const lat of [null, undefined, NaN, Infinity, false, '', '   ', 'not a coordinate', '0x00', [], {}]) {
        const place = { ...personalPlaceImportPayload(row), id: 91, mapIds: [7], lat, lng: 0 };
        assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].reviewStatus, 'invalid', String(lat));
        assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result, null);
    }
    const signedExponents = { ...personalPlaceImportPayload(row), id: 91, mapIds: [7], lat: '+0.0e+0', lng: '-0e-7' };
    assert.equal(reconcilePersonalPlaceImportRows([row], context(signedExponents), 7)[0].result.confirmed, true);
});

test('incoming control characters and line spacing use the server cleaners while reviewed addresses retain unit details', () => {
    const parsed = parsePersonalPlaceImportGrid([['Name', 'Postal Code', 'Short Description'], ['Care\u0000\u0007\r\npoint', '070001', 'Weekly\u000B\r\n\tmeetup']])[0];
    assert.equal(parsed.name, 'Care point'); assert.equal(parsed.shortDescription, 'Weekly meetup');
    assert.deepEqual(parsed.parseErrors, []);
    const row = readyRow({ name: 'Care\u0007\r\npoint', shortDescription: 'Weekly\u007F\r\n\tmeetup', address: 'SAMPLE ROAD\u0007\r\n#02-05', attempted: true });
    const payload = personalPlaceImportPayload(row);
    assert.equal(payload.name, 'Care point'); assert.equal(payload.shortDescription, 'Weekly meetup');
    assert.equal(payload.address, 'SAMPLE ROAD\n#02-05');
    const place = { ...payload, id: 91, mapIds: [7], lat: location.lat, lng: location.lng };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].previewAction, 'already_added');
    assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result.confirmed, true);
    const emptyName = parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ['\u0007', '070001']])[0];
    assert.match(emptyName.parseErrors.join(' '), /Name is required/);
    assert.equal(reviewPersonalPlaceImportRows([readyRow({ address: '\u0007' })])[0].reviewStatus, 'invalid');
});

test('legacy multiline, control-containing and outer-spaced stored descriptions remain conflicts rather than false completed imports', () => {
    const parsed = parsePersonalPlaceImportGrid([['Name', 'Postal Code', 'Short Description'], ['Care point', '070001', 'Legacy\n description']])[0];
    const row = { ...applyPersonalPlaceImportLookup(parsed, { location }), attempted: true };
    assert.equal(row.shortDescription, 'Legacy description');
    for (const note of ['Legacy\n description', 'Legacy  description', ' Legacy description ', 'Legacy\u0007 description']) {
        const place = { ...personalPlaceImportPayload(row), shortDescription: null, note, lat: location.lat, lng: location.lng, id: 91, mapIds: [7] };
        assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].reviewStatus, 'invalid', JSON.stringify(note));
        assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result, null);
        const claimedResult = { ...row, result: { status: 'attached', placeId: 91, confirmed: false } };
        assert.throws(() => reconcilePersonalPlaceImportRows([claimedResult], context(place), 7), /not confirmed/);
    }
    const canonical = { ...personalPlaceImportPayload(row), lat: location.lat, lng: location.lng, id: 91, mapIds: [7] };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [canonical], mapId: 7 })[0].previewAction, 'already_added');
    assert.equal(reconcilePersonalPlaceImportRows([row], context(canonical), 7)[0].result.confirmed, true);
});

test('stored explicit blank description does not fall back to a nonempty legacy note in content matching', () => {
    const row = readyRow({ attempted: true, shortDescription: 'Legacy description' });
    const place = { ...personalPlaceImportPayload(row), shortDescription: '', note: 'Legacy description', lat: location.lat, lng: location.lng, id: 91, mapIds: [7] };
    assert.equal(reviewPersonalPlaceImportRows([row], { personalPlaces: [place], mapId: 7 })[0].reviewStatus, 'invalid');
    assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result, null);
});

test('owner DTO raw import description overrides the existing presentation note fallback', () => {
    const row = readyRow({ attempted: true, shortDescription: 'Legacy description' });
    const place = { ...personalPlaceImportPayload(row), lat: location.lat, lng: location.lng, id: 91, mapIds: [7], importShortDescription: '' };
    assert.equal(reviewImportRows([row], { personalPlaces: [place], mapId: 7 })[0].reviewStatus, 'invalid');
    assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result, null);
    const blankIncoming = { ...row, shortDescription: '' };
    assert.equal(reviewImportRows([blankIncoming], { personalPlaces: [place], mapId: 7 })[0].previewAction, 'already_added');
    assert.equal(reconcilePersonalPlaceImportRows([blankIncoming], context(place), 7)[0].result.confirmed, true);
});

test('missing raw owner-description metadata fails closed instead of guessing from displayed legacy text', () => {
    const row = readyRow({ attempted: true });
    const place = { ...personalPlaceImportPayload(row), lat: location.lat, lng: location.lng, id: 91, mapIds: [7] };
    const state = { personalPlaces: [place], map: { id: 7, personalPlaces: [{ personalPlaceId: 91 }] } };
    assert.equal(reviewImportRows([row], { personalPlaces: [place], mapId: 7 })[0].reviewStatus, 'invalid');
    assert.equal(reconcilePersonalPlaceImportRows([row], state, 7)[0].result, null);
});

test('legacy edge tabs, newlines, nonbreaking spaces and padded postal codes cannot falsely reconcile SQL identity mismatches', () => {
    const row = readyRow({ attempted: true });
    const base = { ...personalPlaceImportPayload(row), lat: location.lat, lng: location.lng, id: 91, mapIds: [7] };
    const variants = [
        { name: `\t${row.name}\t` }, { name: `\n${row.name}\n` }, { name: `\u00a0${row.name}\u00a0` },
        { address: `\t${row.address}\t` }, { address: `\n${row.address}\n` }, { address: `\u00a0${row.address}\u00a0` },
        { postalCode: ` ${row.postalCode} ` },
    ];
    for (const variant of variants) {
        const place = fixtureOwnerDto({ ...base, ...variant });
        assert.equal(reviewImportRows([row], { personalPlaces: [place], mapId: 7 })[0].previewAction, 'created', JSON.stringify(variant));
        assert.equal(reconcilePersonalPlaceImportRows([row], context(place), 7)[0].result, null);
    }
    const ordinarySpaces = fixtureOwnerDto({ ...base, name: ` ${row.name} `, address: ` ${row.address} ` });
    assert.equal(reviewImportRows([row], { personalPlaces: [ordinarySpaces], mapId: 7 })[0].previewAction, 'already_added');
});

test('definite rejected batches never infer completion while previous successes still require refreshed membership', () => {
    const rejected = readyRow({ attempted: true });
    const previous = readyRow({ id: 'row-previous', attempted: true, result: { status: 'created', placeId: 92, confirmed: true } });
    const saved = fixtureOwnerDto({ ...personalPlaceImportPayload(rejected), lat: location.lat, lng: location.lng, id: 91, mapIds: [7] });
    const priorSaved = { ...saved, id: 92 };
    const state = { personalPlaces: [saved, priorSaved], map: { id: 7, personalPlaces: [{ personalPlaceId: 91 }, { personalPlaceId: 92 }] } };
    for (const status of [400, 403, 404, 409]) {
        const next = markPersonalPlaceImportRejectedBatch([rejected, previous], [rejected.id], status);
        assert.equal(next[0].attempted, false); assert.equal(next[1].result.confirmed, true);
        const refreshed = reconcilePersonalPlaceImportRows(next, state, 7);
        assert.equal(refreshed[0].result, null); assert.equal(refreshed[1].result.confirmed, true);
        assert.throws(() => reconcilePersonalPlaceImportRows(next, undefined, 7), /refreshed/);
    }
    for (const status of [undefined, 500, 503]) assert.equal(markPersonalPlaceImportRejectedBatch([rejected], [rejected.id], status)[0].attempted, true);
});
