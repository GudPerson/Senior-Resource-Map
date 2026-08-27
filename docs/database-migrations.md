# CareAround SG Database Migration Ownership

## Purpose

CareAround's database structure is now owned by ordered, reviewable migration files in `server/drizzle/`. `server/src/db/schema.js` is the authoritative application model. The large `ensureBoundarySchema` runtime bootstrap remains only as a transitional compatibility path for local or explicitly authorised environments; it must not receive new schema changes by itself.

This change does not connect to or alter any database. The repository baseline has not been compared with production, because production access requires separate approval.

## Current baseline

- `0000_carearound_current_schema_baseline.sql` creates a fresh database matching the repository's declared Drizzle schema.
- It is a baseline, not an upgrade script for an existing CareAround database.
- Never run migration `0000` over an existing environment. First perform a read-only schema fingerprint, compare it with the baseline, and record that environment as baselined in the approved migration system.
- The baseline's partial and expression indexes are explicitly checked because the installed Drizzle generator does not preserve all of those predicates correctly without review.

The next ordered migration, `0001_normalized_login_indexes.sql`, adds case-insensitive username and email indexes for the bounded password-login query. It first checks for legacy case-only collisions and aborts without printing the affected identifiers. It is additive and has not been applied to any database.

## Ownership rules

Every schema change must include all of the following in one reviewed change:

1. The application model change in `server/src/db/schema.js`.
2. The next ordered SQL migration generated and then manually reviewed.
3. Its Drizzle snapshot and journal entry.
4. A new entry in `server/drizzle/migration-manifest.json` naming the accountable owner, hashes, forward-only approach, cautions and rollback/restore strategy.
5. Database integration tests or a documented reason they cannot run locally.
6. An update to the release checklist and regression ledger when a stable boundary changes.

Do not add new DDL only to `boundarySchema.js`. Its hash is frozen in the manifest so an unreviewed change fails `npm run verify:migrations --workspace=server`.

## Safe workflow for a future migration

1. Work on an isolated `codex/` branch and assess the data and release blast radius.
2. Change `src/db/schema.js`.
3. Generate the next migration with `npm run db:generate --workspace=server`. Generation is schema-only; it must use a non-production configuration.
4. Review the SQL for destructive statements, table locks, backfill cost, partial indexes, constraint failures and Worker compatibility.
5. Update the ownership manifest and run `npm run verify:migrations --workspace=server`.
6. Test on a disposable or approved non-production database. Test both a clean installation and an upgrade from a realistic pre-migration copy.
7. Capture a fresh backup/restore point and rehearse the rollback decision before applying the migration to production.
8. Apply to production only under a separately approved release window, then verify schema, application health and the affected user journeys.

## Rollback and recovery

CareAround migrations are forward-only by default. A safe rollback is chosen before deployment:

- For an additive change, deploy a compatible application rollback while leaving the additive database objects in place.
- For a data transformation, keep a validated reverse/repair migration or restore plan and preserve the source data until acceptance checks pass.
- For a destructive or irreversible change, stop. It requires explicit product-owner approval, a tested backup restore and a separately reviewed cutover plan.

Restoring a database is an operational action, not an ordinary code rollback. Backup retention, point-in-time recovery and restore-test evidence remain provider-owned facts that must be verified separately.

## Existing-environment baseline gate

Before the ordered sequence can govern an existing development, staging or production database, an authorised operator must:

1. Take a read-only schema fingerprint without displaying credentials or personal records.
2. Compare tables, columns, constraints, indexes and enum definitions against migration `0000`.
3. Resolve drift through a reviewed forward migration; do not edit production manually to make it look aligned.
4. Record the baseline as applied using the selected migration runner's journal mechanism.
5. Prove backup restoration and document the evidence date, owner and environment.

Until those steps are approved and completed, the repository baseline is authoritative for future development but production migration status remains unconfirmed.
