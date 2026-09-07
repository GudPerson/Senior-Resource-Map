import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildBoundaryLayerImportPlan,
    buildSubregionBoundaryRows,
    serializePostalCodeRanges,
} from '../src/lib/boundaryLayerImport.js';

const subregions = [
    { id: 1, name: 'Hougang-3', subregionCode: 'SR-HOU3' },
    { id: 2, name: 'Serangoon-1', subregionCode: 'SR-SER1' },
    { id: 99, name: 'Singapore', subregionCode: 'SIN' },
];

test('buildBoundaryLayerImportPlan creates separate Region, Subregion, and Unmapped layers', () => {
    const plan = buildBoundaryLayerImportPlan([
        { 'POSTAL CODE': '545610', REGION: 'Hougang', SUBREGION: 'Hougang-3' },
        { 'POSTAL CODE': '545611', REGION: 'Hougang', SUBREGION: 'Hougang-3' },
        { 'POSTAL CODE': '550001', REGION: 'Serangoon', SUBREGION: 'Serangoon-1' },
        { 'POSTAL CODE': '000123', REGION: 'Unmapped', SUBREGION: '' },
    ], subregions);

    assert.equal(plan.errorCount, 0);
    assert.deepEqual(plan.summary, {
        sourceRows: 4,
        uniquePostalCodes: 4,
        mappedPostalCodes: 3,
        unmappedPostalCodes: 1,
        regionCount: 2,
        subregionCount: 2,
        duplicateRows: 0,
    });
    assert.deepEqual(plan.regions[0], {
        name: 'Hougang',
        postalCodes: ['545610', '545611'],
        subregionIds: [1],
        subregionNames: ['Hougang-3'],
    });
    assert.deepEqual(plan.unmapped.postalCodes, ['000123']);
    assert.equal(plan.subregions.some((subregion) => subregion.id === 99), false);
});

test('buildBoundaryLayerImportPlan rejects conflicting hierarchy and unknown Subregions before apply', () => {
    const plan = buildBoundaryLayerImportPlan([
        { POSTCODE: '545610', REGION: 'Hougang', SUBREGION: 'Hougang-3' },
        { POSTCODE: '545611', REGION: 'Serangoon', SUBREGION: 'Hougang-3' },
        { POSTCODE: '545612', REGION: 'Hougang', SUBREGION: 'Missing-1' },
        { POSTCODE: '545610', REGION: 'Unmapped', SUBREGION: '' },
    ], subregions);

    assert.equal(plan.errorCount, 3);
    assert.match(plan.errors.join('\n'), /belongs to both/);
    assert.match(plan.errors.join('\n'), /not configured/);
    assert.match(plan.errors.join('\n'), /conflicting boundary assignments/);
});

test('postal serializers preserve exact coverage and stay under the import cell limit', () => {
    assert.equal(serializePostalCodeRanges(['545612', '545610', '545611', '550001']), '545610-545612,550001');

    const rows = buildSubregionBoundaryRows({
        id: 1,
        subregionCode: 'SR-HOU3',
        postalCodes: Array.from({ length: 1200 }, (_, index) => String(index * 2).padStart(6, '0')),
    }, 80);
    assert.ok(rows.length > 1);
    assert.ok(rows.every((row) => row.Running_Range.length <= 80));
    assert.ok(rows.every((row) => row.subregionId === 'SR-HOU3'));
});
