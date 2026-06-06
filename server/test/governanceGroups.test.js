import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canCreateGovernanceGroup,
    canManageGovernanceGroup,
    canManageGovernanceGroupMemberRole,
    governanceGroupRolesGrantResourceEditRights,
    governanceGroupRolesGrantRestrictedContentAccess,
    normalizeGovernanceGroupRole,
    normalizeGovernanceGroupType,
} from '../src/utils/governanceGroups.js';

function actor(overrides = {}) {
    return {
        id: 20,
        role: 'standard',
        ...overrides,
    };
}

const org = { id: 7, name: 'Healthcare Group' };
const orgAccess = [
    { organizationId: 7, userId: 21, accessRole: 'admin', revokedAt: null },
    { organizationId: 7, userId: 22, accessRole: 'staff', revokedAt: null },
];

test('governance group type aliases stay narrow', () => {
    assert.equal(normalizeGovernanceGroupType('org'), 'org');
    assert.equal(normalizeGovernanceGroupType('organisation'), 'org');
    assert.equal(normalizeGovernanceGroupType('organization'), 'org');
    assert.equal(normalizeGovernanceGroupType('org_group'), 'org');
    assert.equal(normalizeGovernanceGroupType('region'), 'region');
    assert.equal(normalizeGovernanceGroupType('regional'), 'region');
    assert.equal(normalizeGovernanceGroupType('region_group'), 'region');
    assert.equal(normalizeGovernanceGroupType('iccp'), 'region');
    assert.equal(normalizeGovernanceGroupType('iccp_sr'), 'region');
    assert.equal(normalizeGovernanceGroupType('ICCP SR'), 'region');
    assert.equal(normalizeGovernanceGroupType('owner'), null);
});

test('governance group roles do not accept resource roles', () => {
    assert.equal(normalizeGovernanceGroupRole('admin'), 'admin');
    assert.equal(normalizeGovernanceGroupRole(' staff '), 'staff');
    assert.equal(normalizeGovernanceGroupRole('owner'), null);
    assert.equal(normalizeGovernanceGroupRole('resource_staff'), null);
});

test('group roles never grant resource editing or restricted content', () => {
    assert.equal(governanceGroupRolesGrantResourceEditRights(), false);
    assert.equal(governanceGroupRolesGrantRestrictedContentAccess(), false);
});

test('organisation admins and super admins can create org groups', () => {
    assert.equal(
        canCreateGovernanceGroup(actor({ role: 'super_admin' }), {
            groupType: 'org',
            organization: org,
            organizationAccessRows: [],
        }).allowed,
        true,
    );
    assert.equal(
        canCreateGovernanceGroup(actor({ id: 21 }), {
            groupType: 'org',
            organization: org,
            organizationAccessRows: orgAccess,
        }).allowed,
        true,
    );

    const staffDecision = canCreateGovernanceGroup(actor({ id: 22 }), {
        groupType: 'org',
        organization: org,
        organizationAccessRows: orgAccess,
    });
    assert.equal(staffDecision.allowed, false);
    assert.match(staffDecision.reason, /Organisation Admin/);
});

test('only super admins create region groups in V1', () => {
    assert.equal(canCreateGovernanceGroup(actor({ role: 'super_admin' }), { groupType: 'region' }).allowed, true);

    const decision = canCreateGovernanceGroup(actor({ role: 'regional_admin' }), { groupType: 'region' });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /Super Admin/);
});

test('super admins, owning organisation admins, and group admins can manage groups', () => {
    const group = { id: 90, groupType: 'org', organizationId: 7 };
    const groupMemberships = [
        { groupId: 90, userId: 23, groupRole: 'admin', revokedAt: null },
        { groupId: 90, userId: 24, groupRole: 'staff', revokedAt: null },
    ];

    assert.equal(canManageGovernanceGroup(actor({ role: 'super_admin' }), group, groupMemberships, []).allowed, true);
    assert.equal(canManageGovernanceGroup(actor({ id: 21 }), group, groupMemberships, orgAccess).allowed, true);
    assert.equal(canManageGovernanceGroup(actor({ id: 23 }), group, groupMemberships, orgAccess).allowed, true);

    const staffDecision = canManageGovernanceGroup(actor({ id: 24 }), group, groupMemberships, orgAccess);
    assert.equal(staffDecision.allowed, false);
});

test('revoked organisation and group admin rows do not manage groups', () => {
    const group = { id: 90, groupType: 'org', organizationId: 7 };
    const revokedOrgAccess = [
        { organizationId: 7, userId: 21, accessRole: 'admin', revokedAt: '2026-06-05T00:00:00.000Z' },
    ];
    const revokedGroupMemberships = [
        { groupId: 90, userId: 23, groupRole: 'admin', revokedAt: '2026-06-05T00:00:00.000Z' },
    ];

    assert.equal(canManageGovernanceGroup(actor({ id: 21 }), group, [], revokedOrgAccess).allowed, false);
    assert.equal(canManageGovernanceGroup(actor({ id: 23 }), group, revokedGroupMemberships, orgAccess).allowed, false);
});

test('active group admins can add staff but not promote other admins', () => {
    const group = { id: 90, groupType: 'org', organizationId: 7 };
    const groupMemberships = [
        { groupId: 90, userId: 23, groupRole: 'admin', revokedAt: null },
    ];

    assert.equal(
        canManageGovernanceGroupMemberRole(actor({ id: 23 }), group, groupMemberships, orgAccess, 'staff').allowed,
        true,
    );

    const promoteDecision = canManageGovernanceGroupMemberRole(
        actor({ id: 23 }),
        group,
        groupMemberships,
        orgAccess,
        'admin',
    );
    assert.equal(promoteDecision.allowed, false);
    assert.match(promoteDecision.reason, /Organisation Admin or Super Admin/);
});

test('region group admins cannot promote other region group admins', () => {
    const group = { id: 91, groupType: 'region' };
    const groupMemberships = [
        { groupId: 91, userId: 23, groupRole: 'admin', revokedAt: null },
    ];

    const decision = canManageGovernanceGroupMemberRole(actor({ id: 23 }), group, groupMemberships, [], 'admin');
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /Only a Super Admin/);
});

test('governance group controller exports are named for the route surface', async () => {
    const controller = await import('../src/controllers/governanceController.js');
    assert.equal(typeof controller.listGovernanceGroups, 'function');
    assert.equal(typeof controller.createGovernanceGroup, 'function');
    assert.equal(typeof controller.updateGovernanceGroup, 'function');
    assert.equal(typeof controller.addGovernanceGroupMember, 'function');
    assert.equal(typeof controller.revokeGovernanceGroupMember, 'function');
    assert.equal(typeof controller.linkGovernanceGroupOrganization, 'function');
    assert.equal(typeof controller.unlinkGovernanceGroupOrganization, 'function');
    assert.equal(typeof controller.linkGovernanceGroupResource, 'function');
    assert.equal(typeof controller.unlinkGovernanceGroupResource, 'function');
});

test('region group resource links stay inside linked organisation context', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/controllers/governanceController.js', import.meta.url), 'utf8');

    assert.match(source, /loadGovernanceGroupOrganizations\(db, \[groupId\]\)/);
    assert.match(source, /Link the resource organisation to this Region Group before adding that resource\./);
});
