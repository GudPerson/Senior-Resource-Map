import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// LOCAL TEST ONLY. Owns a new in-memory database; accepts no connection or URL.
// Catalog reconstruction below is not a production migration/repair procedure.
export const evidenceSha256 = 'd2e9b1fda340fec95750406923bb6c6dea56006c0b783050abef690a737044fd';
export const sourceRevision = '334559209472e8c0676d8ce023f48d9d09779d28';
const baselineId = 'observed-neon-schema-20260907';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const qi = (value) => '"' + value.replaceAll('"', '""') + '"';
const qs = (value) => "'" + value.replaceAll("'", "''") + "'";
const sort = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name));

export async function createProductionSchemaRehearsal(t) {
    const raw = await readFile(new URL('../../../docs/evidence/guide-inbox-neon-preflight-20260907.json', import.meta.url), 'utf8');
    assert.equal(sha256(raw), evidenceSha256, 'Catalog evidence changed; review before rehearsal');
    const evidence = JSON.parse(raw);
    const manifest = JSON.parse(await readFile(new URL('../../drizzle/migration-manifest.json', import.meta.url), 'utf8'));
    const migrations = await Promise.all(manifest.migrations.map(async (item) => {
        const sql = await readFile(new URL('../../' + item.file, import.meta.url), 'utf8');
        assert.equal(sha256(sql), item.sha256, 'Migration bytes changed: ' + item.id);
        return { ...item, sql };
    }));
    const features = migrations.slice(3);
    assert.deepEqual(features.map(m => m.id), ['0003_support_inbox', '0004_guide_history', '0005_notification_updates', '0006_saved_search_alerts']);
    const featureNames = features.flatMap(m => [...m.sql.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map(match => match[1]));
    assert.equal(featureNames.length, 10);
    const existingNames = evidence.normalizedProduction.tables.map(table => table.name);
    const pg = new PGlite();
    t.after(() => pg.close());
    const capture = async (db = pg) => (await db.query(evidence.normalizedQuery)).rows[0].carearound_schema_preflight;
    const comparable = (state) => ({ tables: state.tables, enums: state.enums });
    const oldState = (state) => comparable({ ...state, tables: state.tables.filter(table => existingNames.includes(table.name)) });
    const captureRows = async () => Object.fromEntries(await Promise.all(existingNames.map(async name => [
        name, (await pg.query('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, \'[]\')) AS digest FROM public.' + qi(name) + ' t')).rows[0].digest,
    ])));

    // Fresh-install reference proves every feature CHECK/FK/index, not only names.
    const reference = new PGlite();
    let expectedFeatures;
    try {
        for (const migration of migrations) await reference.exec(migration.sql);
        expectedFeatures = (await capture(reference)).tables.filter(table => featureNames.includes(table.name));
    } finally { await reference.close(); }

    // Reconstruct only in the newly-created, empty in-memory database.
    const role = evidence.normalizedProduction.enums.find(item => item.name === 'role');
    const baseline = migrations[0].sql.replace(
        /CREATE TYPE "public"\."role" AS ENUM\([^;]+\);/,
        'CREATE TYPE "public"."role" AS ENUM(' + role.labels.map(qs).join(',') + ');',
    );
    assert.notEqual(baseline, migrations[0].sql);
    await pg.exec(baseline);
    await pg.exec(migrations[2].sql); // 0001 indexes deliberately absent.
    for (const item of evidence.normalizedProduction.enums.filter(item => item.name !== 'role')) {
        await pg.exec('CREATE TYPE public.' + qi(item.name) + ' AS ENUM (' + item.labels.map(qs).join(',') + ')');
    }
    const constraints = (await pg.query(evidence.detailQuery)).rows[0].carearound_schema_details.constraints;
    for (const constraint of [...constraints.filter(c => c.type === 'f'), ...constraints.filter(c => c.type !== 'f')]) {
        await pg.exec('ALTER TABLE public.' + qi(constraint.table) + ' DROP CONSTRAINT ' + qi(constraint.name));
    }
    const leftoverIndexes = (await pg.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows;
    for (const index of leftoverIndexes) await pg.exec('DROP INDEX public.' + qi(index.indexname));
    for (const column of evidence.differences.columns) {
        assert.equal(column.base.not_null, false);
        assert.equal(column.production.not_null, true);
        await pg.exec('ALTER TABLE public.' + qi(column.production.table) + ' ALTER COLUMN ' + qi(column.production.column) + ' SET NOT NULL');
    }
    const addConstraint = async (constraint) => {
        assert.equal(constraint.validated, true);
        assert.equal(constraint.deferrable, false);
        await pg.exec('ALTER TABLE public.' + qi(constraint.table) + ' ADD CONSTRAINT ' + qi(constraint.name) + ' ' + constraint.definition);
    };
    for (const constraint of evidence.productionDetails.constraints.filter(c => c.type !== 'f')) await addConstraint(constraint);
    const generated = new Set((await pg.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map(i => i.indexname));
    for (const index of evidence.productionDetails.indexes) if (!generated.has(index.name)) await pg.exec(index.definition);
    for (const constraint of evidence.productionDetails.constraints.filter(c => c.type === 'f')) await addConstraint(constraint);
    assert.deepEqual(comparable(await capture()), comparable(evidence.normalizedProduction), 'Reconstructed schema must match ALL captured fingerprints');

    const expectedOld = comparable(evidence.normalizedProduction);
    const assertOld = (state) => assert.deepEqual(oldState(state), expectedOld, 'Existing schema drift; stop');
    const assertFeatures = (state) => assert.deepEqual(
        sort(state.tables.filter(table => featureNames.includes(table.name))), sort(expectedFeatures),
        'Feature schema differs from the immutable migrations',
    );
    const ledgerExists = async (db) => (await db.query("SELECT to_regclass('carearound_release.schema_changes') IS NOT NULL AS present")).rows[0].present;
    const expectedHistory = [
        { change_id: baselineId, kind: 'observed_baseline', sha256: evidenceSha256, source_revision: sourceRevision },
        ...features.map(m => ({ change_id: m.id, kind: 'executed_migration', sha256: m.sha256, source_revision: sourceRevision })),
    ].sort((a, b) => a.change_id.localeCompare(b.change_id));
    const readHistory = async (db = pg) => (await db.query('SELECT change_id, kind, sha256, source_revision FROM carearound_release.schema_changes ORDER BY change_id')).rows;

    // Prototype adoption protocol, deliberately nested inside this local fixture.
    // A production executor, role model, grants and lock strategy are NOT supplied.
    async function applyFeatureUpgrade({ failAfter, suppliedFeatures = features } = {}) {
        assert.deepEqual(suppliedFeatures.map(m => ({ id: m.id, sha256: sha256(m.sql) })), features.map(m => ({ id: m.id, sha256: m.sha256 })), 'Migration hash/order mismatch');
        return pg.transaction(async db => {
            await db.exec("SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '2s'; SET LOCAL search_path = public;");
            const before = await capture(db);
            assertOld(before);
            assert.deepEqual(before.migration_tables, [], 'Unreviewed migration journal; stop');
            const present = before.tables.filter(table => !existingNames.includes(table.name));
            if (await ledgerExists(db)) {
                assert.deepEqual(await readHistory(db), expectedHistory, 'Partial, changed or unknown adoption history');
                assert.deepEqual(sort(present), sort(expectedFeatures));
                return { applied: 0, verifiedAlreadyApplied: true };
            }
            assert.equal(present.length, 0, 'Unjournaled/partial feature objects; stop');
            await db.exec('CREATE SCHEMA carearound_release; CREATE TABLE carearound_release.schema_changes (' +
                'change_id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN (\'observed_baseline\', \'executed_migration\')),' +
                'sha256 text NOT NULL CHECK (sha256 ~ \'^[a-f0-9]{64}$\'),' +
                'source_revision text NOT NULL CHECK (source_revision ~ \'^[a-f0-9]{40}$\'),' +
                'recorded_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL);');
            const record = async (id, kind, hash, details) => db.query(
                'INSERT INTO carearound_release.schema_changes (change_id, kind, sha256, source_revision, details) VALUES ($1,$2,$3,$4,$5)',
                [id, kind, hash, sourceRevision, JSON.stringify({ rehearsalOnly: true, ...details })],
            );
            await record(baselineId, 'observed_baseline', evidenceSha256, {
                baseline0000: 'not executed; captured legacy definitions retained',
                migration0001: 'not applied; separate auth-index review required',
                migration0002: 'columns observed; historical execution unknown',
            });
            for (const migration of suppliedFeatures) {
                await db.exec(migration.sql);
                await record(migration.id, 'executed_migration', migration.sha256, {});
                if (migration.id === failAfter) throw new Error('Injected interruption');
            }
            const after = await capture(db);
            assertOld(after);
            assertFeatures(after);
            assert.equal(after.tables.length, 70);
            assert.deepEqual(await readHistory(db), expectedHistory);
            return { applied: 4, verifiedAlreadyApplied: false };
        });
    }
    return { pg, evidence, features, featureNames, expectedFeatures, capture, captureRows, applyFeatureUpgrade, readHistory };
}
