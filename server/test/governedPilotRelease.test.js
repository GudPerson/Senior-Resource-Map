import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { isGovernedPilotEnabled } from '../src/utils/governedPilotRelease.js';
import { runGovernedMapArchiveSweep } from '../src/worker.js';
import { createGovernedPilotFixture, pilotPassword } from './fixtures/governedPilotFixture.mjs';

test('pilot gate requires explicit deployment opt-in and blocks requests before database or body parsing', async () => {
    for (const value of [undefined, false, true, 'false', 'TRUE', '1', '']) {
        assert.equal(isGovernedPilotEnabled({ GOVERNED_PILOT_ENABLED: value }), false);
    }
    assert.equal(isGovernedPilotEnabled({ GOVERNED_PILOT_ENABLED: 'true' }), true);
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
        }, { NODE_ENV: 'development' });
        assert.equal(response.status, 503, `${method} ${path}`);
        assert.equal((await response.json()).code, 'governed_pilot_disabled');
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.deepEqual(await runGovernedMapArchiveSweep({ DATABASE_URL: 'must-not-connect' }), {
        enabled: false, scanned: 0, archived: 0, failed: 0,
    });
});

test('disabled pilot preserves personal sharing and admin recovery while preventing alternate signup writes', async (t) => {
    const f = await createGovernedPilotFixture(t);
    const { request, pg, admin, partners: [a] } = f;
    await request('/favorites/toggle', { method: 'POST', cookie: a.cookie, body: { resourceType: 'hard', resourceId: a.resourceId } });
    const map = (await request('/my-maps', { method: 'POST', expected: 201, cookie: a.cookie,
        body: { name: 'Fictional existing personal map', assets: [{ resourceType: 'hard', resourceId: a.resourceId }] } })).data;
    const { shareToken } = (await request(`/my-maps/${map.id}/share`, { method: 'POST', cookie: a.cookie, body: {} })).data;
    f.env.GOVERNED_PILOT_ENABLED = 'false';
    const settings = (await request('/platform-access')).data.settings;
    assert.equal(settings.governedPilotEnabled, false);
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
