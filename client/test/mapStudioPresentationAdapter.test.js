import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDirectoryPresentation } from '../src/lib/directoryPresentation.js';
import {
    buildMapStudioResourceLayerCatalog,
    filterMapStudioDirectoryByLayers,
    getVisibleMapStudioResourceRowKeys,
} from '../src/lib/mapStudioPresentationAdapter.js';

const directory = {
    summary: { resourceCount: 3 },
    places: [
        {
            placeKey: 'hard-1',
            name: 'Alpha Active Ageing Centre',
            address: '1 Alpha Road Singapore 680001',
            postalCode: '680001',
            lat: 1.38,
            lng: 103.74,
            hasCoordinates: true,
            rows: [{
                rowKey: 'hard-1',
                resourceType: 'hard',
                resourceId: 1,
                name: 'Alpha Active Ageing Centre',
                subCategory: 'Active Ageing Centre (AAC)',
                mapSubCategory: 'Active Ageing Centre (AAC)',
            }],
        },
        {
            placeKey: 'hard-2',
            name: 'Beta Senior Care Centre',
            address: '2 Beta Road Singapore 680002',
            postalCode: '680002',
            lat: 1.39,
            lng: 103.75,
            hasCoordinates: true,
            rows: [{
                rowKey: 'hard-2',
                resourceType: 'hard',
                resourceId: 2,
                name: 'Beta Senior Care Centre',
                subCategory: 'Senior Care Centre (SCC)',
                mapSubCategory: 'Senior Care Centre (SCC)',
            }],
        },
        {
            placeKey: 'personal_place-9',
            name: 'Family meeting point',
            address: '3 Gamma Road Singapore 680003',
            postalCode: '680003',
            lat: 1.4,
            lng: 103.76,
            hasCoordinates: true,
            rows: [{
                rowKey: 'personal_place-9',
                resourceType: 'personal_place',
                resourceId: 9,
                name: 'Family meeting point',
                subCategory: 'Meeting point',
            }],
        },
    ],
};

test('Map Studio resource catalogue assigns every V2 card row to one stable category layer', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });
    const catalog = buildMapStudioResourceLayerCatalog(presentation);

    assert.equal(catalog.groups.length, 2);
    assert.equal(catalog.groups.reduce((total, group) => total + group.count, 0), 3);
    assert.equal(Object.keys(catalog.layerKeyByRowKey).length, 3);
    assert.equal(getVisibleMapStudioResourceRowKeys(catalog).size, 3);
});

test('one hidden category rebuilds the source directory for matching V2 and classic cards and pins', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });
    const catalog = buildMapStudioResourceLayerCatalog(presentation);
    const hiddenCategory = catalog.groups
        .flatMap((group) => group.categories)
        .find((category) => category.label.includes('Active Ageing'));
    const filtered = filterMapStudioDirectoryByLayers(directory, catalog, [hiddenCategory.key]);
    const filteredV2 = buildDirectoryPresentation(filtered, { presentationMode: 'v2-cards' });
    const filteredClassic = buildDirectoryPresentation(filtered);

    assert.equal(filtered.summary.resourceCount, 2);
    assert.equal(filteredV2.displayGroups.some((group) => group.name.includes('Alpha')), false);
    assert.equal(filteredClassic.mappedGroups.some((group) => group.name.includes('Alpha')), false);
    assert.equal(filteredV2.pins.length, 2);
    assert.equal(filteredClassic.pins.length, 2);
});

test('hiding a resource family removes only that family and leaves the source directory immutable', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });
    const catalog = buildMapStudioResourceLayerCatalog(presentation);
    const personalGroup = catalog.groups.find((group) => group.key === 'resource:personal');
    const filtered = filterMapStudioDirectoryByLayers(directory, catalog, [personalGroup.key]);

    assert.equal(filtered.places.some((place) => place.placeKey === 'personal_place-9'), false);
    assert.equal(filtered.places.length, 2);
    assert.equal(directory.places.length, 3);
    assert.equal(directory.summary.resourceCount, 3);
});
