import test from 'node:test';
import assert from 'node:assert/strict';

import { getDb } from '../src/db/index.js';
import {
    addGovernedMapResource,
    archiveDueGovernedMaps,
    createGovernedMap,
    getGovernedMap,
    getPublishedGovernedMap,
    loadRegionCandidateResources,
    publishGovernedMap,
    requestGovernedMapRetirement,
    restoreGovernedMap,
    withdrawGovernedMapResource,
} from '../src/utils/governedMaps.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

async function insertReturningId(pg, statement) {
    return (await pg.query(statement)).rows[0].id;
}

test('Governed Care Map lifecycle follows current resources and preserves personal My Maps', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    const johnId = await insertReturningId(pg, `
        INSERT INTO users (username, email, password_hash, name, role)
        VALUES ('governed-john', 'john@orga.example', 'not-a-password', 'John', 'standard')
        RETURNING id
    `);
    const aliceId = await insertReturningId(pg, `
        INSERT INTO users (username, email, password_hash, name, role)
        VALUES ('governed-alice', 'alice@orgb.example', 'not-a-password', 'Alice', 'standard')
        RETURNING id
    `);
    const superId = await insertReturningId(pg, `
        INSERT INTO users (username, email, password_hash, name, role)
        VALUES ('governed-super', 'super@carearound.test', 'not-a-password', 'Super Admin', 'super_admin')
        RETURNING id
    `);
    const legacyStaffId = await insertReturningId(pg, `
        INSERT INTO users (username, email, password_hash, name, role)
        VALUES ('governed-legacy', 'legacy@orga.example', 'not-a-password', 'Legacy Staff', 'standard')
        RETURNING id
    `);
    const orgAId = await insertReturningId(pg, `INSERT INTO partner_organizations (name, governance_status) VALUES ('Fictional Org A', 'active') RETURNING id`);
    const orgBId = await insertReturningId(pg, `INSERT INTO partner_organizations (name, governance_status) VALUES ('Fictional Org B', 'active') RETURNING id`);
    const resourceAId = await insertReturningId(pg, `
        INSERT INTO hard_assets (name, sub_category, lat, lng, address, country, postal_code, phone, description, website, logo_url)
        VALUES ('Fictional Centre A', 'Active Ageing Centres', 1.3800000, 103.7500000, '1 Fictional Road', 'SG', '680001', '61230001', 'Owner supplied A', 'https://orga.example/a', 'https://orga.example/a.png')
        RETURNING id
    `);
    const resourceBId = await insertReturningId(pg, `
        INSERT INTO hard_assets (name, sub_category, lat, lng, address, country, postal_code, phone, description, website, logo_url)
        VALUES ('Fictional Centre B', 'Active Ageing Centres', 1.3900000, 103.7600000, '2 Fictional Road', 'SG', '680002', '61230002', 'Owner supplied B', 'https://orgb.example/b', 'https://orgb.example/b.png')
        RETURNING id
    `);
    const groupId = await insertReturningId(pg, `INSERT INTO governance_groups (group_type, name) VALUES ('region', 'Fictional ICCP Sub-region') RETURNING id`);
    const agreementAId = await insertReturningId(pg, `
        INSERT INTO organization_agreements (organization_id, agreement_reference, agreement_type, status, effective_at, approved_at, allowed_uses)
        VALUES (${orgAId}, 'AGR-A', 'content_and_digital_assets', 'active', now() - interval '1 minute', now(), '{"publicListing":true,"externalSharing":true,"notifications":true}'::jsonb)
        RETURNING id
    `);
    const agreementBId = await insertReturningId(pg, `
        INSERT INTO organization_agreements (organization_id, agreement_reference, agreement_type, status, effective_at, approved_at, allowed_uses)
        VALUES (${orgBId}, 'AGR-B', 'content_and_digital_assets', 'active', now() - interval '1 minute', now(), '{"publicListing":true,"externalSharing":true,"notifications":true}'::jsonb)
        RETURNING id
    `);
    await pg.exec(`
        INSERT INTO organization_access_memberships (organization_id, user_id, access_role) VALUES
            (${orgAId}, ${johnId}, 'admin'),
            (${orgBId}, ${aliceId}, 'admin');
        INSERT INTO partner_staff_memberships (organization_id, user_id, staff_role)
            VALUES (${orgAId}, ${legacyStaffId}, 'editor');
        INSERT INTO organization_resource_links (organization_id, resource_type, resource_id, link_status, agreement_coverage_status) VALUES
            (${orgAId}, 'hard', ${resourceAId}, 'active', 'covered'),
            (${orgBId}, 'hard', ${resourceBId}, 'active', 'covered');
        INSERT INTO governance_group_organizations (group_id, organization_id) VALUES
            (${groupId}, ${orgAId}),
            (${groupId}, ${orgBId});
        INSERT INTO resource_publication_permissions
            (organization_id, agreement_id, resource_type, resource_id, status, approved_fields, allowed_uses,
             terms_version, requested_by_user_id, reviewed_by_user_id, approved_at)
        VALUES
            (${orgAId}, ${agreementAId}, 'hard', ${resourceAId}, 'publishing_approved',
             '["logoUrl","description","website"]'::jsonb, '{"sharedMaps":true,"embeds":true}'::jsonb,
             'pilot-v1', ${johnId}, ${superId}, now()),
            (${orgBId}, ${agreementBId}, 'hard', ${resourceBId}, 'publishing_approved',
             '["logoUrl","description","website"]'::jsonb, '{"sharedMaps":true,"embeds":true}'::jsonb,
             'pilot-v1', ${aliceId}, ${superId}, now());
        INSERT INTO my_maps (user_id, name) VALUES (${johnId}, 'Existing personal care map');
    `);

    const john = { id: johnId, role: 'standard', organizationAccess: [{ organizationId: orgAId, accessRole: 'admin' }] };
    const alice = { id: aliceId, role: 'standard', organizationAccess: [{ organizationId: orgBId, accessRole: 'admin' }] };
    const superAdmin = { id: superId, role: 'super_admin' };
    const db = getDb(env);
    const regionCandidates = await loadRegionCandidateResources(db, groupId);
    assert.deepEqual(
        regionCandidates.candidates.map((resource) => resource.resourceId).sort((a, b) => a - b),
        [resourceAId, resourceBId],
        'Every provider-approved resource in the region should be available without a manual map-resource link.',
    );

    let map = await createGovernedMap(db, john, {
        regionGroupId: groupId,
        name: 'Fictional ICCP Care Map',
        description: 'A disposable pilot map.',
    });
    map = await addGovernedMapResource(db, john, map.id, { resourceType: 'hard', resourceId: resourceAId });
    map = await addGovernedMapResource(db, john, map.id, { resourceType: 'hard', resourceId: resourceBId });
    map = await publishGovernedMap(db, john, map.id, { allowedOrigins: ['https://partner.example.org'] });
    assert.equal(map.lifecycleStatus, 'published');
    assert.equal(map.resources.length, 2);
    assert.deepEqual(map.publication.allowedOrigins, ['https://partner.example.org']);

    const publication = await getPublishedGovernedMap(db, map.publication.shareToken);
    assert.equal(publication.snapshot.governedMap, true);
    assert.equal(publication.snapshot.summary.resourceCount, 2);
    assert.equal(publication.snapshot.viewer.canSaveCopy, false);
    assert.equal(publication.snapshot.places[0].rows[0].detailPath, null);
    const publicationText = JSON.stringify(publication.snapshot);
    assert.match(publicationText, /orga\.example\/a\.png/);
    assert.match(publicationText, /orgb\.example\/b\.png/);

    await pg.exec(`UPDATE resource_publication_permissions
        SET allowed_uses='{"sharedMaps":true,"embeds":false}'::jsonb
        WHERE resource_type='hard' AND resource_id=${resourceBId}`);
    const sharedAfterEmbedWithdrawal = await getPublishedGovernedMap(db, map.publication.shareToken, 'sharedMaps');
    const embedAfterEmbedWithdrawal = await getPublishedGovernedMap(db, map.publication.shareToken, 'embeds');
    assert.match(JSON.stringify(sharedAfterEmbedWithdrawal.snapshot), /orgb\.example\/b\.png/);
    assert.doesNotMatch(JSON.stringify(embedAfterEmbedWithdrawal.snapshot), /orgb\.example/);
    await assert.rejects(
        () => publishGovernedMap(db, alice, map.id, { allowedOrigins: ['https://partner.example.org'] }),
        (error) => error.status === 409 && error.code === 'governed_map_permission_required',
    );
    await pg.exec(`UPDATE resource_publication_permissions
        SET allowed_uses='{"sharedMaps":true,"embeds":true}'::jsonb
        WHERE resource_type='hard' AND resource_id=${resourceBId}`);

    map = await requestGovernedMapRetirement(db, alice, map.id, { reason: 'Partner review is required before continued publication.' });
    assert.equal(map.lifecycleStatus, 'retirement_pending');
    await assert.rejects(() => getPublishedGovernedMap(db, map.publication.shareToken), (error) => error.status === 404);
    map = await restoreGovernedMap(db, john, map.id, { reason: 'All participating partners approved restoring the pilot.' });
    assert.equal(map.lifecycleStatus, 'published');

    await pg.exec(`UPDATE resource_publication_permissions
        SET status='permission_withdrawn', withdrawn_at=now(), withdrawal_reason='Owner withdrew public content permission.'
        WHERE resource_type='hard' AND resource_id=${resourceBId}`);
    const shareAfterPermissionWithdrawal = await getPublishedGovernedMap(db, map.publication.shareToken, 'sharedMaps');
    const withdrawnText = JSON.stringify(shareAfterPermissionWithdrawal.snapshot);
    assert.doesNotMatch(withdrawnText, /orgb\.example/);
    assert.match(withdrawnText, /Fictional Centre B/);

    await assert.rejects(
        () => withdrawGovernedMapResource(db, alice, map.id, {
            resourceType: 'hard', resourceId: resourceAId, reason: 'Alice cannot remove another organisation resource.',
        }),
        (error) => error.status === 403,
    );
    map = await withdrawGovernedMapResource(db, alice, map.id, {
        resourceType: 'hard', resourceId: resourceBId, reason: 'Organisation B requested immediate withdrawal from this map.',
    });
    assert.equal(map.resources.length, 1);
    assert.equal((await getPublishedGovernedMap(db, map.publication.shareToken)).snapshot.summary.resourceCount, 1);

    await pg.exec(`UPDATE organization_access_memberships SET revoked_at = now() WHERE organization_id = ${orgAId} AND user_id = ${johnId}`);
    await assert.rejects(
        () => getGovernedMap(db, { id: johnId, role: 'standard', organizationAccess: [] }, map.id),
        (error) => error.status === 403,
    );

    map = await requestGovernedMapRetirement(db, superAdmin, map.id, { reason: 'Pilot archival window started after the final partner review.' });
    await pg.exec(`UPDATE governed_maps SET retirement_eligible_at = now() - interval '1 minute' WHERE id = ${map.id}`);
    const archive = await archiveDueGovernedMaps(db, new Date());
    assert.deepEqual(archive, { scanned: 1, archived: 1, failed: 0 });
    await assert.rejects(() => getPublishedGovernedMap(db, map.publication.shareToken), (error) => error.status === 404);

    assert.equal((await pg.query(`SELECT count(*)::int AS count FROM my_maps WHERE name = 'Existing personal care map'`)).rows[0].count, 1);
    assert.equal((await pg.query(`SELECT count(*)::int AS count FROM governed_map_events WHERE map_id = ${map.id}`)).rows[0].count, 9);
    assert.ok((await pg.query(`SELECT count(*)::int AS count FROM governed_map_notifications WHERE map_id = ${map.id}`)).rows[0].count > 0);
    assert.equal((await pg.query(`SELECT count(*)::int AS count FROM governed_map_notifications WHERE map_id = ${map.id} AND user_id = ${legacyStaffId}`)).rows[0].count, 0);
    assert.equal((await pg.query(`SELECT count(*)::int AS count FROM sensitive_audit_logs WHERE entity_type = 'governed_map' AND entity_id = ${map.id}`)).rows[0].count, 9);
    assert.ok(statements.some((statement) => statement.includes('pg_advisory_xact_lock')));
});
