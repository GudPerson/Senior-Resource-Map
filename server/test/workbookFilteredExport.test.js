import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalizeFilteredExportOptions } from '../src/controllers/workbookController.js';

const workbookControllerSource = readFileSync(new URL('../src/controllers/workbookController.js', import.meta.url), 'utf8');

test('filtered workbook export accepts a server-side managed search filter without ids', () => {
    assert.deepEqual(normalizeFilteredExportOptions({
        filters: {
            scope: 'managed',
            regionScoped: true,
            q: '  Bukit\nBatok  ',
        },
    }, 'places'), {
        orderedIds: null,
        query: 'Bukit Batok',
        filterSummary: {
            scope: 'managed',
            regionScoped: true,
            q: 'Bukit Batok',
        },
    });
});

test('filtered workbook export still accepts explicit ids for client-only filters', () => {
    assert.deepEqual(normalizeFilteredExportOptions({
        ids: [3, 1],
    }, 'places'), {
        orderedIds: [3, 1],
        query: '',
        filterSummary: null,
    });
});

test('filtered workbook export rejects missing ids and unsupported search filters', () => {
    assert.throws(
        () => normalizeFilteredExportOptions({}, 'places'),
        /Provide ids or filters/,
    );

    assert.throws(
        () => normalizeFilteredExportOptions({ filters: { q: 'template' } }, 'templates'),
        /Search-filtered workbook export is available/,
    );
});

test('filtered CSV export skips XLSX reference-sheet generation', () => {
    assert.match(
        workbookControllerSource,
        /const references = format === XLSX_FORMAT \? await buildWorkbookReferences\(db, resourceType\) : null;/,
    );
});
