import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createProductionSchemaRehearsal, evidenceSha256, sourceRevision } from './productionSchemaRehearsal.mjs';

// Generates SQL for the single, schema-only Neon rehearsal branch, never production.
// Does not connect, load environment files, or write files.
const branchId = 'br-autumn-mode-aikak52t';
const approvedFeatureMigrationIds = Object.freeze([
    '0003_support_inbox',
    '0004_guide_history',
    '0005_notification_updates',
    '0006_saved_search_alerts',
]);
const literal = text => "'" + text.replaceAll("'", "''") + "'";
const sha256 = text => createHash('sha256').update(text).digest('hex');

export async function buildNeonRehearsalSql() {
    const cleanup = [];
    const r = await createProductionSchemaRehearsal(
        { after: fn => cleanup.push(fn) },
        { featureMigrationIds: approvedFeatureMigrationIds },
    );
    try {
        const query = r.evidence.normalizedQuery.trim().replace(/;$/, '');
        const expected = JSON.stringify({ tables: r.evidence.normalizedProduction.tables, enums: r.evidence.normalizedProduction.enums });
        const featureExpected = JSON.stringify(r.expectedFeatures);
        const oldNames = literal(JSON.stringify(r.evidence.normalizedProduction.tables.map(t => t.name))) + '::jsonb';
        const featureNames = literal(JSON.stringify(r.featureNames)) + '::jsonb';
        const preflight = "DO $guard$ DECLARE actual jsonb; BEGIN\n" +
            "IF current_setting('neon.branch_id',true) IS DISTINCT FROM " + literal(branchId) +
            " OR current_database() <> 'neondb' OR current_setting('server_version_num')::int / 10000 <> 17 THEN RAISE EXCEPTION 'Wrong rehearsal target'; END IF;\n" +
            "IF NOT pg_try_advisory_xact_lock(20260907,3006) THEN RAISE EXCEPTION 'Another rehearsal migration is running'; END IF;\n" +
            "SELECT carearound_schema_preflight INTO actual FROM (" + query + ") captured;\n" +
            "IF jsonb_build_object('tables',actual->'tables','enums',actual->'enums') <> " + literal(expected) +
            "::jsonb OR actual->'migration_tables' <> '[]'::jsonb THEN RAISE EXCEPTION 'Baseline drift or prior migration state'; END IF;\n" +
            "IF EXISTS (SELECT FROM public.users) OR EXISTS (SELECT FROM public.hard_assets) OR EXISTS (SELECT FROM public.soft_assets) " +
            "OR EXISTS (SELECT FROM public.user_favorites) OR EXISTS (SELECT FROM public.my_maps) THEN RAISE EXCEPTION 'Rehearsal must contain no application records'; END IF;\n" +
            "IF to_regnamespace('carearound_release') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected adoption schema'; END IF;\n" +
            "END $guard$;\n";
        const ledger = "CREATE SCHEMA carearound_release;\n" +
            "CREATE TABLE carearound_release.schema_changes (change_id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('observed_baseline','executed_migration'))," +
            "sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),source_revision text NOT NULL CHECK (source_revision ~ '^[a-f0-9]{40}$')," +
            "recorded_at timestamptz NOT NULL DEFAULT now(),details jsonb NOT NULL);\n" +
            "INSERT INTO carearound_release.schema_changes (change_id,kind,sha256,source_revision,details) VALUES ('observed-neon-schema-20260907','observed_baseline'," +
            literal(evidenceSha256) + "," + literal(sourceRevision) + "," + literal(JSON.stringify({
                rehearsalOnly: true, branchId, baseline0000: 'not executed; legacy schema observed',
                migration0001: 'not applied; separate review', migration0002: 'columns observed; execution unknown',
            })) + "::jsonb);\n";
        const apply = r.features.map(m => m.sql + "\nINSERT INTO carearound_release.schema_changes " +
            "(change_id,kind,sha256,source_revision,details) VALUES (" + literal(m.id) + ",'executed_migration'," +
            literal(m.sha256) + "," + literal(sourceRevision) + ",'{\"rehearsalOnly\":true}'::jsonb);\n");
        const postflight = "DO $verify$ DECLARE actual jsonb; old_tables jsonb; new_tables jsonb; BEGIN\n" +
            "SELECT carearound_schema_preflight INTO actual FROM (" + query + ") captured;\n" +
            "SELECT jsonb_agg(t ORDER BY t->>'name') INTO old_tables FROM jsonb_array_elements(actual->'tables') t WHERE " + oldNames + " ? (t->>'name');\n" +
            "SELECT jsonb_agg(t ORDER BY t->>'name') INTO new_tables FROM jsonb_array_elements(actual->'tables') t WHERE " + featureNames + " ? (t->>'name');\n" +
            "IF jsonb_build_object('tables',old_tables,'enums',actual->'enums') <> " + literal(expected) + "::jsonb THEN RAISE EXCEPTION 'Existing schema changed'; END IF;\n" +
            "IF new_tables <> " + literal(featureExpected) + "::jsonb OR jsonb_array_length(actual->'tables') <> 70 THEN RAISE EXCEPTION 'Feature schema mismatch'; END IF;\n" +
            "IF (SELECT count(*) FROM carearound_release.schema_changes) <> 5 THEN RAISE EXCEPTION 'Incomplete rehearsal history'; END IF;\n" +
            "END $verify$;\n";
        const start = "-- REHEARSAL ONLY: branch " + branchId + ". Production is rejected by the SQL guard.\nBEGIN;\nSET LOCAL statement_timeout = '15s';\nSET LOCAL lock_timeout = '2s';\nSET LOCAL search_path = public;\n";
        const fail = start + preflight + ledger + apply.slice(0, 3).join("\n") +
            "DO $failure$ BEGIN RAISE EXCEPTION 'EXPECTED_REHEARSAL_FAILURE_AFTER_0005'; END $failure$;\nROLLBACK;\n";
        const success = start + preflight + ledger + apply.join("\n") + postflight + "COMMIT;\n" +
            "SELECT jsonb_build_object('status','rehearsal_applied','branch',current_setting('neon.branch_id',true),'server_version',current_setting('server_version')," +
            "'public_tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'history_rows',(SELECT count(*) FROM carearound_release.schema_changes)) AS rehearsal_result;\n";
        return { branchId, fail, success, failSha256: sha256(fail), successSha256: sha256(success) };
    } finally { for (const close of cleanup) await close(); }
}
