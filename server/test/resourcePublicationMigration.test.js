import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('resource-publication migration is additive and enforces claim and approval provenance', async () => {
    const pg = new PGlite();
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0010_permission_first_publishing') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`
            INSERT INTO users (id, username, email, password_hash, name)
                VALUES (1, 'owner', 'owner@example.test', 'fixture', 'Resource Owner');
            INSERT INTO hard_assets (id, name, sub_category, lat, lng, address)
                VALUES (10, 'Existing reference', 'Community Support', 1.3, 103.8, '10 Example Street');
            INSERT INTO partner_organizations (id, name, governance_status)
                VALUES (1, 'Example Organisation', 'active');
            INSERT INTO organization_agreements (
                id, organization_id, agreement_reference, status, allowed_uses, approved_at
            ) VALUES (1, 1, 'OWNER-TERMS-1', 'active', '{"publicListing":true,"externalSharing":true}', now());
            INSERT INTO organization_resource_links (
                organization_id, resource_type, resource_id, link_status
            ) VALUES (1, 'hard', 10, 'active');
        `);
        const resourceBefore = (await pg.query('SELECT id, name FROM hard_assets WHERE id = 10')).rows;

        await pg.exec(await readFile(new URL('../drizzle/0010_permission_first_publishing.sql', import.meta.url), 'utf8'));
        assert.deepEqual((await pg.query('SELECT id, name FROM hard_assets WHERE id = 10')).rows, resourceBefore);
        assert.equal((await pg.query('SELECT count(*)::int AS count FROM resource_publication_permissions')).rows[0].count, 0);

        await pg.exec(`
            INSERT INTO resource_publication_permissions (
                organization_id, resource_type, resource_id, status, requested_by_user_id
            ) VALUES (1, 'hard', 10, 'claim_pending', 1)
        `);

        const invalidStatements = [
            ["UPDATE resource_publication_permissions SET resource_type = 'template'", 'resource_publication_permissions_type_check'],
            ["UPDATE resource_publication_permissions SET status = 'published'", 'resource_publication_permissions_status_check'],
            ["UPDATE resource_publication_permissions SET approved_fields = '[\"phone\"]'", 'resource_publication_permissions_fields_check'],
            ["UPDATE resource_publication_permissions SET allowed_uses = '[]'", 'resource_publication_permissions_uses_check'],
            ['UPDATE resource_publication_permissions SET revision = 0', 'resource_publication_permissions_revision_check'],
            ["UPDATE resource_publication_permissions SET status = 'publishing_approved'", 'resource_publication_permissions_approval_state_check'],
            ["UPDATE resource_publication_permissions SET status = 'permission_withdrawn'", 'resource_publication_permissions_withdrawal_state_check'],
        ];
        for (const [statement, constraint] of invalidStatements) {
            await assert.rejects(pg.exec(statement), (error) => error.message.includes(constraint));
        }

        await pg.exec(`
            UPDATE resource_publication_permissions SET
                agreement_id = 1,
                status = 'publishing_approved',
                approved_fields = '["logoUrl", "website"]',
                allowed_uses = '{"sharedMaps":true,"embeds":false}',
                terms_version = 'owner-terms-v1',
                requested_by_user_id = 1,
                reviewed_by_user_id = 1,
                approved_at = now(),
                revision = 2
        `);
        const [approved] = (await pg.query(`
            SELECT status, approved_fields, allowed_uses, revision
            FROM resource_publication_permissions
        `)).rows;
        assert.equal(approved.status, 'publishing_approved');
        assert.deepEqual(approved.approved_fields, ['logoUrl', 'website']);
        assert.deepEqual(approved.allowed_uses, { sharedMaps: true, embeds: false });
        assert.equal(approved.revision, 2);

        await assert.rejects(
            pg.exec(`
                INSERT INTO resource_publication_permissions (
                    organization_id, resource_type, resource_id, status
                ) VALUES (1, 'hard', 10, 'claim_pending')
            `),
            (error) => error.message.includes('resource_publication_permissions_org_resource_unique'),
        );
    } finally {
        await pg.close();
    }
});
