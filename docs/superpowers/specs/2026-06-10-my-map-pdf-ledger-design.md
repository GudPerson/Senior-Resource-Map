# My Map PDF Ledger Export Design

Date: 2026-06-10

## Purpose

Add a one-click downloadable PDF overview for a signed-in user's My Map. The PDF is meant for internal review, extraction, and analysis of resource coverage and notes.

The PDF complements the existing Print, Share, and image export flows. It must not replace or change those stable actions.

## Current Baseline

- The signed-in My Map detail page already shows map resources, list-only resources, map notes, Print, Share, and image export behavior.
- Existing image export is visual-first and uses a hidden map/export surface to save a PNG.
- Existing Print is browser/print-dialog based.
- Map notes are already permission-filtered by the map payload that the viewer is allowed to see.
- Server-side note records include created and updated timestamps, but the current frontend note helper does not preserve those timestamps for display/export.

## Approved Scope

V1 adds a `Download PDF` action on the signed-in My Map detail page.

The export uses the full My Map by default:

- all resources in the map
- resources grouped by category
- categories sorted alphabetically
- resources sorted alphabetically within each category
- resource name
- category
- address
- source map number
- notes
- note timestamps when available

The PDF contains:

1. A summary page with map name, generated date/time, resource totals, note totals, category breakdown, and a small map snapshot.
2. Ledger pages with the grouped resource and note details.

The PDF must be searchable/selectable text, not a screenshot-only document.

## Non-Goals

- No shared-map PDF export in V1.
- No public/discover PDF export.
- No server-side PDF endpoint in V1.
- No change to auth, Gmail, GudAuth, secrets, or production access configuration.
- No change to map pins, clustering, distance calculations, ranking, screen sorting, resource visibility, or note permission rules.
- No replacement of the existing Print, Share, or image export actions.
- No new analytics scoring or automated insight generation inside the PDF.

## User Flow

1. User opens a signed-in My Map detail page.
2. User clicks `Download PDF`.
3. The button enters a preparing/downloading state.
4. The browser downloads a `.pdf` file without asking the user to print or save manually.
5. If PDF creation fails, the page shows a short inline error and does not change the map.

The downloaded filename should use the map name where possible, for example `my-partners-ledger.pdf`.

## PDF Layout

### Summary Page

The first page gives a quick overview:

- map name
- generated date/time
- total resources
- total categories
- resources with notes
- total notes
- category breakdown
- small map snapshot

If the map snapshot cannot be captured within a short timeout, the PDF still downloads and the summary page shows a simple `Map snapshot unavailable` notice. The resource ledger is the priority.

### Ledger Pages

Ledger pages are grouped by category. Each category section contains its resources in alphabetical order.

Each resource entry includes:

- resource name
- category
- address
- source map number
- notes
- note timestamps

`Source map number` uses the visible map number when the resource is pinned on the map. If the resource is list-only or cannot be shown on the map, the PDF uses `List only`.

Notes should show whether each note is private or shared when the signed-in owner is exporting their own map. Note timestamps should show the latest update date/time when available. If a created timestamp and updated timestamp are both available and different, both can be shown.

Long addresses and notes must wrap cleanly across pages.

## Permissions And Privacy

The PDF must only use the My Map data already available to the signed-in viewer. It must not make a separate request for hidden private notes.

Rules:

- A map owner sees the notes they are already allowed to see.
- A future shared-map export, if approved later, must use only the shared-map payload and must not expose private notes.
- Hidden private notes, saved profile postal codes, internal access labels, and implementation details must not appear in the PDF.
- The export must not widen note visibility or resource visibility.

This keeps the PDF aligned with the current permission model instead of creating a second permission path.

## Architecture

The implementation should stay isolated around the My Map detail page.

Recommended pieces:

- A small PDF action component added beside the existing map actions.
- A pure PDF ledger data builder that accepts the loaded directory and existing presentation data.
- A focused extension to the existing note normalization helper so note timestamps are preserved when present.
- A PDF generator that is loaded only when the user clicks `Download PDF`.
- A small map-snapshot capture path that reuses existing export/map rendering patterns without changing the current image export behavior.

Use a client-side PDF library for V1, loaded lazily on demand. This keeps the feature one-click, avoids a new server route, and reduces blast radius around authentication and Cloudflare Worker behavior.

The implementation plan can choose the final library, but it should prefer a proven browser PDF table/text library such as `jspdf` with table support. The chosen library must support selectable text, wrapped rows, pagination, and a downloadable file.

## Data Flow

1. The My Map detail page loads the directory through the current API.
2. Existing presentation logic identifies mapped resources, list-only resources, category labels, and map numbers.
3. The PDF ledger data builder creates a deduplicated full-map resource list.
4. The builder groups resources by category and sorts both categories and resources alphabetically.
5. Note items are normalized with text, shared/private status, and timestamps.
6. The map snapshot capture runs separately and is optional.
7. The PDF generator builds the summary page and ledger pages, then triggers the download.

## Error Handling And Performance

- The `Download PDF` action is disabled while a PDF is being prepared.
- PDF generation errors show a short inline message.
- Map snapshot failure does not block the ledger PDF.
- PDF generation libraries are lazy-loaded so normal map navigation is not slowed down.
- Large maps should paginate rather than clipping text.
- Empty maps should still export a valid summary PDF with zero-resource counts.

## Blast Radius

Expected blast radius is low to medium.

Low-risk areas:

- Adding a new button to the My Map detail page.
- Adding pure data-building tests for grouping, sorting, and row content.
- Lazy-loading the PDF generator only when needed.

Medium-risk areas:

- Preserving note timestamps in the existing note normalization helper.
- Adding a new PDF dependency.
- Capturing a small map snapshot.

Mitigations:

- Keep timestamp preservation backward-compatible and do not change existing note display unless required.
- Keep the existing Print, Share, and image export components behaviorally unchanged.
- Do not add a server endpoint or new permission path in V1.
- Add focused tests before implementation changes are considered complete.

## Acceptance Criteria

- A signed-in user can download a `.pdf` from their My Map detail page with one click.
- The PDF includes all map resources, not only the current search/filter view.
- The PDF starts with a summary page and includes a small map snapshot or a clear fallback notice.
- Ledger pages group resources by category alphabetically.
- Resources within each category are sorted alphabetically.
- Each resource includes name, category, address, source map number, notes, and note timestamps when available.
- Text in the PDF is searchable/selectable.
- Private/shared note visibility matches the current signed-in map view.
- Existing Print, Share, image export, map navigation, map notes, and resource cards continue to work.

## Verification Plan

- Add unit tests for the PDF ledger data builder:
  - full-map inclusion
  - category grouping
  - alphabetical sorting
  - source map number versus `List only`
  - note text and timestamps
  - note permission behavior based on the provided payload
- Add a focused component test or source-level test for the new button placement and disabled/error states.
- Verify PDF generation manually in the browser:
  - download starts with one click
  - PDF opens successfully
  - resource names, addresses, notes, and timestamps are searchable/selectable
  - long notes wrap cleanly
  - map snapshot appears or falls back cleanly
- Run `npm run build:client`.
- Run relevant client unit tests.
- Run `git diff --check`.
- Update `docs/regression-ledger.md` after implementation is verified and ready to lock.
