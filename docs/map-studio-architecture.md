# CareAround Map Studio Architecture

Date: 2026-08-09
Status: local release candidate through Phase 4. The versioned state model,
owner schema/API, named-view UI, complete Explore/Design presentation wiring,
and additive Export/Print parity are implemented on
`codex/map-studio-state-model`. The additive schema has been applied and
verified without a backfill; the compatible Worker and client have not yet
been deployed. The existing Print View route remains the renderer and rollback
surface; Shared Map/embed snapshots remain unchanged.

## Product Goal

Map Studio evolves one My Map into one workspace with three modes:

- **Explore** for navigation, current bubble clustering, search, selection,
  notes, and resource focus cards.
- **Design** for saved basemap, map detail, camera framing, pins, labels,
  layers, annotations visibility, and interactive layout.
- **Export/Print** for temporary page layout, columns, margins, and output
  quality rendered through the existing deterministic export surface.

One My Map may have several named visual views. Resource membership, personal
places, notes, and annotation geometry still belong to the My Map rather than
to a visual view.

## Phase 1 Decision

The first implementation was the pure, versioned model in
`client/src/lib/mapStudioState.js`. Phase 1 deliberately had no page or
renderer import, which made the state contract and its regression tests
reviewable before runtime work. Phase 2 imports its commands through the
isolated owner state helper and panel. Phase 3 now adapts the active owner draft
into existing interactive `DirectoryMap` seams. Phase 4 now feeds the same
active draft plus export-only settings into the existing dedicated Print View
renderer without replacing its route or capture pipeline.

The model has three separate roots:

1. `MapStudioDocument` is persistent and revisioned. It contains named views
   and only the design values that an owner explicitly saves.
2. `MapStudioSession` is temporary. It contains the active mode, active view,
   saved and draft designs, dirty state, search, hover, focus, selection, and
   unsaved camera movement.
3. `MapStudioExportSettings` is export-only. It contains page layout,
   placement, height, columns, margins, and image quality and is not included
   in a saved view.

Unknown future schema versions fail closed. A My Map with no Map Studio
document gets one deterministic `Default view`; no legacy data is rewritten
or inferred as a newer schema.

## State Ownership

| Concern | Owner | Persistence rule |
| --- | --- | --- |
| My Map resources, category order, personal places, notes | Existing My Map domain | Existing API and tables only |
| Annotation geometry and revisions | Existing private annotation document | Existing owner-only autosave contract |
| Basemap colour and detail mode | Named view design | Explicit `Save view` only |
| Designed camera | Named view design | `Use current framing`, then explicit `Save view` |
| Pin style and size, label detail, layer visibility | Named view design | Explicit `Save view` only |
| Interactive map height and resource-panel placement | Named view design | Explicit `Save view` only |
| Search, hover, focus, selection | Map Studio session | Never persisted |
| Ordinary pan/zoom | Map Studio exploration state | Never persisted unless deliberately copied into the design draft |
| Print page, columns, margins, quality | Export settings | Export session only |
| Shared/embed data | Existing frozen share snapshot | Changes only through the existing explicit share update |

The design can reference annotation identifiers for visibility, but it does
not own, copy, or migrate annotation geometry. Personal places stay inside the
owner-only My Map payload and never enter guest or embed state through Map
Studio.

## Version 1 Persistent Shape

The normalized document is intentionally small:

```text
MapStudioDocument v1
  revision
  defaultViewId
  views[]
    id
    name
    revision
    design
      basemap: style, detailMode
      camera: fit | fixed view
      pins: category-bubble | numbered, size
      labels: detail
      layers: resource and annotation visibility filters
      layout: interactive map height and resource-panel placement
```

Named-view commands create, rename, duplicate, select, update, mark a default,
and delete views. At least one view must remain. View identifiers are supplied
by the future persistence boundary rather than generated during normalization,
which keeps migrations and tests deterministic.

Every editing session records the view revision it started from. `Save view`
rejects a stale revision instead of overwriting a newer edit. Search, focus,
selection, unsaved camera movement, and export settings are not arguments to
the save command and therefore cannot leak into the persistent document.

## Existing Architecture Reuse

### `DirectoryMap` remains the map engine

`DirectoryMap` already owns Leaflet, current bubble collision/clustering,
controlled camera input/output, basemap detail surfaces, pin rendering, and
map interaction callbacks. Map Studio should adapt a saved design and a
temporary session into its existing props. It must not move persistence or
Studio commands into `DirectoryMap`.

### The presentation model remains resource truth

`buildDirectoryPresentation` continues to derive pins, groups, ordering,
resource cards, and focus mappings from the My Map directory. A named view
does not copy resources or create a competing presentation model. View layer
filters are applied after presentation and before rendering.

### Resource cards stay shared and variant-controlled

