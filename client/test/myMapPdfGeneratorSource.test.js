import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/lib/myMapPdfGenerator.js', import.meta.url),
    'utf8',
);

test('My Map PDF generator lazy-loads heavy PDF libraries', () => {
    assert.doesNotMatch(source, /^\s*import\s*['"]jspdf['"];?/m);
    assert.doesNotMatch(source, /\bimport\s+(?!\()[\s\S]*?\s+from\s+['"]jspdf['"]/);
    assert.doesNotMatch(source, /^\s*import\s*['"]jspdf-autotable['"];?/m);
    assert.doesNotMatch(source, /\bimport\s+(?!\()[\s\S]*?\s+from\s+['"]jspdf-autotable['"]/);
    assert.match(source, /import\(['"]jspdf['"]\)/);
    assert.match(source, /import\(['"]jspdf-autotable['"]\)/);
});

test('My Map PDF generator keeps the report layout focused on extractable ledger data', () => {
    assert.match(source, /Category summary/);
    assert.match(source, /head: \[\['Resource \/ Address', 'Notes'\]\]/);
    assert.doesNotMatch(source, /Map snapshot/);
    assert.doesNotMatch(source, /mapSnapshotDataUrl/);
    assert.doesNotMatch(source, /addImage/);
    assert.doesNotMatch(source, /sourceMapNumber/);
    assert.doesNotMatch(source, /head: \[\['#'/);
    assert.doesNotMatch(source, /header: 'Address'/);
});

test('My Map PDF generator uses a mobile-friendly hierarchy without repeated map titles on category pages', () => {
    assert.match(source, /function writeCoverHeader/);
    assert.match(source, /function writeLedgerFooter/);
    assert.match(source, /coverTitle: 16/);
    assert.match(source, /ledgerTable: 9\.5/);
    assert.match(source, /metricsTop: 88/);
    assert.match(source, /metricValueOffset: 18/);
    assert.match(source, /titleY: 140/);
    assert.match(source, /tableStartY: 156/);
    assert.match(source, /titleTableGap: 10/);
    assert.match(source, /summaryToLedgerGap: 28/);
    assert.match(source, /minimumTableRoom: 112/);
    assert.match(source, /function needsFreshPage/);
    assert.match(source, /doc\.lastAutoTable\?\.finalY/);
    assert.doesNotMatch(source, /for \(const category of ledger\.categories\) \{\s*doc\.addPage\(\);/);
    assert.match(source, /doc\.setProperties\(\{\s*title: ledger\.mapName/s);
    assert.match(source, /writeLedgerFooter\(doc, doc\.internal\.getNumberOfPages\(\)\)/);
    assert.doesNotMatch(source, /didDrawPage: \(\) => writeHeader\(doc, ledger\)/);
    assert.doesNotMatch(source, /function writeHeader/);
});

test('My Map PDF generator keeps note formatting readable', () => {
    assert.match(source, /\[\$\{note\.dateLabel\}\] - /);
    assert.match(source, /buildPdfMarkdownLines\(note\.markdownText \|\| note\.text\)/);
    assert.match(source, /fontStyle: line\.fontStyle/);
    assert.doesNotMatch(source, /Updated \$\{note\.updatedAt\}/);
    assert.doesNotMatch(source, /details = \[note\.visibility\]/);
});

test('My Map PDF generator constrains notes inside the printable page width', () => {
    assert.match(source, /const LEDGER_CONTENT_WIDTH = PAGE\.width - \(PAGE\.margin \* 2\);/);
    assert.match(source, /const LEDGER_COLUMN_WIDTHS = \{/);
    assert.match(source, /return LEDGER_CONTENT_WIDTH - LEDGER_COLUMN_WIDTHS\.resource/);
    assert.match(source, /tableWidth: LEDGER_CONTENT_WIDTH/);
    assert.match(source, /resource: \{\s*cellWidth: LEDGER_COLUMN_WIDTHS\.resource,\s*overflow: 'linebreak'/s);
    assert.match(source, /notes: \{\s*cellWidth: LEDGER_COLUMN_WIDTHS\.notes,\s*overflow: 'linebreak',\s*minCellWidth: LEDGER_COLUMN_WIDTHS\.notes/s);
});
