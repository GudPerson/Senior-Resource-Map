# Boundary Library, guided zone drawing and per-boundary Place assignment

Date: 7 November 2026. Status: integrated design for local implementation; product edits await the orchestrator's builder handoff. The user approved the clickable prototype and explicitly requested implementation. This document does not authorize a commit, push, deployment, remote migration, credential access or production-data operation.

## Outcome and approved product decisions

People can draw a boundary while editing an audience zone, deliberately keep a personal snapshot, reuse that snapshot in another Care Map, and create a batch of zones with a separately chosen Place for every boundary. Different Places and repeated use of the same Place are both valid.

The approved prototype is [v4](/Users/sweetbuns/.codex/visualizations/2026/10/23/01a16770-9bad-7d80-8a28-111ecb10f61b/boundary-to-audience-zone-20261107/.superpowers/brainstorm/20385-1794061315/content/boundary-library-place-assignment-v4.html), SHA-256 `65c212fe0610c8d6fe190bb83ab4e1d89ae3d582dd00700902d4ca293d2c61a0`. Its synthetic shapes, coordinates, counts, in-memory IDs and example Places are UX illustrations, not an implementation model or geographic source.

The selected model is a **curated personal library of immutable snapshots**, with independent imports. Automatically cataloguing all map drawings and live-linked library entries were considered and rejected by the approved flow. Checking **Save to Boundary Library** is the user's approval; there is no new reviewer, approval queue or library sharing status. Checking alone performs no write. A snapshot is added only by the associated explicit boundary/zone save.

Audience zones remain postal-code based. Creating one does not change Place visibility, Offering restrictions, Host & coverage, eligibility, ranking or the existing shared-zone approval process. If an Offering later selects several audience zones, existing ANY matching and all other visibility rules still apply. An Offering editor is outside this change.

## Source baseline and stable seams

Work only in `/Users/sweetbuns/.codex/worktrees/caremap-spatial-tools-20261103/CareAroundSG`, local branch `codex/boundary-library-guided-zones-20261107`, starting at clean `06e76740db1be271c87026ad458c873078357307`. The earlier evidence branch is preserved; the dirty primary checkout is not an implementation workspace. No remote refresh was needed for this preflight.

| Existing seam | Current contract and intended narrow integration |
| --- | --- |
| `client/src/components/AssetAudienceZonesPanel.jsx` | Local postal-entry draft submits `createAudienceZone`; keep that path and add the boundary source/batch workflow alongside it. Existing saved-Place requirement remains. |
| `client/src/components/AssetForm.jsx`, `renderPlaceZonesStep` | Mounts the zone panel inside the resource form. New workflow buttons use `type="button"`; they cannot submit or replace the outer resource form. Restore the Zones step only for the explicit workflow return. |
| `client/src/pages/dashboard/ResourcesPage.jsx` | Owns inline and modal Place editors. Reopen the authorized saved Place on return without changing ordinary create/edit/import flows. |
| `client/src/App.jsx`, `AppShell` | Routes unmount the resource editor when moving to My Map. A small authenticated, owner-scoped workflow provider above the route switch retains the zone draft across that navigation. |
| `client/src/pages/MyDirectoryPage.jsx`, `handleCreateMap` | Existing generic map creation posts `{name, assets}` and navigates to the new map. Keep it unchanged; guided drawing gets an isolated idempotent starter. |
| `client/src/pages/MyMapDetailPage.jsx` | Owns canonical annotations, map/user context, editor activation and the editing canvas. Add an optional guided-workflow hook/controls; keep the ordinary page, map identity and presentation paths. |
| `client/src/hooks/useInteractiveMapAnnotationEditor.jsx` | Owns selected drawing and unfinished points. Its `importControls` composition already hosts KML import; compose library actions there rather than rewriting the toolbar. Optional guided controls must retain existing unfinished-draft guards. |
| `client/src/hooks/usePrintAnnotations.js` | Owns revision, local recovery, Undo/Redo, single-flight saves and `flushPendingChanges`. Reuse this controller; do not introduce a parallel annotation writer. |
| `client/src/components/PrintAnnotationToolbar.jsx` | Shared by interactive and Print surfaces. Optional new controls default to absent; existing Print behavior is protected. |
| `client/src/lib/api.js` | Add thin feature methods using existing credentials/error handling. Existing POSTs make one attempt; automatic mutation retries across bases remain disabled. |
| `client/src/lib/printAnnotations.js`, `client/src/lib/kmlBoundaries.js` | Existing ID, geometry, document-capacity and all-or-nothing import patterns. General normalization may truncate excess annotations/points, so it is not an import-admission oracle. |

