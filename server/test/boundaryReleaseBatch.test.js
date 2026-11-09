import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createProductionSchemaRehearsal } from './fixtures/productionSchemaRehearsal.mjs';
import { generateGovernedPilotRelease } from '../scripts/generate_governed_pilot_release.mjs';
import { generatePermissionFirstRelease } from '../scripts/generate_permission_first_release.mjs';
import {
    boundaryReleasePreflightQuery,
    generateBoundaryLibraryRelease,
} from '../scripts/generate_boundary_library_release.mjs';

const revision = 'b'.repeat(40);
async function fixture(t) {
    const pg = new PGlite();
    t.after(() => pg.close());
    await pg.exec(`CREATE TABLE users(id integer PRIMARY KEY);
        CREATE TABLE my_maps(id integer PRIMARY KEY);
        CREATE TABLE retained_fixture(id serial PRIMARY KEY, value text NOT NULL);
        INSERT INTO retained_fixture(value) VALUES('unchanged fixture');
        CREATE SCHEMA carearound_release;
        CREATE TABLE carearound_release.schema_changes(
          change_id text PRIMARY KEY,kind text NOT NULL,
          sha256 text NOT NULL,source_revision text NOT NULL,
          recorded_at timestamptz NOT NULL DEFAULT now(),details jsonb NOT NULL);
        INSERT INTO carearound_release.schema_changes VALUES
          ('fixture-baseline','observed_baseline',repeat('a',64),repeat('a',40),now(),'{}');
        SELECT set_config('neon.branch_id','fixture-release-only',false);`);
    const manifest = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    const predecessor = manifest.migrations.at(-2);
    const receipt = { change_id: predecessor.id, kind: 'executed_migration', sha256: predecessor.sha256, source_revision: '2'.repeat(40) };
    await pg.query('INSERT INTO carearound_release.schema_changes(change_id,kind,sha256,source_revision,details) VALUES($1,$2,$3,$4,$5)',
        [receipt.change_id, receipt.kind, receipt.sha256, receipt.source_revision, '{}']);
    const capture = async () => (await pg.query(boundaryReleasePreflightQuery)).rows[0].boundary_release_preflight;
    const baseline = await capture();
    const options = { sourceRevision: revision, baseline, observedAtUtc: new Date().toISOString(), predecessorReceipt: receipt,
        recovery: { verifiedAtUtc: new Date().toISOString(), recoveryPointId: 'disposable-recreated-fixture',
            restoreEvidenceSha256: 'f'.repeat(64) } };
    const plan = await generateBoundaryLibraryRelease(options);
    const run = candidate => pg.transaction(async db => {
        for (const setup of candidate.setup) await db.exec(setup);
        await db.exec(candidate.sql);
    });
    return { pg, capture, baseline, options, plan, run };
}

test('boundary guarded batch installs atomically, checks complete schema and preserves exact history on repeat', async t => {
    const r = await fixture(t);
    const beforeRows = (await r.pg.query('SELECT * FROM retained_fixture')).rows;
    await r.run(r.plan);
    const installed = await r.capture();
    assert.equal(installed.catalog.tables.length, r.baseline.catalog.tables.length + 6);
    assert.equal(installed.catalog.sequences.length, r.baseline.catalog.sequences.length + 2);
    assert.equal(installed.history.length, r.baseline.history.length + 1);
    assert.deepEqual(installed.history.find(row => row.change_id === r.plan.id), {
        change_id: r.plan.id, kind: 'executed_migration', sha256: r.plan.hash, source_revision: revision,
    });
    const ownDetails = (await r.pg.query('SELECT details FROM carearound_release.schema_changes WHERE change_id=$1', [r.plan.id])).rows[0].details;
    assert.deepEqual(ownDetails.recovery, r.options.recovery, 'Persist only the three approved recovery fields');
    assert.deepEqual(ownDetails.predecessor, r.options.predecessorReceipt);
    assert.equal((await r.pg.query(`SELECT count(*)::int AS n FROM boundary_library_items`)).rows[0].n, 0);
    assert.deepEqual((await r.pg.query('SELECT * FROM retained_fixture')).rows, beforeRows);
    const beforeRepeat = (await r.pg.query('SELECT * FROM carearound_release.schema_changes ORDER BY change_id')).rows;
    await r.run(r.plan);
    assert.deepEqual(await r.capture(), installed);
    assert.deepEqual((await r.pg.query('SELECT * FROM carearound_release.schema_changes ORDER BY change_id')).rows, beforeRepeat);
    await r.pg.exec('ALTER TABLE boundary_map_requests DROP COLUMN guidance_cancelled_at');
    await assert.rejects(r.run(r.plan), /Boundary schema mismatch/);
});