The current owner mobile complete focus card, desktop cards, ordinary Shared
Map cards, and embedded cards retain their existing variants. Map Studio may
select or arrange those components, but it must not merge their privacy or
payload contracts.

### Print View remains the export renderer

`DirectoryPrintView`, `MapImageExportButton`, hidden capture readiness, and the
current `?view=print` route remain operational until Map Studio has measured
functional and visual parity. `buildMapStudioPrintState` is a pure adapter that
combines supported saved design fields with temporary export settings into the
existing `printMapState` contract.

The current Print View renderer still owns its locked print-badge marker
contract. Studio Export maps the supported view design, resource visibility,
camera, card detail, layout, margins, and image quality into that renderer.
The visible preview and hidden capture therefore share one print state while
the ordinary Print View continues to use its existing defaults.

## Explicit Save Flow

1. Open the default or selected named view as a clean session.
2. Explore freely. Search, focus, selection, and ordinary pan/zoom update only
   the session.
3. Enter Design mode and edit a draft. To save framing, deliberately copy the
   current exploration camera into the design camera.
4. `Save view` checks the base revision and writes only the normalized design.
5. Export mode combines the active draft or saved design with temporary
   export settings. Export does not implicitly save the view.
6. Leaving with a dirty draft must offer Save, Discard, or Cancel. Switching
   views must use the same guard.

## Phase 2 Persistence Implementation (Release Candidate, Schema Applied)

Current server inspection changed the initial table recommendation. CareAround
uses Neon HTTP and does not currently rely on an interactive database
transaction for My Map mutations. Storing every view as a separate row would
make the default-view, maximum-view, ordering, and cross-view revision
invariants depend on several writes.

The local Phase 2 candidate uses one additive owner-scoped
`my_map_studio_documents` row per My Map:

- `map_id` primary key referencing `my_maps(id)` with cascade deletion;
- `schema_version` integer, normalized `document` JSONB, and optimistic
  `revision` integer;
- `created_at` and `updated_at` timestamps;
- no exploration, export-only settings, annotation geometry, personal places,
  resources, notes, share state, or owner identity in the JSON document.

The JSON document contains the complete validated set of views and its
`defaultViewId`; the database revision stays in its own column. A single
compare-and-swap write can therefore preserve all document invariants without
cross-row transactions. The server-side contract in
`server/src/utils/mapStudioDocument.js` is strict and bounded: it rejects
unknown schema versions, unknown fields, duplicate view IDs, a missing default
view, invalid cameras, duplicate or excessive layer references, temporary
exploration/export fields, annotation geometry, and documents over 512 KiB.
It is imported only by the authenticated owner controller and the existing My
Map duplication path. The owner My Map page now reaches this contract only
through the isolated named-view panel described below.

The owner-only API contract is:

- `GET /my-maps/:id/studio` returns
  `{ mapId, document: null, updatedAt: null }` when the map has no saved Studio
  document. The client then creates its in-memory legacy `Default view` using
  the current colour preference.
- The same GET returns a validated document containing its current `revision`
  when a row exists. Invalid stored data fails closed rather than reaching the
  owner UI.
- `PUT /my-maps/:id/studio` accepts the complete normalized document and its
  expected revision. Revision zero creates the first row; subsequent saves use
  an atomic `WHERE map_id = ? AND revision = ?` update and return `409` when no
  row is updated.
- Named-view create, rename, duplicate, update, default, and delete remain pure
  document commands in the client. One PUT persists the resulting valid
  document atomically; there is no partially updated view collection.

Every read and write authorizes through the parent My Map owner. Studio saves
do not update `my_maps.updated_at` while the design is private, because that
timestamp currently participates in frozen-share staleness. My Map duplication
validates and copies a persisted Studio document into the new private map,
resetting the new document revision to one; a source map without a row remains
lazy and receives its default only in memory. My Map deletion gets cascade
cleanup automatically.

`ensureMapStudioSchema` creates the table and ownership/revision constraints but
no rows. `verifyMapStudioSchema` verifies every column, the `map_id` primary
key, cascade foreign key, and positive revision constraint. The narrow
database-mutating command is
`npm run bootstrap:map-studio-schema --workspace=server`; it completed against
the configured CareAround database and verified all six columns and
constraints. It created no Studio rows and performed no production backfill or
bulk rewrite. Release order remains the compatible Worker API and then the
owner client. Rollback disables the owner client/API usage while leaving the
inert additive table in place; do not drop user-created documents during a
client rollback.

### Owner named-view UI and API client

`MapStudioViewsPanel` is an additive owner-only panel in the current and V2 My
Map layouts. It is not rendered by Print View, Shared Map, or embedded-map
routes. The panel loads the private document independently from the existing My
Map detail payload, so a Studio load failure leaves the current map, cards,
notes, resource actions, and map controls usable.

