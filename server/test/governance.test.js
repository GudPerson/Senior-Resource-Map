import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildAgreementCoverageSummary,
    canManageOrganizationAccessRole,
    canManageOrganizationGovernance,
    canRevokeOrganizationAccessRole,
    canViewOrganizationGovernance,
    hasActiveOptOut,
    isNotificationDeliveryAllowed,
    isOrganizationDeletableDraft,
    isOrganizationOpenForNewRecords,
    isRetentionDeletionReady,
    normalizeAgreementStatus,
    normalizeOrganizationGovernanceStatus,
    normalizeOrganizationAccessRole,
    organizationAccessGrantsResourceEditRights,
    evaluateAssetOperatorOrganizationEligibility,
    evaluateOrganizationUserAssignment,
    evaluateResourceOrganizationLink,
} from '../src/utils/governance.js';
import { organizationResourceLinks } from '../src/db/schema.js';
import { loadOfferingsCoveredByHardAssetLinks } from '../src/utils/organizationGuardrails.js';

function createActor(overrides = {}) {
    return {
        id: 20,
        role: 'standard',
        ...overrides,
    };
}

test('organisation access roles are governance-only admin or staff values', () => {
    assert.equal(normalizeOrganizationAccessRole('admin'), 'admin');
    assert.equal(normalizeOrganizationAccessRole(' staff '), 'staff');
    assert.equal(normalizeOrganizationAccessRole('owner'), null);
    assert.equal(normalizeOrganizationAccessRole('editor'), null);
    assert.equal(normalizeOrganizationAccessRole('super_admin'), null);
});

test('organisation governance status controls new operational records', () => {
    assert.equal(normalizeOrganizationGovernanceStatus('Active'), 'active');
    assert.equal(normalizeOrganizationGovernanceStatus(' Draft '), 'draft');
    assert.equal(normalizeOrganizationGovernanceStatus('paused'), 'paused');
    assert.equal(normalizeOrganizationGovernanceStatus('archived'), 'archived');
    assert.equal(normalizeOrganizationGovernanceStatus('unknown'), 'active');

    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'active' }), true);
    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'draft' }), true);
    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'paused' }), false);
    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'archived' }), false);
});

test('only empty draft organisations are deletable', () => {
    assert.equal(isOrganizationDeletableDraft({
        organization: { governanceStatus: 'draft', legacyPartnerUserId: null },
        activeAccess: [],
        activeAgreements: [],
        activeResourceLinks: [],
    }), true);

    assert.equal(isOrganizationDeletableDraft({
        organization: { governanceStatus: 'active', legacyPartnerUserId: null },
        activeAccess: [],
        activeAgreements: [],
        activeResourceLinks: [],
    }), false);

    assert.equal(isOrganizationDeletableDraft({
        organization: { governanceStatus: 'draft', legacyPartnerUserId: 12 },
        activeAccess: [],
        activeAgreements: [],
        activeResourceLinks: [],
    }), false);

    assert.equal(isOrganizationDeletableDraft({
        organization: { governanceStatus: 'draft', legacyPartnerUserId: null },
        activeAccess: [{ id: 1 }],
        activeAgreements: [],
        activeResourceLinks: [],
    }), false);

    assert.equal(isOrganizationDeletableDraft({
        organization: { governanceStatus: 'draft', legacyPartnerUserId: null },
        activeAccess: [],
        activeAgreements: [{ id: 1 }],
        activeResourceLinks: [],
    }), false);

    assert.equal(isOrganizationDeletableDraft({
        organization: { governanceStatus: 'draft', legacyPartnerUserId: null },
        activeAccess: [],
        activeAgreements: [],
        activeResourceLinks: [{ id: 1 }],
    }), false);
});

test('organisation resource link schema exposes agreement coverage status', () => {
    assert.ok(
        organizationResourceLinks.agreementCoverageStatus,
        'resource list organisation context must not select an undefined Drizzle column',
    );
});

