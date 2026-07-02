import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sharedMapDirectorySource = readFileSync(
    new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url),
    'utf8',
);
const myMapDetailPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const myMapV2ScaffoldSource = readFileSync(
    new URL('../src/components/MyMapV2PreviewScaffold.jsx', import.meta.url),
    'utf8',
);
const sharedMapPageSource = readFileSync(
    new URL('../src/pages/SharedMapPage.jsx', import.meta.url),
    'utf8',
);
const mobileBottomSheetSource = readFileSync(
    new URL('../src/components/mobile/MobileBottomSheet.jsx', import.meta.url),
    'utf8',
);
const apiSource = readFileSync(
    new URL('../src/lib/api.js', import.meta.url),
    'utf8',
);
const resourceRowIconSource = readFileSync(
    new URL('../src/components/ResourceRowIcon.jsx', import.meta.url),
    'utf8',
);
const appCssSource = readFileSync(
    new URL('../src/index.css', import.meta.url),
    'utf8',
);

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assert.notEqual(start, -1, `${startMarker} should exist`);
    assert.notEqual(end, -1, `${endMarker} should exist`);
    assert.ok(end > start, `${endMarker} should follow ${startMarker}`);
    return source.slice(start, end);
}

test('list-only resource badges use the row logo before falling back to icon artwork', () => {
    assert.match(resourceRowIconSource, /logoUrl\s*=\s*null/);
    assert.match(resourceRowIconSource, /<img[\s\S]*src=\{logoUrl\}/);
    assert.match(sharedMapDirectorySource, /<ResourceRowIcon[\s\S]*logoUrl=\{row\.logoUrl\}/);
});

test('v2 mapped cards can use permanent resource logos while numbered badges stay the default', () => {
    const badgeSource = sourceBetween(
        sharedMapDirectorySource,
        'function DirectoryPlaceBadge',
        'function DirectoryNestedPlaceSection',
    );

    assert.match(sharedMapDirectorySource, /cardBadgeMode = 'number'/);
    assert.match(badgeSource, /badgeMode = 'number'/);
    assert.match(badgeSource, /badgeMode === 'logo'/);
    assert.match(badgeSource, /<ResourceRowIcon[\s\S]*logoUrl=\{resolvedBadgeRow\?\.logoUrl\}/);
    assert.match(sharedMapDirectorySource, /cardBadgeMode=\{cardBadgeMode\}/);
    assert.match(myMapV2ScaffoldSource, /cardBadgeMode="logo"/);
});

test('list-only Group cards can expose a map focus action when mapped member pins exist', () => {
    const badgeSource = sourceBetween(
        sharedMapDirectorySource,
        'function DirectoryPlaceBadge',
        'function DirectoryNestedPlaceSection',
    );

    assert.match(badgeSource, /group\?\.hasCoordinates !== false \|\| group\?\.mapFocusPlaceKeys\?\.length/);
});

test('focusable Group cards render under the desktop map notes area', () => {
    const desktopSource = sourceBetween(
        sharedMapDirectorySource,
        'ref={desktopMapWrapperRef}',
        '<DirectoryGroupColumn\n                        groups={rightGroups}',
    );

    assert.match(sharedMapDirectorySource, /const mapColumnGroups = presentation\?\.mapColumnGroups \|\| \[\]/);
    assert.match(desktopSource, /<MapNotesEntryButton/);
    assert.match(desktopSource, /mapColumnGroups\.length/);
    assert.match(desktopSource, /groups=\{mapColumnGroups\}/);
    assert.ok(
        desktopSource.indexOf('<MapNotesEntryButton') < desktopSource.indexOf('groups={mapColumnGroups}'),
        'map-column Group cards should render below the map notes entry',
    );
});

test('interactive cards hover pins and use card body clicks for map focus only', () => {
    const cardSource = sourceBetween(
        sharedMapDirectorySource,
        'function DirectoryPlaceGroupCard',
        'function DirectoryUnmappedRow',
    );

    assert.match(cardSource, /onMouseEnter: \(\) => onHoverPlaceStart\?\.\(group\.placeKey\)/);
    assert.match(cardSource, /onMouseLeave: \(\) => onHoverPlaceEnd\?\.\(group\.placeKey\)/);
    assert.match(sharedMapDirectorySource, /function isInteractiveCardTarget/);
    assert.match(cardSource, /onViewOnMap\?\.\(group\.placeKey\)/);
    assert.match(cardSource, /fullCardLink && !isPostalGroup && !canFocusCardOnMap/);
    assert.match(sharedMapDirectorySource, /onHoverPlaceStart=\{onHoverPlaceStart\}/);
    assert.match(sharedMapDirectorySource, /onHoverPlaceEnd=\{onHoverPlaceEnd\}/);
});

