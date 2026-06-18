import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildMyMapDirectory } from '../src/utils/myMapDirectory.js';

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
            subCategory: 'Active Ageing Centre (AAC)',
            address: '377A Bukit Batok Street 31 Singapore 651377',
            lat: '1.363',
            lng: '103.751',
            isHidden: false,
            hideFrom: null,
            hideUntil: null,
            isDeleted: false,
            partner: { id: 7, managerUserId: null },
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
                findFirst: async () => liveSoftAsset,
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
    assert.equal(row.mapSubCategory, 'Active Ageing Centre (AAC)');
    assert.equal(row.mapCategoryColor, '#f59e0b');
    assert.equal(row.mapCategoryIconUrl, '/icons/aac.svg');
});
