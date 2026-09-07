# Guide/inbox database adoption — local plan and rehearsal

Status: local plan and synthetic rehearsal completed on 2026-09-07. Not a
production migration instruction or release approval. Candidate application:
`33455920`; the new test-only harness and evidence are uncommitted.

Follow-up: the user subsequently authorized completing the scoped goal.
The [Neon PostgreSQL 17 and fresh recovery rehearsal](guide-inbox-neon-rehearsal-20260907.md)
now passes. The local-only restrictions and unavailable-provider observations
below describe the earlier checkpoint, not current access or authorization.
The additional ledger remains a proposal requiring an explicit production
adoption decision; no production migration authority is silently replaced.

## Decision and blast radius

Preserve the captured production schema as an **observed legacy baseline**.
Do not modify the existing 60 tables, constraints, indexes or enums to make them
look like the repository's fresh-install baseline. Do not run `0000`, silently
apply `0001`, rerun `0002`, or insert fictitious applied entries for them into
Drizzle's journal. Runtime schema bootstrap stays unchanged.

The proposed upgrade contains the exact four reviewed feature migrations
`0003`–`0006`, adding ten private-feature tables. It depends on existing integer
primary keys in `users` and `user_favorites`; it does not require the two missing
normalized login indexes. Existing application/auth behavior is preserved.
The missing indexes remain a separate reviewed change, including a privacy-safe
collision check and measured locking plan if that change is later approved.

For adoption bookkeeping, this rehearsal models a separate, explicit release
ledger (`carearound_release.schema_changes`), recording an observed-baseline
evidence hash and four genuinely executed migration hashes. This additional
schema/table is a **proposal**, not part of the four already-reviewed SQL files.
It needs explicit review and production authorization too. No production runner,
manifest, Drizzle journal, repository instructions or Graft configuration changes
are being introduced by this local test. Until a single migration authority is
reviewed and adopted, do not run a generic migrate/push command against this
environment; the prototype is not an alternate approved deployment path.

## Rehearsal design

Use in-memory PGlite only, with no URL, environment-file loading, production
records, network client, Neon branch or provider operation. Verify the pinned
catalog-evidence SHA-256 and all seven repository migration hashes. Construct an
empty production-shaped schema using the baseline plus captured catalog
definitions, before inserting explicitly synthetic records.

Compare all 60 table/604 column fingerprints, constraint/index definitions,
enum labels and RLS flags with the read-only evidence. Exclude PostgreSQL 18's
separate NOT NULL catalog entries while checking column NOT NULL attributes.
Then:

1. Seed synthetic resources, users, favourites, maps, plans and notification
   preferences. Retain a row digest for every existing table.
2. Reject unexpected baseline drift, occupied feature tables, modified migration
   bytes, partial/mismatched bookkeeping or an unknown history.
3. In one transaction, add the proposed ledger, record the observed baseline,
   execute exactly `0003`–`0006` and record their hashes. Verify new-table
   definitions against the same immutable SQL on a fresh reference database.
4. Prove existing table definitions, enums and row digests remain unchanged.
   Check all 27 feature CHECK constraints, 13 foreign keys, seven non-primary
   unique indexes and targeted deletion behavior.
5. Inject failure mid-upgrade: expect all feature DDL and ledger writes to roll
   back. Retry safely. A completed retry must verify the full state and perform
   no duplicate DDL; a malformed partial installation must fail closed.

The local fixture reconstructs schema for testing; its drop/recreate operations
are confined to a newly created, empty in-memory database. They are never a
production adoption recipe or a rollback procedure.

## Production gates still open

- Review this adoption design and its additional ledger DDL; designate one
  accountable migration owner and one execution method. Do not forge historical
  Drizzle entries to skip the old migrations.
- Refresh exact-target catalog evidence; independently confirm the Worker's
  database target, runtime permissions, object grants/default privileges,
  triggers/functions and any unsupported catalog attributes. The preflight
  captured table/column/constraint/index/enum/RLS metadata, not a full schema dump.
- Verify current recovery point and required restore-rehearsal evidence. Any
  provider clone/restore, production data inspection or repair needs separate
  authorization.
- Rehearse on the production PostgreSQL major version and validate real role,
  lock, concurrency and interruption behavior before approving execution.
- Approve exact source, migration and ledger hashes, environment, maintenance
  window and rollback-by-disabling plan. Keep API/UI flags off during preparation.
- Perform authenticated release smoke, privacy/consent checks, scheduled-job
  checks and complete Worker/Pages artifact verification after an approved release.

The local PostgreSQL 18 engine is not Neon PostgreSQL 17. A passing synthetic
rehearsal is compatibility evidence, not a live restore test, performance test,
production readiness certificate, or permission to deploy.

## Results

Verified at 2026-09-07 10:13 Singapore (02:13 UTC):

| Check | Result |
| --- | --- |
| Captured legacy schema | Exact normalized fingerprint parity: 60 tables, 604 columns, 195 non-NOT-NULL catalog constraints, 207 indexes; enums and RLS flags match |
| Additive upgrade | Exactly four feature migrations applied; ten tables added; all existing table/enum fingerprints and all 60 synthetic row-set digests unchanged |
| Legacy login behavior | Synthetic case-colliding identifiers remain valid; neither missing normalized index was added |
| Constraint enforcement | 27 CHECKs, 13 FKs and seven non-primary unique indexes rejected invalid/orphaned/duplicate synthetic state |
| Failure/retry | Mid-upgrade failure rolls back new DDL and ledger; retry succeeds; completed retry performs no new DDL or history writes |
| Stop conditions | Existing-schema drift, occupied feature tables, changed SQL/order, an unknown migration journal, changed/extra ledger history and altered installed feature definitions are rejected |
| Relationship behavior | Unsave cascades only its watch/notice while retaining map and Calendar rows; legacy partner CASCADE, staff SET NULL and owner-scoped feature cleanup are preserved |
| Tests | Focused rehearsal: 17/17; full server: 719/719; no failed, cancelled or skipped tests |
| Static checks | Seven migrations validated; 471 source modules / 1,393 edges, no cycles; diff check passed |

Reproduce from the authorized worktree with
`node --test server/test/productionSchemaAdoption.test.js`; broaden with
`npm run test:server` and `npm run check:static`.
The fixture owns an in-memory PGlite instance and exposes no external connection
option. Do not extract its reconstruction or ledger code for production use.

The [machine-readable rehearsal record](evidence/guide-inbox-migration-rehearsal-20260907.json)
pins the test files, input evidence and exact migration hashes. The read-only
input and its limitations are in [the preflight report](neon-read-only-preflight-20260907.md).

No application source, existing migration, dependency, runtime bootstrap, auth,
flag, secret, Graft configuration or repository instruction changed. No client
build was necessary for these test-only additions; earlier client evidence was
not rerun or promoted to a new release artifact. No production connection,
snapshot, restore, data inspection, push, commit or deployment was performed.

The retention check proves private test records remain after the migration;
it does not simulate a live application rollback or provider outage. PostgreSQL
17, grants/roles, production triggers, sequence ownership/state, collation,
concurrent writers, lock contention and recovery under active traffic are not
certified by the captured fingerprint. Common local PostgreSQL 17/Docker paths
were unavailable; no software was installed to change that.

Recommended next step: review the adoption/ledger proposal and authorize a
separate production-version rehearsal target, with exact branch and privacy
boundaries. A temporary Neon branch or provider restore is a distinct external
mutation. Production execution and Worker/Pages release remain unapproved.
