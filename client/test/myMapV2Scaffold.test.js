import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    MY_MAP_UI_MODE_STABLE,
    MY_MAP_UI_MODE_V2,
    buildStableMyMapSearchParams,
    getMyMapUiMode,
} from '../src/lib/myMapUiMode.js';

const myMapDetailPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);

const myMapV2ScaffoldSource = readFileSync(
    new URL('../src/components/MyMapV2PreviewScaffold.jsx', import.meta.url),
    'utf8',
);
const directoryPrintViewSource = readFileSync(
    new URL('../src/components/DirectoryPrintView.jsx', import.meta.url),
    'utf8',
);
const appSource = readFileSync(
    new URL('../src/App.jsx', import.meta.url),
    'utf8',
);

test('my map ui mode defaults to v2 unless the explicit stable fallback switch is present', () => {
    assert.equal(getMyMapUiMode(new URLSearchParams()), MY_MAP_UI_MODE_V2);
    assert.equal(getMyMapUiMode(new URLSearchParams('ui=stable')), MY_MAP_UI_MODE_STABLE);
    assert.equal(getMyMapUiMode(new URLSearchParams('ui=preview')), MY_MAP_UI_MODE_V2);
    assert.equal(getMyMapUiMode(new URLSearchParams('ui=v2')), MY_MAP_UI_MODE_V2);
});

test('stable my map search params preserve route state while opting into the classic fallback', () => {
    const params = buildStableMyMapSearchParams(new URLSearchParams('ui=v2&view=print&foo=bar'));

    assert.equal(params.get('ui'), MY_MAP_UI_MODE_STABLE);
    assert.equal(params.get('view'), 'print');
    assert.equal(params.get('foo'), 'bar');
});

