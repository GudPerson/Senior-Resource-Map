# Boundary Library and Guided Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curate personal boundary snapshots, import independent copies, and explicitly create postal audience zones with a chosen Place for every boundary.

**Architecture:** Use a shared closed-boundary serializer and existing annotation persistence, with feature-local React workflows and owner-only Postgres repositories. Isolated bounded postal jobs stage complete membership before an explicit commit; existing eligibility, visibility and generic map creation retain their contracts.

**Tech Stack:** Existing React/Vite, JavaScript ES modules, Hono, Drizzle/Neon Postgres, Node test runner, installed Playwright and existing locked `@electric-sql/pglite` 0.5.8 for ephemeral PostgreSQL tests; no new dependencies or infrastructure.

**Spec:** `docs/superpowers/specs/2026-11-07-boundary-library-guided-zones-design.md` (read with this plan).

## Global Constraints

- Approved workspace: `/Users/sweetbuns/.codex/worktrees/caremap-spatial-tools-20261103/CareAroundSG`; branch `codex/boundary-library-guided-zones-20261107`; baseline `06e76740db1be271c87026ad458c873078357307`. The explicit isolated-worktree approval overrides the older primary-root instruction.
- Local implementation only: no commits, pushes, deployments, remote migrations, credential access, production writes or changes to `.env`. Read the regression ledger and session handoff before product edits.
- Preserve dirty/unrelated work. Review uncommitted working-tree diffs and complete new files; HEAD ranges cannot represent this implementation. Use sequential fresh implementers and fresh task reviewers because interfaces depend on prior tasks.
- Library opt-in starts unchecked; checkbox plus explicit Save is user approval. No reviewer queue. Library ownership is personal; imported copies and frozen snapshots are independent.
- Preserve manual zone creation, sharing approval, ANY Offering matching, visibility, eligibility, ranking, resource memberships, private media and all ledger-locked map surfaces.
- Every batch row requires its own valid Place and name; SAME and DIFFERENT Places are valid. Preserve optional `zoneCode` through normalization, hash, freeze, review and materialization using existing manual uniqueness scope.
- All Place/source authority is checked before any job write and again at commit/finalization. READY has zero new zones/library entries. Explicit commit atomically finalizes each row's complete postal membership, zone and checked snapshot; zero matches produce no empty zone.
- Idempotency, leases, expected revisions, manifest pinning, pause/resume and unknown-ACK reconciliation are durable in existing Postgres. Use Neon HTTP-compatible CTE statements or supported non-callback transactions; do not assume callback transactions.
- Do not raise interactive `.area()` limits (16 tiles, 250,000 geometry work and 32,000 candidate rows). The isolated scanner retains existing per-step tile/row/byte/candidate/geometry/read guards and exact spatial membership math; geometry work is edges × candidates.
- Guided drawing needs a canonical Place location and explicit Saved membership. Preserve an accepted private map on Cancel. No fabricated coordinates or automatic Saved addition.
- Drafts are owner-bound memory above SPA routes; router history holds opaque pointers only. Guard dirty Place edits and account changes; reload may recover server outcomes, never lost unsaved text.
- Use existing annotation IDs, history and `flushPendingChanges()` controller. No parallel writer, silent import truncation, default duplicate offset or automatic mutation retry across API bases.
- Use fictional fixtures and isolated ephemeral database tests only. Normal startup must not apply migrations. Label browser/local evidence distinctly from production proof.

## Review Focus

1. A valid first batch row followed by an unauthorized/stale second row writes nothing; test in Task 3 before-write authorization.
2. A lost ACK followed by account change or replay cannot duplicate a map, import or zone or apply another owner's response; test Tasks 2, 4 and 5.
3. Hidden drawings/control points, unsupported geometry and non-finite coordinates cannot bypass exact all-or-nothing capacity; test Task 1 and latest-document import in Task 4.
4. Optional codes differing only by existing normalization, including an intervening uniqueness race, survive review and fail atomically under existing scope; test Task 3 and Task 5 review.
5. Hard reload, deleted source/map and expired lease preserve accepted outcomes and require explicit recovery without inventing draft text or silently restarting; test Tasks 2, 3 and 5.

---

## File and interface ownership

