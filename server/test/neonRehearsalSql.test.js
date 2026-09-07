import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildNeonRehearsalSql } from './fixtures/neonRehearsalSql.mjs';
import { createProductionSchemaRehearsal } from './fixtures/productionSchemaRehearsal.mjs';

test('Neon rehearsal SQL retains target guards and atomically validates its exact migration body', async t => {
    const plan = await buildNeonRehearsalSql();
    const r = await createProductionSchemaRehearsal(t);
    const { pg } = r;
    const before = await r.capture();
    const database = (await pg.query('SELECT current_database() AS name')).rows[0].name;
    // Only the local syntax/recovery simulation substitutes the local engine/database.
    // Neither emitted Neon script nor its recorded hash is changed.
    const local = sql => sql.replace("current_database() <> 'neondb'", "current_database() <> '" + database + "'")
        .replace("current_setting('server_version_num')::int / 10000 <> 17", "current_setting('server_version_num')::int / 10000 <> 18");
    assert.match(plan.success, /current_database\(\) <> 'neondb'/);
    assert.match(plan.success, /server_version_num'\)::int \/ 10000 <> 17/);
    assert.match(plan.success, /Rehearsal must contain no application records/);
    await pg.query("SELECT set_config('neon.branch_id',$1,false)", ['production-wrong-target']);
    await assert.rejects(pg.exec(local(plan.success)), /Wrong rehearsal target/);
    await pg.exec('ROLLBACK');
    assert.deepEqual(await r.capture(), before);
    await pg.query("SELECT set_config('neon.branch_id',$1,false)", [plan.branchId]);
    await assert.rejects(pg.exec(local(plan.fail)), /EXPECTED_REHEARSAL_FAILURE_AFTER_0005/);
    await pg.exec('ROLLBACK');
    assert.deepEqual(await r.capture(), before);
    await pg.exec(local(plan.success));
    assert.equal((await r.capture()).tables.length, 70);
    assert.equal((await r.readHistory()).length, 5);
    const validation = await readFile(new URL('./fixtures/neonRehearsalValidation.sql', import.meta.url), 'utf8');
    assert.match(validation, /br-autumn-mode-aikak52t/);
    await pg.exec(local(validation));
    assert.deepEqual((await r.capture()).tables.filter(table => before.tables.some(old => old.name === table.name)), before.tables);
    await assert.rejects(pg.exec(local(plan.success)), /Baseline drift or prior migration state/);
    await pg.exec('ROLLBACK');
    assert.equal((await r.readHistory()).length, 5);
    assert.equal(createHash('sha256').update(plan.success).digest('hex'), plan.successSha256);
    assert.equal(createHash('sha256').update(plan.fail).digest('hex'), plan.failSha256);
});