test('organisation governance access is independent from global role and asset edit access', () => {
    const organization = { id: 7 };
    const memberships = [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
        { organizationId: 7, userId: 32, accessRole: 'staff', revokedAt: null },
        { organizationId: 8, userId: 33, accessRole: 'admin', revokedAt: null },
        { organizationId: 7, userId: 34, accessRole: 'admin', revokedAt: '2026-05-21T00:00:00.000Z' },
    ];

    assert.equal(canManageOrganizationGovernance(createActor({ id: 1, role: 'super_admin' }), organization, memberships), true);
    assert.equal(canViewOrganizationGovernance(createActor({ id: 1, role: 'super_admin' }), organization, memberships), true);

    assert.equal(canManageOrganizationGovernance(createActor({ id: 31, role: 'standard' }), organization, memberships), true);
    assert.equal(canViewOrganizationGovernance(createActor({ id: 31, role: 'standard' }), organization, memberships), true);

    assert.equal(canManageOrganizationGovernance(createActor({ id: 32, role: 'standard' }), organization, memberships), false);
    assert.equal(canViewOrganizationGovernance(createActor({ id: 32, role: 'standard' }), organization, memberships), true);

    assert.equal(canManageOrganizationGovernance(createActor({ id: 40, role: 'regional_admin' }), organization, memberships), false);
    assert.equal(canViewOrganizationGovernance(createActor({ id: 40, role: 'regional_admin' }), organization, memberships), false);
    assert.equal(canManageOrganizationGovernance(createActor({ id: 33, role: 'standard' }), organization, memberships), false);
    assert.equal(canViewOrganizationGovernance(createActor({ id: 34, role: 'standard' }), organization, memberships), false);

    assert.equal(organizationAccessGrantsResourceEditRights(), false);
});

test('organisation admins can manage org admins and staff without becoming global admins', () => {
    const organization = { id: 7, name: 'Entrust Healthcare Group' };
    const orgAdmin = createActor({ id: 31, role: 'standard' });
    const orgStaff = createActor({ id: 32, role: 'standard' });
    const regionAdmin = createActor({ id: 33, role: 'regional_admin' });
    const accessRows = [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
        { organizationId: 7, userId: 32, accessRole: 'staff', revokedAt: null },
    ];

    assert.equal(canManageOrganizationAccessRole(orgAdmin, organization, accessRows, 'admin'), true);
    assert.equal(canManageOrganizationAccessRole(orgAdmin, organization, accessRows, 'staff'), true);
    assert.equal(canManageOrganizationAccessRole(orgStaff, organization, accessRows, 'admin'), false);
    assert.equal(canManageOrganizationAccessRole(regionAdmin, organization, accessRows, 'admin'), false);
});

test('organisation access revocation protects the final active organisation admin', () => {
    const organization = { id: 7, name: 'Entrust Healthcare Group' };
    const actor = createActor({ id: 31, role: 'standard' });

    assert.deepEqual(canRevokeOrganizationAccessRole(actor, organization, [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
        { organizationId: 7, userId: 32, accessRole: 'admin', revokedAt: null },
    ], { userId: 32, accessRole: 'admin' }), { allowed: true, reason: null });

    const finalAdminDecision = canRevokeOrganizationAccessRole(actor, organization, [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
    ], { userId: 31, accessRole: 'admin' });

    assert.equal(finalAdminDecision.allowed, false);
    assert.match(finalAdminDecision.reason, /at least one active Organisation Admin/);
});

test('organisation membership allows only one active organisation per user', () => {
    assert.deepEqual(evaluateOrganizationUserAssignment({
        targetOrganizationId: 7,
        existingMemberships: [],
    }), { allowed: true, reason: null });

    assert.deepEqual(evaluateOrganizationUserAssignment({
        targetOrganizationId: 7,
        existingMemberships: [{ organizationId: 7, organizationName: 'Fei Yue', revokedAt: null }],
    }), { allowed: true, reason: null });

    const conflict = evaluateOrganizationUserAssignment({
        targetOrganizationId: 8,
        existingMemberships: [{ organizationId: 7, organizationName: 'Fei Yue', revokedAt: null }],
    });
    assert.equal(conflict.allowed, false);
    assert.match(conflict.reason, /already assigned to Fei Yue/);

    assert.deepEqual(evaluateOrganizationUserAssignment({
        targetOrganizationId: 8,
        existingMemberships: [{ organizationId: 7, organizationName: 'Fei Yue', revokedAt: '2026-05-22T00:00:00.000Z' }],
    }), { allowed: true, reason: null });
});

