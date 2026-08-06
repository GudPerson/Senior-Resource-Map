# CareAround SG Print View Annotation Stable Baseline - 2026-08-07

## Summary

Owner My Map Print View annotations are responsive, predictable, and easier to
draw. The work shipped as two independently reversible client releases and then
passed a combined stabilization gate against current source, production
artifacts, authenticated behavior, persistence, undo/autosave, and export
surfaces.

## Release Chain

- Comparison baseline: `234ff092a`.
- Product Release 1: implementation `295ebfd4b`; evidence `6fbb049d`;
  immutable deployment `https://f2f6179a.senior-resource-map.pages.dev`.
- Product Release 2: implementation
  `9915de2a8ac924d101003d8506492529264fcfcf`; evidence
  `1bf49939cf448cad688dbcc6b7d6001d3c62d079`; immutable production
  deployment `https://8f9840b9.senior-resource-map.pages.dev`.
- Production `main` is the Release 2 implementation commit. Release 2 contains
  Release 1 in its Git ancestry.

## Locked Achievements

- Line, rectangle, circle, and polygon geometry follows highlighted control
  points continuously during drag without accepted-point reversion.
- Every completed drag produces one document update and one undo step; circle
  centre movement carries its radius handle coherently.
- Control targets are logically 44px by 44px while their visible dots remain
  compact.
- Line, box, and circle preview the pointer and create exactly once on click
  two. Boundary previews each next edge and completes once through Done or
  Enter after three points.
- Existing annotations accept selection and drag input only in Select mode, so
  they cannot intercept active drawing.
- Drawing previews and drag previews are transient local state. They do not add
  saved points or annotation revisions before completion.
- While editing, Resource PNG stays independent and the hidden map-export
  surface holds its last prepared snapshot. Closing the editor prepares the
  exact latest private annotation document before Map PNG/PDF become ready.
- Owner-only editing, private persistence, serialized autosave revisions,
  local-draft recovery, undo/redo, layer ordering, rounded render-only polygon
  geometry, map pins/camera/modes, all six Detailed map roots, and Shared Map
  privacy remain intact.

## Final Verification

- Focused annotation and Print View tests: 41/41.
- Combined client/source and town-map tests: 585/585.
- Full server tests: 502/502.
- Map-lockdown tests: 81/81.
- Map-lockdown aggregate and exact six-root production build: passed.
- Quantitative real-Leaflet probe: four logical 44px targets; eight distinct
  live SVG paths during one drag; exactly 31 commits for 31 completed drags;
  zero-pixel final endpoint drift; zero browser warning/error.
- Local build, immutable deployment, and custom domain matched byte-for-byte
  with correct MIME for HTML, entry, CSS, My Map, map export, Shared Map, and
  shared runtime chunks. Core routes and production API health passed.
- Authenticated production UAT proved drawing preview, completion gating,
  repeated-Enter idempotency, sequential drag retention, one-step Undo,
  autosave, visible/export parity, reload persistence, and final cleanup. Only
  the original private annotation remained after the clean reload.

## Not Changed

- No Cloudflare Worker, server API, database schema, production data, auth,
  permission, secret, map asset, category-order, resource-removal, Shared Map,
  or public-visibility change.
- No annotation document shape or persistence format change.

## Intentional Limits

- Editing remains desktop fine-pointer only and Full-map-only.
- Standalone text, arrow, freehand/lasso, road-snap, and touch-only editing are
  unsupported.
- Browsers-data age and existing large-chunk build advisories remain non-blocking
  maintenance items; neither was introduced by this release.

## Rollback

- To remove only Product Release 2 drawing UX, redeploy Release 1 commit
  `295ebfd4b` or its immutable deployment.
- To remove both interaction releases, redeploy comparison commit `234ff092a`.
- Neither rollback requires a Worker, schema, data, annotation-document, or map
  asset rollback.

## Recommended Next Step

Keep this annotation surface locked and monitor real owner use. Reopen it only
for a reproduced regression or a separately scoped and approved annotation
tool; do not combine future tools with map, export, privacy, or persistence
refactors.
