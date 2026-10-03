# Personal-place spreadsheet import

Date: 3 October 2026 (Asia/Singapore)
Status: implemented and locally verified on 4 October 2026; authorised production release in preparation.

## Requested outcome

An authenticated non-guest map owner can upload a CSV or Excel spreadsheet,
review its rows, then create private Personal places and add them to the current
My Map. The owner can reuse those places from My Places on other owned maps.

The user selected CSV or Excel, then explicitly authorised implementation,
commit, push and deployment when complete. Production test imports and schema
migrations are outside this release.

The user refined the scope on 3 October: the file contains only mandatory
Name and Postal Code, plus optional Short Description. Address is looked up
from the postal code and can be edited in preview to include unit numbers or
other location details. Category defaults to **Personal place** and can be
changed in preview before confirmation. This replaces the earlier seven-column
template and coordinate-only import option.

## Baseline and implementation gate

The active root is `/Users/sweetbuns/CareAroundSG`, on
`codex/documentation-refresh-20260905`, with substantial unrelated changes.
The handoff records released source
`0c771828102e3ce8bbf06fabb25590df92c63a21`; that commit exists locally.
Freshly fetched `origin/main` was verified at that release before creating the
isolated feature worktree.

Source comparison confirms that the released personal-place editor and server
include addressed/map-only location checks absent from this checkout. The
released My Map page also contains later mobile, pin, and export changes.
Do not replace those files wholesale or build this older checkout as the
current released app.

The user approved the isolated implementation in
`/Users/sweetbuns/.codex/worktrees/personal-place-import/CareAroundSG`,
branch `codex/personal-place-import-20261003`, based on the released source.
The original dirty runtime checkout is preserved. Check remote main again
before pushing the validated release.

## User flow

1. Open an owned My Map, select **Add personal place**, then **Import spreadsheet**.
2. Download the CSV template, or select a `.csv`, `.xlsx`, or `.xls` file.
   For a workbook, select the sheet explicitly if more than one contains data.
3. Parse the three-column file locally. Look up each distinct six-digit postal
   code and populate its address and pin coordinates. Default every row's
   category to **Personal place**.
4. Review row numbers, names, postal codes, descriptions, addresses, categories,
   validation errors, and existing-place matches. Allow editing each row's
   address, for example to add a unit number, and selecting another existing
   active Personal place category. Preserve these edits during category-list
   refreshes, repeat lookup of the same postal code, and retry.
5. Correct the file or explicitly exclude invalid/conflicting rows. Show how
   many rows will create places, reuse places, or require no action.
6. Confirm the reviewed selection. Report completed and failed batches
   separately, then refresh My Places and authoritative map membership.
   Keep uncertain results available for reconciliation and retry.

Cancel before confirmation creates no places or map links. Imported places
remain private; shared links and embeds do not include them. Owner exports
continue to use the existing Personal place behaviour.

## Template and validation

Template: `docs/templates/personal-places-import.csv` (headers only).

| Column | Rule |
| --- | --- |
| Name | Required; maximum 160 characters. |
| Postal Code | Required; exactly six digits, stored as text; must resolve to the same postal code. |
| Short Description | Optional; maximum 240 characters. |

Name and Postal Code headers and row values are mandatory. The Short Description
column may be omitted or its cells left blank. Address, category, and coordinates
are not file columns. Reject unexpected columns with a clear instruction to
use the three-column template rather than silently importing extra fields.

All imported rows use the existing addressed-place contract. Unresolved or
ambiguous postal codes remain blocked until corrected or explicitly excluded.
There is no coordinate-only or list-only import option in this phase.

Preview-only fields:

| Field | Behaviour |
| --- | --- |
| Address | Auto-populated by exact postal lookup, then editable per row for unit numbers or other details; nonempty, maximum 500 characters; reviewed text is preserved on save. |
| Category | Defaults to Personal place; owner can choose another existing active category per row before confirming. |
| Pin location | Derived from the verified postal lookup; not an editable import field. |

