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
