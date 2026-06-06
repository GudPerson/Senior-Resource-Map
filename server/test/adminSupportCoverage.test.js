import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildUserSupportCoverage,
    canViewUserThroughSupportCoverage,
} from '../src/utils/adminSupportCoverage.js';

const adminUsers = [
    {
        id: 9,
        name: 'North Admin',
        username: 'north-admin',
        role: 'regional_admin',
        subregionIds: [10, 11],
    },
    {
        id: 12,
        name: 'Overlap Admin',
        username: 'overlap-admin',
        role: 'regional_admin',
        subregionIds: [11],
    },
    {
        id: 99,
        name: 'Standard Account',
        username: 'standard-account',
        role: 'standard',
        subregionIds: [11],
    },
];

test('support coverage includes every Admin whose Region Scope overlaps a standard user profile region', () => {
    const coverage = buildUserSupportCoverage({
        id: 20,
        role: 'standard',
        postalCode: '650218',
        derivedSubregionId: 11,
    }, adminUsers);

    assert.equal(coverage.status, 'covered');
    assert.equal(coverage.adminCount, 2);
    assert.deepEqual(coverage.admins.map((admin) => admin.id), [9, 12]);
    assert.equal(coverage.label, 'Covered by 2 Admins');
});

test('standard users without a postal-derived profile region stay Super Admin-only', () => {
    const coverage = buildUserSupportCoverage({
        id: 21,
        role: 'standard',
        postalCode: '',
        derivedSubregionId: null,
    }, adminUsers);

    assert.equal(coverage.status, 'missing_postal');
    assert.equal(coverage.adminCount, 0);
    assert.equal(coverage.label, 'Needs postal code');
    assert.match(coverage.detail, /Super Admin/i);
});

test('standard users with an unresolved profile region stay Super Admin-only for location review', () => {
    const coverage = buildUserSupportCoverage({
        id: 22,
        role: 'standard',
        postalCode: '999999',
        derivedSubregionId: null,
        subregionIds: [],
    }, adminUsers);

    assert.equal(coverage.status, 'missing_location');
    assert.equal(coverage.adminCount, 0);
    assert.equal(coverage.label, 'Needs location review');
    assert.match(coverage.detail, /Super Admin/i);
});

test('Admin visibility can use support coverage without creating user ownership', () => {
    const admin = adminUsers[0];

    assert.equal(canViewUserThroughSupportCoverage(admin, {
        id: 20,
        role: 'standard',
        postalCode: '650218',
        derivedSubregionId: 11,
        managerUserId: null,
    }), true);

    assert.equal(canViewUserThroughSupportCoverage(admin, {
        id: 21,
        role: 'standard',
        postalCode: '',
        derivedSubregionId: null,
        managerUserId: null,
    }), false);

    assert.equal(canViewUserThroughSupportCoverage(admin, {
        id: 22,
        role: 'standard',
        postalCode: '238859',
        derivedSubregionId: 30,
        managerUserId: null,
    }), false);
}
);
