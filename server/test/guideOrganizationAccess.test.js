import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';
import { loadGuideOrganizationAccess } from '../src/utils/guideOrganizationAccess.js';

test('Guide organisation access follows current memberships without reading organisation records', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'org-fixture', 'org@example.test', 'fixture-only', 'Organisation Fixture', 'standard'),
        (2, 'other-org-fixture', 'other-org@example.test', 'fixture-only', 'Other Organisation Fixture', 'standard');
        INSERT INTO partner_organizations (id, name) VALUES
        (50, 'Fictional organisation A'), (51, 'Fictional organisation B');
        INSERT INTO organization_access_memberships (organization_id, user_id, access_role) VALUES
        (50, 1, 'admin'), (51, 1, 'staff'), (51, 2, 'admin');`);
    const actor = { id: 1, role: 'standard' };
    assert.deepEqual(await loadGuideOrganizationAccess(actor, env),
        { platformAdmin: false, workspaceAdmin: true, workspaceView: true });
    assert.deepEqual(await loadGuideOrganizationAccess({ id: 2, role: 'standard' }, env),
        { platformAdmin: false, workspaceAdmin: true, workspaceView: true });
    assert.equal(statements.some((statement) => /\bFROM\s+"?partner_organizations"?/i.test(statement)), false);
    await pg.exec('UPDATE organization_access_memberships SET revoked_at = NOW() WHERE organization_id = 50 AND user_id = 1;');
    assert.deepEqual(await loadGuideOrganizationAccess(actor, env),
        { platformAdmin: false, workspaceAdmin: false, workspaceView: true });
    await pg.exec('UPDATE organization_access_memberships SET revoked_at = NOW() WHERE organization_id = 51 AND user_id = 1;');
    assert.deepEqual(await loadGuideOrganizationAccess(actor, env),
        { platformAdmin: false, workspaceAdmin: false, workspaceView: false });
    assert.deepEqual(await loadGuideOrganizationAccess({ id: 1, role: 'super_admin' }, env),
        { platformAdmin: true, workspaceAdmin: false, workspaceView: false });
});