test('asset access requires the user organisation to match the linked resource organisation', () => {
    assert.deepEqual(evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks: [],
        userOrganizationMemberships: [],
    }), { allowed: true, reason: null });

    assert.deepEqual(evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks: [{ organizationId: 7, organizationName: 'Fei Yue', unlinkedAt: null }],
        userOrganizationMemberships: [{ organizationId: 7, organizationName: 'Fei Yue', revokedAt: null }],
    }), { allowed: true, reason: null });

    const missing = evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks: [{ organizationId: 7, organizationName: 'Fei Yue', unlinkedAt: null }],
        userOrganizationMemberships: [],
    });
    assert.equal(missing.allowed, false);
    assert.match(missing.reason, /linked to Fei Yue/);

    const crossOrg = evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks: [{ organizationId: 7, organizationName: 'Fei Yue', unlinkedAt: null }],
        userOrganizationMemberships: [{ organizationId: 8, organizationName: 'Precious', revokedAt: null }],
    });
    assert.equal(crossOrg.allowed, false);
    assert.match(crossOrg.reason, /assigned to Precious/);

    const ambiguous = evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks: [
            { organizationId: 7, organizationName: 'Fei Yue', unlinkedAt: null },
            { organizationId: 8, organizationName: 'Precious', unlinkedAt: null },
        ],
        userOrganizationMemberships: [{ organizationId: 7, organizationName: 'Fei Yue', revokedAt: null }],
    });
    assert.equal(ambiguous.allowed, false);
    assert.match(ambiguous.reason, /more than one active organisation/);
});

test('linking a resource to an organisation blocks conflicting links and operators', () => {
    const noOperators = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [],
    });
    assert.equal(noOperators.allowed, false);
    assert.match(noOperators.reason, /active Owner or Staff/);

    const linkedElsewhere = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [{ organizationId: 8, organizationName: 'Precious', unlinkedAt: null }],
        activeOperators: [],
    });
    assert.equal(linkedElsewhere.allowed, false);
    assert.match(linkedElsewhere.reason, /already linked to Precious/);

    const operatorElsewhere = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [
            {
                userName: 'Sam',
                organizationMemberships: [{ organizationId: 8, organizationName: 'Precious', revokedAt: null }],
            },
        ],
    });
    assert.equal(operatorElsewhere.allowed, false);
    assert.match(operatorElsewhere.reason, /Sam is assigned to Precious/);

    const operatorUnassigned = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [{ userName: 'Alex', organizationMemberships: [] }],
    });
    assert.equal(operatorUnassigned.allowed, false);
    assert.match(operatorUnassigned.reason, /Add Alex to this organisation/);

    const multipleMissingOperators = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [
            { userName: 'Hyqel Zainudin', organizationMemberships: [] },
            { userName: 'Joshua Chua', organizationMemberships: [] },
        ],
    });
    assert.equal(multipleMissingOperators.allowed, false);
    assert.match(multipleMissingOperators.reason, /Hyqel Zainudin/);
    assert.match(multipleMissingOperators.reason, /Joshua Chua/);

    assert.deepEqual(evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [
            {
                userName: 'Alex',
                organizationMemberships: [{ organizationId: 7, organizationName: 'Fei Yue', revokedAt: null }],
            },
        ],
    }), { allowed: true, reason: null });
});

