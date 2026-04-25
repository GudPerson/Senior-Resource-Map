# Regression Ledger

Use this file as the source of truth during stabilization work.

Rules:
- Audit and recovery happen only on the clean stabilization branch/worktree.
- Source of truth for disputes:
  1. known-good deployed preview or production behavior
  2. matching commit SHA
  3. screenshot + user confirmation
- Every touched surface must record:
  - current behavior
  - known-good reference
  - reproduction steps
  - acceptance criteria
  - verification result before deploy

## Known-good reference seeds

Use these as starting points where applicable:

| Area | Reference | Notes |
| --- | --- | --- |
| Private map print header/layout | `865461f4` | Earlier stable print header alignment |
| Private map print/screen preview composition | `940cc182` | Larger print board + interactive preview baseline |
| Private map hover logo reveal | `d526fb41` | Hover logo reveal introduced |
| Private map nested logo URLs | `0a7219f7` | Logo data availability |
| Private map cluster/selection UX | `efc03d82` | Cluster selection polish reference |
| Discover stable contract | Screenshot `2026-04-23 9.06.20 AM` | Later approved Discover UI/feature baseline |

## Locked stabilization surfaces

These surfaces are approved on the stabilization branch and should not be reopened unless a new regression is found:

- My Directory saved assets
- Private Maps interactive
- Private Maps print/export
- Shared maps
- Dashboard resources
- Dashboard admin resources
- Discover

## Audit matrix

| Surface | Current state | Known-good reference | Reproduction steps | Acceptance criteria | Last checked |
| --- | --- | --- | --- | --- | --- |
| Discover | Recovered and locked on stabilization branch | Screenshot `2026-04-23 9.06.20 AM` + user verification | Load `/discover`, test refresh consistency, search, scope, radius, saved pins, rail collapse/resize independence, map reset/anchor behavior | Counts stable across refreshes; no random reloads/radius changes; later approved UI preserved; rail resize and summary collapse independent | 2026-04-24 |
| My Directory saved assets | Recovered and locked on stabilization branch | User-approved stabilization branch behavior | Load `/my-directory`, test search, scope, select-all, remove-selected | Saved cards render, filters work, bulk actions stable | 2026-04-22 |
| Private Maps interactive | Recovered and locked on stabilization branch | `efc03d82`, related private-map commits | Create/open `/my-directory/maps/:id`, test hover, cluster click, selection | Hover linking, cluster zoom/spiderfy, card↔pin sync stable | 2026-04-22 |
| Private Maps print/export | Recovered and locked on stabilization branch; print card links and map interactivity retested locally; hidden export surface moved off-screen after it was found overlapping live map hit-testing; print header copy wraps without truncating | `865461f4`, `940cc182` + user-approved stabilization layout pass | Open `?view=print`, test layout, grouped asset detail links, pin/cluster hover, top-edge pin hover, cluster click zoom/spiderfy, map reset, Save as image, header title/description wrapping, distance-anchor note placement, and `elementFromPoint` on visible marker centers | Wide layout, QR present, map name is not truncated, description wraps before QR area, distance anchor note sits just above map, grouped print entries navigate to detail pages, hover highlights matching card(s) with orange ring, top-edge pins remain responsive, cluster click expands, reset restores full map, export clone does not intercept marker hit-testing, capture succeeds, print preview matches approved baseline | 2026-04-25 |
| Shared maps | Recovered and locked on stabilization branch | User-approved stabilization branch behavior | Open shared directory as guest/logged-in user, test copy/save flows | Shared view loads, copy/save behavior correct | 2026-04-22 |
| Dashboard resources/admin | Recovered and locked on stabilization branch; punctuation-normalized resource search retested locally | User-approved stabilization branch behavior | Load `/dashboard/resources` and `/dashboard/admin`, test search, counts, export | Search stable, counts consistent, filtered workbook export works, admin search does not reload on every letter, names with parentheses remain searchable | 2026-04-25 |
| Workbook import/export | Recovered and locked on stabilization branch; local full/filtered exports and import reports revalidated | Local verification artifacts in `output/workbook-local-2026-04-25T05-42-07-819Z` | Run places export/import, standalone offering import, template import, rollout import, filtered workbook flows, error-report flows; re-open exported `.xlsx` files with `openpyxl` | No timeout/subrequest regressions; reports accurate; filtered/full export formats round-trip safely; `.xlsx` files include `Guide`, `Data`, and `Reference` sheets | 2026-04-25 |
| Asset create/edit forms | Recovered and locked on stabilization branch; place create, inline place edit, offering create/edit, template create/edit, and rollout edit checked locally | Local browser verification on `/dashboard/resources` with current `server/.env` API | Open place/offering/template forms and edit existing assets | No blank screens; hard-place inline edit renders expected fields; modal create/edit flows render expected fields; rollout editor opens inherited/local sections | 2026-04-25 |
| AI enrichment | Partially recovered; local no-config fallback is fixed and live Vertex/Google enrichment returns descriptions + service tags, but logo suggestions were not observed in credentialed probes | Live Worker API `https://senior-resource-map-api.joshuachua79.workers.dev/api` with configured `VERTEX_AI_*` and `GOOGLE_MAPS_API_KEY` secrets | Fill a place draft name, postal code, and address; call `/hard-assets/import/enrich-draft`; call `/hard-assets/import/google-candidates` with `enrich: true`; preview selected Google candidates | Button enables only with required draft fields; unconfigured/empty enrichment response gives visible feedback instead of silently doing nothing; live Vertex returns grounded descriptions, service tags, source titles, and confidence; logo URL enrichment remains incomplete | 2026-04-26 |

## Current recovery order

1. Discover
2. My Directory + Private Maps
3. Dashboard resources/admin
4. Workbook import/export
5. Asset create/edit forms
6. AI enrichment and secondary polish

Completed and locked:
- Discover
- My Directory + Private Maps
- Dashboard resources/admin
- Workbook import/export
- Asset create/edit forms

Active next recovery family:
- AI logo enrichment follow-up

## Recovery workflow

For each regression family:

1. Reproduce it on the stabilization branch.
2. Identify the last known-good deploy, commit, or approved screenshot for that exact behavior.
3. Restore only that behavior, not adjacent feature work.
4. Add or update an automated/manual verification check.
5. Update this ledger with result and evidence before deploy.

## Deploy gate

Do not deploy a stabilization fix unless:
- `npm run test:server` is green
- `npm run build:client` is green
- `npm run test:smoke` is green for the touched flow set
- the relevant ledger row(s) above have been updated