test('my map detail routes v2 by default while print view keeps priority', () => {
    assert.match(myMapDetailPageSource, /import MyMapV2PreviewScaffold/);
    assert.match(myMapDetailPageSource, /getMyMapUiMode\(searchParams\)/);
    assert.match(myMapDetailPageSource, /myMapUiMode === MY_MAP_UI_MODE_V2 && !isPrintView/);
    assert.match(myMapDetailPageSource, /if \(isV2View\) \{/);
    assert.match(myMapDetailPageSource, /<MyMapV2PreviewScaffold/);
});

test('my map v2 scaffold reuses the existing presentation stack and delegates the toolbar', () => {
    assert.match(myMapV2ScaffoldSource, /import DirectoryMap from '\.\/DirectoryMap\.jsx';/);
    assert.match(myMapV2ScaffoldSource, /import SharedMapDirectoryList from '\.\/SharedMapDirectoryList\.jsx';/);
    assert.match(myMapV2ScaffoldSource, /toolbar = null/);
    assert.match(myMapV2ScaffoldSource, /\{toolbar\}/);
    assert.match(myMapV2ScaffoldSource, /data-my-map-ui="v2"/);
    assert.match(myMapV2ScaffoldSource, /!\s*useDesktopLayout \? \(/);
    assert.match(myMapV2ScaffoldSource, /useDesktopLayout \? \(/);
    assert.match(myMapDetailPageSource, /toolbar=\{useDesktopOwnerLayout \? \(/);
    assert.match(myMapDetailPageSource, /<OwnerHeader/);
    assert.match(myMapDetailPageSource, /<MyMapMobileControls/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /DirectorySearchBar/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /DirectoryDistanceControls/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /Map view/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /Classic view/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /from '\.\.\/lib\/api\.js'/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /\bapi\./);
});

test('my map v2 uses the main saved-place pin style while stable my map keeps numbered pins', () => {
    assert.match(myMapV2ScaffoldSource, /markerMode="count"/);
    assert.match(myMapV2ScaffoldSource, /pinBadgeMode="none"/);
    assert.match(myMapV2ScaffoldSource, /pinCategoryIconMode="none"/);
    assert.match(myMapV2ScaffoldSource, /clusterMarkerMode="none"/);
    assert.match(myMapV2ScaffoldSource, /cardBadgeMode="logo"/);
    assert.match(myMapV2ScaffoldSource, /showMapLegend=\{false\}/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /clusterMarkerMode="asset-spread"/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /markerMode="number"/);
    assert.match(myMapDetailPageSource, /markerMode="number"/);
});

test('owner print can use V2 print cards without hiding the app toolbar or changing shared print', () => {
    assert.match(directoryPrintViewSource, /const useV2OwnerPrint = mode === 'owner'/);
    assert.match(directoryPrintViewSource, /presentationMode: useV2OwnerPrint \? 'v2-cards' : 'default'/);
    assert.match(directoryPrintViewSource, /withOwnerPrintBadgePins\(basePresentation\)/);
    assert.match(directoryPrintViewSource, /markerMode=\{useV2Format \? 'print-badge' : 'number'\}/);
    assert.match(directoryPrintViewSource, /pinBadgeMode=\{useV2Format \? 'none' : 'count'\}/);
    assert.match(directoryPrintViewSource, /clusterMarkerMode=\{useV2Format \? 'none' : 'bubble'\}/);
    assert.match(directoryPrintViewSource, /spreadCoincidentPins=\{!useV2Format\}/);
    assert.match(directoryPrintViewSource, /cardBadgeMode=\{useV2OwnerPrint \? 'logo' : 'number'\}/);
    assert.match(directoryPrintViewSource, /showPrintNumberBadges=\{useV2OwnerPrint\}/);
    assert.match(directoryPrintViewSource, /showMapLegend=\{!useV2OwnerPrint\}/);
    assert.doesNotMatch(directoryPrintViewSource, /pinSpreadMode/);
    assert.doesNotMatch(appSource, /ownerPrintView/);
    assert.match(appSource, /location\.pathname\.startsWith\('\/shared\/maps\/'\)/);
});

test('owner print builds one composite badge pin per mapped V2 coordinate group', () => {
    assert.match(directoryPrintViewSource, /function withOwnerPrintBadgePins/);
    assert.match(directoryPrintViewSource, /presentation\?\.displayGroups\?\.length/);
    assert.match(directoryPrintViewSource, /const mappedBadgeGroups = displayGroups\.filter/);
    assert.match(directoryPrintViewSource, /lat\.toFixed\(4\)/);
    assert.match(directoryPrintViewSource, /lng\.toFixed\(4\)/);
    assert.match(directoryPrintViewSource, /PRINT_BADGE_COORDINATE_GROUPING_TOLERANCE/);
    assert.match(directoryPrintViewSource, /function shouldSharePrintBadgeCoordinate/);
    assert.match(directoryPrintViewSource, /const existingCoordinateEntry = \[\.\.\.groupsByCoordinate\.entries\(\)\]\.find/);
    assert.match(directoryPrintViewSource, /const coordinateGroupEntries = \[\.\.\.groupsByCoordinate\.entries\(\)\]/);
    assert.match(directoryPrintViewSource, /const compositePlaceKey = groups\.length > 1/);
    assert.match(directoryPrintViewSource, /pinKey: groups\.length > 1 \? `print:\$\{coordinateKey\}` : `print:\$\{firstGroup\.placeKey\}`/);
    assert.match(directoryPrintViewSource, /placeKey: compositePlaceKey/);
    assert.match(directoryPrintViewSource, /printBadgeItems: groups\.map/);
    assert.match(directoryPrintViewSource, /memberPlaceKeys/);
    assert.match(directoryPrintViewSource, /hoverPlaceKeysByKey\[compositePlaceKey\] = memberPlaceKeys/);
    assert.match(directoryPrintViewSource, /groupKeyByPlaceKey\[memberPlaceKey\] = compositePlaceKey/);
    assert.match(directoryPrintViewSource, /getPrintHoverPlaceKeys\(resolvedPlaceKey\)/);
});

test('my map v2 uses the dedicated V2 card-ordering presentation', () => {
    assert.match(myMapDetailPageSource, /presentationMode: 'v2-cards'/);
    assert.match(myMapDetailPageSource, /const ownerPresentation = isV2View \? v2Presentation : interactivePresentation/);
    assert.match(myMapDetailPageSource, /presentation=\{v2Presentation\}/);
    assert.match(myMapDetailPageSource, /ownerPresentation\.hoverPlaceKeysByKey/);
    assert.match(myMapDetailPageSource, /focusPlaceOnMap\(placeKey\)[\s\S]*ownerPresentation\.groupKeyByPlaceKey/);
});

test('my map v2 enriches directory rows with configured category colors from the shared category metadata', () => {
    assert.match(myMapDetailPageSource, /function applySubCategoryMetaToDirectory/);
    assert.match(myMapDetailPageSource, /function applySubCategoryMetaToRow/);
    assert.match(myMapDetailPageSource, /api\.getSubCategories\(\{ suppressAuthExpired: true \}\)\.catch\(\(\) => \[\]\)/);
    assert.match(myMapDetailPageSource, /const enrichedDirectory = applySubCategoryMetaToDirectory\(item, subcategories\)/);
    assert.match(myMapDetailPageSource, /setDirectory\(await backfillMissingHardPlaceAddresses\(enrichedDirectory\)\)/);
    assert.match(myMapDetailPageSource, /categoryColor: nextCategoryColor/);
    assert.match(myMapDetailPageSource, /categoryIconUrl: nextCategoryIconUrl/);
});

test('my map v2 backfills missing hard-place addresses without touching map ownership or auth paths', () => {
    assert.match(myMapDetailPageSource, /function getMissingHardAddressIds/);
    assert.match(myMapDetailPageSource, /function applyHardAddressBackfillsToDirectory/);
    assert.match(myMapDetailPageSource, /async function backfillMissingHardPlaceAddresses/);
    assert.match(myMapDetailPageSource, /row\?\.resourceType !== 'hard' \|\| row\?\.status === 'unavailable'/);
    assert.match(myMapDetailPageSource, /api\.getHardAsset\(id, \{ suppressAuthExpired: true \}\)\.catch\(\(\) => null\)/);
    assert.match(myMapDetailPageSource, /addressByHardAssetId\.set\(missingHardAddressIds\[index\], address\)/);
    assert.match(myMapDetailPageSource, /address: rowAddress/);
});

test('my map v2 uses the restored normal map sizing without enabling full-map mode', () => {
    assert.match(myMapV2ScaffoldSource, /V2_DESKTOP_MAP_HEIGHT_CLASS = 'h-\[48vh\] min-h-\[440px\] max-h-\[700px\]'/);
    assert.match(myMapV2ScaffoldSource, /V2_MOBILE_MAP_HEIGHT_CLASS = 'h-\[34svh\] min-h-\[260px\] max-h-\[390px\]'/);
    assert.match(myMapV2ScaffoldSource, /V2_FIT_PADDING_BOTTOM_RIGHT = \[44, 24\]/);
    assert.match(myMapV2ScaffoldSource, /fitPaddingBottomRight=\{V2_FIT_PADDING_BOTTOM_RIGHT\}/);
    assert.match(myMapV2ScaffoldSource, /V2_DESKTOP_GRID_CLASS = 'lg:grid-cols-\[minmax\(300px,0\.85fr\)_minmax\(520px,1\.4fr\)_minmax\(340px,0\.95fr\)\]/);
    assert.match(myMapV2ScaffoldSource, /xl:grid-cols-\[minmax\(320px,0\.85fr\)_minmax\(620px,1\.45fr\)_minmax\(360px,0\.95fr\)\]/);
    assert.match(myMapV2ScaffoldSource, /2xl:grid-cols-\[minmax\(360px,0\.9fr\)_minmax\(760px,1\.55fr\)_minmax\(400px,1fr\)\]'/);
    assert.match(myMapV2ScaffoldSource, /desktopGridClassName=\{V2_DESKTOP_GRID_CLASS\}/);
    assert.match(myMapV2ScaffoldSource, /renderDesktopMap=\{\(\) => renderMap\(V2_DESKTOP_MAP_HEIGHT_CLASS\)\}/);
    assert.match(myMapV2ScaffoldSource, /renderMobileMap=\{\(\) => renderMap\(V2_MOBILE_MAP_HEIGHT_CLASS\)\}/);
});

test('my map v2 does not expose the rejected full-map experiment', () => {
    assert.doesNotMatch(myMapV2ScaffoldSource, /Full map/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /Exit full map/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /data-my-map-v2-full-map/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /compactPinCards/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /pinCardMode/);
});