Editing address details must not move the pin or bypass postal verification.
Store the reviewed display address, including added unit details, while using
the server-verified postal code and coordinates. Do not replace the owner's
reviewed address with the lookup's base address when saving or retrying.
If the postal code changes, invalidate the old lookup/location and require a
new lookup and address review; do not carry unit details to another building.

Use the verified existing generic Personal place fallback: default to
`categoryId: null` with no category label. The owner directory already presents
this as **Personal place**. Do not globally change starter-category seeding or
pick the first unrelated category. Category changes
apply to the selected imported row and do not edit a category or an existing
library place. Only the owner's active categories can be selected.
Do not import images, arbitrary extra fields, formulas, managed-resource IDs,
or another user's place/category IDs in this phase.

Use the installed Papa Parse and SheetJS libraries in a dedicated utility.
Validate CSV parser errors, duplicate/ambiguous headers, scalar cell values,
formula cells, postal text, field lengths, file size, sheet size, and row
limits. Preserve text postal codes and formatted leading zeros; do not silently
invent missing digits. Implemented limits: 2 MB per file, 500 data rows,
and 25 reviewed rows per server batch. Workbook bounds are validated before
conversion so offset or oversized sheets cannot be silently truncated.

## Narrow architecture and blast radius

- Add an isolated import modal and parser; add a callback to the existing
  Personal place chooser. Connect all three owner My Map rendering branches.
- Keep the manual editor's existing workflow and category manager. Assess only
  a targeted address-preservation safeguard for later ordinary edits.
- Add a dedicated owner-map import route/controller. Never route these rows
  through the managed-resource workbook importer or public resource APIs.
- Reuse authenticated non-guest, map-owner, and category-owner checks. Reuse
  the released location resolver. Recheck permissions and row validity server-side.
- Verify postal code and coordinates server-side while preserving the reviewed
  address text. The released `personalPlaceLocation.js:61-66` currently replaces
  submitted address text with the lookup result, so calling it unchanged would
  discard unit/details. The importer must retain the reviewed display address
  separately from the verified location result.
- Add a narrowly reviewed lifecycle safeguard so later ordinary name,
  description, or category edits preserve imported address details when the
  postal code is unchanged. Inspect the editor and both update controllers
  before choosing the exact seam. A changed postal code must trigger fresh
  verification and address review. Keep verified postal/coordinate checks
  intact; do not make an unrelated global location refactor.
- Preserve an existing place's explicit `categoryId: null` when opening its
  editor instead of assigning the first starter category. Preserve a stored
  Short Description when an ordinary update omits that field; an explicitly
  submitted empty description may still clear it. The released editor/update
  paths currently expose both data-loss risks for the requested imported fields.
  Cover these targeted safeguards without changing new manual-create defaults.
- Use a generic Personal place default without changing categories elsewhere;
  validate any category chosen in preview as active and owned by the caller.
- Resolve each distinct postal code before writes with bounded requests. Reject
  the batch without writes if validation or lookup fails.
- Use the existing fail-closed atomic transaction facility for place creation
  and map linking within each batch; do not loop over the current sequential
  create-then-attach endpoint. Fail closed if atomic support is unavailable.
- Serialise imports per owner and recheck content matches inside the transaction.
  Reuse exact owner-library matches and existing links. Report conflicting
  descriptions/categories or ambiguous matches instead of changing a reusable
  place. Review serial-ID allocation in the atomic helper before implementation.
- Include the reviewed address in content matching. The same name and postal
  code alone are insufficient to merge rows with different unit details.
- Reconcile authoritative library/map state after each successful or uncertain
  request. A failed refresh must not report the import as fully complete.

