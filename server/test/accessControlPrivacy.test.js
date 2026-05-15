import assert from 'node:assert/strict';
import test from 'node:test';

import { Hono } from 'hono';

import app from '../src/app.js';
import { authenticateToken, authorize, authorizeResourceOperator } from '../src/middleware/auth.js';
import { canManageAudienceZone, canUseAudienceZoneForHardAssetIds, canViewAudienceZone } from '../src/utils/audienceZones.js';
import { buildMyMapAssetSnapshot, normalizeMyMapAssetSnapshot } from '../src/utils/myMapDirectory.js';
import {
    actorCanDeleteHardAsset,
    actorCanHideHardAsset,
    actorCanManageAsset,
    actorCanManagePartnerOwnedEntity,
    canAssignPartnerOwner,
} from '../src/utils/ownership.js';
import { buildSavedAssetSnapshot } from '../src/utils/savedAssets.js';
import { createSessionToken, SESSION_HEADER_NAME } from '../src/utils/sessionAuth.js';

const TEST_ENV = {
    NODE_ENV: 'production',
    JWT_SECRET: 'access-control-test-secret',
};

function createActor(overrides = {}) {
    return {
        id: 1,
        username: 'actor',
        email: 'actor@example.test',
        name: 'Actor',
        role: 'standard',
        postalCode: '680153',
        subregionIds: [],
        ...overrides,
    };
}

async function createToken(user) {
    return createSessionToken(user, { env: TEST_ENV });
}

async function authedFetch(path, user, options = {}) {
    const token = await createToken(user);
    return app.fetch(
        new Request(`https://app.carearound.sg${path}`, {
            method: options.method || 'GET',
            headers: {
                [SESSION_HEADER_NAME]: token,
                'Content-Type': 'application/json',
                Origin: 'https://app.carearound.sg',
                ...(options.headers || {}),
            },
            body: options.body,
        }),
        TEST_ENV,
    );
}

function assertNoSensitivePayload(value) {
    const text = JSON.stringify(value);
    [
        'privateNotes',
        'privateFiles',
        'privateResourceContent',
        'accessUserIds',
        'fileData',
        'staff-only',
        'human_edited',
        'reviewedAt',
        'updatedByUserId',
    ].forEach((needle) => {
        assert.equal(text.includes(needle), false, `${needle} should not be present in public/snapshot payload`);
    });
}

