// Offline SQL generation only. Never loads .env, accepts a URL, or connects to Neon.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const hash = '9924475d4a9332bf40bea8cb3b7a47143f63340b646a42714ef2b2a71aad6bec';
const tableNames = Object.freeze(['boundary_library_items', 'boundary_map_requests', 'boundary_zone_commit_requests',
    'boundary_zone_job_rows', 'boundary_zone_jobs', 'boundary_zone_staged_postals']);
const sequenceNames = Object.freeze(['boundary_library_items_id_seq', 'boundary_zone_jobs_id_seq']);
// Every interpolated value has a hex-only SQL representation. Escaping quotes
// alone cannot protect metadata containing the enclosing DO dollar delimiter.
const literal = value => "convert_from(decode('" + Buffer.from(String(value), 'utf8').toString('hex') + "','hex'),'UTF8')";
const json = value => literal(JSON.stringify(value)) + '::jsonb';
const sha256 = value => createHash('sha256').update(value).digest('hex');

// Metadata only: no application rows, sequence values, credentials, or tokens.
// Ignore PG18's separately represented NOT NULL constraints; attributes retain
// nullability, making the signature equivalent on supported PG17/18.
const catalogQuery = `WITH table_fingerprints AS (
 SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,c.relpersistence::text AS persistence,
 c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
   coalesce(pg_get_expr(d.adbin,d.adrelid),''),a.attidentity,a.attgenerated) ORDER BY a.attname)::text,'[]'))
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns_hash,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid,true),
   k.convalidated,k.condeferrable,k.condeferred) ORDER BY k.conname)::text,'[]'))
  FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype <> 'n') AS constraints_hash,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(ic.relname,pg_get_indexdef(i.indexrelid),
   i.indisvalid,i.indisready,i.indislive) ORDER BY ic.relname)::text,'[]'))
  FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid) AS indexes_hash,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid,true),t.tgenabled)
   ORDER BY t.tgname)::text,'[]')) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers_hash,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles::text,
   pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)::text,'[]'))
  FROM pg_policy p WHERE p.polrelid=c.oid) AS policies_hash
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','carearound_release') AND c.relkind IN ('r','p')
), sequence_fingerprints AS (
 SELECT c.relname AS name,format_type(s.seqtypid,NULL) AS type,s.seqstart::text AS start,
 s.seqincrement::text AS increment,s.seqmax::text AS maximum,s.seqmin::text AS minimum,
 s.seqcache::text AS cache,s.seqcycle AS cycle,
 (SELECT coalesce(jsonb_agg(jsonb_build_array(t.relname,a.attname,d.deptype) ORDER BY t.relname,a.attname),'[]')
  FROM pg_depend d JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace
  JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
  WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass
    AND d.deptype IN ('a','i') AND tn.nspname='public') AS owned_by
 FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
), enums AS (
 SELECT t.typname AS name,jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
 WHERE n.nspname='public' GROUP BY t.typname
)
SELECT jsonb_build_object(
 'tables',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY schema,name),'[]') FROM table_fingerprints t),
 'sequences',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY name),'[]') FROM sequence_fingerprints s),
 'enums',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY name),'[]') FROM enums e),
 'other_relations',(SELECT coalesce(jsonb_agg(jsonb_build_array(c.relname,c.relkind,
    CASE WHEN c.relkind IN ('v','m') THEN md5(pg_get_viewdef(c.oid,true)) ELSE '' END) ORDER BY c.relname),'[]')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind NOT IN ('r','p','S','i','I','t')),
 'migration_tables',(SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname),'[]')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p')
    AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND (c.relname ILIKE '%migration%' OR n.nspname='drizzle'))
) AS catalog`;
const catalogQuerySha256 = sha256(catalogQuery);
const identity = `jsonb_build_object('branch_id',current_setting('neon.branch_id',true),
    'database',current_database(),'runtime_role',current_user,
    'server_major',current_setting('server_version_num')::int / 10000)`;
const historyQuery = `SELECT coalesce(jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,
    'sha256',sha256,'source_revision',source_revision) ORDER BY change_id),'[]'::jsonb)
    FROM carearound_release.schema_changes`;

export const boundaryReleaseIdentityQuery = `BEGIN READ ONLY;
SELECT ${identity} AS target,
  to_regclass('carearound_release.schema_changes') IS NOT NULL AS release_history_present,
  (SELECT coalesce(jsonb_agg(jsonb_build_array(c.relname,c.relkind) ORDER BY c.relname),'[]')
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND (c.relname LIKE 'boundary_library_%' OR c.relname LIKE 'boundary_map_%'
     OR c.relname LIKE 'boundary_zone_%' OR c.relname LIKE 'boundary_jobs_%'
     OR c.relname LIKE 'boundary_commit_%' OR c.relname LIKE 'boundary_job_%')) AS boundary_relations;
COMMIT;`;

