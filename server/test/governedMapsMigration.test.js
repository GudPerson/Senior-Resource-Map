import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('governed-map migration is additive and enforces lifecycle and provenance constraints', async () => {
    const pg = new PGlite();
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0009_governed_care_maps') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`
            INSERT INTO users (id, username, email, password_hash, name)
                VALUES (1, 'personal-owner', 'personal@example.test', 'fixture', 'Personal Owner'),
                       (2, 'pilot-admin', 'admin@pilot.example', 'fixture', 'Pilot Admin');
            INSERT INTO my_maps (id, user_id, name) VALUES (1, 1, 'Existing personal map');
            INSERT INTO partner_organizations (id, name, governance_status) VALUES (1, 'Pilot Organisation', 'active');
            INSERT INTO governance_groups (id, group_type, name, coordination_status)
                VALUES (1, 'region', 'Pilot Region', 'active');
        `);
        const personalBefore = (await pg.query('SELECT id, user_id, name FROM my_maps')).rows;

        await pg.exec(await readFile(new URL('../drizzle/0009_governed_care_maps.sql', import.meta.url), 'utf8'));
        assert.deepEqual((await pg.query('SELECT id, user_id, name FROM my_maps')).rows, personalBefore);

        await pg.exec(`
            INSERT INTO organization_domains (organization_id, domain, status, verified_at)
                VALUES (1, 'pilot.example', 'verified', now());
            INSERT INTO organization_agreements (
                organization_id, agreement_reference, status, allowed_uses
            ) VALUES (1, 'PILOT-1', 'active', '{"publicListing":true,"externalSharing":true}');
            INSERT INTO organization_asset_packs (
                organization_id, agreement_id, logo_url, banner_url, license_granted_at
            ) VALUES (1, 1, 'https://pilot.example/logo.png', 'https://pilot.example/banner.png', now());
            INSERT INTO governed_maps (id, region_group_id, name, created_by_user_id)
                VALUES (1, 1, 'Governed pilot map', 2);
            INSERT INTO governed_map_resources (
                map_id, resource_type, resource_id, organization_id_at_add, snapshot, added_by_user_id
            ) VALUES (1, 'hard', 10, 1, '{"name":"Pilot Place"}', 2);
            INSERT INTO governed_map_publications (
                map_id, share_token, snapshot, allowed_origins, published_by_user_id
            ) VALUES (1, 'opaque-pilot-token', '{"name":"Governed pilot map"}', '["https://pilot.example"]', 2);
        `);

        const invalidStatements = [
            ["UPDATE governed_maps SET lifecycle_status = 'deleted' WHERE id = 1", 'governed_maps_lifecycle_check'],
            ["UPDATE governed_maps SET revision = 0 WHERE id = 1", 'governed_maps_revision_check'],
            ["INSERT INTO governed_map_resources (map_id, resource_type, resource_id) VALUES (1, 'template', 11)", 'governed_map_resources_type_check'],
            ["UPDATE governed_map_publications SET allowed_origins = '{}' WHERE map_id = 1", 'governed_map_publications_origins_check'],
            ["INSERT INTO organization_domains (organization_id, domain) VALUES (1, 'PILOT.EXAMPLE')", 'organization_domains_normalized_unique'],
            ["INSERT INTO organization_onboarding_requests (organization_name, email_domain, applicant_name, applicant_email, logo_url, banner_url, terms_version, terms_accepted_at, digital_asset_use_granted) VALUES ('Invalid', 'invalid.example', 'Applicant', 'applicant@invalid.example', 'https://invalid.example/logo.png', 'https://invalid.example/banner.png', 'v1', now(), false)", 'organization_onboarding_requests_grant_check'],
        ];
        for (const [statement, constraint] of invalidStatements) {
            await assert.rejects(pg.exec(statement), (error) => error.message.includes(constraint));
        }

        await pg.exec('DELETE FROM users WHERE id = 2');
        const [map] = (await pg.query('SELECT created_by_user_id FROM governed_maps WHERE id = 1')).rows;
        assert.equal(map.created_by_user_id, null);
        assert.deepEqual((await pg.query('SELECT id, user_id, name FROM my_maps')).rows, personalBefore);
    } finally {
        await pg.close();
    }
});

