import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPublicHardAssetDto,
    buildPublicSoftAssetDto,
} from '../src/utils/publicResourceDtos.js';

const FORBIDDEN_PUBLIC_KEYS = new Set([
    'externalKey',
    'partnerId',
    'createdByUserId',
    'updatedByUserId',
    'lastVerifiedByUserId',
    'sourceGooglePlaceId',
    'sourceGoogleMapsUri',
    'sourceType',
    'verificationStatus',
    'verificationConfidence',
    'partner',
    'creator',
    'updater',
    'staffMemberships',
    'eligibilityRules',
    'overriddenFields',
    'audienceZones',
    'audienceZoneIds',
    'organizationLinks',
    'permissions',
    'boundaryStatus',
    'ownershipMode',
    'partnerName',
    'partnerRole',
    'creatorName',
    'updatedByName',
    'groupOwnerCount',
    'groupReadinessStatus',
    'isDiscoverReady',
]);

function assertNoInternalKeys(value) {
    if (Array.isArray(value)) {
        value.forEach(assertNoInternalKeys);
        return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
        assert.equal(FORBIDDEN_PUBLIC_KEYS.has(key), false, `${key} must not appear in a guest DTO`);
        assertNoInternalKeys(nested);
    }
}

test('guest Place DTO keeps catalogue details and drops ownership, provenance, and governance data', () => {
    const dto = buildPublicHardAssetDto({
        id: 29,
        externalKey: 'internal-place-key',
        partnerId: 7,
        createdByUserId: 8,
        name: 'Care Centre',
        subCategory: 'Active Ageing Centre',
        address: '1 Example Street',
        lat: '1.3000',
        lng: '103.8000',
        phone: '6000 0000',
        website: 'https://example.org',
        sourceGooglePlaceId: 'provider-record-id',
        lastVerifiedByUserId: 9,
        partner: { id: 7, name: 'Internal owner', managerUserId: 4 },
        creator: { id: 8, name: 'Staff Person' },
        organizationLinks: [{ organizationId: 5, organizationName: 'Internal Org' }],
        permissions: { canEdit: false },
        tags: ['support'],
        softAssets: [{
            id: 44,
            name: 'Weekly programme',
            schedule: 'Monday 10am',
            eligibilityRules: { chasCard: ['blue'] },
            staffMemberships: [{ id: 12, staffRole: 'owner' }],
        }],
    });

    assert.equal(dto.id, 29);
    assert.equal(dto.name, 'Care Centre');
    assert.equal(dto.softAssets[0].name, 'Weekly programme');
    assertNoInternalKeys(dto);
});

test('guest Offering and Group DTOs keep public members but drop management relations', () => {
    const dto = buildPublicSoftAssetDto({
        id: 44,
        name: 'Neighbourhood collection',
        assetMode: 'group',
        audienceMode: 'public',
        updatedAt: '2026-08-26T00:00:00.000Z',
        updatedByName: 'Internal Staff',
        groupOwnerCount: 2,
        groupReadinessStatus: 'ready',
        groupMembers: {
            places: [{
                resourceType: 'hard',
                id: 29,
                name: 'Care Centre',
                address: '1 Example Street',
                partnerId: 7,
                partner: { id: 7, name: 'Internal owner' },
            }],
            programmes: [],
            services: [],
            promotions: [],
        },
        locations: [{
            id: 29,
            name: 'Care Centre',
            address: '1 Example Street',
            partnerId: 7,
            staffMemberships: [{ userId: 99 }],
        }],
        eligibilityRules: { caregiverStatus: ['yes'] },
        organizationLinks: [{ organizationId: 5 }],
    });

    assert.equal(dto.name, 'Neighbourhood collection');
    assert.equal(dto.groupMembers.places[0].name, 'Care Centre');
    assert.equal(dto.locations[0].address, '1 Example Street');
    assertNoInternalKeys(dto);
});