Graft queries used the active worktree's existing graph with `--no-refresh`, followed by actual worktree spans and byte checks. `callers --depth all` ran for the affected zone/form/editor/toolbar/save/map-create symbols. Missing JSX incoming edges were resolved with targeted use-site searches; they are not evidence of no callers. No graph upgrade, rebuild or rebinding occurred.

Protect the ledger-locked original/expanded map, same-map Return, empty-map admission, gestures/rotation, hidden-view projection, editor close guards, map-scoped resource memberships, shared/embed/export, private media, annotation recovery and the recent exploration no-op/autosave fix. The last recorded public `71a9…`/private `8d5e…` release is historical context; this task has made no new production check.

## Ownership and module boundaries

| Owner | Files/modules |
| --- | --- |
| Frontend lane / sole Git actor | New feature-local library picker, snapshot controls, zone workflow provider/state helpers, guided-drawing controls and batch wizard; narrow App/Resource/AssetForm/MyMap/editor/API-client wiring; this design and later implementation plan. |
| Backend lane | New Postgres migration(s), repositories, controllers, routes and the single server-app mount; idempotent starter, immutable library, job/staging/commit, isolated postal scanner and server tests. |
| Geometry/QA lane | `shared/boundaryDrawing.js`, geometry compatibility/whitelist/projection helpers and focused tests, then fictional actual-App integration checks and independent integration review. |

Agree the shared export names once before implementation. The frontend owns `client/src/lib/api.js`; backend owns the server route mount. No concurrent edits to those files. Large existing pages receive focused wiring, not whole-file rewrites. The new picker and wizard are shared modules, not separate copies for Zones and Draw & measure.

## Personal snapshot and independent import contract

Library entries belong to the authenticated account, not an organisation or the source Place. The server reads an authorized **saved** source drawing at an exact document revision. It stores a frozen, versioned drawing and exact spatial-area projection, with a content hash and source provenance. Name/group metadata is private and searchable.

Standalone curation uses `POST /boundary-library {requestId,name,groupName?,source:{mapId,annotationId,revision}}`. Keep a stable owner-scoped request ID through double-clicks and unknown acknowledgements; a same-key/same-payload replay returns the existing library entry. Hash the canonical normalized name/group/source payload together with the authenticated owner. Conflicting reuse returns 409. A later explicit **Save as new library boundary** starts a new request identity.

`GET /boundary-library?cursor&limit=50` returns `{items,nextCursor}`. Summary items contain `id`, `revision`, `name`, `groupName`, `sourceGroupName`, `type`, `sourceName`, `createdAt` and `snapshotSha256`; `sourceGroupName` is source provenance, not an access group. `GET /boundary-library/:id` adds the private frozen `drawing`, exact `area`, point count and source map/annotation/revision provenance. POST returns the created/replayed item and replay indication. `DELETE /boundary-library/:id` retires only that owner entry, returns `{id,retired:true}`, and is safe to repeat. A retired or deleted source never causes an old request identity to create a replacement entry silently. Account ownership governs every list/detail/replay/retire operation.

