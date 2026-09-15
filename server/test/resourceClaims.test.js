import assert from 'node:assert/strict';
import test from 'node:test';
import { neonConfig } from '@neondatabase/serverless';

import app from '../src/app.js';
import { createGovernedPilotFixture } from './fixtures/governedPilotFixture.mjs';

const claimBody = (organizationId, resourceId, overrides = {}) => ({
    organizationId,
    resourceType: 'hard',
    resourceId,
    requestedFields: ['logoUrl', 'website', 'description'],
    requestedUses: { sharedMaps: true, embeds: false },
    evidenceNote: 'Official organisation administrator confirms this centre is operated by the organisation.',
    attestedOwnerAuthority: true,
    ...overrides,
});

async function insertPlace(pg, name) {
    return (await pg.query(`
        INSERT INTO hard_assets (
            name, sub_category, lat, lng, address, country, description,
            website, logo_url, banner_url, verification_status
        ) VALUES (
            $1, 'Active Ageing Centres', 1.3801, 103.7501,
            '88 Fictional Claim Road', 'SG', 'Owner supplied description',
            'https://owner.example/resource', 'https://owner.example/logo.png',
            'https://owner.example/banner.png', 'unverified'
        ) RETURNING id
    `, [name])).rows[0].id;
}

async function rawVerifyOwnerRequest(f, claim, ownerUserId) {
    return f.app.request(`http://localhost:5183/api/resource-claims/${claim.id}/verify-owner`, {
        method: 'POST',
        headers: {
            host: 'localhost:5183',
            origin: 'http://localhost:5183',
            'cf-connecting-ip': '198.51.100.52',
            'content-type': 'application/json',
            cookie: f.admin.cookie,
        },
        body: JSON.stringify({ ownerUserId, expectedRevision: claim.revision }),
    }, f.env, f.execution);
}

test('resource claim routes fail closed below the claims stage', async () => {
    for (const stage of ['off', 'onboarding']) {
        const response = await app.request('http://localhost/api/resource-claims', {
            headers: { host: 'localhost', origin: 'http://localhost' },
        }, { NODE_ENV: 'development', GOVERNED_PILOT_RELEASE_STAGE: stage });
        assert.equal(response.status, 503, stage);
        assert.equal((await response.json()).requiredStage, 'claims');
    }
});

