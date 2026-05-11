import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureBoundarySchema, resetBoundarySchemaBootstrapForTests } from '../src/utils/boundarySchema.js';

function normalizeSql(value) {
    const text = Array.isArray(value?.queryChunks)
        ? value.queryChunks
            .map((chunk) => Array.isArray(chunk?.value) ? chunk.value.join('') : String(chunk || ''))
            .join('')
        : String(value || '');
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

test('runtime schema bootstrap includes phone identity table and active-only uniqueness', async () => {
    resetBoundarySchemaBootstrapForTests();
    const statements = [];
    const fakeDb = {
        execute(statement) {
            statements.push(normalizeSql(statement));
            return Promise.resolve();
        },
    };

    await ensureBoundarySchema(fakeDb, { NODE_ENV: 'development' });

    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists user_phone_identities')),
        'expected user_phone_identities table bootstrap SQL',
    );
    const activePhoneIndex = statements.find((statement) => (
        statement.includes('create unique index if not exists user_phone_identities_active_phone_unique')
    ));
    const activeUserIndex = statements.find((statement) => (
        statement.includes('create unique index if not exists user_phone_identities_active_user_unique')
    ));

    assert.ok(activePhoneIndex, 'expected active phone_e164 uniqueness SQL');
    assert.ok(activePhoneIndex.includes('on user_phone_identities (phone_e164)'));
    assert.ok(
        activePhoneIndex.includes('where revoked_at is null'),
        'revoked historical phone rows must not block a new active owner',
    );

    assert.ok(activeUserIndex, 'expected one active phone identity per user SQL');
    assert.ok(activeUserIndex.includes('on user_phone_identities (user_id)'));
    assert.ok(
        activeUserIndex.includes('where revoked_at is null'),
        'revoked historical user rows must not block a new active phone identity',
    );
});

test('runtime schema bootstrap includes pre-session phone login attempts table', async () => {
    resetBoundarySchemaBootstrapForTests();
    const statements = [];
    const fakeDb = {
        execute(statement) {
            statements.push(normalizeSql(statement));
            return Promise.resolve();
        },
    };

    await ensureBoundarySchema(fakeDb, { NODE_ENV: 'development' });

    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists phone_login_attempts')),
        'expected phone_login_attempts table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('create unique index if not exists phone_login_attempts_provider_challenge_unique')
            && statement.includes('where provider_challenge_id is not null')
        )),
        'expected provider challenge uniqueness SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create index if not exists phone_login_attempts_status_idx')),
        'expected phone login status index SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create index if not exists phone_login_attempts_requested_phone_idx')),
        'expected requested phone index SQL',
    );
});

test('runtime schema bootstrap includes partner organisation and staff bridge tables', async () => {
    resetBoundarySchemaBootstrapForTests();
    const statements = [];
    const fakeDb = {
        execute(statement) {
            statements.push(normalizeSql(statement));
            return Promise.resolve();
        },
    };

    await ensureBoundarySchema(fakeDb, { NODE_ENV: 'development' });

    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists partner_organizations')),
        'expected partner_organizations table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists partner_staff_memberships')),
        'expected partner_staff_memberships table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists partner_staff_events')),
        'expected partner_staff_events table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('create unique index if not exists partner_organizations_legacy_partner_unique')
            && statement.includes('legacy_partner_user_id')
            && statement.includes('where legacy_partner_user_id is not null')
        )),
        'expected one bridge organisation per legacy partner user',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('create unique index if not exists partner_staff_memberships_active_user_unique')
            && statement.includes('organization_id, user_id')
            && statement.includes('where revoked_at is null')
        )),
        'expected one active membership per user per organisation',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('insert into partner_organizations')
            && statement.includes("where u.role = 'partner'")
        )),
        'expected bootstrap backfill from existing partner users',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('insert into partner_staff_memberships')
            && statement.includes("'owner'")
            && statement.includes('legacy_partner_user_id')
        )),
        'expected bootstrap owner membership backfill for each legacy partner user',
    );
});
