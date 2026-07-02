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
const navbarSource = readFileSync(
    new URL('../src/components/layout/Navbar.jsx', import.meta.url),
    'utf8',
);
const mobileBottomSheetSource = readFileSync(
    new URL('../src/components/mobile/MobileBottomSheet.jsx', import.meta.url),
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
    assert.match(myMapDetailPageSource, /my-map:no-default/);
    assert.match(myMapDetailPageSource, /defaultActiveMode: null/);
});

test('my map v2 scaffold reuses the existing presentation stack and delegates the toolbar', () => {
    assert.match(myMapV2ScaffoldSource, /import DirectoryMap from '\.\/DirectoryMap\.jsx';/);
    assert.match(myMapV2ScaffoldSource, /import SharedMapDirectoryList from '\.\/SharedMapDirectoryList\.jsx';/);
    assert.match(myMapV2ScaffoldSource, /toolbar = null/);
    assert.match(myMapV2ScaffoldSource, /\{toolbar\}/);
    assert.match(myMapV2ScaffoldSource, /data-my-map-ui="v2"/);
    assert.match(myMapV2ScaffoldSource, /!\s*useDesktopLayout \? \(/);
    assert.match(myMapV2ScaffoldSource, /useDesktopLayout \? \(/);
    assert.match(myMapV2ScaffoldSource, /useDesktopBodyLayout = useDesktopLayout/);
    assert.match(myMapV2ScaffoldSource, /layout=\{useDesktopBodyLayout \? 'desktop' : 'responsive'\}/);
    assert.match(myMapV2ScaffoldSource, /onHoverPlaceStart=\{onHoverPlaceStart\}/);
    assert.match(myMapV2ScaffoldSource, /onHoverPlaceEnd=\{onHoverPlaceEnd\}/);
    assert.match(myMapDetailPageSource, /toolbar=\{useDesktopOwnerLayout \? \(/);
    assert.match(myMapDetailPageSource, /const useDesktopOwnerLayout = useMediaQuery\('\(min-width: 1024px\)'\)/);
    assert.match(myMapDetailPageSource, /const useDesktopDirectoryBodyLayout = useMediaQuery\('\(min-width: 1024px\)'\)/);
    assert.match(myMapDetailPageSource, /useDesktopBodyLayout=\{useDesktopDirectoryBodyLayout\}/);
    assert.match(myMapDetailPageSource, /<OwnerHeader/);
    assert.match(myMapDetailPageSource, /<MyMapMobileControls/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /DirectorySearchBar/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /DirectoryDistanceControls/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /Map view/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /Classic view/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /from '\.\.\/lib\/api\.js'/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /\bapi\./);
});

test('my map v2 mobile chrome stays compact in normal flow above the scrolling map', () => {
    const mobileControlsSource = myMapDetailPageSource.slice(
        myMapDetailPageSource.indexOf('function MyMapMobileControls'),
        myMapDetailPageSource.indexOf('function EmptyOwnerDirectory'),
    );

    assert.match(mobileControlsSource, /compactOverlay = false/);
    assert.match(navbarSource, /hc-nav sticky top-0 z-\[1200\]/);
    assert.match(mobileBottomSheetSource, /Drawer\.Overlay className="fixed inset-0 z-\[1600\]/);
    assert.match(mobileBottomSheetSource, /className=\{`fixed bottom-0 left-0 right-0 z-\[1610\]/);
    assert.match(mobileControlsSource, /z-\[1100\] -mx-4 flex h-11/);
    assert.match(mobileControlsSource, /bg-slate-50\/95/);
    assert.match(mobileControlsSource, /inline-flex h-8 w-10/);
    assert.match(mobileControlsSource, /rounded-full/);
    assert.doesNotMatch(mobileControlsSource, /mb-\[-44px\]/);
    assert.doesNotMatch(mobileControlsSource, /mb-\[-48px\]/);
    assert.doesNotMatch(mobileControlsSource, /z-40 -mx-4 flex h-11/);
    assert.match(mobileControlsSource, /Drawer\.Overlay className="fixed inset-0 z-\[1200\]/);
    assert.match(mobileControlsSource, /className="fixed bottom-0 left-0 top-\[56px\] z-\[1210\]/);
    assert.match(myMapDetailPageSource, /renderPdfExportButton=\{renderPdfExportButton\}\s+compactOverlay/);
    assert.match(myMapV2ScaffoldSource, /mobileMapStickyClassName="sticky top-\[56px\] sm:top-\[64px\] z-\[1090\]/);
    assert.match(myMapDetailPageSource, /mobileMapStickyClassName="sticky top-\[56px\] sm:top-\[64px\] z-\[1090\]/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /mobileMapStickyClassName="[^"]*disable-font-scaling/);
    assert.doesNotMatch(myMapDetailPageSource, /mobileMapStickyClassName="[^"]*disable-font-scaling/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /mobileMapStickyClassName="sticky top-\[100px\] sm:top-\[112px\]/);
    assert.doesNotMatch(myMapDetailPageSource, /mobileMapStickyClassName="sticky top-\[100px\] sm:top-\[112px\]/);
    assert.doesNotMatch(myMapDetailPageSource, /mobileMapStickyClassName="sticky top-\[116px\] sm:top-\[132px\]/);
});

test('my map v2 uses category bubble pins while stable my map keeps numbered pins', () => {
    assert.match(myMapV2ScaffoldSource, /markerMode="category-bubble"/);
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

test('owner print screen preview reserves scaled height instead of clipping the map bottom', () => {
    assert.match(directoryPrintViewSource, /const \[previewFrameHeight, setPreviewFrameHeight\] = useState\(null\)/);
    assert.match(directoryPrintViewSource, /new ResizeObserver\(handleResize\)/);
    assert.match(directoryPrintViewSource, /sheetRef\.current\.offsetHeight \* nextScale/);
    assert.match(directoryPrintViewSource, /height: previewFrameHeight \? `\$\{previewFrameHeight\}px` : undefined/);
    assert.match(directoryPrintViewSource, /overflow-x-hidden overflow-y-visible/);
    assert.doesNotMatch(directoryPrintViewSource, /marginBottom: variant === 'screen'/);
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
    assert.match(myMapDetailPageSource, /<SharedMapDirectoryList[\s\S]*onHoverPlaceStart=\{handleMapHoverStart\}[\s\S]*onHoverPlaceEnd=\{handleMapHoverEnd\}/);
});

test('my map v2 enriches directory rows with configured category colors from the shared category metadata', () => {
    assert.match(myMapDetailPageSource, /function applySubCategoryMetaToDirectory/);
    assert.match(myMapDetailPageSource, /function applySubCategoryMetaToRow/);
    assert.match(myMapDetailPageSource, /api\.getSubCategories\(\{ suppressAuthExpired: true \}\)\.catch\(\(\) => \[\]\)/);
    assert.match(myMapDetailPageSource, /const enrichedDirectory = applySubCategoryMetaToDirectory\(item, subcategories\)/);
    assert.match(myMapDetailPageSource, /const addressBackfilledDirectory = await backfillMissingHardPlaceAddresses\(enrichedDirectory\)/);
    assert.match(myMapDetailPageSource, /setDirectory\(await backfillGroupFocusPlaceKeys\(addressBackfilledDirectory\)\)/);
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

test('my map v2 can backfill Group member focus keys from public Group details', () => {
    assert.match(myMapDetailPageSource, /getGroupFocusFallbackResourceIds/);
    assert.match(myMapDetailPageSource, /mergeGroupFocusDetailsIntoDirectory/);
    assert.match(myMapDetailPageSource, /async function backfillGroupFocusPlaceKeys/);
    assert.match(myMapDetailPageSource, /api\.getSoftAsset\(id, \{ suppressAuthExpired: true \}\)\.catch\(\(\) => null\)/);
    assert.match(myMapDetailPageSource, /detail\?\.assetMode === 'group'/);
    assert.match(myMapDetailPageSource, /mergeGroupFocusDetailsIntoDirectory\(directory, groupDetailsByResourceId\)/);
});

test('my map v2 uses the restored normal map sizing without enabling full-map mode', () => {
    assert.match(myMapV2ScaffoldSource, /V2_DESKTOP_MAP_HEIGHT_CLASS = 'h-\[48vh\] min-h-\[440px\] max-h-\[700px\]'/);
    assert.match(myMapV2ScaffoldSource, /V2_MOBILE_MAP_HEIGHT_CLASS = 'h-\[34svh\] min-h-\[260px\] max-h-\[390px\]'/);
    assert.match(myMapV2ScaffoldSource, /V2_FIT_PADDING_BOTTOM_RIGHT = \[44, 24\]/);
    assert.match(myMapV2ScaffoldSource, /fitPaddingBottomRight=\{V2_FIT_PADDING_BOTTOM_RIGHT\}/);
    assert.match(myMapV2ScaffoldSource, /V2_DESKTOP_GRID_CLASS = 'lg:gap-4 lg:grid-cols-\[minmax\(230px,0\.78fr\)_minmax\(430px,1\.32fr\)_minmax\(240px,0\.84fr\)\]/);
    assert.match(myMapV2ScaffoldSource, /xl:gap-5 xl:grid-cols-\[minmax\(320px,0\.85fr\)_minmax\(620px,1\.45fr\)_minmax\(360px,0\.95fr\)\]/);
    assert.match(myMapV2ScaffoldSource, /2xl:grid-cols-\[minmax\(360px,0\.9fr\)_minmax\(760px,1\.55fr\)_minmax\(400px,1fr\)\]'/);
    assert.match(myMapV2ScaffoldSource, /sm:px-6 sm:py-6 lg:px-8 xl:px-10/);
    assert.match(myMapV2ScaffoldSource, /desktopGridClassName=\{V2_DESKTOP_GRID_CLASS\}/);
    assert.match(myMapV2ScaffoldSource, /renderDesktopMap=\{\(\) => renderMap\(V2_DESKTOP_MAP_HEIGHT_CLASS\)\}/);
    assert.match(myMapV2ScaffoldSource, /renderMobileMap=\{\(\) => renderMap\(V2_MOBILE_MAP_HEIGHT_CLASS\)\}/);
});

test('my map v2 does not expose the rejected auto full-map experiment', () => {
    assert.doesNotMatch(myMapV2ScaffoldSource, /data-my-map-v2-full-map/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /compactPinCards/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /pinCardMode/);
});