test('claim verification assigns ownership and publication remains field and use specific', async (t) => {
    const f = await createGovernedPilotFixture(t, {
        releaseStage: 'claims',
        defaultIp: '198.51.100.31',
    });
    const [partnerA, partnerB] = f.partners;
    const resourceId = await insertPlace(f.pg, 'Fictional Claimed Centre');

    const initialCandidates = (await f.request(`/resource-claims/candidates?organizationId=${partnerA.orgId}&type=hard&q=Fictional%20Claimed`, {
        cookie: partnerA.cookie,
    })).data.candidates;
    assert.equal(initialCandidates.some((candidate) => Number(candidate.id) === Number(resourceId)), true);

    const submitted = (await f.request('/resource-claims', {
        method: 'POST',
        cookie: partnerA.cookie,
        expected: 201,
        body: claimBody(partnerA.orgId, resourceId),
    })).data.claim;
    assert.equal(submitted.status, 'claim_pending');
    assert.equal(submitted.permissions.displayStatus, 'claim_pending');
    assert.deepEqual(submitted.approvedFields, ['logoUrl', 'website', 'description']);

    await f.request('/resource-claims', {
        method: 'POST',
        cookie: partnerA.cookie,
        expected: 409,
        body: claimBody(partnerA.orgId, resourceId),
    });
    await f.request('/resource-claims', {
        method: 'POST',
        cookie: partnerB.cookie,
        expected: 409,
        body: claimBody(partnerB.orgId, resourceId),
    });
    const otherOrganizationCandidates = (await f.request(`/resource-claims/candidates?organizationId=${partnerB.orgId}&type=hard&q=Fictional%20Claimed`, {
        cookie: partnerB.cookie,
    })).data.candidates;
    assert.equal(otherOrganizationCandidates.some((candidate) => Number(candidate.id) === Number(resourceId)), false);

    await f.request(`/governance/organizations/${partnerA.orgId}/resource-candidates?type=hard`, {
        cookie: partnerA.cookie,
        expected: 403,
    });
    await f.request(`/governance/organizations/${partnerA.orgId}/resources`, {
        method: 'POST', cookie: partnerA.cookie, expected: 403, body: {},
    });
    await f.request(`/governance/organizations/${partnerA.orgId}/agreements`, {
        method: 'POST', cookie: partnerA.cookie, expected: 403, body: {},
    });

    const staffUserId = (await f.pg.query(`INSERT INTO users (username,email,password_hash,name,role,postal_code)
        SELECT 'pilot-staff-a','staff@pilot-a.example',password_hash,'Fictional Staff A','standard','680001'
        FROM users WHERE username='pilot-admin' RETURNING id`)).rows[0].id;
    await f.pg.query(`INSERT INTO organization_access_memberships (organization_id,user_id,access_role,created_by_user_id)
        VALUES ($1,$2,'staff',$3)`, [partnerA.orgId, staffUserId, partnerA.userId]);
    const staff = await f.login('staff@pilot-a.example');
    await f.request('/resource-claims', { cookie: staff.cookie, expected: 403 });

    const partnerBClaims = (await f.request('/resource-claims', { cookie: partnerB.cookie })).data.claims;
    assert.equal(partnerBClaims.some((claim) => claim.id === submitted.id), false);
    await f.request(`/resource-claims?organizationId=${partnerA.orgId}`, { cookie: partnerB.cookie, expected: 403 });

    const verified = (await f.request(`/resource-claims/${submitted.id}/verify-owner`, {
        method: 'POST',
        cookie: f.admin.cookie,
        body: { ownerUserId: partnerA.userId, expectedRevision: submitted.revision },
    })).data.claim;
    assert.equal(verified.status, 'owner_verified');
    assert.equal(verified.permissions.canApprovePublication, true);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM organization_resource_links
        WHERE organization_id=$1 AND resource_type='hard' AND resource_id=$2 AND unlinked_at IS NULL`, [partnerA.orgId, resourceId])).rows[0].n, 1);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM hard_asset_staff_memberships
        WHERE hard_asset_id=$1 AND user_id=$2 AND staff_role='owner' AND revoked_at IS NULL`, [resourceId, partnerA.userId])).rows[0].n, 1);
    assert.equal((await f.pg.query('SELECT verification_status FROM hard_assets WHERE id=$1', [resourceId])).rows[0].verification_status, 'owner_verified');

    const agreementA = (await f.pg.query(`SELECT id FROM organization_agreements
        WHERE organization_id=$1 AND status='active' AND revoked_at IS NULL ORDER BY id LIMIT 1`, [partnerA.orgId])).rows[0];
    const agreementB = (await f.pg.query(`SELECT id FROM organization_agreements
        WHERE organization_id=$1 AND status='active' AND revoked_at IS NULL ORDER BY id LIMIT 1`, [partnerB.orgId])).rows[0];
    await f.request(`/resource-claims/${submitted.id}/approve-publication`, {
        method: 'POST',
        cookie: f.admin.cookie,
        expected: 409,
        body: { agreementId: agreementB.id, approvedFields: ['logoUrl'], allowedUses: { sharedMaps: true }, expectedRevision: verified.revision },
    });
    await f.pg.exec("SET TIME ZONE 'Asia/Singapore'");
    await f.pg.query(`UPDATE organization_agreements
        SET effective_at = NULL, expires_at = CURRENT_TIMESTAMP - interval '1 hour'
        WHERE id = $1`, [agreementA.id]);
    await f.request(`/resource-claims/${submitted.id}/approve-publication`, {
        method: 'POST',
        cookie: f.admin.cookie,
        expected: 409,
        body: {
            agreementId: agreementA.id,
            approvedFields: ['logoUrl', 'website'],
            allowedUses: { sharedMaps: true, embeds: false },
            expectedRevision: verified.revision,
        },
    });
    assert.equal((await f.pg.query('SELECT status FROM resource_publication_permissions WHERE id=$1', [submitted.id])).rows[0].status, 'owner_verified');
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM sensitive_audit_logs
        WHERE action_type='resource_publication_approved' AND entity_id=$1`, [submitted.id])).rows[0].n, 0);
    await f.pg.query(`UPDATE organization_agreements
        SET effective_at = CURRENT_TIMESTAMP - interval '1 hour', expires_at = CURRENT_TIMESTAMP + interval '1 hour'
        WHERE id = $1`, [agreementA.id]);
    const approved = (await f.request(`/resource-claims/${submitted.id}/approve-publication`, {
        method: 'POST',
        cookie: f.admin.cookie,
        body: {
            agreementId: agreementA.id,
            approvedFields: ['logoUrl', 'website'],
            allowedUses: { sharedMaps: true, embeds: false },
            expectedRevision: verified.revision,
        },
    })).data.claim;
    assert.equal(approved.status, 'publishing_approved');
    assert.deepEqual(approved.approvedFields, ['logoUrl', 'website']);

    await f.request('/favorites/toggle', {
        method: 'POST', cookie: partnerA.cookie,
        body: { resourceType: 'hard', resourceId },
    });
    const map = (await f.request('/my-maps', {
        method: 'POST', cookie: partnerA.cookie, expected: 201,
        body: { name: 'Claim publication proof', assets: [{ resourceType: 'hard', resourceId }] },
    })).data;
    const shareToken = (await f.request(`/my-maps/${map.id}/share`, {
        method: 'POST', cookie: partnerA.cookie, body: {},
    })).data.shareToken;
    const shared = (await f.request(`/shared-maps/${shareToken}`)).data;
    assert.match(JSON.stringify(shared), /owner\.example\/logo\.png/);
    assert.match(JSON.stringify(shared), /owner\.example\/resource/);
    assert.doesNotMatch(JSON.stringify(shared), /Owner supplied description/);
    const storedUses = (await f.pg.query('SELECT allowed_uses FROM resource_publication_permissions WHERE id=$1', [submitted.id])).rows[0].allowed_uses;
    assert.deepEqual(storedUses, { sharedMaps: true, embeds: false });

    const withdrawn = (await f.request(`/resource-claims/${submitted.id}/withdraw`, {
        method: 'POST', cookie: partnerA.cookie,
        body: { reason: 'Organisation withdraws all public publication permission.', expectedRevision: approved.revision },
    })).data.claim;
    assert.equal(withdrawn.status, 'permission_withdrawn');
    assert.equal(withdrawn.permissions.displayStatus, 'permission_withdrawn');
    const redactedAgain = (await f.request(`/shared-maps/${shareToken}`)).data;
    assert.doesNotMatch(JSON.stringify(redactedAgain), /owner\.example/);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM hard_asset_staff_memberships
        WHERE hard_asset_id=$1 AND user_id=$2 AND staff_role='owner' AND revoked_at IS NULL`, [resourceId, partnerA.userId])).rows[0].n, 1, 'permission withdrawal does not erase operational ownership');
    const resubmitted = (await f.request(`/resource-claims/${submitted.id}/resubmit`, {
        method: 'POST', cookie: partnerA.cookie,
        body: {
            ...claimBody(partnerA.orgId, resourceId),
            evidenceNote: 'Updated official evidence renews the provider publication request.',
            expectedRevision: withdrawn.revision,
        },
    })).data.claim;
    assert.equal(resubmitted.status, 'claim_pending', 'the retained same-organisation link does not block resubmission');
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM organization_resource_links
        WHERE organization_id=$1 AND resource_type='hard' AND resource_id=$2 AND unlinked_at IS NULL`, [partnerA.orgId, resourceId])).rows[0].n, 1);
});

test('rejection stays reviewable and an organisation can resubmit or withdraw', async (t) => {
    const f = await createGovernedPilotFixture(t, { releaseStage: 'claims', defaultIp: '198.51.100.41' });
    const [partnerA] = f.partners;
    const resourceId = await insertPlace(f.pg, 'Fictional Rejected Centre');
    const submitted = (await f.request('/resource-claims', {
        method: 'POST', cookie: partnerA.cookie, expected: 201,
        body: claimBody(partnerA.orgId, resourceId),
    })).data.claim;
    const rejected = (await f.request(`/resource-claims/${submitted.id}/reject`, {
        method: 'POST', cookie: f.admin.cookie,
        body: { reason: 'The submitted evidence does not establish operator authority.', expectedRevision: submitted.revision },
    })).data.claim;
    assert.equal(rejected.status, 'permission_withdrawn');
    assert.equal(rejected.permissions.displayStatus, 'claim_rejected');
    assert.match(rejected.withdrawalReason, /does not establish/);

    const staleResubmission = await f.request(`/resource-claims/${submitted.id}/resubmit`, {
        method: 'POST', cookie: partnerA.cookie, expected: 409,
        body: {
            ...claimBody(partnerA.orgId, resourceId),
            evidenceNote: 'This stale request must not create a resubmission audit event.',
            expectedRevision: rejected.revision - 1,
        },
    });
    assert.match(staleResubmission.data.error, /claim changed/);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM sensitive_audit_logs
        WHERE entity_type='resource_publication_permission' AND entity_id=$1
          AND action_type='resource_claim_resubmitted'`, [submitted.id])).rows[0].n, 0);

    const resubmitted = (await f.request(`/resource-claims/${submitted.id}/resubmit`, {
        method: 'POST', cookie: partnerA.cookie,
        body: {
            ...claimBody(partnerA.orgId, resourceId),
            evidenceNote: 'Updated official evidence confirms operator authority for this fictional centre.',
            expectedRevision: rejected.revision,
        },
    })).data.claim;
    assert.equal(resubmitted.status, 'claim_pending');
    assert.equal(resubmitted.withdrawalReason, null);
    const withdrawn = (await f.request(`/resource-claims/${submitted.id}/withdraw`, {
        method: 'POST', cookie: partnerA.cookie,
        body: { reason: 'Organisation pauses this claim while evidence is refreshed.', expectedRevision: resubmitted.revision },
    })).data.claim;
    assert.equal(withdrawn.permissions.displayStatus, 'permission_withdrawn');
    const auditActions = (await f.pg.query(`SELECT action_type FROM sensitive_audit_logs
        WHERE entity_type='resource_publication_permission' AND entity_id=$1 ORDER BY id`, [submitted.id])).rows.map((row) => row.action_type);
    assert.deepEqual(auditActions, [
        'resource_claim_submitted',
        'resource_claim_rejected',
        'resource_claim_resubmitted',
        'resource_publication_withdrawn',
    ]);
});

