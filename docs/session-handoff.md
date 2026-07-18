# CareAround SG Fresh-Chat Handoff

Last updated: 2026-07-18 (Asia/Singapore)

## Current release state

- Production app: `https://app.carearound.sg`
- Production client bundle: `assets/index-BIVnrRr4.js`
- Production Care Calendar chunk: `assets/CareCalendarPage-OooRjuuN.js`
- Production Resources chunk: `assets/ResourcesPage-2YERLYnQ.js`
- Production My Map owner chunk: `assets/MyMapDetailPage-DqXdd1jh.js`
- Production client CSS: `assets/index-BdQkhKX7.css`
- Validated production Pages deployment:
  `https://b7688e7b.senior-resource-map.pages.dev`
- Production Care Calendar preview:
  `https://5f024c97.senior-resource-map.pages.dev`
- Production API: `https://api.carearound.sg/api/health` returned OK at
  `2026-07-18T08:11:20.401Z`.
- Production Worker version:
  `42507ea8-951f-418a-899b-645e2d163406`.
- Production AI collateral import uses `gemini-3.1-flash-lite`. Signed-in
  production UAT on 2026-07-18 returned 26 review rows from
  `TWV-July-Eng.jpeg` with no Worker error. The post-release request returned
  HTTP 200 in 3.2 seconds, post-deploy smoke passed 6/6, and no production
  resource changes were saved.
- Map asset domain: `https://maps.carearound.sg`
  - Default W01: `/v1/w01`
  - Gray W01: `/v1/w01/gray`

## Repo and worktree state

- Current worktree branch:
  `codex/collateral-import-schedule-first-cut`, based on current pushed
  production `main`. The uncommitted release candidate adds validated
  structured first-cut schedules to collateral extraction, versions and
  revalidates cached extraction output, removes empty schedule placeholders,
  and expands the batch review workspace below the 1536 px breakpoint. Focused
  coverage passed 52/52, full server passed 442/442, full client/source passed
  434/434, the exact production map-enabled client build passed, and
  `git diff --check` passed. It has not been pushed or deployed.
- Production `main` includes Gemini collateral model recovery commit
  `61e90a493`, Care Calendar planning views commit `c7679051f`, schedule
  publish-guard implementation commit `484c14d2d`, the saved-resource
  bounded-hydration recovery, Care Calendar query-budget recovery, Day view,
  and versioned Offering multi-session schedules.
- Gemini model recovery branch: `codex/gemini-3-1-flash-lite-recovery`; it
  aligns the server default and Worker configuration with the supported
  production model after `gemini-2.5-flash-lite` returned HTTP 404 for the new
  Gemini key. Focused AI import tests pass 13/13, the full server suite passes
  439/439, and `git diff --check` passes. Commit `61e90a493` is pushed on the
  branch, merged into pushed `main`, and deployed to Worker
  `42507ea8-951f-418a-899b-645e2d163406`.
- Planning-views branch: `codex/care-calendar-planning-views`; implementation
  commit `c7679051f` is pushed, merged into, and deployed from clean pushed
  `main`.
- Publish-guard branch: `codex/offering-schedule-publish-guard`; implementation
  commit `484c14d2d` is pushed, merged into, and deployed from clean pushed
  `main`.
- Multi-session release branch: `codex/offering-session-schedules`; commit
  `7c411b0f1` is pushed, merged into, and deployed from clean pushed `main`.
- Day-view branch: `codex/care-calendar-day-view`; implementation commit
  `e820f3ec3` is merged into and pushed on `main`.
- Saved-resource permanent-fix branch:
  `codex/saved-resources-permanent-fix`; implementation commit `dcfce3ba3` is
  merged into and pushed on `main`.
- Query-budget recovery branch: `codex/care-calendar-query-budget`; implementation
  commit `5f24231bd` is merged into and pushed on `main`.
- Release branch: `codex/care-calendar-v1`, created from former
  `origin/main` `6a5cc6b36` and retained as the focused implementation line.
- Care Calendar implementation commit: `46f5d3b33`, pushed to
  `origin/codex/care-calendar-v1`.