The shared serializer accepts supported closed boundary shapes and their canonical editable geometry, including compatible rotated boxes, circles, polygons and supported multipart/hole geometry. It preserves source name/annotation text, geometry/control points, shape settings and style at their original geographic positions. It generates fresh annotation IDs when importing. It excludes images/media, resource links and behaviors, sharing flags/privileges, viewport/camera state and unrelated document fields. Unsupported or malformed input fails clearly instead of being approximated.

Library source references explain provenance; they do not create a live dependency. Editing/deleting a source map or retiring a library entry does not mutate an already imported drawing, a frozen job source or an existing zone. No update-in-place library endpoint is introduced. **Save as new library boundary** creates a new entry after explicit action, preserving the old snapshot.

The same picker supports search, name/group filters, preview, single/multiple/all selection and retained selections across filters. Ordinary map drawings are absent until deliberately curated. Empty-library and empty-map states retain a Draw entry point.

For map import, fetch complete selected snapshots, validate the whole batch, then append once through the current annotation controller as one history operation. Preserve all existing annotations, including hidden ones. Recheck admission against the latest full canonical document immediately before append. Enforce the existing 200-item and 20,000-point totals, including existing control-point accounting and per-geometry limits. Reject an entire oversized or invalid import; never silently truncate. Existing Duplicate's default offset is inappropriate for original-position library imports.

An import confirmation has one local application identity: an uncertain annotation-save result retries persistence of the already appended IDs rather than appending another set. A later deliberate import is a new independent copy operation. Saving a snapshot first flushes canonical drawing changes and uses the acknowledged revision; unsaved/stale geometry is not uploaded as an authoritative source.

## Guided Draw for a Place

1. A saved Place's Zones/Create zone draft offers the existing postal-entry path, **Draw boundary**, or **Use Boundary Library**. Preserve Place, zone name/code, source choice and the unchecked library opt-in.
2. Draw starts an owner-bound operation with one stable `requestId`. The server checks existing zone-manage authority, valid canonical Place location and existing Saved/membership rules before writing a map.
3. For a normal Saved Place, one Draw action creates/replays one private Care Map named from the canonical Place and containing that Place as its only initial asset/pin. Open the existing editing canvas centred on that location. Do not add the user's other Saved resources.
4. Show short click guidance using the existing area tools, completion behavior and unfinished-draft guard. A completed drawing can be selected for **Use this boundary / Return to Edit zone**.
5. Return is gated on `printAnnotations.flushPendingChanges()` being true, followed by the saved annotation ID/revision. `closeEditor()` returning true acknowledges a tool transition, not Saved; `saveNow()` catches errors and can resolve to null. A failed/stale save keeps the map editor and recoverable draft, with no zone preparation or library save.
6. Restore the same zone draft and selected Place/name. The source Care Map/drawing remains available in the normal map list. Prepare/review the boundary's postal membership, then explicitly create the zone. Library opt-in is applied only at its explicit save/commit point.

### Starter API and actionable preconditions

`POST /boundary-zone-workflows/map { requestId, hardAssetId }` and `GET /boundary-zone-workflows/map/:requestId` use authenticated owner-scoped durable idempotency. A ready response is `{ requestId, mapId, hardAssetId, name, state: 'ready', outcomeHash }`.

The winning request claim, map and initial asset are created atomically in Postgres. Repeated double-clicks, lost acknowledgements and a retry of the same owner/request/Place return the same outcome. Reusing the key for a different Place returns 409. Generic `POST /my-maps` keeps its current behavior.

If the Place is not Saved, return `409 BOUNDARY_ZONE_PLACE_NOT_SAVED` with zero map writes. Show an explicit **Save Place and draw** action and explain that the Place will be added to Saved. Reuse the existing idempotent `favorites/save` primitive, then retry the **same** starter request ID. No hidden favorite toggle or automatic Saved addition.

