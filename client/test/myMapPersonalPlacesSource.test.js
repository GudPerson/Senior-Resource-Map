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
    assert.match(chooserSource, /place\.mapIds/);
    assert.match(apiSource, /attachMyMapPersonalPlace/);
});

test('personal place categories expose curated icons, colours, and global editing', () => {
    const categorySource = readSource('../src/components/personalPlaces/PersonalPlaceCategoryManagerModal.jsx');
    const presentationSource = readSource('../src/lib/directoryPresentation.js');
    const mapSource = readSource('../src/components/DirectoryMap.jsx');

    assert.match(categorySource, /PERSONAL_PLACE_ICON_OPTIONS/);
    assert.match(categorySource, /PERSONAL_PLACE_COLOR_OPTIONS/);
    assert.match(categorySource, /isArchived/);
    assert.match(presentationSource, /categoryIconKey/);
    assert.match(mapSource, /renderPersonalPlaceIconMarkup/);
});
