import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('notification migration preserves populated existing tables and enforces all seven new checks', async () => {
    const pg = new PGlite();
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0005_notification_updates') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`INSERT INTO users (id, username, email, password_hash, name) VALUES (1, 'upgrade-fixture', 'upgrade@example.test', 'fixture-only', 'Upgrade fixture');
            INSERT INTO soft_assets (id, name, calendar_enabled, calendar_revision) VALUES (1, 'Existing programme', true, 1);
            INSERT INTO user_favorites (id, user_id, resource_type, resource_id, snapshot) VALUES (1, 1, 'soft', 1, '{"name":"Existing snapshot"}');
            INSERT INTO notification_preferences (user_id, channel, category, enabled, delivery_allowed) VALUES (1, 'in_app', 'general', false, false);
            INSERT INTO user_calendar_items (user_id, item_type, soft_asset_id, title, starts_at, source_revision)
                VALUES (1, 'planned_session', 1, 'Keep this plan', '2026-09-10T01:00:00Z', 1);
            INSERT INTO user_calendar_schedule_states (user_id, soft_asset_id, last_seen_revision) VALUES (1, 1, 1);`);
        const tables = ['users', 'soft_assets', 'user_favorites', 'notification_preferences', 'user_calendar_items', 'user_calendar_schedule_states'];
        const before = await Promise.all(tables.map((table) => pg.query(`SELECT * FROM ${table}`)));
        await pg.exec(await readFile(new URL('../drizzle/0005_notification_updates.sql', import.meta.url), 'utf8'));
        for (let index = 0; index < tables.length; index += 1) {
            assert.deepEqual((await pg.query(`SELECT * FROM ${tables[index]}`)).rows, before[index].rows, `${tables[index]} must not be transformed`);
        }
        const watchId = crypto.randomUUID(), noticeId = crypto.randomUUID();
        await pg.exec('INSERT INTO notification_resource_jobs (user_id) VALUES (1);');
        await pg.query('INSERT INTO notification_resource_watches (id, favorite_id, baseline) VALUES ($1, 1, $2::jsonb)', [watchId, '{}']);
        await pg.query('INSERT INTO user_notifications (id, watch_id, categories, changed_fields) VALUES ($1, $2, $3::jsonb, $4::jsonb)',
            [noticeId, watchId, '["calendar"]', '["schedule"]']);
        const violations = [
            ["UPDATE notification_resource_jobs SET favorite_cursor = -1", 'notification_resource_jobs_cursor_check'],
            ["UPDATE notification_resource_jobs SET lease_id = 'incomplete-lease'", 'notification_resource_jobs_lease_check'],
            ["UPDATE notification_resource_watches SET baseline = '[]'", 'notification_resource_watches_baseline_check'],
            ["UPDATE notification_resource_watches SET control_revision = 0", 'notification_resource_watches_control_check'],
            ["UPDATE user_notifications SET categories = '[\"general\"]'", 'user_notifications_category_check'],
            ["UPDATE user_notifications SET changed_fields = '[\"privateNote\"]'", 'user_notifications_fields_check'],
            ["UPDATE user_notifications SET read_revision = 2", 'user_notifications_read_check'],
        ];
        for (const [sql, constraint] of violations) await assert.rejects(pg.exec(sql), (error) => error.message.includes(constraint));
        await assert.rejects(pg.query('UPDATE notification_resource_watches SET baseline = $1::jsonb', [JSON.stringify({ large: 'x'.repeat(4096) })]),
            /notification_resource_watches_baseline_check/);
        await pg.exec('DELETE FROM user_favorites WHERE id = 1;');
        assert.equal((await pg.query('SELECT * FROM notification_resource_watches')).rows.length, 0);
        assert.equal((await pg.query('SELECT * FROM user_notifications')).rows.length, 0);
        assert.deepEqual((await pg.query('SELECT * FROM user_calendar_items')).rows, before[4].rows);
        assert.deepEqual((await pg.query('SELECT * FROM user_calendar_schedule_states')).rows, before[5].rows);
    } finally { await pg.close(); }
});
