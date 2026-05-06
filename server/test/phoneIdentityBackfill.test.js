import test from 'node:test';
import assert from 'node:assert/strict';

import {
    LEGACY_PHONE_IDENTITY_SOURCE,
    LEGACY_PHONE_IDENTITY_STATUS,
    applyPhoneIdentityBackfillPlan,
    buildPhoneIdentityBackfillPlan,
    serializePhoneIdentityBackfillReport,
} from '../src/utils/phoneIdentityBackfill.js';

function buildCurrentAuditFixture() {
    return [
        ...Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            username: `unique-${index + 1}`,
            role: 'standard',
            phone: `8${String(1000000 + index).padStart(7, '0')}`,
        })),
        { id: 64, username: 'CCK1', role: 'regional_admin', phone: '+65 8888 8888' },
        { id: 66, username: 'CCK3', role: 'regional_admin', phone: '88888888' },
        { id: 65, username: 'CCK2', role: 'regional_admin', phone: '6588888888' },
        { id: 70, username: 'FYCS-CCK', role: 'partner', phone: '+65 9123 6322' },
        { id: 73, username: 'FYCS-BL', role: 'partner', phone: '91236322' },
        { id: 80, username: 'blank', role: 'standard', phone: '' },
        { id: 81, username: 'missing', role: 'standard', phone: null },
        { id: 82, username: 'bad-short', role: 'standard', phone: '1234' },
        { id: 83, username: 'bad-country', role: 'standard', phone: '+60 8123 4567' },
        { id: 84, username: 'bad-text', role: 'standard', phone: 'not a phone' },
    ];
}

test('phone identity backfill dry-run reports current eligible count without mutating', async () => {
    const plan = buildPhoneIdentityBackfillPlan(buildCurrentAuditFixture(), []);
    const writes = [];
    const result = await applyPhoneIdentityBackfillPlan({ writes }, plan, { apply: false });
    const report = serializePhoneIdentityBackfillReport(plan, result);

    assert.equal(report.mode, 'dry-run');
    assert.equal(report.totalUsersChecked, 22);
    assert.equal(report.usersWithPhoneValues, 20);
    assert.equal(report.validNormalizedSgPhones, 17);
    assert.equal(report.invalidOrSkippedPhones, 5);
    assert.equal(report.duplicatePhoneGroupsCount, 2);
    assert.equal(report.accountsInvolvedInDuplicateGroups, 5);
    assert.equal(report.eligibleBackfillCount, 12);
    assert.equal(result.insertedCount, 0);
    assert.deepEqual(writes, []);
});

test('phone identity backfill excludes duplicate and invalid phones from inserts', () => {
    const plan = buildPhoneIdentityBackfillPlan(buildCurrentAuditFixture(), []);

    assert.deepEqual(plan.duplicateGroups.map((group) => [group.phone, group.accountCount]), [
        ['+65****8888', 3],
        ['+65****6322', 2],
    ]);
    assert.equal(plan.invalidOrSkippedUsers.length, 5);
    assert.equal(plan.insertRows.length, 12);
    assert.ok(plan.insertRows.every((row) => !['+6588888888', '+6591236322'].includes(row.phoneE164)));
});

test('phone identity backfill skips users or phones that already have identity rows', () => {
    const plan = buildPhoneIdentityBackfillPlan([
        { id: 1, username: 'one', role: 'standard', phone: '81000001' },
        { id: 2, username: 'two', role: 'standard', phone: '81000002' },
        { id: 3, username: 'three', role: 'standard', phone: '81000003' },
    ], [
        { userId: 1, phoneE164: '+6581000001', revokedAt: null },
        { userId: 99, phoneE164: '+6581000002', revokedAt: null },
    ]);

    assert.deepEqual(plan.insertRows.map((row) => row.userId), [3]);
    assert.equal(plan.existingIdentitySkippedCount, 2);
});

test('phone identity backfill apply mode inserts legacy unverified identities only when explicit', async () => {
    const plan = buildPhoneIdentityBackfillPlan([
        { id: 1, username: 'one', role: 'standard', phone: '+65 8100 0001' },
    ], []);
    const writes = [];
    const fakeDb = {
        insert(table) {
            return {
                values(rows) {
                    writes.push({ table, rows });
                    return {
                        onConflictDoNothing() {
                            return Promise.resolve();
                        },
                    };
                },
            };
        },
    };

    await applyPhoneIdentityBackfillPlan(fakeDb, plan, { apply: false });
    assert.deepEqual(writes, []);

    const result = await applyPhoneIdentityBackfillPlan(fakeDb, plan, { apply: true });

    assert.equal(result.insertedCount, 1);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].rows[0].status, LEGACY_PHONE_IDENTITY_STATUS);
    assert.equal(writes[0].rows[0].source, LEGACY_PHONE_IDENTITY_SOURCE);
    assert.equal(writes[0].rows[0].phoneE164, '+6581000001');
});

test('phone identity backfill plan preserves active uniqueness before database constraints run', () => {
    const plan = buildPhoneIdentityBackfillPlan(buildCurrentAuditFixture(), []);
    const phones = plan.insertRows.map((row) => row.phoneE164);
    const users = plan.insertRows.map((row) => row.userId);

    assert.equal(new Set(phones).size, phones.length);
    assert.equal(new Set(users).size, users.length);
});