- The active worktree is `/Users/sweetbuns/CareAroundSG`. Care Calendar V1 is
  deployed to the Worker and production Pages branch, and the release branch
  has been fast-forwarded into and pushed on `main`.
- The explicit production boundary-schema bootstrap completed before the
  Worker deployment. It added only nullable/defaulted structured-schedule
  columns and the two personal calendar tables; it did not seed or rewrite
  Offering schedules or personal calendar rows.
- Existing untracked local artifacts remain local and should not be staged by
  default: `.agents/`, `.superpowers/`,
  `docs/competitor-analysis-2026-06-25.md`,
  `docs/map-stable-baseline-2026-07-12.md`,
  `docs/superpowers/plans/2026-06-26-resource-editor-wizard-conversion.md`,
  `output/calendar-day-view/`, `output/care-calendar-planning-views/`,
  `output/playwright/test-results/`, and
  `output/playwright/wizard-uat-2026-06-26/`, and
  `output/schedule-calendar-audit/`.
- Production recovery used the isolated worktree
  `/Users/sweetbuns/CareAroundSG-map-baseline-recovery` on
  `codex/map-baseline-recovery`.
- Recovery commit: `8cd242ea0`, merging current main `a1544508b` with the
  validated map baseline `eb84067a1` from `codex/shared-map-settings-layout`.
- The shared-settings release source remains available in
  `/Users/sweetbuns/CareAroundSG-shared-map-settings-layout` on
  `codex/shared-map-settings-layout`.
- Original map baseline base: `b9fb904b51c49fdf9068aca21f0b99124077d338`
  (verified persistent Default/Gray production baseline).
- Implementation commits: `e0fbb31a2` (`Unify responsive map settings layout`),
  `430114e9` (`Compact shared map controls`), `4aa119777`
  (`Refine mobile map controls and Back recovery`), and `4f3ea03a5`
  (`Reset mobile My Map entry position`), and `5b31f77ce`
  (`Add accessible desktop My Map resizing`), `a02d14d75`
  (`Lock enabled Detailed map release build`), and `e031e266f`
  (`Add configurable owner print map workspace`), and `68acd838f`
  (`Refine owner print toolbar alignment`).
- Branch pushed to `origin/codex/map-baseline-recovery`.
- Generated `output/playwright/test-results/` and
  `output/playwright/shared-map-settings-layout/` are local UAT evidence and
  must not be staged.

## Care Calendar V1 release

- `/dashboard/calendar` is an authenticated Upcoming-first agenda in the
  existing dashboard shell and is linked from the sidebar and Overview.
- Saved soft activities appear passively only when they are still saved,
  visible to the user, and have an enabled structured schedule.
- The current extension supports up to 250 reviewed session rows per Offering
  in `Asia/Singapore`. Each row is an individual session or weekly series with
  its own optional end, repeat boundary, active/cancelled status, and note.
  The same canonical rows generate both public Schedule copy and Care Calendar
  occurrences; legacy schedule text remains visible until reviewed migration.
- Plan this session records personal intent for one exact current occurrence.
  It is explicitly not a booking and does not change source capacity or
  availability.
- Schedule revisions surface in-app review states for changed, cancelled, and
  removed schedules. Acknowledgement is per user; CareAround never silently
  moves or deletes a personal plan.
- Persisted owner My Map notes expose Add to calendar. The API rechecks note
  ownership before returning context or creating the personal item. Calendar
  items and private note data are not added to Shared Map payloads.
- No email, WhatsApp, SMS, push, external calendar sync, AI schedule parsing,
  per-occurrence exceptions, or booking workflow is active in V1.
- Rollout/design contract:
  `docs/care-calendar-v1-rollout-plan.md`.
- Current validation: full server 437/437, full client/source 427/427, exact
  production map-enabled client build, `git diff --check`, explicit schema
  verification, authenticated local Offering-editor UAT, production API and
  asset checks, and post-deploy production smoke 6/6.
- Initial V1 production served `assets/index-7RjEQA7D.js` with
  `assets/CareCalendarPage-CwW43iXx.js` and retained both required W01 map
  asset-base markers.
