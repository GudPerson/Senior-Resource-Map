import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filterPanelSource = readFileSync(resolve(__dirname, '../src/features/discover/DiscoveryFilterPanel.jsx'), 'utf8');
const discoverPageSource = readFileSync(resolve(__dirname, '../src/pages/DiscoverPage.jsx'), 'utf8');
const locationHookSource = readFileSync(resolve(__dirname, '../src/features/discover/useDiscoveryLocation.js'), 'utf8');

test('Discover desktop tools keep text and area search above location search', () => {
    const desktopPanelStart = filterPanelSource.indexOf('function DesktopFilterPanel');
    const desktopPanelEnd = filterPanelSource.indexOf('export function DiscoveryFilterPanel');
    const desktopPanelSource = filterPanelSource.slice(desktopPanelStart, desktopPanelEnd);

    const nameSearchIndex = desktopPanelSource.indexOf("placeholder={t('discoverySearchPlaceholder')}");
    const areaSelectIndex = desktopPanelSource.indexOf('value={selectedDiscoverySubregionId}');
    const postalSearchIndex = desktopPanelSource.indexOf('id="postal-input"');

    assert.ok(nameSearchIndex > -1, 'desktop name search should render');
    assert.ok(areaSelectIndex > -1, 'desktop area search should render');
    assert.ok(postalSearchIndex > -1, 'desktop postal search should render');
    assert.ok(nameSearchIndex < postalSearchIndex, 'name search should appear before postal search');
    assert.ok(areaSelectIndex < postalSearchIndex, 'area search should appear before postal search');
});

test('Discover postal search applies automatically and no longer exposes radius filtering', () => {
    assert.match(locationHookSource, /normalizedPostalInput\.length !== 6/);
    assert.match(locationHookSource, /void applyPostalSearch\(normalizedPostalInput/);

    assert.doesNotMatch(discoverPageSource, /resource\._distance <= searchRadius/);
    assert.doesNotMatch(filterPanelSource, /setSearchRadius/);
    assert.doesNotMatch(filterPanelSource, /value=\{searchRadius\}/);
    assert.doesNotMatch(filterPanelSource, /type="submit"/);
});
