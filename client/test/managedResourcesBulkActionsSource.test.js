import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resourcesPageSource = readFileSync(
    new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url),
    'utf8',
);

test('Manage Resources exposes a Region filter on resource tabs', () => {
    assert.match(resourcesPageSource, /aria-label="Filter resources by Region"/);
    assert.match(resourcesPageSource, /buildManagedRegionFilterOptions\(subregions\)/);
    assert.match(resourcesPageSource, /filterAssetWithQuery\(asset, normalizedQuery, boundaryChecksEnabled, boundaryFilter, regionFilter\)/);
    assert.match(resourcesPageSource, /shouldUseFullResourceDataset\(\{[\s\S]*regionFilter,/);
});

test('Manage Resources bulk controls target every filtered results page', () => {
    assert.match(resourcesPageSource, /prepareManagedBulkAction\('hide'\)/);
    assert.match(resourcesPageSource, /prepareManagedBulkAction\('show'\)/);
    assert.match(resourcesPageSource, /prepareManagedBulkAction\('save'\)/);
    assert.match(resourcesPageSource, /prepareManagedBulkAction\('unsave'\)/);
    assert.match(resourcesPageSource, /Applies to all \{activeFilteredExportCount\.toLocaleString\('en-SG'\)\} filtered results across every page/);
    assert.match(resourcesPageSource, /resolveActiveFilteredAssetsForBulkAction/);
    assert.match(resourcesPageSource, /fullHardResourceListParams/);
    assert.match(resourcesPageSource, /fullSoftResourceListParams/);
    assert.match(resourcesPageSource, /fullGroupResourceListParams/);
});

test('bulk visibility keeps existing per-resource permission and update contracts', () => {
    assert.match(resourcesPageSource, /const canHide = resourceType === 'hard' \? canHideHardAsset : canHideSoftAsset/);
    assert.match(resourcesPageSource, /MANAGED_BULK_VISIBILITY_CONCURRENCY = 2/);
    assert.match(resourcesPageSource, /api\.updateHardAsset\(asset\.id, buildHardVisibilityPayload\(asset, nextHidden\)\)/);
    assert.match(resourcesPageSource, /api\.updateSoftAsset\(asset\.id, buildSoftVisibilityPayload\(asset, nextHidden\)\)/);
    assert.match(resourcesPageSource, /You will confirm before anything changes/);
    assert.match(resourcesPageSource, /skippedForPermission/);
});

test('bulk save and unsave reuse the shared saved-resource provider', () => {
    assert.match(resourcesPageSource, /bulkSaveSavedAssets\(dialog\.targets\)/);
    assert.match(resourcesPageSource, /bulkRemoveSavedAssets\(dialog\.targets\)/);
    assert.match(resourcesPageSource, /savedAssetsLoadError/);
    assert.match(resourcesPageSource, /savedAssetsLoading/);
});