Resolve a valid canonical Place location before any map write. Missing/unresolvable location returns `409 BOUNDARY_ZONE_PLACE_LOCATION_REQUIRED`; retain the zone draft and direct the user to the existing Place editor. No fabricated coordinate, fallback Singapore centre, new geocoder or location-editor feature.

### Draft ownership, return and cancellation

Keep the active draft in a feature provider above route unmounts, keyed to the current authenticated owner and workflow. Clear usable state immediately on logout/account change. Put only an opaque workflow/request pointer in router history state; keep unsaved postal/resource values out of URLs, localStorage and cross-tab broadcasts. Server operations always authenticate independently of client pointers.

A hard reload explicitly reconciles the durable request ID/map outcome before offering Resume. It never silently creates a second map. If the in-memory unsaved zone fields are gone, explain that loss and require deliberate re-entry; do not invent restored text or claim the zone was saved. An unknown starter result stays pending/recoverable; a 404 on reconciliation is not permission to generate a new request ID automatically. A deleted/stale map reference offers a clear existing-map/restart choice, not automatic recreation.

The surrounding AssetForm also contains unrelated resource edits. Before routing away, use a narrow saved/clean-Place readiness guard: if those resource fields are dirty, retain the zone draft and ask the user to save or cancel those existing Place edits first. This avoids serializing or rewriting the whole resource form. Reopening the Zones step is scoped to this workflow only; ordinary resource navigation remains unchanged.

**Cancellation decision:** preserve a private Care Map and drawings once their creation/save has been acknowledged. Cancel only the pending zone/library operation and future preparation steps. Explain: “Your Care Map is kept. No audience zone or library snapshot was created.” This deliberately differs from the prototype's disposable provisional map; deleting a real map could discard subsequent user edits. Explicitly saved library snapshots and already created zones are retained and reported, never silently cleaned up.

## Postal preparation and explicit creation

### Batch UI

Select one, several or all library boundaries. Each selected row has a stable `rowKey`, explicit required `hardAssetId`, editable zone name, optional `zoneCode` and immutable source reference. Preserve the optional code through draft freeze, review, request hash and final materialization, using the same normalization and uniqueness scope as existing manual zone creation. Prevalidate duplicate normalized codes within a batch; a later database uniqueness race fails that row atomically without a partial zone or associated library snapshot. Standalone batches start unassigned. A Place-context launch may prefill that Place, with every row still editable. Never guess assignments from boundary names. Same-Place and different-Place batches are equally valid.

Selections, names and assignments survive filters and Back/Next. Missing Place/name feedback identifies the specific row and disables progression. Place options reflect existing manageable Place access; the server remains authoritative. Preview/review shows **Boundary → Place → Zone**, per-row counts and status. Counts come from durable preparation, not inferred geometry sizes or prototype examples.

Preparation reaches READY before the explicit **Create N audience zones** action. It creates neither zones nor library entries. A zero-match row is shown as empty/no zone; the create count and result must distinguish it from a created zone. Creating zones does not select them on an Offering.

### API and state transitions

| Operation | Contract |
| --- | --- |
| `POST /boundary-zone-jobs` | `{requestId, rows:[{rowKey,name,zoneCode?,hardAssetId,source,saveToLibrary,libraryName?,libraryGroupName?}]}`. `source` is `{libraryId,revision}` or `{mapId,annotationId,revision}`. Freeze all sources; validate **all** Place permissions and normalized-code conflicts before any job-side write. Return 202 with job/revision, snapshot/manifest hashes and per-row statuses/counts/`zoneId:null`. |
| `GET /boundary-zone-jobs/:id` | Owner-only durable status, row outcomes and revisions; supports explicit resume/reconciliation. |
| `GET /boundary-zone-jobs` | Paginated owner-only active/recent summaries for the Zones resume UI. An opaque job ID in router history may reopen a job directly; this list also recovers work after that tab/history is gone. Return metadata/counts, not staged postal lists. |
| `POST /boundary-zone-jobs/:id/advance` | `{expectedRevision}`. One bounded leased step prepares data, or advances an explicitly committed job. READY itself creates no audience zones/library entries. |
| `POST /boundary-zone-jobs/:id/commit` | `{requestId,expectedRevision}` after review. Recheck **all** Place permissions, bind the immutable ready snapshot and record durable COMMITTING intent. Subsequent bounded advances finalize rows. Replayed intent returns existing outcomes. |
| `POST /boundary-zone-jobs/:id/pause` | `{expectedRevision}` stops future continuations after any accepted in-flight step; preserve resumable staging and committed outcomes. |
| `POST /boundary-zone-jobs/:id/resume` | `{expectedRevision}` explicitly resumes an authorized paused job after GET reconciliation, without resetting its cursor or source snapshot. |
| `POST /boundary-zone-jobs/:id/cancel` | `{expectedRevision}` stops future work and retains accepted map/zone/library outcomes. Return those outcomes so the UI can explain partial completion; no rollback disguised as cancellation. |