`mapStudioOwnerState.js` keeps three client values separate while the panel is
open: the last server document and compare-and-swap revision, a working document
containing unsaved named-view commands, and the active design session. Create,
rename, duplicate, set-default, and delete remain local until `Save changes`
sends one complete PUT. `Discard` restores the last server document. A design
draft cannot be abandoned by switching or changing view structure without an
explicit discard, and a dirty page installs an unload warning.

HTTP `409` does not overwrite either side. The panel keeps the local changes
visible and offers an explicit `Reload latest` action that warns before
discarding them. The save payload uses the last server revision as the expected
revision while carrying the normalized current view revisions and designs.
Search, focus, exploration camera state, export settings, annotation geometry,
and personal-place data are never included.

The owner coordinator applies the selected draft to `DirectoryMap`
only after the current map's Studio document loads successfully. A Studio load
failure emits no runtime model and leaves the legacy map, cards, actions, and
global colour preference operational. Studio Export separately snapshots the
active draft into the existing Print View route; a direct route load retrieves
the requested saved view before enabling export.

## Phase 3 Explore/Design Runtime (Release Candidate)

`mapStudioInteractiveAdapter.js` now proves the narrow translation boundary
between a normalized named-view design and existing interactive renderer
inputs. It has no React import and does not mutate the global map-colour
context. `MyMapDetailPage` consumes it through the successful owner-session
snapshot and passes only existing props into the V2 and classic map shells.
Shared Map, embed, and Print View do not import or read the runtime session.

The current renderer support matrix is intentionally explicit:

| Design path | Interactive status | Existing seam |
| --- | --- | --- |
| `basemap.style` | Wired owner-only | `DirectoryMap.mapStyleOverride` plus matching Detailed asset family |
| `basemap.detailMode` | Wired owner-only | `DirectoryMap.basemapMode` |
| `camera` | Wired owner-only | `mapViewState` / temporary `onMapViewStateChange` |
| `pins.style` | Wired owner-only | semantic `category-bubble` / `number` marker mode |
| `layers.annotations` and hidden IDs | Wired owner-only | existing annotation filter plus `mapOverlay` |
| `layout.mapHeight` | Wired owner-only | existing map-height shell/class and resizable-frame seams |
| `pins.size` | Wired owner-only | scaled bubble, saved-pin, number, and cluster artwork through `DirectoryMap.markerScale` |
| `labels.detail` | Wired owner-only | shared card-detail contract across desktop, mobile focus, and print cards |
| resource layer and category filters | Wired owner-only | source-directory filtering before both pins and cards are derived |
| `layout.resourcePanel` | Wired owner-only | responsive, below-map, and beside-map presentation seams |

The default adapter output keeps category-bubble marker semantics and does not
emit clustering, badge, or category-icon overrides. The V2 shell therefore
retains its current bubble/collision behavior under runtime wiring.
Numbered pins translate only to `DirectoryMap`'s existing `number` mode. A
fixed camera is copied into the controlled-camera input; fit mode remains null
so the current camera fitter stays authoritative.

The runtime applies the active draft to desktop and mobile V2 and classic owner
maps. Scoped colour also chooses the matching Default/Gray Detailed roots and
manifests. Existing map-settings colour/detail choices become design patches
and enter Design mode instead of writing the global colour preference. Ordinary
pan/zoom, search, hover, focus, and selection update only exploration state.
Fit/fixed camera changes rotate the existing layout signature so returning to
fit reuses the established camera fitter. Annotation visibility filters the
existing overlay without changing its private autosave document. Every version
1 design path is now represented by an owner control and a renderer seam.
Resource filtering is applied to the source directory before both the classic
and V2 presentation models are rebuilt, preventing pin/card divergence.

### Owner session coordination seam

The owner-state helper now exposes one immutable runtime snapshot containing
only the active view identity, mode, cloned draft design, cloned exploration
state, and separate `designDirty` / `ownerDirty` flags. It does not expose the
persisted or working documents to a renderer. Design mutations are rejected
unless the session is already in Design mode; exploration mutations update only
the temporary session and remain absent from the save payload.

`MapStudioViewsPanel` has an optional `onOwnerSessionChange` callback for the
page-level coordinator. It emits only after the requested map ID has
loaded successfully, emits null while unavailable, and ignores a superseded
request so a route change cannot briefly apply the previous map's view. There
is one imperative controller for mode, design-draft, and exploration patches;
the panel remains the canonical owner of the session and documents.

### Standalone Explore and Design controls

`MapStudioDesignControls.jsx` defines the owner control surface for scoped map
colour, Detailed/standard detail, pin style and size, label detail, resource
and annotation visibility, compact/standard/tall map height, responsive/below/
beside resource placement, and fit/current camera framing. It also exports the
explicit Explore and Design mode switch. All choices use accessible pressed
state and at least 44-pixel touch targets, with complete English, Chinese,
Malay, and Tamil copy.

