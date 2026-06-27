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

test('mobile map panel exposes a full-screen handle while keeping map notes reachable', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(sharedMapDirectorySource, /function MobileMapDrawerHandle/);
    assert.match(sharedMapDirectorySource, /ChevronUp/);
    assert.match(sharedMapDirectorySource, /ChevronDown/);
    assert.match(sharedMapDirectorySource, /const Icon = fullscreen \? ChevronUp : ChevronDown/);
    assert.match(sharedMapDirectorySource, /rounded-b-2xl/);
    assert.match(sharedMapDirectorySource, /isMobileMapFullscreen/);
    assert.match(sharedMapDirectorySource, /MOBILE_MAP_PANEL_STATES\.FULLSCREEN/);
    assert.match(sharedMapDirectorySource, /fixed inset-0 z-\[90\] flex items-end/);
    assert.match(mobileSource, /mobileMapWrapperClassName/);
    assert.match(mobileSource, /fixed inset-0 z-\[70\]/);
    assert.match(mobileSource, /grid grid-rows-\[0fr\] overflow-hidden/);
    assert.doesNotMatch(mobileSource, /h-\[128px\]/);
    assert.match(mobileSource, /<MobileMapDrawerHandle/);
    assert.match(mobileSource, /onToggle=\{handleMobileMapDrawerToggle\}/);
    assert.ok(
        mobileSource.indexOf('<MobileMapDrawerHandle') < mobileSource.indexOf('<MapNotesEntryButton'),
        'the map drawer handle should sit above the notes entry so notes remain reachable',
    );
});

test('mobile map panel uses softened collapse and reveal animation', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(sharedMapDirectorySource, /const MOBILE_MAP_PANEL_TRANSITION_CLASS/);
    assert.match(sharedMapDirectorySource, /duration-500/);
    assert.match(sharedMapDirectorySource, /ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\]/);
    assert.match(sharedMapDirectorySource, /transition-\[grid-template-rows,opacity,transform\]/);
    assert.match(sharedMapDirectorySource, /will-change-\[grid-template-rows,opacity,transform\]/);
    assert.match(mobileSource, /opacity-0 -translate-y-1 pointer-events-none/);
    assert.match(mobileSource, /opacity-100 translate-y-0/);
    assert.doesNotMatch(sharedMapDirectorySource, /const MOBILE_MAP_PANEL_TRANSITION_CLASS = 'transition-all/);
    assert.match(sharedMapDirectorySource, /Date\.now\(\) \+ 650/);
});

test('mobile map panel keeps the mounted map cached while collapsed', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /const mobileMapBaseHeightClassName/);
    assert.match(mobileSource, /const mobileMapFrameHeightClassName/);
    assert.match(mobileSource, /const mobileMapViewportClassName/);
    assert.match(mobileSource, /const mobileMapClipClassName/);
    assert.match(mobileSource, /const mobileMapInnerClassName/);
    assert.match(mobileSource, /className=\{mobileMapViewportClassName\}/);
    assert.match(mobileSource, /className=\{mobileMapClipClassName\}/);
    assert.match(mobileSource, /className=\{mobileMapInnerClassName\}/);
    assert.match(mobileSource, /mapHeightClassName: mobileMapFrameHeightClassName/);
    assert.match(mobileSource, /layoutSignature: isMobileMapFullscreen \? 'mobile-map-fullscreen' : 'mobile-map-normal'/);
    assert.doesNotMatch(mobileSource, /mapHeightClassName: mobileMapHeightClassName/);
    assert.doesNotMatch(mobileSource, /layoutSignature: `mobile-map-\$\{mobileMapPanelState\}`/);
});

test('mobile map panel avoids browser scroll anchoring during collapse motion', () => {
    const mobileSource = sourceBetween(
        sharedMapDirectorySource,
        "if (resolvedLayout === 'mobile')",
        'return (\n        <DirectoryReturnPathContext.Provider value={detailReturnPath}>',
    );

    assert.match(mobileSource, /\[overflow-anchor:none\]/);
    assert.match(mobileSource, /mobileCardsClassName/);
    assert.match(mobileSource, /className=\{mobileCardsClassName\}/);
    assert.match(mobileSource, /mobileMapLegendClipClassName/);
    assert.match(mobileSource, /grid grid-rows-\[0fr\]/);
    assert.match(mobileSource, /grid grid-rows-\[1fr\]/);
    assert.doesNotMatch(mobileSource, /h-0 min-h-0 max-h-0/);
});

test('mobile map panel waits for scroll to settle before collapsing layout', () => {
    const scrollControlSource = sourceBetween(
        sharedMapDirectorySource,
        'const getMobileMapPanelStateForAction = useCallback',
        'function openResourceNotes',
    );

    assert.match(sharedMapDirectorySource, /const MOBILE_MAP_COLLAPSE_SETTLE_MS = 180;/);
    assert.match(scrollControlSource, /mobileMapCollapseTimerRef/);
    assert.match(scrollControlSource, /function clearMobileMapCollapseTimer/);
    assert.match(scrollControlSource, /function scheduleMobileMapCollapse/);
    assert.match(scrollControlSource, /window\.setTimeout/);
    assert.match(scrollControlSource, /MOBILE_MAP_COLLAPSE_SETTLE_MS/);
    assert.match(scrollControlSource, /window\.clearTimeout/);
    assert.match(scrollControlSource, /if \(action === 'collapse'\) \{\s*scheduleMobileMapCollapse\(\);\s*return current;\s*\}/);
    assert.doesNotMatch(scrollControlSource, /if \(action === 'collapse'\) \{[\s\S]{0,160}return MOBILE_MAP_PANEL_STATES\.COLLAPSED;/);
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
    assert.match(sharedMapDirectorySource, /const mobileMapLegendClassName = isMobileMapCollapsed/);
    assert.match(sharedMapDirectorySource, /showMapLegend \? \(/);
    assert.match(sharedMapDirectorySource, /<div className=\{mobileMapLegendClassName\}>/);
    assert.match(sharedMapDirectorySource, /<MapLegend mobile \/>/);
    assert.match(sharedMapDirectorySource, /resolvedLayout !== 'print' && showMapLegend \? <MapLegend \/> : null/);
    assert.match(myMapV2ScaffoldSource, /showMapLegend=\{false\}/);
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
