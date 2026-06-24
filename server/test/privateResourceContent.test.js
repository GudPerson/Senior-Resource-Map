import test from 'node:test';
import assert from 'node:assert/strict';

import { privateResourceContentFiles } from '../src/db/schema.js';
import {
    canManagePrivateResource,
    canViewPrivateResource,
    decodePrivateFileData,
    insertPrivateFile,
    loadPrivateAccessCandidates,
    validatePrivateFile,
} from '../src/utils/privateResourceContent.js';
import { buildMyMapAssetSnapshot } from '../src/utils/myMapDirectory.js';
import { buildSavedAssetSnapshot } from '../src/utils/savedAssets.js';

function createResource(overrides = {}) {
    return {
        id: 12,
        resourceType: 'hard',
        partnerId: 20,
        subregionId: 4,
        isDeleted: false,
        partner: {
            id: 20,
            role: 'partner',
            managerUserId: 9,
        },
        ...overrides,
    };
}

function createPrivateAccessCandidateDb(rows) {
    const builder = {
        from() {
            return builder;
        },
        leftJoin() {
            return builder;
        },
        then(resolve, reject) {
            return Promise.resolve(rows).then(resolve, reject);
        },
    };

    return {
        query: {
            users: {
                findMany: async () => {
                    throw new Error('ambiguous relation path should not be used');
                },
            },
        },
        select: () => builder,
    };
}

test('restricted content view requires direct asset access, Super Admin, or explicit viewer grants', () => {
    const resource = createResource();

    assert.equal(canViewPrivateResource({ role: 'guest' }, resource, []), false);
    assert.equal(canViewPrivateResource({ id: 30, role: 'standard' }, resource, []), false);
    assert.equal(canViewPrivateResource({ id: 31, role: 'partner', subregionIds: [4] }, resource, []), false);

    assert.equal(canViewPrivateResource({ id: 20, role: 'partner', subregionIds: [4] }, resource, []), false);
    assert.equal(canManagePrivateResource({ id: 20, role: 'partner', subregionIds: [4] }, resource), false);

    assert.equal(canViewPrivateResource({ id: 9, role: 'regional_admin', subregionIds: [4] }, resource, []), false);
    assert.equal(canManagePrivateResource({ id: 9, role: 'regional_admin', subregionIds: [4] }, resource), false);

    assert.equal(canViewPrivateResource({ id: 1, role: 'super_admin' }, resource, []), true);
    assert.equal(canManagePrivateResource({ id: 1, role: 'super_admin' }, resource), true);

    assert.equal(canViewPrivateResource(
        { id: 31, role: 'partner', subregionIds: [4] },
        resource,
        [{ userId: 31 }],
    ), false);
    assert.equal(canManagePrivateResource({ id: 31, role: 'partner', subregionIds: [4] }, resource), false);
});

test('restricted content view accepts direct hard-asset owner and staff access', () => {
    const resource = createResource({
        partnerId: null,
        partner: null,
    });
    const assetOwner = {
        id: 80,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'owner',
            subregionId: 4,
        }],
    };
    const assetStaff = {
        id: 81,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'staff',
            subregionId: 4,
        }],
    };
    const unrelatedStaff = {
        id: 82,
        role: 'standard',
        hardAssetStaffAccess: [{
            hardAssetId: 13,
            staffRole: 'staff',
            subregionId: 4,
        }],
    };

    assert.equal(canViewPrivateResource(assetOwner, resource, []), true);
    assert.equal(canManagePrivateResource(assetOwner, resource), true);
    assert.equal(canViewPrivateResource(assetStaff, resource, []), true);
    assert.equal(canManagePrivateResource(assetStaff, resource), true);
    assert.equal(canViewPrivateResource(unrelatedStaff, resource, []), false);
    assert.equal(canManagePrivateResource(unrelatedStaff, resource), false);
});

test('governance group roles do not grant restricted content access', () => {
    const resource = createResource({
        partnerId: null,
        partner: null,
    });
    const orgGroupAdmin = {
        id: 92,
        role: 'standard',
        governanceGroupMemberships: [{
            groupId: 4,
            groupRole: 'admin',
            groupType: 'org',
        }],
    };
    const regionGroupAdmin = {
        id: 93,
        role: 'standard',
        governanceGroupMemberships: [{
            groupId: 5,
            groupRole: 'admin',
            groupType: 'region',
        }],
    };

    assert.equal(canViewPrivateResource(orgGroupAdmin, resource, []), false);
    assert.equal(canManagePrivateResource(orgGroupAdmin, resource), false);
    assert.equal(canViewPrivateResource(regionGroupAdmin, resource, [{ userId: 93 }]), false);
    assert.equal(canManagePrivateResource(regionGroupAdmin, resource), false);
});

