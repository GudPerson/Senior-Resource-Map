import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/components/MyMapPdfExportButton.jsx', import.meta.url),
    'utf8',
);

test('My Map PDF export button captures a map snapshot but still downloads without one', () => {
    assert.match(source, /downloadMyMapPdf/);
    assert.match(source, /captureMapSnapshot/);
    assert.match(source, /mapSnapshotDataUrl/);
    assert.match(source, /createPortal/);
    assert.match(source, /DirectoryMap/);
    assert.match(source, /failedDownloadPdf/);
    assert.match(source, /exportRoot && snapshotSurfaceVisible \? createPortal/);
    assert.match(source, /mountedRef/);
    assert.match(source, /return \(\) =>/);
});
