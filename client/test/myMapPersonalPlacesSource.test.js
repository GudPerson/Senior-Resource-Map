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

    assert.match(detailSource, /function PersonalPlaceActionStatus/);
    assert.match(detailSource, /data-personal-place-action-status/);
    assert.match(detailSource, /personalPlaceMutationInFlightRef/);
    assert.match(detailSource, /personalPlaceUpdatingMap/);
    assert.match(detailSource, /personalPlaceRemovingFromMap/);
    assert.match(detailSource, /personalPlaceRemovedFromMap/);
    assert.match(detailSource, /const refreshed = await loadMap\(\)/);
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

test('My Map short descriptions stay separate from Map Notes and suppress repeated card names', () => {
    const detailSource = readSource('../src/pages/MyMapDetailPage.jsx');
    const listSource = readSource('../src/components/SharedMapDirectoryList.jsx');
    const editorSource = readSource('../src/components/personalPlaces/PersonalPlaceEditorModal.jsx');
    const apiSource = readSource('../src/lib/api.js');

    assert.match(detailSource, /applyResourceShortDescriptorToDirectory/);
    assert.match(detailSource, /handleEditResourceShortDescription/);
    assert.match(detailSource, /<MapAssetShortDescriptionModal/);
    assert.match(listSource, /const repeatsPlaceName/);
    assert.match(listSource, /const showResourceName = !repeatsPlaceName/);
    assert.match(listSource, /row\.mapShortDescriptor/);
    assert.match(listSource, /function getPrimaryManagedPlaceRow/);
    assert.match(listSource, /<PrimaryMapShortDescription/);
    assert.match(listSource, /t\('addShortDescription'\)/);
    assert.match(editorSource, /personalPlaceShortDescription/);
    assert.match(editorSource, /personalPlaceImage/);
    assert.match(editorSource, /uploadFile=\{api\.uploadPersonalPlaceImage\}/);
    assert.match(editorSource, /logoUrl: form\.logoUrl\.trim\(\)/);
    assert.doesNotMatch(editorSource, /personalPlaceNote/);
    assert.match(apiSource, /updateMyMapAssetShortDescriptor/);
    assert.match(apiSource, /uploadPersonalPlaceImage/);
});
