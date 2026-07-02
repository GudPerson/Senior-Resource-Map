import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildGroupDiscoverMetadata,
    buildGroupReadiness,
    buildGroupMemberSearchText,
    buildGroupMemberSummary,
    buildPublicGroupPayload,
    getPublicGroupMemberLocations,
    isDiscoverReadyGroup,
    isGroupSoftAsset,
} from '../src/utils/softAssetGroups.js';

const publicPlace = {
    id: 10,
    name: 'Bukit Batok Care Hub',
    subCategory: 'Active Ageing Centre (AAC)',
    address: 'Blk 10 Example Street',
    postalCode: '650010',
    lat: '1.3500',
    lng: '103.7500',
    isHidden: false,
    isDeleted: false,
};

const publicProgramme = {
    id: 20,
    name: 'Falls Prevention Workshop',
    assetMode: 'standalone',
    bucket: 'Programmes',
    subCategory: 'Falls prevention',
    description: 'Balance and mobility support',
    audienceMode: 'public',
    isMemberOnly: false,
    isHidden: false,
    isDeleted: false,
    locations: [{ hardAsset: publicPlace }],
};

function group(overrides = {}) {
    return {
        id: 99,
        name: 'West Active Ageing Picks',
        assetMode: 'group',
        description: 'Curated support in the west.',
        tags: [{ tag: { name: 'Caregiver' } }],
        isHidden: false,
        isDeleted: false,
        audienceMode: 'public',
        isMemberOnly: false,
        staffMemberships: [{ id: 1, staffRole: 'owner', revokedAt: null }],
        groupMembers: [
            { memberResourceType: 'hard', memberResourceId: 10, sortOrder: 0, hardAsset: publicPlace },
            { memberResourceType: 'soft', memberResourceId: 20, sortOrder: 1, softAsset: publicProgramme },
        ],
        ...overrides,
    };
}

test('isGroupSoftAsset only treats assetMode group as a Group', () => {
    assert.equal(isGroupSoftAsset({ assetMode: 'group' }), true);
    assert.equal(isGroupSoftAsset({ assetMode: 'standalone' }), false);
    assert.equal(isGroupSoftAsset({ assetMode: 'child' }), false);
    assert.equal(isGroupSoftAsset(null), false);
});

test('buildGroupMemberSummary counts exact public hard and soft members by public category', () => {
    const summary = buildGroupMemberSummary(group({
        groupMembers: [
            { memberResourceType: 'hard', memberResourceId: 10, hardAsset: publicPlace },
            { memberResourceType: 'soft', memberResourceId: 20, softAsset: publicProgramme },
            {
                memberResourceType: 'soft',
                memberResourceId: 21,
                softAsset: { ...publicProgramme, id: 21, bucket: 'Services', name: 'Home care support' },
            },
            {
                memberResourceType: 'soft',
                memberResourceId: 22,
                softAsset: { ...publicProgramme, id: 22, bucket: 'Promotions', name: 'Transport voucher' },
            },
            {
                memberResourceType: 'soft',
                memberResourceId: 23,
                softAsset: { ...publicProgramme, id: 23, name: 'Hidden member', isHidden: true },
            },
        ],
    }));

    assert.deepEqual(summary.counts, {
        places: 1,
        programmes: 1,
        services: 1,
        promotions: 1,
        total: 4,
    });
});

test('buildPublicGroupPayload filters non-public members and blocks nested Groups', () => {
    const payload = buildPublicGroupPayload(group({
        groupMembers: [
            { memberResourceType: 'hard', memberResourceId: 10, hardAsset: publicPlace },
            { memberResourceType: 'hard', memberResourceId: 11, hardAsset: { ...publicPlace, id: 11, name: 'Hidden Place', isHidden: true } },
            { memberResourceType: 'soft', memberResourceId: 20, softAsset: publicProgramme },
            { memberResourceType: 'soft', memberResourceId: 21, softAsset: { ...publicProgramme, id: 21, isMemberOnly: true } },
            { memberResourceType: 'soft', memberResourceId: 22, softAsset: { ...publicProgramme, id: 22, audienceMode: 'partner_boundary' } },
            { memberResourceType: 'soft', memberResourceId: 23, softAsset: { ...publicProgramme, id: 23, assetMode: 'group' } },
        ],
    }));

    assert.equal(payload.assetMode, 'group');
    assert.equal(payload.groupMemberSummary.counts.total, 2);
    assert.deepEqual(payload.groupMembers.places.map((member) => member.id), [10]);
    assert.deepEqual(payload.groupMembers.programmes.map((member) => member.id), [20]);
    assert.deepEqual(payload.groupMembers.services, []);
    assert.deepEqual(payload.groupMembers.promotions, []);
});

test('Groups need an active Owner and at least one public member to be Discover-ready', () => {
    assert.equal(isDiscoverReadyGroup(group()), true);
    assert.equal(buildGroupReadiness(group()).status, 'ready');
    assert.equal(isDiscoverReadyGroup(group({ isHidden: true })), false);
    assert.equal(buildGroupReadiness(group({ isHidden: true })).status, 'hidden');
    assert.equal(isDiscoverReadyGroup(group({ staffMemberships: [] })), false);
    assert.equal(buildGroupReadiness(group({ staffMemberships: [] })).status, 'needs_owner');
    assert.equal(isDiscoverReadyGroup(group({ staffMemberships: [{ staffRole: 'staff', revokedAt: null }] })), false);
    assert.equal(isDiscoverReadyGroup(group({ staffMemberships: [{ staffRole: 'owner', revokedAt: new Date().toISOString() }] })), false);
    assert.equal(isDiscoverReadyGroup(group({
        groupMembers: [
            { memberResourceType: 'soft', memberResourceId: 21, softAsset: { ...publicProgramme, id: 21, isMemberOnly: true } },
        ],
    })), false);
    assert.equal(buildGroupReadiness(group({
        groupMembers: [
            { memberResourceType: 'soft', memberResourceId: 21, softAsset: { ...publicProgramme, id: 21, isMemberOnly: true } },
        ],
    })).status, 'needs_members');
});

test('target-region Groups need selected Regions but keep public members discoverable', () => {
    assert.equal(isDiscoverReadyGroup(group({
        audienceMode: 'target_regions',
        coverageRegionIds: [12, 13],
    })), true);
    assert.equal(buildGroupReadiness(group({
        audienceMode: 'target_regions',
        coverageRegionIds: [],
    })).status, 'needs_regions');

    const payload = buildPublicGroupPayload(group({
        audienceMode: 'target_regions',
        coverageRegionIds: [12],
    }));

    assert.equal(payload.audienceMode, 'target_regions');
    assert.deepEqual(payload.coverageRegionIds, [12]);
    assert.equal(payload.groupMemberSummary.counts.total, 2);
});

test('Group Discover metadata uses public member search and locations without creating own pins', () => {
    const asset = group();
    const metadata = buildGroupDiscoverMetadata(asset);
    const searchText = buildGroupMemberSearchText(asset);
    const locations = getPublicGroupMemberLocations(asset);

    assert.equal(metadata.assetMode, 'group');
    assert.equal(metadata.isDiscoverReady, true);
    assert.equal(metadata.groupOwnerCount, 1);
    assert.equal(metadata.groupReadinessStatus, 'ready');
    assert.equal(metadata.locationCount, 2);
    assert.match(searchText, /Bukit Batok Care Hub/);
    assert.match(searchText, /Falls Prevention Workshop/);
    assert.equal(locations.length, 2);
    assert.equal(locations[0].postalCode, '650010');
});
