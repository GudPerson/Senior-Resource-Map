import test from 'node:test';
import assert from 'node:assert/strict';

import { formatHardAssetListSummary } from '../src/utils/hardAssetListSummary.js';

test('hard asset list summaries keep list fields and omit heavy nested payloads', () => {
    const summary = formatHardAssetListSummary({
        id: 12,
        name: 'Example AAC',
        address: 'Blk 1 Example Road Singapore 123456',
        postalCode: '123456',
        subCategory: 'Active Ageing Centre (AAC)',
        logoUrl: 'https://example.test/logo.png',
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        lastReviewedAt: new Date('2026-05-21T00:00:00.000Z'),
        lastVerifiedByUserId: 3,
        sourceType: 'official_source',
        verificationStatus: 'verified',
        verificationConfidence: '90',
        partner: { id: 5, name: 'Legacy Owner', role: 'partner' },
        partnerId: 5,
        subregionId: 9,
        matchingRegionIds: [9],
        softAssets: [{ id: 99, name: 'Heavy nested offering' }],
        hostedSoftAssets: [{ id: 100, name: 'Heavy hosted offering' }],
        translations: { zh: { name: 'Translated' } },
    }, {
        boundaryStatus: 'inside',
        tags: ['Health', 'Senior Activities'],
        permissions: {
            canEdit: false,
            canManageAccess: false,
            canDelete: false,
            canHide: false,
        },
        organizationLinks: [
            { organizationId: 8, organizationName: 'Pilot Org' },
        ],
        membershipSummary: {
            membershipCount: 3,
            memberPreview: [{ id: 1 }],
            hasMoreMembers: true,
        },
    });

    assert.deepEqual(summary, {
        id: 12,
        name: 'Example AAC',
        address: 'Blk 1 Example Road Singapore 123456',
        postalCode: '123456',
        subCategory: 'Active Ageing Centre (AAC)',
        logoUrl: 'https://example.test/logo.png',
        isHidden: false,
        hideFrom: null,
        hideUntil: null,
        lastReviewedAt: new Date('2026-05-21T00:00:00.000Z'),
        lastVerifiedByUserId: 3,
        sourceType: 'official_source',
        verificationStatus: 'verified',
        verificationConfidence: '90',
        partnerId: 5,
        partnerName: 'Legacy Owner',
        partnerRole: 'partner',
        ownershipMode: 'partner',
        tags: ['Health', 'Senior Activities'],
        boundaryStatus: 'inside',
        matchingRegionIds: [9],
        primaryRegionId: 9,
        organizationLinks: [
            { organizationId: 8, organizationName: 'Pilot Org' },
        ],
        permissions: {
            canEdit: false,
            canManageAccess: false,
            canDelete: false,
            canHide: false,
        },
        membershipCount: 3,
        memberPreview: [{ id: 1 }],
        hasMoreMembers: true,
    });

    assert.equal(Object.hasOwn(summary, 'softAssets'), false);
    assert.equal(Object.hasOwn(summary, 'hostedSoftAssets'), false);
    assert.equal(Object.hasOwn(summary, 'translations'), false);
});
