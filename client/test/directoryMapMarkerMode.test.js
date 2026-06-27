import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const directoryMapSource = readFileSync(
    new URL('../src/components/DirectoryMap.jsx', import.meta.url),
    'utf8',
);
const discoverUtilsSource = readFileSync(
    new URL('../src/features/discover/discoverUtils.js', import.meta.url),
    'utf8',
);
const appCssSource = readFileSync(
    new URL('../src/index.css', import.meta.url),
    'utf8',
);

test('directory map keeps bubble clusters as the default marker mode', () => {
    assert.match(directoryMapSource, /clusterMarkerMode = 'bubble'/);
    assert.match(directoryMapSource, /createDirectoryClusterIcon\(cluster, activePlaceKeySet, clusterMarkerMode\)/);
});

test('directory map can disable clustering so close pins behave as individual markers', () => {
    assert.match(directoryMapSource, /const shouldCluster = clusterMarkerMode !== 'none' && displayPins\.length > 1/);
});

test('directory map fits visible spread pin positions with enough top padding for pin artwork', () => {
    assert.match(directoryMapSource, /const DIRECTORY_FIT_PADDING_TOP_LEFT = \[44, 72\]/);
    assert.match(directoryMapSource, /fitPaddingTopLeft = DIRECTORY_FIT_PADDING_TOP_LEFT/);
    assert.match(directoryMapSource, /fitPaddingBottomRight = DIRECTORY_FIT_PADDING_BOTTOM_RIGHT/);
    assert.match(directoryMapSource, /paddingTopLeft: fitPaddingTopLeft/);
    assert.match(directoryMapSource, /paddingBottomRight: fitPaddingBottomRight/);
    assert.match(directoryMapSource, /function getDirectoryPinMapPoint\(pin = \{\}\)/);
    assert.match(directoryMapSource, /pin\.displayLat \?\? pin\.lat/);
    assert.match(directoryMapSource, /pin\.displayLng \?\? pin\.lng/);
    assert.match(directoryMapSource, /const points = pins\.map\(getDirectoryPinMapPoint\)\.filter\(Boolean\)/);
    assert.match(directoryMapSource, /pins=\{displayPins\}/);
    assert.match(directoryMapSource, /map\.flyTo\(\[targetPoint\.lat, targetPoint\.lng\]/);
});

test('directory map still supports clusters with the saved-place pin style', () => {
    assert.match(directoryMapSource, /clusterMarkerMode === 'saved-pin'/);
    assert.match(directoryMapSource, /const icon = createSavedPlacePinIcon\(\{/);
    assert.match(directoryMapSource, /return icon;/);
    assert.match(directoryMapSource, /count,\s+emphasis: isHighlighted \? 'primary' : 'default',\s+tone: 'saved'/);
});

test('directory map can hide individual pin count badges without changing the default', () => {
    assert.match(discoverUtilsSource, /showBadge = true/);
    assert.match(discoverUtilsSource, /const badgeMarkup = showBadge/);
    assert.match(directoryMapSource, /pinBadgeMode = 'count'/);
    assert.match(directoryMapSource, /showBadge: pinBadgeMode !== 'none'/);
});

test('directory map supports print badge markers without moving marker coordinates', () => {
    assert.match(directoryMapSource, /function createPrintResourceBadgeMarker/);
    assert.match(directoryMapSource, /function normalizePrintBadgeItems/);
    assert.match(directoryMapSource, /function getPrintBadgeLobeLayout/);
    assert.match(directoryMapSource, /function DirectoryPrintBadgeCollisionSync/);
    assert.match(directoryMapSource, /function getPrintBadgeBubbleCircles/);
    assert.match(directoryMapSource, /function resolvePrintBadgeBubbleLayout/);
    assert.match(directoryMapSource, /function isPrintBadgeAnchorNearMap/);
    assert.match(directoryMapSource, /function isLeafletMapCameraMoving/);
    assert.match(directoryMapSource, /function getPrintBadgeStoredOffset/);
    assert.match(directoryMapSource, /function restorePrintBadgeStoredOffsets/);
    assert.match(directoryMapSource, /data-print-marker-key="\$\{escapeHtml\(markerKey\)\}"/);
    assert.match(directoryMapSource, /markerElement\.dataset\.printCollisionSolved = 'true'/);
    assert.match(directoryMapSource, /const solvedOffsetsRef = useRef\(new Map\(\)\)/);
    assert.match(directoryMapSource, /const storedOffset = getPrintBadgeStoredOffset\(markerKey, solvedOffsetsRef\.current\)/);
    assert.match(directoryMapSource, /if \(isFocusedZoom && storedOffset\) \{/);
    assert.match(directoryMapSource, /restorePrintBadgeStoredOffsets\(markerPane, solvedOffsetsRef\.current\)/);
    assert.match(directoryMapSource, /const hasSolvedOffset = markerElement\.dataset\.printCollisionSolved === 'true'/);
    assert.match(directoryMapSource, /if \(hasSolvedOffset && !isPrintBadgeAnchorNearMap\(\{ centerX: markerCenterX, centerY: markerCenterY \}, mapBounds\)\) \{/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_BUBBLE_ITERATIONS/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_BUBBLE_MAX_OFFSET/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_BUBBLE_EDGE_ANCHOR_TOLERANCE/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_COLLISION_FOCUS_ZOOM/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_COLLISION_SCHEDULE_DELAYS/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS/);
    assert.doesNotMatch(directoryMapSource, /doesPrintBadgeLabelStayVisible/);
    assert.doesNotMatch(directoryMapSource, /const placedTopRects = \[\]/);
    assert.match(directoryMapSource, /preserveSolvedOffsets && typeof MutationObserver !== 'undefined'/);
    assert.match(directoryMapSource, /printCollisionBaseMarginLeft/);
    assert.match(directoryMapSource, /markerElement\.style\.marginLeft = `\$\{item\.baseMarginLeft \+ offset\.x\}px`/);
    assert.match(directoryMapSource, /markerElement\.style\.marginTop = `\$\{item\.baseMarginTop \+ offset\.y\}px`/);
    assert.match(directoryMapSource, /coreElement\.style\.setProperty\('--print-badge-offset-x', '0px'\)/);
    assert.match(directoryMapSource, /markerMode === 'print-badge'/);
    assert.match(directoryMapSource, /const printBadgeLayoutRefreshKey = useMemo\(\(\) => \{/);
    assert.match(directoryMapSource, /activePlaceKeySet/);
    assert.match(directoryMapSource, /printBadgeItems/);
    assert.match(directoryMapSource, /<DirectoryPrintBadgeCollisionSync[\s\S]*enabled=\{markerMode === 'print-badge' \|\| markerMode === 'category-bubble'\}[\s\S]*refreshKey=\{printBadgeLayoutRefreshKey\}/);
    assert.match(directoryMapSource, /function DirectoryPrintBadgeCollisionSync\(\{ enabled, refreshKey = '', preserveSolvedOffsets = false \}\)/);
    assert.match(directoryMapSource, /const mapTransitionUntilRef = useRef\(0\)/);
    assert.match(directoryMapSource, /\}, \[enabled, map, preserveSolvedOffsets, refreshKey\]\)/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_COLLISION_SCHEDULE_DELAYS\.forEach\(scheduleCollisionPass\)/);
    assert.match(directoryMapSource, /if \(!force && isMapTransitioning\(\)\) \{/);
    assert.match(directoryMapSource, /scheduleCollisionPass\(DIRECTORY_PRINT_BADGE_COLLISION_MAP_SETTLE_MS \+ 360, \{ force: true \}\)/);
    assert.match(directoryMapSource, /map\.on\('movestart', markMapTransitioning\)/);
    assert.match(directoryMapSource, /map\.on\('zoomstart', markMapTransitioning\)/);
    assert.match(directoryMapSource, /map\.on\('move', markMapTransitioning\)/);
    assert.match(directoryMapSource, /map\.on\('zoom', markMapTransitioning\)/);
    assert.match(directoryMapSource, /map\.on\('moveend', handleMapSettled\)/);
    assert.match(directoryMapSource, /map\.on\('zoomend', handleMapSettled\)/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_LOBE_SPACING/);
    assert.match(directoryMapSource, /zIndexOffset=\{markerMode === 'print-badge' \? 100000 \+ \(\(Number\(pin\.number\) \|\| 0\) \* 1000\) : undefined\}/);
    assert.match(directoryMapSource, /DIRECTORY_PRINT_BADGE_DIAMETER = 25\.5/);
    assert.match(directoryMapSource, /className: 'directory-print-badge-leaflet-icon'/);
    assert.match(directoryMapSource, /iconSize: \[lobeLayout\.width, lobeLayout\.height\]/);
    assert.match(directoryMapSource, /iconAnchor: \[lobeLayout\.width \/ 2, lobeLayout\.height \/ 2\]/);
    assert.match(appCssSource, /\.leaflet-marker-icon\.directory-print-badge-leaflet-icon[\s\S]*pointer-events: none !important/);
    assert.match(appCssSource, /\.leaflet-marker-icon\.directory-print-badge-leaflet-icon \.directory-print-badge-marker__lobe[\s\S]*pointer-events: auto !important/);
    assert.match(directoryMapSource, /data-print-lobe-count="\$\{badgeItems\.length\}"/);
    assert.match(directoryMapSource, /class="directory-print-badge-marker__lobe"/);
    assert.match(directoryMapSource, /items: pin\.printBadgeItems \|\| null/);
    assert.match(directoryMapSource, /categoryColor: badgeColor/);
    assert.match(directoryMapSource, /class="directory-print-badge-marker"[\s\S]*pointer-events:none/);
    assert.match(directoryMapSource, /class="directory-print-badge-marker__core"[\s\S]*pointer-events:none/);
    assert.match(directoryMapSource, /class="directory-print-badge-marker__lobe"[\s\S]*pointer-events:auto/);
    assert.match(directoryMapSource, /background:\$\{item\.color\}/);
    assert.match(directoryMapSource, /border:2px solid rgba\(255,255,255,0\.96\)/);
    assert.match(directoryMapSource, /offsetX: pin\.printOffsetX \|\| 0/);
    assert.match(directoryMapSource, /offsetY: pin\.printOffsetY \|\| 0/);
    assert.match(directoryMapSource, /spreadCoincidentPins = true/);
    assert.match(directoryMapSource, /spreadPinsForDisplay\(pins, interactive, spreadCoincidentPins\)/);
    assert.match(directoryMapSource, /position=\{\[pin\.displayLat, pin\.displayLng\]\}/);
    assert.doesNotMatch(directoryMapSource, /pinBadgeMode === 'print-number'/);
    assert.doesNotMatch(discoverUtilsSource, /badgePlacement/);
    assert.doesNotMatch(directoryMapSource, /pinSpreadMode/);
    assert.doesNotMatch(directoryMapSource, /border:3px solid \$\{ringColor\}/);
});

test('directory map can render interactive category bubble markers with visible lobe hit targets', () => {
    assert.match(directoryMapSource, /markerMode === 'category-bubble'/);
    assert.match(directoryMapSource, /const DIRECTORY_CATEGORY_BUBBLE_DIAMETER = 28/);
    assert.match(directoryMapSource, /const DIRECTORY_CATEGORY_BUBBLE_LOBE_SPACING = DIRECTORY_CATEGORY_BUBBLE_DIAMETER \* 0\.74/);
    assert.match(directoryMapSource, /const DIRECTORY_CATEGORY_BUBBLE_DOT_ZOOM_THRESHOLD = 13\.25/);
    assert.match(directoryMapSource, /const DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER = 13/);
    assert.match(directoryMapSource, /const DIRECTORY_CATEGORY_BUBBLE_DOT_LOBE_SPACING = DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER \* 0\.58/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker/);
    assert.match(directoryMapSource, /function getCategoryBubbleLobeLayout\(count, compact = false\)/);
    assert.match(directoryMapSource, /diameter: compact \? DIRECTORY_CATEGORY_BUBBLE_DOT_DIAMETER : DIRECTORY_CATEGORY_BUBBLE_DIAMETER/);
    assert.match(directoryMapSource, /spacing: compact \? DIRECTORY_CATEGORY_BUBBLE_DOT_LOBE_SPACING : DIRECTORY_CATEGORY_BUBBLE_LOBE_SPACING/);
    assert.match(directoryMapSource, /function DirectoryCategoryBubbleZoomClassSync/);
    assert.match(directoryMapSource, /onCompactChange/);
    assert.match(directoryMapSource, /setCompactCategoryBubbles/);
    assert.match(directoryMapSource, /compact: compactCategoryBubbles/);
    assert.match(directoryMapSource, /compactCategoryBubbles \? 'compact' : 'full'/);
    assert.match(directoryMapSource, /directory-map--category-bubbles-compact/);
    assert.match(directoryMapSource, /function normalizeCategoryBubbleItems/);
    assert.match(directoryMapSource, /function getCategoryBubblePlaceKeyFromEvent\(event, fallbackPlaceKey\)/);
    assert.match(directoryMapSource, /data-category-bubble-place-key/);
    assert.match(directoryMapSource, /directory-category-bubble-marker__lobe--compact-dot/);
    assert.match(directoryMapSource, /categoryBubbleItems: pin\.categoryBubbleItems \|\| null/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker[\s\S]*class="directory-category-bubble-marker__content"/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker[\s\S]*class="directory-category-bubble-marker__ring"/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker[\s\S]*style="border-color:\$\{item\.color\};"/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker[\s\S]*background:#ffffff/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker[\s\S]*color:\$\{item\.color\}/);
    assert.match(directoryMapSource, /layoutOffsetX: preserveSolvedOffsets \? \(storedOffset\?\.x \?\? initialOffsetX\) : initialOffsetX/);
    assert.match(directoryMapSource, /layoutOffsetY: preserveSolvedOffsets \? \(storedOffset\?\.y \?\? initialOffsetY\) : initialOffsetY/);
    assert.match(directoryMapSource, /x: item\.layoutOffsetX \?\? item\.initialOffsetX/);
    assert.match(directoryMapSource, /y: item\.layoutOffsetY \?\? item\.initialOffsetY/);
    assert.match(directoryMapSource, /function hasPrintBadgeStoredOffsetDrift/);
    assert.match(directoryMapSource, /function hasAnyPrintBadgeStoredOffsetDrift/);
    assert.match(directoryMapSource, /new MutationObserver/);
    assert.match(directoryMapSource, /preserveSolvedOffsets && typeof MutationObserver !== 'undefined'/);
    assert.match(directoryMapSource, /observer\.observe\(markerPane, \{\s*attributes: true,\s*attributeFilter: \['style', 'class'\],\s*childList: true,\s*subtree: true,\s*\}\)/);
    assert.match(directoryMapSource, /hasAnyPrintBadgeStoredOffsetDrift\(markerPane, solvedOffsetsRef\.current\)/);
    assert.match(directoryMapSource, /preserveSolvedOffsets=\{markerMode === 'category-bubble'\}/);
    assert.match(directoryMapSource, /<DirectoryPrintBadgeCollisionSync[\s\S]*enabled=\{markerMode === 'print-badge' \|\| markerMode === 'category-bubble'\}[\s\S]*refreshKey=\{printBadgeLayoutRefreshKey\}/);
    assert.match(appCssSource, /\.leaflet-marker-icon\.directory-category-bubble-leaflet-icon[\s\S]*pointer-events: none !important/);
    assert.match(appCssSource, /\.leaflet-marker-icon\.directory-category-bubble-leaflet-icon \.directory-category-bubble-marker__lobe[\s\S]*pointer-events: auto !important/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__content[\s\S]*z-index: 1/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__ring[\s\S]*z-index: 2/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__ring[\s\S]*border: 3px solid currentColor/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__fallback[\s\S]*fill: currentColor/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__icon[\s\S]*width: 16px/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__icon[\s\S]*border-radius: 999px/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__icon[\s\S]*clip-path: circle\(50% at 50% 50%\)/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__icon[\s\S]*filter: none/);
    assert.match(appCssSource, /\.directory-category-bubble-marker__fallback[\s\S]*width: 14px/);
    assert.match(appCssSource, /\.directory-map--category-bubbles-compact[\s\S]*\.directory-category-bubble-marker__lobe::after[\s\S]*background: currentColor/);
    assert.match(appCssSource, /\.directory-map--category-bubbles-compact[\s\S]*\.directory-category-bubble-marker__content[\s\S]*visibility: hidden/);
});

test('directory map can show V2 category colors inside the saved pin circle without recoloring the teal pin body', () => {
    assert.match(discoverUtilsSource, /color = null/);
    assert.match(discoverUtilsSource, /colorSegments = \[\]/);
    assert.match(discoverUtilsSource, /function buildSegmentedCssFill/);
    assert.match(discoverUtilsSource, /linear-gradient\(90deg, \$\{stops\.join\(', '\)\}\)/);
    assert.match(discoverUtilsSource, /function formatPinBadgeLabel\(count = 0\)/);
    assert.match(discoverUtilsSource, /const outerFill = isTemporary/);
    assert.match(discoverUtilsSource, /const categoryFill = buildSegmentedCssFill/);
    assert.match(discoverUtilsSource, /renderSavedPinCenterGlyph\(iconUrl, categoryFill\)/);
    assert.match(discoverUtilsSource, /background:\$\{categoryFill\}/);
    assert.match(discoverUtilsSource, /fill="\$\{outerFill\}"/);
    assert.match(directoryMapSource, /pinCategoryIconMode = 'auto'/);
    assert.match(directoryMapSource, /iconUrl: pinCategoryIconMode === 'none' \? null : \(pin\.categoryIconUrl \|\| null\)/);
    assert.match(directoryMapSource, /color: pin\.categoryColor \|\| null/);
    assert.match(directoryMapSource, /colorSegments: pin\.categoryColorSegments \|\| \[\]/);
    assert.match(directoryMapSource, /savedPinIcon\.options\.categoryColor = pin\.categoryColor \|\| null/);
    assert.match(directoryMapSource, /savedPinIcon\.options\.categoryColorSegments = pin\.categoryColorSegments \|\| \[\]/);
    assert.doesNotMatch(directoryMapSource, /pinSpreadMode/);
});

test('directory map can render V2 clusters with the same-postal parent pin style', () => {
    assert.match(directoryMapSource, /createPostalGroupParentPinIcon/);
    assert.match(directoryMapSource, /clusterMarkerMode === 'postal-group'/);
    assert.match(directoryMapSource, /getDirectoryClusterAssetCount/);
    assert.match(directoryMapSource, /savedPinIcon\.options\.assetCount = getDirectoryPinAssetCount\(pin\)/);
    assert.match(directoryMapSource, /count: assetCount/);
    assert.match(directoryMapSource, /badgeCount: 0/);
    assert.match(directoryMapSource, /showBadge: false/);
});

test('directory map can render V2 clusters as compact overlapping asset pins instead of number bubbles', () => {
    assert.match(directoryMapSource, /DIRECTORY_ASSET_SPREAD_CLUSTER_MAX_VISIBLE = 8/);
    assert.match(directoryMapSource, /clusterMarkerMode === 'asset-spread'/);
    assert.match(directoryMapSource, /createDirectoryAssetSpreadClusterIcon\(children, emphasizedPlaceKeys\)/);
    assert.match(directoryMapSource, /getDirectoryAssetSpreadLayout/);
    assert.match(directoryMapSource, /visibleCount <= 4/);
    assert.match(directoryMapSource, /rotate:\s*-4/);
    assert.match(directoryMapSource, /iconSize:\s*\[86,\s*86\]/);
    assert.match(directoryMapSource, /rotate\(\$\{position\.rotate \|\| 0\}deg\)/);
    assert.match(directoryMapSource, /directory-asset-spread-cluster__pin/);
    assert.match(directoryMapSource, /pointer-events:auto/);
    assert.match(directoryMapSource, /cursor:pointer/);
    assert.match(directoryMapSource, /directory-asset-spread-cluster__hit-zone/);
    assert.doesNotMatch(directoryMapSource, /directory-asset-spread-cluster__anchor/);
    assert.match(directoryMapSource, /savedPinIcon\.options\.categoryIconUrl = pin\.categoryIconUrl \|\| null/);
    assert.match(directoryMapSource, /color: iconOptions\.categoryColor \|\| null/);
    assert.match(directoryMapSource, /colorSegments: iconOptions\.categoryColorSegments \|\| \[\]/);
    assert.match(directoryMapSource, /savedPinIcon\.options\.curatedCount = pin\.curatedCount/);
});

test('asset-spread clusters route nested pin hover and click as individual pin actions when enabled', () => {
    assert.match(directoryMapSource, /function getAssetSpreadPlaceKeyFromEvent\(event\)/);
    assert.match(directoryMapSource, /querySelectorAll\('\.directory-asset-spread-cluster__hit-zone\[data-place-key\]'\)/);
    assert.match(directoryMapSource, /Math\.hypot\(clientX - centerX, clientY - centerY\)/);
    assert.match(directoryMapSource, /sort\(\(left, right\) => left\.distance - right\.distance\)/);
    assert.match(directoryMapSource, /const lastAssetSpreadHoverRef = useRef\(null\)/);
    assert.match(directoryMapSource, /const handleClusterMouseMove = \(event\) => \{/);
    assert.match(directoryMapSource, /clusterGroup\.on\('clustermousemove', handleClusterMouseMove\)/);
    assert.match(directoryMapSource, /setAssetSpreadHover\(null\)/);
    assert.match(directoryMapSource, /clusterMarkerMode === 'asset-spread'\s*\?\s*getAssetSpreadPlaceKeyFromEvent\(event\)/);
    assert.match(directoryMapSource, /onHoverPlaceStart\?\.\(normalizedNextPlaceKey\)/);
    assert.match(directoryMapSource, /onHoverPlaceEnd\?\.\(previousPlaceKey\)/);
    assert.match(directoryMapSource, /onPlaceActivate\?\.\(assetSpreadPlaceKey\)/);
    assert.match(directoryMapSource, /clusterMarkerMode=\{clusterMarkerMode\}/);
    assert.match(directoryMapSource, /onPlaceActivate=\{handlePlaceActivate\}/);
});

test('directory map does not keep the rejected compact full-map marker-card mode', () => {
    assert.doesNotMatch(directoryMapSource, /pinCardMode/);
    assert.doesNotMatch(directoryMapSource, /directory-pin-card-marker/);
    assert.doesNotMatch(directoryMapSource, /buildDirectoryClusterPinCards/);
    assert.doesNotMatch(directoryMapSource, /pinCardData/);
});
