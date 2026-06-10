import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/components/MyMapPdfExportButton.jsx', import.meta.url),
    'utf8',
);

test('My Map PDF export button downloads the ledger without hidden map snapshot capture', () => {
    assert.match(source, /downloadMyMapPdf/);
    assert.match(source, /import\('\.\.\/lib\/myMapPdfGenerator\.js'\)/);
    assert.doesNotMatch(source, /^\s*import\s+\{\s*downloadMyMapPdf\s*\}\s+from\s+['"]\.\.\/lib\/myMapPdfGenerator\.js['"]/m);
    assert.match(source, /failedDownloadPdf/);
    assert.match(source, /mountedRef/);
    assert.match(source, /return \(\) =>/);
    assert.doesNotMatch(source, /captureMapSnapshot/);
    assert.doesNotMatch(source, /mapSnapshotDataUrl/);
    assert.doesNotMatch(source, /createPortal/);
    assert.doesNotMatch(source, /DirectoryMap/);
    assert.doesNotMatch(source, /toPng/);
});
