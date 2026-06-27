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
const apiSource = readFileSync(
    new URL('../src/lib/api.js', import.meta.url),
    'utf8',
);
const resourceRowIconSource = readFileSync(
    new URL('../src/components/ResourceRowIcon.jsx', import.meta.url),
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

test('mobile map uses natural page scroll with sticky map notes instead of collapse controls', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /mobileMapNotesWrapperClassName/);
    assert.match(mobileSource, /`\$\{mobileMapStickyClassName\} \[overflow-anchor:none\]`/);
    assert.match(sharedMapDirectorySource, /mobileMapStickyClassName = 'sticky top-3 z-20 bg-slate-50 pb-2'/);
    assert.match(mobileSource, /mapHeightClassName: mobileMapBaseHeightClassName/);
    assert.match(mobileSource, /layoutSignature: 'mobile-map-normal'/);
    assert.doesNotMatch(sharedMapDirectorySource, /function MobileMapDrawerHandle/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_PANEL_STATES/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_COLLAPSE_SETTLE_MS/);
    assert.doesNotMatch(sharedMapDirectorySource, /getMobileMapPanelActionForScroll/);
    assert.doesNotMatch(sharedMapDirectorySource, /shouldExpandMobileMapPanelFromTopPull/);
    assert.match(sharedMapDirectorySource, /fixed inset-0 z-\[90\] flex items-end/);
    assert.ok(
        mobileSource.indexOf('React.cloneElement(mobileMapElement') < mobileSource.indexOf('<MapNotesEntryButton'),
        'the map should stay above sticky notes in the normal page flow',
    );
});

test('mobile map no longer animates collapse or listens to card scroll gestures', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /className=\{mobileCardsClassName\}/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_PANEL_TRANSITION_CLASS/);
    assert.doesNotMatch(sharedMapDirectorySource, /MOBILE_MAP_PANEL_CONTENT_TRANSITION_CLASS/);
    assert.doesNotMatch(mobileSource, /grid grid-rows-\[0fr\]/);
    assert.doesNotMatch(mobileSource, /grid grid-rows-\[1fr\]/);
    assert.doesNotMatch(mobileSource, /onWheel=\{handleMobileCardsWheel\}/);
    assert.doesNotMatch(mobileSource, /onTouchStart=\{handleMobileCardsTouchStart\}/);
    assert.doesNotMatch(mobileSource, /onTouchMove=\{handleMobileCardsTouchMove\}/);
});

test('mobile map stays mounted as a normal partial-height map', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /const mobileMapBaseHeightClassName/);
    assert.match(mobileSource, /mapHeightClassName: mobileMapBaseHeightClassName/);
    assert.match(mobileSource, /layoutSignature: 'mobile-map-normal'/);
    assert.match(mobileSource, /onViewSection: handleMobileMapViewSection/);
    assert.match(mobileSource, /onClusterSelect: handleMobileMapClusterSelect/);
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

test('mobile natural scroll can open a gesture-driven full map after the first card', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );
    const scrollGestureSource = sourceBetween(
        sharedMapDirectorySource,
        'const openMobileGestureFullMap = useCallback',
        'function openResourceNotes',
    );

    assert.match(sharedMapDirectorySource, /const MOBILE_FULL_MAP_FIRST_CARD_TRIGGER_OFFSET = 12;/);
    assert.match(sharedMapDirectorySource, /const \[isMobileGestureFullMap, setIsMobileGestureFullMap\] = useState\(false\)/);
    assert.match(sharedMapDirectorySource, /const mobileCardsWrapperRef = useRef\(null\)/);
    assert.match(sharedMapDirectorySource, /data-directory-place-card="true"/);
    assert.match(scrollGestureSource, /querySelector\('\[data-directory-place-card="true"\]'\)/);
    assert.match(scrollGestureSource, /firstCardRect\.bottom <= triggerLine/);
    assert.match(scrollGestureSource, /scrollingDown/);
    assert.match(scrollGestureSource, /openMobileGestureFullMap\(\)/);
    assert.match(mobileSource, /isMobileGestureFullMap && mobileMapElement \? \(/);
    assert.match(mobileSource, /layoutSignature: 'mobile-map-fullscreen'/);
    assert.match(mobileSource, /mapHeightClassName: 'h-full min-h-0 max-h-none'/);
    assert.doesNotMatch(sharedMapDirectorySource, /getMobileMapPanelActionForScroll/);
});

test('mobile full map exits from a bottom-edge upward swipe and keeps map notes reachable', () => {
    const fullMapSource = sourceBetween(
        sharedMapDirectorySource,
        'isMobileGestureFullMap && mobileMapElement ? (',
        '<div ref={mobileCardsWrapperRef} className={mobileCardsClassName}',
    );
    const gestureSource = sourceBetween(
        sharedMapDirectorySource,
        'const handleMobileFullMapTouchStart = useCallback',
        'function openResourceNotes',
    );

    assert.match(sharedMapDirectorySource, /const MOBILE_FULL_MAP_BOTTOM_GESTURE_ZONE = 112;/);
    assert.match(sharedMapDirectorySource, /const MOBILE_FULL_MAP_SWIPE_UP_DELTA = 48;/);
    assert.match(sharedMapDirectorySource, /const mobileFullMapTouchStartYRef = useRef\(null\)/);
    assert.match(sharedMapDirectorySource, /document\.body\.style\.overflow = 'hidden'/);
    assert.match(sharedMapDirectorySource, /mobileNormalMapRef\.current\?\.scrollIntoView\?\.\(\{ behavior: 'smooth', block: 'start' \}\)/);
    assert.match(gestureSource, /window\.innerHeight - MOBILE_FULL_MAP_BOTTOM_GESTURE_ZONE/);
    assert.match(gestureSource, /mobileFullMapTouchStartYRef\.current - endY/);
    assert.match(gestureSource, /swipeDistance >= MOBILE_FULL_MAP_SWIPE_UP_DELTA/);
    assert.match(gestureSource, /closeMobileGestureFullMap\(\)/);
    assert.match(fullMapSource, /onTouchStart=\{handleMobileFullMapTouchStart\}/);
    assert.match(fullMapSource, /onTouchEnd=\{handleMobileFullMapTouchEnd\}/);
    assert.match(fullMapSource, /<MapNotesEntryButton/);
    assert.match(fullMapSource, /aria-label=\{t\('returnToMapList'\)\}/);
    assert.match(fullMapSource, /<ChevronUp size=\{22\}/);
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
    assert.match(sharedMapDirectorySource, /compact \? 'h-10 w-10 p-1' : 'h-12 w-12 p-1\.5'/);
    assert.match(sharedMapDirectorySource, /style=\{getCategoryIconStyle\(color\)\}/);
    assert.match(sharedMapDirectorySource, /boxShadow: '0 0 0 2px color-mix/);
    assert.match(sharedMapDirectorySource, /function DirectoryUnmappedPill/);
    assert.match(sharedMapDirectorySource, /t\('unmapped'\)/);
    assert.match(sharedMapDirectorySource, /function isListOnlyGroupDisplayGroup/);
    assert.match(sharedMapDirectorySource, /return t\('groupType'\)/);
    assert.match(sharedMapDirectorySource, /flex-col items-start/);
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