test('boundary guards reject target, timeouts, drift, partial objects and unknown provenance without adopting them', async t => {
    const r = await fixture(t);
    await assert.rejects(r.run(await generateBoundaryLibraryRelease({ ...r.options, baseline: { ...r.baseline,
        target: { ...r.baseline.target, branch_id: 'wrong-target' } } })), /Wrong release target/);
    await assert.rejects(r.pg.transaction(db => db.exec(r.plan.sql)), /Release timeouts required/);
    await r.pg.exec('ALTER TABLE retained_fixture ADD COLUMN unexpected integer');
    await assert.rejects(r.run(r.plan), /Baseline schema drift/);
    await r.pg.exec('ALTER TABLE retained_fixture DROP COLUMN unexpected');
    await r.pg.exec('CREATE TABLE boundary_map_requests(id integer)');
    await assert.rejects(r.run(r.plan), /Unjournaled or partial boundary objects/);
    await r.pg.exec('DROP TABLE boundary_map_requests');
    await r.pg.exec("UPDATE carearound_release.schema_changes SET source_revision=repeat('c',40)");
    await assert.rejects(r.run(r.plan), /Prior migration history drift/);
    for (const row of r.baseline.history) await r.pg.query('UPDATE carearound_release.schema_changes SET source_revision=$1 WHERE change_id=$2',
        [row.source_revision, row.change_id]);
    await r.run(r.plan);
    await r.pg.query('DELETE FROM carearound_release.schema_changes WHERE change_id=$1', [r.plan.id]);
    await assert.rejects(r.run(r.plan), /Unjournaled or partial boundary objects/);
});

test('boundary batch upgrades the reconstructed legacy adoption shape through Regional 0011 without repairing its differences', async t => {
    const r = await createProductionSchemaRehearsal(t);
    await r.applyFeatureUpgrade();
    const serverMajor = (await r.pg.query("SELECT current_setting('server_version_num')::int / 10000 AS n")).rows[0].n;
    const target = { branch_id: 'fixture-realistic-baseline', database: 'postgres', runtime_role: 'postgres', server_major: serverMajor };
    await r.pg.query("SELECT set_config('neon.branch_id',$1,false)", [target.branch_id]);
    const run = plan => r.pg.transaction(async pg => {
        for (const setup of plan.setup) await pg.exec(setup);
        await pg.exec(plan.sql);
    });
    await run(await generateGovernedPilotRelease({ sourceRevision: '1'.repeat(40), target }));
    await run(await generatePermissionFirstRelease({ sourceRevision: '2'.repeat(40), target }));
    await r.pg.exec(await readFile(new URL('../drizzle/0011_regional_discovery.sql', import.meta.url), 'utf8'));
    const regional = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'))
        .migrations.find(row => row.id === '0011_regional_discovery');
    await r.pg.query('INSERT INTO carearound_release.schema_changes(change_id,kind,sha256,source_revision,details) VALUES($1,$2,$3,$4,$5)',
        [regional.id, 'executed_migration', regional.sha256, '3'.repeat(40), '{}']);
    const baseline = (await r.pg.query(boundaryReleasePreflightQuery)).rows[0].boundary_release_preflight;
    const predecessorReceipt = baseline.history.find(row => row.change_id === regional.id);
    const plan = await generateBoundaryLibraryRelease({ sourceRevision: revision, baseline, predecessorReceipt,
        observedAtUtc: new Date().toISOString(), recovery: { verifiedAtUtc: new Date().toISOString(),
            recoveryPointId: 'reconstructed-disposable-schema', restoreEvidenceSha256: 'f'.repeat(64) } });
    await run(plan);
    const after = (await r.pg.query(boundaryReleasePreflightQuery)).rows[0].boundary_release_preflight;
    assert.deepEqual(after.catalog.tables.filter(row => !plan.tableNames.includes(row.name)), baseline.catalog.tables);
    assert.deepEqual(after.catalog.sequences.filter(row => !plan.sequenceNames.includes(row.name)), baseline.catalog.sequences);
    assert.equal(after.history.length, baseline.history.length + 1);
    await run(plan);
    assert.deepEqual((await r.pg.query(boundaryReleasePreflightQuery)).rows[0].boundary_release_preflight, after);
});

test('boundary interruption rolls back all six tables, sequences and history; lock-failure branch performs no writes', async t => {
    const r = await fixture(t);
    const failure = await generateBoundaryLibraryRelease({ ...r.options, failAfterMigration: true });
    await assert.rejects(r.run(failure), /EXPECTED_BOUNDARY_RELEASE_INTERRUPTION/);
    assert.deepEqual(await r.capture(), r.baseline);
    // PGlite owns one backend. This forces the lock-failure branch; it is not a
    // multi-session PostgreSQL lock-contention rehearsal.
    const lockDenied = { ...r.plan, sql: r.plan.sql.replace('pg_catalog.pg_try_advisory_xact_lock(20260907,3006)', 'false') };
    await assert.rejects(r.run(lockDenied), /Another migration is running/);
    assert.deepEqual(await r.capture(), r.baseline);
});

