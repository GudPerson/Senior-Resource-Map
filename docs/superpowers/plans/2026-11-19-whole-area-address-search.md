# Whole-area Address Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The existing Addresses/postal codes controls and full CSV work across the whole selected boundary without raising per-request safeguards.

**Architecture:** Add a separate authenticated read-only full-row scan endpoint and client scan controller/hook. Automatic fallback occurs only on a typed legacy workload rejection. Complete results remain unavailable until a pinned continuation chain finishes.

**Tech Stack:** Existing JavaScript, React, Hono, verified private R2 reader, Node tests and Playwright. No new dependency, database/schema, auth policy or signing secret.

**Spec:** `docs/superpowers/specs/2026-11-19-whole-area-address-search-design.md`.

## Global Constraints

- Active managed worktree: `/Users/sweetbuns/.codex/worktrees/within-area-catalogue-timeout-20261119/CareAroundSG`; branch `codex/whole-area-address-search-20261119`, exact base `69f52db368241022580ae8a931d1e46227247025`.
- Preserve existing dirty release documents and output. Coordinator/client contract review is complete and product implementation is authorised for the fresh worker; no commit, push, deployment, live database query or credential/environment copying is authorised.
- Review owned-file uncommitted diffs and content hashes against base `69f52db368241022580ae8a931d1e46227247025`; never create commits merely to satisfy an SDD workflow or review-package script.
- Keep legacy nearby/area limits, resource catalogue, Boundary scanners/jobs, geometry, Saved/map writes and snapshot publication unchanged.
- New step: 16 tiles, 33 reads, 4 MiB, four concurrent reads, 250,000 geometry work, at most 512 tested candidates, 2 MiB entire serialized response with 32 KiB envelope reserve; respect lower configured limits.
- Counters: `rows.length <= consumedCandidates <= candidates <= batchCandidateLimit`. Candidates/work include a withheld matching row's test; consumed positions do not. Client recordCount guard sums consumedCandidates only.
- Progress: tilesCompleted is nondecreasing; nonterminal cursor strictly advances lexicographically, nextCursor.tile equals tilesCompleted and completion requires tilesCompleted equals tilesTotal.
- Client: validate pinned recordCount only on the new path; recordCount unique rows/consumed positions, 64 MiB incrementally counted UTF-8 unique-row payload and at most `min(8192,max(1,recordCount))` successful batches. Payload bound is not a heap guarantee. No partial selectable results/exact total/CSV or full-array cloning to remove ordinal.
- Before later product edits, reuse this checkout's Graft and trace callers of `createAddressSnapshotReader`, `createAddressSnapshotHandlers` and `findSnapshotAddressesWithinArea`; do not use another checkout's index.

## Review Focus

- A budget boundary inside a dense tile must retain the next unprocessed row, including an address that cannot fit the current response.
- Empty intermediate batches and distant multipart pieces must not become a false no-address or early-complete result.
- A failed first request and a lost later response must retain the original pin and last accepted cursor on Retry.
- Same-postal distinct rows survive; conflicting ID/ordinal duplicates cannot produce a misleading complete CSV.
- Close or area/user change must stop future requests and suppress a deliberately late successful response even when transport abort is ignored.

## Task 1: Freeze baseline and acceptance inputs

**Files:** Existing config, reader, geometry and test fixtures only; private benchmark inputs stay outside Git.

- [x] Confirm branch/common-dir/state and preserve release-document hashes before edits.
- [x] Record focused baseline: `node --test server/test/addressSnapshotRepository.test.js server/test/addressSnapshotProviderRoutes.test.js server/test/addressSnapshotDiagnostics.test.js server/test/boundaryPostalScanner.test.js client/test/addressSnapshotClient.test.js client/test/addressSnapshotAuth.test.js` — 34/34 pass using existing dependencies, log `/private/tmp/whole-area-address-baseline-20261119.log`.
- [x] Freeze coordinator's exact private oracle: 636-corner archive; 298 candidate tiles / 45,917 candidates / 9,510,914 legacy-reserved bytes / 29,203,212 geometry work; 34,587 address rows / 30,938 unique postals / 3,649 same-postal additional distinct rows / 240 matched tiles. CSV: 4,931,539 bytes, SHA-256 `9b814fd47545e43b21478b1553728e43b40de8ed1e600b16075c85cd0cc69ec3`; independent Python matches ordered ordinals. Private inputs remain temporary; this is not a current Map 362 identity claim.