test('withdrawn claims cannot be resubmitted after another organisation claims or links the resource', async (t) => {
    const f = await createGovernedPilotFixture(t, { releaseStage: 'claims', defaultIp: '198.51.100.51' });
    const [partnerA, partnerB] = f.partners;

    for (const conflict of ['claim', 'link']) {
        const resourceId = await insertPlace(f.pg, `Fictional Resubmission ${conflict} Conflict Centre`);
        const submitted = (await f.request('/resource-claims', {
            method: 'POST', cookie: partnerA.cookie, expected: 201,
            body: claimBody(partnerA.orgId, resourceId),
        })).data.claim;
        const rejected = (await f.request(`/resource-claims/${submitted.id}/reject`, {
            method: 'POST', cookie: f.admin.cookie,
            body: { reason: 'The first organisation must provide stronger fictional evidence.', expectedRevision: submitted.revision },
        })).data.claim;

        if (conflict === 'claim') {
            await f.request('/resource-claims', {
                method: 'POST', cookie: partnerB.cookie, expected: 201,
                body: claimBody(partnerB.orgId, resourceId),
            });
        } else {
            await f.pg.query(`INSERT INTO organization_resource_links
                (organization_id,resource_type,resource_id,link_status,agreement_coverage_status,linked_by_user_id)
                VALUES ($1,'hard',$2,'active','unknown',$3)`, [partnerB.orgId, resourceId, f.admin.data.user.id]);
        }

        const blocked = await f.request(`/resource-claims/${submitted.id}/resubmit`, {
            method: 'POST', cookie: partnerA.cookie, expected: 409,
            body: {
                ...claimBody(partnerA.orgId, resourceId),
                evidenceNote: 'Updated evidence must not override another organisation boundary.',
                expectedRevision: rejected.revision,
            },
        });
        assert.match(blocked.data.error, /resource availability changed/);
        const stored = (await f.pg.query(`SELECT status FROM resource_publication_permissions WHERE id=$1`, [submitted.id])).rows[0];
        assert.equal(stored.status, 'permission_withdrawn');
        assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM sensitive_audit_logs
            WHERE entity_type='resource_publication_permission' AND entity_id=$1
              AND action_type='resource_claim_resubmitted'`, [submitted.id])).rows[0].n, 0);
    }
});

test('concurrent cross-organisation owner verification creates only one active link', async (t) => {
    const f = await createGovernedPilotFixture(t, { releaseStage: 'claims', defaultIp: '198.51.100.52' });
    const [partnerA, partnerB] = f.partners;
    const resourceId = await insertPlace(f.pg, 'Fictional Concurrent Verification Centre');
    const pendingClaims = [];
    for (const partner of [partnerA, partnerB]) {
        pendingClaims.push((await f.pg.query(`INSERT INTO resource_publication_permissions
            (organization_id,resource_type,resource_id,status,approved_fields,allowed_uses,
             provenance_note,terms_version,requested_by_user_id)
            VALUES ($1,'hard',$2,'claim_pending',$3::jsonb,$4::jsonb,$5,'pilot-v1',$6)
            RETURNING id,revision`, [
            partner.orgId,
            resourceId,
            JSON.stringify(['logoUrl']),
            JSON.stringify({ sharedMaps: true, embeds: false }),
            'Fictional pre-existing duplicate claim for concurrency validation.',
            partner.userId,
        ])).rows[0]);
    }

    const originalFetch = neonConfig.fetchFunction;
    let conflictingReads = 0;
    let releaseReads;
    let rejectReads;
    const bothReadsReady = new Promise((resolve, reject) => {
        releaseReads = resolve;
        rejectReads = reject;
    });
    const barrierTimeout = setTimeout(() => rejectReads(new Error('Verification conflict-read barrier timed out.')), 5000);
    neonConfig.fetchFunction = async (url, options) => {
        const payload = JSON.parse(options.body);
        const query = Array.isArray(payload.queries) ? '' : String(payload.query || '');
        const isConflictingLinkRead = query.includes('organization_resource_links')
            && query.includes('"organization_resource_links"."organization_id" <>');
        if (isConflictingLinkRead) {
            conflictingReads += 1;
            if (conflictingReads === 2) {
                clearTimeout(barrierTimeout);
                releaseReads();
            }
            await bothReadsReady;
        }
        return originalFetch(url, options);
    };

    let responses;
    try {
        responses = await Promise.all([
            rawVerifyOwnerRequest(f, pendingClaims[0], partnerA.userId),
            rawVerifyOwnerRequest(f, pendingClaims[1], partnerB.userId),
        ]);
    } finally {
        clearTimeout(barrierTimeout);
        neonConfig.fetchFunction = originalFetch;
    }

    assert.deepEqual(responses.map((response) => response.status).sort((a, b) => a - b), [200, 409]);
    const rejectedResponse = responses.find((response) => response.status === 409);
    assert.match((await rejectedResponse.json()).error, /resource ownership changed/);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM organization_resource_links
        WHERE resource_type='hard' AND resource_id=$1 AND unlinked_at IS NULL`, [resourceId])).rows[0].n, 1);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM hard_asset_staff_memberships
        WHERE hard_asset_id=$1 AND staff_role='owner' AND revoked_at IS NULL`, [resourceId])).rows[0].n, 1);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM resource_publication_permissions
        WHERE resource_type='hard' AND resource_id=$1 AND status='owner_verified'`, [resourceId])).rows[0].n, 1);
    assert.equal((await f.pg.query(`SELECT count(*)::int AS n FROM sensitive_audit_logs
        WHERE action_type='resource_claim_owner_verified' AND resource_type='hard' AND resource_id=$1`, [resourceId])).rows[0].n, 1);
});
