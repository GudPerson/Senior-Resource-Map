import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMyMapAssetLedger,
    buildMyMapAssetWorkbookRows,
    toSafeExcelText,
} from '../src/lib/myMapAssetLedger.js';

function row(overrides = {}) {
    return {
        assetKey: `${overrides.resourceType || 'hard'}-${overrides.resourceId}`,
        resourceType: overrides.resourceType || 'hard',
        resourceId: overrides.resourceId,
        name: overrides.name || 'Resource',
        subCategory: overrides.subCategory || 'Community care',
        address: overrides.address || '1 Test Street',
        mapShortDescriptors: overrides.mapShortDescriptors || [],
        notes: overrides.notes || { items: [] },
        ...overrides,
    };
}

test('asset ledger includes saved assets, personal places, and every formatted short description', () => {
    const ledger = buildMyMapAssetLedger({
        directory: {
            name: 'Jurong partners',
            categoryOrder: ['personal places', 'community care'],
        },
        presentation: {
            mappedGroups: [{
                placeKey: 'place-1',
                number: 7,
                name: 'Mapped place',
                postalCode: '012345',
                rows: [
                    row({
                        resourceId: 1,
                        name: 'AAC One',
                        mapShortDescriptors: [
                            { id: 11, text: 'Morning programme', textColor: '#0f766e', highlightColor: '#dcfce7', sortOrder: 0 },
                            { id: 12, text: 'Wheelchair access', textColor: '#1d4ed8', highlightColor: null, sortOrder: 1 },
                        ],
                        notes: { items: [{ text: 'Private owner note', isShared: false }] },
                    }),
                    row({
                        resourceType: 'personal_place',
                        resourceId: 9,
                        assetKey: 'personal-place-9',
                        name: 'My activity room',
                        subCategory: 'Personal places',
                        postalCode: '600347',
                        mapShortDescriptors: [{ text: 'Call before visiting', sortOrder: 0 }],
                    }),
                ],
            }],
        },
    });

    assert.equal(ledger.summary.assetCount, 2);
    assert.equal(ledger.summary.personalPlaceCount, 1);
    assert.equal(ledger.summary.descriptionCount, 3);
    assert.deepEqual(ledger.categories.map((category) => category.name), [
        'Personal places',
        'Community care',
    ]);
    assert.deepEqual(ledger.assets.find((asset) => asset.assetKey === 'hard-1').descriptions, [
        { text: 'Morning programme', textColor: '#0F766E', highlightColor: '#DCFCE7', sortOrder: 0 },
        { text: 'Wheelchair access', textColor: '#1D4ED8', highlightColor: null, sortOrder: 1 },
    ]);
    assert.equal(Object.hasOwn(ledger.assets[0], 'notes'), false);

    const workbookRows = buildMyMapAssetWorkbookRows(ledger);
    assert.equal(workbookRows.assets.length, 2);
    assert.equal(workbookRows.descriptions.length, 3);
    assert.equal(workbookRows.assets.find((asset) => asset['Resource name'] === 'AAC One').Type, 'Place');
    assert.equal(workbookRows.assets.find((asset) => asset['Resource name'] === 'My activity room').Type, 'Personal place');
    assert.equal(workbookRows.assets.find((asset) => asset['Resource name'] === 'AAC One')['Postal code'], '012345');
    assert.equal(workbookRows.assets.find((asset) => asset['Resource name'] === 'My activity room')['Postal code'], '600347');
    assert.doesNotMatch(JSON.stringify(workbookRows), /Private owner note/);
});

test('Excel text neutralizes formula-like user content', () => {
    assert.equal(toSafeExcelText('=HYPERLINK("https://unsafe.example")'), '\'=HYPERLINK("https://unsafe.example")');
    assert.equal(toSafeExcelText('  +1+1'), '\'  +1+1');
    assert.equal(toSafeExcelText('Normal text'), 'Normal text');
});