- 2026-07-17 query-budget recovery: the Calendar read path now loads only saved
  Offerings and resolves them in one batched asset lookup instead of resolving
  every saved resource individually. It continues to use the same saved-item
  visibility and eligibility rules. Unexpected server details are no longer
  shown to users, and an initial load failure no longer appears together with
  the empty-calendar state. Full server coverage passed 412/412, full
  client/source coverage passed 418/418, the production map-enabled build and
  `git diff --check` passed, all five production smoke flows passed with the
  existing partner-login retry used once, and signed-in 390x844 production UAT
  loaded the Calendar with 17 saved activities without schedules and no error
  or console warning. No schema, auth, ownership, eligibility, visibility,
  Saved Resources, My Map, Shared Map, or notification behavior changed.
- 2026-07-17 Day-view release: Care Calendar now opens on one selected
  Singapore day with previous, next, Today, seven-day navigation, an hourly
  rail, an all-day row, and the existing Saved activity, Planned, private map
  note, and source-review actions. Each read is bounded to one Singapore day
  and stale navigation responses are ignored. Week and Month remain visible
  but disabled for separate ledger-backed phases. Focused coverage passed 8/8,
  full client/source passed 422/422, full server passed 419/419, the exact
  production map-enabled build and `git diff --check` passed, desktop/mobile
  comparison QA passed, and pre- and post-deploy production smoke each passed
  5/5. Signed-in GudPerson production UAT confirmed next-day and Today
  navigation plus the saved-without-schedule list without changing data.
- 2026-07-17 multi-session release: Offering editors now add, duplicate,
  remove, and amend individual or recurring rows in one Schedule editor.
  Collateral and Standalone Offerings workbook imports create reviewable rows;
  a reviewed non-empty import replaces the current published plan, while blank
  or unparsed imports preserve it and workbook clearing requires
  `clearSchedule=TRUE`. Every published change records an immutable version.
  Personal plans remain in place and use the existing Needs review state.
  Stable entry keys distinguish same-time sessions without adding reads to the
  bounded Calendar path. The additive schedule columns, version table, and
  source-entry key were bootstrapped before Worker deployment. Commit
  `7c411b0f1`, Worker `00b9a7df-88fe-41dc-bb5f-f4c49bd5e12a`, Pages
  `https://8a4712f2.senior-resource-map.pages.dev`, and production smoke 6/6
  are the known-good release evidence.
- 2026-07-17 publish-guard and Line Dance recovery: ordinary Offering saves now
  carry an explicit schedule action and expected revision; stale or deprecated
  one-row writes cannot silently remove or overwrite reviewed multi-session
  schedules. Unpublishing requires a warning, weekly starts must match a
  selected repeat weekday, the last repeat date is inclusive in Singapore
  time, and the editor previews the next five generated sessions. The Publish
  sessions thumb is centred within its track. Line Dance asset 168 was restored
  through the guarded API as revision 3 for Monday/Wednesday 10:00-11:30, from
  Monday 20 July through Wednesday 30 September 2026. Signed-in GudPerson
  production UAT reopened the saved activity in Care Calendar on 20 July with
  Needs review; cancelling the unpublish warning left it published. Focused
  coverage passed 26/26, full server passed 437/437, full client/source passed
  427/427, the production-configured client build passed, and post-deploy smoke
  passed 6/6. No personal calendar intent, favorite, or unrelated production
  resource was changed by verification.
- 2026-07-18 planning views release: Care Calendar now separates My Plans,
  Calendar, and Updates. My Plans is the star/bookmark-style personal planning
  list and shows only planned sessions plus private My Map calendar notes.
  Calendar provides live Day, Week, and Month views for saved published
  schedules and private items. Updates groups changed, cancelled, or removed
  planned sessions until the user acknowledges the source revision; acknowledgement
  never moves, removes, or re-stars a replacement session automatically. The
  server adds bounded authenticated `scope=plans` reads so broad My Plans and
  Updates windows expand only Offerings referenced by personal plans. Focused
  client coverage passed 12/12, focused server calendar coverage passed 4/4,
  full server passed 439/439, full client/source passed 431/431, the exact
  production map-enabled client build passed, production smoke passed 6/6,
  signed-in production desktop/mobile visual QA passed, and the production
  API health/custom-domain asset checks passed.