Task 1 baseline/input stage is complete. Synthetic implementation fixtures belong to Tasks 2 and 4, not unfinished preparation.

## Task 2: Bounded server contract, RED → GREEN

**Create:** `shared/addressSnapshotScanContract.js`, `server/src/utils/addressSnapshotScanRepository.js`, `server/test/addressSnapshotScan.test.js`.
**Modify:** `server/src/controllers/addressSnapshotController.js`, `server/src/routes/addressSnapshot.js`, exact streamed path in `server/src/app.js`; focused route fixture if needed.

**Interfaces:** Export `createAddressSnapshotScanRepository(bucket, {config})` with `scan(input, {signal})`; publish the exact request/cursor/response types from the spec. Shared contract exports strict response/cursor validation and the feature caps, with no storage or network side effects.

- [x] Build synthetic >=298-tile/complex/dense fixtures and write failing real-repository/route tests: `legacy298TileQueryRejectsButScanCompletesExactOracle`, `denseTileResumesWithoutSkippingNextRow`, `multipartHoleAndEmptyBatchesStayExact`, `everyBudgetIsCumulativeAcrossTiles`, `firstTileCannotFitFailsRatherThanLoops`, `responseByteBoundaryPreservesNextRowAndCountsConsumedSeparately`, `wholeSerializedEnvelopeFitsTwoMiBWithoutDroppingConsumedRows`. Do not copy private geometry/address payloads into fixtures.
- [x] Assert dense slices retain tilesCompleted while row cursor advances, cursor.tile equals tilesCompleted and final completion reaches tilesTotal. Test the largest permitted metadata/envelope strings against the 32 KiB reserve and exact final response cap.
- [x] Add failing auth/no-store/body-limit, strict cursor/hash/ETag/position, corruption, duplicate-integrity and signal tests; assert no database/job factory or mutating bucket operation is called.
- [x] Run `node --test server/test/addressSnapshotScan.test.js`; retain meaningful RED behavior, not only a missing-import error.
- [x] Implement the isolated scanner using existing reader/predicates. Reserve before reads, settle started work, return full rows+ordinal and strict next progress. Do not change old `planQuery`, Boundary scanner/jobs or dataset config.
- [x] Add an independent scan repository factory/handler to the existing address controller; register `/area/scan` and only that additional streamed-body path. Reuse existing safe address errors and middleware.
- [x] Run new tests plus the Task 1 baseline. Expect PASS; old >16-tile ordinary-area queries must still reject unchanged.

## Task 3: Client adapter and scan state, RED → GREEN

**Create:** `client/src/lib/wholeAreaAddressScan.js`, `client/src/hooks/useWholeAreaAddressScan.js`, `client/test/wholeAreaAddressScan.test.js`.
**Modify:** `client/src/lib/addressSnapshotClient.js`, `client/test/addressSnapshotClient.test.js`.

**Interfaces:** Export `scanAddressAreaBatch({area,snapshotSha256,cursor=null,signal})`. Pure `createWholeAreaAddressScan({getMetadata,scanBatch})` owns pin/accumulator/confirmed cursor/generation and exposes `start(area): Promise<void>`, `resume(): Promise<void>`, `reset()`, `subscribe(listener): unsubscribe` and `getSnapshot()`. Start/resume catch operational failures into state, not unhandled rejections. Stable snapshots contain `{status:'idle'|'scanning'|'ready'|'error'|'changed',progress,completedRows,total,error}`; rows/total are null until ready. `useWholeAreaAddressScan({area,scopeKey})` adapts this to React, exposes those fields plus start/resume/reset, and resets on area/scope changes or unmount; pending rows stay internal.

