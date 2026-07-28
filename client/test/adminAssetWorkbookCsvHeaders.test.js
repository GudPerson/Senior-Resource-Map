import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminPageSource = readFileSync(new URL('../src/pages/dashboard/AdminPage.jsx', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
    const start = adminPageSource.indexOf(startMarker);
    const end = adminPageSource.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return adminPageSource.slice(start, end);
}

function loadNormalizeAssetWorkbookCsvHeader() {
    const helperSource = sourceBetween(
        'function normalizeAssetWorkbookCsvHeader',
        'function isExcelUploadFile'
    );
    return Function(`${helperSource}; return normalizeAssetWorkbookCsvHeader;`)();
}

test('asset workbook CSV batching accepts display headers with required-field markers', () => {
    const normalizeHeader = loadNormalizeAssetWorkbookCsvHeader();

    assert.equal(normalizeHeader('name *'), 'name');
    assert.equal(normalizeHeader('* name'), 'name');
    assert.equal(normalizeHeader('postalCode *'), 'postalcode');
    assert.equal(normalizeHeader('Postal Code *'), 'postalcode');
    assert.equal(normalizeHeader('postal_code'), 'postalcode');
    assert.equal(normalizeHeader('\uFEFFexternalKey *'), 'externalkey');

    const csvBatchMapping = sourceBetween('const findVal = (key) => {', 'const name = findVal');
    assert.match(csvBatchMapping, /const targetHeader = normalizeAssetWorkbookCsvHeader\(key\)/);
    assert.match(csvBatchMapping, /normalizeAssetWorkbookCsvHeader\(k\) === targetHeader/);

    assert.match(adminPageSource, /const ASSET_WORKBOOK_CSV_IMPORT_BATCH_SIZE = 100/);
    assert.match(adminPageSource, /const BATCH_SIZE = ASSET_WORKBOOK_CSV_IMPORT_BATCH_SIZE/);
});
