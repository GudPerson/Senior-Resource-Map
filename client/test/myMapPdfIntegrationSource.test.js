import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const i18nSource = ['en.js', 'zh-CN.js', 'ms.js', 'ta.js']
    .map((localeFile) => readFileSync(new URL(`../src/locales/${localeFile}`, import.meta.url), 'utf8'))
    .join('\n');

test('My Map detail page uses an unfiltered presentation for PDF export', () => {
    assert.match(pageSource, /MyMapPdfExportButton/);
    assert.match(pageSource, /pdfPresentation/);
    assert.match(pageSource, /buildDirectoryPresentation\(directory\)/);
    assert.match(pageSource, /presentation=\{pdfPresentation\}/);
});

test('My Map detail page lazy-loads print-only image export code', () => {
    assert.match(pageSource, /const MapImageExportButton = lazy\(\(\) => import\('\.\.\/components\/MapImageExportButton\.jsx'\)\)/);
    assert.match(pageSource, /<Suspense fallback=/);
    assert.doesNotMatch(pageSource, /^\s*import\s+MapImageExportButton\s+from\s+['"]\.\.\/components\/MapImageExportButton\.jsx['"]/m);
});

test('My Map notes PDF labels are available in all locale dictionaries', () => {
    for (const key of ['downloadMapNotes', 'preparingPdf', 'failedDownloadPdf']) {
        const occurrences = [...i18nSource.matchAll(new RegExp(`${key}:`, 'g'))].length;
        assert.equal(occurrences, 4, `${key} should exist once per locale`);
    }
});

test('My Map owner actions use the concise Export View label on desktop and mobile', () => {
    const occurrences = [...pageSource.matchAll(/t\('print'\)/g)].length;
    assert.equal(occurrences, 2);
    assert.doesNotMatch(pageSource, /t\('printFriendlyView'\)/);
    assert.equal([...i18nSource.matchAll(/print: 'Export View'/g)].length, 1);
    assert.equal([...i18nSource.matchAll(/print: '导出视图'/g)].length, 1);
    assert.equal([...i18nSource.matchAll(/print: 'Paparan Eksport'/g)].length, 1);
    assert.equal([...i18nSource.matchAll(/print: 'ஏற்றுமதி பார்வை'/g)].length, 1);
});
