import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildNeonFeatureAdoption, adoptionTargets } from '../scripts/generate_neon_feature_adoption.mjs';
import { createProductionSchemaRehearsal } from './fixtures/productionSchemaRehearsal.mjs';

test('approved adoption emits one guarded DDL batch and preserves legacy schema through failure and retry', async t => {
    const production = await buildNeonFeatureAdoption({ target: 'production' });
    const rehearsal = await buildNeonFeatureAdoption({ target: 'rehearsal' });
    const failure = await buildNeonFeatureAdoption({ target: 'rehearsal', failAfter: '0005_notification_updates' });
    assert.equal(production.sha256, createHash('sha256').update(production.sql).digest('hex'));
    assert.ok(production.sql.includes(adoptionTargets.production));
    assert.ok(!production.sql.includes(adoptionTargets.rehearsal));
    assert.match(production.sql, /SET statement_timeout = '15s';\nSET lock_timeout = '2s';\nDO \$carearound_adoption\$/);
    assert.ok(!production.sql.includes('CREATE TABLE IF NOT EXISTS "users"'));
    assert.ok(!production.sql.includes('DROP TABLE'));
    assert.ok(!production.sql.includes('BEGIN;'));
    assert.ok(!production.sql.includes('COMMIT;'));
    await assert.rejects(buildNeonFeatureAdoption({ target: 'unknown' }), /exact production or rehearsal/);
    await assert.rejects(buildNeonFeatureAdoption({ target: 'production', failAfter: '0005_notification_updates' }), /rehearsal-only/);
    const r = await createProductionSchemaRehearsal(t);
    const identity = (await r.pg.query('SELECT current_database() AS db, current_user AS role')).rows[0];
    // Only local tests replace engine/role/database guards; emitted production SQL remains untouched.
    const local = sql => sql.replace("current_database() <> 'neondb'", `current_database() <> '${identity.db}'`)
        .replace("current_user <> 'neondb_owner'", `current_user <> '${identity.role}'`)
        .replace("current_setting('server_version_num')::int / 10000 <> 17", "current_setting('server_version_num')::int / 10000 <> 18");
    const before = await r.capture();
    const rows = await r.captureRows();
    await r.pg.query("SELECT set_config('neon.branch_id',$1,false)", [adoptionTargets.rehearsal]);
    await assert.rejects(r.pg.exec(local(production.sql)), /Wrong adoption target/);
    await assert.rejects(r.pg.exec(local(failure.sql)), /EXPECTED_BATCH_REHEARSAL_FAILURE/);
    assert.deepEqual(await r.capture(), before);
    assert.equal((await r.pg.query("SELECT to_regnamespace('carearound_release') IS NULL AS absent")).rows[0].absent, true);
    await r.pg.exec(local(rehearsal.sql));
    assert.equal((await r.capture()).tables.length, 70);
    assert.deepEqual((await r.capture()).tables.filter(t => before.tables.some(old => old.name === t.name)), before.tables);
    assert.deepEqual(await r.captureRows(), rows);
    const recorded = (await r.pg.query('SELECT * FROM carearound_release.schema_changes ORDER BY change_id')).rows;
    await r.pg.exec(local(rehearsal.sql));
    assert.deepEqual((await r.pg.query('SELECT * FROM carearound_release.schema_changes ORDER BY change_id')).rows, recorded);
    await r.pg.exec("UPDATE carearound_release.schema_changes SET sha256=repeat('0',64) WHERE kind='observed_baseline'");
    await assert.rejects(r.pg.exec(local(rehearsal.sql)), /Partial or changed adoption history/);
    assert.equal((await r.capture()).tables.length, 70);
});
