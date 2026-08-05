import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readSource(path) {
    return fs.readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('My Map owner page exposes personal-place add/edit/remove API paths', () => {
    const source = readSource('../src/pages/MyMapDetailPage.jsx');

    assert.match(source, /addPersonalPlace/);
    assert.match(source, /personalPlaceMapHint/);
    assert.match(source, /createMyMapPersonalPlace/);
    assert.match(source, /updateMyMapPersonalPlace/);
    assert.match(source, /deleteMyMapPersonalPlace/);
    assert.match(source, /row\?\.resourceType === 'personal_place'/);
});
test('DirectoryMap supports map-first personal-place placement', () => {
    const source = readSource('../src/components/DirectoryMap.jsx');

    assert.match(source, /function DirectoryMapClickHandler/);
    assert.match(source, /onMapClick/);
    assert.match(source, /const currentAnchorPlacementHandlers = mapClickEnabled && anchorPoint\?\.kind === 'current'/);
    assert.match(source, /eventHandlers=\{currentAnchorPlacementHandlers\}/);
    assert.match(source, /onMapClick\(\{\s*lat: anchorPoint\.lat,\s*lng: anchorPoint\.lng,/);
    assert.match(source, /const shellSize = isHome \? '36px' : isCurrent \? '26px' : '34px'/);
    assert.match(source, /iconSize: \[40, 40\]/);
    assert.match(source, /!pins\.length && !anchorPoint && !onMapClick/);
});

test('shared directory list treats personal places as owner-only local rows', () => {
    const source = readSource('../src/components/SharedMapDirectoryList.jsx');

    assert.match(source, /resourceType === 'personal_place'/);
    assert.match(source, /onEditPersonalPlace/);
    assert.match(source, /getResourceKindLabel/);
    assert.match(source, /\!\['hard', 'soft'\]\.includes\(row\?\.resourceType\)/);
});

test('My Places library supports reusable places and delete-everywhere semantics', () => {
    const directorySource = readSource('../src/pages/MyDirectoryPage.jsx');
    const librarySource = readSource('../src/components/personalPlaces/PersonalPlacesSection.jsx');
    const chooserSource = readSource('../src/components/personalPlaces/AddPersonalPlaceChooserModal.jsx');
    const apiSource = readSource('../src/lib/api.js');

    assert.match(directorySource, /places: 'my-places'/);
    assert.match(directorySource, /<PersonalPlacesSection/);
    assert.match(librarySource, /api\.getPersonalPlaces\(\)/);
    assert.match(librarySource, /api\.deletePersonalPlace\(place\.id\)/);
    assert.match(librarySource, /Delete everywhere/);
    assert.match(librarySource, /setDeletingPlaceId\(place\.id\)/);
    assert.match(librarySource, /Deleting\.\.\./);
    assert.match(librarySource, /logoUrl=\{place\.logoUrl\}/);
    assert.match(chooserSource, /place\.mapIds/);
    assert.match(chooserSource, /aria-busy=\{submitting\}/);
    assert.match(chooserSource, /Adding selected places to your map/);
    assert.match(apiSource, /attachMyMapPersonalPlace/);
});

test('personal-place map mutations keep visible progress through the map refresh', () => {
    const detailSource = readSource('../src/pages/MyMapDetailPage.jsx');
    const mapSource = readSource('../src/components/DirectoryMap.jsx');
    const scaffoldSource = readSource('../src/components/MyMapV2PreviewScaffold.jsx');

    assert.match(detailSource, /function PersonalPlaceActionStatus/);
    assert.match(detailSource, /data-personal-place-action-status/);
    assert.match(detailSource, /personalPlaceMutationInFlightRef/);
    assert.match(detailSource, /personalPlaceUpdatingMap/);
    assert.match(detailSource, /personalPlaceRemovingFromMap/);
    assert.match(detailSource, /personalPlaceRemovedFromMap/);
    assert.match(detailSource, /const refreshed = await loadMap\(\)/);
    assert.match(detailSource, /directoryMapInteractionSuspended = suspendMapInteraction && !personalPlacePickerActive/);
    assert.match(detailSource, /suspendMapInteraction=\{directoryMapInteractionSuspended\}/);
    assert.match(detailSource, /interactive=\{!directoryMapInteractionSuspended\}/);
    assert.match(detailSource, /mapSurfaceStatus=\{personalPlaceMapSurfaceStatus\}/);
    assert.match(detailSource, /surfaceStatus=\{personalPlaceMapSurfaceStatus\}/);
    assert.match(detailSource, /personalPlaceActionStatus \? \(\s*<PersonalPlaceActionStatus/);
    assert.doesNotMatch(detailSource, /fixed inset-x-4 bottom-4/);
    assert.match(mapSource, /surfaceStatus = null/);
    assert.match(mapSource, /data-map-surface-status="true"/);
    assert.match(scaffoldSource, /surfaceStatus=\{mapSurfaceStatus\}/);
});

test('personal place categories expose curated icons, colours, and global editing', () => {
    const categorySource = readSource('../src/components/personalPlaces/PersonalPlaceCategoryManagerModal.jsx');
    const presentationSource = readSource('../src/lib/directoryPresentation.js');
    const mapSource = readSource('../src/components/DirectoryMap.jsx');
    const directoryListSource = readSource('../src/components/SharedMapDirectoryList.jsx');
    const resourceRowIconSource = readSource('../src/components/ResourceRowIcon.jsx');

    assert.match(categorySource, /PERSONAL_PLACE_ICON_OPTIONS/);
    assert.match(categorySource, /PERSONAL_PLACE_COLOR_OPTIONS/);
    assert.match(categorySource, /isArchived/);
    assert.match(categorySource, /Pin icon/);
    assert.match(categorySource, />Badge</);
    assert.match(categorySource, /CategoryBadgePreview/);
    assert.match(categorySource, /buildPersonalPlacePinPreviewHtml/);
    assert.match(categorySource, /<ImageUpload/);
    assert.match(categorySource, /uploadFile=\{api\.uploadPersonalPlaceCategoryIcon\}/);
    assert.match(categorySource, /iconUrl: form\.iconUrl \|\| null/);
    assert.match(presentationSource, /categoryIconKey/);
    assert.match(mapSource, /renderPersonalPlaceIconMarkup/);
    assert.match(mapSource, /color: pin\.categoryColor/);
    assert.match(directoryListSource, /iconKey=\{group\.categoryIconKey\}/);
    assert.match(directoryListSource, /<PersonalPlaceCategoryIcon/);
    assert.match(resourceRowIconSource, /resourceType === 'personal_place'[\s\S]*return MapPin/);
    assert.doesNotMatch(resourceRowIconSource, /getPersonalPlaceIconComponent/);
});

test('personal place image upload does not reset an in-progress editor draft', () => {
    const editorSource = readSource('../src/components/personalPlaces/PersonalPlaceEditorModal.jsx');
    const apiSource = readSource('../src/lib/api.js');

    assert.match(editorSource, /function getPersonalPlaceDraftKey/);
    assert.match(editorSource, /initializedDraftKeyRef/);
    assert.match(editorSource, /initializedDraftKeyRef\.current === draftKey/);
    assert.match(editorSource, /current\.categoryId \? current : \{ \.\.\.current, categoryId: nextCategoryId \}/);
    assert.doesNotMatch(editorSource, /\}, \[activeCategories, draft, open\]\);/);
    assert.match(apiSource, /'\/upload'/);
});

test('new personal-place flow makes the map-location step explicit', () => {
    const detailSource = readSource('../src/pages/MyMapDetailPage.jsx');
    const chooserSource = readSource('../src/components/personalPlaces/AddPersonalPlaceChooserModal.jsx');
    const i18nSource = readSource('../src/lib/i18n.js');

    assert.match(chooserSource, /Choose map location/);
    assert.doesNotMatch(chooserSource, />\s*Create new\s*</);
    assert.match(detailSource, /function PersonalPlacePlacementPrompt/);
    assert.match(detailSource, /data-personal-place-placement-prompt="true"/);
    assert.match(detailSource, /personalPlacePickerActive \? \(/);
    assert.match(detailSource, /mapSurfaceStatus=\{personalPlaceMapSurfaceStatus\}/);
    assert.match(detailSource, /surfaceStatus=\{personalPlaceMapSurfaceStatus\}/);
    assert.match(i18nSource, /The place details form opens next\./);
});

test('My Map short descriptions stay separate from Map Notes and suppress repeated card names', () => {
    const detailSource = readSource('../src/pages/MyMapDetailPage.jsx');
    const printViewSource = readSource('../src/components/DirectoryPrintView.jsx');
    const listSource = readSource('../src/components/SharedMapDirectoryList.jsx');
    const shortDescriptionModalSource = readSource('../src/components/MapAssetShortDescriptionModal.jsx');
    const editorSource = readSource('../src/components/personalPlaces/PersonalPlaceEditorModal.jsx');
    const apiSource = readSource('../src/lib/api.js');

    assert.match(detailSource, /applyResourceShortDescriptorToDirectory/);
    assert.match(detailSource, /handleEditResourceShortDescription/);
    assert.match(detailSource, /<MapAssetShortDescriptionModal/);
    assert.match(listSource, /const repeatsPlaceName/);
    assert.match(listSource, /const showResourceName = !repeatsPlaceName/);
    assert.match(listSource, /normalizeMapShortDescriptorItems/);
    assert.match(listSource, /function getPrimaryManagedPlaceRow/);
    assert.match(listSource, /<PrimaryMapShortDescription/);
    assert.match(listSource, /t\('addShortDescription'\)/);
    assert.match(detailSource, /const \[printShortDescriptionMode, setPrintShortDescriptionMode\]/);
    assert.match(detailSource, /data-print-short-description-trigger="true"/);
    assert.match(detailSource, /onEditResourceShortDescription=\{printShortDescriptionMode[\s\S]*handleEditResourceShortDescription[\s\S]*: null\}/);
    assert.equal(
        (detailSource.match(/onEditResourceShortDescription=\{handleEditResourceShortDescription\}/g) || []).length,
        0,
    );
    assert.match(printViewSource, /variant === 'screen'[\s\S]*\? onEditResourceShortDescription[\s\S]*: null/);
    assert.match(listSource, /data-print-short-description-action="true"/);
    assert.match(listSource, /data-print-short-description-text="true"/);
    assert.match(listSource, /data-print-address-text="true"/);
    assert.match(listSource, /getMapShortDescriptorPrintStyle/);
    assert.match(listSource, /compactPrint \? 'text-\[0\.9375rem\]' : 'text-base'/);
    assert.match(
        listSource,
        /const printShortDescriptionClassName = printRowTitle[\s\S]*?\? rowTitleClassName[\s\S]*?: \(compactPrint \? 'text-\[0\.9375rem\]' : 'text-base'\)/,
        'a repeated personal-place description should match its visible group title size',
    );
    assert.match(
        listSource,
        /<MapShortDescriptionText item=\{item\} textClassName=\{printShortDescriptionClassName\}>/,
        'the Print View row should use the resolved visible-title size for descriptions',
    );
    assert.match(shortDescriptionModalSource, /MAP_SHORT_DESCRIPTOR_TEXT_COLORS/);
    assert.match(shortDescriptionModalSource, /MAP_SHORT_DESCRIPTOR_HIGHLIGHT_COLORS/);
    assert.match(shortDescriptionModalSource, /shortDescriptionCustomTextColour/);
    assert.match(shortDescriptionModalSource, /shortDescriptionCustomHighlightColour/);
    assert.match(shortDescriptionModalSource, /shortDescriptorTextColor/);
    assert.match(shortDescriptionModalSource, /shortDescriptorHighlightColor/);
    assert.match(shortDescriptionModalSource, /addAnotherShortDescription/);
    assert.match(shortDescriptionModalSource, /shortDescriptors/);
    assert.match(listSource, /const printShortDescriptionEditing = !interactive/);
    assert.equal(
        (detailSource.match(/setPrintShortDescriptionMode\(false\)/g) || []).length,
        3,
        'description mode should reset only when entering or exiting Print View',
    );
    assert.doesNotMatch(editorSource, /personalPlaceShortDescription/);
    assert.doesNotMatch(editorSource, /shortDescription/);
    assert.match(editorSource, /personalPlaceImage/);
    assert.match(editorSource, /uploadFile=\{api\.uploadPersonalPlaceImage\}/);
    assert.match(editorSource, /logoUrl: form\.logoUrl\.trim\(\)/);
    assert.doesNotMatch(editorSource, /personalPlaceNote/);
    assert.match(apiSource, /updateMyMapAssetShortDescriptor/);
    assert.match(apiSource, /updateMyMapPersonalPlaceShortDescriptor/);
    assert.match(detailSource, /shortDescriptionRow\.resourceType === 'personal_place'/);
    assert.doesNotMatch(listSource, /canManageShortDescription = mode === 'owner'[\s\S]{0,80}!personalPlace/);
    assert.match(apiSource, /uploadPersonalPlaceImage/);
});
