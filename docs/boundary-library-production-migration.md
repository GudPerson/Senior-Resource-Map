# Boundary Library production migration

The ordered boundary migration adds six private tables and two owned serial
sequences. It does not backfill or modify existing resource, map, zone, account,
or permission rows. Keep these additive objects when rolling back the application.
The serving annotation API must retain the exact-geometry compatibility guard
after protected drawings have been saved.

`server/scripts/generate_boundary_library_release.mjs` is an **offline SQL
generator**. It never reads environment files or accepts connection credentials.
Execute reviewed SQL only in the already authenticated, authorized Neon SQL
Editor. Do not run baseline `0000`, generic schema bootstrap, or the whole ordered
sequence against the existing database.

The migration number is resolved from the one reviewed
`####_boundary_library_guided_zones` manifest entry. A concurrent Regional
Discovery release has reserved `0011`; the boundary release must rebase and
regenerate its ordered metadata as `0012` after that release's explicit handback.
Until then, the current `0011` fixture is local evidence only. The SQL contents
remain pinned to SHA-256
`9924475d4a9332bf40bea8cb3b7a47143f63340b646a42714ef2b2a71aad6bec`.
Any change to those bytes requires separate review and a new generator pin.

## Read-only preparation

Coordinate the shared source/publisher and database schema writers first. An
elapsed observation window does not prove that another release completed.

1. Verify the selected Neon project, branch, database, role and PostgreSQL major
   against the serving runtime's authorized identity observation. Do not inspect
   credentials to establish this mapping.
2. Record a current recoverable snapshot/PITR point, recovery retention and
   restore evidence. Snapshot existence alone does not prove a successful restore.
3. Produce the initial metadata-only query:

   ```sh
   node server/scripts/generate_boundary_library_release.mjs --identity-sql
   ```

   Confirm target identity and that the established
   `carearound_release.schema_changes` ledger is present. An absent/unknown
   ledger requires investigation; this generator does not adopt or create it.
4. Only then produce and run the full metadata-only query:

   ```sh
   node server/scripts/generate_boundary_library_release.mjs --preflight-sql
   ```

   It reads catalog definitions and four migration-provenance fields. It reads
   no application rows, sequence counter values, cookies, tokens or credentials.
   Capture only its `boundary_release_preflight` JSON value and observation time.
   Public view definitions are hashed inside the database; their SQL bodies are
   not included in this metadata output.
5. Independently review the captured catalog/history against accepted previous
   release receipts. Confirm the next boundary ordinal is free; never equate a
   different `0011` release with this migration. Confirm all six boundary tables,
   their serial sequences, index names and composite types are absent. Existing
   complete objects without the exact accepted provenance, or partial/changed
   objects, require investigation rather than `IF NOT EXISTS` adoption.
6. Obtain the accepted immediate predecessor's migration receipt from the
   completed release. The generator requires its exact manifest identity, SQL
   hash, executed-migration kind and accepted source revision to match a row in
   the fresh production history. For boundary `0012`, this is the reviewed
   Regional Discovery `0011` adoption. An earlier catalog ending at `0010` cannot
   be used to install boundary `0012`.

## Generate and review one transaction

Create a local metadata file containing:

```json
{
  "sourceRevision": "<exact reviewed merged source SHA, 40 lowercase hex characters>",
  "migrationId": "0012_boundary_library_guided_zones",
  "observedAtUtc": "<fresh catalog observation timestamp>",
  "baseline": "<replace this string with the captured boundary_release_preflight object>",
  "predecessorReceipt": {
    "change_id": "0011_regional_discovery",
    "kind": "executed_migration",
    "sha256": "<exact predecessor SQL SHA-256 from the reviewed manifest and accepted release>",
    "source_revision": "<accepted predecessor source SHA, 40 lowercase hex characters>"
  },
  "recovery": {
    "verifiedAtUtc": "<fresh recovery verification timestamp>",
    "recoveryPointId": "<opaque provider snapshot or PITR point identifier>",
    "restoreEvidenceSha256": "<SHA-256 of the separately reviewed recovery evidence>"
  }
}
```

The example `0012` becomes usable only when the manifest and reviewed SQL have
that identity; the generator rejects mismatched/duplicate ordinals. Do not fill
the placeholder from historical evidence. Both catalog and recovery verification
must be within one hour at generation **and execution**.
The predecessor receipt and recovery objects reject unknown fields, nested
provider exports and free-text notes. The recovery point identifier accepts only
8–160 letters, digits, periods, underscores, colons and hyphens. Keep restore
limitations and review notes in the separate evidence document whose hash is
referenced; do not paste provider responses or credentials into this metadata.

```sh
node server/scripts/generate_boundary_library_release.mjs --generate metadata.json reviewed-batch.sql
node --test server/test/boundaryReleaseBatch.test.js
```

Generation uses exclusive file creation, prints the batch/migration/baseline
hashes, and leaves review before execution. The batch pins the fresh target,
source SHA, exact previous catalog, exact previous migration history and exact
migration bytes. It takes the established shared advisory transaction lock
`(20260907,3006)`, requires a 2-second lock timeout and 15-second statement timeout,
and applies the DDL, complete postchecks and exactly one provenance row in one
transaction. Parent foreign-key prerequisites must match the reviewed schema;
any constraint failure rolls the whole transaction back.

The catalog checks include column types, defaults and nullability; all validated
constraints and FK actions; index definitions and validity; table RLS, policies
and noninternal triggers; serial sequence properties and ownership; enums, other
relations and migration journals. Existing catalog definitions are pinned as
observed; the generator does not force the fresh baseline onto legacy schema.
All interpolated metadata and the exact DDL use UTF-8 hex decoding in generated
SQL. Quotes, backslashes and a matching outer dollar delimiter inside catalog
text cannot terminate the DO body. Durable recovery provenance is an explicit
projection of the three allowed fields, plus the accepted predecessor receipt.

Rehearsal covers fresh and reconstructed legacy adoption, wrong target/timeouts,
stale observations, history/ordinal conflicts, schema drift, unjournaled partial
objects, atomic interruption and exact repeat without rewriting history. The
single-backend PGlite test forces the lock-denied branch; it **does not prove
multi-session PostgreSQL lock contention**. A real multi-session rehearsal and
the current production target/recovery verification remain separate operator
evidence.

## Apply and verify

After independent batch review, refreshed release/maintenance checks and approved
recovery evidence, execute the exact reviewed transaction once through the
authenticated Neon SQL Editor. Do not retry an unknown acknowledgement. Read
the metadata query first and reconcile the existing ledger/schema.

A complete repeat of the **same fresh batch** verifies catalog and exact
source-bound migration provenance and returns without writes. Missing or changed
provenance fails. An expired batch must not be replayed. The read-only metadata
query remains available for later inspection; independently compare the actual
six-table/two-sequence signatures, preserved previous catalog and single exact
history row with the approved batch and receipt before deploying routes.

Record the actual target, observed recovery evidence, source SHA, migration and
batch hashes, adoption row, result and postverification time in the release
receipt. Deploy the compatible API before the matching client, then verify the
signed-in journey using only the approved hidden test Place and our own private
test objects.
