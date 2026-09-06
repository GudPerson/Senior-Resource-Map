import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/db/index.js';
import { getSoftAssetById, updateSoftAsset } from '../src/controllers/softAssetsController.js';
import { getCalendar, createCalendarItem, acknowledgeCalendarSchedule } from '../src/controllers/calendarController.js';
import { getFavorites } from '../src/controllers/favoritesController.js';
import { createNotificationRoutes } from '../src/routes/notifications.js';
import { runResourceNotificationBatch } from '../src/utils/notificationProcessor.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

test('provider publication reaches the private inbox and Calendar without changing personal plans', async (t) => {
    const { pg, env } = await createNeonPostgresFixture(t);
    env.MAP_CACHE = { put: async () => {}, get: async () => null };
    await pg.exec(`INSERT INTO subregions (id, name) VALUES (10, 'Synthetic region');
        INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'journey-member', 'member@example.test', 'fixture-only', 'Member', 'standard'),
        (2, 'journey-other', 'other@example.test', 'fixture-only', 'Other', 'standard'),
        (3, 'journey-editor', 'editor@example.test', 'fixture-only', 'Editor', 'super_admin');
        INSERT INTO hard_assets (id, name, lat, lng, address, country, subregion_id)
        VALUES (100, 'Synthetic centre', 1.29, 103.82, 'Synthetic address', 'SG', 10);
        INSERT INTO soft_assets (id, name, bucket, audience_mode, subregion_id)
        VALUES (200, 'Synthetic programme', 'programmes', 'public', 10);
        INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id) VALUES (200, 100);
        INSERT INTO user_favorites (user_id, resource_type, resource_id) VALUES (1, 'soft', 200);`);
    const member = { id: 1, role: 'standard' };
    const editor = { id: 3, role: 'super_admin' };
    const pending = [];
    const context = { waitUntil: (promise) => pending.push(promise), passThroughOnException() {} };
    t.after(async () => { await Promise.all(pending); });
    const request = async (path, body, actor = member, method = 'GET') => {
        const authenticate = async (c, next) => { c.set('user', actor); await next(); };
        const api = new Hono();
        api.use('*', authenticate);
        api.get('/soft-assets/:id', getSoftAssetById);
        api.put('/soft-assets/:id', updateSoftAsset);
        api.get('/favorites', getFavorites);
        api.get('/calendar', getCalendar);
        api.post('/calendar/items', createCalendarItem);
        api.post('/calendar/schedule-states/acknowledge', acknowledgeCalendarSchedule);
        api.route('/notifications', createNotificationRoutes({ authenticate }));
        const response = await api.request(path, { method, ...(body === undefined ? {} : {
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }) }, env, context);
        await Promise.all(pending);
        return { status: response.status, data: await response.json() };
    };
    const scan = async () => {
        await pg.exec('UPDATE notification_resource_jobs SET next_scan_at = NOW()');
        return runResourceNotificationBatch(env);
    };
    const sourceDate = new Date();
    sourceDate.setUTCDate(sourceDate.getUTCDate() + 7);
    sourceDate.setUTCHours(1, 0, 0, 0);
    const start = sourceDate.toISOString();
    const movedStart = new Date(sourceDate.getTime() + 3600000).toISOString();
    const range = `?from=${new Date(sourceDate.getTime() - 86400000).toISOString()}&to=${new Date(sourceDate.getTime() + 7 * 86400000).toISOString()}`;
    const schedule = (startsAt = start, status = 'active') => ({ enabled: true, notes: '', entries: [{
        key: 'journey-session', type: 'once', startsAt, endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
        timezone: 'Asia/Singapore', status,
    }] });
    const publish = (plan, revision, actor = editor, action = 'publish') => request('/soft-assets/200', {
        schedulePlan: plan, expectedScheduleRevision: revision, schedulePlanAction: action,
    }, actor, 'PUT');
    const plans = async () => (await pg.query('SELECT * FROM user_calendar_items ORDER BY id')).rows;
    const states = async () => (await pg.query('SELECT * FROM user_calendar_schedule_states ORDER BY user_id, soft_asset_id')).rows;
    const versions = async () => (await pg.query('SELECT * FROM offering_schedule_versions ORDER BY revision')).rows;
    let originalPlan;
    let firstVersion;

    await t.test('the transport executes real atomic batches and rolls back a late failure', async () => {
        const db = getDb(env);
        await assert.rejects(db.batch([
            db.execute(sql`UPDATE soft_assets SET name = 'Must roll back' WHERE id = 200`),
            db.execute(sql`INSERT INTO user_favorites (user_id, resource_type, resource_id) VALUES (9999, 'soft', 200)`),
        ]));
        assert.equal((await pg.query('SELECT name FROM soft_assets WHERE id = 200')).rows[0].name, 'Synthetic programme');
    });
    await t.test('an authorised editor publishes real canonical sessions and the user plans one occurrence', async () => {
        assert.equal((await publish(schedule(), 0, member)).status, 403);
        const publication = await publish(schedule(), 0);
        assert.equal(publication.status, 200, JSON.stringify(publication.data));
        [firstVersion] = await versions();
        const detail = await request('/soft-assets/200');
        assert.equal(detail.status, 200);
        const calendar = await request(`/calendar${range}`);
        assert.equal(calendar.status, 200);
        assert.equal(calendar.data.occurrences.length, 1);
        assert.equal(calendar.data.occurrences[0].startsAt, start);
        assert.equal(calendar.data.occurrences[0].sourceRevision, 1);
        assert.equal(calendar.data.personalItems.length, 0);
        const planned = await request('/calendar/items', { itemType: 'planned_session', softAssetId: 200,
            sourceStartsAt: start, sourceScheduleEntryKey: 'journey-session' }, member, 'POST');
        assert.equal(planned.status, 201, JSON.stringify(planned.data));
        originalPlan = await plans();
        const consent = await request('/notifications/preferences', { category: 'calendar', enabled: true }, member, 'PUT');
        assert.equal(consent.status, 200);
        assert.equal((await scan()).notified, 0);
    });
    await t.test('a second publication notifies once; inbox read and dismiss do not acknowledge or move the plan', async () => {
        const changed = await publish(schedule(movedStart), 1);
        assert.equal(changed.status, 200, JSON.stringify(changed.data));
        assert.deepEqual((await versions())[0], firstVersion, 'the recorded original publication is immutable');
        assert.deepEqual((await versions()).map((row) => row.revision), [1, 2]);
        assert.equal((await scan()).notified, 1);
        assert.equal((await scan()).notified, 0);
        const { data } = await request('/notifications');
        assert.equal(data.notifications.length, 1);
        const [notice] = data.notifications;
        assert.ok(notice.actions.some((action) => action.path === '/dashboard/calendar'), JSON.stringify(notice));
        const beforeState = await states();
        for (const action of ['read', 'unread', 'dismiss']) {
            assert.equal((await request(`/notifications/${notice.id}`, { revision: notice.revision, action }, member, 'PUT')).status, 200);
            assert.deepEqual(await plans(), originalPlan);
            assert.deepEqual(await states(), beforeState);
        }
        const { data: calendar } = await request(`/calendar${range}`);
        assert.equal(calendar.personalItems[0].startsAt, start);
        assert.equal(calendar.personalItems[0].needsReview, true);
        assert.equal(calendar.occurrences[0].startsAt, movedStart);
        assert.equal(calendar.occurrences[0].isPlanned, false);
        assert.equal((await publish(schedule(), 1)).status, 409, 'stale editor cannot undo the later publication');
        assert.equal((await scan()).notified, 0);
    });
    await t.test('explicit Calendar review changes only acknowledgement; cancellation cannot create a plan', async () => {
        const review = await request('/calendar/schedule-states/acknowledge', { softAssetId: 200 }, member, 'POST');
        assert.equal(review.status, 200);
        assert.equal(review.data.lastSeenRevision, 2);
        assert.deepEqual(await plans(), originalPlan);
        assert.equal((await request(`/calendar${range}`)).data.personalItems[0].needsReview, false);
        const cancellation = await publish(schedule(movedStart, 'cancelled'), 2);
        assert.equal(cancellation.status, 200, JSON.stringify(cancellation.data));
        assert.equal((await scan()).notified, 1);
        assert.equal((await request(`/calendar${range}`)).data.personalItems[0].needsReview, true);
        assert.equal((await request('/calendar/items', { itemType: 'planned_session', softAssetId: 200,
            sourceStartsAt: movedStart, sourceScheduleEntryKey: 'journey-session' }, member, 'POST')).status, 409);
        assert.deepEqual(await plans(), originalPlan);
    });
    await t.test('permission withdrawal and opt-out redact updates without changing private plans', async () => {
        const hide = await request('/soft-assets/200', { isHidden: true }, editor, 'PUT');
        assert.equal(hide.status, 200, JSON.stringify(hide.data));
        const hidden = (await request('/notifications')).data.notifications[0];
        assert.deepEqual(hidden.actions, []);
        assert.doesNotMatch(JSON.stringify(hidden), /Synthetic programme|Synthetic address|resource\/soft/);
        assert.equal((await request(`/calendar${range}`)).data.occurrences.length, 0);
        assert.deepEqual(await plans(), originalPlan);
        assert.equal((await request('/notifications', undefined, { id: 2, role: 'standard' })).data.notifications.length, 0);
        await scan();
        assert.equal((await scan()).notified, 0);
        assert.equal((await request('/notifications/preferences', { category: 'calendar', enabled: false }, member, 'PUT')).status, 200);
        assert.equal((await request('/notifications')).data.notifications.length, 0);
        await request('/soft-assets/200', { isHidden: false }, editor, 'PUT');
        const unpublish = await publish({ enabled: false, entries: [] }, 3, editor, 'unpublish');
        assert.equal(unpublish.status, 200, JSON.stringify(unpublish.data));
        assert.equal((await scan()).notified, 0);
        assert.deepEqual(await plans(), originalPlan);
        const { data: calendar } = await request(`/calendar${range}`);
        assert.equal(calendar.occurrences.length, 0);
        assert.equal(calendar.savedWithoutSchedule.length, 1);
        assert.equal(calendar.personalItems[0].needsReview, true);
    });
    await t.test('competing editor saves retain one current revision and immutable publication history', async () => {
        const results = await Promise.all([publish(schedule(start), 4), publish(schedule(movedStart), 4)]);
        assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
        const history = await versions();
        assert.deepEqual(history.map((row) => row.revision), [1, 2, 3, 4, 5]);
        assert.deepEqual(history[0], firstVersion);
        const current = (await pg.query('SELECT calendar_revision, calendar_entries FROM soft_assets WHERE id = 200')).rows[0];
        assert.equal(current.calendar_revision, 5);
        assert.deepEqual(history.at(-1).entries, current.calendar_entries);
        assert.deepEqual(await plans(), originalPlan);
    });
});
