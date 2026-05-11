import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canAdminManagePartnerOrganization,
    formatPartnerStaffMember,
    handoverPartnerOrganizationOwnerMemberships,
    isMissingPartnerOrganizationBridgeTableError,
    normalizeStaffRoleInput,
    partnerStaffMembershipCanChangeRole,
    partnerStaffMembershipCanRevoke,
} from '../src/utils/partnerOrganizations.js';

const organization = {
    id: 3,
    legacyPartnerUserId: 20,
    legacyPartnerManagerUserId: 9,
    legacyPartnerSubregionIds: [4],
};

function normalizeSql(value) {
    const text = Array.isArray(value?.queryChunks)
        ? value.queryChunks.map((chunk) => (
            Array.isArray(chunk?.value) ? chunk.value.join('') : String(chunk || '')
        )).join('')
        : String(value || '');
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

test('partner organisation staff management is admin-assisted and scoped', () => {
    assert.equal(canAdminManagePartnerOrganization({ id: 1, role: 'super_admin' }, organization), true);
    assert.equal(canAdminManagePartnerOrganization({ id: 9, role: 'regional_admin', subregionIds: [4] }, organization), true);
    assert.equal(canAdminManagePartnerOrganization({ id: 9, role: 'regional_admin', subregionIds: [5] }, organization), false);
    assert.equal(canAdminManagePartnerOrganization({ id: 10, role: 'regional_admin', subregionIds: [4] }, organization), false);
    assert.equal(canAdminManagePartnerOrganization({ id: 20, role: 'partner', subregionIds: [4] }, organization), false);
    assert.equal(canAdminManagePartnerOrganization({ id: 80, role: 'standard', partnerStaffAccess: [{ legacyPartnerUserId: 20, staffRole: 'owner' }] }, organization), false);
});

test('staff role input stays limited to owner and editor', () => {
    assert.equal(normalizeStaffRoleInput('Owner'), 'owner');
    assert.equal(normalizeStaffRoleInput(' editor '), 'editor');
    assert.throws(() => normalizeStaffRoleInput('admin'), /Owner or Editor/);
});

test('owner membership changes require the handover flow', () => {
    assert.deepEqual(partnerStaffMembershipCanChangeRole({ staffRole: 'editor' }, 'editor'), { ok: true });
    assert.deepEqual(partnerStaffMembershipCanChangeRole({ staffRole: 'editor' }, 'owner'), {
        ok: false,
        message: 'Use owner handover to make someone the Owner.',
    });
    assert.deepEqual(partnerStaffMembershipCanChangeRole({ staffRole: 'owner' }, 'editor'), {
        ok: false,
        message: 'Use owner handover before changing the current Owner.',
    });
});

test('owner membership cannot be revoked directly', () => {
    assert.deepEqual(partnerStaffMembershipCanRevoke({ staffRole: 'editor' }), { ok: true });
    assert.deepEqual(partnerStaffMembershipCanRevoke({ staffRole: 'owner' }), {
        ok: false,
        message: 'Use owner handover before removing the current Owner.',
    });
});

test('owner handover uses ordered mutations to avoid active-owner unique conflicts', async () => {
    const statements = [];
    const fakeDb = {
        async execute(statement) {
            statements.push(normalizeSql(statement));
        },
    };

    await handoverPartnerOrganizationOwnerMemberships(fakeDb, {
        organizationId: 3,
        targetUserId: 80,
        actorUserId: 1,
    });

    assert.equal(statements.length, 3);
    assert.match(statements[0], /update partner_staff_memberships/);
    assert.match(statements[0], /revoked_at = now\(\)/);
    assert.match(statements[0], /staff_role = 'owner'/);
    assert.match(statements[0], /user_id <>/);
    assert.match(statements[1], /update partner_staff_memberships/);
    assert.match(statements[1], /set staff_role = 'owner'/);
    assert.match(statements[1], /user_id =/);
    assert.match(statements[2], /insert into partner_staff_memberships/);
    assert.match(statements[2], /where not exists/);
    assert.doesNotMatch(statements.join('\n'), /with revoked_old_owner/);
});

test('partner staff response hides password data and keeps account details readable', () => {
    assert.deepEqual(formatPartnerStaffMember({
        id: 11,
        organizationId: 3,
        userId: 80,
        staffRole: 'editor',
        createdAt: 'created',
        updatedAt: 'updated',
        userName: 'Staff User',
        username: 'staff-user',
        email: 'staff@example.test',
        userRole: 'standard',
    }), {
        id: 11,
        organizationId: 3,
        userId: 80,
        staffRole: 'editor',
        createdAt: 'created',
        updatedAt: 'updated',
        user: {
            id: 80,
            name: 'Staff User',
            username: 'staff-user',
            email: 'staff@example.test',
            role: 'standard',
        },
    });
});

test('partner organisation bridge detects only missing bridge tables as setup-not-ready', () => {
    const missingOrganizationTable = new Error('relation "partner_organizations" does not exist');
    missingOrganizationTable.code = '42P01';
    const missingMembershipTable = new Error('relation "partner_staff_memberships" does not exist');
    missingMembershipTable.code = '42P01';
    const missingUnrelatedTable = new Error('relation "users" does not exist');
    missingUnrelatedTable.code = '42P01';

    assert.equal(isMissingPartnerOrganizationBridgeTableError(missingOrganizationTable), true);
    assert.equal(isMissingPartnerOrganizationBridgeTableError(missingMembershipTable), true);
    assert.equal(isMissingPartnerOrganizationBridgeTableError(missingUnrelatedTable), false);
    assert.equal(isMissingPartnerOrganizationBridgeTableError(new Error('connection unavailable')), false);
});
