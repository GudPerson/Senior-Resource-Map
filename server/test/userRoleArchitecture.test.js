import test from 'node:test';
import assert from 'node:assert/strict';

import { getCreatableRoles, getManageableRoles } from '../src/utils/roles.js';
import { canRoleOwnUser, getDirectManagerRole, getOwnershipStatus } from '../src/utils/ownership.js';

test('partner login role is no longer offered for new assignment flows', () => {
    assert.deepEqual(getCreatableRoles('super_admin'), ['standard', 'regional_admin', 'super_admin']);
    assert.deepEqual(getCreatableRoles('regional_admin'), ['standard']);
    assert.deepEqual(getCreatableRoles('partner'), []);

    assert.deepEqual(getManageableRoles('super_admin'), ['standard', 'regional_admin', 'super_admin']);
    assert.deepEqual(getManageableRoles('regional_admin'), ['standard']);
});

test('standard user ownership now hangs from Region Admins instead of legacy login accounts', () => {
    assert.equal(getDirectManagerRole('standard'), 'regional_admin');
    assert.equal(canRoleOwnUser('regional_admin', 'standard'), true);
    assert.equal(canRoleOwnUser('partner', 'standard'), false);
    assert.equal(getOwnershipStatus({
        role: 'standard',
        managerUserId: 9,
        managerRole: 'regional_admin',
    }), 'assigned');
});