// Use only after identity query proves the established history table exists.
export const boundaryReleasePreflightQuery = `WITH captured AS (${catalogQuery})
SELECT jsonb_build_object('querySha256',${literal(catalogQuerySha256)},'target',${identity},
    'catalog',catalog,'history',(${historyQuery})) AS boundary_release_preflight FROM captured;`;

let expectedPromise;
async function expectedBoundaryCatalog(sql) {
    expectedPromise ??= (async () => {
        const pg = new PGlite();
        try {
            await pg.exec('CREATE TABLE users(id integer PRIMARY KEY); CREATE TABLE my_maps(id integer PRIMARY KEY);');
            await pg.exec(sql);
            const result = (await pg.query(catalogQuery)).rows[0].catalog;
            return { tables: result.tables.filter(t => tableNames.includes(t.name)), sequences: result.sequences };
        } finally { await pg.close(); }
    })();
    return expectedPromise;
}

function requireFresh(value, label, now) {
    assert.ok(typeof value === 'string' && Number.isFinite(Date.parse(value)), `Fresh ${label} timestamp required`);
    const age = now - Date.parse(value);
    assert.ok(age >= -60_000 && age <= 60 * 60_000, `Fresh ${label} observation within one hour required`);
}

function requireExactKeys(value, keys, label) {
    assert.ok(value && Object.getPrototypeOf(value) === Object.prototype, `Reviewed ${label} object required`);
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `Only allowlisted ${label} fields are accepted`);
}

