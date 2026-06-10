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
    assert.match(source, /head: \[\['Resource', 'Address', 'Notes'\]\]/);
    assert.doesNotMatch(source, /Map snapshot/);
    assert.doesNotMatch(source, /mapSnapshotDataUrl/);
    assert.doesNotMatch(source, /addImage/);
    assert.doesNotMatch(source, /sourceMapNumber/);
    assert.doesNotMatch(source, /head: \[\['#'/);
});