test('linked places cover hosted and linked offerings once for organisation context', async () => {
    const fakeDb = {
        select(selection) {
            return {
                from() {
                    const query = {
                        innerJoin() {
                            return query;
                        },
                        where() {
                            if (selection.hostHardAssetId) {
                                return Promise.resolve([
                                    { id: 41, name: 'Hosted CHP', hostHardAssetId: 10 },
                                    { id: 42, name: 'Duplicate Exercise', hostHardAssetId: 20 },
                                ]);
                            }
                            if (selection.hardAssetId) {
                                return Promise.resolve([
                                    { id: 42, name: 'Duplicate Exercise', hardAssetId: 20 },
                                    { id: 43, name: 'Linked Yoga', hardAssetId: 10 },
                                ]);
                            }
                            return Promise.resolve([]);
                        },
                    };
                    return query;
                },
            };
        },
    };

    const rows = await loadOfferingsCoveredByHardAssetLinks(fakeDb, [10, 20, 10]);

    assert.deepEqual(rows, [
        {
            id: 41,
            resourceType: 'soft',
            resourceId: 41,
            resourceName: 'Hosted CHP',
            coveredByHardAssetId: 10,
            coverageSource: 'linked_place',
        },
        {
            id: 42,
            resourceType: 'soft',
            resourceId: 42,
            resourceName: 'Duplicate Exercise',
            coveredByHardAssetId: 20,
            coverageSource: 'linked_place',
        },
        {
            id: 43,
            resourceType: 'soft',
            resourceId: 43,
            resourceName: 'Linked Yoga',
            coveredByHardAssetId: 10,
            coverageSource: 'linked_place',
        },
    ]);
});

test('external notification channels remain disabled in V1 even when preferences are enabled', () => {
    assert.equal(isNotificationDeliveryAllowed({ channel: 'in_app', enabled: true }), true);
    assert.equal(isNotificationDeliveryAllowed({ channel: 'in_app', enabled: false }), false);
    assert.equal(isNotificationDeliveryAllowed({ channel: 'email', enabled: true }), false);
    assert.equal(isNotificationDeliveryAllowed({ channel: 'whatsapp', enabled: true }), false);
    assert.equal(isNotificationDeliveryAllowed({ channel: 'sms', enabled: true }), false);
});

test('opt-out records expose active user-level blocks for future workflows', () => {
    const records = [
        { userId: 20, optOutType: 'analytics', active: false },
        { userId: 20, optOutType: 'recommendations', active: true },
        { userId: 20, optOutType: 'external_notifications', active: true, revokedAt: '2026-05-21T00:00:00.000Z' },
    ];

    assert.equal(hasActiveOptOut(records, 'analytics'), false);
    assert.equal(hasActiveOptOut(records, 'recommendations'), true);
    assert.equal(hasActiveOptOut(records, 'external_notifications'), false);
});

test('agreement coverage reports missing, expired, and allowed-use states', () => {
    const now = new Date('2026-05-22T00:00:00.000Z');
    assert.deepEqual(buildAgreementCoverageSummary([], 'restrictedFiles', now), {
        status: 'missing',
        warning: 'No active agreement covers this use yet.',
    });

    assert.equal(normalizeAgreementStatus('Expired'), 'expired');

    const expired = buildAgreementCoverageSummary([
        {
            status: 'active',
            expiresAt: '2026-05-01T00:00:00.000Z',
            allowedUses: { restrictedFiles: true },
        },
    ], 'restrictedFiles', now);
    assert.equal(expired.status, 'expired');

    const allowed = buildAgreementCoverageSummary([
        {
            status: 'active',
            expiresAt: '2026-06-01T00:00:00.000Z',
            allowedUses: { restrictedFiles: true },
        },
    ], 'restrictedFiles', now);
    assert.equal(allowed.status, 'covered');

    const notAllowed = buildAgreementCoverageSummary([
        {
            status: 'active',
            expiresAt: '2026-06-01T00:00:00.000Z',
            allowedUses: { restrictedFiles: false },
        },
    ], 'restrictedFiles', now);
    assert.equal(notAllowed.status, 'not_allowed');
});

test('retention foundation is manual-review only and never auto-purges by itself', () => {
    assert.equal(isRetentionDeletionReady({
        deletionEligible: true,
        deletionStatus: 'reviewed',
        retainUntil: '2026-05-01T00:00:00.000Z',
    }, new Date('2026-05-22T00:00:00.000Z')), true);

    assert.equal(isRetentionDeletionReady({
        deletionEligible: true,
        deletionStatus: 'active',
        retainUntil: '2026-05-01T00:00:00.000Z',
    }, new Date('2026-05-22T00:00:00.000Z')), false);
});
