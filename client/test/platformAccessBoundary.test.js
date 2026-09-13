import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRestrictedPublicAccess, publicAccessStatusLabel, restrictedAccessSettings } from '../src/lib/platformAccessBoundary.js';

test('limited release closes public access without offering organisation registration', () => {
    const settings = { ...restrictedAccessSettings(false), available: true };
    assert.deepEqual(restrictedAccessSettings(false), {
        publicDirectoryMode: 'closed', publicRegistrationMode: 'closed', publicLoginMode: 'closed',
    });
    assert.equal(publicAccessStatusLabel(settings), 'Private workspace');
    assert.equal(hasRestrictedPublicAccess(settings), true);
});

test('ready organisation pilot retains approved organisation login and registration', () => {
    assert.equal(publicAccessStatusLabel({ ...restrictedAccessSettings(true), available: true }), 'Closed organisation pilot');
    assert.equal(restrictedAccessSettings(true).publicRegistrationMode, 'organization_only');
});

test('mixed restrictions are not incorrectly described as open public access', () => {
    assert.equal(hasRestrictedPublicAccess(null), false);
    assert.equal(publicAccessStatusLabel({ available: false }), 'Migration required');
    const open = { available: true, publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open' };
    assert.equal(publicAccessStatusLabel(open), 'Open public access');
    assert.equal(hasRestrictedPublicAccess(open), false);
    for (const key of ['publicDirectoryMode', 'publicRegistrationMode', 'publicLoginMode']) {
        assert.equal(publicAccessStatusLabel({ ...open, [key]: 'closed' }), 'Custom access restrictions');
        assert.equal(hasRestrictedPublicAccess({ ...open, [key]: 'closed' }), true);
    }
});
