import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildLoginPathWithMapReturn, buildOwnerMyMapPathFromSharedDirectory } from '../src/lib/appNavigation.js';

const sharedMapPageSource = readFileSync(
    new URL('../src/pages/SharedMapPage.jsx', import.meta.url),
    'utf8',
);

test('shared map sign-in links continue back to the current shared map', () => {
    assert.equal(
        buildLoginPathWithMapReturn('/shared/maps/shared-token?view=list#place-2'),
        '/login?returnTo=%2Fshared%2Fmaps%2Fshared-token%3Fview%3Dlist%23place-2',
    );
});

test('shared map sign-in links ignore unsafe or unrelated return targets', () => {
    assert.equal(buildLoginPathWithMapReturn('https://evil.example/shared/maps/shared-token'), '/login');
    assert.equal(buildLoginPathWithMapReturn('//evil.example/shared/maps/shared-token'), '/login');
    assert.equal(buildLoginPathWithMapReturn('/dashboard'), '/login');
    assert.equal(buildLoginPathWithMapReturn(''), '/login');
});

test('shared map owners continue to their private My Map route', () => {
    assert.equal(
        buildOwnerMyMapPathFromSharedDirectory({
            id: 87,
            viewer: { isAuthenticated: true, isOwner: true },
        }),
        '/my-directory/maps/87',
    );
    assert.equal(
        buildOwnerMyMapPathFromSharedDirectory({
            id: 87,
            viewer: { isAuthenticated: true, isOwner: false },
        }),
        '',
    );
    assert.equal(
        buildOwnerMyMapPathFromSharedDirectory({
            id: 87,
            viewer: { isAuthenticated: false, isOwner: true },
        }),
        '',
    );
    assert.equal(
        buildOwnerMyMapPathFromSharedDirectory({
            id: 'not-a-map-id',
            viewer: { isAuthenticated: true, isOwner: true },
        }),
        '',
    );
});

test('shared map page wires continuation through all sign-in entry points', () => {
    assert.match(sharedMapPageSource, /buildLoginPathWithMapReturn\(sharedMapReturnPath\)/);
    assert.ok(
        (sharedMapPageSource.match(/to=\{loginPath\}/g) || []).length >= 3,
        'desktop header, shared prompt, and mobile drawer sign-in links should use the continuation path',
    );
    assert.match(sharedMapPageSource, /loadDirectory\(\{ keepCurrent: true \}\)/);
    assert.match(sharedMapPageSource, /buildOwnerMyMapPathFromSharedDirectory\(translatedDirectory\)/);
    assert.match(sharedMapPageSource, /navigate\(ownerMyMapPath, \{ replace: true \}\)/);
    assert.match(sharedMapPageSource, /const canSaveSharedResources = Boolean\(isAuth && !isOwner\);/);
});

test('shared map interactive view uses the My Map V2 card and pin language', () => {
    assert.match(sharedMapPageSource, /api\.getSubCategories\(\{ suppressAuthExpired: true \}\)\.catch\(\(\) => \[\]\)/);
    assert.match(sharedMapPageSource, /const enrichedDirectory = applySubCategoryMetaToDirectory\(nextDirectory, subcategories\)/);
    assert.match(sharedMapPageSource, /setDirectory\(await backfillGroupFocusPlaceKeys\(enrichedDirectory\)\)/);
    assert.match(sharedMapPageSource, /buildDirectoryPresentation\(translatedDirectory, \{ query, activeAnchor, presentationMode: 'v2-cards' \}\)/);
    assert.match(sharedMapPageSource, /const resolvedPlaceKey = sharedPresentation\.groupKeyByPlaceKey\?\.\[placeKey\] \|\| placeKey/);
    assert.match(sharedMapPageSource, /presentation=\{sharedPresentation\}/);
    assert.match(sharedMapPageSource, /showMapLegend=\{false\}/);
    assert.match(sharedMapPageSource, /cardBadgeMode="logo"/);
    assert.match(sharedMapPageSource, /desktopGridClassName=\{SHARED_MAP_V2_DESKTOP_GRID_CLASS\}/);
    assert.match(sharedMapPageSource, /markerMode="category-bubble"/);
    assert.match(sharedMapPageSource, /pinBadgeMode="none"/);
    assert.match(sharedMapPageSource, /pinCategoryIconMode="none"/);
    assert.match(sharedMapPageSource, /clusterMarkerMode="none"/);
    assert.match(sharedMapPageSource, /fitPaddingBottomRight=\{SHARED_MAP_V2_FIT_PADDING_BOTTOM_RIGHT\}/);
    assert.doesNotMatch(sharedMapPageSource, /presentation=\{interactivePresentation\}/);
    assert.doesNotMatch(sharedMapPageSource, /markerMode="number"/);
});

test('shared map can backfill Group member focus keys from public Group details', () => {
    assert.match(sharedMapPageSource, /getGroupFocusFallbackResourceIds/);
    assert.match(sharedMapPageSource, /mergeGroupFocusDetailsIntoDirectory/);
    assert.match(sharedMapPageSource, /async function backfillGroupFocusPlaceKeys/);
    assert.match(sharedMapPageSource, /api\.getSoftAsset\(id, \{ suppressAuthExpired: true \}\)\.catch\(\(\) => null\)/);
    assert.match(sharedMapPageSource, /detail\?\.assetMode === 'group'/);
    assert.match(sharedMapPageSource, /mergeGroupFocusDetailsIntoDirectory\(directory, groupDetailsByResourceId\)/);
});

test('shared map print stays on the shared print path while interactive view is refreshed', () => {
    assert.match(sharedMapPageSource, /if \(isPrintView\) \{/);
    assert.match(sharedMapPageSource, /<DirectoryPrintView[\s\S]*mode="shared"/);
    assert.doesNotMatch(sharedMapPageSource, /useV2OwnerPrint/);
});
