# Guide/inbox Neon preflight — 2026-09-07

Status: read-only inspection completed; production migration gate is **not passed**.
The access blocker is resolved. No schema, data, grants, backup settings,
credentials, deployment flags or production application were changed.

## Target and evidence

- Candidate: local commit `334559209472e8c0676d8ce023f48d9d09779d28`, branch
  `codex/guide-inbox-notifications-20260907`, in its existing isolated worktree.
  Graft was run from that same checkout. Its configuration and repository
  instructions were not changed.
- User-selected Neon project: **Senior Resource Map**, `silent-queen-04984362`.
- Selected branch: **production**, `br-green-union-ailxs0g3`.
- SQL Editor database: `neondb`; server version `17.11 (32e7196)`.
- Access: the user's existing authenticated Chrome tab, after the user enabled
  JavaScript from Apple Events. No credential, cookie or connection value was
  extracted. This identifies the approved console target; the Worker's
  connection-to-branch identity was not independently verified through secrets.
- Evidence checkpoint: 2026-09-07 07:49 Singapore / 2026-09-06 23:49 UTC.
- [Catalog evidence and queries](evidence/guide-inbox-neon-preflight-20260907.json)
  contain schema metadata only, the local reference, and detailed comparisons.

## Backup observations

- Scheduled snapshots: daily at 18:00 UTC, automatic deletion after 14 days.
- Ten snapshots were visible. The latest was created
  `2026-09-06T18:00:05Z` (September 7, 02:00 Singapore), displayed size 3.66 MB,
  expiring `2026-09-20T18:00:05Z`.
- Point-in-time history is a separate **six-hour** window. Do not describe the
  snapshot retention as fourteen days of continuous point-in-time recovery.
- The displayed snapshot size is not a verified total database size and is not
  evidence of record loss compared with the older 72.46 MB snapshot.
- The primary checkout's recovery runbook records an August 29 isolated restore
  rehearsal. No new snapshot, restore, restored-branch creation, data comparison,
  connection cutover or cleanup was performed here. A release-time recovery
  point and the required rehearsal evidence still need release review.

## Schema findings

The comparison used a disposable local database initialized with repository
migrations `0000` through `0002`, never the production connection. Production
queries used `BEGIN READ ONLY`, local statement/lock timeouts, catalog-only
SELECT statements and `ROLLBACK`. Each result confirmed `read_only: on`.

The installed PGlite reference is PostgreSQL 18.3, while production is 17.11.
The comparison therefore ignores physical column order and PostgreSQL 18's
separate NOT NULL constraint-catalog entries; NOT NULL is independently compared
using column attributes. Constraint names are separated from their semantics.
This avoids treating version/naming differences as missing protection.

| Check | Observed result |
| --- | --- |
| Existing public tables | All 60 expected names present; 604 columns; no extra/missing table names against `0000`–`0002` |
| New feature tables | All ten tables for `0003`–`0006` absent |
| Ordered migration journal | No table matching a migration name or in the `drizzle` schema found; do not assume enrollment |
| Columns | Six production columns are NOT NULL where the repository baseline allows NULL; remaining normalized column definitions match |
| Migration `0001` | Both normalized username/email unique indexes absent; no collision/data scan performed |
| Migration `0002` | Expected nullable verifier columns match catalog definitions; this does not prove journaled migration execution |
| New foreign-key parents | Existing `users` and `user_favorites` have their expected integer primary keys; runtime-role permissions were not separately verified |

Substantive differences requiring an explicit adoption decision:

1. `hard_assets.partner_id` and `soft_assets.partner_id` use **ON DELETE CASCADE**
   in production; the repository baseline specifies **ON DELETE SET NULL**.
   Silently applying a baseline repair would change existing deletion behavior.
2. Production requires non-null `social_links` on Places, Offerings and Offering
   templates, and non-null `availability_count`, `availability_enabled` and
   `overridden_fields` on Offerings. Do not relax these protections incidentally.
3. Production has an additional `audience_zones.hard_asset_id` foreign key using
   SET NULL, and a positive-revision check on `my_map_studio_documents`.
4. Production has additional indexes, including the active parent/host unique
   index on Offerings. Several primary/unique indexes merely have different
   names. The My Map share-token unique index is partial for non-null values.
   Preserve these definitions until reviewed; an index-name mismatch is not
   proof that uniqueness is missing.
5. Five baseline UNIQUE constraints are represented in production by equivalent
   unique indexes on the same columns: audience-zone code, the three resource
   external keys, and subregion code. The evidence records those matches.
6. Production retains legacy `admin`/`user` labels in the role enum and a legacy
   category enum. No application records were queried to determine their usage.

These are baseline-adoption findings, not permission to repair existing features
or reopen the five parked security findings. They do not establish that the new
feature itself caused a regression: its tables are not deployed.

## Safe next gate

Prepare and review a **local-only migration-adoption plan and rehearsal** that
preserves the observed live schema. Explicitly decide how an existing database
with this drift becomes governed by the migration journal. Do not mark `0000`
or `0001` as applied merely to advance the runner, and do not rerun `0002`
because its columns already exist.

The plan must address the missing `0001` indexes separately, including any
privacy-safe collision check, without folding an unapproved auth/index change
into the `0003`–`0006` feature release. Rehearse the exact proposed upgrade against
a disposable production-shaped schema and validate the feature's new constraints,
foreign keys and rollback-by-disabling behavior. A provider-backed clone or
restore rehearsal is a separate mutating operation requiring approval.

No production migration, baseline registration, Worker/Pages deployment, push or
merge is authorized by this preflight. The exact source/migration/environment
release approval, authenticated release smoke, support/retention ownership and
post-deploy verification remain outstanding as recorded in the release candidate.

## Handoff

- Application source and commit are unchanged; only these local evidence/docs
  were added or updated. Do not claim a new production-ready clean build from
  this documentation-dirty worktree.
- Documentation-only validation passed: evidence JSON parsed; 60 tables/604
  columns, ten absent feature tables, read-only results, six column differences
  and parent primary keys checked; all four feature migration hashes unchanged.
  Application source is unchanged, credential-pattern scan and `git diff --check`
  passed. No application records were collected. No new runtime tests were needed.
- The user can disable Chrome's JavaScript-from-Apple-Events permission after
  the inspection. Do not change that browser setting automatically.
