import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/dashboard/AdminPage.jsx', import.meta.url), 'utf8');

test('Admin Tools presents Region, Subregion, and Unmapped as separate boundary layers', () => {
    assert.match(source, /data-boundary-layer="regions"/);
    assert.match(source, /data-boundary-layer="subregions"/);
    assert.match(source, /data-boundary-layer="unmapped"/);
    assert.match(source, /Regions, Subregions, and Unmapped postcodes are stored separately/);
    assert.match(source, /account and resource routing continues to use only Subregions/);
});

test('mapping workbook is validated before a confirmed three-layer replacement', () => {
    assert.match(source, /buildBoundaryLayerImportPlan\(rows, subregions\)/);
    assert.match(source, /if \(plan\.errorCount > 0\)/);
    assert.match(source, /Replace all three boundary layers\?/);
    assert.match(source, /api\.upsertRegionBoundary/);
    assert.match(source, /api\.replaceUnmappedBoundary/);
    assert.match(source, /api\.bulkUploadSubregionBoundaries/);
});