The schema-free first phase provides content-based reuse and bounded batch
rollback. It does not promise durable import-operation receipts, global place
uniqueness against simultaneous manual saves, or one transaction for the whole
file. If testing shows those guarantees are needed, stop and propose an additive
schema design for explicit approval; do not improvise storage in existing fields.

Primary risks: partial completion across batches, duplicate creation after an
uncertain request, accidental overwrites of reusable places, and weakening the
released postal-verification contract. The isolated endpoint, transaction
boundary, content review, and reconciliation address these risks while keeping
public/Shared Map behaviour unchanged.

## Source and regression anchors

Source spans below refer to released commit `0c771828` unless marked otherwise.

- `client/src/components/personalPlaces/AddPersonalPlaceChooserModal.jsx:72`
  (unchanged from active HEAD): import entry alongside existing actions.
- `client/src/pages/MyMapDetailPage.jsx:3006-3190`: owner place/picker handlers;
  chooser mounts at lines 3995, 4204, and 4558.
- `client/src/components/personalPlaces/PersonalPlaceEditorModal.jsx:107-200`:
  coordinate requirements, location mode, exact-postal verification, and save payload.
- `server/src/utils/personalPlaceLocation.js:15-68`: authoritative location checks.
- `server/src/controllers/personalPlacesController.js:67-79,548-573`:
  place schema and verified create/update.
- `server/src/utils/atomicWrites.js:48-84`: atomic batch and serial allocation.
- `server/src/db/schema.js:1160-1192`: existing library and map-link tables.
- `docs/regression-ledger.md:4492`: library reuse, owner isolation, detach/delete,
  category presentation, and exclusion from Shared Maps and managed imports.
- `docs/regression-ledger.md:3387`: manual creation and editor draft preservation.

## Acceptance and verification

Parser tests cover the exact three-column schema, the optional description
column, CSV/Excel parity, postal leading zeros, malformed CSV, duplicate or
unexpected headers, formulas, missing names/postal codes, and size limits.
Server tests cover guest/non-owner denial, exact-postal lookup failure/mismatch,
preservation of edited address/unit details during import and later ordinary
edits, retained explicit generic category, retained omitted Short Description,
verified pin location, generic
Personal place defaults, owned active category selection,
zero writes on invalid rows, atomic rollback, repeat/concurrent import requests,
reuse across maps, conflicts, and exclusion from shared snapshots.

Disposable local browser checks cover upload, sheet selection, preview,
postal lookup review, per-row address/unit and category changes, edit preservation,
cancellation, retry after uncertain results, and refreshed
membership at desktop and 390 px. Exercise all three owner page branches and
retain manual create/edit, detach, reusable-place attach, category styling,
Print View, and Shared Map privacy checks.

Run `npm run test:server`, affected client checks, `npm run build:client`,
`npm run verify:map-lockdown`, and `git diff --check`. Use mocked/synthetic
lookup explicitly where applicable; do not claim live-geocoding or production
acceptance from it. Update the regression ledger and session handoff after
verified implementation. The user authorised the release; apply the release
checklist and guarded clean-main Worker/Pages release scripts.

## Work completed for this request

Implemented an isolated parser and preview modal, a dedicated owner-map import
endpoint and narrow ordinary-edit safeguards. The import serialises per owner,
rechecks content inside its transaction, and atomically creates or reuses places
and links each batch. Content matching includes reviewed address, canonical
description, category and verified coordinates. Conflicts never overwrite
existing library entries.

The client refreshes both the owner library and canonical map membership after
each request. Uncertain results cannot be presented as complete, and confirmed
rows are excluded from retries. All three owner map branches expose the importer.
Manual create defaults are retained; later edits preserve imported unit details,
generic category and an omitted description.

Local gate evidence and proof limits are in
`docs/evidence/personal-place-import-local-20261004.json`. User instructions
are in `docs/personal-place-import.md`. The final local production receipt
will record the actual source revision, deployment IDs and public artifact
verification after release. No schema, credentials, AI budget or map assets
are changed.