- Current production custom domain serves `assets/index-BIVnrRr4.js` with
  `assets/CareCalendarPage-OooRjuuN.js`,
  `assets/ResourcesPage-2YERLYnQ.js`, and both required W01 map asset-base
  markers.

## Saved Resources permanent recovery

- GudPerson's 43-item mixed saved list crossed the Cloudflare Worker external
  subrequest budget because `/favorites` performed one live relational lookup
  for every saved Place and Offering. The request made 51 database subrequests
  and failed at the platform's 50-request limit.
- The earlier snapshot guard was deployed from a side branch but never merged
  into `main`; the later Calendar Worker release therefore replaced it. The
  permanent implementation is now on `main`, not only in the deployed Worker.
- Mixed Saved Resources now use one favorites lookup, at most one Place batch,
  and at most one Offering batch. Results retain newest-first order, the same
  flat response fields, and existing visibility rules. Missing/inaccessible
  resources remain unavailable snapshots; audience-context and family-batch
  failures fail closed without blanking the whole list.
- Care Calendar remains soft-only while delegating to the canonical batch
  hydrator. Save/remove validation remains strict and unchanged.
- The canonical Worker deploy command now fetches `origin/main` and blocks
  production deployment unless the checkout is clean `main` at the exact
  pushed release commit.
- Validation passed focused coverage 14/14, full server 419/419, full
  client/source 418/418, the production-configured client build,
  `git diff --check`, a read-only 43-row configured-database probe, signed-in
  GudPerson production UAT with all 43 cards, clean Worker-tail evidence, API
  health, and production smoke 5/5. The automatic `main` Pages publish
  `https://0e64c513.senior-resource-map.pages.dev` retained the exact existing
  client JS/CSS and all required Detailed-map/W01 markers; no client code
  changed.

## Locked map behavior

- `Default | Gray` is one persistent device preference across Discover, My
  Maps, Shared Maps, and print map rendering.
- My Maps and Discover now use the same compact upper-right icon-only map
  settings button. Desktop opens an anchored popover; mobile opens the existing
  CareAround bottom sheet. The settings no longer permanently cover the map
  centre.
- My Map reset/recenter remains intentionally conditional: it appears only when
  there is more than one camera target to fit. Mobile settings, reset, zoom,
  zoom-step, and full-map controls now form a compact upper-right rail using a
  30 px visual size and 8 px control-group gaps; desktop controls remain 34 px.
- My Map owners see Map detail plus Map colour. Discover and guest Shared Maps
  show only Map colour. Discover and DirectoryMap mobile zoom controls now sit
  below settings/recenter on the right.
- Mobile automatic camera fits and compact cluster reframing reserve a wider
  right-side safe area so pins do not settle beneath the control rail.
- Interactive map resource links use SPA navigation. Returning with the mobile
  browser/device Back action reuses a user-ID-plus-map-ID-scoped in-memory map
  snapshot while fresh data loads, avoiding the empty loading-card screen.
  Print resource links retain document navigation.
- Mobile owner My Maps start at the map and first card on entry, including
  browser Back from resource detail, instead of restoring the previous
  card-list position. The brief restoration guard is owner-My-Map-only and
  releases normal scrolling after 120 ms.
- Desktop owner My Maps with mapped resources have a centred bottom-edge
  resize handle. Dragging expands the existing map in place up to 78vh/840 px;
  Arrow Up/Down, Home/End, and double-click reset are also supported. The
  adjustment is session-only and absent from mobile, Discover, Shared Maps,
  print, and empty maps. The same Leaflet map instance, zoom, selected card,
  pins, and interaction state remain intact.
- Default uses OneMap `Default_HD`; Gray uses native OneMap `Grey_HD`.
- My Map owner `Standard | Detailed` remains a separate control. Detailed stays
  owner-only and activates automatically at zoom 15.
