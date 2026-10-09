# Care Map KML boundaries — 10 October 2026

User approved the recommended boundaries-only import after exploring two Google My Maps KML exports. Work is isolated on `codex/care-map-kml-boundaries-20261010`, from accepted public `cb70ea15`, in the clean release checkout. Preserve the dirty primary checkout and the authored Help CMS library.

## Contract and architecture

- Owner desktop: Edit content → Annotate → Import boundaries. Read `.kml` locally, preview named areas, select individual areas, adjust outline/fill/opacity/thickness, confirm once. Cancel/file errors make no document or resource changes.
- Simple closed Polygon outer rings only; report points, holes, multiple geometries and other unsupported items as skipped. No KMZ, NetworkLink fetching, HTML descriptions, external styles/media, altitude interpretation, resources or official region records.
- Preserve all source corners, coordinates, outline/fill colours and opacity. A private `boundarySource: 'kml'` polygon discriminator bypasses the legacy rounded path. Existing drawings retain rounded rendering and legacy style bounds. Imported outlines allow source fractional/zero width and alpha. No schema migration or competing persistence endpoint.
- Append the complete selected batch through the existing revisioned annotation document and one undo history step. Preflight existing count/combined point budgets against the latest document; reject the whole batch if it cannot fit, without truncation or partial import. Re-import requires another explicit confirmation.
- Existing saved-view annotation visibility controls provide show/hide. Imports remain owner-private, excluded from shared/embed snapshots and bulk sharing. Owner PNG/PDF includes only visible saved boundaries with their exact outlines. Private runtime attention remains transient.
- New controls and runtime Guide instructions in English, Mandarin, Malay and Tamil. Do not rewrite authored/canonical/generated Help content or existing Guide routes.

## Blast radius and protected surfaces

Touched: additive parser/preview, owner annotation toolbar hook, explicit polygon discriminator normalization/validation/rendering, private sharing filters, translations/Guide extension. Safeguards: exact renderer is conditional, shared snapshot filter rejects imported boundaries, legacy integer widths/opacity limit remain enforced, no map camera or membership changes on preview, existing hidden-view and capture pipelines reused.

Locked surfaces: hand-drawn transforms/live preview, undo/revision/autosave, images and hover links, resources/pins, shared publication, selected-view hide/export, Detailed fixed-surface roots and attribution, Directory first/default Care Maps and active-tab eyebrow, CMS library and publication provenance.

## Acceptance and evidence

Local acceptance passed: parser geometry/styles/reference and file limits; unsupported/malformed/hostile XML; no external requests; actual sample counts/geometry; atomic budget overflow, cancel and stale-map read; one-step undo/reload; private server persistence/conflict/public snapshot; exact rendering/transform/PNG/PDF; visibility; desktop/390 px dialog and four locales; Guide workflow/non-map isolation.

Actual supplied samples retain all 814 original corners: WCJWTC 7 boundaries and Chua Chu Kang/Bukit Gombak 5 boundaries, with its 5 point pins skipped. Final isolated browser acceptance passes 16/16 with no errors or unexpected requests: preview/select/style/cancel, malformed/unsupported XML, no external fetch, one-step batch undo/redo/reload, exact Leaflet paths, saved visibility, four languages/390 px, capacity refusal, stale-read cancellation, keyboard outline-opacity commit/undo, production PNG/PDF downloads and hidden-boundary exclusion. Downloads use a synthetic basemap and one fictional existing export resource. The PNG was visually reviewed; the PDF is a real two-page `%PDF-1.3` download. These are local component checks, without production map/resource/media writes or physical-device UAT. Earlier failed harness/selector/layout attempts are retained separately; none is relabelled green.

Final source gates pass: compiler 17, CMS 73, server 1,182, client 974, environment 5, static checks and production build. Locked-map gate passes 112/112 and fixed-surface build. Graft refresh and scoped diff review pass. See `docs/evidence/care-map-kml-local-20261010.json`. Generic credentialed smoke, physical-device UAT and production delivery are separate; no blanket smoke claim is made.

Review source/diff and rebuild Graft. Freeze only scoped source, then use the already authorized normal private paired publisher preserving the latest authored library, Worker settings/bindings and exact source/content provenance. Deployment and production parity remain pending until independently verified; local fixtures are not production or physical-device proof.