State progression is preparing → ready → committing → complete, with explicit paused, empty and failed row outcomes. At finalization, one row's local audience-zone row, **complete postal membership**, optional checked library snapshot and result are committed atomically. Partial postal membership must never become eligible or visible as a finished zone. Previously curated library sources are not automatically copied again.

A batch can report partial completion if a later bounded row fails or authority changes: show created IDs/results as created, failed/empty rows distinctly, and retry only outstanding idempotent work. Never recreate successful zones. Permission revocation during preparation or before commit stops unauthorized materialization.

### Existing infrastructure and scanner limits

Use the existing Neon/Postgres stack and additive local migrations for personal library, workflow/idempotency, job and staged-postal state. Reuse the notification repository's lease/cursor pattern. There is no D1, Cloudflare Queue, new external service, binding, credential or remote infrastructure in this design.

The new feature uses client-driven bounded continuations: one in flight per owner/job, expected revision, durable cursor and bounded lease. Closing the page pauses continuations; the Zones owner-job list provides an explicit Resume action after status reconciliation, including when the in-memory draft/job pointer is gone. An opaque job ID may also live in router history; raw postal/resource payloads do not. It is not a promise of unattended execution while every client is closed.

Do not paginate or raise the current interactive provider's `.area()` limits. Add an isolated tile/row-slice scanner for these jobs, pin the address manifest identity, and retain existing per-step tile/row/byte/candidate/geometry/read guards. Persist enough tile/row progress to continue deterministically without skipping or duplicating memberships. Use exact existing spatial membership semantics, including supported holes/multipart areas. Results stay staged until complete. Existing interactive address selection, CSV and admission diagnostics keep their contracts.

## Failure and security boundaries

- Library sources require map ownership and exact saved revision. Viewing a map or owning a map does not grant permission to manage the selected Place's zones.
- Validate all source and Place references before a batch write; repeat Place authorization at commit/finalization. Private library/job endpoints return only the authenticated owner's records.
- A stale source/revision fails with actionable refresh/review; it does not silently rebase a frozen job on changed geometry.
- Account, route and workflow context are captured before each asynchronous phase. Abort/stop halts future work and stale UI updates; it cannot undo an accepted server operation. Never reuse an old account's response or follow-up under a newly signed-in account.
- Unknown mutations are reconciled by the same durable operation ID. Existing API retry policy and auth headers remain unchanged. Distinguish failed, unknown, paused, empty and created states instead of turning a timeout into success or rollback.
- Library opt-in is separate from `sharingStatus` and existing shared-zone approval. New generated zones are local to their explicitly assigned Place. Resource bindings, media, share privileges and public DTO fields are never inherited from a drawing.
- Local migrations/tests may use an explicitly authorized isolated test database or fakes. Normal startup must not apply schema. No remote schema/storage mutation is authorized by this implementation task.

## Validation and implementation sequence