- Detailed Default uses the accepted colour CCK/W01 fixed surface. Detailed
  Gray uses the accepted native OneMap Grey CCK/W01 fixed surface.
- Owner Print Map is an independent print workspace. It starts from fit all,
  Standard, and 360 px while carrying only the current Default/Gray preference.
  Owners can pan, zoom, choose Standard/Detailed and Default/Gray, and resize
  the print map from 300-720 px. Reset print map restores that safe baseline.
  Save as image and browser Print use the exact controlled preview state.
  Shared Map print and the owner PDF ledger retain their existing behavior.
- The visible owner print toolbar contains only Back to interactive view,
  Reset print map, and Save as image in one left-aligned responsive group. The
  in-app Print button is removed; browser/system printing remains available.
  Map settings is centre-aligned with the zoom rail at desktop and mobile
  widths despite the different responsive control sizes.
- Both W01 manifests preload. Switching colour while Detailed is active loads
  only visible fixed chunks and does not fall through to live OneMap tiles.
- Every production client rebuild must include all four values:
  `VITE_API_URL=https://api.carearound.sg/api`,
  `VITE_TOWN_MAP_PROOF_ENABLED=true`, the Default W01 asset base, and the Gray
  W01 asset base. Omitting the town-map variables intentionally compiles the
  owner Map detail control out of the bundle and is now rollback-only behavior.
- Pins, clustering, card focus, camera, reset, selection, full map, attribution,
  outside-coverage fallback, ranking, filtering, visibility, and resource data
  remain unchanged.
- Discover remounts only its TileLayer when the preference changes. This avoids
  Leaflet's fractional-zoom redraw path without remounting the MapContainer or
  moving the camera.

## Release evidence

- July 15 production recovery: current main deployment `a1544508b` had omitted
  the validated map branch and visibly removed the shared map controls and
  Detailed-map behavior. Recovery merge commit `8cd242ea0` restored the locked
  map baseline onto current main while preserving the newer AI/security files.
- Recovery validation passed focused map coverage 102/102, full client coverage
  411/411, full server coverage 405/405, R2 contract checks 5/5, the exact
  Detailed-enabled production build, and `git diff --check`.
- PWA hardening validation on `codex/pwa-hardening` passed focused PWA
  contract coverage 5/5, full client coverage 416/416, full server coverage
  405/405, the exact Detailed-enabled production build with required map
  environment variables, built-output checks for `pwa/carearound-sw`,
  `offline.html`, `site.webmanifest`, and `_headers`, and `git diff --check`.
  Production Pages deployment `https://5e4e0f2a.senior-resource-map.pages.dev`
  reached `https://app.carearound.sg` as `assets/index-BAhyRlx3.js`.
  `https://app.carearound.sg/pwa/carearound-sw` returned
  `Content-Type: application/javascript`, `Cache-Control: no-cache`, and
  `Service-Worker-Allowed: /`; `/offline` and `/site.webmanifest` returned the
  hardened PWA metadata; production smoke passed all 5 checks, with the postal
  import wizard passing on retry and then passing a targeted rerun. No
  Worker/API, schema, auth, data, map asset, or secret changes were deployed.
- PWA hardening was fast-forwarded into `main` and pushed as `f11124a0f` on
  2026-07-16. The automatic Pages deployment briefly produced
  `assets/index-ofyBC_ES.js` without the required
  `VITE_TOWN_MAP_PROOF_ENABLED` and W01 asset-base build markers, so production
  was immediately redeployed from a local production build with the required
  map environment variables. The corrected deployment
  `https://b4a0b91f.senior-resource-map.pages.dev` restored
  `assets/index-BAhyRlx3.js`, `/pwa/carearound-sw` stayed `no-cache`, and API
  health returned OK through Cloudflare-resolved production IPs. Before the
  next `main` push, update the Cloudflare Pages production build environment
  or keep using the explicit local production deploy command with all map
  variables.
- Post-recovery production smoke passed 5/5 against `https://app.carearound.sg`
  and `https://api.carearound.sg/api`.
