import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGovernedPilotRelease } from '../scripts/generate_governed_pilot_release.mjs';
import { generatePermissionFirstRelease } from '../scripts/generate_permission_first_release.mjs';
import { createProductionSchemaRehearsal } from './fixtures/productionSchemaRehearsal.mjs';

test('permission-first release rejects drift, rolls back interruption, and installs exactly once', async t => {
    const r = await createProductionSchemaRehearsal(t);
    await r.applyFeatureUpgrade();
    const engine = (await r.pg.query("SELECT current_setting('server_version_num')::int / 10000 AS major")).rows[0].major;
    const target = { branch_id: 'fixture-release-only', database: 'postgres', runtime_role: 'postgres', server_major: engine };
    await r.pg.query("SELECT set_config('neon.branch_id',$1,false)", [target.branch_id]);
    const governedPlan = await generateGovernedPilotRelease({ sourceRevision: '1'.repeat(40), target });
    const run = plan => r.pg.transaction(async pg => {
        for (const setup of plan.setup) await pg.exec(setup);
        await pg.exec(plan.sql);
    });
    await run(governedPlan);

    const sourceRevision = '2'.repeat(40);
    const plan = await generatePermissionFirstRelease({ sourceRevision, target });
    const before = await r.capture();
    const history = await r.readHistory();
    const accessBefore = (await r.pg.query('SELECT to_jsonb(p) AS value FROM platform_access_settings p ORDER BY id')).rows;

    await assert.rejects(run({ ...plan, sql: plan.sql.replace("'fixture-release-only'", "'wrong-target'") }), /Wrong release target/);
    await r.pg.exec('ALTER TABLE platform_access_settings ADD COLUMN release_drift_test integer');
    await assert.rejects(run(plan), /Governed pilot schema drift/);
    await r.pg.exec('ALTER TABLE platform_access_settings DROP COLUMN release_drift_test');

    const failure = await generatePermissionFirstRelease({ sourceRevision, target, failAfterMigration: true });
    await assert.rejects(run(failure), /EXPECTED_PERMISSION_RELEASE_INTERRUPTION/);
    assert.deepEqual(await r.capture(), before);
    assert.deepEqual(await r.readHistory(), history);

    await run(plan);
    const installed = await r.capture();
    assert.equal(installed.tables.length, before.tables.length + 1);
    assert.equal(installed.tables.some(table => table.name === 'resource_publication_permissions'), true);
    assert.equal((await r.pg.query('SELECT count(*)::int AS n FROM resource_publication_permissions')).rows[0].n, 0);
    assert.deepEqual((await r.pg.query('SELECT to_jsonb(p) AS value FROM platform_access_settings p ORDER BY id')).rows, accessBefore);
    const installedHistory = await r.readHistory();
    assert.equal(installedHistory.length, history.length + 1);
    assert.deepEqual(installedHistory.find(item => item.change_id === plan.id), {
        change_id: plan.id,
        kind: 'executed_migration',
        sha256: plan.hash,
        source_revision: sourceRevision,
    });

    await run(plan);
    assert.deepEqual(await r.capture(), installed);
    assert.deepEqual(await r.readHistory(), installedHistory);
});
