import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeAdminRegionScopeIds,
    validateAdminRegionScopeUpdate,
} from '../src/utils/adminRegionScope.js';

function expectScopeError(fn, status, pattern) {
    assert.throws(fn, (err) => {
        assert.equal(err.status, status);
        assert.match(err.message, pattern);
        return true;
    });
}

test('admin region scope ids are explicit positive ids and keep selected order', () => {
    assert.deepEqual(normalizeAdminRegionScopeIds(['3', 2, '3', '7']), [3, 2, 7]);
    expectScopeError(
        () => normalizeAdminRegionScopeIds(['3', 'not-a-region']),
        400,
        /valid region ids/i,
    );
});

test('region scope can only be changed by Super Admin for Admin accounts', () => {
    const targetAdmin = { id: 9, role: 'regional_admin' };

    expectScopeError(
        () => validateAdminRegionScopeUpdate({
            actor: { id: 4, role: 'regional_admin' },
            targetUser: targetAdmin,
            subregionIds: [10],
            managedUsers: [],
        }),
        403,
        /Only Super Admins can manage Admin region scope/i,
    );

    expectScopeError(
        () => validateAdminRegionScopeUpdate({
            actor: { id: 1, role: 'super_admin' },
            targetUser: { id: 20, role: 'standard' },
            subregionIds: [10],
            managedUsers: [],
        }),
        400,
        /Region scope can only be assigned to Admin accounts/i,
    );
});

test('region scope removal is blocked when directly managed users would be outside scope', () => {
    expectScopeError(
        () => validateAdminRegionScopeUpdate({
            actor: { id: 1, role: 'super_admin' },
            targetUser: { id: 9, role: 'regional_admin' },
            subregionIds: [10],
            managedUsers: [
                { id: 20, name: 'Inside User', role: 'standard', managerUserId: 9, derivedSubregionId: 10 },
                { id: 21, name: 'Outside User', role: 'standard', managerUserId: 9, derivedSubregionId: 30 },
            ],
        }),
        400,
        /Move or reassign users outside this Admin's new region scope before saving/i,
    );
});

test('admin region scope can be empty when no directly managed user would be stranded', () => {
    const result = validateAdminRegionScopeUpdate({
        actor: { id: 1, role: 'super_admin' },
        targetUser: { id: 9, role: 'regional_admin' },
        subregionIds: [],
        managedUsers: [
            { id: 21, name: 'No Postal User', role: 'standard', managerUserId: 9, derivedSubregionId: null },
        ],
    });

    assert.deepEqual(result, { subregionIds: [], strandedManagedUsers: [] });
});