test('mobile map uses stable page scroll with sticky notes and explicit full-map control', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /mobileMapNotesWrapperClassName/);
    assert.match(mobileSource, /`\$\{mobileMapStickyClassName\} \[overflow-anchor:none\]`/);
    assert.match(sharedMapDirectorySource, /mobileMapStickyClassName = 'sticky top-3 z-20 bg-slate-50 pb-2'/);
    assert.match(mobileSource, /mapHeightClassName: mobileMapElement\.props\?\.mapHeightClassName/);
    assert.match(mobileSource, /layoutSignature: `\$\{mobileMapElement\.props\?\.layoutSignature \|\| 'mobile-map-normal'\}:\$\{mobileMapListFocused \? 'list-focus' : 'default'\}`/);
    assert.match(mobileSource, /openMobileFullMap/);
    assert.match(mobileSource, /t\('openFullMap'\)/);
    assert.match(mobileSource, /<Maximize2/);
    assert.match(mobileSource, /absolute right-3 bottom-3 z-\[1001\]/);
    assert.match(sharedMapDirectorySource, /function useMobileMapOverscrollLock/);
    assert.match(sharedMapDirectorySource, /root\.style\.overscrollBehaviorY = 'none'/);
    assert.match(sharedMapDirectorySource, /document\.body\.style\.overscrollBehaviorY = 'none'/);
    assert.match(sharedMapDirectorySource, /useMobileMapOverscrollLock\(isMobileMapPanelEnabled\)/);
    assert.doesNotMatch(mobileSource, /absolute right-3 top-14 z-\[1001\]/);
    assert.doesNotMatch(sharedMapDirectorySource, /function MobileMapDrawerHandle/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_PANEL_STATES/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_COLLAPSE_SETTLE_MS/);
    assert.doesNotMatch(sharedMapDirectorySource, /getMobileMapPanelActionForScroll/);
    assert.doesNotMatch(sharedMapDirectorySource, /shouldExpandMobileMapPanelFromTopPull/);
    assert.doesNotMatch(sharedMapDirectorySource, /function MobileMapResizeTab/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_ADJUSTABLE_MAP_STEPS/);
    assert.doesNotMatch(mobileSource, /fixed inset-0 z-\[90\] flex items-end/);
    assert.ok(
        mobileSource.indexOf('React.cloneElement(mobileMapElement') < mobileSource.indexOf('<MapNotesEntryButton'),
        'the map should stay above sticky notes in the normal page flow',
    );
});

test('mobile map uses discrete scroll intent without drawer resize mechanics', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(sharedMapDirectorySource, /MOBILE_MAP_HIDE_TOP_PX/);
    assert.match(sharedMapDirectorySource, /MOBILE_MAP_REVEAL_SCROLL_Y/);
    assert.match(sharedMapDirectorySource, /MOBILE_FULL_MAP_PULL_DISTANCE_PX/);
    assert.match(sharedMapDirectorySource, /const \[mobileMapListFocused, setMobileMapListFocused\] = useState\(false\)/);
    assert.match(sharedMapDirectorySource, /mobileMapListFocusedRef\.current = mobileMapListFocused/);
    assert.match(sharedMapDirectorySource, /function shouldHideMobileMapForListFocus/);
    assert.match(sharedMapDirectorySource, /function handleMobileScrollIntent/);
    assert.match(sharedMapDirectorySource, /if \(isMobileMapPanelEnabled\) \{\s*setMobileMapListFocused\(false\);[\s\S]*mobileMapFrameRef\.current\.getBoundingClientRect\(\)\.top[\s\S]*window\.scrollTo\(\{ top: Math\.max\(mapFrameTop, 0\), behavior: 'smooth' \}\);[\s\S]*return undefined;/);
    assert.match(mobileSource, /mobileMapFrameClassName/);
    assert.match(mobileSource, /className=\{mobileMapFrameClassName\}/);
    assert.match(mobileSource, /className=\{mobileCardsClassName\}/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_PANEL_TRANSITION_CLASS/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_PANEL_CONTENT_TRANSITION_CLASS/);
    assert.doesNotMatch(mobileSource, /grid grid-rows-\[0fr\]/);
    assert.doesNotMatch(mobileSource, /grid grid-rows-\[1fr\]/);
    assert.doesNotMatch(mobileSource, /onWheel=\{handleMobileCardsWheel\}/);
    assert.doesNotMatch(mobileSource, /onTouchStart=\{handleMobileCardsTouchStart\}/);
    assert.doesNotMatch(mobileSource, /onTouchMove=\{handleMobileCardsTouchMove\}/);
});

test('mobile map keeps the supplied partial-height map without resize state', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /mapHeightClassName: mobileMapElement\.props\?\.mapHeightClassName/);
    assert.match(mobileSource, /layoutSignature: `\$\{mobileMapElement\.props\?\.layoutSignature \|\| 'mobile-map-normal'\}:\$\{mobileMapListFocused \? 'list-focus' : 'default'\}`/);
    assert.match(mobileSource, /onViewSection: handleMobileMapViewSection/);
    assert.match(mobileSource, /onClusterSelect: handleMobileMapClusterSelect/);
    assert.doesNotMatch(mobileSource, /transition-\[height,min-height,max-height\]/);
    assert.doesNotMatch(sharedMapDirectorySource, /mobileMapSizeStep/);
    assert.doesNotMatch(sharedMapDirectorySource, /setMobileMapSizeStep/);
    assert.doesNotMatch(mobileSource, /const mobileMapFrameHeightClassName/);
    assert.doesNotMatch(mobileSource, /const mobileMapViewportClassName/);
    assert.doesNotMatch(mobileSource, /const mobileMapClipClassName/);
    assert.doesNotMatch(mobileSource, /const mobileMapInnerClassName/);
    assert.doesNotMatch(mobileSource, /mapHeightClassName: mobileMapHeightClassName/);
    assert.doesNotMatch(mobileSource, /layoutSignature: `mobile-map-\$\{mobileMapPanelState\}`/);
});

