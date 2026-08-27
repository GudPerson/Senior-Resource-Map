import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(serverRoot, 'drizzle', 'migration-manifest.json');

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

async function readUtf8(relativePath) {
    return readFile(path.join(serverRoot, relativePath), 'utf8');
}

function requireCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function main() {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    requireCondition(manifest.formatVersion === 1, 'Unsupported migration manifest format.');
    requireCondition(Array.isArray(manifest.migrations) && manifest.migrations.length > 0, 'Migration manifest is empty.');

    const schemaSource = await readUtf8(manifest.authoritativeSchema);
    const bootstrapSource = await readUtf8(manifest.runtimeCompatibilityBootstrap);
    requireCondition(
        sha256(schemaSource) === manifest.currentSchemaSha256,
        'src/db/schema.js changed without updating the ordered migration manifest.',
    );
    requireCondition(
        sha256(bootstrapSource) === manifest.runtimeCompatibilityBootstrapSha256,
        'Runtime compatibility DDL changed without explicit migration-manifest review.',
    );

    const journal = JSON.parse(await readUtf8('drizzle/meta/_journal.json'));
    const entries = Array.isArray(journal.entries) ? journal.entries : [];
    requireCondition(entries.length === manifest.migrations.length, 'Drizzle journal and ownership manifest have different migration counts.');

    const seenIds = new Set();
    for (let index = 0; index < manifest.migrations.length; index += 1) {
        const migration = manifest.migrations[index];
        requireCondition(/^\d{4}_[a-z0-9_]+$/.test(migration.id), `Migration ${index} has an invalid ordered id.`);
        requireCondition(!seenIds.has(migration.id), `Duplicate migration id: ${migration.id}`);
        seenIds.add(migration.id);
        requireCondition(migration.owner?.trim(), `Migration ${migration.id} has no accountable owner.`);
        requireCondition(migration.forwardOnly === true, `Migration ${migration.id} must declare forward-only handling.`);
        requireCondition(migration.rollbackStrategy?.trim(), `Migration ${migration.id} has no rollback/restore strategy.`);
        requireCondition(entries[index]?.idx === index, `Drizzle journal index ${index} is out of order.`);
        requireCondition(entries[index]?.tag === migration.id, `Drizzle journal tag does not match ${migration.id}.`);
        requireCondition(path.basename(migration.file, '.sql') === migration.id, `Migration filename does not match ${migration.id}.`);

        const migrationSql = await readUtf8(migration.file);
        requireCondition(sha256(migrationSql) === migration.sha256, `Migration SQL changed without manifest review: ${migration.id}`);
        requireCondition(!/\b(DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i.test(migrationSql), `Destructive statement found in ${migration.id}.`);
        requireCondition(!migrationSql.includes('"lower("'), `Malformed quoted lower() expression found in ${migration.id}.`);

        if (migration.snapshotFile) {
            const snapshot = await readUtf8(migration.snapshotFile);
            requireCondition(sha256(snapshot) === migration.snapshotSha256, `Migration snapshot changed without manifest review: ${migration.id}`);
        }
    }

    const baselineSql = await readUtf8(manifest.migrations[0].file);
    const requiredPredicates = [
        /governance_group_memberships_active_user_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /governance_group_organizations_active_unique[\s\S]*WHERE "unlinked_at" IS NULL/,
        /governance_group_resource_links_active_resource_unique[\s\S]*WHERE "unlinked_at" IS NULL/,
        /hard_asset_staff_memberships_active_user_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /organization_access_memberships_active_user_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /organization_resource_links_active_resource_unique[\s\S]*WHERE "unlinked_at" IS NULL/,
        /partner_organizations_legacy_partner_unique[\s\S]*WHERE "legacy_partner_user_id" IS NOT NULL/,
        /partner_staff_memberships_active_user_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /partner_staff_memberships_active_owner_unique[\s\S]*WHERE "revoked_at" IS NULL AND "staff_role" = 'owner'/,
        /phone_login_attempts_provider_challenge_unique[\s\S]*WHERE "provider_challenge_id" IS NOT NULL/,
        /phone_verification_attempts_provider_challenge_unique[\s\S]*WHERE "provider_challenge_id" IS NOT NULL/,
        /soft_asset_staff_memberships_active_user_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /user_calendar_items_planned_occurrence_unique[\s\S]*coalesce\("source_schedule_entry_key", 'legacy-primary'\)[\s\S]*WHERE "item_type" = 'planned_session'/,
        /user_opt_out_records_active_user_type_unique[\s\S]*WHERE "active" = TRUE AND "revoked_at" IS NULL/,
        /user_phone_identities_active_phone_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /user_phone_identities_active_user_unique[\s\S]*WHERE "revoked_at" IS NULL/,
        /users_google_subject_unique[\s\S]*WHERE "google_subject" IS NOT NULL/,
    ];
    requiredPredicates.forEach((pattern) => {
        requireCondition(pattern.test(baselineSql), `Baseline is missing a required partial/expression index predicate: ${pattern}`);
    });
    requireCondition(!baselineSql.includes('"coalesce("'), 'Baseline contains a malformed quoted expression index.');

    const normalizedLoginMigration = await readUtf8('drizzle/0001_normalized_login_indexes.sql');
    requireCondition(
        /GROUP BY lower\("username"\) HAVING count\(\*\) > 1/.test(normalizedLoginMigration)
        && /GROUP BY lower\("email"\) HAVING count\(\*\) > 1/.test(normalizedLoginMigration),
        'Normalized login migration is missing its privacy-safe collision preflight.',
    );
    requireCondition(
        /users_username_normalized_unique[\s\S]*lower\("username"\)/.test(normalizedLoginMigration)
        && /users_email_normalized_unique[\s\S]*lower\("email"\)/.test(normalizedLoginMigration),
        'Normalized login migration is missing a reviewed expression index.',
    );

    process.stdout.write(`Validated ${manifest.migrations.length} ordered migration(s); repository schema ownership is consistent.\n`);
}

main().catch((error) => {
    process.stderr.write(`Migration validation failed: ${error.message}\n`);
    process.exitCode = 1;
});