export async function generateBoundaryLibraryRelease({ sourceRevision, baseline, observedAtUtc, recovery, migrationId, predecessorReceipt,
    failAfterMigration = false, now = Date.now() }) {
    assert.match(sourceRevision, /^[a-f0-9]{40}$/);
    requireFresh(observedAtUtc, 'catalog', now);
    requireExactKeys(recovery, ['verifiedAtUtc','recoveryPointId','restoreEvidenceSha256'], 'recovery');
    requireFresh(recovery?.verifiedAtUtc, 'recovery', now);
    assert.match(recovery.recoveryPointId, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/, 'Opaque recovery point identifier required');
    assert.match(recovery.restoreEvidenceSha256, /^[a-f0-9]{64}$/, 'Reviewed recovery evidence SHA-256 required');
    const approvedRecovery = { verifiedAtUtc: recovery.verifiedAtUtc, recoveryPointId: recovery.recoveryPointId,
        restoreEvidenceSha256: recovery.restoreEvidenceSha256 };
    assert.equal(baseline?.querySha256, catalogQuerySha256, 'Reviewed catalog query mismatch');
    const target = baseline?.target;
    for (const key of ['branch_id','database','runtime_role']) assert.match(target?.[key] ?? '', /^[a-zA-Z0-9_-]{1,128}$/);
    assert.ok([17,18].includes(target.server_major), 'Unsupported PostgreSQL major');
    const manifest = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    const boundaryMigrations = manifest.migrations.filter(m => /^\d{4}_boundary_library_guided_zones$/.test(m.id));
    assert.equal(boundaryMigrations.length, 1, 'Exactly one ordered boundary migration required');
    const id = migrationId ?? boundaryMigrations[0].id;
    assert.equal(id, boundaryMigrations[0].id, 'Requested migration does not match reviewed manifest');
    assert.equal(manifest.migrations.at(-1)?.id, id, 'Boundary migration must be the reviewed next release');
    assert.equal(manifest.migrations.filter(m => m.id.slice(0,4) === id.slice(0,4)).length, 1, 'Migration ordinal collision');
    assert.equal(boundaryMigrations[0].sha256, hash, 'Boundary manifest mismatch');
    const predecessor = manifest.migrations.at(-2);
    assert.ok(predecessor && /^\d{4}_/.test(predecessor.id)
        && Number(predecessor.id.slice(0,4)) + 1 === Number(id.slice(0,4)), 'Immediate ordered predecessor required');
    assert.equal(manifest.migrations.filter(m => m.id.slice(0,4) === predecessor.id.slice(0,4)).length, 1, 'Predecessor ordinal collision');
    assert.match(predecessor.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(await readFile(new URL('../' + predecessor.file, import.meta.url))), predecessor.sha256,
        'Reviewed predecessor SQL hash mismatch');
    requireExactKeys(predecessorReceipt, ['change_id','kind','sha256','source_revision'], 'predecessor receipt');
    assert.equal(predecessorReceipt.change_id, predecessor.id, 'Accepted predecessor identity mismatch');
    assert.equal(predecessorReceipt.kind, 'executed_migration', 'Accepted predecessor execution required');
    assert.equal(predecessorReceipt.sha256, predecessor.sha256, 'Accepted predecessor hash mismatch');
    assert.match(predecessorReceipt.source_revision, /^[a-f0-9]{40}$/, 'Accepted predecessor source revision required');
    const approvedPredecessor = { change_id: predecessor.id, kind: 'executed_migration', sha256: predecessor.sha256,
        source_revision: predecessorReceipt.source_revision };
    const before = baseline.catalog;
    for (const key of ['tables','sequences','enums','other_relations','migration_tables']) assert.ok(Array.isArray(before?.[key]));
    for (const name of ['users','my_maps']) assert.ok(before.tables.some(t => t.schema === 'public' && t.name === name), `Missing prerequisite ${name}`);
    assert.ok(before.tables.some(t => t.schema === 'carearound_release' && t.name === 'schema_changes'), 'Missing established release ledger');
    assert.ok(before.tables.every(t => t.schema !== 'public' || !tableNames.includes(t.name)), 'Baseline already contains boundary tables; inspect installed provenance separately');
    assert.ok(before.sequences.every(s => !sequenceNames.includes(s.name)), 'Baseline contains partial boundary sequences');
    assert.ok(Array.isArray(baseline.history) && baseline.history.length > 0, 'Established adoption history required');
    for (const row of baseline.history) {
        assert.ok(typeof row.change_id === 'string' && row.change_id.length <= 200);
        assert.ok(['observed_baseline','executed_migration'].includes(row.kind));
        assert.match(row.sha256, /^[a-f0-9]{64}$/);
        assert.match(row.source_revision, /^[a-f0-9]{40}$/);
        assert.notEqual(row.change_id, id, 'Boundary provenance already present; verify installed schema rather than generating adoption');
        assert.ok(!/^\d{4}_/.test(row.change_id) || row.change_id.slice(0,4) !== id.slice(0,4), 'Migration ordinal already belongs to another release');
        assert.ok(!/^\d{4}_/.test(row.change_id) || row.change_id.slice(0,4) < id.slice(0,4), 'Later migration history requires a new ordered release review');
    }
    assert.equal(new Set(baseline.history.map(row => row.change_id)).size, baseline.history.length);
    assert.deepEqual(baseline.history.find(row => row.change_id === predecessor.id), approvedPredecessor,
        'Exact reviewed predecessor adoption and accepted source receipt required');
    const migration = await readFile(new URL('../' + boundaryMigrations[0].file, import.meta.url), 'utf8');
    assert.equal(sha256(migration), hash, 'Reviewed boundary migration bytes changed');
    assert.deepEqual([...migration.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map(m => m[1]), tableNames);
    const expected = await expectedBoundaryCatalog(migration);
    assert.equal(expected.tables.length, 6);
    assert.deepEqual(expected.sequences.map(s => s.name), sequenceNames);
    const capture = `SELECT catalog INTO actual FROM (${catalogQuery}) captured;`;
    const checkBefore = `
    ${capture}
    SELECT jsonb_set(jsonb_set(actual,'{tables}',(SELECT coalesce(jsonb_agg(t ORDER BY t->>'schema',t->>'name'),'[]')
      FROM jsonb_array_elements(actual->'tables') t WHERE NOT (t->>'schema'='public' AND ${json(tableNames)} ? (t->>'name')))),
      '{sequences}',(SELECT coalesce(jsonb_agg(s ORDER BY s->>'name'),'[]') FROM jsonb_array_elements(actual->'sequences') s
      WHERE NOT (${json(sequenceNames)} ? (s->>'name')))) INTO old_catalog;
    IF old_catalog IS DISTINCT FROM ${json(before)} THEN RAISE EXCEPTION 'Baseline schema drift'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256,
      'source_revision',source_revision) ORDER BY change_id),'[]') INTO history
      FROM carearound_release.schema_changes WHERE change_id <> ${literal(id)};
    IF history IS DISTINCT FROM ${json(baseline.history)} THEN RAISE EXCEPTION 'Prior migration history drift'; END IF;`;
    const newHistory = { change_id: id, kind: 'executed_migration', sha256: hash, source_revision: sourceRevision };
    const checkInstalled = `
    ${checkBefore}
    SELECT jsonb_build_object('tables',(SELECT coalesce(jsonb_agg(t ORDER BY t->>'name'),'[]')
      FROM jsonb_array_elements(actual->'tables') t WHERE t->>'schema'='public' AND ${json(tableNames)} ? (t->>'name')),
      'sequences',(SELECT coalesce(jsonb_agg(s ORDER BY s->>'name'),'[]') FROM jsonb_array_elements(actual->'sequences') s
      WHERE ${json(sequenceNames)} ? (s->>'name'))) INTO boundary_catalog;
    IF boundary_catalog IS DISTINCT FROM ${json(expected)} THEN RAISE EXCEPTION 'Boundary schema mismatch'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256,
      'source_revision',source_revision)),'[]') INTO own_history FROM carearound_release.schema_changes WHERE change_id=${literal(id)};
    IF own_history IS DISTINCT FROM ${json([newHistory])} THEN RAISE EXCEPTION 'Boundary migration history mismatch'; END IF;`;
    // EXECUTE retains the exact reviewed migration bytes inside this atomic DO.
    // Its nested dollar quotes and duplicate-object blocks stay intact.
    const sql = `DO $carearound_boundary_release$
DECLARE actual jsonb; old_catalog jsonb; boundary_catalog jsonb; history jsonb; own_history jsonb; installed integer;
BEGIN
    IF current_setting('neon.branch_id',true) IS DISTINCT FROM ${literal(target.branch_id)}
      OR current_database() <> ${literal(target.database)} OR current_user <> ${literal(target.runtime_role)}
      OR current_setting('server_version_num')::int / 10000 <> ${target.server_major} THEN RAISE EXCEPTION 'Wrong release target'; END IF;
    IF current_setting('lock_timeout') <> '2s' OR current_setting('statement_timeout') <> '15s'
      THEN RAISE EXCEPTION 'Release timeouts required'; END IF;
    IF clock_timestamp() < ${literal(observedAtUtc)}::timestamptz - interval '1 minute'
      OR clock_timestamp() > ${literal(observedAtUtc)}::timestamptz + interval '1 hour'
      OR clock_timestamp() < ${literal(recovery.verifiedAtUtc)}::timestamptz - interval '1 minute'
      OR clock_timestamp() > ${literal(recovery.verifiedAtUtc)}::timestamptz + interval '1 hour'
      THEN RAISE EXCEPTION 'Fresh catalog and recovery observations required'; END IF;
    PERFORM set_config('search_path','public,pg_catalog',true);
    IF NOT pg_catalog.pg_try_advisory_xact_lock(20260907,3006) THEN RAISE EXCEPTION 'Another migration is running'; END IF;
    ${checkBefore}
    SELECT count(*) INTO installed FROM carearound_release.schema_changes WHERE change_id=${literal(id)};
    IF installed=1 THEN ${checkInstalled} RETURN;
    ELSIF installed<>0 THEN RAISE EXCEPTION 'Duplicate boundary migration history'; END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND c.relname IN (${[...tableNames,...sequenceNames,...migration.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS "([^"]+)"/g)].map(x => literal(Array.isArray(x) ? x[1] : x)).join(',')}))
      OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
      AND ${json(tableNames)} ? t.typname) THEN RAISE EXCEPTION 'Unjournaled or partial boundary objects'; END IF;
    EXECUTE ${literal(migration)};
    INSERT INTO carearound_release.schema_changes(change_id,kind,sha256,source_revision,details)
      VALUES(${literal(id)},'executed_migration',${literal(hash)},${literal(sourceRevision)},
      ${json({ release: id, catalogQuerySha256, observedAtUtc, recovery: approvedRecovery,
        predecessor: approvedPredecessor, baselineSha256: sha256(JSON.stringify(baseline)) })});
    ${failAfterMigration ? "RAISE EXCEPTION 'EXPECTED_BOUNDARY_RELEASE_INTERRUPTION';" : ''}
    ${checkInstalled}
END $carearound_boundary_release$;`;
    return { id, hash, sql, setup: ["SET LOCAL statement_timeout = '15s'", "SET LOCAL lock_timeout = '2s'"],
        tableNames, sequenceNames, catalogQuerySha256, baselineSha256: sha256(JSON.stringify(baseline)),
        batch: `BEGIN;\nSET LOCAL statement_timeout = '15s';\nSET LOCAL lock_timeout = '2s';\n${sql}\nCOMMIT;\n`,
        verificationQuery: boundaryReleasePreflightQuery };
}

// Inputs and outputs are local metadata/SQL files, never connection parameters.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [action, inputPath, outputPath] = process.argv.slice(2);
    if (action === '--identity-sql' && !inputPath) process.stdout.write(boundaryReleaseIdentityQuery + '\n');
    else if (action === '--preflight-sql' && !inputPath) process.stdout.write('BEGIN READ ONLY;\nSET LOCAL search_path=public,pg_catalog;\n' + boundaryReleasePreflightQuery + '\nCOMMIT;\n');
    else {
        assert.equal(action, '--generate', 'Use --identity-sql, --preflight-sql, or --generate metadata.json batch.sql');
        assert.ok(inputPath && outputPath);
        const plan = await generateBoundaryLibraryRelease(JSON.parse(await readFile(inputPath, 'utf8')));
        await writeFile(outputPath, plan.batch, { flag: 'wx' });
        process.stdout.write(JSON.stringify({ id: plan.id, migrationSha256: plan.hash,
            batchSha256: sha256(plan.batch), baselineSha256: plan.baselineSha256, outputPath }) + '\n');
    }
}