- [x] Write failing controller tests for unsorted three-batch completion, empty nonfinal batch, same-postal distinct IDs, identical replay versus conflicting ID/ordinal duplicates, row/byte/step guards and strict identity/progress/counter relationships. Assert completedRows/exact total remain unavailable until done.
- [x] Add `byteSplitRetestReachesRecordCountWithoutFalseExcess`: a withheld row is tested twice across responses but consumed once; sum consumedCandidates rather than candidates. Validate positive safe metadata recordCount on scan start without tightening old query tests. Count UTF-8 unique-row bytes incrementally including commas/brackets; do not stringify the entire array per batch.
- [x] Add explicit failed-first/lost-later-response Retry tests: same pin and exact last confirmed cursor; malformed DTO must not advance. Test snapshot 409 requires reset/restart, and an abort-ignoring late success cannot publish or enqueue a next step after reset.
- [x] Run `node --test client/test/wholeAreaAddressScan.test.js client/test/addressSnapshotClient.test.js`; retain RED.
- [x] Implement the separate adapter, single-flight sequential controller and thin lifecycle hook. Validate a complete batch before atomically updating state; sort ready rows by ordinal. Keep legacy `query()` unchanged.
- [x] Rerun the focused tests and existing client/auth baseline; expect PASS without writes or automatic retry loops.

## Task 4: Existing panel controls and browser acceptance, RED → GREEN

**Modify:** `client/src/components/MapAreaResultsPanel.jsx`, four-locale strings in `client/src/lib/mapSpatialMessages.js`, `tests/browser/care-map-area-resources.mjs`, its fixture or a narrow production-provider fixture.

**Consumes:** Task 3 hook/adapter and Task 2 response contract. Retain the ordinary-area path and all resource/Saved/map behavior.

- [x] Add failing actual mounted cases: typed workload422 triggers automatic scanning; arbitrary error does not; >=298-section progress hides rows/total/export until complete; source-order table initially shows200 and Load more reveals local200; no extra scan on local paging.
- [x] Assert complete CSV row count/hash equals every oracle row, leading zeros and repeated-postal distinct addresses are retained, selected CSV/Copy contain only selected loaded rows and the existing fixed-column serializer omits ordinal without a second full-row clone.
- [x] Add network Retry from confirmed cursor, explicit changed-snapshot restart, progress through an empty batch, close/area/user cancellation with late delivery, preserved exact holes/multipart geometry and zero application writes. Keep all resource cases intact.
- [x] Run selected new cases to demonstrate RED, then integrate only the typed fallback, progress, Retry/restart, completed local paging and completed CSV branch. Translate new messages in all four locales.
- [x] Run the full area browser cohort once green and retain source/harness fingerprints. No real owner session or private map is needed.

## Task 5: Whole-branch review and evidence

- [x] Run `npm run test:server`, `npm run test:client`, `npm run build:client` and the complete relevant area/spatial/browser suites. Use `npm run verify:quality` before any later release; use map-lockdown checks if integration reaches a locked map/presentation contract. Do not claim unavailable smoke/device checks.
- [x] Run the authorised private row-pack benchmark against the completed Task 1 oracle: compare IDs/ordinals/order and the exact 4,931,539-byte CSV hash; record all step maxima, tested versus consumed counts, total batches, whole-envelope/payload bytes, heap and timing. Prove the guards admit the whole supplied artifact. Do not invent signed-in Map 362 or future-dataset guarantees.
- [x] Review caller blast radius, strict cursor/state boundaries and no-write behavior. Run `git diff --check`; verify nearby/legacy-area, Boundary jobs, dataset config, auth policy and unrelated dirty files remain intact.
- [x] Update the ledger with local behavior/evidence/limits, preserve failed attempts and stop for coordinator review. Use owned-file uncommitted diff/hash evidence against the base; no commits, pushes or deployment are authorised for this implementation run.

## Preparation result

The branch/common-dir check passed; branch base is exact main and both dirty release documents retained identical SHA-256 values across the switch. Focused baseline is 34/34 with no installs. No product/test source has been changed. No new Graft calls were needed for preparation: the active-checkout graph/caller evidence from the preceding investigation was reused (zero additional token savings this preparation turn).

## Completion

Local implementation and reviews are complete. Final quality aggregate components passed individually; no aggregate command or live acceptance is claimed. Whole-branch and scoped final re-review approve the candidate, with the hard-step-cap Retry note explicitly deferred under R12. Keep the worktree and ignored review workspace: the implementation is uncommitted, and the user has not requested this feature’s deployment.
