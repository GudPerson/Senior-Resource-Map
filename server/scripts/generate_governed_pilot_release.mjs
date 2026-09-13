// Produces a reviewed SQL batch only. This module never connects to Neon.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const ids = ['0008_platform_access_settings', '0009_governed_care_maps'];
const hashes = [
    '8e7662a0b0791f7d9b8c7eb3acab415eb3924f45f70d434d10ca8992176021b1',
    '36742b97b8c40f112067f4b0fd458cd866f6dc23125adc63ccf84d1d5c0c4688',
];
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';

export async function generateGovernedPilotRelease({ sourceRevision, target, failAfterFirst = false }) {
    assert.match(sourceRevision, /^[a-f0-9]{40}$/);
    for (const key of ['branch_id', 'database', 'runtime_role']) assert.ok(target?.[key]);
    const serverMajor = target.server_major ?? 17;
    assert.ok([17, 18].includes(serverMajor));
    const before = JSON.parse(await readFile(new URL('../../docs/evidence/governed-pilot-preflight-20260913.json', import.meta.url), 'utf8'));
    const catalog = JSON.parse(await readFile(new URL('../../docs/evidence/guide-inbox-neon-preflight-20260907.json', import.meta.url), 'utf8'));
    const manifest = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    const migrations = await Promise.all(manifest.migrations.map(async item => ({ ...item,
        sql: await readFile(new URL('../' + item.file, import.meta.url), 'utf8'),
    })));
    for (const item of migrations) assert.equal(createHash('sha256').update(item.sql).digest('hex'), item.sha256);
    const additions = migrations.filter(item => ids.includes(item.id));
    assert.deepEqual(additions.map(item => item.id), ids);
    assert.deepEqual(additions.map(item => item.sha256), hashes);
    const featureNames = additions.flatMap(item => [...item.sql.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map(match => match[1]));
    assert.equal(featureNames.length, 10);
    const pg = new PGlite();
    let legacyDigest, featureDigest;
    const catalogQuery = catalog.normalizedQuery.trim().replace(/;$/, '');
    try {
        for (const item of migrations) await pg.exec(item.sql);
        const state = (await pg.query(catalogQuery)).rows[0].carearound_schema_preflight;
        const digest = async value => (await pg.query('SELECT md5($1::jsonb::text) AS hash', [JSON.stringify(value)])).rows[0].hash;
        legacyDigest = await digest({ tables: before.schema.tables, enums: before.schema.enums });
        featureDigest = await digest(state.tables.filter(table => featureNames.includes(table.name)));
    } finally { await pg.close(); }
    const oldNames = before.schema.tables.map(table => table.name);
    const priorHistory = before.history.map(({ change_id, kind, sha256 }) => ({ change_id, kind, sha256 }))
        .sort((a, b) => a.change_id.localeCompare(b.change_id));
    const newHistory = additions.map(item => ({ change_id: item.id, kind: 'executed_migration', sha256: item.sha256 }));
    const capture = `SELECT carearound_schema_preflight INTO actual FROM (${catalogQuery}) captured;`;
    const checkLegacy = `
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO old_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(oldNames)} ? (t->>'name');
    IF md5(jsonb_build_object('tables',old_tables,'enums',actual->'enums')::text) <> ${literal(legacyDigest)}
       OR actual->'migration_tables' <> '[]'::jsonb THEN RAISE EXCEPTION 'Legacy schema drift'; END IF;
    SELECT jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256) ORDER BY change_id)
      INTO history FROM carearound_release.schema_changes WHERE NOT (${json(ids)} ? change_id);
    IF history IS DISTINCT FROM ${json(priorHistory)} THEN RAISE EXCEPTION 'Prior migration history drift'; END IF;`;
    const checkInstalled = `
    ${capture}
    ${checkLegacy}
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO new_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(featureNames)} ? (t->>'name');
    IF md5(new_tables::text) IS DISTINCT FROM ${literal(featureDigest)} OR jsonb_array_length(actual->'tables') <> ${oldNames.length + featureNames.length}
      THEN RAISE EXCEPTION 'Pilot schema mismatch'; END IF;
    SELECT jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256) ORDER BY change_id)
      INTO history FROM carearound_release.schema_changes WHERE ${json(ids)} ? change_id;
    IF history IS DISTINCT FROM ${json(newHistory)} THEN RAISE EXCEPTION 'Pilot migration history mismatch'; END IF;`;
    const body = additions.map((item, index) => `${item.sql}
    INSERT INTO carearound_release.schema_changes (change_id,kind,sha256,source_revision,details)
      VALUES (${literal(item.id)},'executed_migration',${literal(item.sha256)},${literal(sourceRevision)},
        '{"release":"governed-pilot-limited-20260914","scope":"additive schema; pilot disabled"}'::jsonb);
    ${failAfterFirst && index === 0 ? "RAISE EXCEPTION 'EXPECTED_REHEARSAL_INTERRUPTION';" : ''}`).join('\n');
    const sql = `DO $carearound_pilot_release$
DECLARE actual jsonb; old_tables jsonb; new_tables jsonb; history jsonb; installed integer;
BEGIN
    IF current_setting('neon.branch_id',true) IS DISTINCT FROM ${literal(target.branch_id)}
       OR current_database() <> ${literal(target.database)} OR current_user <> ${literal(target.runtime_role)}
       OR current_setting('server_version_num')::int / 10000 <> ${serverMajor} THEN RAISE EXCEPTION 'Wrong release target'; END IF;
    IF current_setting('lock_timeout') <> '2s' OR current_setting('statement_timeout') <> '15s'
      THEN RAISE EXCEPTION 'Release timeouts required'; END IF;
    PERFORM set_config('search_path','public',true);
    IF NOT pg_try_advisory_xact_lock(20260907,3006) THEN RAISE EXCEPTION 'Another migration is running'; END IF;
    ${capture}
    ${checkLegacy}
    SELECT count(*) INTO installed FROM carearound_release.schema_changes WHERE ${json(ids)} ? change_id;
    IF installed = 2 THEN
        ${checkInstalled}
        RETURN;
    ELSIF installed <> 0 THEN RAISE EXCEPTION 'Partial pilot migration history'; END IF;
    IF jsonb_array_length(actual->'tables') <> ${oldNames.length} THEN RAISE EXCEPTION 'Unexpected tables before release'; END IF;
    ${body}
    ${checkInstalled}
    IF EXISTS (SELECT FROM platform_access_settings) THEN RAISE EXCEPTION 'Access settings must remain unchanged'; END IF;
END $carearound_pilot_release$;`;
    return { sql, setup: ["SET LOCAL statement_timeout = '15s'", "SET LOCAL lock_timeout = '2s'"], ids, hashes, featureNames, catalogQuery };
}
