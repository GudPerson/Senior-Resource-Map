import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionSchemaRehearsal, evidenceSha256 } from './fixtures/productionSchemaRehearsal.mjs';

test('captured production-shaped schema: additive adoption, preservation and fail-closed recovery', async t => {
    const r = await createProductionSchemaRehearsal(t);
    const { pg } = r;
    await pg.exec("INSERT INTO users (id, username, email, password_hash, name, role) VALUES " +
        "(1,'rehearsal','rehearsal@example.test','synthetic-only','Synthetic owner','standard')," +
        "(2,'REHEARSAL','REHEARSAL@example.test','synthetic-only','Synthetic legacy admin','admin')," +
        "(3,'partner-fixture','partner@example.test','synthetic-only','Synthetic partner','partner');" +
        "INSERT INTO hard_assets (id,name,lat,lng,address,partner_id) VALUES " +
        "(1,'Synthetic place',1.3,103.8,'Synthetic address',NULL),(3,'Synthetic partner place',1.3,103.8,'Synthetic address',3);" +
        "INSERT INTO soft_assets (id,name,calendar_enabled,calendar_revision,partner_id) VALUES " +
        "(1,'Synthetic offering',true,1,NULL),(3,'Synthetic partner offering',false,0,3);" +
        "INSERT INTO user_favorites (id,user_id,resource_type,resource_id,snapshot) VALUES (1,1,'soft',1,'{\"name\":\"Synthetic saved snapshot\"}');" +
        "INSERT INTO my_maps (id,user_id,name) VALUES (1,1,'Synthetic private map');" +
        "INSERT INTO my_map_assets (map_id,resource_type,resource_id) VALUES (1,'soft',1);" +
        "INSERT INTO notification_preferences (user_id,channel,category,enabled,delivery_allowed) VALUES (1,'in_app','general',false,false);" +
        "INSERT INTO user_calendar_items (user_id,item_type,soft_asset_id,title,starts_at,source_revision) " +
        "VALUES (1,'planned_session',1,'Synthetic existing plan','2026-09-10T01:00:00Z',1);" +
        "INSERT INTO user_calendar_schedule_states (user_id,soft_asset_id,last_seen_revision) VALUES (1,1,1);" +
        "INSERT INTO subregions (id,subregion_code,name,postal_patterns) VALUES (10,'SR-SYN','Synthetic Subregion','545610');");
    const before = await r.capture();
    const rowsBefore = await r.captureRows();
    const count = async table => (await pg.query('SELECT count(*)::int AS n FROM ' + table)).rows[0].n;
    const isolated = async work => {
        await pg.exec('BEGIN');
        try { await work(); } finally { await pg.exec('ROLLBACK'); }
    };

    await t.test('all 60 existing tables/604 columns match the captured production fingerprints', async () => {
        assert.equal(before.tables.length, 60);
        assert.equal(before.tables.reduce((sum, table) => sum + table.columns_count, 0), 604);
        assert.equal(before.tables.reduce((sum, table) => sum + table.constraints_count, 0), 195);
        assert.equal(before.tables.reduce((sum, table) => sum + table.indexes_count, 0), 207);
        assert.deepEqual(before.migration_tables, []);
        assert.equal(await count('users'), 3);
        // Case-colliding SYNTHETIC identifiers prove 0001 is neither required nor smuggled into this upgrade.
        assert.equal((await pg.query("SELECT count(*)::int AS n FROM users WHERE lower(username)='rehearsal'")).rows[0].n, 2);
    });
    await t.test('unexpected existing schema drift stops before any feature DDL', async () => {
        await pg.exec('ALTER TABLE users ADD COLUMN unexpected_rehearsal_column integer');
        try { await assert.rejects(r.applyFeatureUpgrade(), /Existing schema drift/); }
        finally { await pg.exec('ALTER TABLE users DROP COLUMN unexpected_rehearsal_column'); }
        assert.deepEqual(await r.capture(), before);
    });
    await t.test('unjournaled feature objects fail closed rather than being silently adopted', async () => {
        await pg.exec('CREATE TABLE support_conversations (id text)');
        try { await assert.rejects(r.applyFeatureUpgrade(), /Unjournaled\/partial/); }
        finally { await pg.exec('DROP TABLE support_conversations'); }
        assert.deepEqual(await r.capture(), before);
    });
    await t.test('changed SQL or migration ordering is rejected', async () => {
        const changed = r.features.map((migration, index) => index === 0 ? { ...migration, sql: migration.sql + '\n-- unreviewed change' } : migration);
        await assert.rejects(r.applyFeatureUpgrade({ suppliedFeatures: changed }), /Migration hash\/order mismatch/);
        await assert.rejects(r.applyFeatureUpgrade({ suppliedFeatures: [...r.features].reverse() }), /Migration hash\/order mismatch/);
        assert.deepEqual(await r.capture(), before);
    });
    await t.test('an existing unknown migration journal blocks adoption', async () => {
        await pg.exec('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id integer)');
        try { await assert.rejects(r.applyFeatureUpgrade(), /Unreviewed migration journal/); }
        finally { await pg.exec('DROP TABLE drizzle.__drizzle_migrations; DROP SCHEMA drizzle'); }
        assert.deepEqual(await r.capture(), before);
    });
    await t.test('failure after 0005 rolls back feature DDL and the proposed journal atomically', async () => {
        await assert.rejects(r.applyFeatureUpgrade({ failAfter: '0005_notification_updates' }), /Injected interruption/);
        assert.deepEqual(await r.capture(), before);
        assert.deepEqual(await r.captureRows(), rowsBefore);
        assert.equal((await pg.query("SELECT to_regnamespace('carearound_release') IS NULL AS absent")).rows[0].absent, true);
    });
    await t.test('successful retry applies only 0003–0007 and preserves all existing table rows and definitions', async () => {
        assert.deepEqual(await r.applyFeatureUpgrade(), { applied: 5, verifiedAlreadyApplied: false });
        const after = await r.capture();
        assert.equal(after.tables.length, 74);
        assert.deepEqual(after.tables.filter(table => before.tables.some(old => old.name === table.name)), before.tables);
        assert.deepEqual(after.enums, before.enums);
        assert.deepEqual(await r.captureRows(), rowsBefore);
        const history = await r.readHistory();
        assert.equal(history.length, 6);
        assert.equal(history.filter(row => row.kind === 'executed_migration').length, 5);
        assert.equal(history.find(row => row.kind === 'observed_baseline').sha256, evidenceSha256);
        assert.ok(history.every(row => !/^000[012]_/.test(row.change_id)));
    });
    await t.test('completed retry verifies state without rerunning SQL or duplicating history', async () => {
        const historyBefore = (await pg.query('SELECT * FROM carearound_release.schema_changes ORDER BY change_id')).rows;
        assert.deepEqual(await r.applyFeatureUpgrade(), { applied: 0, verifiedAlreadyApplied: true });
        assert.deepEqual((await pg.query('SELECT * FROM carearound_release.schema_changes ORDER BY change_id')).rows, historyBefore);
        assert.deepEqual(await r.captureRows(), rowsBefore);
    });
    await t.test('partial or mismatched history and altered installed feature schema stop retries', async () => {
        const migration = r.features[0];
        await pg.query('UPDATE carearound_release.schema_changes SET sha256=$1 WHERE change_id=$2', ['a'.repeat(64), migration.id]);
        try { await assert.rejects(r.applyFeatureUpgrade(), /Partial, changed or unknown/); }
        finally { await pg.query('UPDATE carearound_release.schema_changes SET sha256=$1 WHERE change_id=$2', [migration.sha256, migration.id]); }
        await pg.exec('ALTER TABLE guide_conversations ADD COLUMN unexpected_rehearsal_column integer');
        try { await assert.rejects(r.applyFeatureUpgrade(), { code: 'ERR_ASSERTION' }); }
        finally { await pg.exec('ALTER TABLE guide_conversations DROP COLUMN unexpected_rehearsal_column'); }
        await pg.exec("INSERT INTO carearound_release.schema_changes (change_id,kind,sha256,source_revision,details) " +
            "SELECT 'unknown-rehearsal',kind,sha256,source_revision,details FROM carearound_release.schema_changes LIMIT 1");
        try { await assert.rejects(r.applyFeatureUpgrade(), /Partial, changed or unknown/); }
        finally { await pg.exec("DELETE FROM carearound_release.schema_changes WHERE change_id='unknown-rehearsal'"); }
    });

    await pg.exec("INSERT INTO support_conversations (id,owner_user_id,title) VALUES ('conversation',1,'Synthetic report');" +
        "INSERT INTO support_fix_proposals (id,conversation_id,source_revision,target,summary,test_evidence,proposed_by_user_id,approved_by_user_id) " +
        "VALUES ('proposal','conversation',repeat('a',40),'client','Synthetic proposal','Synthetic test',2,2);" +
        "INSERT INTO support_messages (conversation_id,sequence,request_key,author_kind,author_user_id,body) VALUES ('conversation',1,'synthetic-request','user',1,'Synthetic message');" +
        "INSERT INTO guide_conversations (id,owner_user_id,slot,title,inputs,last_request_id) VALUES ('guide',1,0,'Synthetic guide','[{\"question\":\"Synthetic question\"}]','synthetic-request');" +
        "INSERT INTO notification_resource_jobs (user_id) VALUES (1);" +
        "INSERT INTO notification_resource_watches (id,favorite_id,baseline) VALUES ('watch',1,'{}');" +
        "INSERT INTO user_notifications (id,watch_id,categories,changed_fields) VALUES ('notice','watch','[\"calendar\"]','[\"schedule\"]');" +
        "INSERT INTO saved_searches (id,user_id,slot,query,resource_type) VALUES ('search',1,1,'synthetic keywords','all');" +
        "INSERT INTO saved_search_matches (search_id,match_key) VALUES ('search',repeat('a',64));" +
        "INSERT INTO saved_search_digests (search_id,notice_id,search_revision,baseline_preference) VALUES ('search','digest',1,'{}');" +
        "INSERT INTO regions (id,name) VALUES (10,'Synthetic Region');" +
        "INSERT INTO region_postal_codes (region_id,postal_code) VALUES (10,'545610');" +
        "INSERT INTO region_subregions (region_id,subregion_id) VALUES (10,10);" +
        "INSERT INTO unmapped_postal_codes (postal_code) VALUES ('000123');");
    await t.test('all 27 feature CHECK constraints reject invalid synthetic state', async () => {
        const violations = [
            ["UPDATE support_conversations SET owner_user_id=NULL", 'support_conversations_owner_check'],
            ["UPDATE support_conversations SET status='bad'", 'support_conversations_status_check'],
            ['UPDATE support_conversations SET revision=0', 'support_conversations_read_check'],
            ["UPDATE support_fix_proposals SET target='bad'", 'support_fix_proposals_target_check'],
            ["UPDATE support_fix_proposals SET source_revision='bad'", 'support_fix_proposals_revision_check'],
            ['UPDATE support_fix_proposals SET verified_at=now()', 'support_fix_proposals_verification_check'],
            ["UPDATE support_messages SET author_kind='bad'", 'support_messages_author_check'],
            ['UPDATE support_messages SET sequence=0', 'support_messages_sequence_check'],
            ['UPDATE guide_conversations SET slot=20', 'guide_conversations_slot_check'],
            ['UPDATE guide_conversations SET revision=0', 'guide_conversations_revision_check'],
            ["UPDATE guide_conversations SET inputs='[]'", 'guide_conversations_inputs_check'],
            ['UPDATE notification_resource_jobs SET favorite_cursor=-1', 'notification_resource_jobs_cursor_check'],
            ["UPDATE notification_resource_jobs SET lease_id='unpaired'", 'notification_resource_jobs_lease_check'],
            ["UPDATE notification_resource_watches SET baseline='[]'", 'notification_resource_watches_baseline_check'],
            ['UPDATE notification_resource_watches SET control_revision=0', 'notification_resource_watches_control_check'],
            ["UPDATE user_notifications SET categories='[\"general\"]'", 'user_notifications_category_check'],
            ["UPDATE user_notifications SET changed_fields='[\"privateNote\"]'", 'user_notifications_fields_check'],
            ['UPDATE user_notifications SET read_revision=2', 'user_notifications_read_check'],
            ['UPDATE saved_searches SET slot=11', 'saved_searches_slot_check'],
            ["UPDATE saved_searches SET resource_type='bad'", 'saved_searches_criteria_check'],
            ['UPDATE saved_searches SET scan_page=0', 'saved_searches_progress_check'],
            ["UPDATE saved_searches SET lease_id='unpaired'", 'saved_searches_lease_check'],
            ["UPDATE saved_searches SET baseline_preference='[]'", 'saved_searches_preference_check'],
            ["UPDATE saved_searches SET scan_cursor='[]'", 'saved_searches_cursor_check'],
            ["UPDATE saved_search_matches SET match_key='bad'", 'saved_search_matches_key_check'],
            ['UPDATE saved_search_digests SET read_revision=2', 'saved_search_digests_read_check'],
            ["UPDATE saved_search_digests SET baseline_preference='[]'", 'saved_search_digests_epoch_check'],
        ];
        const checks = (await pg.query("SELECT conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.contype='c' AND t.relname=ANY($1)", [r.featureNames])).rows.map(c => c.conname).sort();
        assert.deepEqual(checks, violations.map(v => v[1]).sort());
        for (const [sql, constraint] of violations) await assert.rejects(pg.exec(sql), error => error.code === '23514' && error.message.includes(constraint));
    });
    await t.test('all 16 feature foreign keys reject orphaned records', async () => {
        const orphanUpdates = [
            'UPDATE support_conversations SET owner_user_id=999',
            "UPDATE support_fix_proposals SET conversation_id='missing'",
            'UPDATE support_fix_proposals SET proposed_by_user_id=999',
            'UPDATE support_fix_proposals SET approved_by_user_id=999',
            "UPDATE support_messages SET conversation_id='missing'",
            'UPDATE support_messages SET author_user_id=999',
            'UPDATE guide_conversations SET owner_user_id=999',
            'UPDATE notification_resource_jobs SET user_id=999',
            'UPDATE notification_resource_watches SET favorite_id=999',
            "UPDATE user_notifications SET watch_id='missing'",
            'UPDATE saved_searches SET user_id=999',
            "UPDATE saved_search_matches SET search_id='missing'",
            "UPDATE saved_search_digests SET search_id='missing'",
            'UPDATE region_postal_codes SET region_id=999',
            'UPDATE region_subregions SET region_id=999',
            'UPDATE region_subregions SET subregion_id=999',
        ];
        const actual = (await pg.query("SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.contype='f' AND t.relname=ANY($1)", [r.featureNames])).rows[0].n;
        assert.equal(actual, orphanUpdates.length);
        for (const sql of orphanUpdates) await assert.rejects(pg.exec(sql), { code: '23503' });
    });
    await t.test('all ten non-primary unique indexes reject duplicate feature identities', async () => {
        const duplicates = [
            "INSERT INTO support_messages (conversation_id,sequence,request_key,author_kind,body) VALUES ('conversation',2,'synthetic-request','system','Synthetic duplicate')",
            "INSERT INTO guide_conversations (id,owner_user_id,slot,title,inputs,last_request_id) VALUES ('guide-other',1,0,'Synthetic duplicate','[{}]','other')",
            "INSERT INTO notification_resource_watches (id,favorite_id,baseline) VALUES ('watch-other',1,'{}')",
            "INSERT INTO user_notifications (id,watch_id,categories,changed_fields) VALUES ('notice-other','watch','[\"calendar\"]','[\"schedule\"]')",
            "INSERT INTO saved_searches (id,user_id,slot,query,resource_type) VALUES ('search-other',1,1,'different keywords','all')",
            "INSERT INTO saved_searches (id,user_id,slot,query,resource_type) VALUES ('search-other',1,2,'synthetic keywords','all')",
        ];
        for (const sql of duplicates) await assert.rejects(pg.exec(sql), { code: '23505' });
        await pg.exec("INSERT INTO support_conversations (id,guest_token_hash,guest_expires_at,title) VALUES ('guest',repeat('b',64),now()+interval '1 day','Synthetic guest')");
        try {
            await assert.rejects(pg.exec("INSERT INTO support_conversations (id,guest_token_hash,guest_expires_at,title) VALUES ('guest-other',repeat('b',64),now()+interval '1 day','Synthetic duplicate')"), { code: '23505' });
        } finally { await pg.exec("DELETE FROM support_conversations WHERE id='guest'"); }
        await assert.rejects(pg.exec("INSERT INTO regions (id,name) VALUES (11,'Synthetic Region')"), { code: '23505' });
        await pg.exec("INSERT INTO regions (id,name) VALUES (11,'Second Synthetic Region')");
        try {
            await assert.rejects(pg.exec("INSERT INTO region_postal_codes (region_id,postal_code) VALUES (11,'545610')"), { code: '23505' });
            await assert.rejects(pg.exec("INSERT INTO region_subregions (region_id,subregion_id) VALUES (11,10)"), { code: '23505' });
        } finally { await pg.exec('DELETE FROM regions WHERE id=11'); }
        assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid WHERE i.indisunique AND NOT i.indisprimary AND t.relname=ANY($1)", [r.featureNames])).rows[0].n, 10);
    });
    await t.test('unsave removes only its watch/notice, retaining existing map and Calendar plan', async () => {
        await isolated(async () => {
            await pg.exec('DELETE FROM user_favorites WHERE id=1');
            assert.equal(await count('notification_resource_watches'), 0);
            assert.equal(await count('user_notifications'), 0);
            for (const table of ['my_maps', 'my_map_assets', 'user_calendar_items', 'user_calendar_schedule_states']) assert.equal(await count(table), 1);
            assert.equal(await count('support_conversations'), 1);
            assert.equal(await count('saved_searches'), 1);
        });
    });
    await t.test('legacy partner CASCADE and feature staff SET NULL behavior are retained', async () => {
        await isolated(async () => {
            await pg.exec('DELETE FROM users WHERE id=3');
            assert.equal((await pg.query('SELECT id FROM hard_assets WHERE id=3')).rows.length, 0);
            assert.equal((await pg.query('SELECT id FROM soft_assets WHERE id=3')).rows.length, 0);
            await pg.exec('DELETE FROM users WHERE id=2');
            const proposal = (await pg.query('SELECT proposed_by_user_id, approved_by_user_id FROM support_fix_proposals')).rows[0];
            assert.deepEqual(proposal, { proposed_by_user_id: null, approved_by_user_id: null });
            assert.equal(await count('support_conversations'), 1);
        });
    });
    await t.test('owner deletion removes only owned feature state via declared foreign keys', async () => {
        await isolated(async () => {
            await pg.exec('DELETE FROM users WHERE id=1');
            for (const table of r.featureNames.filter(table => !['regions', 'region_postal_codes', 'region_subregions', 'unmapped_postal_codes'].includes(table))) {
                assert.equal(await count(table), 0, table);
            }
            for (const table of ['regions', 'region_postal_codes', 'region_subregions', 'unmapped_postal_codes']) {
                assert.equal(await count(table), 1, table);
            }
            assert.equal(await count('users'), 2);
            assert.equal(await count('carearound_release.schema_changes'), 6);
        });
    });
    await t.test('rollback-by-retention needs no down migration and preserves private state', async () => {
        const featureCounts = await Promise.all(r.featureNames.map(count));
        assert.ok(featureCounts.every(n => n === 1));
        assert.deepEqual(await r.applyFeatureUpgrade(), { applied: 0, verifiedAlreadyApplied: true });
        assert.deepEqual(await Promise.all(r.featureNames.map(count)), featureCounts);
        assert.deepEqual(await r.captureRows(), rowsBefore);
        assert.equal((await r.capture()).migration_tables.length, 0, 'No fictitious Drizzle history');
        t.diagnostic('Local catalog parity: 60 tables, 604 columns, 195 constraints, 207 indexes; 5 migrations, 14 new tables, 27 CHECKs, 16 FKs. No provider or runtime rollout was performed.');
    });
});