- Task 1 owns `shared/boundaryDrawing.js`, shared pure geometry extraction and compatibility exports; it defines the immutable drawing format consumed by every later task.
- Task 2 owns the additive `0011_boundary_library_guided_zones.sql` migration and schema metadata for all feature tables, library/starter repositories/controllers/routes and their app mount.
- Task 3 owns postal scanner/jobs repository/controller/routes and their app mount; reuse Task 2 schema rather than adding competing migration numbers.
- Task 4 owns `client/src/lib/api.js` for all methods, the shared picker/curation UI and annotation-copy helper; narrow editor toolbar wiring only.
- Task 5 owns workflow provider, guided controls, batch wizard and narrow App/Place/map page wiring. It consumes Task 4's picker/API; do not clone either.
- Task 6 owns actual-App journeys and evidence docs; product fixes return to the responsible module and focused tests before rerunning frozen checks.

### Task 1: Shared boundary geometry, whitelist and admission

**Files:**
- Create: `shared/boundaryDrawing.js`, `shared/boundaryDrawingGeometry.js`, `client/test/boundaryDrawing.test.js`.
- Modify narrowly: `client/src/lib/printAnnotations.js`, `client/src/lib/mapSpatialGeometry.js`, `client/src/lib/kmlBoundaries.js` only where needed for compatibility exports/reuse.
- Reuse: `shared/addressSnapshotSpatial.js`; existing `client/test/printAnnotations.test.js`, `client/test/mapSpatialGeometry.test.js`.

**Interfaces:**
- `BOUNDARY_DRAWING_SCHEMA_VERSION = 1`; `canonicalizeBoundaryDrawing(raw) -> BoundaryDrawingV1`: ID-less, deeply owned, closed supported area geometry/settings/style/text only. Reject unsupported/malformed shapes with `BoundaryDrawingError` carrying stable `code`.
- `boundaryDrawingToArea(drawing) -> SpatialArea` matches current exact spatial projection. `countBoundaryDrawingStoredPoints(drawing) -> integer` includes stored points and controlPoints.
- `assertBoundaryDrawingBatchCapacity(existingCanonicalAnnotations, drawings) -> void`: full hidden-inclusive canonical document, 200 annotation/20,000 point totals and current per-geometry limits; typed failure before mutation, never normalization/truncation as admission.
- `BoundaryDrawingV1` retains the existing canonical closed-area field representation plus `schemaVersion:1`; whitelist the supported circle/rectangle/polygon/multipart/hole and rotation/rounding settings. No IDs, media, resource attachments, privileges or viewport fields.
- Extract existing pure shape math behind unchanged client exports; server imports shared modules without DOM/Leaflet. No new approximation for circles, rotation, rounding, holes or multipart union.

- [ ] **Step 1: Write behavior tests** for canonical round trips of circle, rotated/rounded box, polygon, multipart and holes; assert exact projected coordinates, style/name/text, deep ownership and excluded links/media/sharing. Assert malformed/non-finite/open/unsupported geometry fails explicitly.
- [ ] **Step 2: Establish RED.** Run `node --test client/test/boundaryDrawing.test.js`; expected failure is missing new exports or rejected expected behavior, not a harness error.
- [ ] **Step 3: Implement serializer and projection** in the shared files, moving only necessary pure math and retaining compatibility exports; use existing spatial validation/membership semantics.
- [ ] **Step 4: Add admission cases** for 199+1 allowed, 200+1 rejected, exactly 20,000 allowed and 20,001 rejected, hidden existing annotations, controlPoints and per-geometry overflow. Assert inputs unchanged after rejection.
- [ ] **Step 5: Establish GREEN.** Run `node --test client/test/boundaryDrawing.test.js client/test/printAnnotations.test.js client/test/mapSpatialGeometry.test.js`; all pass with unchanged legacy assertions.
- [ ] **Step 6: Task review** inspects shared interfaces, compatibility callers and uncommitted complete new files; resolve findings before Task 2.

### Task 2: Owner-only library and idempotent guided map starter

