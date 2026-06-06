import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHardAssetStaffAccessPayload,
    canAssignHardAssetStaffRole,
    canRevokeHardAssetStaffMembership,
    getActiveHardAssetStaffAccess,
    hasHardAssetStaffAccess,
} from '../src/utils/hardAssetStaff.js';
import { shouldGrantCreatorDefaultHardAssetOwner } from '../src/utils/assetCreatorOwnership.js';

function actor(overrides = {}) {
    return {
        id: 1,
        role: 'standard',
        subregionIds: [],
        ...overrides,
    };
}

const asset = {
    id: 12,
    subregionId: 4,
    activeOwnerCount: 1,
};

test('hard asset staff payload stays compact and skips revoked memberships', () => {
    const payload = buildHardAssetStaffAccessPayload([
        {
            hardAssetMembershipId: 3,
            hardAssetId: 12,
            hardAssetName: 'Sunshine AAC',
            staffRole: 'owner',
            subregionId: 4,
        },
        {
            hardAssetMembershipId: 4,
            hardAssetId: 13,
            hardAssetName: 'Old AAC',
            staffRole: 'staff',
            revokedAt: '2026-05-14T00:00:00.000Z',
            subregionId: 4,
        },
    ]);

    assert.deepEqual(payload, [{
        hardAssetMembershipId: 3,
        hardAssetId: 12,
        hardAssetName: 'Sunshine AAC',
        staffRole: 'owner',
        subregionId: 4,
    }]);
});

test('hard asset staff access helpers accept owner and staff roles only', () => {
    const user = actor({
        hardAssetStaffAccess: [
            {
                hardAssetId: 12,
                staffRole: 'owner',
                subregionId: 4,
            },
            {
                hardAssetId: 13,
                staffRole: 'editor',
                subregionId: 4,
            },
            {
                hardAssetId: 14,
                staffRole: 'staff',
                revokedAt: '2026-05-14T00:00:00.000Z',
                subregionId: 4,
            },
        ],
    });

    assert.equal(hasHardAssetStaffAccess(user, 12), true);
    assert.equal(hasHardAssetStaffAccess(user, 12, ['staff']), false);
    assert.equal(hasHardAssetStaffAccess(user, 13), false);
    assert.equal(hasHardAssetStaffAccess(user, 14), false);
    assert.deepEqual(getActiveHardAssetStaffAccess(user).map((entry) => entry.hardAssetId), [12]);
});

test('super admin can assign the first hard asset owner', () => {
    assert.equal(canAssignHardAssetStaffRole(actor({ role: 'super_admin' }), { id: 12, activeOwnerCount: 0 }, 'owner'), true);
    assert.equal(canAssignHardAssetStaffRole(actor({ role: 'super_admin' }), { id: 12, activeOwnerCount: 0 }, 'staff'), true);
});

test('region admins do not receive edit authority from region scope alone', () => {
    const regionAdmin = actor({ id: 9, role: 'regional_admin', subregionIds: [4] });

    assert.equal(canAssignHardAssetStaffRole(regionAdmin, asset, 'owner'), false);
    assert.equal(canAssignHardAssetStaffRole(regionAdmin, asset, 'staff'), false);
    assert.equal(canRevokeHardAssetStaffMembership(regionAdmin, asset, { staffRole: 'staff' }), false);
});

test('governance group roles do not grant place access management', () => {
    const orgGroupAdmin = actor({
        id: 92,
        governanceGroupMemberships: [{
            groupId: 4,
            groupRole: 'admin',
            groupType: 'org',
        }],
    });
    const regionGroupAdmin = actor({
        id: 93,
        governanceGroupMemberships: [{
            groupId: 5,
            groupRole: 'admin',
            groupType: 'region',
        }],
    });

    assert.equal(hasHardAssetStaffAccess(orgGroupAdmin, 12), false);
    assert.equal(canAssignHardAssetStaffRole(orgGroupAdmin, asset, 'staff'), false);
    assert.equal(canRevokeHardAssetStaffMembership(orgGroupAdmin, asset, { staffRole: 'staff' }), false);
    assert.equal(hasHardAssetStaffAccess(regionGroupAdmin, 12), false);
    assert.equal(canAssignHardAssetStaffRole(regionGroupAdmin, asset, 'owner'), false);
    assert.equal(canRevokeHardAssetStaffMembership(regionGroupAdmin, asset, { staffRole: 'owner' }), false);
});

test('region admin creator default owner applies to new places', () => {
    assert.equal(shouldGrantCreatorDefaultHardAssetOwner({ role: 'regional_admin' }), true);
    assert.equal(shouldGrantCreatorDefaultHardAssetOwner({ role: 'super_admin' }), false);
    assert.equal(shouldGrantCreatorDefaultHardAssetOwner({ role: 'standard' }), false);
});

test('asset owners can manage owners and staff after the first owner exists', () => {
    const owner = actor({
        id: 80,
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'owner',
            subregionId: 4,
        }],
    });
    const staff = actor({
        id: 81,
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'staff',
            subregionId: 4,
        }],
    });

    assert.equal(canAssignHardAssetStaffRole(owner, asset, 'staff'), true);
    assert.equal(canAssignHardAssetStaffRole(owner, asset, 'owner'), true);
    assert.equal(canAssignHardAssetStaffRole(staff, asset, 'staff'), false);
    assert.equal(canRevokeHardAssetStaffMembership(owner, asset, { staffRole: 'staff' }), true);
    assert.equal(canRevokeHardAssetStaffMembership(owner, { ...asset, activeOwnerCount: 2 }, { staffRole: 'owner' }), true);
    assert.equal(canRevokeHardAssetStaffMembership(owner, asset, { staffRole: 'owner' }), false);
    assert.equal(canRevokeHardAssetStaffMembership(staff, asset, { staffRole: 'staff' }), false);
});
