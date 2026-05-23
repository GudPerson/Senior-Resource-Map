# Import Material Refresh Design

## Purpose

CareAround SG's Import Material feature turns uploaded flyers, calendars, posters, and programme schedules into reviewed soft-asset drafts. This works well for first-time imports, but periodic materials create a duplication problem.

When a refreshed flyer contains the same programme with updated dates, times, venue notes, contacts, or registration links, the current flow can create a new programme instead of updating the existing one. The target improvement is a review-first refresh workflow that helps staff update the right records without silently overwriting public information.

## Current Behaviour

The current importer:

- uploads material for one host place;
- extracts draft standalone offerings;
- loads existing offerings linked to the same host place;
- suggests same-host matches using exact or fuzzy name matching;
- lets the user choose create, update, or skip per row;
- defaults extracted rows to create new.

This is safe, but it depends too much on manual attention. If the user accepts the default, repeated programme materials become duplicate soft assets.

## Target Model

Import Material should support two mental modes:

- **New material import**: mostly creates new offerings, while warning about possible duplicates.
- **Refresh existing material**: assumes the upload may replace or update existing offerings for the selected host place.

The system should classify each extracted row before the user saves:

- **Likely update**: high-confidence match to an existing offering at the same host.
- **Possible match**: medium-confidence match that needs manual selection.
- **New offering**: no meaningful existing match.
- **No change**: same offering and same meaningful content already exists.

The user remains in control. The system may preselect an action for high-confidence rows, but saving always happens after explicit review.

## Missing Programme Handling

If the user imports material as a refresh, CareAround should compare the extracted rows against existing offerings for the same host place.

Existing offerings that do not appear in the refreshed material should be shown in a separate review section:

- "Previously listed, not found in this material."

The user should be prompted to choose one action per missing offering:

- **Keep active**: use when the refreshed material is incomplete or the programme is still valid.
- **Hide from discovery**: use when the programme is no longer being offered publicly.
- **Mark as ended**: future-friendly wording for the same lifecycle direction; V1 can store this as hidden plus freshness metadata if no dedicated ended state exists yet.
- **Review later**: leave unchanged but make the uncertainty visible.

CareAround must not delete missing programmes automatically.

## Matching Strategy

Matching should be stronger than name similarity alone. A draft row should be compared with same-host existing offerings using:

- normalized programme name;
- host hard asset;
- bucket and soft sub-category;
- description similarity;
- tag overlap;
- schedule shape and session pattern;
- contact phone or email;
- CTA label or link;
- venue note;
- import source period when available.

Recommended confidence bands:

- `0.85+`: likely update; preselect update.
- `0.60-0.84`: possible match; require manual choice.
- below `0.60`: create new by default.
- exact content match: skip by default.

The exact scoring weights can start simple and be tuned from UAT examples. The first implementation should keep the score explainable, not opaque.

## Data Model Direction

Phase 1 can work mostly with existing tables, but it should add enough import identity to support future refreshes.

Recommended additive fields or tables:

- `soft_asset_import_batches`
  - host hard asset id;
  - uploaded by;
  - source title or file names;
  - source period text, if entered or extracted;
  - import mode: new or refresh;
  - created timestamp;
  - status.
- `soft_asset_import_rows`
  - import batch id;
  - extracted draft payload;
  - matched soft asset id;
  - match score;
  - selected action;
  - result status;
  - source excerpt.

Optional future fields on `soft_assets`:

- `programme_fingerprint`: normalized stable identity, excluding schedule dates.
- `content_fingerprint`: normalized content identity, including schedule and key public fields.
- `last_imported_at`.
- `last_import_batch_id`.

If Phase 1 needs to stay smaller, fingerprints can be computed at runtime first and persisted later.

## Review UX

The review screen should be organised around decisions rather than raw extracted rows.

Suggested sections:

- **Likely updates**: rows that appear to update existing offerings.
- **Needs review**: possible matches or low-confidence extracted rows.
- **New offerings**: no match found.
- **Not found in refreshed material**: existing offerings missing from the upload.
- **No changes**: exact or near-exact duplicate content.

For update rows, show a field-level diff:

- Schedule changed from `Mondays 9am` to `Tuesdays 10am`.
- Contact unchanged.
- Description unchanged.
- Tags added or removed.

Each row should keep the same final action choices:

- update existing;
- create new;
- skip;
- hide or mark ended where relevant.

The summary panel should show counts for create, update, hide/end, skip, and review-needed rows.

## Safety Rules

- No automatic overwrite without a final user save.
- No automatic deletion.
- Hidden or ended actions must be explicit.
- Ownership, asset access, restricted content, audience zones, organisation links, and governance settings stay outside this importer.
- Existing offering visibility should only change when the user chooses hide or mark ended.
- If a row targets an existing offering the user cannot manage, the update option must be blocked.

## Implementation Phases

### Phase 1: Smarter Matching And Diff Review

Improve same-host matching, classify rows, preselect safer actions, and show update diffs. No broad lifecycle change yet.

### Phase 2: Refresh Mode And Missing Programme Review

Add a new-vs-refresh import mode. In refresh mode, show existing offerings not found in the uploaded material and prompt keep active, hide, mark ended, or review later.

### Phase 3: Import Batch Tracking

Persist import batches and row decisions so staff can audit what a material upload changed.

### Phase 4: Programme Lifecycle Refinement

If needed, introduce a first-class ended or superseded state instead of relying on hidden status and freshness metadata.

## Test Plan

Server tests should cover:

- exact same programme with changed schedule becomes a likely update;
- same name at a different host is not matched;
- similar name with different category becomes possible match, not automatic update;
- exact duplicate content is suggested as no change or skip;
- missing existing programmes appear only in refresh mode;
- missing programmes are not hidden unless the reviewed action says hide or mark ended;
- non-manageable existing offerings cannot be updated through import;
- import batch records preserve row decisions when batch tracking is introduced.

Client/UAT should cover:

- first-time import still creates new offerings normally;
- refreshed calendar shows likely updates with field diffs;
- user can change update to create new;
- user can mark a missing programme hidden or keep active;
- saving creates, updates, hides, and skips the intended rows;
- refreshing the page after save does not create duplicates;
- Discover and My Resources reflect the final reviewed state.

## Blast Radius

This feature touches a public-facing data maintenance workflow, so it should be phased. The first patch should focus on the import wizard, collateral import controller, and matching utilities. It should not rewrite soft-asset CRUD, general resource visibility, or AI extraction prompts unless the current payload is missing fields needed for matching.

The highest-risk areas are:

- accidentally overwriting valid programmes;
- hiding programmes too aggressively;
- matching programmes across the wrong host place;
- adding schema without bootstrapping production before deploy.

The safest implementation path is additive, review-first, and covered by focused server tests before UI polish.