**Files:**
- Create: `server/drizzle/0011_boundary_library_guided_zones.sql`, `server/src/utils/boundaryLibraryRepository.js`, `server/src/utils/boundaryWorkflowRepository.js`.
- Create: `server/src/controllers/boundaryLibraryController.js`, `server/src/controllers/boundaryWorkflowController.js`, `server/src/routes/boundaryLibrary.js`, `server/src/routes/boundaryWorkflows.js`.
- Create: `server/test/boundaryLibrary.test.js`, `server/test/boundaryWorkflows.test.js`, `server/test/boundaryWorkflowMigration.test.js`.
- Create: `server/test/helpers/boundaryPostgres.js`, a fresh in-memory PGlite schema/parameterized-SQL harness using the existing dependency; Task 3 reuses it, with no environment or external database access.
- Modify: `server/src/db/schema.js`, `server/drizzle/migration-manifest.json`, `server/drizzle/meta/_journal.json` and required matching migration snapshot, `server/src/app.js` (mounts only).
- Reuse existing map annotation saved-revision, favorites/save, map/asset creation and `server/src/utils/audienceZones.js` authority primitives; do not alter generic map POST behavior.

**Interfaces:**
- Library endpoints: GET/POST `/boundary-library`, GET/DELETE `/boundary-library/:id`; POST `{requestId,name,groupName?,source:{mapId,annotationId,revision}}` returns `{item,replayed}`. GET list accepts cursor/limit (default 50), search/name/group filters and returns `{items,nextCursor}`; detail and summary fields are exactly the spec's.
- Starter: POST `/boundary-zone-workflows/map` `{requestId,hardAssetId}` and GET `/boundary-zone-workflows/map/:requestId` return `{requestId,mapId,hardAssetId,name,state:'ready',outcomeHash}`. Owner/request identity plus normalized payload hash defines replay; conflict 409.
- Stable errors: `BOUNDARY_ZONE_PLACE_NOT_SAVED`, `BOUNDARY_ZONE_PLACE_LOCATION_REQUIRED`, `BOUNDARY_REQUEST_CONFLICT`, `BOUNDARY_SOURCE_STALE`, `BOUNDARY_SOURCE_UNSUPPORTED`; use existing HTTP authentication/error envelope, 404 for inaccessible owner records.
- Deleted starter maps retain request tombstones and GET returns actionable 404 with code `BOUNDARY_ZONE_MAP_UNAVAILABLE`; replay must never create a replacement. Explicit restart requires a new deliberate action/request ID.
- Task 2 migration defines personal snapshots, starter claims/outcomes/tombstones, jobs, rows, commit identities and staged postal membership with owner/request and job/row/postal unique keys, revisions/cursors/leases, pinned manifest/hash and optional `zoneCode`.
- Snapshot row stores immutable drawing/area/hash, provenance and metadata; retirement does not erase replay identity or mutate copies. Task 3 consumes job tables without a second migration.

- [ ] **Step 1: Write failing repository/HTTP tests** for exact saved revision, owner isolation, immutable detail, metadata filtering/pagination, retire/repeat-retire, stale/unsupported source and payload-conflicting replay. Use real domain execution with an isolated repository adapter, not source-text assertions.
- [ ] **Step 2: Establish RED.** Run `node --test server/test/boundaryLibrary.test.js server/test/boundaryWorkflows.test.js server/test/boundaryWorkflowMigration.test.js`; new behavior fails before implementation.
- [ ] **Step 3: Implement local migration and library routes** using Task 1 serialization. Owner plus normalized name/group/source payload is hashed; exact replay returns the existing item even after retirement/source deletion. Do not auto-run schema at startup.
- [ ] **Step 4: Implement starter atomic claim/map/one-asset outcome** with existing authority, Saved and canonical-location validation before writes. Hash/unique claim replay handles concurrent clicks/lost ACK; no unrelated Saved assets are copied.
- [ ] **Step 5: Add starter tests** for same-key concurrent application requests, same-key/different-Place 409, zero writes when not Saved/missing location/unauthorized, explicit favorite save then same-key replay, deleted-map tombstone and cross-owner key isolation. Execute real migration/parameterized CTE rollback and uniqueness semantics in fresh PGlite; distinguish this PostgreSQL/WASM proof from live Neon concurrency/performance.
- [ ] **Step 6: Establish GREEN and review.** Repeat Step 2; run `npm run verify:migrations --workspace=server`. Review additive schema/SQL and complete new files, including Neon HTTP compatibility and secret-free fixtures; no commit or remote apply.

### Task 3: Bounded postal preparation, review and explicit atomic creation

