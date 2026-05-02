import assert from 'node:assert/strict';
import test from 'node:test';

import app from '../src/app.js';
import { canManageAudienceZone } from '../src/utils/audienceZones.js';
import { buildMyMapAssetSnapshot, normalizeMyMapAssetSnapshot } from '../src/utils/myMapDirectory.js';
import { actorCanManageAsset, canAssignPartnerOwner } from '../src/utils/ownership.js';
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

test('asset ownership rules block unrelated partners and out-of-scope regional admins', () => {
    const ownerPartner = { id: 20, role: 'partner', managerUserId: 9, subregionIds: [4] };
    const asset = {
        id: 12,
        partnerId: 20,
        subregionId: 4,
        partner: ownerPartner,
    };

    assert.equal(actorCanManageAsset(createActor({ id: 1, role: 'super_admin' }), asset, ownerPartner), true);
    assert.equal(actorCanManageAsset(createActor({ id: 20, role: 'partner', subregionIds: [4] }), asset, ownerPartner), true);
    assert.equal(actorCanManageAsset(createActor({ id: 21, role: 'partner', subregionIds: [4] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 9, role: 'regional_admin', subregionIds: [4] }), asset, ownerPartner), true);
    assert.equal(actorCanManageAsset(createActor({ id: 10, role: 'regional_admin', subregionIds: [4] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 9, role: 'regional_admin', subregionIds: [5] }), asset, ownerPartner), false);
    assert.equal(actorCanManageAsset(createActor({ id: 30, role: 'standard', subregionIds: [4] }), asset, ownerPartner), false);
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
    assert.equal(canManageAudienceZone(createActor({ id: 21, role: 'partner' }), zone), false);
    assert.equal(canManageAudienceZone(createActor({ id: 9, role: 'regional_admin' }), zone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 10, role: 'regional_admin' }), zone), false);

    const systemZone = { ...zone, partnerUserId: null, ownerPartner: null, createdByUserId: 9 };
    assert.equal(canManageAudienceZone(createActor({ id: 9, role: 'regional_admin' }), systemZone), true);
    assert.equal(canManageAudienceZone(createActor({ id: 10, role: 'regional_admin' }), systemZone), false);
});

test('standard users cannot access partner-only or translation review APIs', async () => {
    const standardUser = createActor({ id: 30, role: 'standard' });

    const privateResponse = await authedFetch('/api/private-resource-content/hard/12', standardUser);
    assert.equal(privateResponse.status, 403);
    assert.match((await privateResponse.json()).error, /Partner-only content is not available/);

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
