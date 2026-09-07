import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Offline SQL generator only: no credentials, connection, environment loading or execution.
// This dated, approved legacy adoption is not a generic migration runner.
export const adoptionTargets = Object.freeze({
    production: 'br-green-union-ailxs0g3',
    rehearsal: 'br-autumn-mode-aikak52t',
});
const evidenceHash = 'd2e9b1fda340fec95750406923bb6c6dea56006c0b783050abef690a737044fd';
const sourceRevision = '334559209472e8c0676d8ce023f48d9d09779d28';
const migrationHashes = Object.freeze({
    '0003_support_inbox': '8f9d98ce7658ea55676c1135d84c8fb9f5ba4861344f7a6a1bb8dab6a26f37e0',
    '0004_guide_history': '4560f722eca19af9190f01399fee7ad321daa0ff439cc9316ebd6d6f143ab75f',
    '0005_notification_updates': '1aac87349b0cba62b75522164f2205c3974f1e6fd2c95a47cad05012a0170a51',
    '0006_saved_search_alerts': '7a94c7be9da426b29c6dc4e128e96af7dafd247d5a905c431458cc5e36ba6de5',
});
const sha256 = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';

export async function buildNeonFeatureAdoption({ target, failAfter } = {}) {
    assert.ok(Object.hasOwn(adoptionTargets, target), 'Choose the exact production or rehearsal target');
    assert.ok(!failAfter || (target === 'rehearsal' && Object.hasOwn(migrationHashes, failAfter)), 'Failure injection is rehearsal-only');
    const raw = await readFile(new URL('../../docs/evidence/guide-inbox-neon-preflight-20260907.json', import.meta.url), 'utf8');
    assert.equal(sha256(raw), evidenceHash, 'Captured baseline bytes changed');
    const evidence = JSON.parse(raw);
    const manifest = JSON.parse(await readFile(new URL('../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual(manifest.migrations.slice(3).map(m => m.id), Object.keys(migrationHashes), 'Migration sequence changed');
    const migrations = await Promise.all(manifest.migrations.map(async m => {
        const sql = await readFile(new URL('../' + m.file, import.meta.url), 'utf8');
        assert.equal(sha256(sql), m.sha256, 'Manifest hash mismatch');
        if (migrationHashes[m.id]) assert.equal(sha256(sql), migrationHashes[m.id], 'Approved migration changed');
        return { ...m, sql };
    }));
    const features = migrations.slice(3);
    const featureNames = features.flatMap(m => [...m.sql.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map(m => m[1])).sort();
    assert.equal(featureNames.length, 10);
    const query = evidence.normalizedQuery.trim().replace(/;$/, '');
    const expectedOld = { tables: evidence.normalizedProduction.tables, enums: evidence.normalizedProduction.enums };
    // A fresh, empty in-memory reference derives every new CHECK/FK/index fingerprint.
    // No production-shaped reconstruction or existing-table repair SQL is emitted.
    const reference = new PGlite();
    let expectedFeatures;
    let expectedOldHash;
    let expectedFeaturesHash;
    try {
        for (const migration of migrations) await reference.exec(migration.sql);
        const state = (await reference.query(query)).rows[0].carearound_schema_preflight;
        expectedFeatures = state.tables.filter(t => featureNames.includes(t.name));
        const digest = async value => (await reference.query('SELECT md5($1::jsonb::text) AS hash', [JSON.stringify(value)])).rows[0].hash;
        expectedOldHash = await digest(expectedOld);
        expectedFeaturesHash = await digest(expectedFeatures);
    } finally { await reference.close(); }
    const oldNames = expectedOld.tables.map(t => t.name);
    const details = { target, branchId: adoptionTargets[target], owner: 'CareAround Backend Platform Owner',
        approval: 'User approved tested adoption record and exact 0003-0006 on 2026-09-07',
        baseline0000: 'not executed; captured legacy definitions retained',
        migration0001: 'not applied; separate review', migration0002: 'columns observed; historical execution unknown' };
    const history = [
        { change_id: 'observed-neon-schema-20260907', kind: 'observed_baseline', sha256: evidenceHash, source_revision: sourceRevision },
        ...features.map(m => ({ change_id: m.id, kind: 'executed_migration', sha256: m.sha256, source_revision: sourceRevision })),
    ].sort((a, b) => a.change_id.localeCompare(b.change_id));
    const capture = `SELECT carearound_schema_preflight INTO actual FROM (${query}) captured;`;
    const checkOld = `${capture}
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO old_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(oldNames)} ? (t->>'name');
    IF md5(jsonb_build_object('tables',old_tables,'enums',actual->'enums')::text) IS DISTINCT FROM ${literal(expectedOldHash)}
       OR actual->'migration_tables' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'Existing schema drift or unexpected journal'; END IF;`;
    const checkInstalled = `${capture}
    SELECT jsonb_agg(t ORDER BY t->>'name') INTO new_tables FROM jsonb_array_elements(actual->'tables') t WHERE ${json(featureNames)} ? (t->>'name');
    IF md5(new_tables::text) IS DISTINCT FROM ${literal(expectedFeaturesHash)} OR jsonb_array_length(actual->'tables') <> 70 THEN RAISE EXCEPTION 'Feature schema mismatch'; END IF;
    SELECT jsonb_agg(jsonb_build_object('change_id',change_id,'kind',kind,'sha256',sha256,'source_revision',source_revision) ORDER BY change_id) INTO recorded FROM carearound_release.schema_changes;
    IF recorded IS DISTINCT FROM ${json(history)} OR EXISTS (SELECT FROM carearound_release.schema_changes WHERE details IS DISTINCT FROM ${json(details)}) THEN RAISE EXCEPTION 'Partial or changed adoption history'; END IF;`;
    const record = item => `INSERT INTO carearound_release.schema_changes (change_id,kind,sha256,source_revision,details) VALUES (${literal(item.change_id)},${literal(item.kind)},${literal(item.sha256)},${literal(item.source_revision)},${json(details)});`;
    const migrationBody = features.map(m => `${m.sql}
    ${record(history.find(h => h.change_id === m.id))}
    ${failAfter === m.id ? "RAISE EXCEPTION 'EXPECTED_BATCH_REHEARSAL_FAILURE';" : ''}`).join('\n');
    // SETs run before the one auto-committed DO statement. No BEGIN/COMMIT browser
    // round trips may hold the FK locks open. Guard the settings in the batch too.
    const sql = `-- APPROVED DATED ADOPTION: ${target}, ${adoptionTargets[target]}, neondb, role neondb_owner.
-- Execute with no transaction already open. Keep rollout flags off. Do not change targets.
SET statement_timeout = '15s';
SET lock_timeout = '2s';
DO $carearound_adoption$
DECLARE actual jsonb; old_tables jsonb; new_tables jsonb; recorded jsonb;
BEGIN
    IF current_setting('neon.branch_id',true) IS DISTINCT FROM ${literal(adoptionTargets[target])}
       OR current_database() <> 'neondb' OR current_user <> 'neondb_owner'
       OR current_setting('server_version_num')::int / 10000 <> 17 THEN RAISE EXCEPTION 'Wrong adoption target or role'; END IF;
    IF current_setting('statement_timeout') <> '15s' OR current_setting('lock_timeout') <> '2s' THEN RAISE EXCEPTION 'Required timeouts missing'; END IF;
    PERFORM set_config('search_path','public',true);
    IF NOT pg_try_advisory_xact_lock(20260907,3006) THEN RAISE EXCEPTION 'Another adoption is running'; END IF;
    ${checkOld}
    IF to_regnamespace('carearound_release') IS NOT NULL THEN
        IF to_regclass('carearound_release.schema_changes') IS NULL THEN RAISE EXCEPTION 'Unexpected adoption schema'; END IF;
        ${checkInstalled}
        RAISE NOTICE 'Adoption already applied; exact schema and history verified';
        RETURN;
    END IF;
    IF jsonb_array_length(actual->'tables') <> 60 THEN RAISE EXCEPTION 'Unjournaled feature objects'; END IF;
    CREATE SCHEMA carearound_release;
    CREATE TABLE carearound_release.schema_changes (change_id text PRIMARY KEY,
        kind text NOT NULL CHECK (kind IN ('observed_baseline','executed_migration')),
        sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
        source_revision text NOT NULL CHECK (source_revision ~ '^[a-f0-9]{40}$'),
        recorded_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL);
    REVOKE ALL ON SCHEMA carearound_release FROM PUBLIC;
    REVOKE ALL ON TABLE carearound_release.schema_changes FROM PUBLIC;
    ${record(history.find(h => h.kind === 'observed_baseline'))}
    ${migrationBody}
    ${checkOld}
    ${checkInstalled}
    RAISE NOTICE 'Adoption applied; exact schema and history verified';
END $carearound_adoption$;
`;
    return { target, branchId: adoptionTargets[target], sql, sha256: sha256(sql), featureNames, history };
}
