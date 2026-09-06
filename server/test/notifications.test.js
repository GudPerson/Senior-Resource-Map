import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';
import { createRuntimeNotificationRepository } from '../src/utils/notificationRepository.js';
import { runResourceNotificationBatch } from '../src/utils/notificationProcessor.js';
import { notificationSettings, observeSavedResource } from '../src/utils/notificationDomain.js';
import { createNotificationRoutes } from '../src/routes/notifications.js';
import { getDb } from '../src/db/index.js';
import { loadSavedAssetChangeSources } from '../src/utils/savedAssets.js';
import worker from '../src/worker.js';
import { Hono } from 'hono';

test('durable resource notifications use real PostgreSQL, preferences and visibility', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    const repository = createRuntimeNotificationRepository(env);
    const user = { id: 1, role: 'standard' };
    const routerFor = (actor) => createNotificationRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); } });
    const request = (path, body, actor = user, method = 'PUT') => routerFor(actor).request(path,
        body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);
    const count = async (table) => Number((await pg.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
    const due = () => pg.exec('UPDATE notification_resource_jobs SET next_scan_at = NOW();');
    const scan = async () => { await due(); return runResourceNotificationBatch(env); };
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'notification-member', 'member@example.test', 'not-a-password', 'Member', 'standard'),
        (2, 'notification-other', 'other@example.test', 'not-a-password', 'Other', 'standard');
        INSERT INTO hard_assets (id, name, lat, lng, address, hours, country)
            VALUES (100, 'Fixture centre', 1.29, 103.82, 'Fixture address', '9 to 5', 'SG');
        INSERT INTO soft_assets (id, name, audience_mode, calendar_enabled, calendar_revision, calendar_status)
            VALUES (200, 'Fixture programme', 'public', true, 1, 'active');
        INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id) VALUES (200, 100);
        INSERT INTO user_calendar_items (user_id, item_type, soft_asset_id, title, starts_at, source_revision)
            VALUES (1, 'planned_session', 200, 'Private fixture plan', '2026-09-10T01:00:00Z', 1);
        INSERT INTO user_calendar_schedule_states (user_id, soft_asset_id, last_seen_revision) VALUES (1, 200, 1);`);
    const calendarBefore = {
        plans: (await pg.query('SELECT * FROM user_calendar_items')).rows,
        acknowledgements: (await pg.query('SELECT * FROM user_calendar_schedule_states')).rows,
    };
    async function reset() {
        await pg.exec(`DELETE FROM user_favorites; DELETE FROM notification_resource_jobs; DELETE FROM notification_preferences;
            UPDATE hard_assets SET name = 'Fixture centre', is_hidden = false, hours = '9 to 5' WHERE id = 100;
            UPDATE soft_assets SET name = 'Fixture programme', is_hidden = false, calendar_enabled = true,
                calendar_revision = 1, calendar_status = 'active', audience_mode = 'public' WHERE id = 200;
            INSERT INTO user_favorites (id, user_id, resource_type, resource_id, snapshot) VALUES
                (1000, 1, 'hard', 100, '{"name":"Do not expose snapshot"}'), (1001, 1, 'soft', 200, '{}');`);
        await repository.setPreference(1, { category: 'calendar', enabled: true });
        await repository.setPreference(1, { category: 'resources', enabled: true });
    }
    async function change() {
        await pg.exec(`UPDATE soft_assets SET name = 'Changed fixture programme', calendar_revision = 2, calendar_status = 'cancelled' WHERE id = 200;`);
        return scan();
    }
    async function pendingObservation(job) {
        const preferences = await repository.preferences(job.user_id);
        const favorites = await repository.favorites(job.user_id, job.favorite_cursor);
        const sources = await loadSavedAssetChangeSources(getDb(env), user, favorites);
        const observations = await Promise.all(favorites.map((favorite, index) => observeSavedResource(favorite, sources[index], notificationSettings(preferences))));
        return { preferences, observations, options: { cursor: favorites.at(-1).id, hasMore: false } };
    }

    await t.test('initial consent records a private baseline without historical notifications', async () => {
        await reset();
        const result = await scan();
        assert.deepEqual(result, { enabled: true, processed: 2, notified: 0, failed: 0 });
        assert.equal(await count('notification_resource_watches'), 2);
        assert.equal(await count('user_notifications'), 0);
        const baseline = JSON.stringify((await pg.query('SELECT baseline FROM notification_resource_watches')).rows);
        assert.doesNotMatch(baseline, /Fixture|address"\s*:\s*"Fixture|Do not expose snapshot|resource\/|9 to 5/);
        assert.equal((await scan()).notified, 0);
        assert.equal(await repository.unreadCount(1), 0);
    });
    await t.test('calendar revision and resource edits create one group and retries do not duplicate it', async () => {
        await reset(); await scan();
        assert.equal((await change()).notified, 1);
        let [row] = await repository.list(1);
        assert.deepEqual(row.categories, ['resources', 'calendar']);
        assert.equal(row.revision, 1);
        assert.equal(await repository.unreadCount(1), 1);
        await scan();
        assert.equal((await repository.list(1))[0].revision, 1);
        await pg.exec('UPDATE soft_assets SET calendar_revision = 3 WHERE id = 200;');
        await scan();
        [row] = await repository.list(1);
        assert.equal(row.revision, 2);
        assert.equal(await count('user_notifications'), 1);
        assert.doesNotMatch(JSON.stringify((await pg.query('SELECT * FROM user_notifications')).rows), /Fixture|resource\/|9 to 5/);
    });
    await t.test('read/unread and dismissal are owner scoped and cannot acknowledge a newer update', async () => {
        const [row] = await repository.list(1);
        assert.equal((await request(`/${row.id}`, { revision: row.revision, action: 'read' }, { id: 2, role: 'standard' })).status, 404);
        assert.equal((await request(`/${row.id}`, { revision: row.revision - 1, action: 'read' })).status, 409);
        assert.equal((await request(`/${row.id}`, { revision: row.revision, action: 'read' })).status, 200);
        assert.equal(await repository.unreadCount(1), 0);
        await request(`/${row.id}`, { revision: row.revision, action: 'unread' });
        assert.equal(await repository.unreadCount(1), 1);
        await request(`/${row.id}`, { revision: row.revision, action: 'dismiss' });
        assert.equal((await repository.list(1)).length, 0);
        await pg.exec('UPDATE soft_assets SET calendar_revision = 4 WHERE id = 200;'); await scan();
        assert.equal((await repository.list(1))[0].revision, 3);
    });
    await t.test('visibility withdrawal redacts existing updates and never exposes snapshots or stale links', async () => {
        await pg.exec(`UPDATE soft_assets SET is_hidden = true, name = 'New private name' WHERE id = 200;`);
        let response = await request('/');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        let data = await response.json();
        assert.equal(data.notifications[0].title, 'Saved resource update');
        assert.deepEqual(data.notifications[0].actions, []);
        assert.deepEqual(data.notifications[0].changedFields, []);
        assert.doesNotMatch(JSON.stringify(data), /New private name|Fixture programme|Do not expose snapshot|resource\/soft\/200/);
        await scan();
        const revision = (await repository.list(1))[0].revision;
        await pg.exec('UPDATE soft_assets SET calendar_revision = 5 WHERE id = 200;'); await scan();
        assert.equal((await repository.list(1))[0].revision, revision, 'private edits are not observed');
        await pg.exec(`UPDATE soft_assets SET is_hidden = false, audience_mode = 'partner_boundary' WHERE id = 200;`);
        response = await request('/'); data = await response.json();
        assert.deepEqual(data.notifications[0].actions, []);
    });
    await t.test('a failed lookup does not turn into an unavailable notice or advance the baseline', async () => {
        await reset(); await scan();
        const previous = (await pg.query('SELECT baseline FROM notification_resource_watches ORDER BY favorite_id')).rows;
        await due();
        const failed = await runResourceNotificationBatch(env, { loadSources: async () => { throw new Error('Fixture failure containing private data'); } });
        assert.equal(failed.failed, 1);
        assert.equal(failed.notified, 0);
        assert.deepEqual((await pg.query('SELECT baseline FROM notification_resource_watches ORDER BY favorite_id')).rows, previous);
        assert.equal((await change()).notified, 1);
    });
    await t.test('changed consent aborts an in-flight batch and general preferences remain authoritative', async () => {
        await reset(); await scan();
        await pg.exec('UPDATE soft_assets SET calendar_revision = 2 WHERE id = 200;'); await due();
        const job = await repository.claim();
        const pending = await pendingObservation(job);
        await repository.setPreference(1, { category: 'calendar', enabled: false });
        assert.equal(await repository.commitBatch(job, pending.preferences, pending.observations, pending.options), null);
        await repository.release(job);
        assert.equal(await count('user_notifications'), 0);
        await scan();
        await repository.setPreference(1, { category: 'calendar', enabled: true }); await scan();
        assert.equal(await count('user_notifications'), 0, 'resume establishes a current baseline');
        const prefs = await repository.preferences(1);
        await repository.setPreference(1, { category: 'calendar', enabled: true });
        assert.deepEqual(await repository.preferences(1), prefs, 'repeated consent is idempotent');
        await pg.exec(`INSERT INTO notification_preferences (user_id, channel, category, enabled, delivery_allowed)
            VALUES (1, 'in_app', 'general', false, false), (1, 'email', 'general', false, false);`);
        await repository.setPreference(1, { category: 'calendar', enabled: true });
        assert.equal((await scan()).processed, 0);
        assert.equal((await request('/preferences')).status, 200);
        assert.equal((await (await request('/preferences')).json()).masterEnabled, false);
        assert.ok((await pg.query(`SELECT enabled FROM notification_preferences WHERE category = 'general'`)).rows.every((r) => !r.enabled));
    });
    await t.test('leases fence duplicate workers and expired owners cannot commit or release a new lease', async () => {
        await reset(); await repository.enroll();
        const first = await repository.claim();
        assert.equal(await repository.claim(), null);
        const pending = await pendingObservation(first);
        await pg.exec(`UPDATE notification_resource_jobs SET lease_until = NOW() - INTERVAL '1 second';`);
        const second = await repository.claim();
        assert.notEqual(second.lease_id, first.lease_id);
        assert.equal(await repository.commitBatch(first, pending.preferences, pending.observations, pending.options), null);
        await repository.release(first);
        assert.equal((await pg.query('SELECT lease_id FROM notification_resource_jobs')).rows[0].lease_id, second.lease_id);
        assert.equal((await repository.commitBatch(second, pending.preferences, pending.observations, pending.options)).observed, 2);
        assert.equal(await repository.commitBatch(second, pending.preferences, pending.observations, pending.options), null);
    });
    await t.test('mute has no cross-account override and resume creates no catch-up update', async () => {
        await reset(); await scan(); await change();
        let [row] = await repository.list(1);
        const path = `/watches/${row.watch_id}`;
        assert.equal((await request(path, { revision: row.control_revision, muted: true }, { id: 2, role: 'super_admin' })).status, 404);
        let response = await request(path, { revision: row.control_revision, muted: true });
        const muted = await response.json();
        assert.equal(muted.muted, true);
        assert.equal(await repository.unreadCount(1), 0);
        assert.equal((await (await request('/muted')).json()).muted.length, 1);
        await pg.exec('UPDATE soft_assets SET calendar_revision = 3 WHERE id = 200;'); await scan();
        response = await request(path, { revision: muted.revision, muted: false });
        assert.equal(response.status, 200); await scan();
        [row] = await repository.list(1);
        assert.equal(row.revision, 1);
        await pg.exec('UPDATE soft_assets SET calendar_revision = 4 WHERE id = 200;'); await scan();
        assert.equal((await repository.list(1))[0].revision, 2);
    });
    await t.test('unsave deletes only the associated new watch/group and re-save starts a new baseline', async () => {
        await pg.exec('DELETE FROM user_favorites WHERE id = 1001;');
        assert.equal(await count('notification_resource_watches'), 1);
        assert.equal(await count('user_notifications'), 0);
        await pg.exec(`INSERT INTO user_favorites (id, user_id, resource_type, resource_id) VALUES (1002, 1, 'soft', 200);`);
        assert.equal((await scan()).notified, 0);
    });
    await t.test('routes deny guests and impersonation, validate fields, and fail closed while disabled', async () => {
        assert.equal((await request('/', undefined, { role: 'guest' })).status, 401);
        assert.equal((await request('/', undefined, { id: 1, role: 'standard', isImpersonating: true })).status, 403);
        assert.equal((await request('/preferences', { category: 'general', enabled: true })).status, 400);
        assert.equal((await request('/preferences', { category: 'calendar', enabled: true, userId: 2 })).status, 400);
        assert.equal((await request('/?before=invalid')).status, 400);
        assert.equal((await request('/?before=2026-09-07T00%3A00%3A00Z')).status, 400);
        assert.equal((await routerFor(user).request('/', {}, {})).status, 404);
        const mounted = new Hono().route('/api/notifications', routerFor(user));
        assert.equal((await mounted.request('/api/notifications', {}, env)).status, 200);
        assert.deepEqual(await runResourceNotificationBatch({}), { enabled: false, processed: 0, notified: 0, failed: 0 });
        await worker.scheduled({}, {});
        assert.equal((await worker.fetch(new Request('https://api.carearound.sg/api/health'), {}, {})).status, 200);
    });
    await t.test('a database constraint failure rolls back the whole observation and notification batch', async () => {
        await reset(); await scan();
        await pg.exec('UPDATE soft_assets SET calendar_revision = 2 WHERE id = 200;'); await due();
        const job = await repository.claim();
        const pending = await pendingObservation(job);
        const bad = structuredClone(pending.observations);
        bad.find((row) => row.categories.length).changed_fields = ['arbitrary-private-message'];
        await assert.rejects(repository.commitBatch(job, pending.preferences, bad, pending.options), /user_notifications_fields_check/);
        assert.equal(await count('user_notifications'), 0);
        assert.equal((await pg.query('SELECT lease_id FROM notification_resource_jobs')).rows[0].lease_id, job.lease_id);
        assert.equal((await repository.commitBatch(job, pending.preferences, pending.observations, pending.options)).notified, 1);
    });
    await t.test('large saved collections persist progress, paginate ties and stay within a bounded query count', async () => {
        await reset();
        await pg.exec(`INSERT INTO hard_assets (id, name, lat, lng, address, country)
            SELECT id, 'Batch fixture ' || id, 1.29, 103.82, 'Batch address', 'SG' FROM generate_series(300, 359) id;
            INSERT INTO user_favorites (id, user_id, resource_type, resource_id)
                SELECT id + 1000, 1, 'hard', id FROM generate_series(300, 359) id;`);
        const start = statements.length;
        const first = await scan();
        assert.deepEqual(first, { enabled: true, processed: 50, notified: 0, failed: 0 });
        assert.ok(statements.length - start <= 45, `first tick used ${statements.length - start} SQL calls`);
        assert.ok((await pg.query('SELECT favorite_cursor FROM notification_resource_jobs')).rows[0].favorite_cursor > 0);
        const second = await scan();
        assert.equal(second.processed, 12);
        assert.equal((await pg.query('SELECT favorite_cursor FROM notification_resource_jobs')).rows[0].favorite_cursor, 0);
        await pg.exec("UPDATE hard_assets SET hours = 'Updated hours' WHERE id BETWEEN 300 AND 359;");
        await scan(); await scan();
        assert.equal(await count('user_notifications'), 60);
        await pg.exec("UPDATE user_notifications SET updated_at = '2026-09-07T01:00:00Z';");
        const ids = new Set();
        let path = '/';
        for (let page = 0; page < 3; page += 1) {
            const response = await request(path);
            assert.equal(response.status, 200);
            const data = await response.json();
            assert.equal(data.notifications.length, 20);
            for (const notice of data.notifications) { assert.ok(!ids.has(notice.id)); ids.add(notice.id); }
            path = data.nextCursor ? `/?${new URLSearchParams(data.nextCursor)}` : null;
        }
        assert.equal(path, null);
        assert.equal(ids.size, 60);
    });
    assert.deepEqual((await pg.query('SELECT * FROM user_calendar_items')).rows, calendarBefore.plans);
    assert.deepEqual((await pg.query('SELECT * FROM user_calendar_schedule_states')).rows, calendarBefore.acknowledgements);
    assert.ok(!statements.some((sql) => /^\s*(INSERT INTO|UPDATE|DELETE FROM)\s+(user_calendar_|my_maps|my_map_)/i.test(sql)),
        'notifications must never mutate plans, calendar acknowledgements or maps');
});
