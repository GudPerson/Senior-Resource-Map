import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDirectoryPresentation } from '../src/lib/directoryPresentation.js';

function hardPlace({
    key,
    name,
    subCategory,
    categoryColor = null,
    categoryIconUrl = null,
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
                categoryColor,
                categoryIconUrl,
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
            categoryColor: '#2563eb',
            categoryIconUrl: '/icons/scc.svg',
            postalCode: '300300',
            lat: '1.300',
            lng: '103.830',
        }),
        hardPlace({
            key: 'hard-20',
            name: 'Beta Active Ageing',
            subCategory: 'Active Ageing Centre (AAC)',
            categoryColor: '#0f766e',
            categoryIconUrl: '/icons/aac.svg',
            postalCode: '200200',
            lat: '1.320',
            lng: '103.840',
        }),
        hardPlace({
            key: 'hard-10',
            name: 'Alpha Active Ageing',
            subCategory: 'Active Ageing Centre (AAC)',
            categoryColor: '#0f766e',
            categoryIconUrl: '/icons/aac.svg',
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
                    categoryColor: '#64748b',
                    categoryIconUrl: '/icons/home.svg',
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
    const postalPin = presentation.pins.find((pin) => pin.isPostalGroup);

    assert.equal(presentation.mappedGroups.length, 3);
    assert.equal(presentation.mappedGroups.some((group) => group.isPostalGroup), false);
    assert.deepEqual(presentation.hoverPlaceKeysByKey['hard-10'], ['hard-10', 'hard-20']);
    assert.deepEqual(presentation.hoverPlaceKeysByKey['hard-20'], ['hard-10', 'hard-20']);
    assert.deepEqual(presentation.hoverPlaceKeysByKey['postal-group:200200'], ['hard-10', 'hard-20']);
    assert.equal(presentation.pins.length, 2);
    assert.equal(postalPin.placeKey, 'postal-group:200200');
    assert.deepEqual(postalPin.memberPlaceKeys, ['hard-10', 'hard-20']);
    assert.equal(presentation.groupKeyByPlaceKey['hard-10'], 'postal-group:200200');
    assert.equal(presentation.groupKeyByPlaceKey['hard-20'], 'postal-group:200200');
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

test('v2 card presentation lets list-only Group cards borrow mapped Place member focus keys', () => {
    const presentation = buildDirectoryPresentation({
        places: [
            hardPlace({
                key: 'hard-10',
                name: 'Alpha Active Ageing',
                subCategory: 'Active Ageing Centre (AAC)',
                postalCode: '200200',
                lat: '1.321',
                lng: '103.841',
            }),
            hardPlace({
                key: 'hard-20',
                name: 'Beta Active Ageing',
                subCategory: 'Active Ageing Centre (AAC)',
                postalCode: '200201',
                lat: '1.322',
                lng: '103.842',
            }),
            {
                placeKey: 'fallback-soft-99',
                placeId: null,
                name: 'West Active Ageing Picks',
                address: null,
                postalCode: '',
                lat: null,
                lng: null,
                hasCoordinates: false,
                rows: [
                    {
                        rowKey: 'soft-99:fallback',
                        assetKey: 'soft-99',
                        resourceType: 'soft',
                        resourceId: 99,
                        name: 'West Active Ageing Picks',
                        subCategory: 'Group',
                        status: 'list_only',
                        mapFocusPlaceKeys: ['hard-10', 'hard-20', 'hard-404'],
                    },
                ],
            },
        ],
    }, { presentationMode: 'v2-cards' });
    const groupCard = presentation.displayGroups.find((group) => group.rows?.[0]?.resourceId === 99);

    assert.equal(groupCard.hasCoordinates, false);
    assert.deepEqual(groupCard.mapFocusPlaceKeys, ['hard-10', 'hard-20']);
    assert.equal(groupCard.shortLocationLine, '');
    assert.deepEqual(presentation.mapColumnGroups.map((group) => group.placeKey), [groupCard.placeKey]);
    assert.equal(presentation.leftGroups.includes(groupCard), false);
    assert.equal(presentation.rightGroups.includes(groupCard), false);
    assert.deepEqual(groupCard.memberPlaceKeys, [
        groupCard.placeKey,
        'hard-10',
        'hard-20',
    ]);
    assert.deepEqual(presentation.mapFocusPlaceKeysByKey[groupCard.placeKey], ['hard-10', 'hard-20']);
});

test('v2 card presentation exposes category colors and icons for cards and pins', () => {
    const presentation = buildDirectoryPresentation(directory, { presentationMode: 'v2-cards' });
    const alphaGroup = presentation.displayGroups.find((group) => group.placeKey === 'hard-10');
    const alphaPin = presentation.pins.find((pin) => pin.memberPlaceKeys?.includes('hard-10'));
    const unmappedCard = presentation.displayGroups.find((group) => group.isUnmappedGroup);

    assert.equal(alphaGroup.categoryColor, '#0f766e');
    assert.equal(alphaGroup.categoryIconUrl, '/icons/aac.svg');
    assert.equal(alphaPin.categoryColor, '#0f766e');
    assert.deepEqual(alphaPin.categoryColorSegments, ['#0f766e']);
    assert.equal(alphaPin.categoryIconUrl, null);
    assert.equal(unmappedCard.categoryColor, '#64748b');
    assert.equal(unmappedCard.categoryIconUrl, '/icons/home.svg');
});

test('v2 pins ignore soft asset categories when one hard asset anchors the postal code', () => {
    const mixedPlace = hardPlace({
        key: 'hard-40',
        name: 'Mixed Services Hub',
        subCategory: 'Active Ageing Centre (AAC)',
        categoryColor: '#0f766e',
        categoryIconUrl: '/icons/aac.svg',
        postalCode: '400400',
    });
    mixedPlace.rows.push({
        rowKey: 'hard-40:soft',
        assetKey: 'soft-40',
        resourceType: 'soft',
        resourceId: 40,
        name: 'Care Navigation',
        subCategory: 'Home Base Services',
        categoryColor: '#f97316',
        categoryIconUrl: '/icons/home.svg',
        detailPath: '/resource/soft/40',
    });

    const presentation = buildDirectoryPresentation({ places: [mixedPlace] }, { presentationMode: 'v2-cards' });
    const [pin] = presentation.pins;

    assert.equal(pin.categoryColor, '#0f766e');
    assert.deepEqual(pin.categoryColorSegments, ['#0f766e']);
});

test('v2 card presentation uses host place category for hosted programme-only map rows', () => {
    const hostedProgrammePlace = {
        placeKey: 'hard-70',
        placeId: 70,
        name: 'REACH Senior Centre @ Bukit Gombak Vista (BGV)',
        address: '377A Bukit Batok Street 31 Singapore 651377',
        postalCode: '651377',
        lat: '1.363',
        lng: '103.751',
        hasCoordinates: true,
        rows: [
            {
                rowKey: 'soft-70:hard-70',
                assetKey: 'soft-70',
                resourceType: 'soft',
                resourceId: 70,
                name: 'REACH Senior Centre @ Bukit Gombak Vista (BGV)',
                subCategory: 'Programmes',
                categoryColor: '#38bdf8',
                categoryIconUrl: '/icons/programmes.svg',
                mapSubCategory: 'Active Ageing Centre (AAC)',
                mapIconKey: 'active ageing centre (aac)',
                mapCategoryColor: '#f59e0b',
                mapCategoryIconUrl: '/icons/aac.svg',
                detailPath: '/resource/soft/70',
            },
        ],
    };

    const presentation = buildDirectoryPresentation({ places: [hostedProgrammePlace] }, { presentationMode: 'v2-cards' });
    const [group] = presentation.displayGroups;
    const [pin] = presentation.pins;

    assert.equal(group.categoryLabel, 'Active Ageing Centre (AAC)');
    assert.equal(group.categoryColor, '#f59e0b');
    assert.equal(group.categoryIconUrl, '/icons/aac.svg');
    assert.equal(group.rows[0].subCategory, 'Programmes');
    assert.equal(pin.categoryColor, '#f59e0b');
    assert.deepEqual(pin.categoryColorSegments, ['#f59e0b']);
});

test('v2 pins split colors across hard asset categories sharing a postal code', () => {
    const aacPlace = hardPlace({
        key: 'hard-50',
        name: 'Precious Active Ageing Centre',
        subCategory: 'Active Ageing Centre (AAC)',
        categoryColor: '#f59e0b',
        categoryIconUrl: '/icons/aac.svg',
        postalCode: '680488',
    });
    const dayRehabPlace = hardPlace({
        key: 'hard-60',
        name: 'Diaverum Dialysis Centre',
        subCategory: 'Day Rehabilitation',
        categoryColor: '#ef4444',
        categoryIconUrl: '/icons/day-rehab.svg',
        postalCode: '680488',
    });
    aacPlace.rows.push({
        rowKey: 'hard-50:soft',
        assetKey: 'soft-50',
        resourceType: 'soft',
        resourceId: 50,
        name: 'Care Navigation',
        subCategory: 'Home Base Services',
        categoryColor: '#22c55e',
        categoryIconUrl: '/icons/home.svg',
        detailPath: '/resource/soft/50',
    });

    const presentation = buildDirectoryPresentation({ places: [aacPlace, dayRehabPlace] }, { presentationMode: 'v2-cards' });
    const [postalPin] = presentation.pins;

    assert.equal(presentation.pins.length, 1);
    assert.equal(postalPin.placeKey, 'postal-group:680488');
    assert.deepEqual(postalPin.memberPlaceKeys, ['hard-60', 'hard-50']);
    assert.deepEqual(postalPin.categoryColorSegments, ['#f59e0b', '#ef4444']);
    assert.equal(postalPin.categoryBubbleItems.length, 2);
    assert.deepEqual(
        postalPin.categoryBubbleItems.map((item) => item.placeKey),
        ['hard-60', 'hard-50'],
    );
    assert.deepEqual(
        postalPin.categoryBubbleItems.map((item) => item.iconUrl),
        ['/icons/day-rehab.svg', '/icons/aac.svg'],
    );
    assert.deepEqual(
        postalPin.categoryBubbleItems.map((item) => item.color),
        ['#ef4444', '#f59e0b'],
    );
});

test('v2 card presentation can recover a mapped hard-asset address from the row when the place address is stale', () => {
    const stalePlace = hardPlace({
        key: 'hard-18337',
        name: 'REACH-SLEC Active Ageing Centre @ Teck Whye Vista',
        subCategory: 'Active Ageing Centre (AAC)',
        categoryColor: '#f59e0b',
        categoryIconUrl: '/icons/aac.svg',
        postalCode: '680417',
        address: null,
    });
    stalePlace.rows[0].address = '417 Bukit Batok West Ave 4 Singapore 650417';

    const presentation = buildDirectoryPresentation({ places: [stalePlace] }, { presentationMode: 'v2-cards' });
    const [group] = presentation.displayGroups;

    assert.equal(group.shortLocationLine, '417 Bukit Batok West Ave 4');
    assert.equal(group.rows[0].locationLabel, '417 Bukit Batok West Ave 4');
});

test('v2 card presentation keeps a postal-only Singapore address visible', () => {
    const postalOnlyPlace = hardPlace({
        key: 'hard-18337',
        name: 'REACH-SLEC Active Ageing Centre @ Teck Whye Vista',
        subCategory: 'Active Ageing Centre (AAC)',
        categoryColor: '#f59e0b',
        categoryIconUrl: '/icons/aac.svg',
        postalCode: '680153',
        address: 'Singapore 680153',
    });
    postalOnlyPlace.rows[0].address = 'Singapore 680153';

    const presentation = buildDirectoryPresentation({ places: [postalOnlyPlace] }, { presentationMode: 'v2-cards' });
    const [group] = presentation.displayGroups;

    assert.equal(group.shortLocationLine, 'Singapore 680153');
    assert.equal(group.rows[0].locationLabel, 'Singapore 680153');
});
