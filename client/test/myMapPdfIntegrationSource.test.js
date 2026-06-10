import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const i18nSource = readFileSync(
    new URL('../src/lib/i18n.js', import.meta.url),
    'utf8',
);

test('My Map detail page uses an unfiltered presentation for PDF export', () => {
    assert.match(pageSource, /MyMapPdfExportButton/);
    assert.match(pageSource, /pdfPresentation/);
    assert.match(pageSource, /buildDirectoryPresentation\(directory\)/);
    assert.match(pageSource, /presentation=\{pdfPresentation\}/);
});

test('My Map PDF labels are available in all locale dictionaries', () => {
    for (const key of ['downloadPdf', 'preparingPdf', 'failedDownloadPdf']) {
        const occurrences = [...i18nSource.matchAll(new RegExp(`${key}:`, 'g'))].length;
        assert.equal(occurrences, 4, `${key} should exist once per locale`);
    }
});