test('mobile map notes are the only sticky mobile map element', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /\[overflow-anchor:none\]/);
    assert.match(mobileSource, /mobileCardsClassName/);
    assert.match(mobileSource, /className=\{mobileCardsClassName\}/);
    assert.match(mobileSource, /mobileMapNotesWrapperClassName/);
    assert.match(mobileSource, /ref=\{mobileMapWrapperRef\} className=\{mobileMapNotesWrapperClassName\}/);
    assert.match(mobileSource, /<MapNotesEntryButton/);
    assert.doesNotMatch(mobileSource, /mobileMapWrapperClassName/);
    assert.doesNotMatch(mobileSource, /mobileMapLegendClassName/);
    assert.doesNotMatch(mobileSource, /h-0 min-h-0 max-h-0/);
});

test('mobile map focus tray shows selected cards without changing list order', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );
    const traySource = sourceBetween(
        sharedMapDirectorySource,
        'function MobileMapFocusTrayPlaceCard',
        'function DirectoryUnmappedRow',
    );

    assert.match(sharedMapDirectorySource, /function getFocusTrayMemberKeys/);
    assert.match(sharedMapDirectorySource, /function resolveMobileFocusTraySelection/);
    assert.match(sharedMapDirectorySource, /isListOnlyGroupDisplayGroup\(selected\)/);
    assert.match(sharedMapDirectorySource, /memberKeys\.has\(String\(candidate\.placeKey\)\)/);
    assert.match(sharedMapDirectorySource, /candidate\?\.hasCoordinates !== false/);
    assert.match(sharedMapDirectorySource, /return members\.length \? \{ type: 'group', group: selected, members \} : null/);
    assert.match(sharedMapDirectorySource, /pins = \[\]/);
    assert.match(sharedMapDirectorySource, /String\(pin\?\.placeKey \|\| ''\) === normalizedPlaceKey/);
    assert.match(sharedMapDirectorySource, /String\(pin\?\.pinKey \|\| ''\) === normalizedPlaceKey/);
    assert.match(sharedMapDirectorySource, /selectedPin\?\.memberPlaceKeys/);
    assert.match(sharedMapDirectorySource, /return members\.length \? \{ type: 'pin-group', group: members\[0\], members \} : null/);
    assert.match(sharedMapDirectorySource, /const \[mobileFocusTrayPlaceKey, setMobileFocusTrayPlaceKey\] = useState\(null\)/);
    assert.match(sharedMapDirectorySource, /MOBILE_FOCUS_TRAY_SCROLL_CLEAR_GRACE_MS/);
    assert.match(sharedMapDirectorySource, /mobileFocusTrayScrollClearAfterRef/);
    assert.match(sharedMapDirectorySource, /function holdMobileFocusTrayDuringMapReveal/);
    assert.match(sharedMapDirectorySource, /function canClearMobileFocusTrayFromScroll/);
    assert.match(sharedMapDirectorySource, /holdMobileFocusTrayDuringMapReveal\(\);/);
    assert.match(sharedMapDirectorySource, /resolveMobileFocusTraySelection\(mobileDisplayGroups, mobileFocusTrayPlaceKey, presentation\?\.pins \|\| \[\]\)/);
    assert.match(sharedMapDirectorySource, /const mobileFullMapFocusRequest = useMemo/);
    assert.match(sharedMapDirectorySource, /mobileFocusTraySelection\.type === 'group' \|\| mobileFocusTraySelection\.type === 'pin-group'/);
    assert.match(sharedMapDirectorySource, /focusedPlaceKeys: memberKeys/);
    assert.match(sharedMapDirectorySource, /const handleMobileMapViewSection = useCallback\(\(placeKey\) => \{\s*if \(isMobileMapPanelEnabled\) \{\s*setMobileFocusTrayPlaceKey\(placeKey \? String\(placeKey\) : null\);\s*holdMobileFocusTrayDuringMapReveal\(\);/);
    assert.match(sharedMapDirectorySource, /setMobileFocusTrayPlaceKey\(placeKey \? String\(placeKey\) : null\)/);
    assert.match(sharedMapDirectorySource, /setMobileFocusTrayPlaceKey\(selectionPlaceKey \? String\(selectionPlaceKey\) : null\)/);
    assert.match(sharedMapDirectorySource, /if \(!selectionPlaceKey\) \{\s*setFlashPlaceKey\(null\);\s*if \(isMobileMapPanelEnabled && canClearMobileFocusTrayFromScroll\(\)\) \{\s*setMobileFocusTrayPlaceKey\(null\);/);
    assert.match(sharedMapDirectorySource, /if \(deltaY > 0 && mobileFocusTrayPlaceKeyRef\.current && canClearMobileFocusTrayFromScroll\(\)\) \{\s*setMobileFocusTrayPlaceKey\(null\);/);
    assert.match(traySource, /data-mobile-map-focus-tray-card="true"/);
    assert.match(traySource, /border border-brand-200 bg-brand-100\/75/);
    assert.match(traySource, /ring-1 ring-white\/80/);
    assert.match(traySource, /const trayGroups = selection\.type === 'group' \|\| selection\.type === 'pin-group'\s*\? selection\.members\s*: \[selection\.group\]/);
    assert.match(traySource, /const groupContextLabel = selection\.type === 'group' \? categoryGroup\.name : ''/);
    assert.match(traySource, /<DirectoryCategoryPill[\s\S]*showUnmapped=\{Boolean\(categoryGroup\.isUnmappedGroup && !groupContextLabel\)\}/);
    assert.match(traySource, /secondaryLabel=\{groupContextLabel\}/);
    assert.doesNotMatch(traySource, /<DirectoryCategoryPill[\s\S]*\n\s+compact\n[\s\S]*showUnmapped=/);
    assert.match(traySource, /<MobileMapFocusTrayPlaceCard[\s\S]*key=\{group\.placeKey\}/);
    assert.match(mobileSource, /<MobileMapFocusTray[\s\S]*selection=\{mobileFocusTraySelection\}/);
    assert.ok(
        mobileSource.indexOf('<MobileMapFocusTray') < mobileSource.indexOf('<MapNotesEntryButton'),
        'the focus tray should sit between the mobile map and Map notes',
    );
    assert.ok(
        mobileSource.indexOf('<MobileMapFocusTray') < mobileSource.indexOf('groups={mobileDisplayGroups}'),
        'the focus tray should not reorder the directory cards',
    );
});

test('mobile full map keeps explicit control with a pull-at-top fallback', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );
    const openFullMapSource = sourceBetween(
        sharedMapDirectorySource,
        'const openMobileFullMap = useCallback',
        'const closeMobileFullMap = useCallback',
    );
    const closeFullMapSource = sourceBetween(
        sharedMapDirectorySource,
        'const closeMobileFullMap = useCallback',
        'useEffect(() => {\n        mobileMapListFocusedRef.current = mobileMapListFocused;',
    );

    assert.match(sharedMapDirectorySource, /const \[mobileFullMapOpen, setMobileFullMapOpen\] = useState\(false\)/);
    assert.match(sharedMapDirectorySource, /const openMobileFullMap = useCallback/);
    assert.match(sharedMapDirectorySource, /const closeMobileFullMap = useCallback/);
    assert.match(sharedMapDirectorySource, /function handleMobileTopPullTouchStart/);
    assert.match(sharedMapDirectorySource, /function handleMobileTopPullTouchEnd/);
    assert.match(sharedMapDirectorySource, /handleMobileTopPullWheel/);
    assert.match(mobileSource, /mobileFullMapOpen \? \(/);
    assert.match(mobileSource, /mobileFullMapElement/);
    assert.match(mobileSource, /layoutSignature: `\$\{mobileFullMapElement\.props\?\.layoutSignature \|\| 'mobile-map-normal'\}:full`/);
    assert.match(mobileSource, /focusedPlaceKey: mobileFullMapFocusRequest\.focusedPlaceKey \|\| mobileFullMapElement\.props\?\.focusedPlaceKey/);
    assert.match(mobileSource, /focusedPlaceKeys: mobileFullMapFocusRequest\.focusedPlaceKeys\.length[\s\S]*\? mobileFullMapFocusRequest\.focusedPlaceKeys[\s\S]*: mobileFullMapElement\.props\?\.focusedPlaceKeys/);
    assert.match(mobileSource, /t\('returnToMapList'\)/);
    assert.match(mobileSource, /<Minimize2/);
    assert.match(mobileSource, /mobileFullMapOpen \? \([\s\S]*<MobileMapFocusTray[\s\S]*selection=\{mobileFocusTraySelection\}[\s\S]*variant="full-map"[\s\S]*<MapNotesEntryButton/);
    assert.match(mobileSource, /<MapNotesEntryButton[\s\S]*rows=\{noteResourceRows\}/);
    assert.match(sharedMapDirectorySource, /document\.body\.style\.overflow = 'hidden'/);
    assert.doesNotMatch(openFullMapSource, /setMobileFocusTrayPlaceKey\(null\)/);
    assert.doesNotMatch(closeFullMapSource, /setMobileFocusTrayPlaceKey\(null\)/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_ADJUSTABLE_MAP_STEPS/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_RESIZE_SWIPE_DELTA/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_FULL_MAP_FIRST_CARD_TRIGGER_OFFSET/);
    assert.doesNotMatch(sharedMapDirectorySource, /openMobileGestureFullMap/);
    assert.doesNotMatch(sharedMapDirectorySource, /querySelector\('\[data-directory-place-card="true"\]'\)/);
    assert.doesNotMatch(sharedMapDirectorySource, /getMobileMapPanelActionForScroll/);
});

test('mobile full-map overlay has visible return and notes controls', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /fixed inset-x-0 bottom-0 top-\[56px\] z-\[1150\][^"`]*sm:top-\[64px\]"/);
    assert.match(mobileSource, /<div className="relative min-h-0 flex-1 disable-font-scaling">/);
    assert.match(mobileBottomSheetSource, /Drawer\.Overlay className="fixed inset-0 z-\[1600\]/);
    assert.match(mobileBottomSheetSource, /className=\{`fixed bottom-0 left-0 right-0 z-\[1610\]/);
    assert.match(mobileSource, /onClick=\{closeMobileFullMap\}/);
    assert.match(mobileSource, /onTouchStart=\{handleMobileFullMapTouchStart\}/);
    assert.match(mobileSource, /onTouchMove=\{handleMobileFullMapTouchMove\}/);
    assert.match(mobileSource, /onTouchEnd=\{handleMobileFullMapTouchEnd\}/);
    assert.match(mobileSource, /aria-label=\{t\('returnToMapList'\)\}/);
    assert.match(mobileSource, /<Minimize2 size=\{19\}/);
    assert.doesNotMatch(mobileSource, /<span>\{t\('returnToMapList'\)\}<\/span>/);
    assert.match(mobileSource, /<MapNotesEntryButton[\s\S]*onOpen=\{openResourceNotes\}/);
    assert.match(sharedMapDirectorySource, /compactFullMap \? 'min-w-\[min\(18rem,78vw\)\] max-w-\[19rem\]' : 'min-w-\[min\(18rem,78vw\)\]'/);
    assert.match(sharedMapDirectorySource, /isFullMap \? 'max-h-\[30svh\] flex-shrink-0 overflow-hidden' : ''/);
    assert.doesNotMatch(myMapV2ScaffoldSource, /mobileMapStickyClassName="[^"]*disable-font-scaling/);
    assert.doesNotMatch(myMapDetailPageSource, /mobileMapStickyClassName="[^"]*disable-font-scaling/);
    assert.doesNotMatch(sharedMapPageSource, /mobileMapStickyClassName="[^"]*disable-font-scaling/);
    assert.doesNotMatch(mobileSource, /handleMobileMapResizeTouchStart/);
    assert.doesNotMatch(mobileSource, /handleMobileMapResizeTouchEnd/);
});

test('print V2 cards can opt into numeric right-edge resource badges', () => {
    const printBadgeSource = sourceBetween(
        sharedMapDirectorySource,
        'function PrintResourceNumberBadge',
        'function MapNoteIconButton',
    );

    assert.match(sharedMapDirectorySource, /function normalizeBadgeFillColor/);
    assert.match(printBadgeSource, /function PrintResourceNumberBadge/);
    assert.match(printBadgeSource, /replace\(\s*\/\^#\//);
    assert.match(printBadgeSource, /color = null/);
    assert.match(printBadgeSource, /const badgeColor = normalizeBadgeFillColor\(color\)/);
    assert.match(printBadgeSource, /className="ml-1 inline-flex h-7 w-7 min-w-7/);
    assert.match(printBadgeSource, /backgroundColor: badgeColor/);
    assert.match(printBadgeSource, /borderColor: 'rgba\(255,255,255,0\.96\)'/);
    assert.match(sharedMapDirectorySource, /showPrintNumberBadges = false/);
    assert.match(sharedMapDirectorySource, /showPrintNumberBadge = false/);
    assert.match(sharedMapDirectorySource, /<PrintResourceNumberBadge value=\{group\.number\} color=\{group\.categoryColor \|\| clusterColorData\?\.core \|\| null\} compact=\{compactPrint\} \/>/);
    assert.match(sharedMapDirectorySource, /showPrintNumberBadge=\{showPrintNumberBadges\}/);
    assert.doesNotMatch(printBadgeSource, /bg-\[#0f766e\]/);
});

test('v2 can hide the map legend while shared directory lists keep it by default', () => {
    assert.match(sharedMapDirectorySource, /showMapLegend = true/);
    assert.match(sharedMapDirectorySource, /showMapLegend \? \(/);
    assert.match(sharedMapDirectorySource, /<MapLegend mobile \/>/);
    assert.match(sharedMapDirectorySource, /resolvedLayout !== 'print' && showMapLegend \? <MapLegend \/> : null/);
    assert.match(myMapV2ScaffoldSource, /showMapLegend=\{false\}/);
    assert.doesNotMatch(sharedMapDirectorySource, /mobileMapLegendClassName/);
});

test('v2 card ordering can opt into category pills and integrated list-only cards', () => {
    assert.match(sharedMapDirectorySource, /const displayGroups = presentation\?\.displayGroups \|\| mappedGroups/);
    assert.match(sharedMapDirectorySource, /const mobileDisplayGroups = presentation\?\.mobileDisplayGroups \|\| displayGroups/);
    assert.match(sharedMapDirectorySource, /const shouldRenderUnmappedSections = !presentation\?\.integratesUnmappedRowsAsCards/);
    assert.match(sharedMapDirectorySource, /const showCategoryPills = Boolean\(presentation\?\.showCategoryPills\)/);
    assert.match(sharedMapDirectorySource, /function DirectoryCategoryPill/);
    assert.match(sharedMapDirectorySource, /function DirectoryCategoryIcon/);
    assert.match(sharedMapDirectorySource, /function getCategoryPillStyle/);
    assert.match(sharedMapDirectorySource, /function getCategoryIconStyle/);
    assert.match(sharedMapDirectorySource, /--directory-category-accent/);
    assert.match(sharedMapDirectorySource, /<DirectoryCategoryIcon iconUrl=\{iconUrl\} color=\{color\} compact=\{compact\} \/>/);
    assert.match(sharedMapDirectorySource, /h-\[clamp\(28px,1\.75rem,32px\)\] w-\[clamp\(28px,1\.75rem,32px\)\]/);
    assert.match(sharedMapDirectorySource, /h-\[clamp\(34px,2\.1rem,38px\)\] w-\[clamp\(34px,2\.1rem,38px\)\]/);
    assert.match(sharedMapDirectorySource, /style=\{getCategoryIconStyle\(color\)\}/);
    assert.match(sharedMapDirectorySource, /boxShadow: '0 0 0 2px color-mix/);
    assert.match(sharedMapDirectorySource, /function DirectoryUnmappedPill/);
    assert.match(sharedMapDirectorySource, /function DirectoryCategoryPillLabel/);
    assert.match(sharedMapDirectorySource, /secondaryLabel = ''/);
    assert.match(sharedMapDirectorySource, /<DirectoryCategoryPillLabel label=\{secondaryLabel\} \/>/);
    assert.match(sharedMapDirectorySource, /new ResizeObserver\(measure\)/);
    assert.match(sharedMapDirectorySource, /measureElement\.scrollWidth > labelElement\.clientWidth \+ 1/);
    assert.match(sharedMapDirectorySource, /t\('unmapped'\)/);
    assert.match(sharedMapDirectorySource, /function isListOnlyGroupDisplayGroup/);
    assert.match(sharedMapDirectorySource, /return t\('groupType'\)/);
    assert.match(sharedMapDirectorySource, /flex max-w-full flex-nowrap items-start/);
    assert.match(sharedMapDirectorySource, /<DirectoryCategoryPillLabel label=\{label\} \/>/);
    assert.match(sharedMapDirectorySource, /directory-category-pill-label--marquee/);
    assert.doesNotMatch(sharedMapDirectorySource, /label\.length > \(compact \? 24 : 30\)/);
    assert.doesNotMatch(sharedMapDirectorySource, /<span className="truncate">\{label\}<\/span>/);
    assert.match(appCssSource, /\.directory-category-pill-label[\s\S]*overflow: hidden/);
    assert.match(appCssSource, /\.directory-category-pill-label__measure[\s\S]*visibility: hidden/);
    assert.match(appCssSource, /@keyframes directory-category-pill-roll/);
    assert.match(sharedMapDirectorySource, /const categoryStatus = group\.isUnmappedGroup \? 'unmapped' : 'mapped'/);
    assert.match(sharedMapDirectorySource, /const previousCategoryStatus = previousGroup\?\.isUnmappedGroup \? 'unmapped' : 'mapped'/);
    assert.match(sharedMapDirectorySource, /const shouldShowCategoryPill = Boolean\(showCategoryPills && group\.categoryLabel && categoryRunKey !== previousCategoryRunKey\)/);
    assert.doesNotMatch(sharedMapDirectorySource, /showCategoryPills && interactive && group\.categoryLabel/);
    assert.match(sharedMapDirectorySource, /showUnmapped=\{Boolean\(group\.isUnmappedGroup\)\}/);
    assert.match(sharedMapDirectorySource, /color=\{group\.categoryColor\}/);
    assert.match(sharedMapDirectorySource, /iconUrl=\{group\.categoryIconUrl\}/);
    assert.match(sharedMapDirectorySource, /showCategoryPills=\{showCategoryPills\}/);
    assert.match(sharedMapDirectorySource, /groups=\{leftGroups\}/);
    assert.match(sharedMapDirectorySource, /groups=\{rightGroups\}/);
    assert.match(sharedMapDirectorySource, /groups=\{mobileDisplayGroups\}/);
    assert.match(sharedMapDirectorySource, /mappedGroups: presentation\?\.noteMappedGroups \|\| mappedGroups/);
    assert.match(sharedMapDirectorySource, /unmappedRows: presentation\?\.noteUnmappedRows \|\| unmappedRows/);
});

test('mobile map directory locks viewport scale only while the mobile map surface is active', () => {
    assert.match(sharedMapDirectorySource, /function useMobileViewportScaleLock/);
    assert.match(sharedMapDirectorySource, /querySelector\('meta\[name="viewport"\]'\)/);
    assert.match(sharedMapDirectorySource, /maximum-scale=1, user-scalable=no/);
    assert.match(sharedMapDirectorySource, /meta\.setAttribute\('content', previousContent\)/);
    assert.match(sharedMapDirectorySource, /useMobileViewportScaleLock\(isMobileMapPanelEnabled\)/);
});

test('v2 logo cards show the resource name before the address metadata', () => {
    const cardSource = sourceBetween(
        sharedMapDirectorySource,
        'function DirectoryPlaceGroupCard',
        'function DirectoryUnmappedRow',
    );
    const v2CardSource = sourceBetween(
        cardSource,
        "const usesV2CardLanguage = cardBadgeMode === 'logo';",
        'if (placeDetailPath && fullCardLink && !isPostalGroup && !canFocusCardOnMap)',
    );

    assert.match(v2CardSource, /!usesV2CardLanguage \? \(/);
    assert.match(v2CardSource, /usesV2CardLanguage && hasLocationMeta \? \(/);
    assert.match(v2CardSource, /const resolvedLocationLine = resolveV2CardLocationLine\(group, t\)/);
    assert.match(v2CardSource, /<div className="mt-0">/);
    assert.match(v2CardSource, /tight/);
    assert.match(sharedMapDirectorySource, /function resolveGroupLocationLine/);
    assert.match(sharedMapDirectorySource, /function resolveV2CardLocationLine/);
    assert.match(sharedMapDirectorySource, /item\?\.shortLocationLine \|\| item\?\.locationLabel \|\| item\?\.address \|\| item\?\.contextLabel/);
    assert.ok(
        v2CardSource.indexOf('{interactivePlaceTitle}') < v2CardSource.indexOf('usesV2CardLanguage && hasLocationMeta'),
        'V2 cards should render the title row before location metadata',
    );
    assert.ok(
        v2CardSource.indexOf('usesV2CardLanguage && hasLocationMeta') < v2CardSource.indexOf('<MapNoteIconButton'),
        'V2 cards should keep the location metadata inside the title column before the note button can stretch the row',
    );
});

test('interactive My Map cards avoid fixed pixel sizing so font controls can resize them', () => {
    const cardSource = sourceBetween(
        sharedMapDirectorySource,
        'function HiddenLogoSlot',
        'function DirectoryUnmappedSection',
    );

    assert.equal(/text-\[(?:9|10|11|12|14|15|17)px\]/.test(cardSource), false);
    assert.equal(/h-\[(?:34|38|42|46)px\]|w-\[(?:34|38|42|46)px\]/.test(cardSource), false);
    assert.equal(/fontSize:\s*[^,\n]*px/.test(cardSource), false);
});

test('map notes render markdown through the safe MarkdownLiteText component', () => {
    const notesSource = sourceBetween(
        sharedMapDirectorySource,
        'function SharedResourceNotes',
        'function MapNotesOverlay',
    );

    assert.match(sharedMapDirectorySource, /import MarkdownLiteText from '\.\/MarkdownLiteText\.jsx';/);
    assert.match(notesSource, /<MarkdownLiteText[\s\S]*text=\{note\.text\}/);
    assert.doesNotMatch(notesSource, /dangerouslySetInnerHTML/);
});

test('map notes editor exposes a markdown helper toolbar without changing autosave payloads', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /applyMapNoteMarkdownAction/);
    assert.match(editorSource, /mapNoteMarkdownBold/);
    assert.match(editorSource, /mapNoteMarkdownBulletList/);
    assert.match(editorSource, /mapNoteMarkdownPreview/);
    assert.match(editorSource, /updateDraftNote\(note\.clientId, \{ text:/);
    assert.match(editorSource, /const payload = buildMapNotesSavePayload\(getCurrentDraftNotes\(\)\);/);
    assert.doesNotMatch(editorSource, /\bmarkdown\s*:/);
    assert.doesNotMatch(editorSource, /\bformat\s*:/);
});

test('map notes editor caps live textarea growth so typing does not keep moving the panel', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /resizeTextareaToContent/);
    assert.match(sharedMapDirectorySource, /MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT/);
    assert.match(editorSource, /Object\.values\(noteTextareaRefs\.current\)\.forEach\(\(textarea\) => resizeTextareaToContent\(textarea, \{ maxHeight: MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT \}\)\)/);
    assert.match(editorSource, /resizeTextareaToContent\(event\.currentTarget, \{ maxHeight: MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT \}\)/);
    assert.match(editorSource, /resizeTextareaToContent\(element, \{ maxHeight: MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT \}\)/);
    assert.match(editorSource, /overflow-y-auto/);
});

test('map notes preview toggles in place instead of adding a second note body', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /const isPreviewing = Boolean\(previewNoteIds\[note\.clientId\]\);/);
    assert.match(editorSource, /\{isPreviewing \? \(/);
    assert.match(editorSource, /<MarkdownLiteText[\s\S]*text=\{note\.text\}/);
    assert.doesNotMatch(editorSource, /previewNoteIds\[note\.clientId\] && note\.text\.trim\(\) \? \(/);
});

test('map notes editor defaults existing notes to preview without forcing blank notes out of edit', () => {
    const helperSource = sourceBetween(
        sharedMapDirectorySource,
        'function buildDefaultPreviewNoteIds',
        'function SharedResourceNotes',
    );
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );
    const addNoteSource = sourceBetween(
        editorSource,
        'function addDraftNote',
        'function removeDraftNote',
    );

    assert.match(helperSource, /String\(note\?\.text \|\| ''\)\.trim\(\)/);
    assert.match(helperSource, /previewIds\[note\.clientId\] = true/);
    assert.match(editorSource, /useState\(\(\) => \(\s*buildDefaultPreviewNoteIds\(buildNoteDrafts\(row \? \[row\] : \[\]\), rowKey\)\s*\)\)/);
    assert.match(editorSource, /if \(previousRowKey !== rowKey\) \{\s*setPreviewNoteIds\(buildDefaultPreviewNoteIds\(nextDrafts, rowKey\)\);/);
    assert.doesNotMatch(addNoteSource, /setPreviewNoteIds/);
});

test('map notes preview toggle uses explicit preview and edit labels', () => {
    const toolbarSource = sourceBetween(
        sharedMapDirectorySource,
        'function MapNoteToolbarButton',
        'function createEmptyDraftNote',
    );
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /\bPencil\b/);
    assert.match(toolbarSource, /showLabel = false/);
    assert.match(toolbarSource, /\{showLabel \? <span/);
    assert.match(editorSource, /label=\{isPreviewing \? t\('mapNoteMarkdownEdit'\) : t\('mapNoteMarkdownPreview'\)\}/);
    assert.match(editorSource, /showLabel/);
    assert.match(editorSource, /\{isPreviewing \? <Pencil size=\{15\} strokeWidth=\{2\.3\} \/> : <Eye size=\{15\} strokeWidth=\{2\.3\} \/>\}/);
});

test('map notes editor keeps textarea identity stable when autosave returns new note ids', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /mergeRemoteNotesWithStableDrafts/);
    assert.match(editorSource, /const localDraftNotes = getCurrentDraftNotes\(\);/);
    assert.match(editorSource, /notes: mergeRemoteNotesWithStableDrafts\(localDraftNotes, nextDrafts\[rowKey\]\.notes\)/);
});

test('map notes editor keeps typing local until the owner exits the note flow', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );
    const overlaySource = sourceBetween(
        sharedMapDirectorySource,
        'function MapNotesOverlay',
        'const DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH',
    );

    assert.doesNotMatch(editorSource, /scheduleAutosave/);
    assert.doesNotMatch(editorSource, /onBlur=\{\(\) => void flush/);
    assert.match(editorSource, /onUpdateResourceNotesRef\.current\(saveRowRef, payload, \{ keepalive \}\)/);
    assert.match(editorSource, /flushDraftChanges\(\{ keepalive: true \}\)/);
    assert.match(editorSource, /onRegisterFlush\?\.\(flushDraftChanges\)/);
    assert.match(overlaySource, /saveEditorBeforeExit/);
    assert.match(overlaySource, /fixed inset-0 z-\[1400\]/);
    assert.match(overlaySource, /onClick=\{\(\) => void handleClose\(\)\}/);
    assert.match(overlaySource, /onClick=\{\(\) => void handleBackToList\(\)\}/);
    assert.match(myMapDetailPageSource, /handleUpdateResourceNotes\(row, notes, options = \{\}\)/);
    assert.match(myMapDetailPageSource, /updateMyMapAssetNotes\(directory\.id, row\.resourceType, row\.resourceId, notes, options\)/);
    assert.match(apiSource, /keepalive = false/);
    assert.match(apiSource, /\.\.\.\(keepalive \? \{ keepalive: true \} : \{\}\)/);
});

test('map notes Back and Close respond before the deferred save finishes', () => {
    const overlaySource = sourceBetween(
        sharedMapDirectorySource,
        'function MapNotesOverlay',
        'const DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH',
    );

    assert.match(overlaySource, /function saveEditorBeforeExit\(\)/);
    assert.match(overlaySource, /void flushEditorRef\.current\(\{ keepalive: true \}\)/);
    assert.match(overlaySource, /saveEditorBeforeExit\(\);\s+onClose\(\);/);
    assert.match(overlaySource, /saveEditorBeforeExit\(\);\s+onBackToList\(\);/);
    assert.doesNotMatch(overlaySource, /if \(await flushEditorBeforeExit\(\)\)/);
});

test('map notes editor shows the note character limit instead of failing silently', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /MAP_NOTE_MAX_LENGTH/);
    assert.match(editorSource, /maxLength=\{MAP_NOTE_MAX_LENGTH\}/);
    assert.match(editorSource, /mapNoteCharacterCount/);
    assert.match(editorSource, /mapNoteLimitReached/);
});

test('map notes editor applies the shared note limit to every local text update path', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /values\.text\.slice\(0, MAP_NOTE_MAX_LENGTH\)/);
    assert.match(editorSource, /result\.value\.slice\(0, MAP_NOTE_MAX_LENGTH\)/);
    assert.doesNotMatch(editorSource, /slice\(0, 1000\)/);
});

test('map notes editor keeps ordinary typing out of the visible saving state', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /const \[showSaveStatus, setShowSaveStatus\] = useState\(false\)/);
    assert.match(editorSource, /setShowSaveStatus\(true\)/);
    assert.match(editorSource, /setShowSaveStatus\(false\)/);
    assert.match(editorSource, /const shouldShowSaveStatus = showSaveStatus && saveState !== 'idle' && !didSaveFail/);
    assert.match(editorSource, /updateDraftNote\(note\.clientId, \{ text: event\.target\.value \}\)/);
    assert.doesNotMatch(editorSource, /updateDraftNote\(note\.clientId, \{ text: event\.target\.value \}, \{ immediate: true \}\)/);
});

test('map notes save status reserves space so saving feedback does not shift the editor', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /aria-live="polite"/);
    assert.match(editorSource, /min-h-10/);
    assert.match(editorSource, /saveState !== 'idle'/);
});
