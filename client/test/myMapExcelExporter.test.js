import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMyMapExcelFileName,
    createMyMapExcelWorkbook,
} from '../src/lib/myMapExcelExporter.js';

test('Excel exporter creates the three reviewable sheets without map notes', async () => {
    const { workbook, XLSX } = await createMyMapExcelWorkbook({
        directory: { name: 'Jurong / Partners' },
        presentation: {
            mappedGroups: [{
                placeKey: 'hard-1',
                number: 3,
                address: '3 Jurong Street',
                rows: [{
                    assetKey: 'hard-1',
                    resourceType: 'hard',
                    resourceId: 1,
                    name: 'Jurong AAC',
                    subCategory: 'Active Ageing Centre',
                    mapShortDescriptors: [{ text: 'Morning activities', textColor: '#0F766E', sortOrder: 0 }],
                    notes: { items: [{ text: 'Private note must stay out', isShared: false }] },
                }],
            }],
        },
    });

    assert.deepEqual(workbook.SheetNames, ['Summary', 'Map Assets', 'Descriptions']);
    assert.equal(buildMyMapExcelFileName('Jurong / Partners'), 'jurong-partners-assets.xlsx');
    const assets = XLSX.utils.sheet_to_json(workbook.Sheets['Map Assets']);
    const descriptions = XLSX.utils.sheet_to_json(workbook.Sheets.Descriptions);
    assert.equal(assets[0]['Resource name'], 'Jurong AAC');
    assert.equal(descriptions[0].Description, 'Morning activities');
    assert.doesNotMatch(JSON.stringify(workbook), /Private note must stay out/);
});
