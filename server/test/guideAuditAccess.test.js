import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';
import { loadGuideAuditAccess } from '../src/utils/guideAuditAccess.js';

test('Guide Audit Trail access follows live organisation-admin memberships without reading logs', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'audit-fixture', 'audit@example.test', 'fixture-only', 'Audit Fixture', 'standard'),
        (2, 'other-audit-fixture', 'other-audit@example.test', 'fixture-only', 'Other Audit Fixture', 'standard');
        INSERT INTO partner_organizations (id, name) VALUES
        (50, 'Fictional organisation A'), (51, 'Fictional organisation B');
        INSERT INTO organization_access_memberships (organization_id, user_id, access_role) VALUES
        (50, 1, 'admin'), (51, 1, 'staff'), (51, 2, 'admin');`);
    const actor = { id: 1, role: 'standard' };
    assert.deepEqual(await loadGuideAuditAccess(actor, env), { mode: 'organizations', organizationIds: [50] });
    assert.equal(statements.some((statement) => /\bFROM\s+"?sensitive_audit_logs"?/i.test(statement)), false);
    await pg.exec('UPDATE organization_access_memberships SET revoked_at = NOW() WHERE organization_id = 50 AND user_id = 1;');
    assert.deepEqual(await loadGuideAuditAccess(actor, env), { mode: 'none', organizationIds: [] });
    assert.deepEqual(await loadGuideAuditAccess({ id: 1, role: 'super_admin' }, env),
        { mode: 'all', organizationIds: [] });
});