| Cohort | Required evidence |
| --- | --- |
| Shared drawing helpers | Canonical rectangle/circle/polygon/KML-compatible geometry, holes/rotation/style/text preserved; fresh IDs/original positions; links/media/sharing excluded; unsupported geometry rejected; all-or-nothing 200/20k admission using hidden-inclusive canonical documents. |
| Library server | Owner isolation, saved exact-revision reads, immutable detail/provenance, name/group filtering, explicit-only creation, retirement independent of source/import/zone snapshots, malformed/private payload denial. |
| Guided starter | One map/one Place asset under double-click/lost ACK/same-key replay; different-Place 409; not-Saved 409 has zero writes and explicit save/replay; missing location has zero writes; stale/deleted 404 recovery; no extra Saved pins. |
| Guided actual App | Named map, first Place pin and centre, click guide/finish, zone Place/name/opt-in return; unfinished cancel and accepted-map retention; failed annotation save blocks handoff; no unintended resource-form submit; user/route/reload recovery. |
| Postal jobs | Manifest pinning, exact membership at tile edges/holes, bounded cursor/lease/revision steps, pause/resume/retry, every Place permission before writes, no zone before explicit commit, atomic complete membership, zero-match rows, partial failures/revocation/idempotent commit. |
| Bulk actual App | Single/several/all/filter retention, required per-row Places/names, different and same Places, Back/Next persistence, progress/review/explicit create, per-row partial/empty results, no automatic Offering changes. |
| Reuse actual App | Same picker in Zones and Draw & measure; empty states; original-position import, copy edit leaves source/library unchanged, explicit save-as-new, one Undo step, current document capacity/concurrency/recovery. |
| Existing regression controls | Legacy postal zone create/share approval and Offering matching; resource create/edit/import; empty-map admission, classic/canvas/Return, hidden annotation projection, measurements, gesture/camera, shared/embed/Print/export and scope-aware memberships. |

Build in focused slices: (1) shared whitelist/budget helpers and server persistence contracts; (2) personal picker and map copy import; (3) durable starter and owner-bound guided return; (4) staged postal preparation/explicit commit and row assignment; (5) integrated fictional actual-App checks and docs. Capture meaningful RED/green cases before each new behavior. Run focused tests while the slice is stable, then one frozen relevant client/server build/quality and map-lockdown set; do not repeatedly run broad suites during parallel edits. Release/production verification remains a later, separately authorized task.

## Remaining builder calls before product edits

These are bounded implementation decisions, not unresolved user-product approvals:

1. Backend publishes exact DTO/error enums and pause/cancel method, migration numbering and resume/tombstone behavior for an already deleted starter map. Agree the owner/request identity and payload-conflict rules across client and server.
2. QA/shared lane freezes the `shared/boundaryDrawing.js` exports, supported geometry matrix and exact full-document point accounting; frontend/backend consume the same whitelist and hash/projection definition.
3. Frontend chooses the smallest authenticated provider mount and router-history pointer, the saved/clean resource-editor guard, restore-to-Zones adapter and active workflow expiry. Hard-reload recovery text must distinguish recovered map from lost unsaved zone text.
4. Agree one existing-authority Place-candidate source for each UI entry. Candidate display is convenience only; all-row authorization remains server-side.
5. Freeze job ready/empty/partial status presentation and a source/hash-bound commit intent, then assign exact non-overlapping files. The orchestrator reviews this design and the fresh builder check before dispatching product edits.

## Preflight accounting

Frontend: 12 Graft retrievals, estimated 658,027 tokens saved. Backend: 6 / 449,723. QA: 2 / 149,117. Fresh design reviewer: 3 / 29,098. Combined pre-implementation retrieval: **23 calls / 1,285,965 estimated tokens saved**. These are tool estimates, not runtime performance claims. Frontend source was cross-checked in the active worktree; the approved prototype remained UX-only. At this document's creation, only the local feature branch and this design document had been added; no product code, test, migration, dependency, auth, secret or live data was changed.
