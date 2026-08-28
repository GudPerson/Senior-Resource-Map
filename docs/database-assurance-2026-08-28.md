# Production database assurance — 2026-08-28

## Scope and safety

This was a read-only assurance review of the production database configured by the local `server/.env`. No schema statement, migration, insert, update, delete, credential reset, or provider setting change was performed. Connection identifiers were recorded only as short hashes; user identifiers, contact details, password hashes, credentials, and secrets were not recorded.

The checked target matched the established production fingerprint:

- host hash: `e1629e77b57846ff`
- database hash: `779b9128cc47c655`
- user hash: `6f198191100386e1`
- TLS mode: `require`

## Structural comparison

The comparison used `server/src/db/schema.js` as the expected application model and PostgreSQL catalogue metadata as the actual database model. The reusable audit is `server/scripts/audit_schema_alignment.mjs`; it reads metadata only and exits non-zero when drift is present.

Confirmed alignment:

- 60 expected and 60 actual public tables.
- 604 expected and 604 actual columns.
- No missing or extra table.
- No missing or extra column.
- No data-type mismatch.

Confirmed drift:

1. The production database has six stricter `NOT NULL` rules than the source schema: `hard_assets.social_links`; `soft_asset_parents.social_links`; and `soft_assets.availability_count`, `availability_enabled`, `overridden_fields`, and `social_links`. This protects existing database writes from nulls, but source-generated migrations or a fresh database could behave differently.
2. The reviewed normalized login indexes `users_email_normalized_unique` and `users_username_normalized_unique` are still absent. This is the already documented, unapplied `0001_normalized_login_indexes` work; it was not applied during this review.
3. Production uses `ON DELETE CASCADE` for `hard_assets.partner_id` and `soft_assets.partner_id`, while the source schema declares `ON DELETE SET NULL`. The account-deletion endpoint performs a physical user deletion. A production count confirmed zero hard assets, zero soft assets, and zero account owners currently use these legacy `partner_id` links, so no current production resources are exposed through this path. The mismatch must nevertheless be reconciled before those legacy ownership links are used again.
4. Production retains an `audience_zones.hard_asset_id` foreign key that is not declared as a reference in the source schema. One audience-zone row currently uses the link. Its production action is `SET NULL`, so deleting the linked hard asset would preserve the audience-zone row.
5. The `my_maps_share_token_unique` index is partial in production and unconditional in the source declaration. Both permit multiple null values under PostgreSQL and enforce uniqueness for non-null tokens, so no present behavioural difference was established.
6. Production retains the legacy enum `category` and the legacy `role` values `admin` and `user`. Aggregate inspection found no account using either legacy role value; all 18 accounts use `regional_admin`, `standard`, or `super_admin`.

## Historical fallback-credential audit

All 18 production password hashes were compared in memory with the obsolete bulk-import fallback credential recovered from the parent of the removal commit. The credential and password hashes were never printed or stored by the audit.

- Matching accounts: **0**
- Account changes required: **none**

This closes the historical-account exposure check for the current production account set. The code-level prevention remains covered by the user-controller tests.

## Backup and restore evidence

The repository correctly requires a provider-owned restore point and rehearsal before any production schema change. It does not contain current provider retention, point-in-time recovery, or restore-test evidence, and the database connection does not expose account-level backup settings. Therefore:

- current backup retention: **not verified**
- point-in-time recovery window: **not verified**
- most recent restore rehearsal: **not verified**
- accountable provider-console owner: **not recorded in the repository**

This uncertainty does not block a test/documentation-only release, because that release does not change production schema or data. It **does block every production migration** until a named owner captures dated provider-console evidence and a restore/forward-repair decision.

## Recommended direction

1. Keep production migrations frozen.
2. Obtain provider-console backup retention and restore-test evidence.
3. Prepare one reviewed schema-reconciliation plan covering the six nullability rules, the two `partner_id` delete actions, the audience-zone legacy link, the share-token index definition, and legacy enums.
4. Treat the two normalized login indexes as an exact, separately approved migration after duplicate preflight, backup evidence, and rollback/forward-repair rehearsal.