**Files:**
- Create: `server/src/utils/boundaryPostalScanner.js`, `server/src/utils/boundaryZoneJobRepository.js`, `server/src/controllers/boundaryZoneJobsController.js`, `server/src/routes/boundaryZoneJobs.js`.
- Create: `server/test/boundaryPostalScanner.test.js`, `server/test/boundaryZoneJobs.test.js`, `server/test/boundaryZoneAtomicity.test.js`.
- Modify narrowly: `server/src/app.js`; `server/src/utils/addressSnapshotRepository.js` and `server/src/controllers/audienceZonesController.js` only for reusable existing validation/normalization seams.
- Reuse: `shared/addressSnapshotSpatial.js`, Task 1 serializer, Task 2 schema, `server/src/utils/notificationRepository.js` lease pattern and existing audience-zone authority/postal helpers.

**Interfaces:**
- POST `/boundary-zone-jobs` `{requestId,rows:[{rowKey,name,zoneCode?,hardAssetId,source,saveToLibrary,libraryName?,libraryGroupName?}]}`; source is `{libraryId,revision}` or `{mapId,annotationId,revision}`. Return 202 `BoundaryZoneJobDTO`.
- `BoundaryZoneJobDTO`: `{id,revision,state,snapshotSha256,manifestSha256,rows}`; row `{rowKey,name,zoneCode,hardAssetId,status,postalCount,zoneId,libraryId,errorCode}`. `zoneId/libraryId` are null before materialization. States preparing/ready/committing/complete/paused/cancelled/failed; rows pending/preparing/ready/empty/created/failed.
- GET item/list `/boundary-zone-jobs[/:id]` is owner-only; list `{items,nextCursor}` contains metadata/counts only. POST `/:id/advance|pause|resume|cancel` accepts `{expectedRevision}`; POST `/:id/commit` accepts `{requestId,expectedRevision}`; return reconciled DTO.
- `scanBoundaryPostalStep({area,manifestIdentity,cursor,budget,signal}) -> {cursor,done,postalCodes,diagnostics}`: deterministic bounded slice, exact shared containment, pinned manifest, no interactive provider limit changes.
- Freeze normalized row data including `zoneCode`, source drawing/area/hash and manifest before preparation. Commit hash binds ready revision/snapshots and rows including codes; stale versions or conflicting identities fail 409.
- Extract/reuse existing manual name/code validation and global uniqueness scope without case-folding or changing manual behavior. Prevalidate all rows and duplicate normalized codes before writes; database uniqueness races fail that row atomically.

- [ ] **Step 1: Write failing scanner/job tests** for cross-tile boundary/hole/multipart membership, duplicate postals, row-slice resume, byte/read/candidate budgets, manifest drift, expired leases and expected-revision conflict. Assert interactive 16-tile/250,000-geometry-work/32,000-candidate-row guards retain existing behavior.
- [ ] **Step 2: Establish RED.** Run `node --test server/test/boundaryPostalScanner.test.js server/test/boundaryZoneJobs.test.js server/test/boundaryZoneAtomicity.test.js`; capture missing behavior.
- [ ] **Step 3: Implement isolated scanner** by reusing existing manifest parsing, tile validation/read guards and shared exact geometry; extract common pure helpers instead of copying validators. Persist deterministic tile/row cursor and stage unique postals under a bounded revision/lease claim.
- [ ] **Step 4: Implement freeze/preparation lifecycle** with all-row authorization and source checks before writes, owner-only recovery list, pause/resume/cancel and client-driven one-step continuations. Preparing/READY/empty produce no zones or library snapshots.
- [ ] **Step 5: Add materialization RED cases**: ready remains zero writes; explicit commit creates full membership plus checked snapshot atomically; unchecked/library-source rows create no extra snapshot; zero count creates no zone. Test last-row unauthorized before initial write, revocation before commit/finalize, normalized-code duplicate/race, optional-code hash conflict, lost ACK and retry without duplicate success rows.
- [ ] **Step 6: Implement explicit commit and row finalization** using supported atomic SQL statements/transactions and staged membership. Recheck all Place authority before commit, and assigned Place at finalize; retain successful results on later failure/cancel. Resume retries only outstanding idempotent work, never successful zones.
- [ ] **Step 7: Establish GREEN and review.** Repeat Step 2 against Task 2's fresh PGlite harness; prove actual SQL rollback, duplicate claims and complete membership publication instead of mocked transaction calls. Live Neon concurrency/performance remains unverified. Review no-partial-membership visibility, no empty zones, exact code preservation and no changes to eligibility/sharing/manual creation.

