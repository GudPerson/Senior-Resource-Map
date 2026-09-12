import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPlatformAccessError,
    canAccessDirectory,
    evaluateExistingUserLogin,
    evaluateRegistration,
    normalizePlatformAccessSettings,
} from '../src/utils/platformAccess.js';
import { platformAccessSettings } from '../src/db/schema.js';

const orgUser = {
    id: 12,
    role: 'standard',
    organizationAccess: [{ organizationId: 8, accessRole: 'staff' }],
};

test('platform access schema is additive and defaults to legacy-open behavior', () => {
    assert.ok(platformAccessSettings.publicDirectoryMode);
    assert.ok(platformAccessSettings.publicRegistrationMode);
    assert.ok(platformAccessSettings.publicLoginMode);
    assert.deepEqual(normalizePlatformAccessSettings(), {
        publicDirectoryMode: 'open',
        publicRegistrationMode: 'open',
        publicLoginMode: 'open',
        revision: 0,
        updatedAt: null,
    });
});

test('authenticated directory mode permits approved organization users and closes other accounts', () => {
    const settings = { publicDirectoryMode: 'authenticated' };
    assert.equal(canAccessDirectory(settings), false);
    assert.equal(canAccessDirectory(settings, orgUser), true);
    assert.equal(canAccessDirectory(settings, { id: 14, role: 'standard' }), false);
    assert.equal(canAccessDirectory({ publicDirectoryMode: 'closed' }, orgUser), false);
    assert.equal(canAccessDirectory({ publicDirectoryMode: 'closed' }, { id: 1, role: 'super_admin' }), true);
});

test('organization-only login requires the organization pathway and current approval', () => {
    const settings = { publicLoginMode: 'organization_only' };
    assert.deepEqual(evaluateExistingUserLogin(settings, orgUser), {
        allowed: false,
        code: 'organization_login_required',
    });
    assert.deepEqual(evaluateExistingUserLogin(settings, orgUser, { organizationLogin: true }), {
        allowed: true,
        code: null,
    });
    assert.deepEqual(evaluateExistingUserLogin(
        settings,
        { id: 13, role: 'standard', organizationAccess: [] },
        { organizationLogin: true },
    ), {
        allowed: false,
        code: 'organization_approval_required',
    });
});

test('organization-only registration routes unmatched and matched domains distinctly', () => {
    const settings = { publicRegistrationMode: 'organization_only' };
    assert.deepEqual(evaluateRegistration(settings), {
        allowed: false,
        pendingApproval: false,
        code: 'organization_registration_required',
    });
    assert.deepEqual(evaluateRegistration(settings, { matchedOrganizationId: 42 }), {
        allowed: true,
        pendingApproval: true,
        code: 'organization_approval_required',
        organizationId: 42,
    });
    assert.match(buildPlatformAccessError('organization_registration_required').error, /Register your organisation/);
});

test('closed modes fail closed while open mode remains backward compatible', () => {
    assert.deepEqual(evaluateRegistration({ publicRegistrationMode: 'closed' }), {
        allowed: false,
        pendingApproval: false,
        code: 'registration_closed',
    });
    assert.deepEqual(evaluateExistingUserLogin({ publicLoginMode: 'closed' }, orgUser, { organizationLogin: true }), {
        allowed: false,
        code: 'login_closed',
    });
    assert.equal(canAccessDirectory({ publicDirectoryMode: 'open' }), true);
});
