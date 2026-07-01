import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filterPanelSource = readFileSync(resolve(__dirname, '../src/features/discover/DiscoveryFilterPanel.jsx'), 'utf8');
const discoverPageSource = readFileSync(resolve(__dirname, '../src/pages/DiscoverPage.jsx'), 'utf8');
const locationHookSource = readFileSync(resolve(__dirname, '../src/features/discover/useDiscoveryLocation.js'), 'utf8');

test('Discover tools keep text search above location search without service area filtering', () => {
    const desktopPanelStart = filterPanelSource.indexOf('function DesktopFilterPanel');
    const desktopPanelEnd = filterPanelSource.indexOf('export function DiscoveryFilterPanel');
    const desktopPanelSource = filterPanelSource.slice(desktopPanelStart, desktopPanelEnd);

    const nameSearchIndex = desktopPanelSource.indexOf("placeholder={t('discoverySearchPlaceholder')}");
    const postalSearchIndex = desktopPanelSource.indexOf('id="postal-input"');

    assert.ok(nameSearchIndex > -1, 'desktop name search should render');
    assert.ok(postalSearchIndex > -1, 'desktop postal search should render');
    assert.ok(nameSearchIndex < postalSearchIndex, 'name search should appear before postal search');
    assert.doesNotMatch(filterPanelSource, /selectedDiscoverySubregionId/);
    assert.doesNotMatch(filterPanelSource, /setSelectedDiscoverySubregion/);
    assert.doesNotMatch(filterPanelSource, /discoveryServiceArea/);
    assert.doesNotMatch(filterPanelSource, /discoveryAreaLimited/);
    assert.match(discoverPageSource, /const canUseDiscoverySubregions = false;/);
});

test('Discover postal search applies automatically and no longer exposes radius filtering', () => {
    assert.match(locationHookSource, /normalizedPostalInput\.length !== 6/);
    assert.match(locationHookSource, /void applyPostalSearch\(normalizedPostalInput/);

    assert.doesNotMatch(discoverPageSource, /resource\._distance <= searchRadius/);
    assert.doesNotMatch(filterPanelSource, /setSearchRadius/);
    assert.doesNotMatch(filterPanelSource, /value=\{searchRadius\}/);
    assert.doesNotMatch(filterPanelSource, /type="submit"/);
});

test('Discover mobile map mode uses Browse as the only header action', () => {
    const mapHeaderStart = filterPanelSource.indexOf("t('discoveryMapView')");
    const mapHeaderEnd = filterPanelSource.indexOf('{savedAssetCount > 0 && unmappableSavedCount > 0', mapHeaderStart);
    const mapHeaderSource = filterPanelSource.slice(mapHeaderStart, mapHeaderEnd);

    assert.ok(mapHeaderStart > -1, 'mobile map header should render');
    assert.ok(mapHeaderEnd > mapHeaderStart, 'mobile map header should include the map action block');
    assert.match(mapHeaderSource, /onClick=\{onOpenBrowse\}/);
    assert.match(mapHeaderSource, /t\('discoveryBrowse'\)/);
    assert.doesNotMatch(mapHeaderSource, /onOpenMobileBrowseDrawer/);
    assert.doesNotMatch(mapHeaderSource, /setMobileFiltersOpen\(true\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryList'\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryFilter'\)/);
    assert.doesNotMatch(discoverPageSource, /mobileBrowseDrawerOpen/);
    assert.doesNotMatch(discoverPageSource, /onOpenMobileBrowseDrawer/);
});