test('restricted content view accepts direct standalone soft-asset owner and staff access', () => {
    const resource = {
        id: 90,
        resourceType: 'soft',
        assetMode: 'standalone',
        partnerId: null,
        partner: null,
    };
    const softAssetOwner = {
        id: 84,
        role: 'standard',
        softAssetStaffAccess: [{
            softAssetId: 90,
            staffRole: 'owner',
        }],
    };
    const softAssetStaff = {
        id: 85,
        role: 'standard',
        softAssetStaffAccess: [{
            softAssetId: 90,
            staffRole: 'staff',
        }],
    };
    const unrelatedStaff = {
        id: 86,
        role: 'standard',
        softAssetStaffAccess: [{
            softAssetId: 91,
            staffRole: 'staff',
        }],
    };

    assert.equal(canViewPrivateResource(softAssetOwner, resource, []), true);
    assert.equal(canManagePrivateResource(softAssetOwner, resource), true);
    assert.equal(canViewPrivateResource(softAssetStaff, resource, []), true);
    assert.equal(canManagePrivateResource(softAssetStaff, resource), true);
    assert.equal(canViewPrivateResource(unrelatedStaff, resource, []), false);
    assert.equal(canManagePrivateResource(unrelatedStaff, resource), false);
});

test('restricted content view accepts direct Group owner and staff access only', () => {
    const resource = {
        id: 203,
        resourceType: 'soft',
        assetMode: 'group',
        partnerId: null,
        partner: null,
    };
    const groupOwner = {
        id: 94,
        role: 'standard',
        softAssetStaffAccess: [{
            softAssetId: 203,
            staffRole: 'owner',
        }],
    };
    const groupStaff = {
        id: 95,
        role: 'standard',
        softAssetStaffAccess: [{
            softAssetId: 203,
            staffRole: 'staff',
        }],
    };
    const unrelatedSoftStaff = {
        id: 96,
        role: 'standard',
        softAssetStaffAccess: [{
            softAssetId: 204,
            staffRole: 'owner',
        }],
    };
    const regionGroupAdmin = {
        id: 97,
        role: 'standard',
        governanceGroupMemberships: [{
            groupId: 5,
            groupRole: 'admin',
            groupType: 'region',
        }],
    };

    assert.equal(canViewPrivateResource(groupOwner, resource, []), true);
    assert.equal(canManagePrivateResource(groupOwner, resource), true);
    assert.equal(canViewPrivateResource(groupStaff, resource, []), true);
    assert.equal(canManagePrivateResource(groupStaff, resource), true);
    assert.equal(canViewPrivateResource(unrelatedSoftStaff, resource, []), false);
    assert.equal(canManagePrivateResource(unrelatedSoftStaff, resource), false);
    assert.equal(canViewPrivateResource(regionGroupAdmin, resource, [{ userId: 97 }]), false);
    assert.equal(canManagePrivateResource(regionGroupAdmin, resource), false);
});

test('restricted viewer grants require an active admin or operator status', () => {
    const resource = createResource({
        partnerId: null,
        partner: null,
    });

    assert.equal(canViewPrivateResource(
        { id: 31, role: 'regional_admin', subregionIds: [4] },
        resource,
        [{ userId: 31 }],
    ), true);
    assert.equal(canViewPrivateResource(
        {
            id: 82,
            role: 'standard',
            hardAssetStaffAccess: [{
                hardAssetId: 13,
                staffRole: 'staff',
                subregionId: 7,
            }],
        },
        resource,
        [{ userId: 82 }],
    ), true);
    assert.equal(canViewPrivateResource(
        {
            id: 86,
            role: 'standard',
            softAssetStaffAccess: [{
                softAssetId: 91,
                staffRole: 'owner',
            }],
        },
        resource,
        [{ userId: 86 }],
    ), true);
    assert.equal(canViewPrivateResource(
        { id: 90, role: 'standard' },
        resource,
        [{ userId: 90 }],
    ), false);
    assert.equal(canViewPrivateResource(
        {
            id: 91,
            role: 'standard',
            hardAssetStaffAccess: [{
                hardAssetId: 13,
                staffRole: 'staff',
                revokedAt: '2026-05-20T00:00:00.000Z',
            }],
        },
        resource,
        [{ userId: 91 }],
    ), false);
});

