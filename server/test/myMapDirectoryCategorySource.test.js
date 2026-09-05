import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    buildMyMapDirectory,
    countOpenToAllProgrammesAndServices,
} from '../src/utils/myMapDirectory.js';

const source = readFileSync(
    new URL('../src/utils/myMapDirectory.js', import.meta.url),
    'utf8',
);

test('My Map directory snapshots expose category color with category icons', () => {
    assert.match(source, /color: true/);
    assert.match(source, /color: subCategories\.color/);
    assert.match(source, /categoryColor: categoryMeta\?\.color \|\| null/);
    assert.match(source, /categoryIconUrl: categoryMeta\?\.iconUrl \|\| null/);
    assert.match(source, /address: place\.address \|\| null/);
    assert.match(source, /const hardPlaceRow = place\.rows\.find\(\(row\) => row\.resourceType === 'hard' && \(row\.categoryIconUrl \|\| row\.categoryColor\)\)/);
    assert.match(source, /sharedCategoryColor = row\.categoryColor \|\| null/);
    assert.match(source, /categoryColor: categoryMeta\.color/);
});

test('hard Place snapshots count only public programmes and services that are open to all', () => {
    const publicOffering = {
        id: 41,
        bucket: 'Programmes',
        audienceMode: 'public',
        isMemberOnly: false,
        eligibilityRules: null,
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
    };
    const asset = {
        softAssets: [
            { softAsset: publicOffering },
            { softAsset: { ...publicOffering, id: 42, bucket: 'Services' } },
            { softAsset: { ...publicOffering, id: 43, bucket: 'Promotions' } },
            { softAsset: { ...publicOffering, id: 44, isMemberOnly: true } },
            { softAsset: { ...publicOffering, id: 45, eligibilityRules: { version: 1, criteria: { age: { min: 60 } } } } },
        ],
        hostedSoftAssets: [
            { ...publicOffering, id: 41 },
            { ...publicOffering, id: 46, audienceMode: 'audience_zones' },
            { ...publicOffering, id: 47, isHidden: true },
        ],
    };

    assert.equal(countOpenToAllProgrammesAndServices(asset), 2);
});

test('large My Maps batch live Place hydration instead of issuing one query per resource', async () => {
    const liveAssets = Array.from({ length: 60 }, (_, index) => ({
        id: index + 1,
        name: `Resource ${index + 1}`,
        subCategory: 'Community place',
        address: `${index + 1} Example Street`,
        postalCode: String(600000 + index + 1),
        lat: String(1.3 + index / 10000),
        lng: String(103.7 + index / 10000),
        hours: null,
        logoUrl: null,
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
        partner: null,
    }));
    let batchReads = 0;
    let perAssetReads = 0;
    const db = {
        query: {
            subCategories: { findMany: async () => [] },
            hardAssets: {
                findMany: async (query) => {
                    batchReads += 1;
                    assert.equal(query.columns.postalCode, true);
                    return liveAssets;
                },
                findFirst: async () => {
                    perAssetReads += 1;
                    return null;
                },
            },
            softAssets: {
                findMany: async () => [],
                findFirst: async () => null,
            },
        },
    };
    const map = {
        id: 258,
        name: 'Large planning map',
        userId: 5,
        assets: liveAssets.map((asset) => ({
            id: asset.id,
            resourceType: 'hard',
            resourceId: asset.id,
            snapshot: null,
            addedAt: new Date('2026-08-06T00:00:00.000Z'),
        })),
    };

    const { directory, snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser: { id: 5, role: 'standard' },
        visibilityUser: { id: 5, role: 'standard' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'owner',
    });

    assert.equal(directory.summary.savedResourceCount, 60);
    assert.equal(snapshotUpdates.length, 60);
    assert.equal(batchReads, 1);
    assert.equal(perAssetReads, 0);
    assert.equal(directory.places[0].postalCode, '600001');
});

