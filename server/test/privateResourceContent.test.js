import test from 'node:test';
import assert from 'node:assert/strict';

import { privateResourceContentFiles } from '../src/db/schema.js';
import {
    canManagePrivateResource,
    canViewPrivateResource,
    decodePrivateFileData,
    insertPrivateFile,
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
    ), true);
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
