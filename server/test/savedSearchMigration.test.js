import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('saved-search migration preserves existing notification/calendar data and enforces nine checks', async () => {
    const pg = new PGlite();
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0006_saved_search_alerts') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`INSERT INTO users (id, username, email, password_hash, name) VALUES (1, 'upgrade-search', 'upgrade@example.test', 'fixture', 'Upgrade');
            INSERT INTO soft_assets (id, name) VALUES (1, 'Keep offering');
            INSERT INTO user_favorites (id, user_id, resource_type, resource_id) VALUES (1, 1, 'soft', 1);
            INSERT INTO notification_preferences (user_id, channel, category, enabled, delivery_allowed) VALUES (1, 'in_app', 'general', false, false);
            INSERT INTO notification_resource_jobs (user_id) VALUES (1);
            INSERT INTO notification_resource_watches (id, favorite_id, baseline) VALUES ('existing-watch', 1, '{}');
            INSERT INTO user_notifications (id, watch_id, categories, changed_fields) VALUES ('existing-notice', 'existing-watch', '["calendar"]', '["schedule"]');
            INSERT INTO user_calendar_items (user_id, item_type, soft_asset_id, title, starts_at, source_revision)
                VALUES (1, 'planned_session', 1, 'Keep plan', '2026-09-10T01:00:00Z', 1);
            INSERT INTO user_calendar_schedule_states (user_id, soft_asset_id, last_seen_revision) VALUES (1, 1, 1);`);
        const tables = ['users', 'soft_assets', 'user_favorites', 'notification_preferences', 'notification_resource_jobs',
            'notification_resource_watches', 'user_notifications', 'user_calendar_items', 'user_calendar_schedule_states'];
        const before = await Promise.all(tables.map(async (table) => (await pg.query(`SELECT * FROM ${table}`)).rows));
        await pg.exec(await readFile(new URL('../drizzle/0006_saved_search_alerts.sql', import.meta.url), 'utf8'));
        await pg.exec(`INSERT INTO saved_searches (id, user_id, slot, query, resource_type) VALUES ('test-search', 1, 1, 'public keywords', 'all');
            INSERT INTO saved_search_matches (search_id, match_key) VALUES ('test-search', repeat('a', 64));
            INSERT INTO saved_search_digests (search_id, notice_id, search_revision, baseline_preference) VALUES ('test-search', 'test-notice', 1, '{}');`);
        const checks = [
            ['UPDATE saved_searches SET slot = 11', 'saved_searches_slot_check'],
            ["UPDATE saved_searches SET resource_type = 'bad'", 'saved_searches_criteria_check'],
            ['UPDATE saved_searches SET scan_page = 0', 'saved_searches_progress_check'],
            ["UPDATE saved_searches SET lease_id = 'unpaired'", 'saved_searches_lease_check'],
            ["UPDATE saved_searches SET baseline_preference = '[]'", 'saved_searches_preference_check'],
            ["UPDATE saved_searches SET scan_cursor = '[]'", 'saved_searches_cursor_check'],
            ["UPDATE saved_search_matches SET match_key = 'raw:12'", 'saved_search_matches_key_check'],
            ['UPDATE saved_search_digests SET read_revision = 2', 'saved_search_digests_read_check'],
            ["UPDATE saved_search_digests SET baseline_preference = '[]'", 'saved_search_digests_epoch_check'],
        ];
        for (const [sql, constraint] of checks) await assert.rejects(pg.exec(sql), (error) => error.message.includes(constraint));
        await pg.exec("DELETE FROM saved_searches WHERE id = 'test-search'");
        assert.equal((await pg.query('SELECT * FROM saved_search_matches')).rows.length, 0);
        assert.equal((await pg.query('SELECT * FROM saved_search_digests')).rows.length, 0);
        for (let i = 0; i < tables.length; i += 1) assert.deepEqual((await pg.query(`SELECT * FROM ${tables[i]}`)).rows, before[i], tables[i]);
    } finally { await pg.close(); }
});