### Task 4: Personal library picker, explicit curation and independent map import

**Files:**
- Create: `client/src/components/boundaries/BoundaryLibraryPicker.jsx`, `client/src/components/boundaries/BoundaryLibrarySaveDialog.jsx`, `client/src/lib/boundaryLibraryImport.js`, `client/src/lib/boundaryLibrarySelection.js`.
- Create: `client/test/boundaryLibraryImport.test.js`, `client/test/boundaryLibraryPicker.test.js`.
- Modify narrowly: `client/src/lib/api.js`, `client/src/hooks/useInteractiveMapAnnotationEditor.jsx`, `client/src/components/PrintAnnotationToolbar.jsx`, `client/src/pages/MyMapDetailPage.jsx`.
- Reuse unchanged persistence/history in `client/src/hooks/usePrintAnnotations.js`; optional toolbar controls default absent on Print.

**Interfaces:**
- API exports: `listBoundaryLibrary(params)`, `getBoundaryLibrary(id)`, `createBoundaryLibrary(payload)`, `retireBoundaryLibrary(id)`, `startBoundaryZoneMap(payload)`, `getBoundaryZoneMap(requestId)`, `createBoundaryZoneJob(payload)`, `listBoundaryZoneJobs(params)`, `getBoundaryZoneJob(id)`, `advanceBoundaryZoneJob(id,payload)`, `commitBoundaryZoneJob(id,payload)`, `pauseBoundaryZoneJob(id,payload)`, `resumeBoundaryZoneJob(id,payload)`, `cancelBoundaryZoneJob(id,payload)`. DTOs/errors follow Tasks 2/3; retain existing credentials/error/retry transport.
- `appendBoundaryDrawingCopies(existingCanonicalAnnotations,drawings) -> nextAnnotations`: Task 1 admission, existing fresh annotation IDs, `isShared:false`, exact original coordinates, no attachments. Append one complete batch and preserve all existing entries.
- `BoundaryLibraryPicker({selectedIds,onSelectionChange,onConfirm,onDraw,onCancel})`: shared Zones/map picker; controlled selection survives filters/pagination, preview uses frozen detail, confirm supplies selected full snapshots in stable order.
- Production picker consumes pure ES-module `updateBoundaryLibrarySelection(selectedIds,visibleIds,action) -> selectedIds` (`action` is select-all-visible, clear-visible or `{toggleId}`) and `resolveSelectedBoundarySnapshots(selectedIds,detailsById) -> snapshots`; missing/invalid details reject the complete selection. Node tests import these helpers, not untransformed JSX; Task 6 proves the mounted picker.
- Save dialog accepts saved source revision and stable request identity; explicit submit only. One import-confirm identity appends once; save retry persists the same IDs rather than appending again.

- [ ] **Step 1: Write failing import/picker-state tests** against the production-consumed pure selection helpers for single/multiple/all selection across filters, retained hidden selections, stable detail ordering and invalid/missing detail failure with zero partial append. Assert independent copies, exact coordinates, fresh IDs and one Undo operation; empty Draw and rendered preview are actual-App assertions in Task 6.
- [ ] **Step 2: Establish RED.** Run `node --test client/test/boundaryLibraryImport.test.js client/test/boundaryLibraryPicker.test.js`; tests fail on absent behavior.
- [ ] **Step 3: Implement API methods and shared picker/save dialog** with personal metadata/search/group filtering, accessible error/empty/loading states and stable owner-scoped request identities. Stale owner/route responses cannot change current selection/state.
- [ ] **Step 4: Implement import and narrow toolbar wiring** through existing `importControls` and annotation controller; fetch all details, validate and recheck latest full canonical document immediately before one history append. Existing map/Print and KML behavior remain intact.
- [ ] **Step 5: Add concurrency/ACK tests**: hidden/control-point capacity changed while picker is open, failure before append leaves all untouched, uncertain save retries same IDs, later deliberate import creates new IDs, save-as-new flush failure blocks POST, acknowledged revision is used, account change discards old response.
- [ ] **Step 6: Establish GREEN and review.** Repeat Step 2 and Task 1 focused tests. Review exact shared picker/API interfaces for Task 5 and uncommitted existing-file wiring; record UI assertions requiring actual-App browser proof in Task 6.

