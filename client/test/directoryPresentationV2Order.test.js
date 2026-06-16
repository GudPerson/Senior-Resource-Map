import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDirectoryPresentation } from '../src/lib/directoryPresentation.js';

function hardPlace({
    key,
    name,
    subCategory,
    postalCode,
    lat = '1.38',
    lng = '103.74',
    address = `Blk ${postalCode} Test Street Singapore ${postalCode}`,
}) {
    return {
        placeKey: key,
        placeId: Number(key.replace(/\D/g, '')) || null,
        name,
        address,
        postalCode,
        lat,
        lng,
        hasCoordinates: true,
        rows: [
            {
                rowKey: `${key}:hard`,
                assetKey: key,
                resourceType: 'hard',
                resourceId: Number(key.replace(/\D/g, '')) || 1,
                name,
                subCategory,
                detailPath: `/resource/hard/${Number(key.replace(/\D/g, '')) || 1}`,
            },
        ],
    };
}

const directory = {
    places: [
        hardPlace({
            key: 'hard-30',
            name: 'Zoo Senior Care',
            subCategory: 'Senior Care Centre (SCC)',
            postalCode: '300300',
            lat: '1.300',
            lng: '103.830',
        }),
        hardPlace({
            key: 'hard-20',
            name: 'Beta Active Ageing',
            subCategory: 'Active Ageing Centre (AAC)',
            postalCode: '200200',
            lat: '1.320',
            lng: '103.840',
        }),
        hardPlace({
            key: 'hard-10',
            name: 'Alpha Active Ageing',
            subCategory: 'Active Ageing Centre (AAC)',
            postalCode: '200200',
            lat: '1.321',
            lng: '103.841',
        }),
        {
            placeKey: 'fallback-soft-90',
            placeId: null,
            name: 'Home support fallback',
            address: null,
            postalCode: '',
            lat: null,
            lng: null,
            hasCoordinates: false,
            rows: [
                {
                    rowKey: 'soft-90:fallback',
                    assetKey: 'soft-90',
                    resourceType: 'soft',
                    resourceId: 90,
                    name: 'Alpha Meals Support',
                    subCategory: 'Home Base Services',
                    detailPath: '/resource/soft/90',
                    status: 'list_only',
                },
            ],
        },
    ],
};

test('default directory presentation keeps postal grouping and separate unmapped rows', () => {
    const presentation = buildDirectoryPresentation(directory);

    assert.equal(presentation.mappedGroups.length, 2);
    assert.equal(presentation.mappedGroups.some((group) => group.isPostalGroup), true);
    assert.equal(presentation.unmappedRows.length, 1);
    assert.equal(presentation.displayGroups, undefined);
    assert.equal(presentation.integratesUnmappedRowsAsCards, undefined);
});

test('v2 card presentation orders by mapped status, category, and resource name', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });

    assert.deepEqual(presentation.displayGroups.map((group) => group.name), [
        'Alpha Active Ageing',
        'Beta Active Ageing',
        'Zoo Senior Care',
        'Alpha Meals Support',
    ]);
    assert.deepEqual(presentation.displayGroups.map((group) => group.number), [1, 2, 3, 4]);
    assert.deepEqual(presentation.leftGroups.map((group) => group.name), [
        'Alpha Active Ageing',
        'Beta Active Ageing',
    ]);
    assert.deepEqual(presentation.rightGroups.map((group) => group.name), [
        'Zoo Senior Care',
        'Alpha Meals Support',
    ]);
});

test('v2 card presentation keeps same-postal hard assets as separate cards with shared hover peers', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });

    assert.equal(presentation.mappedGroups.length, 3);
    assert.equal(presentation.mappedGroups.some((group) => group.isPostalGroup), false);
    assert.deepEqual(presentation.hoverPlaceKeysByKey['hard-10'], ['hard-10', 'hard-20']);
    assert.deepEqual(presentation.hoverPlaceKeysByKey['hard-20'], ['hard-10', 'hard-20']);
    assert.equal(presentation.pins.length, 3);
    assert.equal(presentation.placeNumberByKey['hard-10'], 1);
    assert.equal(presentation.placeNumberByKey['hard-20'], 2);
});

test('v2 card presentation integrates unmapped resources as normal category cards', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });
    const unmappedCard = presentation.displayGroups.find((group) => group.isUnmappedGroup);

    assert.equal(presentation.integratesUnmappedRowsAsCards, true);
    assert.equal(presentation.showCategoryPills, true);
    assert.equal(unmappedCard.name, 'Alpha Meals Support');
    assert.equal(unmappedCard.hasCoordinates, false);
    assert.equal(unmappedCard.categoryLabel, 'Home Base Services');
    assert.equal(unmappedCard.rows[0].assetKey, 'soft-90');
    assert.deepEqual(presentation.noteUnmappedRows.map((row) => row.name), ['Alpha Meals Support']);
});