- Signed-in production Chrome UAT on owner map 150 confirmed Map appearance
  contains Map detail, Detailed, Map colour, Default, and Gray; zoom 14 showed
  Standard with nine visible live tiles; zoom 15 automatically showed 20 fixed
  W01 chunks, zero visible live tiles, and zero new live OneMap tile requests.
  The map settings button, zoom counter, and desktop resize handle were
  visible. The only console error was an unrelated Chrome-extension
  content-script load failure.
- Focused Print Map/map checks: 44/44 passed.
- Full client: 399/399 passed.
- Full server: 396/396 passed.
- Production-configured `npm run build:client`: passed with only the existing
  large-chunk advisory.
- `git diff --check`: passed.
- Pre-deploy and post-deploy production smoke both passed 5/5 without retry.
- Signed-in production browser UAT at 1440x1000 and 390x844 confirmed 34 px
  desktop controls, 30 px mobile controls, the right-side control rail,
  unchanged map bounds while opening settings and changing colour, 0 px
  end-scroll movement across 20 animation frames, and the intentional
  single-target My Map reset-button absence. Device-style Back from a resource
  detail restored owner map 45 in 16 ms from cache; explicit in-app Back also
  returned to a fully rendered map.
- Production browser UAT recorded zero application console errors. Network
  inspection found only expected OneMap tile request aborts during camera,
  style, viewport, and route changes, Cloudflare RUM cancellation, and the
  pre-existing external OneMap badge SVG Chromium ORB block.
- Screenshots and UAT results are local under
  `output/playwright/shared-map-settings-layout/`.
- Fresh production Pixel 7 UAT forced a 2,156 px My Map scroll, opened a
  resource through SPA navigation, and used browser Back. The map returned at
  scroll 0 with map state `default`, the map visible, and zero console or page
  errors. Post-deploy production smoke passed 5/5.
- Fresh preview and production desktop UAT expanded owner map 45 from 480 px
  to 700 px by drag and to its 780 px viewport cap by keyboard, retained its
  620 px width, the same Leaflet element, marker count, and selected FRCS card,
  and reset to 480 px through Home and double click. The 390x844 mobile view
  showed no resize handle. Both environments recorded zero application console
  or page errors.
- A corrective enabled rebuild restored owner Map detail after the first resize
  deployment omitted the build-time town-map flag. Production map 45 showed
  Standard at zoom 14 and automatic Detailed at zoom 15 with 30 fixed chunks,
  zero visible live tiles, the resize handle present, and zero console/page
  errors. Default and Gray R2 integrity checks and post-correction smoke 5/5
  passed.
- Owner Print Map production UAT on map 45 confirmed identical visible/export
  state for Standard Gray after camera and height changes, plus Detailed
  Default and Detailed Gray. Detailed loaded only the 9/3 visible fixed chunks,
  left zero live map tiles in the map, made zero live OneMap tile requests, and
  downloaded both 5920 px-wide PNGs successfully. Browser print hides the
  print-workspace toolbar, the 390x844 layout has no horizontal overflow, and
  post-deploy smoke passed 5/5. The image library emits one non-fatal CSP notice
  while resolving its data-image placeholder; the files render correctly.
- Print-toolbar production UAT measured a 0 px Map settings/zoom centre delta at
  1440x1000 and 390x844, confirmed the left-aligned Back/Reset/Save group and
  absent Print button, preserved preview/export state, downloaded the image,
  and found no horizontal overflow or page errors. Post-deploy smoke passed 5/5.

## Rollback

- Previous verified client baseline: Pages deployment
  `https://09a5d6d7.senior-resource-map.pages.dev`.
- Previous Worker version:
  `97509c9d-5769-4447-b816-8ddf65de2faf`.
- A rollback can redeploy the previous Worker and Pages versions. The additive
  nullable/defaulted calendar schema may remain dormant; do not drop tables or
  columns during an incident rollback. No R2 map mutation is required.

## Recommended next step

Use one clearly marked internal test Offering for the remaining controlled
production-data UAT: publish one individual row and one weekly row, import a
reviewed replacement, verify the prior version and personal-plan Needs review
state, then complete the explicit unpublish path. Do not reuse Line Dance for
that destructive check. Also add one private My Map note to the calendar and
confirm Shared Map remains unchanged. Do not bulk-enable schedules or activate
external notifications until that small-data UAT is accepted.