### Task 5: Owner-bound guided return and per-Place batch wizard

**Files:**
- Create: `client/src/components/boundaries/BoundaryZoneWorkflowProvider.jsx`, `client/src/components/boundaries/BoundaryZoneBatchWizard.jsx`, `client/src/components/boundaries/GuidedBoundaryControls.jsx`, `client/src/lib/boundaryZoneWorkflow.js`.
- Create: `client/test/boundaryZoneWorkflow.test.js`, `client/test/boundaryZoneBatch.test.js`.
- Modify narrowly: `client/src/App.jsx`, `client/src/components/AssetAudienceZonesPanel.jsx`, `client/src/components/AssetForm.jsx`, `client/src/pages/dashboard/ResourcesPage.jsx`, `client/src/pages/MyMapDetailPage.jsx`.
- Reuse Task 4 picker/API and existing saved/authorized Place options, resource dirty-state/readiness and map annotation controller; generic `MyDirectoryPage.handleCreateMap` remains unchanged.

**Interfaces:**
- `BoundaryZoneWorkflowProvider({ownerId,children})` above authenticated route switch; `useBoundaryZoneWorkflow()` exposes `{draft,startDraw,acceptSavedBoundary,cancel,clear}`. Draft `{workflowId,requestId,ownerId,hardAssetId,name,zoneCode,sourceChoice,saveToLibrary,source,jobId}` stays in memory; opt-in defaults false.
- `startDraw(draft)` preserves request identity on unknown ACK; `acceptSavedBoundary({mapId,annotationId,revision})` requires acknowledged flush and current owner/workflow. History contains only `{boundaryWorkflowId,boundaryRequestId,boundaryJobId}` opaque pointers.
- `BoundaryZoneBatchWizard({initialRows,placeOptions,onClose,onComplete})` rows `{rowKey,name,zoneCode,hardAssetId,source,saveToLibrary,libraryName,libraryGroupName}`; required Place per row, standalone unassigned and Place-context editable prefill. Produces Task 3 frozen payload unchanged through review.
- `GuidedBoundaryControls({workflow,onUseBoundary,onCancel})` composes current editor guards. Return uses `flushPendingChanges() === true` then acknowledged saved annotation/revision; neither `closeEditor()` nor nullable `saveNow()` proves Saved.
- Existing authoritative Place candidate source used by the resource editor supplies options; frontend options are convenience, server is authoritative. Reopen only saved authorized Place and Zones step for an explicit workflow return.

- [ ] **Step 1: Write failing state/batch tests** for draft retention across route switch, unchecked opt-in, dirty Place readiness guard, required row-specific Place/name, SAME/DIFFERENT assignment, selection/filter/Back persistence and exact optional-code review/hash payload preservation.
- [ ] **Step 2: Establish RED.** Run `node --test client/test/boundaryZoneWorkflow.test.js client/test/boundaryZoneBatch.test.js`; capture missing behavior.
- [ ] **Step 3: Implement provider and guided starter/return** with account/workflow capture before awaits, saved-clean resource guard and opaque history pointers. Show explicit “Save Place and draw” using existing idempotent favorite-save then the same starter request; missing location directs to existing editor without a map write.
- [ ] **Step 4: Implement guided canvas controls and restoration** with canonical centre/one Place pin/name, short click guidance, selected completed area and flush gate. All new form-contained workflow buttons are `type="button"`; retain unfinished drawing guard and ordinary map navigation.
- [ ] **Step 5: Implement batch preparation/review/create** using shared picker, row assignment and server DTO counts. One continuation in flight per owner/job; READY shows Boundary → Place → Zone and explicit “Create N audience zones.” Show empty/failed/created distinctly, optional codes visibly, no automatic Offering selection.
- [ ] **Step 6: Add recovery tests** for failed/stale annotation save, unknown starter ACK, owner switch during each async phase, lost unsaved text on reload, deleted map and explicit restart, recent-job list resume after pointer loss, expired lease reconciliation, pause/cancel after partial creation and duplicate commit ACK. No silent new request IDs or successful-row replay.
- [ ] **Step 7: Implement recovery/cancel presentation** using durable GET before explicit Resume; retain accepted map and report created outcomes. Copy when none created: “Your Care Map is kept. No audience zone or library snapshot was created.” Clear usable draft immediately on logout; never persist unsaved resource/postal text.
- [ ] **Step 8: Establish GREEN and review.** Repeat Step 2 plus Task 4 focused tests. Review actual route/provider/form boundaries and all code/name preservation before integration journeys.

