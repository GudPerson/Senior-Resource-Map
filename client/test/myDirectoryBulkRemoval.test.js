import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const directorySource = fs.readFileSync(new URL('../src/pages/MyDirectoryPage.jsx', import.meta.url), 'utf8');
const cardSource = fs.readFileSync(new URL('../src/components/SavedAssetCard.jsx', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');

test('My Directory offers map-aware saved-resource filtering on desktop and mobile', () => {
    assert.match(directorySource, /saved-assets-map-usage/);
    assert.match(directorySource, /saved-assets-map-usage-mobile/);
    assert.match(directorySource, /filterSavedAssetsByMapUsage/);
    assert.match(directorySource, /usedInMyMapsFilter/);
    assert.match(directorySource, /notUsedInMyMapsFilter/);
});

test('bulk selection excludes mapped resources and exposes explicit removal controls', () => {
    assert.match(directorySource, /selectUnusedSavedAssets/);
    assert.match(directorySource, /selectionDisabled=\{getSavedAssetMapUsageCount/);
    assert.match(directorySource, /selectAllVisibleUnusedAssets/);
    assert.match(directorySource, /handleBulkRemoveSavedAssets/);
    assert.match(cardSource, /protectedByMyMap/);
    assert.match(cardSource, /disabled=\{selectionDisabled\}/);
});

test('client calls private map-usage and guarded bulk-removal endpoints', () => {
    assert.match(apiSource, /getSavedAssetMapUsage:.*\/favorites\/map-usage/);
    assert.match(apiSource, /bulkRemoveUnusedSavedAssets:.*\/favorites\/bulk-remove-unused/);
});