## Fresh chat starter

```text
Continue CareAround SG from the active repo only: /Users/sweetbuns/CareAroundSG.

Act as the CareAround SG orchestrator. Read AGENTS.md,
docs/regression-ledger.md, docs/session-handoff.md, and
docs/release-checklist.md, then run git status --short --branch before changing
anything.

Care Calendar planning views are deployed from implementation commit
`c7679051f` on pushed `main`, including My Plans, Calendar Day/Week/Month, and
Updates. Production serves `assets/index-BIVnrRr4.js`,
`assets/CareCalendarPage-OooRjuuN.js`, `assets/ResourcesPage-2YERLYnQ.js`, and
`assets/index-BdQkhKX7.css` from the validated implementation deployment
`https://b7688e7b.senior-resource-map.pages.dev`. The Worker version is
`42507ea8-951f-418a-899b-645e2d163406`.

Gemini collateral import is recovered on `gemini-3.1-flash-lite` from commit
`61e90a493`. Signed-in production preview returned 26 review rows from
`TWV-July-Eng.jpeg`; the post-release request returned HTTP 200 with a clean
Worker tail, production smoke passed 6/6, and no review rows were saved.

Saved Resources permanent recovery commit `dcfce3ba3` is merged and pushed on
`main`. Mixed saved Places/Offerings now use one bounded batch per resource
family with fail-closed snapshot fallbacks. GudPerson production UAT renders
all 43 saved cards, Worker tail is clean, and production smoke passed 5/5. The
canonical Worker deploy is release-line guarded and must run from clean pushed
`main`.

The calendar uses one canonical schedule plan per Offering with up to 250
individual or weekly rows. Those rows generate public schedule copy and Care
Calendar occurrences. Reviewed non-empty imports replace the current plan;
blank or unparsed imports preserve it; immutable versions and personal plans
remain reviewable. My Plans is the bookmark/star-style planning list, not a
booking flow. Calendar shows Day, Week, and Month options for saved schedules
and private notes. Updates is an acknowledgement surface for changed,
cancelled, or removed planned sessions and never automatically moves, deletes,
or re-stars replacement sessions. Persisted owner My Map notes can create
private calendar items. Shared Maps, external notifications, calendar sync, and
per-occurrence exceptions remain out of scope.

Normal editor saves now include an explicit publish/update/unpublish action and
the loaded schedule revision. The Worker uses a compare-and-swap guard, rejects
stale writes, and blocks deprecated one-row updates from overwriting reviewed
multi-session plans. Unpublish requires confirmation. Weekly starts must match
one selected weekday, the repeat boundary is inclusive Singapore time, and the
editor previews the next five generated sessions. Line Dance asset 168 is
restored as revision 3 for Monday/Wednesday 10:00-11:30 from 20 July through
30 September 2026; GudPerson Care Calendar production UAT confirmed the saved
20 July occurrence and Needs review state.

The additive production schema bootstrap is complete. The query-budget
recovery batches saved Offering resolution without changing visibility rules.
Full server coverage passed 439/439, full client/source coverage passed
431/431, focused planning views coverage passed, the exact map-enabled client
build passed, the additive schema is verified, production API health and asset
checks passed, signed-in production desktop/mobile Calendar QA passed, and all
six production smoke flows passed without creating a production Offering or
Calendar item.

Keep the locked map baseline intact. Every production build must include
`VITE_API_URL`, `VITE_TOWN_MAP_PROOF_ENABLED=true`, and both Default and Gray
W01 asset-base URLs. The current production bundle contains both W01 markers.

Unrelated untracked files remain local. Do not stage, delete, or rewrite them.

Recommended next gate: use one clearly labelled internal test Offering and a
standard test account to exercise individual and weekly rows, reviewed import
replacement, personal-plan review, the completed explicit unpublish path, and
private-note-to-calendar behavior. Do not use Line Dance for the destructive
test. Confirm Shared Maps remain unchanged. Do not bulk-enable schedules or
activate external delivery.
```
