import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPartnerStaffAccessPayload,
    getActivePartnerStaffAccess,
    hasPartnerStaffAccess,
    loadPartnerStaffAccessForUser,
} from '../src/utils/partnerStaff.js';

test('partner staff payload stays compact and skips revoked memberships', () => {
    const payload = buildPartnerStaffAccessPayload([
        {
            organizationId: 3,
            legacyPartnerUserId: 20,
            organizationName: 'Care Partner',
            staffRole: 'editor',
            revokedAt: null,
            subregionIds: [4],
        },
        {
            organizationId: 4,
            legacyPartnerUserId: 21,
            organizationName: 'Old Partner',
            staffRole: 'owner',
            revokedAt: '2026-05-09T00:00:00.000Z',
            subregionIds: [5],
        },
    ]);

    assert.deepEqual(payload, [{
        organizationId: 3,
        legacyPartnerUserId: 20,
        organizationName: 'Care Partner',
        staffRole: 'editor',
        subregionIds: [4],
    }]);
});

test('partner staff access helpers accept owner/editor and reject revoked or unrelated entries', () => {
    const user = {
        partnerStaffAccess: [
            {
                organizationId: 3,
                legacyPartnerUserId: 20,
                staffRole: 'editor',
                subregionIds: [4],
            },
            {
                organizationId: 4,
                legacyPartnerUserId: 21,
                staffRole: 'owner',
                revokedAt: '2026-05-09T00:00:00.000Z',
                subregionIds: [5],
            },
        ],
    };

    assert.equal(hasPartnerStaffAccess(user, 20), true);
    assert.equal(hasPartnerStaffAccess(user, 20, ['owner']), false);
    assert.equal(hasPartnerStaffAccess(user, 21), false);
    assert.deepEqual(getActivePartnerStaffAccess(user).map((entry) => entry.legacyPartnerUserId), [20]);
});

test('partner staff lookup falls back to no access when staff tables are not bootstrapped yet', async () => {
    const missingTableError = new Error('relation "partner_staff_memberships" does not exist');
    missingTableError.code = '42P01';
    const db = {
        select() {
            return {
                from() {
                    throw missingTableError;
                },
            };
        },
    };

    await assert.doesNotReject(async () => {
        const access = await loadPartnerStaffAccessForUser(db, 7);
        assert.deepEqual(access, []);
    });
});

test('partner staff lookup still surfaces unexpected database errors', async () => {
    const db = {
        select() {
            return {
                from() {
                    throw new Error('connection unavailable');
                },
            };
        },
    };

    await assert.rejects(
        () => loadPartnerStaffAccessForUser(db, 7),
        /connection unavailable/
    );
});
