import test from 'node:test';
import assert from 'node:assert/strict';
import { createGovernedPilotFixture, pilotPassword } from './fixtures/governedPilotFixture.mjs';
import { getDb } from '../src/db/index.js';
import { archiveDueGovernedMaps } from '../src/utils/governedMaps.js';
import { buildEmbeddedMapResponse } from '../../client/functions/embed/governed-maps/[token].js';

test('staged fictional pilot through the full HTTP application and Pages embed boundary', async (t) => {
    const f = await createGovernedPilotFixture(t);
    const { request, pg, admin, partners: [a, b] } = f;
    const phases = [];
    async function phase(name, action) { await t.test(name, action); phases.push(name); }
    let map, token, personal, personalToken, replacement;
    const getMap = async (cookie = b.cookie) => (await request(`/governed-maps/${map.id}`, { cookie })).data.map;
    const publicPath = () => `/governed-maps/public/${token}`;
    const embedResponse = async () => buildEmbeddedMapResponse({
        params: { token }, request: new Request(`https://app.fixture.example/embed/governed-maps/${token}`),
        env: { CAREAROUND_EMBED_API_BASE_URL: 'http://localhost:5183/api',
            ASSETS: { fetch: async () => new Response('<div id="root"></div>', { headers: { 'X-Frame-Options': 'DENY' } }) } },
    }, (url, options) => f.app.request(url, options, f.env, f.execution));

    await phase('organisation applications, pending accounts and two recovery sessions', async () => {
        assert.ok(admin.cookie && f.recovery.cookie);
        for (const partner of [a, b]) assert.equal(partner.data.user.organizationAccess[0].accessRole, 'admin');
        assert.equal((await pg.query(`SELECT count(*)::int AS n FROM organization_asset_packs WHERE status='active'`)).rows[0].n, 2);
        const joined = await request('/organization-onboarding/join', { method: 'POST', expected: 202,
            body: { email: 'staff@pilot-a.example', name: 'Fictional Staff', password: pilotPassword, termsAccepted: true } });
        assert.equal(joined.response.headers.get('set-cookie'), null);
        await request(`/organization-onboarding/join-requests/${joined.data.request.id}/approve`, {
            method: 'POST', cookie: a.cookie, body: { accessRole: 'staff' } });
        const staff = await f.login('staff@pilot-a.example', { ip: '192.0.2.11' });
        assert.equal(staff.data.user.organizationAccess[0].accessRole, 'staff');
        replacement = staff;
    });
    await phase('personal map remains independent; two partners create and edit governed map', async () => {
        await request('/favorites/toggle', { method: 'POST', cookie: a.cookie, body: { resourceType: 'hard', resourceId: a.resourceId } });
        personal = (await request('/my-maps', { method: 'POST', expected: 201, cookie: a.cookie,
            body: { name: 'Fictional personal map', assets: [{ resourceType: 'hard', resourceId: a.resourceId }] } })).data;
        const personalShared = (await request(`/my-maps/${personal.id}/share`, { method: 'POST', cookie: a.cookie, body: {} })).data;
        personalToken = personalShared.shareToken;
        await request(`/shared-maps/${personalToken}`);
        map = (await request('/governed-maps', { method: 'POST', expected: 201, cookie: a.cookie,
            body: { regionGroupId: f.groupId, name: 'Fictional staged pilot map' } })).data.map;
        for (const p of [a, b]) map = (await request(`/governed-maps/${map.id}/resources`, {
            method: 'POST', expected: 201, cookie: a.cookie, body: { resourceType: 'hard', resourceId: p.resourceId } })).data.map;
        const edit = { name: map.name, presentation: { mapStyle: 'gray', pinSize: 'large' }, expectedRevision: map.revision };
        map = (await request(`/governed-maps/${map.id}`, { method: 'PATCH', cookie: b.cookie, body: edit })).data.map;
        await request(`/governed-maps/${map.id}`, { method: 'PATCH', expected: 409, cookie: a.cookie, body: edit });
    });
    await phase('blank origins disable embedding; exact HTTPS origin and safe public payload', async () => {
        map = (await request(`/governed-maps/${map.id}/publish`, { method: 'POST', cookie: a.cookie, body: { allowedOrigins: [] } })).data.map;
        token = map.publication.shareToken;
        assert.equal((await embedResponse()).status, 404);
        const shared = await request(publicPath());
        assert.equal(shared.data.summary.resourceCount, 2);
        assert.match(JSON.stringify(shared.data), /pilot-a\.example\/approved-logo/);
        assert.match(JSON.stringify(shared.data), /pilot-b\.example\/approved-logo/);
        assert.equal(shared.data.viewer.canSaveCopy, false);
        map = (await request(`/governed-maps/${map.id}/publish`, { method: 'POST', cookie: b.cookie,
            body: { allowedOrigins: ['https://partner.fixture.example'] } })).data.map;
        const embedded = await embedResponse();
        assert.equal(embedded.status, 200);
        assert.equal(embedded.headers.get('x-frame-options'), null);
        assert.match(embedded.headers.get('content-security-policy'), /frame-ancestors 'self' https:\/\/partner\.fixture\.example;/);
        assert.doesNotMatch(embedded.headers.get('content-security-policy'), /unapproved\.fixture/);
        assert.equal(embedded.headers.get('cache-control'), 'no-store');
    });
    await phase('public share cannot cache a withdrawn resource for sixty seconds', async () => {
        assert.equal((await request(publicPath())).response.headers.get('cache-control'), 'no-store');
    });
    await phase('creator departure, replacement owner, cross-partner denial and immediate withdrawal', async () => {
        await pg.query(`UPDATE organization_access_memberships SET revoked_at=now() WHERE user_id=$1`, [a.userId]);
        await request(`/governed-maps/${map.id}`, { cookie: a.cookie, expected: 403 });
        await request(`/governed-maps/${map.id}`, { cookie: replacement.cookie, expected: 403 });
        await pg.query(`INSERT INTO hard_asset_staff_memberships (hard_asset_id,user_id,staff_role) VALUES ($1,$2,'owner')`, [a.resourceId, replacement.data.user.id]);
        await request(`/governed-maps/${map.id}`, { cookie: replacement.cookie });
        await request(`/governed-maps/${map.id}/resources/withdraw`, { method: 'POST', expected: 403, cookie: b.cookie,
            body: { resourceType: 'hard', resourceId: a.resourceId, reason: 'Other partner must not remove this resource.' } });
        await request(`/governed-maps/${map.id}/resources/withdraw`, { method: 'POST', cookie: replacement.cookie,
            body: { resourceType: 'hard', resourceId: a.resourceId, reason: 'Fictional owner withdraws the resource.' } });
        assert.equal((await request(publicPath())).data.summary.resourceCount, 1);
        assert.equal((await request(`${publicPath()}/embed`)).data.summary.resourceCount, 1);
        const notices = (await request('/governed-maps/notifications', { cookie: b.cookie })).data.notifications;
        const notice = notices.find(item => item.actionType === 'resource_withdrawn');
        assert.equal(notice.actorName, 'Fictional Staff');
        assert.equal(notice.reason, 'Fictional owner withdraws the resource.');
        await request(`/governed-maps/notifications/${notice.id}/read`, { method: 'POST', cookie: f.publicUser.cookie, body: {}, expected: 404 });
        await request(`/governed-maps/notifications/${notice.id}/read`, { method: 'POST', cookie: b.cookie, body: {} });
        assert.ok((await request('/governed-maps/notifications', { cookie: b.cookie })).data.notifications.find(item => item.id === notice.id).readAt);
    });
    await phase('retirement hides public routes and restoration rebuilds snapshot with same token', async () => {
        await request(`/governed-maps/${map.id}/resources`, { method: 'POST', expected: 201, cookie: b.cookie,
            body: { resourceType: 'hard', resourceId: a.resourceId } });
        await request(`/governed-maps/${map.id}/retire`, { method: 'POST', cookie: b.cookie, body: { reason: 'Fictional partner review during retirement.' } });
        await request(publicPath(), { expected: 404 });
        assert.equal((await embedResponse()).status, 404);
        await request(`/governed-maps/${map.id}/resources/withdraw`, { method: 'POST', cookie: replacement.cookie,
            body: { resourceType: 'hard', resourceId: a.resourceId, reason: 'Withdraw while the publication is retired.' } });
        await pg.query(`UPDATE hard_assets SET name='Fictional revised Resource B' WHERE id=$1`, [b.resourceId]);
        await pg.query(`UPDATE resource_publication_permissions
            SET status='permission_withdrawn',withdrawn_at=now(),withdrawal_reason='Fictional owner withdrew publication permission.'
            WHERE resource_type='hard' AND resource_id=$1`, [b.resourceId]);
        await request(`/governed-maps/${map.id}/restore`, { method: 'POST', expected: 409, cookie: b.cookie, body: { reason: 'Revoked permission must block restoration.' } });
        await request(publicPath(), { expected: 404 });
        await pg.query(`UPDATE resource_publication_permissions
            SET status='publishing_approved',withdrawn_at=NULL,withdrawal_reason=NULL
            WHERE resource_type='hard' AND resource_id=$1`, [b.resourceId]);
        map = (await request(`/governed-maps/${map.id}/restore`, { method: 'POST', cookie: b.cookie, body: { reason: 'Fictional partners approve restoration.' } })).data.map;
        assert.equal(map.publication.shareToken, token);
        const restored = (await request(publicPath())).data;
        assert.match(JSON.stringify(restored), /Fictional revised Resource B/);
        assert.equal(restored.summary.resourceCount, 1);
        assert.doesNotMatch(JSON.stringify(restored), /Fictional Resource A/);
    });
    await phase('closed pilot login, discovery containment and audited recovery', async () => {
        const current = (await request('/platform-access')).data.settings;
        const closed = await request('/platform-access', { method: 'PUT', cookie: admin.cookie,
            body: { publicDirectoryMode: 'authenticated', publicRegistrationMode: 'organization_only', publicLoginMode: 'organization_only', expectedRevision: current.revision } });
        for (const path of ['/hard-assets', `/hard-assets/${b.resourceId}`, '/soft-assets', '/public/map-cache', '/guide/search?q=care']) {
            const response = await f.app.request(`http://localhost:5183/api${path}`, {}, f.env, f.execution);
            assert.ok([401,403,404].includes(response.status), `${path} returned ${response.status}`);
        }
        await f.login('pilot-public@carearound.test', { expected: 403, partner: false, ip: '192.0.2.12' });
        assert.ok((await f.login(b.email, { ip: '192.0.2.13' })).cookie);
        const unmatched = await request('/organization-onboarding/join', { method: 'POST', expected: 404, ip: '192.0.2.14',
            body: { email: 'staff@unmatched.example', name: 'Fictional Unmatched Staff', password: pilotPassword, termsAccepted: true } });
        assert.equal(unmatched.data.code, 'organization_registration_required');
        await request(publicPath());
        const personalShared = await request(`/shared-maps/${personalToken}`);
        assert.equal(personalShared.data.name, 'Fictional personal map');
        assert.match(JSON.stringify(personalShared.data), /pilot-a\.example\/approved-logo/);
        await request('/platform-access', { method: 'PUT', cookie: f.recovery.cookie,
            body: { publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open', expectedRevision: closed.data.settings.revision } });
    });
    await phase('30-day finalizer is idempotent and personal map survives', async () => {
        map = await getMap();
        if (map.lifecycleStatus === 'published') await request(`/governed-maps/${map.id}/retire`, { method: 'POST', cookie: b.cookie, body: { reason: 'Final fictional retirement and archive rehearsal.' } });
        await pg.query(`UPDATE governed_maps SET retirement_eligible_at=now()-interval '1 minute' WHERE id=$1`, [map.id]);
        await request(`/governed-maps/${map.id}/restore`, { method: 'POST', cookie: b.cookie, expected: 409,
            body: { reason: 'A delayed scheduler must not extend the restoration window.' } });
        const now = new Date(Date.now() + 31 * 86400000);
        assert.deepEqual(await archiveDueGovernedMaps(getDb(f.env), now), { scanned: 1, archived: 1, failed: 0 });
        assert.deepEqual(await archiveDueGovernedMaps(getDb(f.env), now), { scanned: 0, archived: 0, failed: 0 });
        await request(publicPath(), { expected: 404 });
        assert.equal((await pg.query(`SELECT count(*)::int AS n FROM my_maps WHERE name='Fictional personal map'`)).rows[0].n, 1);
        assert.ok(personal);
        await request(`/shared-maps/${personalToken}`);
    });
    t.diagnostic(`Rehearsal phases executed: ${phases.length}; production connections: none.`);
});