### Task 6: Actual-App integration and frozen regression evidence

**Files:**
- Create: `client/test/boundaryWorkflowIntegration.test.js`, `server/test/boundaryZoneJourney.test.js`, `scripts/boundary-library-guided-zones.browser.mjs`.
- Modify documentation only after evidence: `docs/regression-ledger.md`, `docs/session-handoff.md`.
- Review integrated changes in all prior task files; do not broaden implementation or change release/deploy configuration.

**Interfaces:**
- Browser runner uses installed Playwright against the actual mounted App with fictional authenticated fixtures/local server; it must traverse real route/form/editor/provider components. Network fixtures may isolate external data, but reducer-only checks are not browser journey proof.
- Server journey drives real mounted endpoints with isolated storage and pinned fictional address data: prepare → READY → explicit commit → atomic result → retry/resume. No existing user database or credentials.
- Evidence records exact command, baseline/worktree diff, fixture scope, outcome and limitations. Browser screenshots/results are local evidence; no production/release-ready claims.

- [ ] **Step 1: Add integration tests** for mounted owner-only endpoints, manual postal creation unaffected, existing shared-zone approval/ANY matching, library import independence and two boundary rows assigned to different Places (then same Place); optional codes remain on created zones.
- [ ] **Step 2: Establish integration RED/GREEN.** Run `node --test client/test/boundaryWorkflowIntegration.test.js server/test/boundaryZoneJourney.test.js`; demonstrate a meaningful assertion fails when its integrated wiring is absent, then passes after narrow owner-task corrections.
- [ ] **Step 3: Execute actual-App journeys** with `node scripts/boundary-library-guided-zones.browser.mjs`: saved Place → private named map/one pin → draw/flush → restored zone/name → READY → explicit create; not-Saved explicit save/replay; missing location; dirty Place guard; failed flush; Cancel retains map; owner/reload/deleted-map recovery.
- [ ] **Step 4: Execute reuse/batch journeys** with the same runner: Zones and Draw & measure shared picker, empty library/map Draw, single/several/all/filter selection, per-row Place/name/code, Back/Next, review/empty/partial results, no Offering selection; original-position copy/one Undo, source independence and uncertain-save retry without duplicate append.
- [ ] **Step 5: Verify ledger-locked interactions** in actual App: classic/canvas same-map Return, original/expanded and empty-map admission, gestures/rotation/camera, hidden-view projection, editor close, annotation recovery/no-op autosave, map memberships, shared/embed/Print/export and legacy resource create/edit/import. Record skipped/unavailable checks honestly.
- [ ] **Step 6: Freeze working tree for required checks.** Run `npm run build:client`, `npm run test:server`, `npm run verify:quality`, `npm run verify:map-lockdown` after edits stop; all must pass, or explicitly report a blocker. Do not bypass guards or re-label failed checks using a narrower retry.
- [ ] **Step 7: Update evidence docs and final review** with known-good local reference, reproduction, acceptance, results/limitations and local-only next step; run `git diff --check`. Review full new files and complete uncommitted diff for secret-free scope and spec coverage; no commits/push/deploy.

## Plan self-review

- Shared API names match every consumer; API transport is Task 4-only, schema is Task 2-only, app mounts are sequential Tasks 2/3, provider/page wiring is Task 5-only.
- Spec coverage maps snapshots/import to Tasks 1/2/4, starter/return to Tasks 2/5, staging/code/commit to Tasks 2/3/5 and regression/browser proof to Task 6.
- Each Review Focus input has named behavior tests above; no task treats a source-text grep, mocked transaction call or prototype count as behavioral/atomicity evidence.
- Execution is already authorized. Continue task-by-task locally with fresh reviews; no further product or execution-method approval is required.
