import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createProductionSchemaRehearsal, currentFeatureMigrationIds } from './fixtures/productionSchemaRehearsal.mjs';

test('pilot schema on captured legacy shape: interruption rollback, retry, exact-once history and personal data preservation', async t => {
    const r = await createProductionSchemaRehearsal(t, { featureMigrationIds: [
        ...currentFeatureMigrationIds, '0008_platform_access_settings', '0009_governed_care_maps',
    ] });
    await r.pg.exec(`INSERT INTO users (id,username,email,password_hash,name,role) VALUES
        (1,'fictional-migration','fictional@example.test','fixture-only','Fictional owner','standard');
        INSERT INTO my_maps (user_id,name) VALUES (1,'Fictional preserved personal map');`);
    const before = await r.capture();
    const rows = await r.captureRows();
    await assert.rejects(r.applyFeatureUpgrade({ failAfter: '0008_platform_access_settings' }), /Injected interruption/);
    assert.deepEqual(await r.capture(), before);
    assert.deepEqual(await r.captureRows(), rows);
    assert.deepEqual(await r.applyFeatureUpgrade(), { applied: 7, verifiedAlreadyApplied: false });
    assert.deepEqual(await r.captureRows(), rows);
    const history = await r.readHistory();
    for (const prefix of ['0008_', '0009_']) assert.equal(history.filter(row => row.change_id.startsWith(prefix)).length, 1);
    assert.deepEqual(await r.applyFeatureUpgrade(), { applied: 0, verifiedAlreadyApplied: true });
    assert.deepEqual(await r.readHistory(), history);
    assert.deepEqual(await r.captureRows(), rows);
    t.diagnostic('In-memory captured-schema compatibility only; this does not verify current Neon backups, production locks or provider restoration.');
});

test('only 0008 and 0009 upgrade a schema already carrying 0003 through 0007', async t => {
    const r = await createProductionSchemaRehearsal(t);
    await r.applyFeatureUpgrade();
    const before = await r.capture();
    const historyBefore = await r.readHistory();
    const manifest = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    const migrations = await Promise.all(manifest.migrations.filter(item => /^000[89]_/.test(item.id)).map(async item => {
        const sql = await readFile(new URL('../' + item.file, import.meta.url), 'utf8');
        assert.equal(createHash('sha256').update(sql).digest('hex'), item.sha256);
        return { ...item, sql };
    }));
    async function upgrade(failAfterFirst = false) {
        return r.pg.transaction(async db => {
            for (const [index, migration] of migrations.entries()) {
                const prior = (await db.query('SELECT sha256 FROM carearound_release.schema_changes WHERE change_id=$1', [migration.id])).rows[0];
                if (prior) { assert.equal(prior.sha256, migration.sha256); continue; }
                await db.exec(migration.sql);
                await db.query(`INSERT INTO carearound_release.schema_changes (change_id,kind,sha256,source_revision,details)
                    VALUES ($1,'executed_migration',$2,$3,'{"rehearsalOnly":true}')`,
                [migration.id, migration.sha256, '0'.repeat(40)]);
                if (failAfterFirst && index === 0) throw new Error('Pilot interruption');
            }
        });
    }
    await assert.rejects(upgrade(true), /Pilot interruption/);
    assert.deepEqual(await r.capture(), before);
    assert.deepEqual(await r.readHistory(), historyBefore);
    await upgrade();
    const after = await r.capture();
    assert.deepEqual(after.tables.filter(table => before.tables.some(old => old.name === table.name)), before.tables);
    assert.equal(after.tables.length - before.tables.length, 10);
    const history = await r.readHistory();
    assert.equal(history.length - historyBefore.length, 2);
    await upgrade();
    assert.deepEqual(await r.readHistory(), history);
    assert.deepEqual(await r.capture(), after);
    assert.equal((await r.pg.query('SELECT count(*)::int AS n FROM platform_access_settings')).rows[0].n, 0);
});