The control contract emits normalized partial design patches and never saves,
loads, or renders a map itself. `Use current framing` remains disabled until a
valid temporary exploration camera exists. The controls mount only inside the
private owner panel; Design controls are hidden in Explore mode.

## Phase 4 Export/Print Runtime (Release Candidate)

The existing `?view=print` route remains authoritative. Entering Studio Export
captures the current active draft, including unsaved design choices, and adds a
`studioView` route key. A direct reload resolves that saved view through the
owner-only Studio API before enabling PNG/PDF actions. Missing or invalid view
data fails closed with export disabled; it never silently exports another
view.

`buildMapStudioPrintState` combines the active design with temporary page size,
orientation, columns, margins, map placement/height, and image quality. Studio
Export locks persistent map-design controls and hides My Map mutation actions,
while the ordinary Print View retains its established controls and defaults.
Resource/category filtering occurs before both the print presentation and map
pins are built. Margin tokens map to the same page-padding classes used by the
visible preview and hidden export capture.

Shared Map and Embedded Map pages have no Studio document/API import. Exporting
a private named view does not publish it, mutate a frozen snapshot, or change
the existing share-update contract.

## Shared and Embedded Snapshot Boundary

No live Map Studio document should be read by Shared Map or embed routes.
After private owner behavior is stable, a later separately approved phase may
allow `Update shared link` to freeze one sanitized selected view into the
existing snapshot. That phase must preserve:

- current stale-until-explicit-update semantics;
- annotation share opt-in and sanitization;
- exclusion of personal places, private notes, owner tools, and live state;
- origin allowlisting and current framing headers;
- revocation and unpublish behavior.

Existing tokens must remain compatible and continue to render their current
frozen presentation when no view snapshot exists.

## Progressive Delivery Gates

### Phase 1 — architecture and model

- Pure versioned document, session, export settings, commands, and tests.
- No runtime imports, schema, API, route, UI, share, or deploy changes.

### Phase 2 — owner persistence and named-view controls

- Strict server document validation, the additive document schema, narrow
  bootstrap verifier, and owner-only GET/PUT API are implemented locally.
- Optimistic compare-and-swap revisions, lazy legacy reads, private duplication,
  and focused server authorization tests are implemented locally.
- The owner named-view panel and API client are implemented locally with create,
  rename, duplicate, select, default, delete, explicit Save/Discard, unload
  protection, and non-destructive conflict recovery.
- The table has been applied and verified additively without a backfill. The
  compatible Worker has not been deployed. No route has been removed or
  consolidated.

### Phase 3 — Explore and Design adapters

- Pure design-to-interactive model and support matrix are implemented locally,
  with default category-bubble parity.
- A canonical owner runtime snapshot, mode-gated design mutation, temporary
  exploration mutation, and stale-load-safe panel callback are implemented
  with one owner-page consumer.
- Standalone multilingual Explore/Design controls cover every version 1 design
  path and mount only in the owner panel.
- The current presentation is fed into existing `DirectoryMap` instances
  through the narrow adapter in V2 and classic desktop/mobile shells.
- Preserve Detailed roots, bubble clustering, focus cards, notes, annotations,
  personal places, and current My Map actions.
- Keep Shared Map/embed publication and route retirement outside this phase.

### Phase 4 — Export parity

- The same active design plus export-only settings feed the dedicated renderer.
- Source tests cover direct reload, fail-closed loading, filtering, margins,
  export-only controls, and Shared Map/embed exclusion. Signed-in local visual
  UAT covers desktop/mobile Design, two named views, explicit persistence,
  Studio Export reload, and the mobile focus-card flow.
- The existing Print View route remains the rollback and comparison surface.

### Phase 5 — optional route consolidation

- Consider consolidation only after functional and visual parity, production
  UAT, and an explicit retirement decision.
- Shared/embed view publishing remains a separate privacy-sensitive release.

## Locked Regression Gates

Every runtime phase must run the focused tests for the touched surface, the
full client suite, `npm run build:client`, and `npm run verify:map-lockdown`.
Server/schema phases also require the full server suite and migration
bootstrap/verification. Before deployment, use `docs/release-checklist.md` and
recheck:

- all six Detailed map roots and no live-tile leakage under a selected surface;
- current category-bubble clustering and mobile owner focus cards;
- annotation persistence, revisioning, undo/autosave, visibility, and export;
- personal-place owner-only behavior;
- frozen Shared Map/embed compatibility and framing/revocation;
- hidden export capture readiness and nonblank PNG/PDF output;
- authentication and all existing My Map membership/actions.

Production schema application and deployment require the release checklist.
Route retirement and Shared Map/embed view publication are explicitly outside
this goal and require separate approval.
