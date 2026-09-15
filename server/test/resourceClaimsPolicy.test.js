import assert from 'node:assert/strict';
import test from 'node:test';

import {
    allowedResourceClaimFields,
    hasRequestedPublicationScope,
    isPublicationScopeWithinRequest,
    normalizeResourceClaimFields,
    normalizeResourceClaimUses,
    resourceClaimDisplayStatus,
    resourceFieldHasValue,
} from '../src/utils/resourceClaims.js';

test('claim field and use normalization rejects unsupported or empty publication scope', () => {
    assert.equal(allowedResourceClaimFields('hard').includes('ctaUrl'), false);
    assert.equal(allowedResourceClaimFields('soft').includes('ctaUrl'), true);
    assert.deepEqual(normalizeResourceClaimFields(['logoUrl', 'ctaUrl', 'logoUrl', 'phone'], 'hard'), ['logoUrl']);
    assert.deepEqual(normalizeResourceClaimUses({ sharedMaps: true, embeds: 'true', publicDirectory: true }), {
        sharedMaps: true,
        embeds: false,
    });
    assert.equal(hasRequestedPublicationScope(['logoUrl'], { sharedMaps: true }), true);
    assert.equal(hasRequestedPublicationScope([], { sharedMaps: true }), false);
});

test('publication approval can narrow but cannot expand the owner request', () => {
    const request = {
        requestedFields: ['logoUrl', 'website'],
        requestedUses: { sharedMaps: true, embeds: false },
    };
    assert.equal(isPublicationScopeWithinRequest({
        ...request,
        approvedFields: ['logoUrl'],
        approvedUses: { sharedMaps: true, embeds: false },
    }), true);
    assert.equal(isPublicationScopeWithinRequest({
        ...request,
        approvedFields: ['bannerUrl'],
        approvedUses: { sharedMaps: true, embeds: false },
    }), false);
    assert.equal(isPublicationScopeWithinRequest({
        ...request,
        approvedFields: ['logoUrl'],
        approvedUses: { sharedMaps: true, embeds: true },
    }), false);
});

test('withdrawn database state distinguishes rejection and owner withdrawal', () => {
    assert.equal(resourceClaimDisplayStatus({ status: 'permission_withdrawn', reviewedByUserId: 1, approvedAt: null }), 'claim_rejected');
    assert.equal(resourceClaimDisplayStatus({ status: 'permission_withdrawn', reviewedByUserId: null, approvedAt: null }), 'permission_withdrawn');
    assert.equal(resourceClaimDisplayStatus({ status: 'permission_withdrawn', reviewedByUserId: 1, approvedAt: new Date() }), 'permission_withdrawn');
});

test('publication approval checks that approved fields currently contain owner values', () => {
    const resource = { logoUrl: 'https://owner.example/logo.png', galleryUrls: [], socialLinks: {}, description: 'Owner text' };
    assert.equal(resourceFieldHasValue(resource, 'logoUrl'), true);
    assert.equal(resourceFieldHasValue(resource, 'description'), true);
    assert.equal(resourceFieldHasValue(resource, 'galleryUrls'), false);
    assert.equal(resourceFieldHasValue(resource, 'socialLinks'), false);
});
