import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGovernedPilotRelease } from '../scripts/generate_governed_pilot_release.mjs';
import { createProductionSchemaRehearsal } from './fixtures/productionSchemaRehearsal.mjs';

test('exact release SQL rejects wrong target and drift, rolls back interruption, and retries once', async t => {
    const r = await createProductionSchemaRehearsal(t);
    await r.applyFeatureUpgrade();
    const engine = (await r.pg.query("SELECT current_setting('server_version_num')::int / 10000 AS major")).rows[0].major;
    const target = { branch_id: 'fixture-release-only', database: 'postgres', runtime_role: 'postgres', server_major: engine };
    await r.pg.query("SELECT set_config('neon.branch_id',$1,false)", [target.branch_id]);
    const sourceRevision = '1'.repeat(40);
    const plan = await generateGovernedPilotRelease({ sourceRevision, target });
    const run = batch => r.pg.transaction(async pg => {
        for (const setup of batch.setup) await pg.exec(setup);
        await pg.exec(batch.sql);
    });
    const before = await r.capture();
    const history = await r.readHistory();
    await assert.rejects(run({ ...plan, sql: plan.sql.replace("'fixture-release-only'", "'wrong-target'") }), /Wrong release target/);
    await r.pg.exec('ALTER TABLE users ADD COLUMN release_drift_test integer');
    await assert.rejects(run(plan), /Legacy schema drift/);
    await r.pg.exec('ALTER TABLE users DROP COLUMN release_drift_test');
    const failure = await generateGovernedPilotRelease({ sourceRevision, target, failAfterFirst: true });
    await assert.rejects(run(failure), /EXPECTED_REHEARSAL_INTERRUPTION/);
    assert.deepEqual(await r.capture(), before);
    assert.deepEqual(await r.readHistory(), history);
    await run(plan);
    const installed = await r.capture();
    assert.deepEqual(installed.tables.filter(table => before.tables.some(old => old.name === table.name)), before.tables);
    assert.equal(installed.tables.length, before.tables.length + 10);
    const installedHistory = await r.readHistory();
    assert.equal(installedHistory.length, history.length + 2);
    await run(plan);
    assert.deepEqual(await r.capture(), installed);
    assert.deepEqual(await r.readHistory(), installedHistory);
    assert.equal((await r.pg.query('SELECT count(*)::int AS n FROM platform_access_settings')).rows[0].n, 0);
});