test('asset ownership rules require explicit asset access beyond Super Admin', () => {
    const ownerPartner = { id: 20, role: 'partner', managerUserId: 9, subregionIds: [4] };
    const asset = {
        id: 12,
        partnerId: 20,
        subregionId: 4,
        partner: ownerPartner,
    };

    assert.equal(actorCanManageAsset(createActor({ id: 1, role: 'super_admin' }), asset, ownerPartner), true);
    assert.equal(actorCanManageAsset(createActor({ id: 20, role: 'partner', subregionIds: [4] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 21, role: 'partner', subregionIds: [4] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 9, role: 'regional_admin', subregionIds: [4] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 10, role: 'regional_admin', subregionIds: [4] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 9, role: 'regional_admin', subregionIds: [5] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({
        id: 9,
        role: 'regional_admin',
        subregionIds: [4],
        hardAssetStaffAccess: [{ hardAssetId: 12, staffRole: 'owner' }],
    }), asset, ownerPartner), true);
    assert.equal(actorCanManageAsset(createActor({ id: 30, role: 'standard', subregionIds: [4] }), asset, ownerPartner), false);
});

test('partner staff access no longer grants hard asset edit authority', () => {
    const ownerPartner = { id: 20, role: 'partner', managerUserId: 9, subregionIds: [4] };
    const asset = {
        id: 12,
        partnerId: 20,
        subregionId: 4,
        partner: ownerPartner,
    };

    const staffEditor = createActor({
        id: 80,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            staffRole: 'editor',
            subregionIds: [4],
        }],
    });
    const staffOwner = createActor({
        id: 81,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            staffRole: 'owner',
            subregionIds: [4],
        }],
    });
    const revokedStaff = createActor({
        id: 82,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            staffRole: 'editor',
            revokedAt: '2026-05-09T00:00:00.000Z',
            subregionIds: [4],
        }],
    });
    const unrelatedStaff = createActor({
        id: 83,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 4,
            legacyPartnerUserId: 21,
            staffRole: 'editor',
            subregionIds: [4],
        }],
    });

    assert.equal(actorCanManageAsset(staffEditor, asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(staffOwner, asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(revokedStaff, asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(unrelatedStaff, asset, ownerPartner), false);
    assert.equal(asset.partnerId, 20, 'staff access must not rewrite the legacy resource owner id');
});

test('direct hard-asset owner and staff access can edit without changing legacy ownership', () => {
    const asset = {
        id: 12,
        partnerId: null,
        subregionId: 4,
    };
    const assetOwner = createActor({
        id: 80,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'owner',
            subregionId: 4,
        }],
    });
    const assetStaff = createActor({
        id: 81,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'staff',
            subregionId: 4,
        }],
    });
    const revokedStaff = createActor({
        id: 82,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'staff',
            revokedAt: '2026-05-14T00:00:00.000Z',
            subregionId: 4,
        }],
    });
    const otherAssetStaff = createActor({
        id: 83,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 13,
            staffRole: 'staff',
            subregionId: 4,
        }],
    });

    assert.equal(actorCanManageAsset(assetOwner, asset), true);
    assert.equal(actorCanManageAsset(assetStaff, asset), true);
    assert.equal(actorCanManageAsset(revokedStaff, asset), false);
    assert.equal(actorCanManageAsset(otherAssetStaff, asset), false);
    assert.equal(actorCanHideHardAsset(assetOwner, asset), true);
    assert.equal(actorCanDeleteHardAsset(assetOwner, asset), true);
    assert.equal(actorCanHideHardAsset(assetStaff, asset), false);
    assert.equal(actorCanDeleteHardAsset(assetStaff, asset), false);
    assert.equal(asset.partnerId, null, 'direct staff access must not reintroduce legacy partner ownership');
});

test('partner staff access can manage legacy partner-owned admin surfaces', () => {
    const ownerPartner = { id: 20, role: 'partner', managerUserId: 9 };
    const staffEditor = createActor({
        id: 80,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            staffRole: 'editor',
            subregionIds: [4],
        }],
    });
    const staffOwner = createActor({
        id: 81,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            staffRole: 'owner',
            subregionIds: [4],
        }],
    });
    const unrelatedStaff = createActor({
        id: 82,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 4,
            legacyPartnerUserId: 21,
            staffRole: 'editor',
            subregionIds: [4],
        }],
    });

    const partnerOwnedRecord = { id: 44, partnerId: 20, createdByUserId: 9 };
    assert.equal(actorCanManagePartnerOwnedEntity(staffEditor, partnerOwnedRecord, ownerPartner), true);
    assert.equal(actorCanManagePartnerOwnedEntity(staffOwner, partnerOwnedRecord, ownerPartner), true);
    assert.equal(actorCanManagePartnerOwnedEntity(unrelatedStaff, partnerOwnedRecord, ownerPartner), false);
    assert.equal(partnerOwnedRecord.partnerId, 20, 'staff access must not rewrite the legacy partner owner id');
});

test('partner owner assignment stays inside manager chain and subregion scope', () => {
    const partner = { id: 20, role: 'partner', managerUserId: 9, subregionIds: [4] };

    assert.equal(canAssignPartnerOwner(createActor({ id: 1, role: 'super_admin' }), partner, 4), true);
    assert.equal(canAssignPartnerOwner(createActor({ id: 1, role: 'super_admin' }), partner, 5), false);
    assert.equal(canAssignPartnerOwner(createActor({ id: 9, role: 'regional_admin', subregionIds: [4] }), partner, 4), true);
    assert.equal(canAssignPartnerOwner(createActor({ id: 9, role: 'regional_admin', subregionIds: [5] }), partner, 4), false);
    assert.equal(canAssignPartnerOwner(createActor({ id: 10, role: 'regional_admin', subregionIds: [4] }), partner, 4), false);
    assert.equal(canAssignPartnerOwner(createActor({ id: 20, role: 'partner', subregionIds: [4] }), partner, 4), true);
    assert.equal(canAssignPartnerOwner(createActor({ id: 21, role: 'partner', subregionIds: [4] }), partner, 4), false);
});

