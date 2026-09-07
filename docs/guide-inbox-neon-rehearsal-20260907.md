# Guide/inbox Neon rehearsal and recovery evidence

Verified: 2026-09-07, approximately 10:49–11:09 Singapore.
Application candidate: `334559209472e8c0676d8ce023f48d9d09779d28`.
The current test/evidence checkpoint adds no application or migration changes.

## Authorization and boundaries

The user authorized continuation of the complete scoped goal, including required
rehearsal and release gates. The old local-only permission notes are historical.
Exact production migration/adoption approval and the repository release gates
remain required. No production schema/data, credentials, connections, auth,
Worker traffic, Pages deployment, Graft configuration or instructions changed.
A manual production snapshot was created; this is provider backup storage,
not a production database/application change.

## Real PostgreSQL 17 migration rehearsal

- Project: `silent-queen-04984362` (Senior Resource Map).
- Production: `br-green-union-ailxs0g3`, database `neondb`.
- Test branch: `carearound-guide-inbox-rehearsal-20260907`,
  `br-autumn-mode-aikak52t`; schema-only, with no copied user records.
- Engine: PostgreSQL 17.11; console role `neondb_owner`.
- Auto-expiry: September 8, 2026, 10:31 Singapore.

The branch initially matched all 60 production table fingerprints, 604 columns,
195 catalog constraints, 207 indexes, enums and RLS flags. Exact migrations
`0003_support_inbox`, `0004_guide_history`, `0005_notification_updates` and
`0006_saved_search_alerts` added ten tables. Their fingerprints matched the
expected schema; all existing fingerprints remained identical.

An intentional exception after `0005` left a failed transaction. Explicit
console ROLLBACK removed the new tables and operational ledger. A refreshed
read-only fingerprint matched the original exactly. The subsequent successful
retry also verified the ledger schema was absent before creating it.

Actual Neon synthetic tests passed 47 invalid-state checks: 27 CHECK constraints,
13 foreign keys and seven non-primary unique indexes. They also verified unsave
retains My Map/Calendar rows, legacy partner CASCADE, staff SET NULL and owner
cleanup. All synthetic rows rolled back. All 70 public tables were verified
empty afterward; only the five rehearsal audit records remain in the separate
operational schema. Sequence allocation was confined to the disposable branch.

The SQL itself rejects production by exact branch ID, database and major
version, and uses bounded timeouts and a transaction-scoped advisory lock.
The console's virtualized editor was verified using full editor selection and
in-memory copy events, not just rendered lines. Preparation and Run must be
separate UI actions; an immediate Run reused the earlier failure query once.
Both failure runs were isolated and rolled back. No OS clipboard, credential
field, cookie or token was read for this workflow.

See [machine-readable migration evidence](evidence/guide-inbox-neon-rehearsal-20260907.json)
for exact submitted SQL hashes, query results and limitations.

## Fresh snapshot and restore

- Created `production at 2026-09-07 03:00:42 UTC (manual)`; final displayed size
  72.5 MB. The snapshot is retained with no automatic expiry.
- Scheduled backups remain daily at 18:00 UTC with 14-day retention;
  point-in-time history is separately six hours.
- Used Multi-step restore, which explicitly confirmed production would remain
  unchanged. Restored branch: `br-fragrant-bread-aibgpawc`, created at
  11:02:13 Singapore. No connections or settings were migrated.
- Read-only restored and current-production schema fingerprints match exactly.
  Core counts match: users 18, Places 4,440, Offerings 1,318, saved resources 164,
  My Maps 17, map-resource links 122. No personal records were displayed.
- Deleted only `br-fragrant-bread-aibgpawc` after verification. The branch list
  confirmed its removal; production and the fresh snapshot remain. The copy
  can be recreated from that retained snapshot.

See [machine-readable recovery evidence](evidence/guide-inbox-neon-recovery-20260907.json).
This proves schema/core-count recovery, not a live connection cutover, per-row
checksums, recovery during active writes, or non-Postgres service recovery.

## Local regression evidence and remaining release decisions

Follow-up two-session lock evidence is in
[the lock/retry record](evidence/guide-inbox-neon-locks-20260907.json).
Separate PostgreSQL backends on the empty rehearsal branch proved the advisory
migration lock rejects a second runner. A simulated writer held a ROW EXCLUSIVE
lock on `users`; a foreign-key probe stopped with lock timeout `55P03` under the
configured two-second limit. Both transactions were explicitly rolled back.
Retry succeeded after release; the probe table was absent, history remained five
rows, public table count remained 70, users remained zero, and no test advisory
locks remained. The additional browser tab was closed.

The successful FK probe held `ShareRowExclusiveLock` on the referenced users
table. The acquisition timeout does not bound how long an acquired lock is held.
Any approved production executor must minimize the transaction's hold time,
including avoiding one browser round trip per DDL statement. This narrow test
does not certify production traffic performance or runtime binding/role parity.

- Full server: 720 passed, no failed/cancelled/skipped tests.
- Static checks: seven ordered migrations, 471 modules / 1,393 edges, no cycles.
- The original SHA-pinned catalog capture retains its terminal blank line.
  Staged whitespace review excludes only that immutable evidence file from the
  blank-at-EOF rule; all other whitespace checks retain their default settings.
  Its bytes were not rewritten merely to satisfy a formatting check.
- Four actual-controller suites on the captured legacy schema: 36 passed.
- Earlier client/build/browser evidence remains scoped to the application
  candidate; it has not been relabelled as deployed or rerun by these DB tests.

Production has no migration journal and differs from the fresh-install baseline.
The additional `carearound_release.schema_changes` ledger was tested only as a
proposal. It records an observed legacy baseline plus four genuinely executed
migrations, not fictitious `0000`–`0002` execution. Adopting it for production is
a migration-governance decision that must be explicitly reviewed; it is not a
second runner to silently bypass `docs/database-migrations.md`.

Still required: that exact adoption decision; independent confirmation of the
Worker's actual database branch/runtime role without reading credentials;
short-lock-hold execution review; authenticated release smoke; clean-source
commit/merge and explicit Worker/Pages rollout with feature flags; and deployed
artifact, privacy, consent and scheduled-processing verification. No feature
release or fix-available announcement is certified by this rehearsal.
