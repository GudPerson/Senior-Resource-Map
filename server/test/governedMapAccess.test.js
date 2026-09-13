import assert from 'node:assert/strict';
import test from 'node:test';

import {
    canStewardGovernedResource,
    deriveGovernedMapCapabilities,
} from '../src/utils/governedMapAccess.js';

const resourceA = { resourceType: 'hard', resourceId: 10, organizationIds: [1] };
const resourceB = { resourceType: 'soft', resourceId: 20, organizationIds: [2] };

test('governed map stewardship follows current resource and organization access', () => {
    const directStaff = { role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 10, staffRole: 'staff' }] };
    const orgAdmin = { role: 'standard', organizationAccess: [{ organizationId: 2, accessRole: 'admin' }] };
    const orgStaff = { role: 'standard', organizationAccess: [{ organizationId: 2, accessRole: 'staff' }] };

    assert.equal(canStewardGovernedResource(directStaff, resourceA), true);
    assert.equal(canStewardGovernedResource(orgAdmin, resourceB), true);
    assert.equal(canStewardGovernedResource(orgStaff, resourceB), false);
});

test('creator identity is irrelevant to governed map capabilities', () => {
    const user = { id: 99, role: 'standard', softAssetStaffAccess: [{ softAssetId: 20, staffRole: 'owner' }] };
    const capabilities = deriveGovernedMapCapabilities({
        user,
        regionOrganizationIds: [1, 2],
        resources: [resourceA, resourceB],
        lifecycleStatus: 'published',
    });

    assert.equal(capabilities.canView, true);
    assert.equal(capabilities.canEditMetadata, true);
    assert.equal(capabilities.canRequestRetirement, true);
    assert.deepEqual(capabilities.removableResourceKeys, ['soft:20']);
});

test('retirement freezes edits while a remaining included-resource steward can restore', () => {
    const user = { role: 'standard', organizationAccess: [{ organizationId: 1, accessRole: 'admin' }] };
    const capabilities = deriveGovernedMapCapabilities({
        user,
        regionOrganizationIds: [1, 2],
        resources: [resourceA, resourceB],
        lifecycleStatus: 'retirement_pending',
    });

    assert.equal(capabilities.canView, true);
    assert.equal(capabilities.canEditMetadata, false);
    assert.equal(capabilities.canAddResource, false);
    assert.equal(capabilities.canRestore, true);
});

test('leaving all resources and participant organizations removes map authority', () => {
    const formerCreator = { id: 7, role: 'standard' };
    const capabilities = deriveGovernedMapCapabilities({
        user: formerCreator,
        regionOrganizationIds: [1, 2],
        resources: [resourceA, resourceB],
        lifecycleStatus: 'published',
    });

    assert.deepEqual(capabilities, {
        canView: false,
        canCreate: false,
        canEditMetadata: false,
        canAddResource: false,
        canPublish: false,
        canRequestRetirement: false,
        canRestore: false,
        canArchive: false,
        removableResourceKeys: [],
    });
});
