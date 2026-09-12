import test from 'node:test';
import assert from 'node:assert/strict';

import { getDb } from '../src/db/index.js';
import {
    approveOrganizationOnboardingRequest,
    decideOrganizationJoinRequest,
    submitOrganizationJoinRequest,
    submitOrganizationOnboardingRequest,
} from '../src/utils/organizationOnboarding.js';
import { loadPlatformAccessSettings, updatePlatformAccessSettings } from '../src/utils/platformAccessStore.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

test('organisation onboarding, first admin approval and access-mode update use atomic Neon batches', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    const actorRow = (await pg.query(`
        INSERT INTO users (username, email, password_hash, name, role)
        VALUES ('pilot-super-admin', 'pilot-admin@carearound.test', 'not-a-password', 'Pilot Super Admin', 'super_admin')
        RETURNING id
    `)).rows[0];
    const actor = { id: actorRow.id, role: 'super_admin' };
    const db = getDb(env);

    const request = await submitOrganizationOnboardingRequest(db, {
        organizationName: 'Fictional Community Partner',
        emailDomain: 'fictional-partner.example',
        websiteUrl: 'https://fictional-partner.example',
        applicantName: 'Pilot Applicant',
        applicantEmail: 'applicant@fictional-partner.example',
        logoUrl: 'https://fictional-partner.example/assets/logo.png',
        bannerUrl: 'https://fictional-partner.example/assets/banner.png',
        termsAccepted: true,
        digitalAssetUseGranted: true,
    });
    const approval = await approveOrganizationOnboardingRequest(db, actor, request.id);

    assert.equal(approval.status, 'approved');
    const organizationRows = (await pg.query('SELECT * FROM partner_organizations WHERE id = $1', [approval.organizationId])).rows;
    const domainRows = (await pg.query('SELECT * FROM organization_domains WHERE organization_id = $1', [approval.organizationId])).rows;
    const agreementRows = (await pg.query('SELECT * FROM organization_agreements WHERE organization_id = $1', [approval.organizationId])).rows;
    const packRows = (await pg.query('SELECT * FROM organization_asset_packs WHERE organization_id = $1', [approval.organizationId])).rows;
    assert.equal(organizationRows.length, 1);
    assert.equal(domainRows[0].status, 'verified');
    assert.equal(agreementRows[0].status, 'active');
    assert.deepEqual(agreementRows[0].allowed_uses, {
        publicListing: true,
        externalSharing: true,
        notifications: true,
        aiAssistedEnrichment: false,
        aggregateAnalytics: false,
        restrictedFiles: false,
    });
    assert.equal(packRows[0].source, 'organization_supplied');
    assert.ok(packRows[0].license_granted_at);

    const join = await submitOrganizationJoinRequest(db, {
        email: 'first-admin@fictional-partner.example',
        name: 'First Organisation Admin',
        password: 'fictional-long-password-123',
        termsAccepted: true,
    });
    const decision = await decideOrganizationJoinRequest(db, actor, join.id, {
        approve: true,
        accessRole: 'admin',
    });
    assert.ok(decision.createdUserId);
    const membership = (await pg.query(
        'SELECT access_role FROM organization_access_memberships WHERE organization_id = $1 AND user_id = $2',
        [approval.organizationId, decision.createdUserId],
    )).rows[0];
    assert.equal(membership.access_role, 'admin');
    assert.equal((await pg.query('SELECT password_hash FROM organization_join_requests WHERE id = $1', [join.id])).rows[0].password_hash, 'consumed');

    const open = await loadPlatformAccessSettings(db);
    const restricted = await updatePlatformAccessSettings(db, actor, {
        publicDirectoryMode: 'authenticated',
        publicRegistrationMode: 'organization_only',
        publicLoginMode: 'organization_only',
    }, open.revision);
    assert.equal(restricted.publicDirectoryMode, 'authenticated');
    assert.equal(restricted.publicRegistrationMode, 'organization_only');
    assert.equal(restricted.publicLoginMode, 'organization_only');

    const auditActions = (await pg.query(`
        SELECT action_type FROM sensitive_audit_logs
        WHERE action_type IN (
            'organization_onboarding_approved',
            'organization_join_approved',
            'platform_access_settings_updated'
        )
        ORDER BY action_type
    `)).rows.map((row) => row.action_type);
    assert.deepEqual(auditActions, [
        'organization_join_approved',
        'organization_onboarding_approved',
        'platform_access_settings_updated',
    ]);
    assert.ok(statements.some((statement) => statement.includes('pg_advisory_xact_lock')));
});