test('boundary generator rejects stale, unsupported and malformed release metadata', async t => {
    const r = await fixture(t);
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, sourceRevision: 'main' }));
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, observedAtUtc: '2020-01-01T00:00:00Z' }), /Fresh/);
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, recovery: {} }), /recovery/i);
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, baseline: { ...r.baseline, querySha256: 'f'.repeat(64) } }), /query/);
    const ordinal = r.plan.id.slice(0,4);
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, baseline: { ...r.baseline,
        history: [...r.baseline.history, { change_id: ordinal + '_regional_discovery', kind: 'executed_migration',
            sha256: 'c'.repeat(64), source_revision: 'c'.repeat(40) }] } }), /ordinal already belongs/);
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, baseline: { ...r.baseline,
        history: [...r.baseline.history, { change_id: '9999_unknown', kind: 'executed_migration',
            sha256: 'c'.repeat(64), source_revision: 'c'.repeat(40) }] } }), /Later migration history/);
    const oldTime = '2020-01-01T00:00:00Z';
    const stale = await generateBoundaryLibraryRelease({ ...r.options, observedAtUtc: oldTime,
        recovery: { ...r.options.recovery, verifiedAtUtc: oldTime }, now: Date.parse(oldTime) + 1000 });
    await assert.rejects(r.run(stale), /Fresh catalog/);
});

test('recovery metadata rejects extra, nested or free-text fields before producing SQL', async t => {
    const r = await fixture(t);
    for (const extra of [{ extraFixtureMarker: 'not-approved' }, { providerExport: { privateField: 'not-approved' } }]) {
        await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, recovery: { ...r.options.recovery, ...extra } }), /recovery/i);
    }
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, recovery: { ...r.options.recovery,
        recoveryPointId: "$carearound_boundary_release$ ' \\ arbitrary text" } }), /recovery/i);
});

test('delimiter, quotes and backslashes in catalog text cannot escape the outer DO body', async t => {
    const r = await fixture(t);
    const inert = "$carearound_boundary_release$ ' \\ inert";
    await r.pg.exec(`CREATE TYPE quoted_fixture AS ENUM('${inert.replaceAll("'", "''")}');
        CREATE VIEW quoted_view_fixture AS SELECT '${inert.replaceAll("'", "''")}'::text AS value;`);
    const baseline = await r.capture();
    const plan = await generateBoundaryLibraryRelease({ ...r.options, baseline });
    assert.equal(plan.sql.split('$carearound_boundary_release$').length - 1, 2, 'Only the outer wrapper may contain the delimiter');
    assert.equal(JSON.stringify(baseline.catalog.other_relations).includes(inert), false, 'View bodies are hashed in the database');
    const beforeRows = (await r.pg.query('SELECT * FROM retained_fixture')).rows;
    await r.run(plan);
    await r.run(plan);
    assert.deepEqual((await r.pg.query('SELECT * FROM retained_fixture')).rows, beforeRows);
    assert.equal((await r.pg.query('SELECT value FROM quoted_view_fixture')).rows[0].value, inert);
});

test('ordered 0012 requires the exact Regional 0011 adoption and accepted source receipt', async t => {
    const r = await fixture(t);
    assert.equal(r.plan.id, '0012_boundary_library_guided_zones');
    const receipt = r.options.predecessorReceipt;
    assert.equal(receipt.change_id, '0011_regional_discovery');
    assert.equal(receipt.sha256, '71955cb0f33e12042f7859dae1ae8676c639b6d8a4dc27f8876bd9b6de008915');
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, baseline: { ...r.baseline,
        history: r.baseline.history.filter(row => row.change_id !== receipt.change_id) } }), /predecessor/i);
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, predecessorReceipt: undefined }), /predecessor/i);
    for (const wrong of [{ source_revision: 'e'.repeat(40) }, { sha256: 'e'.repeat(64) },
        { kind: 'observed_baseline' }, { change_id: '0011_other_release' }, { providerExport: { notApproved: true } }]) {
        await assert.rejects(generateBoundaryLibraryRelease({ ...r.options,
            predecessorReceipt: { ...receipt, ...wrong } }), /predecessor/i);
    }
    await assert.rejects(generateBoundaryLibraryRelease({ ...r.options, baseline: { ...r.baseline,
        history: r.baseline.history.map(row => row.change_id === receipt.change_id ? { ...row, sha256: 'e'.repeat(64) } : row) } }), /predecessor/i);
    await r.pg.query('UPDATE carearound_release.schema_changes SET source_revision=$1 WHERE change_id=$2', ['e'.repeat(40), receipt.change_id]);
    await assert.rejects(r.run(r.plan), /Prior migration history drift/);
    await r.pg.query('UPDATE carearound_release.schema_changes SET source_revision=$1 WHERE change_id=$2', [receipt.source_revision, receipt.change_id]);
    await r.run(r.plan);
    await r.run(r.plan);
    assert.deepEqual((await r.pg.query('SELECT change_id FROM carearound_release.schema_changes WHERE kind=$1 ORDER BY change_id',
        ['executed_migration'])).rows.map(row => row.change_id), [receipt.change_id, r.plan.id]);
});