test('audience-zone management follows owner and manager boundaries', () => {
    const zone = {
        id: 4,
        partnerUserId: 20,
        createdByUserId: 9,
        ownerPartner: {
            id: 20,
            role: 'partner',
            managerUserId: 9,
        },
    };

    assert.equal(canManageAudienceZone(createActor({ id: 1, role: 'super_admin' }), zone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 20, role: 'partner' }), zone), true);
    assert.equal(canManageAudienceZone(createActor({
        id: 80,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            staffRole: 'editor',
            subregionIds: [4],
        }],
    }), zone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 21, role: 'partner' }), zone), false);
    assert.equal(canManageAudienceZone(createActor({ id: 9, role: 'regional_admin' }), zone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 10, role: 'regional_admin' }), zone), false);

    const systemZone = { ...zone, partnerUserId: null, ownerPartner: null, createdByUserId: 9 };
    assert.equal(canManageAudienceZone(createActor({ id: 9, role: 'regional_admin' }), systemZone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 10, role: 'regional_admin' }), systemZone), false);
});

test('asset audience zones are local to assigned hard assets until approved', () => {
    const zone = {
        id: 8,
        hardAssetId: 12,
        sharingStatus: 'local',
        hardAsset: {
            id: 12,
            subregionId: 4,
        },
    };
    const approvedZone = { ...zone, sharingStatus: 'approved' };
    const assetOwner = createActor({
        id: 80,
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 12, staffRole: 'owner', subregionId: 4 }],
    });
    const assetStaff = createActor({
        id: 81,
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 12, staffRole: 'staff', subregionId: 4 }],
    });
    const otherAssetStaff = createActor({
        id: 82,
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 13, staffRole: 'staff', subregionId: 4 }],
    });

    assert.equal(canManageAudienceZone(assetOwner, zone), true);
    assert.equal(canManageAudienceZone(assetStaff, zone), false);
    assert.equal(canViewAudienceZone(assetStaff, zone), true);
    assert.equal(canUseAudienceZoneForHardAssetIds(assetStaff, zone, [12]), true);
    assert.equal(canUseAudienceZoneForHardAssetIds(otherAssetStaff, zone, [13]), false);
    assert.equal(canUseAudienceZoneForHardAssetIds(otherAssetStaff, approvedZone, [13]), true);
    assert.equal(canManageAudienceZone(createActor({ id: 9, role: 'regional_admin', subregionIds: [4] }), zone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 10, role: 'regional_admin', subregionIds: [5] }), zone), false);
});

test('standard users cannot access restricted content or translation review APIs', async () => {
    const standardUser = createActor({ id: 30, role: 'standard' });

    const privateResponse = await authedFetch('/api/private-resource-content/hard/12', standardUser);
    assert.equal(privateResponse.status, 403);
    assert.match((await privateResponse.json()).error, /Restricted content is not available/);

    const translationResponse = await authedFetch('/api/resource-translations/hard/12', standardUser);
    assert.equal(translationResponse.status, 403);
    assert.match((await translationResponse.json()).error, /Insufficient permissions/);

    const adminResponse = await authedFetch('/api/admin/workbooks/places/export-filtered', standardUser, {
        method: 'POST',
        body: JSON.stringify({ ids: [1], format: 'xlsx' }),
    });
    assert.equal(adminResponse.status, 403);
    assert.match((await adminResponse.json()).error, /Requires admin privileges/);
});

