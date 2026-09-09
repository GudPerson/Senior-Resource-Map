import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filterPanelSource = readFileSync(resolve(__dirname, '../src/features/discover/DiscoveryFilterPanel.jsx'), 'utf8');
const categoryLayerSource = readFileSync(resolve(__dirname, '../src/features/discover/DiscoveryCategoryLayerControl.jsx'), 'utf8');
const discoverPageSource = readFileSync(resolve(__dirname, '../src/pages/DiscoverPage.jsx'), 'utf8');
const discoveryMapSource = readFileSync(resolve(__dirname, '../src/features/discover/DiscoveryMap.jsx'), 'utf8');
const locationHookSource = readFileSync(resolve(__dirname, '../src/features/discover/useDiscoveryLocation.js'), 'utf8');

test('Discovery uses the supplied layer PNG unchanged with a softer, inset presentation', () => {
    const icon = readFileSync(resolve(__dirname, '../src/assets/discovery-category-layer.png'));
    assert.equal(createHash('sha256').update(icon).digest('hex'), 'ee611a27d0de2d2e56b499e8ad0e2b9a39a66d6bd32681e7977149d219c41665');
    assert.match(categoryLayerSource, /scale-110 object-contain opacity-60/);
});

test('Discovery keeps every map control in a stationary sibling overlay on all screen sizes', () => {
    const controlStack = discoveryMapSource.slice(discoveryMapSource.indexOf('function DiscoveryMapControlStack'), discoveryMapSource.indexOf('export function DiscoveryMap'));
    const overlay = discoveryMapSource.indexOf('className="carearound-discovery-control-overlay');
    assert.match(controlStack, /return createPortal\(/);
    assert.match(controlStack, /portalTarget,/);
    assert.doesNotMatch(controlStack, /leaflet-top/);
    assert.ok(overlay > discoveryMapSource.indexOf('</MapContainer>'));
    assert.match(discoveryMapSource, /portalTarget=\{controlPortalTarget\}/);
});

test('Discovery fits below the fixed navbar independently of accessible text size', () => {
    assert.match(discoverPageSource, /h-\[calc\(100dvh-57px\)\]/);
    assert.match(discoverPageSource, /sm:h-\[calc\(100dvh-65px\)\]/);
    assert.doesNotMatch(discoverPageSource, /100vh-4rem/);
    assert.match(categoryLayerSource, /focus\(\{ preventScroll: true \}\)/);
});

test('Discovery settings and category dialogs stay above Leaflet zoom and reset controls', () => {
    // Leaflet controls create stacking contexts at 800. A child dialog cannot
    // escape a lower dock, regardless of its own z-index of 1010.
    assert.match(discoveryMapSource, /className="absolute right-3 top-3 z-\[1000\][^"\n]*"\s+data-discovery-map-control-dock/);
});

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

test('Discover keeps category pin layers on the map and leaves browse results independent', () => {
    assert.doesNotMatch(filterPanelSource, /CategoryCheckboxFilter/);
    assert.doesNotMatch(filterPanelSource, /categoryOptions/);
    assert.doesNotMatch(filterPanelSource, /selectedCategoryKeys/);
    assert.doesNotMatch(filterPanelSource, /onChangeCategorySelection/);

    assert.match(categoryLayerSource, /data-discovery-category-layer-control="true"/);
    assert.match(categoryLayerSource, /type="checkbox"/);
    assert.match(categoryLayerSource, /data-discovery-category-layer-empty="true"/);
    assert.match(categoryLayerSource, /aria-expanded=\{open\}/);
    assert.match(categoryLayerSource, /<MobileBottomSheet/);
    assert.match(categoryLayerSource, /onOpenChange=\{handleMobileOpenChange\}/);
    assert.match(categoryLayerSource, /data-discovery-category-layer-glyph="true"/);
    assert.match(categoryLayerSource, /src=\{categoryLayerImage\}/);
    assert.doesNotMatch(categoryLayerSource.slice(0, categoryLayerSource.indexOf('function CloseButton')), /<(Layers3|MapPin|Heart)\b/);
    assert.match(categoryLayerSource, /className="pointer-events-auto relative flex h-full items-center"/);

    assert.match(discoverPageSource, /buildSavedPinCategoryOptions/);
    assert.match(discoverPageSource, /filterSavedPinsByCategoryKeys/);
    assert.match(discoverPageSource, /const filteredUniverse = filteredUniverseBeforeCategories;/);
    assert.match(discoverPageSource, /selectedMapCategoryKeys=\{effectiveSelectedMapCategoryKeys\}/);
    assert.match(discoverPageSource, /categoryOptions=\{savedPinCategoryOptions\}/);
    assert.match(discoverPageSource, /const revealAllSavedPins = !targetVisible/);
    assert.match(discoverPageSource, /setSelectedMapCategoryKeys\(\[\]\)/);
    assert.match(discoveryMapSource, /<DiscoveryCategoryLayerControl/);
    assert.match(discoveryMapSource, /className="absolute right-3 top-3[^"\n]*items-center[^"\n]*"\s+data-discovery-map-control-dock="true"/);
    assert.doesNotMatch(discoverPageSource, /filterDiscoveryResourcesByCategoryKeys/);
    assert.doesNotMatch(discoverPageSource, /categoryFilteredSavedAssets/);
});

test('Discover mobile map mode uses Browse as the only header action', () => {
    const mapHeaderStart = filterPanelSource.indexOf("t('discoveryMapView')");
    const mapHeaderEnd = filterPanelSource.indexOf('<MobileFilterSheet', mapHeaderStart);
    const mapHeaderSource = filterPanelSource.slice(mapHeaderStart, mapHeaderEnd);

    assert.ok(mapHeaderStart > -1, 'mobile map header should render');
    assert.ok(mapHeaderEnd > mapHeaderStart, 'mobile map header should include the map action block');
    assert.match(mapHeaderSource, /onClick=\{onOpenBrowse\}/);
    assert.match(mapHeaderSource, /t\('discoveryBrowse'\)/);
    assert.match(mapHeaderSource, /t\('discoveryMapShowingSavedPlaces'/);
    assert.doesNotMatch(mapHeaderSource, /onOpenMobileBrowseDrawer/);
    assert.doesNotMatch(mapHeaderSource, /setMobileFiltersOpen\(true\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryList'\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryFilter'\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryMapHintWithPins'\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryMapHintNoPins'\)/);
    assert.doesNotMatch(mapHeaderSource, /t\('discoveryUnmappedSavedNotice'\)/);
    assert.doesNotMatch(discoverPageSource, /mobileBrowseDrawerOpen/);
    assert.doesNotMatch(discoverPageSource, /onOpenMobileBrowseDrawer/);
    assert.doesNotMatch(filterPanelSource, /unmappableSavedCount/);
});
