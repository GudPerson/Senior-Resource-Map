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

test('runtime schema bootstrap includes My Map note columns', async () => {
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
        statements.some((statement) => (
            statement.includes('alter table my_maps add column if not exists share_includes_handoff_notes')
            && statement.includes('default false')
        )),
        'expected My Map share handoff-note toggle column bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('alter table my_map_assets add column if not exists private_note')),
        'expected private note column bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('alter table my_map_assets add column if not exists handoff_note')),
        'expected handoff note column bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('alter table my_map_assets add column if not exists notes_updated_at')),
        'expected note timestamp column bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists my_map_asset_notes')),
        'expected multi-note table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists my_map_share_snapshots')),
        'expected shared map snapshot table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('create unique index if not exists my_map_share_snapshots_map_unique')
            && statement.includes('map_id')
        )),
        'expected one active share snapshot per map',
    );
});

test('runtime schema bootstrap includes hard asset social links column', async () => {
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
        statements.some((statement) => (
            statement.includes('alter table hard_assets add column if not exists social_links')
            && statement.includes('jsonb')
            && statement.includes("default '{}'::jsonb")
        )),
        'expected hard asset social_links column bootstrap SQL',
    );
});

test('runtime schema bootstrap includes public WhatsApp contact columns', async () => {
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
        statements.some((statement) => statement.includes('alter table hard_assets add column if not exists whatsapp_contact')),
        'expected hard asset WhatsApp contact column bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('alter table soft_assets add column if not exists whatsapp_contact')),
        'expected soft asset WhatsApp contact column bootstrap SQL',
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

test('runtime schema bootstrap includes direct hard-asset staff memberships', async () => {
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
        statements.some((statement) => statement.includes('create table if not exists hard_asset_staff_memberships')),
        'expected hard_asset_staff_memberships table bootstrap SQL',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('create unique index if not exists hard_asset_staff_memberships_active_user_unique')
            && statement.includes('hard_asset_id, user_id')
            && statement.includes('where revoked_at is null')
        )),
        'expected one active hard-asset staff membership per user per hard asset',
    );
    assert.ok(
        statements.some((statement) => (
            statement.includes('create index if not exists hard_asset_staff_memberships_hard_asset_idx')
            && statement.includes('hard_asset_id')
        )),
        'expected hard asset staff lookup index',
    );
});

test('runtime schema bootstrap includes organisation governance link coverage status', async () => {
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
        statements.some((statement) => (
            statement.includes('create table if not exists organization_resource_links')
            && statement.includes('agreement_coverage_status')
        )),
        'expected organisation resource link coverage status in create table SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('alter table organization_resource_links add column if not exists agreement_coverage_status')),
        'expected organisation resource link coverage status additive SQL',
    );
    assert.ok(
        statements.some((statement) => statement.includes('create index if not exists organization_resource_links_coverage_status_idx')),
        'expected coverage status lookup index',
    );
});

test('runtime schema bootstrap includes governance group coordination tables', async () => {
    resetBoundarySchemaBootstrapForTests();
    const statements = [];
    const fakeDb = {
        execute(statement) {
            statements.push(normalizeSql(statement));
            return Promise.resolve();
        },
    };

    await ensureBoundarySchema(fakeDb, { NODE_ENV: 'development' });

    const combined = statements.join('\n');
    assert.match(combined, /create table if not exists governance_groups/i);
    assert.match(combined, /create table if not exists governance_group_memberships/i);
    assert.match(combined, /create table if not exists governance_group_organizations/i);
    assert.match(combined, /create table if not exists governance_group_resource_links/i);
    assert.match(combined, /governance_groups_type_idx/i);
    assert.match(combined, /governance_groups_organization_idx/i);
    assert.match(combined, /governance_groups_subregion_idx/i);
    assert.match(combined, /governance_groups_status_idx/i);
    assert.match(combined, /governance_group_memberships_active_user_unique/i);
    assert.match(combined, /governance_group_memberships_group_idx/i);
    assert.match(combined, /governance_group_memberships_user_idx/i);
    assert.match(combined, /governance_group_memberships_role_idx/i);
    assert.match(combined, /governance_group_organizations_active_unique/i);
    assert.match(combined, /governance_group_organizations_group_idx/i);
    assert.match(combined, /governance_group_organizations_organization_idx/i);
    assert.match(combined, /governance_group_resource_links_active_resource_unique/i);
    assert.match(combined, /governance_group_resource_links_group_idx/i);
    assert.match(combined, /governance_group_resource_links_resource_idx/i);
});
