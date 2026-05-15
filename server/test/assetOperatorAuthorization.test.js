import assert from 'node:assert/strict';
import test from 'node:test';

import { hasDirectResourceOperatorAccess, hydrateLiveAccessForUser } from '../src/middleware/auth.js';

test('standard hard asset staff can use dashboard resource routes', () => {
    assert.equal(hasDirectResourceOperatorAccess({
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 10, staffRole: 'staff' }],
    }), true);
});

test('standard standalone soft asset staff can use dashboard resource routes', () => {
    assert.equal(hasDirectResourceOperatorAccess({
        role: 'standard',
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'owner' }],
    }), true);
});

test('standard user without direct asset access cannot use dashboard resource routes', () => {
    assert.equal(hasDirectResourceOperatorAccess({ role: 'standard' }), false);
});

test('legacy partner role alone is not resource-operator access', () => {
    assert.equal(hasDirectResourceOperatorAccess({ role: 'partner' }), false);
});

test('live asset access replaces stale session access before authorization', async () => {
    const user = {
        id: 66,
        role: 'standard',
        hardAssetStaffAccess: [],
        softAssetStaffAccess: [],
    };

    const hydrated = await hydrateLiveAccessForUser(user, {
        db: {},
        loadPartnerStaffAccess: async () => [],
        loadHardAssetStaffAccess: async () => [{
            hardAssetId: 18398,
            staffRole: 'owner',
            subregionId: 130,
        }],
        loadSoftAssetStaffAccess: async () => [],
    });

    assert.notEqual(hydrated, user);
    assert.deepEqual(hydrated.hardAssetStaffAccess, [{
        hardAssetId: 18398,
        staffRole: 'owner',
        subregionId: 130,
    }]);
    assert.equal(hasDirectResourceOperatorAccess(hydrated), true);
});
