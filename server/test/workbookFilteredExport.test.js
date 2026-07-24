import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFilteredExportOptions } from '../src/controllers/workbookController.js';

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