test('restricted access candidates include admins and unrelated active operators only', async () => {
    const resource = createResource({
        partnerId: null,
        partner: null,
    });
    const db = createPrivateAccessCandidateDb([
        {
            id: 31,
            username: 'region-admin',
            name: 'Admin',
            role: 'regional_admin',
            managerUserId: null,
            subregionId: 4,
            hardAssetId: null,
            hardStaffRole: null,
            hardRevokedAt: null,
            softAssetId: null,
            softStaffRole: null,
            softRevokedAt: null,
        },
        {
            id: 32,
            username: 'other-region-admin',
            name: 'Another Admin',
            role: 'regional_admin',
            managerUserId: null,
            subregionId: 99,
            hardAssetId: null,
            hardStaffRole: null,
            hardRevokedAt: null,
            softAssetId: null,
            softStaffRole: null,
            softRevokedAt: null,
        },
        {
            id: 82,
            username: 'other-place-staff',
            name: 'Other Place Staff',
            role: 'standard',
            managerUserId: null,
            subregionId: null,
            hardAssetId: 13,
            hardStaffRole: 'staff',
            hardRevokedAt: null,
            softAssetId: null,
            softStaffRole: null,
            softRevokedAt: null,
        },
        {
            id: 83,
            username: 'same-place-staff',
            name: 'Same Place Staff',
            role: 'standard',
            managerUserId: null,
            subregionId: null,
            hardAssetId: 12,
            hardStaffRole: 'staff',
            hardRevokedAt: null,
            softAssetId: null,
            softStaffRole: null,
            softRevokedAt: null,
        },
        {
            id: 84,
            username: 'revoked-staff',
            name: 'Revoked Staff',
            role: 'standard',
            managerUserId: null,
            subregionId: null,
            hardAssetId: 13,
            hardStaffRole: 'staff',
            hardRevokedAt: '2026-05-20T00:00:00.000Z',
            softAssetId: null,
            softStaffRole: null,
            softRevokedAt: null,
        },
        {
            id: 90,
            username: 'normal-user',
            name: 'Normal User',
            role: 'standard',
            managerUserId: null,
            subregionId: 4,
            hardAssetId: null,
            hardStaffRole: null,
            hardRevokedAt: null,
            softAssetId: null,
            softStaffRole: null,
            softRevokedAt: null,
        },
    ]);

    const candidates = await loadPrivateAccessCandidates(db, resource);

    assert.deepEqual(
        candidates.map((candidate) => candidate.id).sort((left, right) => left - right),
        [31, 32, 82],
    );
});

test('restricted file validation rejects unsupported files and oversized files', () => {
    assert.equal(validatePrivateFile({ name: 'guide.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1200 }).ok, false);
    assert.equal(validatePrivateFile({ name: 'large.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }).ok, false);
    assert.deepEqual(
        validatePrivateFile({ name: 'pricing.pdf', type: 'application/pdf', size: 1024 }),
        { ok: true, mimeType: 'application/pdf', fileName: 'pricing.pdf', size: 1024 },
    );
    assert.equal(validatePrivateFile({ name: 'scan.heic', type: '', size: 2048 }).mimeType, 'image/heic');
});

test('restricted file insert stores protected base64 data without public URLs', async () => {
    const sourceBytes = new TextEncoder().encode('private checklist');
    let capturedValues = null;
    const db = {
        insert(table) {
            assert.equal(table, privateResourceContentFiles);
            return {
                values(values) {
                    capturedValues = values;
                    return {
                        returning: async () => [{ id: 44, ...values }],
                    };
                },
            };
        },
    };

    const created = await insertPrivateFile(db, 7, {
        name: 'Checklist.pdf',
        type: 'application/pdf',
        size: sourceBytes.byteLength,
        arrayBuffer: async () => sourceBytes.buffer,
    }, { id: 20 });

    assert.equal(created.id, 44);
    assert.equal(capturedValues.fileName, 'Checklist.pdf');
    assert.equal(capturedValues.mimeType, 'application/pdf');
    assert.equal(capturedValues.uploadedByUserId, 20);
    assert.equal(Object.hasOwn(capturedValues, 'secureUrl'), false);
    assert.equal(Object.hasOwn(capturedValues, 'url'), false);
    assert.deepEqual(decodePrivateFileData(capturedValues.fileData), sourceBytes);
});

test('saved asset and my map snapshots do not include restricted fields', () => {
    const asset = {
        id: 12,
        name: 'Test Centre',
        subCategory: 'AAC',
        address: 'Singapore 680123',
        lat: '1.23',
        lng: '103.45',
        hours: '9am-5pm',
        logoUrl: 'https://example.test/logo.png',
        privateNotes: 'Do not expose',
        privateFiles: [{ fileName: 'Pricing.pdf' }],
        privateResourceContent: { notes: 'Do not expose' },
    };

    const savedSnapshot = buildSavedAssetSnapshot({
        name: asset.name,
        subCategory: asset.subCategory,
        address: asset.address,
        lat: asset.lat,
        lng: asset.lng,
        detailPath: '/resource/hard/12',
        privateNotes: asset.privateNotes,
    });
    const mapSnapshot = buildMyMapAssetSnapshot('hard', asset);

    assert.equal(Object.hasOwn(savedSnapshot, 'privateNotes'), false);
    assert.equal(Object.hasOwn(savedSnapshot, 'privateFiles'), false);
    assert.equal(Object.hasOwn(mapSnapshot, 'privateNotes'), false);
    assert.equal(Object.hasOwn(mapSnapshot, 'privateFiles'), false);
    assert.equal(Object.hasOwn(mapSnapshot, 'privateResourceContent'), false);
});
