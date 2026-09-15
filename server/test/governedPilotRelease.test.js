import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {
    getGovernedPilotReleaseStage,
    isGovernedMapLifecycleEnabled,
    isGovernedMapsEnabled,
    isGovernedPilotEnabled,
    isOrganizationOnboardingEnabled,
    isResourceClaimsEnabled,
} from '../src/utils/governedPilotRelease.js';
import { runGovernedMapArchiveSweep } from '../src/worker.js';
import { createGovernedPilotFixture, pilotPassword } from './fixtures/governedPilotFixture.mjs';

test('pilot release stages require an exact opt-in and unlock capabilities in order', () => {
    for (const value of [undefined, false, true, 'false', 'TRUE', '1', '', 'future', 'ONBOARDING', 'onboarding ']) {
        const env = { GOVERNED_PILOT_RELEASE_STAGE: value };
        assert.equal(getGovernedPilotReleaseStage(env), 'off');
        assert.equal(isGovernedPilotEnabled(env), false);
    }
    assert.equal(getGovernedPilotReleaseStage({ GOVERNED_PILOT_ENABLED: 'true' }), 'off', 'legacy all-or-nothing flag cannot activate a stage');

    const expected = {
        off: [false, false, false, false],
        onboarding: [true, false, false, false],
        claims: [true, true, false, false],
        maps: [true, true, true, false],
        lifecycle: [true, true, true, true],
    };
    for (const [stage, values] of Object.entries(expected)) {
        const env = { GOVERNED_PILOT_RELEASE_STAGE: stage };
        assert.deepEqual([
            isOrganizationOnboardingEnabled(env),
            isResourceClaimsEnabled(env),
            isGovernedMapsEnabled(env),
            isGovernedMapLifecycleEnabled(env),
        ], values, stage);
    }
});

