# Whole-area address search design

Date: 19 November 2026, Asia/Singapore. Status: engineering contract approved by the coordinator and client reviewer. The coordinator has authorised product implementation by a fresh worker; commits, pushes and deployment remain unauthorised.

## Outcome and boundary

The existing Addresses/postal codes controls must search the entire selected NUHS boundary and produce the complete matching-address CSV. Keep the exact selected geometry, snapshot notice, loaded-row selection/Copy/selected-CSV semantics and existing resource search. Do not simplify the outline or widen the search to postal-code membership. Distinct addresses sharing one postal code remain distinct.

The current `/address-snapshot/area` rejects the complete bounding-box workload before offset pagination. Its 16-tile, byte, candidate, geometry and storage-read limits remain unchanged, as do nearby search and Boundary postal scanners/jobs. Add an isolated authenticated read-only continuation endpoint using the existing verified reader and exact predicates. No database/schema, background job, auth-policy, credential, dataset or Cloudflare-setting change is required.

## HTTP contract

`POST /api/address-snapshot/area/scan` uses the existing signed-in/non-guest address middleware, CSRF behavior and private/no-store headers. Register this exact path alongside `/nearby` and `/area` in `app.js`'s streamed-body path list. The existing bounded 1 MiB JSON reader remains responsible for this route; do not broaden the global exemption.

Strict request keys: `{ area, snapshotSha256, cursor }`. `cursor` is null on the first step. `area` is the original SpatialArea, normalized and privately cloned with existing helpers; retain precision, multipart geometry, holes and boundary-edge behavior. Keep the existing 10,000-point geometry limit. Every step carries the same source-snapshot pin.

`ScanCursor` is `{ schemaVersion: 1, snapshotSha256, manifestSha256, manifestEtag, areaSha256, tile, row }`. Hashes are lowercase SHA-256. `areaSha256` hashes `JSON.stringify(normalizeSpatialArea(area))` without coordinate rounding/reordering. ETag is an exact nonempty bounded string (maximum 256 characters; no control characters). Tile/row are nonnegative safe integers into the deterministic manifest-filtered tile list and its row positions. Reject noncanonical/out-of-range positions. The terminal position is tile count with row zero. Do not return object keys/prefixes or request geometry in the cursor.

The cursor is an untrusted read-only bookmark, not a capability or signed completion certificate. Revalidate geometry hash, configured source/manifest identity, current manifest ETag and position every request. No signing secret is introduced. A caller can seek within its own authorised query, but the application may call a result complete only after accepting its own uninterrupted chain from null through done.

Response shape:

```text
{
  schemaVersion: 1,
  snapshot: existing snapshot DTO,
  scan: { areaSha256, manifestSha256, manifestEtag, tilesTotal, batchCandidateLimit },
  rows: [{ id, postalCode, block, roadName, building, address, lat, lng, ordinal }],
  nextCursor: ScanCursor | null,
  done: boolean,
  progress: { tilesCompleted, tilesTotal },
  diagnostics: { reads, bytes, consumedCandidates, candidates, geometryWork }
}
```

Ordinal is a safe integer from zero through pinned recordCount minus one, not derived from the address ID. Builder IDs are content-hash plus occurrence. Keep the existing reader's ID/6-digit-postal/string-length constraints, exact row keys and shared coordinate validation. Preserve all existing row fields, original coordinates and postal leading zeros. Do not return an exact `total` from a stateless step: the client calculates it after validated completion. An empty intermediate rows array is valid and never means no addresses. Snapshot/scan identity and tile count must remain identical across the chain.

`progress.tilesCompleted` is nondecreasing: dense-row slices may stay in the same tile. A nonterminal next cursor must strictly advance lexicographically by `(tile,row)`, and its `tile` equals `tilesCompleted`. `nextCursor` is null iff done; completion requires `tilesCompleted === tilesTotal`. Validate `rows.length <= consumedCandidates <= candidates <= batchCandidateLimit`. `consumedCandidates` counts unique cursor-advanced source positions in this step; `candidates` counts actual visited/geometry-tested positions, including a matching row withheld at the response-byte boundary. Charge every tested row to the per-step work budget even when it is not consumed. A retried withheld row can therefore be tested again, but must be consumed only once across the accepted chain.