test('hosted programme rows expose the host place category for My Map V2 presentation', async () => {
    const liveSoftAsset = {
        id: 701,
        name: 'REACH Senior Centre @ Bukit Gombak Vista (BGV)',
        bucket: 'Programmes',
        subCategory: 'Programmes',
        description: null,
        schedule: null,
        venueNote: null,
        logoUrl: null,
        audienceMode: 'public',
        isMemberOnly: false,
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
        assetMode: 'child',
        partnerId: 7,
        subregionId: 3,
        hostHardAssetId: 70,
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: null,
        eligibilityRules: null,
        partner: { id: 7, managerUserId: null },
        hostHardAsset: {
            id: 70,
            name: 'REACH Senior Centre @ Bukit Gombak Vista (BGV)',
            logoUrl: 'https://example.test/reach-logo.png',
            subCategory: 'Active Ageing Centre (AAC)',
            address: '377A Bukit Batok Street 31 Singapore 651377',
            postalCode: '651377',
            lat: '1.363',
            lng: '103.751',
            isHidden: false,
            hideFrom: null,
            hideUntil: null,
            isDeleted: false,
            partner: { id: 7, managerUserId: null },
            softAssets: [],
            hostedSoftAssets: [
                {
                    id: 702,
                    bucket: 'Programmes',
                    subCategory: 'Exercise',
                    audienceMode: 'public',
                    isMemberOnly: false,
                    eligibilityRules: null,
                    isHidden: false,
                    hideFrom: null,
                    hideUntil: null,
                    isDeleted: false,
                },
                {
                    id: 703,
                    bucket: 'Services',
                    subCategory: 'Care navigation',
                    audienceMode: 'public',
                    isMemberOnly: false,
                    eligibilityRules: null,
                    isHidden: false,
                    hideFrom: null,
                    hideUntil: null,
                    isDeleted: false,
                },
            ],
        },
        locations: [],
    };
    const db = {
        query: {
            subCategories: {
                findMany: async () => [
                    { name: 'Programmes', color: '#38bdf8', iconUrl: '/icons/programmes.svg' },
                    { name: 'Active Ageing Centre (AAC)', color: '#f59e0b', iconUrl: '/icons/aac.svg' },
                ],
            },
            hardAssets: {
                findFirst: async () => null,
            },
            softAssets: {
                findFirst: async (query) => {
                    assert.equal(query.with.hostHardAsset.columns.postalCode, true);
                    return liveSoftAsset;
                },
            },
        },
    };
    const map = {
        id: 87,
        name: 'Hosted programme map',
        userId: 5,
        assets: [
            {
                id: 9001,
                resourceType: 'soft',
                resourceId: 701,
                addedAt: new Date('2026-06-18T00:00:00.000Z'),
                snapshot: {
                    version: 2,
                    resourceType: 'soft',
                    resourceId: 701,
                    name: 'REACH Senior Centre @ Bukit Gombak Vista (BGV)',
                    bucket: 'Programmes',
                    subCategory: 'Programmes',
                    detailPath: '/resource/soft/701',
                    descriptor: null,
                    logoUrl: null,
                    availabilityEnabled: false,
                    availabilityCount: 0,
                    availabilityUnit: null,
                    places: [
                        {
                            placeId: 70,
                            placeKey: 'hard-70',
                            name: 'REACH Senior Centre @ Bukit Gombak Vista (BGV)',
                            address: '377A Bukit Batok Street 31 Singapore 651377',
                            lat: '1.363',
                            lng: '103.751',
                            hasCoordinates: true,
                        },
                    ],
                },
            },
        ],
    };

    const { directory } = await buildMyMapDirectory(db, {
        map,
        viewerUser: { id: 5, role: 'standard' },
        visibilityUser: { id: 5, role: 'standard' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'owner',
    });

    const [row] = directory.places[0].rows;

    assert.equal(row.subCategory, 'Programmes');
    assert.equal(row.categoryColor, '#38bdf8');
    assert.equal(row.categoryIconUrl, '/icons/programmes.svg');
    assert.equal(row.logoUrl, 'https://example.test/reach-logo.png');
    assert.equal(directory.places[0].postalCode, '651377');
    assert.equal(directory.places[0].openProgrammeServiceCount, 2);
    assert.equal(row.mapSubCategory, 'Active Ageing Centre (AAC)');
    assert.equal(row.mapCategoryColor, '#f59e0b');
    assert.equal(row.mapCategoryIconUrl, '/icons/aac.svg');
});

test('Group rows expose only direct public Place member keys for My Map focus', async () => {
    const publicPlace = {
        id: 10,
        name: 'Bukit Batok Care Hub',
        subCategory: 'Active Ageing Centre (AAC)',
        address: 'Blk 10 Example Street Singapore 650010',
        postalCode: '650010',
        lat: '1.3500',
        lng: '103.7500',
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
        partner: null,
    };
    const hiddenPlace = {
        ...publicPlace,
        id: 11,
        name: 'Hidden Care Hub',
        isHidden: true,
    };
    const publicProgramme = {
        id: 20,
        name: 'Falls Prevention Workshop',
        assetMode: 'standalone',
        bucket: 'Programmes',
        subCategory: 'Falls prevention',
        audienceMode: 'public',
        isMemberOnly: false,
        isHidden: false,
        isDeleted: false,
        partner: null,
        hostHardAsset: publicPlace,
        locations: [{ hardAsset: publicPlace }],
    };
    const liveGroup = {
        id: 99,
        name: 'West Active Ageing Picks',
        bucket: 'Groups',
        subCategory: 'Group',
        description: null,
        schedule: null,
        venueNote: null,
        logoUrl: null,
        audienceMode: 'public',
        isMemberOnly: false,
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        isDeleted: false,
        assetMode: 'group',
        partnerId: null,
        subregionId: null,
        hostHardAssetId: null,
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: null,
        eligibilityRules: null,
        partner: null,
        hostHardAsset: null,
        locations: [],
        groupMembers: [
            { memberResourceType: 'hard', memberResourceId: 10, hardAsset: publicPlace, sortOrder: 0 },
            { memberResourceType: 'hard', memberResourceId: 11, hardAsset: hiddenPlace, sortOrder: 1 },
            { memberResourceType: 'soft', memberResourceId: 20, softAsset: publicProgramme, sortOrder: 2 },
            {
                memberResourceType: 'soft',
                memberResourceId: 21,
                softAsset: {
                    ...publicProgramme,
                    id: 21,
                    name: 'Nested Group',
                    assetMode: 'group',
                },
                sortOrder: 3,
            },
        ],
    };
    const hardAssets = [publicPlace];
    const db = {
        query: {
            subCategories: { findMany: async () => [] },
            hardAssets: {
                findFirst: async () => hardAssets.shift() || null,
            },
            softAssets: {
                findFirst: async () => liveGroup,
            },
        },
    };
    const map = {
        id: 88,
        name: 'Group member focus map',
        userId: 5,
        assets: [
            {
                id: 9101,
                resourceType: 'hard',
                resourceId: 10,
                addedAt: new Date('2026-06-26T00:00:00.000Z'),
                snapshot: null,
            },
            {
                id: 9102,
                resourceType: 'soft',
                resourceId: 99,
                addedAt: new Date('2026-06-26T00:05:00.000Z'),
                snapshot: null,
            },
        ],
    };

    const { directory } = await buildMyMapDirectory(db, {
        map,
        viewerUser: { id: 5, role: 'standard' },
        visibilityUser: { id: 5, role: 'standard' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'owner',
    });

    const groupRow = directory.places
        .flatMap((place) => place.rows)
        .find((row) => row.resourceType === 'soft' && row.resourceId === 99);

    assert.equal(groupRow.status, 'list_only');
    assert.deepEqual(groupRow.mapFocusPlaceKeys, ['hard-10']);
    assert.deepEqual(groupRow.groupMemberAssetKeys, ['hard-10', 'soft-20']);
});