test('route authorization no longer accepts legacy partner staff as resource operators', async () => {
    const route = new Hono();
    route.get('/restricted', authenticateToken, authorizeResourceOperator(), (c) => c.json({
        ok: true,
        subregionScope: c.get('subregionScope'),
        actualRole: c.get('user')?.role,
    }));

    const staffUser = createActor({
        id: 80,
        role: 'standard',
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            organizationName: 'Care Partner',
            staffRole: 'editor',
            subregionIds: [4],
        }],
    });
    const token = await createSessionToken(staffUser, { env: TEST_ENV }, {
        extraClaims: {
            partnerStaffAccess: staffUser.partnerStaffAccess,
        },
    });

    const response = await route.fetch(
        new Request('https://app.carearound.sg/restricted', {
            headers: { [SESSION_HEADER_NAME]: token },
        }),
        TEST_ENV,
    );
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /Insufficient permissions/);
});

test('resource operator authorization accepts direct hard-asset staff but not broad admin exports', async () => {
    const route = new Hono();
    route.get('/restricted', authenticateToken, authorizeResourceOperator(), (c) => c.json({
        ok: true,
        subregionScope: c.get('subregionScope'),
        actualRole: c.get('user')?.role,
    }));

    const assetStaffUser = createActor({
        id: 81,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetMembershipId: 7,
            hardAssetId: 12,
            hardAssetName: 'Care Hub',
            staffRole: 'staff',
            subregionId: 4,
        }],
    });
    const token = await createSessionToken(assetStaffUser, { env: TEST_ENV }, {
        extraClaims: {
            hardAssetStaffAccess: assetStaffUser.hardAssetStaffAccess,
        },
    });

    const response = await route.fetch(
        new Request('https://app.carearound.sg/restricted', {
            headers: { [SESSION_HEADER_NAME]: token },
        }),
        TEST_ENV,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.subregionScope, undefined);
    assert.equal(body.actualRole, 'standard');

    const adminResponse = await authedFetch('/api/admin/workbooks/places/export-filtered', assetStaffUser, {
        method: 'POST',
        body: JSON.stringify({ ids: [1], format: 'xlsx' }),
    });
    assert.equal(adminResponse.status, 403);
    assert.match((await adminResponse.json()).error, /Requires admin privileges/);
});

test('public saved/map snapshots strip private fields and translation review metadata', () => {
    const noisyAsset = {
        id: 12,
        name: 'Care Hub',
        subCategory: 'Active Ageing Centre',
        address: 'Singapore 680153',
        lat: '1.38',
        lng: '103.75',
        hours: '9am-5pm',
        logoUrl: 'https://example.test/logo.png',
        privateNotes: 'staff-only pricing notes',
        privateFiles: [{ fileName: 'Pricing.pdf', fileData: 'staff-only-file' }],
        privateResourceContent: { notes: 'staff-only service guide' },
        accessUserIds: [20, 21],
        translations: {
            'zh-CN': {
                fields: { name: '关怀中心' },
                fieldMeta: { name: { status: 'human_edited', updatedByUserId: 7 } },
                reviewedAt: new Date('2026-05-01T10:00:00Z'),
            },
        },
    };

    const savedSnapshot = buildSavedAssetSnapshot(noisyAsset);
    const myMapSnapshot = buildMyMapAssetSnapshot('hard', noisyAsset);
    const normalizedLegacySnapshot = normalizeMyMapAssetSnapshot('hard', 12, {
        version: 2,
        resourceType: 'hard',
        resourceId: 12,
        name: 'Care Hub',
        detailPath: '/resource/hard/12',
        privateNotes: 'staff-only legacy note',
        translations: noisyAsset.translations,
        places: [{
            name: 'Care Hub',
            address: 'Singapore 680153',
            lat: '1.38',
            lng: '103.75',
            privateFiles: noisyAsset.privateFiles,
        }],
    });

    assertNoSensitivePayload(savedSnapshot);
    assertNoSensitivePayload(myMapSnapshot);
    assertNoSensitivePayload(normalizedLegacySnapshot);
});