Reuse existing sanitised 400/413/422/503 address errors. Source/configured-manifest/ETag changes return `409 ADDRESS_SNAPSHOT_CHANGED` and require explicit restart. Invalid cursor/area identity returns `400 ADDRESS_SNAPSHOT_INVALID_QUERY`. Corruption never returns an invented empty batch. Diagnostics contain only bounded counts, never geometry, object keys or provider messages.

## Per-step work and completeness

Create a separate `createAddressSnapshotScanRepository(bucket, { config })` with `scan(input, { signal })`. Reuse `createAddressSnapshotReader`, `normalizeSpatialArea`, `spatialAreaBounds` and `containsSpatialPoint`; leave Boundary scanner/job implementations untouched.

Filter candidate tiles by the existing bounding-box predicate and preserve manifest order. A step may span at most 16 tiles. All limits are cumulative across that step: at most 33 reads (one manifest plus two per tile), 4 MiB verified/reserved bytes, four concurrent reads and 250,000 candidate×edge operations. Read only whole verified bounded objects; reserve the next tile pair before starting it. Cap candidates at `min(512, maxCandidateRows, floor(maxGeometryWork / edgeCount))`, also respecting configured limits. The scan is not subject to a 16-tile limit across the entire selected area.

Stop before a next tile/row would exceed a budget and return the next position. If the first tile cannot fit, return a typed workload error rather than a non-progress response. Each nonterminal successful step consumes at least one candidate and advances. The 2 MiB bound covers the entire serialized response, not just its rows. Reserve 32 KiB for the bounded envelope and count UTF-8 row-array bytes incrementally, including commas/brackets. Stop before consuming a matching row that would exceed the remaining payload allowance; retain it as the next cursor position and include its test in candidates/work only. An individually impossible row fails explicitly. Check the final serialized envelope exactly before sending; an unexpected overflow fails the entire unaccepted batch, never truncates or drops already-consumed rows. The caller's last confirmed cursor remains unchanged on failure. Test worst-case bounded envelope fields against the reserve. Settle started storage reads on failure. Cancellation stops subsequent work; already-started bounded R2 reads may finish.

Validate row packs and index positions through the existing reader. Use exact spatial containment, not postal-code expansion. Return global ordinal with every match. The server tests must prove complete row/ordinal coverage across tile and row boundaries, without skipped or duplicated source rows.

## Client workflow and memory

Add `scanAddressAreaBatch({ area, snapshotSha256, cursor = null, signal })` to `addressSnapshotClient.js`; do not reuse the legacy `query()` exact-total validator. Add an isolated scan controller/hook. Start fallback automatically only after `422 ADDRESS_SNAPSHOT_AREA_TOO_LARGE` with a valid normalised workload diagnostic (`tiles`, `reservedBytes`, `candidateRows`, `geometryWork` or `storageReads`). Do not fallback for arbitrary 400/413/422, auth, corruption, network or snapshot-change errors.

Pin metadata before the first scan request and freeze the normalised query. Validate pinned metadata recordCount as a positive safe integer no greater than the index format's `0xffffffff`, only in this new scan path; do not tighten the legacy metadata/query validator. Send one batch at a time. Accept a batch atomically only after validating the whole response, expected request generation/cursor, identity, the progress/counter relationships above and row schema. Store unique IDs with their ordinals internally; identical replay rows are harmless, conflicting ID/ordinal/payload duplicates and the same ordinal under another ID fail. Keep rows, selectable checkboxes, exact total and complete CSV unavailable until done. Show translated scanning progress instead of a partial or no-address result.

