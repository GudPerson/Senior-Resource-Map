import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSoftAssetStaffAccessPayload,
    canAssignSoftAssetStaffRole,
    canRevokeSoftAssetStaffMembership,
    hasSoftAssetStaffAccess,
} from '../src/utils/softAssetAccess.js';
import { shouldGrantCreatorDefaultSoftAssetOwner } from '../src/utils/assetCreatorOwnership.js';

function actor(overrides = {}) {
    return {
        id: 1,
        role: 'standard',
        softAssetStaffAccess: [],
        ...overrides,
    };
}

test('soft asset staff payload stays compact and skips revoked memberships', () => {
    const payload = buildSoftAssetStaffAccessPayload([
        {
            softAssetMembershipId: 3,
            softAssetId: 50,
            softAssetName: 'Home Nursing',
            staffRole: 'owner',
        },
        {
            softAssetMembershipId: 4,
            softAssetId: 51,
            softAssetName: 'Old Service',
            staffRole: 'staff',
            revokedAt: '2026-05-15T00:00:00.000Z',
        },
    ]);

    assert.deepEqual(payload, [{
        softAssetMembershipId: 3,
        softAssetId: 50,
        softAssetName: 'Home Nursing',
        staffRole: 'owner',
    }]);
});

test('super admin can assign first standalone soft asset owner', () => {
    assert.equal(canAssignSoftAssetStaffRole(actor({ role: 'super_admin' }), { id: 50, activeOwnerCount: 0 }, 'owner'), true);
});

test('region admin creator default owner applies only to standalone offerings', () => {
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'regional_admin' },
        { linkedHardAssetIds: [], hostHardAssetId: null },
    ), true);
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'regional_admin' },
        { linkedHardAssetIds: [10], hostHardAssetId: null },
    ), false);
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'regional_admin' },
        { linkedHardAssetIds: [], hostHardAssetId: 10 },
    ), false);
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'super_admin' },
        { linkedHardAssetIds: [], hostHardAssetId: null },
    ), false);
});

test('existing standalone soft asset owner can add owners and staff', () => {
    const owner = actor({
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'owner' }],
    });

    assert.equal(canAssignSoftAssetStaffRole(owner, { id: 50, activeOwnerCount: 1 }, 'owner'), true);
    assert.equal(canAssignSoftAssetStaffRole(owner, { id: 50, activeOwnerCount: 1 }, 'staff'), true);
});

test('standalone soft asset staff cannot manage access', () => {
    const staff = actor({
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'staff' }],
    });

    assert.equal(canAssignSoftAssetStaffRole(staff, { id: 50, activeOwnerCount: 1 }, 'staff'), false);
});

test('standalone soft asset cannot lose final owner', () => {
    const owner = actor({
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'owner' }],
    });

    assert.equal(canRevokeSoftAssetStaffMembership(owner, { id: 50, activeOwnerCount: 1 }, { staffRole: 'owner' }), false);
    assert.equal(canRevokeSoftAssetStaffMembership(owner, { id: 50, activeOwnerCount: 2 }, { staffRole: 'owner' }), true);
});

test('hasSoftAssetStaffAccess accepts owner and staff roles only', () => {
    const user = actor({
        softAssetStaffAccess: [
            { softAssetId: 50, staffRole: 'owner' },
            { softAssetId: 51, staffRole: 'editor' },
        ],
    });

    assert.equal(hasSoftAssetStaffAccess(user, 50), true);
    assert.equal(hasSoftAssetStaffAccess(user, 51), false);
});
