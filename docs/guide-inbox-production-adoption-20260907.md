# Approved Guide/inbox legacy-database adoption

Decision: the user explicitly approved the tested migration record and exact
`0003`–`0006` for Neon production on September 7, 2026, after authorizing the
complete scoped release. Earlier approval-pending notes are historical.

## One accountable execution path

Owner: **CareAround Backend Platform Owner**, with Codex executing the user's
scoped approval. Target: project `silent-queen-04984362`, production branch
`br-green-union-ailxs0g3`, database `neondb`, PostgreSQL 17, role `neondb_owner`.

The selected, dated adoption path is the offline generator
`server/scripts/generate_neon_feature_adoption.mjs`, followed by reviewed SQL
execution in the already-authorized Neon console. It accepts only the two named
production/rehearsal targets and has no database connection or secret handling.
The generated production SQL SHA-256 is
`170627bf4757b9238505e68fc6c0476c4e6d1dd421c478866adc07bb9d528098`.
Execute its exact bytes, not an edited rehearsal script. Browser preparation and
Run are separate operations; verify the complete editor text, not visible lines.

This approved environment-specific decision resolves the adoption proposal; it
does not replace the ordered migration files or create a second general runner.
Do not run generic Drizzle migrate/push against this legacy environment. Do not
apply `0000`, silently apply `0001`, rerun `0002`, repair legacy drift, or forge
historical Drizzle execution records. The existing migration/governance and
repository instructions are unchanged.

`carearound_release.schema_changes` is the selected operational record for this
adoption. It records the SHA-pinned **observed** legacy baseline and the four
actually executed migration hashes, source revision and accountable owner.
PUBLIC receives no access to the operational schema/table. Existing 60-table
definitions and legacy behavior remain intact; ten private-feature tables are
added by the exact approved SQL. Future migrations must explicitly respect this
record and undergo the same reviewed ownership/release process.

## Execution and recovery contract

- No transaction may already be open. Two timeout settings precede **one**
  auto-committed DDL batch: 15-second statement timeout, two-second lock timeout.
  The batch checks both settings, exact target/role, an advisory lock, complete
  old/new schema fingerprints and exact history. No browser round trips hold
  the DDL transaction open between migration statements.
- Failure rolls back all DDL and ledger writes. A repeat after success verifies
  the complete schema/history without rerunning DDL. Wrong targets, old-schema
  drift, occupied feature objects, unknown journals and altered history stop.
- Preserve current live Worker settings (`--keep-vars`) and all secrets. Keep
  both support rollout flags off until the database/API checks pass. The minute
  trigger's disabled handler performs no database work.
- Refresh the recovery point immediately before execution. The retained
  03:00:42 UTC manual snapshot was successfully restored to a separate branch;
  that restored copy was removed after verification. A new snapshot uses that
  rehearsed process; it does not imply a production cutover has been tested.
- Roll back an application problem by disabling the support flag and restoring
  a compatible application artifact. Retain the additive tables/private records.
  Never drop feature tables or restore over live production as an automatic
  rollback. Any destructive data repair/cutover needs separate approval.

## Current evidence and boundaries

[Readiness evidence](evidence/guide-inbox-production-readiness-20260907.json)
records the real PostgreSQL 17 single-batch failure/success tests, 47 enforced
constraint cases, empty rehearsal cleanup, independent live runtime branch/role
observation and temporary private-map cleanup. The current production dataset
continued to receive user activity during checks; it was not frozen or copied.

The feature candidate includes current main's Manage Resources release through
merge `50bad4da8`; the only merge conflict was the ledger, and both records were
retained. Quality passes with 721 server / 772 client checks, static validation
and the feature-enabled exact map-root client build. The release-command tests
also require preservation of existing live variables without weakening branch,
clean-source, revision or configuration-override guards.

Existing authenticated-session checks passed via a separate browser tab and the
normal APIs, without copying session credentials. The credentialed fresh-login
and import smoke suite has not run: dedicated smoke credentials are absent.
Record this limit separately from authorized existing-session/public probes;
do not relabel it a full smoke pass. Production feature journeys, artifact
parity and scheduled processing still require verification after rollout.

At this checkpoint the production schema is still unchanged. This document is
execution approval/readiness evidence, not a deployed-release certificate.