Limits are pinned recordCount unique rows, cumulative accepted `consumedCandidates` no greater than recordCount, 64 MiB of serialized unique-row array payload, and `min(8192, max(1, recordCount))` successful batches. Do not accumulate actual candidates against recordCount: byte-boundary retesting may legitimately make that sum larger. Count UTF-8 bytes once per unique row, plus array brackets/commas; do not stringify the full accumulated array per batch. The 64 MiB guard bounds serialized payload, not JavaScript/browser heap; Maps, strings, sorting and CSV generation have additional memory costs to measure. A whole response is at most 2 MiB. Exceeding a guard produces a visible incomplete-search error with no complete result/CSV. The payload bound covers the current entire 28,877,797-byte snapshot plus a conservative 256-byte DTO expansion for each of 143,807 rows: 65,692,389 bytes, below 64 MiB. The step cap exceeds the current worst candidate-slice/549-tile bound under 10,000 edges, with headroom for payload splits; verify this in the private full-snapshot benchmark before claiming regional readiness. Future snapshot/limit changes must revalidate these bounds.

When done, sort by ordinal, verify unique IDs/ordinals, publish one ready result and set its exact total from the completed array. Render the first 200; existing Load more reveals the next local 200 without rescanning. Full CSV uses the completed array and existing fixed-column serializer; Copy/selected CSV continue using only selected loaded rows. Keep ordinal internally and assert the CSV header omits it; do not clone a second full row collection merely to strip it. Avoid duplicate full-row copies while retaining the accumulator and ready array.

Network Retry resumes the same pinned query from the last fully accepted cursor; no automatic retry loop and no accumulator reset. Invalid responses do not advance state. Snapshot change clears completion ability and offers explicit Restart search with a fresh metadata pin. Close/area/user changes abort transport, stop queued steps, clear retained rows and invalidate generations so late responses cannot reopen results. No Saved, resource, map or database writes occur.

## Data and realistic verification

Production objects come through binding **HELP_CMS_BUCKET** and `ADDRESS_SNAPSHOT_CONFIG`: immutable prefix `address-snapshot/v1/2d9740ed84cea78fd571ddc5c06e14c13d780bf47f4d50f405804c2e473b18e4-r2`, manifest SHA `0670fbbce22de6a82b776008eecaa2791737e2ddcc41e58403a03601000ee4e2`, 320,450 manifest bytes, 549 tiles, 143,807 rows and 1,099 objects / 28,877,797 bytes. No secret or environment file is needed to identify the source. Keep the incomplete/outdated-snapshot notice; this work does not refresh data.

A previously supplied private boundary archive contains one Polygon, one ring and 636 corners. It is not proven identical to the user's current Map 362 geometry. The coordinator's read-only check against the exact immutable manifest reproduces the screenshot's 298 candidate tiles: 45,917 candidate rows, 9,510,914 legacy-reserved bytes and 29,203,212 candidate×edge work. The completed private full-row oracle contains 34,587 distinct address rows, 30,938 unique postal codes and 3,649 additional distinct rows sharing postal codes, across 240 matched tiles. Its CSV is 4,931,539 bytes, SHA-256 `9b814fd47545e43b21478b1553728e43b40de8ed1e600b16075c85cd0cc69ec3`; independent Python agrees on the ordered source ordinals. Verified private row packs were obtained through authorised GETs into temporary storage. These are completed input/oracle measurements, not a benchmark of the new endpoint or signed-in Map 362 acceptance.

The deterministic external builder verifies approved CSV SHA/count/preparation time and all output pins when that source is used instead. No live database or owner JWT is needed for a file-backed verified-reader benchmark. Never commit raw geometry, address packs or postal lists; keep inputs and only aggregate/hash results under local temporary/output storage.

For the full oracle, scan verified source rows locally with the existing exact predicate and compare final IDs/ordinals/order/CSV hash with the bounded path. This checks continuation completeness, not an independent replacement geometry algorithm. Record batch count, maximum reads/bytes/consumed/tested candidates/work, retained payload bytes, measured heap/timing and complete-envelope bytes. Synthetic tests must also cover at least 298 tiles, holes/multipart, empty intermediate batches, dense tiles, changed identities, corruption, replay/failure/Retry, cancellation and zero writes. Include a response-byte split where a withheld row is retested but cumulative consumed positions still reach recordCount without a false excess error. No live Map 362 or physical-device acceptance is implied.