test('off stage blocks all pilot requests before database, authentication or body parsing', async () => {
    for (const [method, path] of [
        ['POST', '/organization-onboarding/requests'], ['POST', '/organization-onboarding/join'],
        ['POST', '/organization-onboarding/requests/1/approve'], ['GET', '/organization-onboarding/join-requests'],
        ['GET', '/governed-maps'], ['GET', '/governed-maps/public/example'],
        ['GET', '/governed-maps/public/example/embed'], ['GET', '/governed-maps/public/example/embed-config'],
        ['POST', '/governed-maps/1/publish'], ['POST', '/governed-maps/1/restore'], ['POST', '/governed-maps/archive-due'],
    ]) {
        const response = await app.request(`http://localhost/api${path}`, {
            method, headers: { host: 'localhost', origin: 'http://localhost' },
            ...(method === 'POST' ? { body: '{broken json' } : {}),
        }, { NODE_ENV: 'development', GOVERNED_PILOT_RELEASE_STAGE: 'off' });
        assert.equal(response.status, 503, `${method} ${path}`);
        assert.equal((await response.json()).code, 'governed_pilot_disabled');
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.deepEqual(await runGovernedMapArchiveSweep({ DATABASE_URL: 'must-not-connect' }), {
        enabled: false, scanned: 0, archived: 0, failed: 0,
    });
});

test('onboarding, maps and lifecycle routes remain isolated by release stage', async () => {
    const request = (path, stage, method = 'GET') => app.request(`http://localhost/api${path}`, {
        method,
        headers: { host: 'localhost', origin: 'http://localhost' },
    }, { NODE_ENV: 'development', GOVERNED_PILOT_RELEASE_STAGE: stage });

    for (const stage of ['onboarding', 'claims']) {
        assert.equal((await request('/organization-onboarding/requests', stage)).status, 401, `${stage} permits onboarding before auth`);
        const mapResponse = await request('/governed-maps', stage);
        assert.equal(mapResponse.status, 503, `${stage} keeps maps closed`);
        assert.equal((await mapResponse.json()).requiredStage, 'maps');
    }

    assert.equal((await request('/governed-maps', 'maps')).status, 401, 'maps stage reaches authentication');
    const lifecycleBlocked = await request('/governed-maps/1/retire', 'maps', 'POST');
    assert.equal(lifecycleBlocked.status, 503);
    assert.equal((await lifecycleBlocked.json()).requiredStage, 'lifecycle');
    assert.equal((await request('/governed-maps/1/retire', 'lifecycle', 'POST')).status, 401, 'lifecycle stage reaches authentication');

    assert.deepEqual(await runGovernedMapArchiveSweep({
        DATABASE_URL: 'must-not-connect',
        GOVERNED_PILOT_RELEASE_STAGE: 'maps',
    }), { enabled: false, scanned: 0, archived: 0, failed: 0 });
});

test('onboarding stage supports fictional organisation approval while map capabilities stay closed', async (t) => {
    const f = await createGovernedPilotFixture(t, {
        releaseStage: 'onboarding',
        defaultIp: '198.51.100.10',
    });
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM partner_organizations')).rows[0].n, 2);
    assert.equal((await f.pg.query("SELECT count(*)::int AS n FROM organization_domains WHERE status='verified'")).rows[0].n, 2);
    assert.equal((await f.pg.query("SELECT count(*)::int AS n FROM organization_access_memberships WHERE access_role='admin' AND revoked_at IS NULL")).rows[0].n, 2);

    await f.request('/organization-onboarding/requests', { cookie: f.admin.cookie });
    const [partner] = f.partners;
    await f.request(`/governance/organizations/${partner.orgId}/resource-candidates?type=hard&q=Fictional`, {
        cookie: partner.cookie,
        expected: 503,
    });
    await f.request(`/governance/organizations/${partner.orgId}/resources`, {
        method: 'POST',
        cookie: partner.cookie,
        body: { resourceType: 'hard', resourceId: partner.resourceId },
        expected: 503,
    });
    await f.request(`/governance/organizations/${partner.orgId}/agreements`, {
        method: 'POST',
        cookie: partner.cookie,
        body: { agreementReference: 'must-not-write' },
        expected: 503,
    });
    await f.request(`/governance/organizations/${partner.orgId}/resource-candidates?type=hard&q=Fictional`, {
        cookie: f.admin.cookie,
    });
    assert.equal((await f.pg.query("SELECT count(*)::int AS n FROM organization_agreements WHERE agreement_reference='must-not-write'")).rows[0].n, 0);
    await f.request('/governed-maps', { cookie: f.admin.cookie, expected: 503 });
    assert.deepEqual(await runGovernedMapArchiveSweep({
        DATABASE_URL: 'must-not-connect',
        GOVERNED_PILOT_RELEASE_STAGE: 'onboarding',
    }), { enabled: false, scanned: 0, archived: 0, failed: 0 });
});

test('disabled pilot preserves personal sharing and admin recovery while preventing alternate signup writes', async (t) => {
    const f = await createGovernedPilotFixture(t);
    const { request, pg, admin, partners: [a] } = f;
    await request('/favorites/toggle', { method: 'POST', cookie: a.cookie, body: { resourceType: 'hard', resourceId: a.resourceId } });
    const map = (await request('/my-maps', { method: 'POST', expected: 201, cookie: a.cookie,
        body: { name: 'Fictional existing personal map', assets: [{ resourceType: 'hard', resourceId: a.resourceId }] } })).data;
    const { shareToken } = (await request(`/my-maps/${map.id}/share`, { method: 'POST', cookie: a.cookie, body: {} })).data;
    f.env.GOVERNED_PILOT_RELEASE_STAGE = 'off';
    const settings = (await request('/platform-access')).data.settings;
    assert.equal(settings.governedPilotEnabled, false);
    assert.equal(settings.governedPilotStage, 'off');
    assert.equal(settings.organizationOnboardingEnabled, false);
    assert.equal(settings.resourceClaimsEnabled, false);
    assert.equal(settings.governedMapsEnabled, false);
    assert.equal(settings.governedMapLifecycleEnabled, false);
    await request('/governed-maps', { cookie: admin.cookie, expected: 503 });
    const count = async () => (await pg.query('SELECT count(*)::int AS n FROM organization_join_requests')).rows[0].n;
    const before = await count();
    const restricted = (await request('/platform-access', { method: 'PUT', cookie: admin.cookie, body: {
        publicDirectoryMode: 'authenticated', publicRegistrationMode: 'organization_only', publicLoginMode: 'organization_only',
        expectedRevision: settings.revision,
    } })).data.settings;
    await request('/auth/register', { method: 'POST', expected: 503, body: {
        email: 'new@pilot-a.example', name: 'Fictional blocked applicant', password: pilotPassword, termsAccepted: true,
    } });
    assert.equal(await count(), before);
    const closed = (await request('/platform-access', { method: 'PUT', cookie: admin.cookie, body: {
        publicDirectoryMode: 'closed', publicRegistrationMode: 'closed', publicLoginMode: 'closed',
        expectedRevision: restricted.revision,
    } })).data.settings;
    const recovery = await f.login('pilot-admin@carearound.test', { ip: '192.0.2.70' });
    assert.equal(recovery.data.user.role, 'super_admin');
    await f.login('pilot-public@carearound.test', { partner: false, expected: 403, ip: '192.0.2.71' });
    const shared = (await request(`/shared-maps/${shareToken}`)).data;
    assert.doesNotMatch(JSON.stringify(shared), /unapproved\.example/);
    await request('/my-maps', { cookie: recovery.cookie });
    await request('/platform-access', { method: 'PUT', cookie: recovery.cookie, body: {
        publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open', expectedRevision: closed.revision,
    } });
    await request(`/shared-maps/${shareToken}`);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM my_maps WHERE id=$1', [map.id])).rows[0].n, 1);
});
