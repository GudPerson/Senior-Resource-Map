// Produces a reviewed SQL batch only. This module never connects to Neon.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const pilotIds = ['0008_platform_access_settings', '0009_governed_care_maps'];
const pilotHashes = [
    '8e7662a0b0791f7d9b8c7eb3acab415eb3924f45f70d434d10ca8992176021b1',
    '36742b97b8c40f112067f4b0fd458cd866f6dc23125adc63ccf84d1d5c0c4688',
];
const permissionId = '0010_permission_first_publishing';
const permissionHash = 'c985d339506f1b0bd584de3856c754fa1a5d87166d13f30bd4aa5e5688bb4492';
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';

export async function generatePermissionFirstRelease({ sourceRevision, target, failAfterMigration = false }) {
    assert.match(sourceRevision, /^[a-f0-9]{40}$/);
    for (const key of ['branch_id', 'database', 'runtime_role']) assert.ok(target?.[key]);
    const serverMajor = target.server_major ?? 17;
    assert.ok([17, 18].includes(serverMajor));

    const before = JSON.parse(await readFile(new URL('../../docs/evidence/governed-pilot-preflight-20260914.json', import.meta.url), 'utf8'));
    const catalog = JSON.parse(await readFile(new URL('../../docs/evidence/guide-inbox-neon-preflight-20260907.json', import.meta.url), 'utf8'));
    const manifest = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    const migrations = await Promise.all(manifest.migrations.map(async item => ({
        ...item,
        sql: await readFile(new URL('../' + item.file, import.meta.url), 'utf8'),
    })));
    for (const item of migrations) {
        assert.equal(createHash('sha256').update(item.sql).digest('hex'), item.sha256);
    }

    const pilotMigrations = migrations.filter(item => pilotIds.includes(item.id));
    assert.deepEqual(pilotMigrations.map(item => item.id), pilotIds);
    assert.deepEqual(pilotMigrations.map(item => item.sha256), pilotHashes);
    const permissionMigration = migrations.find(item => item.id === permissionId);
    assert.equal(permissionMigration?.sha256, permissionHash);

    const tableNames = migration => [...migration.sql.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map(match => match[1]);
    const pilotNames = pilotMigrations.flatMap(tableNames);
    const permissionNames = tableNames(permissionMigration);
    assert.equal(pilotNames.length, 10);
    assert.deepEqual(permissionNames, ['resource_publication_permissions']);

    const catalogQuery = catalog.normalizedQuery.trim().replace(/;$/, '');
    const pg = new PGlite();
    let legacyDigest;
    let pilotDigest;
    let permissionDigest;
    try {
        for (const item of migrations) await pg.exec(item.sql);
        const state = (await pg.query(catalogQuery)).rows[0].carearound_schema_preflight;
        const digest = async value => (await pg.query('SELECT md5($1::jsonb::text) AS hash', [JSON.stringify(value)])).rows[0].hash;
        legacyDigest = await digest({ tables: before.schema.tables, enums: before.schema.enums });
        pilotDigest = await digest(state.tables.filter(table => pilotNames.includes(table.name)));
        permissionDigest = await digest(state.tables.filter(table => permissionNames.includes(table.name)));
    } finally {
        await pg.close();
    }

    const oldNames = before.schema.tables.map(table => table.name);
    const priorHistory = [
        ...before.history.map(({ change_id, kind, sha256 }) => ({ change_id, kind, sha256 })),
        ...pilotMigrations.map(item => ({ change_id: item.id, kind: 'executed_migration', sha256: item.sha256 })),
    ].sort((a, b) => a.change_id.localeCompare(b.change_id));
    const capture = `SELECT carearound_schema_preflight INTO actual FROM (${catalogQuery}) captured;`;
    const checkPrior = `
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO old_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(oldNames)} ? (t->>'name');
    IF md5(jsonb_build_object('tables',old_tables,'enums',actual->'enums')::text) <> ${literal(legacyDigest)}
       OR actual->'migration_tables' <> '[]'::jsonb THEN RAISE EXCEPTION 'Legacy schema drift'; END IF;
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO pilot_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(pilotNames)} ? (t->>'name');
    IF md5(pilot_tables::text) IS DISTINCT FROM ${literal(pilotDigest)} THEN RAISE EXCEPTION 'Governed pilot schema drift'; END IF;
    SELECT jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256) ORDER BY change_id)
      INTO history FROM carearound_release.schema_changes WHERE change_id <> ${literal(permissionId)};
    IF history IS DISTINCT FROM ${json(priorHistory)} THEN RAISE EXCEPTION 'Prior migration history drift'; END IF;`;
    const checkInstalled = `
    ${capture}
    ${checkPrior}
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO permission_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(permissionNames)} ? (t->>'name');
    IF md5(permission_tables::text) IS DISTINCT FROM ${literal(permissionDigest)}
       OR jsonb_array_length(actual->'tables') <> ${oldNames.length + pilotNames.length + permissionNames.length}
      THEN RAISE EXCEPTION 'Permission-first schema mismatch'; END IF;
    SELECT jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256,'source_revision',source_revision) ORDER BY change_id)
      INTO permission_history FROM carearound_release.schema_changes WHERE change_id = ${literal(permissionId)};
    IF permission_history IS DISTINCT FROM ${json([{ change_id: permissionId, kind: 'executed_migration', sha256: permissionHash, source_revision: sourceRevision }])}
      THEN RAISE EXCEPTION 'Permission-first migration history mismatch'; END IF;`;

    const sql = `DO $carearound_permission_release$
DECLARE actual jsonb; old_tables jsonb; pilot_tables jsonb; permission_tables jsonb; history jsonb; permission_history jsonb;
        access_before jsonb; installed integer;
BEGIN
    IF current_setting('neon.branch_id',true) IS DISTINCT FROM ${literal(target.branch_id)}
       OR current_database() <> ${literal(target.database)} OR current_user <> ${literal(target.runtime_role)}
       OR current_setting('server_version_num')::int / 10000 <> ${serverMajor} THEN RAISE EXCEPTION 'Wrong release target'; END IF;
    IF current_setting('lock_timeout') <> '2s' OR current_setting('statement_timeout') <> '15s'
      THEN RAISE EXCEPTION 'Release timeouts required'; END IF;
    PERFORM set_config('search_path','public',true);
    IF NOT pg_try_advisory_xact_lock(20260907,3006) THEN RAISE EXCEPTION 'Another migration is running'; END IF;
    ${capture}
    ${checkPrior}
    SELECT count(*) INTO installed FROM carearound_release.schema_changes WHERE change_id = ${literal(permissionId)};
    IF installed = 1 THEN
        ${checkInstalled}
        RETURN;
    ELSIF installed <> 0 THEN RAISE EXCEPTION 'Duplicate permission-first migration history'; END IF;
    IF jsonb_array_length(actual->'tables') <> ${oldNames.length + pilotNames.length}
      THEN RAISE EXCEPTION 'Unexpected tables before permission-first release'; END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) INTO access_before FROM platform_access_settings p;
    ${permissionMigration.sql}
    INSERT INTO carearound_release.schema_changes (change_id,kind,sha256,source_revision,details)
      VALUES (${literal(permissionId)},'executed_migration',${literal(permissionHash)},${literal(sourceRevision)},
        '{"release":"permission-first-publishing-20260915","scope":"additive permission ledger; existing resources unverified"}'::jsonb);
    ${failAfterMigration ? "RAISE EXCEPTION 'EXPECTED_PERMISSION_RELEASE_INTERRUPTION';" : ''}
    ${checkInstalled}
    IF (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM platform_access_settings p) IS DISTINCT FROM access_before
      THEN RAISE EXCEPTION 'Public access settings changed'; END IF;
END $carearound_permission_release$;`;

    return {
        sql,
        setup: ["SET LOCAL statement_timeout = '15s'", "SET LOCAL lock_timeout = '2s'"],
        id: permissionId,
        hash: permissionHash,
        tableNames: permissionNames,
        catalogQuery,
    };
}
