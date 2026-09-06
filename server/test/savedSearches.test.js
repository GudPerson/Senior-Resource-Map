import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';
import { createRuntimeSavedSearchRepository } from '../src/utils/savedSearchRepository.js';
import { runSavedSearchBatch } from '../src/utils/savedSearchProcessor.js';
import { createSavedSearchRoutes } from '../src/routes/savedSearches.js';
import { createGuideResourceLoader } from '../src/routes/guide.js';
import { savedSearchMatchKeys } from '../src/utils/savedSearchDomain.js';

test('saved searches run through actual public controllers and PostgreSQL', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    const repo = createRuntimeSavedSearchRepository(env);
    const owner = { id: 1, role: 'standard' };
    const appFor = (actor = owner) => {
        const app = new Hono();
        app.route('/api/saved-searches', createSavedSearchRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); } }));
        return app;
    };
    const request = (path = '', body, method = 'GET', actor = owner, config = env) => appFor(actor).request(`/api/saved-searches${path}`,
        { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }, config);
    const create = async (query = 'havelock', type = 'all', enabled = true) => {
        const response = await request('', { id: crypto.randomUUID(), query, type, enabled, reviewed: true }, 'POST');
        assert.equal(response.status, 201, await response.clone().text());
        return response.json();
    };
    const due = () => pg.exec('UPDATE saved_searches SET next_scan_at = NOW()');
    const scan = async (dependencies) => { await due(); return runSavedSearchBatch(env, dependencies); };
    const edit = (s, overrides) => request(`/${s.id}`, { query: s.query, type: s.type, enabled: s.enabled,
        revision: s.revision, reviewed: true, ...overrides }, 'PUT');
    const count = async (table) => Number((await pg.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'search-owner', 'search-owner@example.test', 'fixture', 'Owner', 'standard'),
        (2, 'search-other', 'search-other@example.test', 'fixture', 'Other', 'super_admin');
        INSERT INTO hard_assets (id, name, lat, lng, address, country)
            SELECT id, 'Havelock fixture place ' || id, 1.29, 103.82, 'Fixture address', 'SG' FROM generate_series(100, 161) id;
        INSERT INTO hard_assets (id, name, lat, lng, address, is_hidden) VALUES (200, 'Havelock hidden', 1.29, 103.82, 'Fixture address', true);
        INSERT INTO soft_assets (id, name, audience_mode, is_hidden) VALUES
            (300, 'Havelock public programme', 'public', false),
            (301, 'Havelock private audience', 'partner_boundary', false),
            (302, 'Havelock hidden programme', 'public', true);
        INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id) SELECT id, 100 FROM soft_assets;
        INSERT INTO user_favorites (id, user_id, resource_type, resource_id) VALUES (1, 1, 'soft', 300);
        INSERT INTO user_calendar_items (user_id, item_type, soft_asset_id, title, starts_at, source_revision)
            VALUES (1, 'planned_session', 300, 'Private plan', '2026-09-10T01:00:00Z', 1);
        INSERT INTO user_calendar_schedule_states (user_id, soft_asset_id, last_seen_revision) VALUES (1, 300, 1);`);
    const unchangedTables = ['user_favorites', 'user_calendar_items', 'user_calendar_schedule_states', 'my_maps', 'my_map_assets'];
    const before = await Promise.all(unchangedTables.map(async (table) => (await pg.query(`SELECT * FROM ${table}`)).rows));
    let subscription;
    await t.test('review/consent are mandatory, criteria are bounded, and private accounts are isolated', async () => {
        const input = { id: crypto.randomUUID(), query: 'Havelock', type: 'all', enabled: true, reviewed: true };
        for (const invalid of [{ ...input, reviewed: false }, { ...input, userId: 2 }, { ...input, scope: 'managed' },
            { ...input, query: 'a' }, { ...input, query: 'email person@example.test' }, { ...input, enabled: 'true' }]) {
            assert.equal((await request('', invalid, 'POST')).status, 400);
        }
        for (const [actor, status] of [[{ role: 'guest' }, 401], [{ ...owner, isImpersonating: true }, 403]]) {
            assert.equal((await request('', undefined, 'GET', actor)).status, status);
            assert.equal((await request('', input, 'POST', actor)).status, status);
        }
        assert.equal((await request('', undefined, 'GET', owner, {})).status, 404);
        subscription = await create('  Havelock  ');
        assert.equal(subscription.query, 'havelock');
        assert.equal(subscription.preparing, true);
        assert.equal((await request('', { ...input, id: subscription.id }, 'POST')).status, 201);
        assert.equal(await count('saved_searches'), 1);
        const outsider = { id: 2, role: 'super_admin' };
        assert.deepEqual((await (await request('', undefined, 'GET', outsider)).json()).searches, []);
        assert.equal((await request(`/${subscription.id}/results`, undefined, 'GET', outsider)).status, 404);
        assert.equal((await request(`/${subscription.id}`, { ...input, id: undefined, revision: 1 }, 'PUT', outsider)).status, 404);
        assert.equal((await request(`/${subscription.id}`, { revision: 1 }, 'DELETE', outsider)).status, 200);
        assert.equal(await count('saved_searches'), 1);
        const response = await request();
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.doesNotMatch(JSON.stringify(await response.json()), /user_id|baseline_preference|match_key|lease_id/);
    });
    await t.test('all existing matches baseline across durable pages without an initial flood', async () => {
        assert.deepEqual(await scan(), { enabled: true, processed: 2, notified: 0, failed: 0 });
        assert.equal(await count('saved_search_matches'), 63);
        assert.equal(await count('saved_search_digests'), 0);
        assert.equal((await repo.owned(1, subscription.id)).baseline_ready, true);
        assert.equal((await scan()).notified, 0);
        assert.equal(await count('saved_search_matches'), 63);
        const persisted = JSON.stringify((await pg.query('SELECT * FROM saved_search_matches')).rows);
        assert.doesNotMatch(persisted, /Havelock|Fixture|resource\/|private audience|address/);
    });
    await t.test('keyset traversal survives edits and deletions between pages without skipping older matches', async () => {
        const search = createGuideResourceLoader({ pageSize: 10, keyset: true });
        const first = await search({ query: 'havelock', type: 'all', page: 1, cursor: {} }, env);
        await pg.exec("UPDATE hard_assets SET updated_at = NOW() + INTERVAL '1 day' WHERE id = 110; UPDATE hard_assets SET is_hidden = true WHERE id = 160");
        const found = [...first.results];
        let page = first;
        while (page.hasMore) {
            page = await search({ query: 'havelock', type: 'all', page: page.page + 1, cursor: page.nextCursor }, env);
            found.push(...page.results);
        }
        assert.equal(new Set(found.map((r) => `${r.type}:${r.id}`)).size, 63);
        assert.equal(found.length, 63);
        const normal = await createGuideResourceLoader()({ query: 'havelock', type: 'hard', page: 1 }, env);
        assert.equal(normal.results[0].id, 110, 'normal Guide order must remain newest updated first');
        await pg.exec('UPDATE hard_assets SET is_hidden = false WHERE id = 160');
    });
    await t.test('new matches group, repeat scans deduplicate, fresh results recheck visibility', async () => {
        await pg.exec("INSERT INTO hard_assets (id, name, lat, lng, address) VALUES (400, 'Havelock newly added', 1.29, 103.82, 'Fixture address')");
        assert.equal((await scan()).notified, 1);
        let [digest] = await repo.digests(1);
        assert.equal(digest.notice_revision, 1);
        assert.equal(await repo.unreadCount(1), 1);
        assert.equal((await scan()).notified, 0);
        await pg.exec("INSERT INTO hard_assets (id, name, lat, lng, address) VALUES (401, 'Havelock second addition', 1.29, 103.82, 'Fixture address')");
        assert.equal((await scan()).notified, 1);
        [digest] = await repo.digests(1);
        assert.equal(digest.notice_revision, 2);
        assert.equal(await count('saved_search_digests'), 1);
        assert.equal((await request(`/${subscription.id}/digest`, { noticeId: digest.notice_id, revision: 1, action: 'read' }, 'PUT')).status, 409);
        assert.equal((await request(`/${subscription.id}/digest`, { noticeId: digest.notice_id, revision: 2, action: 'read' }, 'PUT')).status, 200);
        assert.equal(await repo.unreadCount(1), 0);
        await request(`/${subscription.id}/digest`, { noticeId: digest.notice_id, revision: 2, action: 'unread' }, 'PUT');
        assert.equal(await repo.unreadCount(1), 1);
        await pg.exec('UPDATE hard_assets SET is_hidden = true WHERE id IN (400, 401);');
        const current = await (await request(`/${subscription.id}/results`)).json();
        assert.ok(current.results.every((r) => ![400, 401].includes(r.id)));
        assert.doesNotMatch(JSON.stringify((await (await request()).json()).digests), /newly added|second addition|private audience|hidden programme/);
        assert.equal((await request(`/${subscription.id}/results?scope=managed`)).status, 400);
        await request(`/${subscription.id}/digest`, { noticeId: digest.notice_id, revision: 2, action: 'dismiss' }, 'PUT');
        assert.equal((await repo.digests(1)).length, 0);
        await pg.exec('UPDATE hard_assets SET is_hidden = false WHERE id = 400;');
        assert.equal((await scan()).notified, 0, 'returning same match is not new');
    });
    await t.test('failed lookup/commit retries without advancing progress or manufacturing a match', async () => {
        const before = await repo.owned(1, subscription.id);
        assert.equal((await scan({ search: async () => { throw new Error('Database unavailable'); } })).failed, 1);
        assert.equal((await repo.owned(1, subscription.id)).scan_page, before.scan_page);
        await due();
        const job = await repo.claim(), preference = await repo.master(1);
        await assert.rejects(repo.commitPage(job, preference, ['not-a-hash'], false), /saved_search_matches_key_check/);
        assert.equal((await repo.owned(1, subscription.id)).lease_id, job.lease_id);
        const page = await createGuideResourceLoader({ pageSize: 50 })({ query: job.query, type: job.resource_type, page: job.scan_page }, env);
        const keys = await savedSearchMatchKeys(page.results, [job.revision, null, null, null]);
        assert.ok(await repo.commitPage(job, preference, keys, page.hasMore));
        assert.equal(await repo.commitPage(job, preference, keys, page.hasMore), null);
        await scan();
    });
    await t.test('pause/edit fences in-flight work; resume and changed criteria start from a new baseline', async () => {
        await due();
        const job = await repo.claim(), pref = await repo.master(1);
        let response = await edit(subscription, { enabled: false });
        assert.equal(response.status, 200);
        subscription = await response.json();
        assert.equal(await repo.commitPage(job, pref, ['a'.repeat(64)], false), null);
        assert.equal((await scan()).processed, 0);
        await pg.exec("INSERT INTO hard_assets (id, name, lat, lng, address) VALUES (402, 'Havelock during pause', 1.29, 103.82, 'Fixture address')");
        response = await edit(subscription, { enabled: true });
        assert.equal(response.status, 200); subscription = await response.json();
        assert.equal((await scan()).notified, 0);
        assert.equal(await repo.unreadCount(1), 0);
        const oldRevision = subscription.revision;
        response = await edit(subscription, { query: 'nothing matches this fixture' });
        assert.equal(response.status, 200); subscription = await response.json();
        assert.equal((await edit(subscription, { revision: oldRevision, query: 'other criteria' })).status, 409);
        assert.equal((await scan()).notified, 0);
        assert.equal(await count('saved_search_matches'), 0);
        assert.deepEqual((await (await request(`/${subscription.id}/results`)).json()).results, []);
        assert.equal((await edit(subscription, { query: 'havelock' })).status, 200);
        subscription = (await (await request()).json()).searches[0];
        assert.equal((await scan()).notified, 0);
    });
    await t.test('master opt-out during processing rejects work; off/on invalidates stale digests before rebaseline', async () => {
        await pg.exec("INSERT INTO hard_assets (id, name, lat, lng, address) VALUES (403, 'Havelock another match', 1.29, 103.82, 'Fixture address')");
        assert.equal((await scan()).notified, 1);
        await due(); const job = await repo.claim(), pref = await repo.master(1);
        await pg.exec("INSERT INTO notification_preferences (user_id, channel, category, enabled, delivery_allowed) VALUES (1, 'in_app', 'general', false, false)");
        assert.equal(await repo.commitPage(job, pref, ['b'.repeat(64)], false), null);
        assert.equal(await repo.unreadCount(1), 0);
        await repo.release(job);
        assert.equal((await scan()).processed, 0);
        await pg.exec("UPDATE notification_preferences SET enabled = true, delivery_allowed = true, updated_at = clock_timestamp()");
        assert.equal(await repo.unreadCount(1), 0);
        assert.equal((await scan()).notified, 0);
        assert.equal(await repo.unreadCount(1), 0);
    });
    await t.test('expired leases cannot commit over replacements; deletion cleans only subscription data', async () => {
        await due(); const first = await repo.claim();
        await pg.exec("UPDATE saved_searches SET lease_until = NOW() - INTERVAL '1 second'");
        const second = await repo.claim(), pref = await repo.master(1);
        assert.notEqual(first.lease_id, second.lease_id);
        assert.equal(await repo.commitPage(first, pref, [], false), null);
        await repo.release(first);
        assert.equal((await repo.owned(1, subscription.id)).lease_id, second.lease_id);
        await repo.release(second);
        assert.equal((await request(`/${subscription.id}`, { revision: subscription.revision - 1 }, 'DELETE')).status, 409);
        assert.equal((await request(`/${subscription.id}`, { revision: subscription.revision }, 'DELETE')).status, 200);
        assert.equal(await count('saved_search_matches'), 0);
        assert.equal(await count('saved_search_digests'), 0);
        assert.equal(await count('saved_searches'), 0);
    });
    await t.test('an old digest action cannot read a replacement after resetting the same search', async () => {
        let s = await create('havelock', 'hard'); await scan();
        await pg.exec("INSERT INTO hard_assets (id, name, lat, lng, address) VALUES (450, 'Havelock first epoch', 1.29, 103.82, 'Fixture')");
        await scan(); const [old] = await repo.digests(1);
        s = await (await edit(s, { enabled: false })).json();
        s = await (await edit(s, { enabled: true })).json(); await scan();
        await pg.exec("INSERT INTO hard_assets (id, name, lat, lng, address) VALUES (451, 'Havelock next epoch', 1.29, 103.82, 'Fixture')");
        await scan(); const [current] = await repo.digests(1);
        assert.equal(old.notice_revision, 1); assert.equal(current.notice_revision, 1);
        assert.notEqual(current.notice_id, old.notice_id);
        assert.equal((await request(`/${s.id}/digest`, { noticeId: old.notice_id, revision: 1, action: 'read' }, 'PUT')).status, 409);
        assert.equal(await repo.unreadCount(1), 1);
        assert.equal((await request(`/${s.id}/digest`, { noticeId: current.notice_id, revision: 1, action: 'read' }, 'PUT')).status, 200);
        await repo.remove(1, s.id, s.revision);
    });
    await t.test('bounded slots, duplicate criteria and default-paused searches enforce limits', async () => {
        const s = await create('paused keywords', 'hard', false);
        assert.equal((await scan()).processed, 0);
        assert.equal((await request('', { id: crypto.randomUUID(), query: s.query, type: s.type, enabled: false, reviewed: true }, 'POST')).status, 409);
        for (let index = 1; index < 10; index += 1) await repo.create(1, { id: crypto.randomUUID(), query: `search ${index}`, type: 'all', enabled: false });
        await assert.rejects(repo.create(1, { id: crypto.randomUUID(), query: 'overflow', type: 'all', enabled: false }), /10 saved-search/);
        assert.equal((await repo.list(1)).length, 10);
        assert.equal((await runSavedSearchBatch({})).enabled, false);
    });
    for (let i = 0; i < unchangedTables.length; i += 1) {
        assert.deepEqual((await pg.query(`SELECT * FROM ${unchangedTables[i]}`)).rows, before[i], unchangedTables[i]);
    }
    assert.ok(statements.every((sql) => !/\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:"?my_maps|"?my_map_assets|"?user_calendar_|"?user_favorites)/i.test(sql)));
});
