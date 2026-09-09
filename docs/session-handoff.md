# CareAround SG session handoff

Updated: 2026-09-09 (Asia/Singapore)

## Start here

- Repository: `/Users/sweetbuns/CareAroundSG`
- Production app: `https://app.carearound.sg`
- Production API: `https://api.carearound.sg/api`
- Release platform: Cloudflare Pages for the client and Cloudflare Worker for the API.
- Production database: Neon PostgreSQL. Never print the connection value or run a migration without the exact environment, migration IDs, backup/restore evidence, and explicit approval.
- Read `AGENTS.md`, `docs/regression-ledger.md`, and `docs/release-checklist.md` before changing a locked surface.

## 2026-09-09 Discovery category map-layer rollback — release candidate

- Continue in the clean release checkout
  `/Users/sweetbuns/CareAroundSG-worktrees/guide-inbox-release-20260907`, branch
  `codex/rollback-discovery-map-layer-20260909`, based on production main
  `c35169e2`. Preserve the unrelated dirty primary checkout.
- The user's desktop/tablet Chrome sessions still suffer a paint failure when
  the saved-category map-layer panel is opened or hovered. Read-only inspection
  confirms the blank-looking controls and panel remain mounted, opaque, laid
  out, and hit-testable while Detailed W04 is fully ready. The user explicitly
  requested rollback to the stable version before the filter moved onto the
  map.
- The staged rollback restores client source, tests, and design QA exactly to
  `c34a5560`, the parent of the map-layer implementation. Category checkboxes
  return to the Discovery search panel; the map-layer button/icon/helper and
  every follow-on implementation that existed solely to support that overlay
  are removed. Backend, data, authentication, My Map, Shared/embed/Print,
  Help/Inbox, and the established map detail/zoom contracts remain out of scope.
- Focused category-filter coverage passed `7/7`; quality passed eight
  migrations, `479` modules / `1,416` import edges, server `729/729`, client
  `793/793`, four environment checks, and the exact `2,485`-module production
  build. Map lockdown passed `104/104` plus its configured build. Isolated
  responsive UAT passed 12 category open/select/hover/reset cycles on both
  desktop and tablet plus three phone filter-sheet cycles, with a solid white
  filter, no map-layer button, stable desktop/tablet controls, fully loaded
  Detailed overview surfaces, no errors, and no horizontal overflow.
- Deploy only the client through the guarded release path and verify immutable
  and custom-domain artifact parity plus core routes. Leave physical-device
  confirmation open until the user retests the rollback in production.

## 2026-09-09 Discovery viewport/header and dropdown stacking — production release approved

- Continue in `/Users/sweetbuns/CareAroundSG-worktrees/guide-inbox-release-20260907`,
  branch `codex/discovery-controls-viewport-20260909`, based on `31f614dd`.
  The primary checkout remains unrelated dirty work; preserve it. Graft was
  queried against this release checkout. No repository instructions or Graft
  configuration changed.
- Real Chrome inspection confirmed that the `4rem` height offset becomes
  `38.4px` at reduced text scale while the navbar stays `65px`, allowing
  `26.5px` scrolling that hides top controls beneath the header. A temporary
  page-only correction visibly restored them. A separate stacking mismatch
  let zoom/reset overlap the category/settings dropdown. The permanent patch
  uses `100dvh` minus the fixed `57/65px` navbar height, scroll-preserving focus,
  and a dock above Leaflet controls. No map/data/backend behavior changed.
- Quality passed server `729/729`, client `801/801`, four environment checks,
  eight migration checks, `481` modules / `1,421` edges, map lockdown `104/104`,
  and the exact production client build. Twelve combinations of four layouts
  and three accessible text scales passed overflow, control hit-testing,
  white panel, focus restoration, and half-step zoom checks with zero page
  errors. These browser checks use fictional authentication/favorites only.
- The user explicitly chose production release followed by their own tablet
  test after being told that the preview cannot access Detailed map images.
  Proceed with PR #71 (`f8dc95bd` implementation) through the guarded clean-main
  client release and artifact verification; do not change preview CORS, map
  assets, Worker, or database configuration. Record the immutable publication
  and custom-domain verification in the PR's release evidence. The tablet
  transparent panel has not reproduced in isolated browsers; the proven Mac
  clipping/stacking correction does not alone close that report. Ask the user
  to refresh the live app and alternate All saved pins / Chinese Temple after
  publication. Do not repeat the Chrome permission setup:
  it is enabled; target the regular Chrome process rather than Playwright's
  same-named Chrome instances. Do not refresh the user's diagnostic tab while
  their temporary trial is in progress.

## 2026-09-09 Discovery supplied PNG and stationary controls — implementation evidence

- Continue from the clean release checkout
  `/Users/sweetbuns/CareAroundSG-worktrees/guide-inbox-release-20260907`, branch
  `codex/discovery-control-stability-png-20260909`, based on `9083e7e2`.
  The primary checkout has unrelated work and must remain untouched.
- The original layer PNG is now used directly, softened to gray and slightly
  inset per the user's follow-up. All Discovery map controls share a stationary
  overlay above the animated raster canvas at every breakpoint. The overview
  top alignment also handles fractional tablet fits below `12`, including the
  reported `11.7`; approved minimum zooms and detailed-map tiers are unchanged.
- Focused `14/14`, server `729/729`, final client `799/799` plus four environment
  checks, map lockdown `104/104`, migration/module checks, and both configured
  builds passed. The exact production-build browser replay passed `1,596` frame
  samples across desktop, touch landscape/portrait tablet, and phone. Controls
  remained stationary/hit-testable; raw `11.7` had no top gap or overflow;
  half-step buttons, category focus return, the empty state, and fully loaded
  Gray Detailed with zero live tiles passed. See the ledger for blast radius.
- User approval includes commit, push, and deploy after verification. Release
  only through `npm run deploy:client` from clean, current `main`, then verify
  immutable/custom-domain bytes and MIME types, the PNG, map roots, and core
  Help/Inbox routes. This entry records pre-publication evidence: read the live
  `/release.json` for current deployment provenance rather than assuming that
  this source note alone proves publication. No Worker/Neon/data release is needed.
- The original flicker has not reproduced in the initial desktop replay;
  physical Android-tablet confirmation remains required even after automated
  cross-layout checks. Credentialed partner smoke remains unclaimed. The next
  step after publication is to replay the small-category case on that tablet.

## 2026-09-09 Discovery saved-pin layer icon alignment — released

- Discovery's saved-pin layer glyph now nearly fills its existing map-control
  button with a two-pixel buffer: `30 x 30` inside the `34 x 34` desktop
  control and `26 x 26` inside the `30 x 30` compact control. Its wrapper is
  vertically centred so the category and Map settings buttons share the same
  top, height, centre, and eight-pixel gap. Saved-category behavior and every
  other map control remain unchanged.
- Validation passed focused `12/12`, locked-map `104/104` plus its map build,
  and the complete quality gate: eight migrations, `481` modules / `1,421`
  relative-import edges, server `729/729`, client `797/797`, four production
  environment checks, and the exact `2487`-module client build. Separate-browser
  visual QA passed desktop/mobile placement, popover/sheet interaction, Escape
  focus return, zero mobile overflow, and zero visual-flow console errors.
- Implementation `b31c8f14` merged through PR #67 as `6c72b4b4`. Required
  GitHub quality and Cloudflare preview checks passed; legacy Netlify failures
  were excluded under the Cloudflare-only release policy. The guarded Pages
  release uploaded `87` served files plus Functions and `_routes.json` to
  `https://c79434c0.senior-resource-map.pages.dev`. All local, immutable, and
  custom-domain files match by bytes, MIME type, and SHA-256 with aggregate
  `124b533a2b3f84efaf77b7c1fab7d811a81d421266c4c43cb9edab7cbd8ed52b`.
  The initial controlled manifest reports clean `git-build` provenance at
  `6c72b4b4`, HTML hash
  `94b77a653007e06586a34246532963a87bbd8036e86a3862e16c1a066324d0e4`,
  and entry bundle `assets/index-57Ylkb3P.js`. A subsequent documentation-only
  `main` merge triggered Cloudflare's automatic Pages publication at
  `https://75b98ca3.senior-resource-map.pages.dev`; its immutable URL and the
  custom domain still serve that same HTML and entry-asset hashes. Later
  documentation-only publications can advance the manifest's source revision
  without changing the functional artifact, which remains identified by PR
  #67, merge `6c72b4b4`, and these hashes.
- Production QA reproduced the approved desktop/mobile measurements with
  fictional saved pins, kept `3,481` public results, and passed the category
  panel, Help/Inbox routing, verified safe-unsave Guide answer, real Havelock
  search, API health, framing headers, and guest private-route denial.
  Credentialed partner smoke remains unclaimed because its credentials are not
  configured. No Worker, Neon, schema, migration, authentication, secret, or
  production-data change occurred.

## 2026-09-09 Discovery saved-pin category map layer — released

- Discovery's category filter now lives in a dedicated pin-layer control beside
  Map settings. It filters only the user's saved, mappable pins and leaves the
  public result cards, counts, order, and bulk-save candidates unchanged.
  Available choices come only from categories represented by saved pins on the
  current map. No selection shows all saved pins; multiple selections use union
  semantics; and an account with no saved map pins sees
  `No saved pins to filter yet.`
- `View on map` safely clears an active category layer before focusing a saved
  resource that would otherwise be hidden. Desktop uses a popover and mobile a
  bottom sheet; Escape closes either layout and restores focus to its trigger.
- Validation passed focused `19/19`, full client `797/797` plus four production
  checks, map lockdown `104/104`, the production client build, and the complete
  `npm run verify:quality` gate. Fictional-auth browser QA passed saved-category
  counts and union/reset behavior at `1920x1080` and `390x844`, kept the public
  result count at `3,481`, showed the empty state, and found no overlap or
  horizontal overflow.
- Implementation `b310dd5c` merged through PR #65 as `722497e2`. Required
  GitHub quality and Cloudflare preview checks passed; legacy Netlify failures
  were excluded under the repository's Cloudflare release policy. The guarded
  client release uploaded `87` served files plus the Functions bundle and
  `_routes.json` to `https://5b3b6912.senior-resource-map.pages.dev`. All served
  files matched the exact local build, immutable deployment, and
  `https://app.carearound.sg` by bytes, MIME type, and SHA-256; aggregate SHA-256
  is `54c5b24cab48be50b50d24a4bf8b1261b053a8484c1135b55d624c6d630cc2fd`.
  Production browser verification passed the same desktop/mobile layer behavior,
  API health, anti-framing headers, and guest private-route denial. Credentialed
  partner smoke remains unclaimed because this checkout has no configured smoke
  username or password. No Worker, Neon, schema, migration, auth, secret, or
  production-data change occurred.

## 2026-09-09 Discovery category visibility and minimum-overview alignment — released

- Discovery now has a shared desktop/mobile multi-category checkbox filter.
  No selection means all categories; one or more selections narrow result
  cards, counts, search-scoped bulk-save candidates, and saved-resource map
  pins while preserving existing order. Category selection alone does not
  expose the bulk-save action.
- At the wide `11.5` minimum, the first visible OneMap overview row is aligned
  to the top of the map viewport, removing the prior gray band above the map
  without changing the approved zoom floor, responsive fit, or map tiers.
- Validation passed focused `19/19`, server `729/729`, client `793/793` plus
  four production checks, map lockdown `104/104`, migration ownership, module
  graph `479` / `1,416`, the exact production build, and separate-browser UAT
  at `390`, `1440`, and `1920` widths. TCM narrowed to `68`, a second category
  used union semantics, All categories restored `3,481`, and the `11.5` map
  top gap was within one rendered pixel locally.
- Implementation `fdc57b1c` merged through PR #63 as `2ca20e20`. Guarded Pages
  deployment `30390f33-125e-4a95-93aa-e404091be8f9` serves
  `https://30390f33.senior-resource-map.pages.dev`; all `87` served files match
  the exact local build and `https://app.carearound.sg` by bytes and SHA-256,
  with aggregate
  `50cdf45d934bffbc7c2b31d48855f2dc724fbb301c7e17b3f1ac6f8be93493ec`.
  Production UAT passed category filtering and reset on desktop/mobile, native
  Detailed at zoom `16`, zero-gap top alignment at the wide `11.5` stop, Help,
  `/inbox`, Guide, Havelock search, API health, framing headers, and guest
  private-route denial. Authenticated saved-pin UAT is not claimed. No Worker,
  Neon, schema, migration, auth, secret, or production-data change occurred.

## 2026-09-08 Discovery overview spacing adjustment — released

- Wide Discovery maps now stop at `11.5` instead of `12`, giving the Singapore
  overview one additional half-step of margin while retaining the same centred,
  pan-locked minimum camera. The initial view remains `12`; fresh responsive
  `830x656` maps retain their calculated `10.5` minimum.
- This is a one-constant Discovery-only adjustment. Detailed/Standard behavior,
  loading feedback, exact Detailed tiers, My Map, Shared/embed/print, results,
  markers, saved state, API, auth, schema, privacy, and data are unchanged.
- Validation passed focused `6/6`, full client `788/788` plus four environment
  checks, the production client build, and map lockdown `104/104` plus its map
  build. Isolated fictional browser UAT passed wide `11.5` with disabled
  zoom-out and fresh responsive `10.5`; expected private favourites calls were
  `401` because no production cookie was used.
- Release: implementation commit `27bc38fe` merged through PR #61 as
  `67531936`. The guarded Pages release uploaded 87 files, the Functions bundle,
  and `_routes.json` to `https://e41af953.senior-resource-map.pages.dev`.
  Immutable/custom-domain manifest, shell, entry-asset byte/MIME/hash parity,
  production wide `11.5` and responsive `10.5` browser checks, security headers,
  and API health all passed. No Worker release was required.

## 2026-09-08 Discovery camera, source controls, and half-step zoom — released

- Discovery now stops wide maps at the locked Singapore overview camera at
  zoom `12`; smaller maps compute a responsive `10-12` minimum from the same
  bounds. Panning is disabled at the minimum and restored above it.
- Discovery adds Standard/Detailed beside Default/Gray and shows a non-blocking
  loading bar while detailed coverage is prepared. Live OneMap stays visible
  while manifests resolve, and the map remains interactive as chunks complete.
  Exact tier boundaries remain `<14` live, `14-15.9` overview, and `16+` native.
- Discovery and owner-interactive My Map opt into `0.5` zoom buttons. Shared
  Map, embed, owner/shared Print, export capture, and every default
  `DirectoryMap` caller retain whole-step controls; My Map retains its existing
  exact `15+` native threshold.
- Pre-release gates passed server `729/729`, client `788/788` plus four
  production-environment checks, map lockdown `104/104`, `478` modules / `1,415`
  edges with no cycles, and the exact configured build. Separate fictional
  browser UAT passed the centred zoom-`12` stop, disabled zoom-out, Standard
  fallback, `15.5` overview, `16` native, and live-map continuity while the
  manifest resolved. Guide knowledge is `2026-09-08.2`. `verify:release` passed
  its complete quality portion, but its credentialed smoke command could not
  start because this checkout lacks both the local Playwright package and smoke
  credentials. Authenticated owner My Map UAT is not claimed.
- PR #59 merged functional source
  `c46c53b738de12c00647aaa4b3faa8b0dfa90540`. The coordinated release is Worker
  version `c8297ac2-a84f-4240-8ebe-ecc4c00e36b8` and Pages deployment
  `e7a12f86-3a40-4826-9c44-575faa8b8f2f` at
  `https://e7a12f86.senior-resource-map.pages.dev`. All `87/87` client files
  and MIME types matched the local build, immutable deployment, and custom
  domain; aggregate SHA-256 is
  `8bcabb19aaea96a4744f56c0efd907d7ff991b2facb82e0f77f3a7fb7cebb2fe`.
  Production checks passed API health, Guide `2026-09-08.2`, Help/Inbox, the
  responsive `10.5` minimum, wide `12` stop, Standard/live switch, `15.5`
  overview, and `16` native detail. Fictional-auth private requests correctly
  returned `401`; no authenticated mutation or owner My Map UAT is claimed.

## 2026-09-08 Discover zoom-15 overview stability — released

- PR #56 made displayed zoom `14-15` use the continuous `SG14` overview in
  Discover and reserved native block-number detail for `16+`; it also updated
  the Guide to knowledge version `2026-09-08.1`. PR #57 closed the transition
  race by updating the Discover viewport immediately on Leaflet's `zoom` event.
  Final functional source is clean `65fb6a477e8b9005eae1fe920fbb7a94ecb5457b`.
  My Map, owner Print, Detailed embeds, public shared views, map assets, data,
  auth, API contracts, schema, and migrations were unchanged.
- Final gates passed `729/729` server tests, `784/784` client tests, `4/4`
  production-environment checks, `104/104` map-lockdown tests, both production
  builds, `192/192` pre-release trackpad samples, and a `52/52` bidirectional
  raw-zoom matrix. Guarded production release created Pages deployment
  `32bf4615-3778-4f19-bd04-0245f59b38ce` at
  `https://32bf4615.senior-resource-map.pages.dev` and Worker version
  `ac44270b-b75d-40fd-95e2-86dd0b6f4ae4`, both reporting the final source.
  All `87/87` client files matched the local build, immutable deployment, and
  custom domain; aggregate SHA-256 is
  `028d56e86a4d89544f2b5a8dd667968baeed4100a3c0bcad7fc1f66c1e76cb0d`.
- Unshimmed production UAT passed controlled `15.5 -> 15.4` crossings in
  Default `10/10` and Gray `10/10`, with native detail removed `0.5-1.6 ms`
  after the counter and before the first paint every time. It found no
  fixed/live overlap, blank painted frame, or manifest churn. The settled
  matrix passed Default `26/26` and Gray `26/26`: displayed `15` was always
  overview `SG14`, and displayed `16` was always native `C03`. Nearby and
  outside-coverage panning, recovery, reset, desktop resize, and the unobscured
  `390x844` mobile map passed. API health, public security probes, Guide
  wording/version, real `Havelock` search, and guest Help/Inbox passed with zero
  console errors or warnings. Authenticated smoke remains explicitly unclaimed
  because its approved credentials are not configured in this checkout.

## 2026-09-08 Help and notification inbox client recovery — released

- This supersedes the older Guide/inbox section below for current release
  status. The regressed Pages deployment
  `c53cb48f-042b-438f-abd9-0136eaee560b` served the adaptive-workspace client
  source but was built without
  `VITE_SUPPORT_INBOX_ENABLED=true`, so Help, inbox, Updates, notifications,
  and saved-search UI entry points were compiled out. The Worker/API and
  existing data remain intact.
- The released correction pins the support flag in every production-style client
  build, makes the environment validator fail on omission, locks the Help and
  inbox route/navbar contract, and replaces the ordinary Pages upload command
  with a clean-`main`/fresh-`origin/main` guarded build and exact-source deploy.
  PR #54 merged it to `main` at
  `9137703f71b28d42f4697ed6403d80f6c5cbb072`, preserving the current
  adaptive-resource workspace and all map contracts.
- Pre-deploy verification passed: focused `53/53`, server `729/729`, client
  `783/783` plus four environment-validator tests, module graph `477` / `1,407`,
  exact production client build, map lockdown `103/103`, and a local browser
  journey covering Help, `/inbox`, bulk-unsave guidance, and real Havelock
  search.
- The guarded production release created Pages deployment
  `46f5f7a8-ba5c-450c-9c1f-b5f71137d95d` at
  `https://46f5f7a8.senior-resource-map.pages.dev`. All `87/87` assets matched
  the immutable deployment and `https://app.carearound.sg` by bytes, with
  aggregate SHA-256
  `e134002aa8e2377287eec5b274bbe1c5b393a969b10d60ac098a3d8686481ce8`.
  Production guest checks confirmed the Guide, `/inbox` redirect, Updates-style
  inbox URL, real resource search, and Discover with `3,481` resources work with
  no browser console warnings or errors. Public Guide topics returned `200`,
  guest-private inbox/preferences/saved-search endpoints returned `401`, and
  ordinary app routes retained deny-framing headers.
  Authenticated inbox, notification-preference, and saved-search flows were not
  reverified and are not claimed as production UAT. No Worker was deployed and
  no production data, migration, schema, auth, secret, or external-notification
  configuration was changed.

## 2026-09-07 Region, Subregion, and Unmapped boundary layers — released

- PR 51 merged the three-layer feature at `1e638569e`; PR 52 merged the
  production Subregion label/code compatibility guard at `274e4e257`.
  Migration `0007_boundary_layers` is recorded on verified Neon production.
- A fresh never-expiring 73.04 MB Neon snapshot preceded migration. The first
  workbook dry run made zero writes because live metadata unexpectedly contained
  only `Singapore / SIN`. Exact rows 101–186 were recovered read-only from the
  13:35 production history; a compressed copy of the prior 122,936 fallback
  mappings was captured; one guarded transaction restored rows 101–185 and
  replaced routing with the approved corrected workbook.
- Production now has 24 Regions, 121,022 mapped postcodes, 85 Region/Subregion
  links, 85 operational Subregions, 1,908 Unmapped postcodes, and 86 metadata
  rows including the empty SIN fallback. There are zero source errors and zero
  mapped/Unmapped overlaps. Postal code `545610` resolves to Hougang / Hougang-3.
- Worker `12acd892-d0bb-44fe-b08d-817acca94e2b` serves feature source
  `1e638569e`. Pages `https://962e0a48.senior-resource-map.pages.dev` serves
  `274e4e257`; all 87 files match the custom domain, aggregate SHA-256
  `87c2dea39e196883f8d7450473f6a83b49f2757acede93ade01fb20abafd26eb`.
  Required quality/Cloudflare checks, 726 server tests, 779 client tests,
  production API/UI reconciliation, and production smoke 6/6 passed. See
  [release evidence](evidence/boundary-layer-production-release-20260907.json).

## 2026-09-07 Guide, inbox, and notifications — active local goal

- Latest approval: the user answered "yes you may, approve" to the exact
  adoption-ledger and `0003`–`0006` production request. Continue the complete
  scoped release; do not ask for that approval again. The [approved execution
  record](guide-inbox-production-adoption-20260907.md) and [readiness evidence](evidence/guide-inbox-production-readiness-20260907.json)
  supersede the older pending-approval notes. A one-statement DDL batch now
  passes on real PostgreSQL 17. Live branch `br-green-union-ailxs0g3`, database
  `neondb` and runtime role `neondb_owner` were independently verified through
  temporary private-map API probes; all probes removed, observation locks gone.
  Current main `f95afee68` is preserved by local merge `50bad4da8`. Quality:
  721 server / 772 client, static checks and feature-enabled exact client build.
  Fresh-login automated smoke remains unavailable; existing-session checks are
  recorded separately. Next: refreshed recovery point, approved migration,
  clean-source Worker/Pages release and actual deployed feature verification.
- Historical approval checkpoint: the latest final then asked whether to adopt the tested upgrade
  record and apply exact `0003`–`0006` to Neon production after the remaining
  release gates. Automatic goal continuation is not that approval. A follow-up
  safe check passed: two independent sessions on the empty rehearsal branch
  proved advisory-lock exclusion, FK lock timeout under a simulated writer,
  explicit rollback, successful retry and zero remaining probe objects/locks.
  See [the lock evidence](evidence/guide-inbox-neon-locks-20260907.json).
  FK DDL holds `ShareRowExclusiveLock` on `users`, so an eventual approved
  executor must minimize lock hold time and avoid per-statement browser
  round trips. Do not treat the existing console rehearsal as that executor.
  No runtime/migration source, production data/schema, push or deployment
  changed. The temporary second browser tab was closed after cleanup.
- Latest verified checkpoint: [real Neon rehearsal and recovery](guide-inbox-neon-rehearsal-20260907.md)
  passed on PostgreSQL 17.11. Exact `0003`–`0006` committed on the schema-only
  branch; 60 existing table fingerprints unchanged, ten new tables matched,
  all 47 invalid-state checks and synthetic relationship checks passed. All
  synthetic rows rolled back; 70 public tables empty. Full server 720/720 and
  static checks pass. Runtime source and migrations remain at `33455920`.
  Created a fresh 72.5 MB manual snapshot at 03:00:42 UTC; multi-step restored
  it to `br-fragrant-bread-aibgpawc`. Read-only schema and all six core counts
  matched production. That temporary restored copy was deleted, production and
  the snapshot remain, and no connection/settings migration occurred. The
  schema-only test branch retains its one-day expiry. The scoped checkpoint
  contains evidence/docs/test helpers only; use Git history for its final
  identity. No push or deployment occurred.
  Remaining: explicit adoption-ledger governance decision, independent runtime
  database identity/role, lock/concurrency evidence, authenticated smoke and
  clean-source Worker/Pages release. Older permission-pending and unverified
  PostgreSQL/recovery notes below are historical.
- Release-continuation authorization: user said "proceed with whatever is
  required to complete goal" after the local rehearsal handoff. Continue the
  scoped feature through required rehearsal and release gates; do not treat
  earlier permission-pending notes as current. No destructive production repair,
  secret replacement, unrelated fixes or connection cutover is implied.
  Created a schema-only Neon rehearsal branch from production:
  `carearound-guide-inbox-rehearsal-20260907`, `br-autumn-mode-aikak52t`, project
  `silent-queen-04984362`; auto-expiry September 8, 2026 10:31 Singapore.
  Connection-details dialog was closed without reading credentials. Production
  is still unchanged. Verify branch identity before every SQL action. The
  branch is temporary; preserve it until evidence is recorded or clean up only
  this exact branch after the rehearsal. Current local actual-controller checks
  on the captured schema pass 36/36 for Guide/resource detail, publication to
  Calendar/inbox, resource notifications and saved searches. Rehearsal in Neon,
  final release approval gates and deployed verification remain unfinished.
- Latest checkpoint: user approved and we completed the [local-only adoption
  plan/rehearsal](guide-inbox-migration-adoption-plan-20260907.md). In-memory
  production-shaped PostgreSQL matches the captured 60-table/604-column/195-
  constraint/207-index schema, then applies only `0003`–`0006`, preserving
  existing definitions and all synthetic row digests. Failure/retry and all
  27 CHECKs/13 FKs/seven unique-index checks passed; 17 focused / 719 full server
  tests and static checks pass. Two new test-only files and evidence/docs are
  uncommitted; app source, migrations, runtime bootstrap, dependencies and
  instructions are unchanged. The proposed separate ledger records observation
  versus execution honestly, but is not an approved production executor. Next:
  review the proposal and separately authorize a PostgreSQL 17 rehearsal target
  with role/privacy/branch boundaries. No production mutation, push or deployment.
  The older preflight/approval checkpoints below are historical.
- Current checkpoint: [Neon preflight](neon-read-only-preflight-20260907.md)
  completed read-only on project `silent-queen-04984362`, production branch
  `br-green-union-ailxs0g3`, database `neondb`. The user's Chrome permission
  resolved access; do not repeat the obsolete request for a console screenshot.
  All 60 existing tables are present, ten feature tables absent, and no migration
  journal exists. Substantive drift includes two CASCADE/SET NULL differences,
  six stricter NOT NULL columns, extra constraints/indexes, legacy enums and
  missing normalized login indexes. Naming and PG17/PG18 catalog differences
  were separated from actual enforcement differences. Daily snapshots/14-day
  retention and the September 7 02:00 Singapore snapshot are verified; point-in-time
  history is six hours. No restore was performed. Next: reviewed local-only
  migration-adoption plan/rehearsal preserving production behavior; no live repair.
  Candidate remains local commit `33455920`; this checkpoint adds uncommitted
  evidence/docs only. Earlier access/commit-status notes below are historical.
- Latest approval: scoped local commit of the reviewed candidate and read-only
  production preflight only. No push, migration or deployment is authorized.
  Implementation fingerprint is unchanged. Cloudflare confirms live Pages main
  `13f50a6c9`, Worker `8567e09a-73aa-48d7-8a4d-76540d967525`, healthy API,
  absent support rollout flags and no Cron Triggers. Pages main auto-deploy is on.
  Neon access is unavailable here: schema/journal alignment and current backup
  evidence remain unverified. Continue with credential-safe database preflight;
  do not read secrets or treat the older August 29 rehearsal as a fresh backup.
  See the release candidate for exact evidence. Earlier uncommitted status and
  approval requests below are historical and superseded by this checkpoint.
- Continue the complete sequence in [the implementation plan](guide-inbox-notifications-plan.md):
  Guide/search/private support first, Calendar/saved-resource notifications
  second, then optional saved-search alerts. Do not mark the goal complete at
  the support milestone or treat this as a released feature.
- Feature branch: `codex/guide-inbox-notifications-20260907`, worktree
  `/Users/sweetbuns/CareAroundSG-worktrees/guide-inbox-notifications-20260907`, based
  on `origin/main` `13f50a6c9`. The primary checkout remains dirty on its separate
  documentation branch and must not be overwritten or deployed.
- The support API, additive migration, Guide/search routes, responsive help hub,
  guest report recovery, private inbox, staff replies, and human approval controls
  are implemented locally. Tests and fixture browser evidence are recorded in
  the plan and ledger. Optional owner-only Guide question history and an explicit
  question-to-report draft handoff are now implemented with additive migration
  `0004_guide_history`. History is saved only after review/consent, not on every
  chat turn; old resource result payloads are never stored. Server 669/669,
  client 757/757, five-migration validation, feature-enabled client build,
  map-lockdown with configured build, Worker dry run and binding type generation pass.
  Release evidence now checks client entry-file hashes and the executing Worker's
  compiled revision/platform version; 42 focused checks prove failure writes no fix
  event and successful retry creates one. Existing release-line and Detailed-build
  guards are retained. Dirty builds cannot claim a verified source revision.
  Actual-controller search/detail tests pass 5/5 using test-only local PostgreSQL
  transport, without changing application database wiring. Browser checks opened
  both resource detail pages and continued to Discover with the search query intact.
  Discover fixture cache/location-indicator 404s are documented, not full map UAT.
  This Phase 1 checkpoint is superseded by the notification checkpoint below for
  current test counts. No production DB was used for tests.
- Phase 2 core is now implemented: category consent under the existing Profile
  master switch, strict batched current-source lookup, durable leased/cursor scans,
  grouped notifications, read/unread/dismiss/mute/unmute, and the Updates inbox UI.
  Ordered migration `0005_notification_updates` adds three tables and seven
  enforced checks; it was applied only to disposable PostgreSQL. The Worker now
  declares a minute trigger, but no scheduled deployment has occurred and its
  disabled handler performs no DB work. Calendar plans/acknowledgements and all
  map rendering remain untouched. Current server **683/683**, client **760/760**,
  six-migration/static checks, feature-enabled exact client build, map-lockdown,
  Worker dry run/types and disabled scheduled runtime checks pass. Notification
  browser flows and 320 px privacy/layout proof are recorded in the plan.
- Phase 3 saved-search subscriptions now work locally: reviewed opt-in from Guide
  or inbox, ten-search limit, stable public-search scans, no-flood baselines,
  grouped digests/current-results links, read/dismiss, edit/pause/resume/delete,
  Profile consent and private-account isolation. Migration `0006_saved_search_alerts`
  adds three tables and nine checks; only disposable data was migrated. Epochs and
  distinct digest identities reject old worker results and stale read actions.
  Current **695 server / 761 client** tests, seven-migration/static validation,
  exact feature-enabled client build and Worker dry run pass. Browser flows and
  320 px screenshots are in the plan. Public controller edits are limited to a
  server-only stable scan cursor; normal ordering/visibility remain unchanged.
- Phase 2 provider-to-Calendar end-to-end checks now pass locally. The normal
  Offering wizard updates and cancels a real canonical schedule in disposable
  PostgreSQL; one private inbox notice appears, reading it leaves Calendar review
  pending, acknowledgement leaves the original plan unchanged, and cancellation,
  visibility withdrawal, category opt-out and account separation are verified.
  The actual-controller test exposed a second-publication history-key collision;
  `updateSoftAsset` now preserves existing revision rows with a targeted conflict
  clause. Concurrent saves retain one winner and reject the stale editor.
  **702 server / 761 client**, static checks, exact feature-enabled client build,
  map-lockdown/configured build and seven new journey checks pass. The Worker
  dry run has now been refreshed after this correction (see the checkpoint below).
- Phase 1 lifecycle/accessibility now passes locally: exact-version approval,
  mismatch rejection, one verified fixture release message, reporter resolve/reopen
  with history, guest opt-in and no-storage recovery, explicit recovery while
  signed in, other-account and User View separation. Support-only focus repairs
  preserve keyboard position through preview/edit/submit, conversation/back,
  staff decisions/errors, guest recovery and Guide/search responses. Late aborted
  proposal reads are ignored. **702 server / 765 client**, eight focused support
  client checks, seven-migration/static validation, feature-enabled exact client
  build and map-lockdown/configured build pass. Wrangler 4.129.0 dry run passes
  at 3311.79 KiB (gzip 665.57 KiB). Current browser proof uses desktop/320 px,
  actual resource detail navigation and synthetic support reports. Final browser
  console has no errors/warnings; deliberate release-mismatch 409s were verified.
- Shared cross-surface behavior/privacy checks now pass on disposable data:
  owner map-use filters and bulk protection (including list-only Offering),
  cancelled/confirmed removal, Calendar warning and personal-plan retention,
  Discover 13/14/15+ and Gray tier round trips, frozen shared membership, and
  exclusion of private support/map/personal-place content. Actual mobile embed
  made only its credential-free API request and fit 320 px. Actual Pages framing
  headers accepted the approved probe parent, blocked the unapproved one and
  failed closed after disablement. The probe uses a labelled static document;
  actual app rendering was verified separately.
- **Next: review the completed adoption proposal and production-version rehearsal target in the [local release candidate](guide-inbox-notifications-release-candidate.md).**
  It records the 80-file implementation fingerprint, exact four migration hashes,
  complete local evidence and separate commit/preflight/release approvals.
  The goal remains active; no production-ready or deployed claim is made.
  Shared Map emitted nested-anchor diagnostics and measured 336 px at a 320 px
  viewport in unchanged source. These are explicit review observations, not a
  clean UI pass or a mandate to rewrite stable map code. Authenticated release
  smoke and production migration alignment remain pending.
- The browser fixture is synthetic and was deliberately restarted to add real
  map/cache/sharing/personal-place read handlers. An invalid null-coordinate Place
  seed was corrected to a list-only Offering without altering schema rules.
  Last observed services: fixture 8791 and feature-enabled Vite 5179 with all ten
  map roots through the local proxy. The separate framing probe on 5180–5182 was
  stopped after its completed checks; launch it explicitly if needed.
  Confirm actual process liveness before reuse; do not infer it from this note.
  A closed browser session was confirmed terminal and reopened; current actual
  embed console is clean. No production database was used.
- `SUPPORT_INBOX_ENABLED` and `VITE_SUPPORT_INBOX_ENABLED` are explicit rollout
  flags and remain off by default. No production migration, commit, push, Pages
  deploy, or Worker deploy occurred. Do not reuse the earlier map-fix release
  approval for this new schema-bearing feature.
- Dependency restoration changed already-tracked `node_modules` files. Exclude
  those generated changes from reviews/staging; do not stage the entire tree.
  The intentional dependency change is only dev-time PGlite plus its lock entry
  for disposable PostgreSQL integration tests. Existing production dependencies
  and authentication configuration were not changed.

## 2026-09-06 My Directory map-safe bulk unsave

- Released app code: `main` and `codex/my-directory-safe-bulk-unsave` at `0d9f439f0`; implementation commit `b31615668`; runtime import-collision fix `0d9f439f0`. Work was isolated in `/Users/sweetbuns/CareAroundSG-worktrees/my-directory-safe-bulk-unsave`.
- Saved Resources now supports `All`, `Used in My Maps`, and `Not used in My Maps` filters plus a dedicated multi-select removal mode.
- Bulk removal fails closed when map-usage status is unavailable, excludes resources used in any owner My Map in both the client and API, and rechecks usage immediately before deletion. Individual removal remains available after an explicit consequence warning.
- Removal confirmations now state that an Offering can lose its saved schedule source from Care Calendar. Map-used resources are labelled and protected from bulk removal.
- New authenticated API routes are `GET /api/favorites/map-usage` and `POST /api/favorites/bulk-remove-unused`; there is no schema or migration change.
- Automated verification: client `740/740`, server `613/613`, map-lockdown `91/91`, migration validation, 426-module/1,270-edge no-cycle checks, the standard and exact six-root client builds, and the Worker dry run passed. GitHub quality runs `34030743537` and `34031383022` passed.
- Production Worker version `8567e09a-73aa-48d7-8a4d-76540d967525` is live; API health returned 200 and both new routes returned 401 without authentication.
- The final exact Pages artifact is `https://792ab20d.senior-resource-map.pages.dev`. All 85 static files matched the local build and `https://app.carearound.sg` with aggregate SHA-256 `606f1d026278d898cd6b69475fab28915056b58443b9f36dfa1d4cb5499a880d`.
- The first Pages smoke exposed a My Directory runtime collision between the map icon import and JavaScript's `Map`; `0d9f439f0` aliases the icon and adds a regression assertion. The corrected production smoke passed 6/6.
- Non-mutating Chrome UAT passed at desktop and 390x844: all three map-use filters, usage counts/badges, used-resource bulk protection, unused select-all, and both individual/bulk Care Calendar warnings were verified. Both confirmations were cancelled, so no saved resource was removed.
- The primary checkout `/Users/sweetbuns/CareAroundSG` was returned to its original branch and its unrelated dirty/untracked work was not staged or altered.

## 2026-09-06 Discover Detailed source recovery

The memory-safe Discover Detailed basemap release was validated and deployed from the isolated
worktree `/Users/sweetbuns/CareAroundSG-discover-detailed` on branch
`codex/discover-detailed-basemap-20260906`. Implementation commit
`3f2051e262eb0065b62c631512a0c75f55c2397d` is pushed. Its Pages
deployment `527eca93-f3ee-4597-8507-63b6fbd42ab0` remains available at
`https://527eca93.senior-resource-map.pages.dev`.
The deploy was client-only; no Worker/API, schema, authentication, migration,
or production-data change was required or performed.

Discover keeps `DiscoveryMap` and automatically uses live OneMap through
displayed zoom `13`, the `SG14` overview at `14`, and native town imagery at
`15+` in Default and Gray. The standard `256 MiB` decoded-memory ceiling,
full-viewport containment, fixed-surface retention/pruning, and fail-closed
coverage/loading/memory fallbacks remain authoritative. The production build
uses the corrected immutable asset namespace
`v5/discover-derivative-v1-80-20260906-r2`; all 9,770 public objects and
2,234,361,836 bytes passed full byte-count and SHA-256 verification. The first
namespace without `-r2` failed the strengthened index manifest-byte check and
is intentionally unreferenced; it was never used by a deployed client and was
not overwritten or deleted.

All `85` served static files matched the exact local artifact, immutable Pages
deployment, and custom domain. Automated release evidence passed static graph
validation (430 modules / 1,274 edges), server `611/611`, client `745/745`,
map-lockdown `103/103`, town-map tooling `16/16`, focused derivative/parser
coverage `38/38`, the unchanged six-root My Map/embed build, and the exact
four-root derivative build. Authenticated production Chrome passed the
Default/Gray zoom round trip, search, reset, filters, saved-only, transient and
postal context, boundary panning, live/fixed exclusivity, and existing My Map
rendering. Clean production `390x844` mobile rendering loaded `4/4` native
chunks with zero live tiles and returned to Browse without a body interaction
lock. Credentialed aggregate smoke variables were unavailable; the targeted
authenticated checks, clean responsive check, route/API checks, complete
automated gates, and exact artifact parity are the recorded release proof.

The earlier Pages artifact
`https://7aa26941.senior-resource-map.pages.dev` at implementation
`776cdd2e2426b1e6edef49ff102644500ea31c75` is the immediate client rollback
reference. The later bulk-unsave Pages release was built from `main`, which did
not yet contain this branch, and therefore replaced the detailed Discovery
client. The recovery branch merges the validated detailed-map history forward
onto the bulk-unsave release so both behaviors remain present. It also locks
the dashboard-facing client workspace `build` script plus the root
`build:client`, `build:cloudflare`, and `deploy:client` commands to the exact
validated derivative build, preventing a future routine Pages release from
compiling the adapter out.
The core recovery is at `ff122f45a` and the final client-workspace build guard
is `5bbacc9d1`, both pushed to `main` and the recovery branch. GitHub quality
runs `34034035843` and `34034656745` passed. The exact combined artifact is
production deployment `135da0fc-9ebc-495e-9680-cc90308e265e` at
`https://135da0fc.senior-resource-map.pages.dev`; all `85` static files matched
the local build and custom domain, with sorted local file-hash manifest
SHA-256 `199aa13552864dc9b7d644e3aeb759a109a120f5140605f2ee9934d6f6d10fe1`.
Fresh production Chrome passed the `16 -> 15 -> 14 -> 13 -> 14 -> 15` tier
round trip in Default, native Gray at `15`, and live/fixed exclusivity with zero
console errors or warnings. The API Worker was not redeployed.
Cloudflare's subsequent Git build from `5bbacc9d1` produced production
deployment `0749a6a3-988d-4c01-b7b9-f33751cd3f91`; its bundle contains all
four derivative roots, and fresh custom-domain Chrome loaded `16/16` native
Default chunks with zero live tiles at zoom `15` and no console errors. Future
Git deployments therefore retain Detailed without a manual republish.

## Protected workspace state

The primary checkout is intentionally dirty on `codex/offering-filtered-export-parity`. It contains unrelated user/agent work, including the filtered-export feature and local guardrail/tooling files. Do not stage, reset, merge, clean, or release from that checkout.

The Category Pin Discovery-parity release was prepared in the isolated worktree
`/private/tmp/carearound-mobile-map-studio-drawer-20260903` on branch
`codex/category-pin-discovery-parity-20260905`. It reuses Discovery's pin
builders and same-postal chooser across owner My Map, Shared Map, and embedded
maps; centre counts mean Places and small badges mean guest-visible
Programmes/Services/Promotions. The Worker-side directory snapshot now carries
the existing guest-visible offering count per Place. Existing frozen embed
snapshots must be republished to receive that new derived count. Local release
gates passed: client `732/732`, server `611/611`, locked owner-map gate `74/74`,
static graph `424` modules / `1,266` edges with no cycle, clean diff whitespace,
the exact six-root production build, and Chrome desktop plus `390x844` embed
interaction QA. Implementation `2216d3c3` merged through PR `#49` to `main` at
`9d4f74f09`; both supported GitHub quality gates passed. Production Worker
version `eb5d3c46-bbff-468e-a4a4-f64fff416c91` and exact Pages deployment
`https://b4097b10.senior-resource-map.pages.dev` are live. All `85` static files
match the local artifact, immutable deployment, and `https://app.carearound.sg`
with aggregate SHA-256
`8e78dccf64ddf03ca1ab055b5879752128e0aa33e2fe60c765189556a3fe0c18`;
production route, API-health, embed-header, six-root map marker, and public
embed Chrome checks passed. The primary dirty checkout remains untouched.

The Phase 1 closeout was prepared in the isolated worktree:

- path: `/Users/sweetbuns/CareAroundSG-gudauth-contract-regression`
- branch: `codex/gudauth-contract-regression`
- base: production GudAuth recovery on `main` at `44d426d38`
- existing contract commit: `9fdc296a8 test: lock GudAuth create-to-poll contract`

The closeout release is now on `main`:

- release evidence commit: `f5d7db465 chore: close Phase 1 stabilisation evidence`
- GitHub quality gate: passed, run `33143696960`
- Cloudflare Pages production deployment: `https://55f0288b.senior-resource-map.pages.dev`
- custom-domain parity: `https://app.carearound.sg` and the Pages deployment both served `assets/index-C7PWBBaG.js` with SHA-256 `28dc428f0af30a030bb40bf316cced80c070552e9b44bca117b4f73119498d35`
- post-deployment production smoke: 6/6 passed; zero smoke-map fixtures remained
- Worker/API deploy: not required and not performed

The first dependency remediation batch is released:

- path: `/Users/sweetbuns/CareAroundSG-dependency-patch`
- branch: `codex/dependency-patch-web-api-20260828`
- base: released `main` at `b264dd3cf`
- source scope: `client/package.json`, `server/package.json`, `package-lock.json`, and closeout/handoff evidence only
- updated packages: Hono 4.12.34, Hono Node adapter 1.19.17, React Router 7.18.2, Vite 7.3.6, PostCSS 8.5.26, and Nano ID 3.3.18
- Drizzle ORM/Kit, schema, migrations, database configuration, application source, and production data: unchanged
- local verification: migration validator passed; 415 modules / 1,232 relative imports with no cycle; server 594/594; client 700/700; standard and production-configured Detailed-map builds passed
- fresh audit: 0 critical, 2 high, 5 moderate, 1 low; all remaining findings are outside this batch
- pull request and release commit: PR 43, merged to `main` at `37b4b792b`
- GitHub quality gates: passed on the pull request (`33148675184`) and post-merge `main` (`33148740622`)
- Worker deployment: version `f287a000-5d17-4a48-b945-db1b655a3f0c`, after the clean synchronized-main release guard passed
- Pages deployment: `https://8c879035.senior-resource-map.pages.dev`
- custom-domain parity: all 82 static files matched; entry `assets/index-Bnvtvecv.js`, SHA-256 `e307ffb30fd6e6192550b69e56ded8a1ab1708d00de056f5fd81e08310095864`
- production verification: API health and `/discover` returned 200/OK; credentialed smoke passed 6/6 with temporary-map cleanup
- legacy Netlify preview checks failed but are not part of CareAround's supported Cloudflare release path

The separate PDF/export dependency batch is released:

- path: `/Users/sweetbuns/CareAroundSG-pdf-export-dependency`
- branch: `codex/dependency-patch-pdf-export-20260828`
- base: released `main` at `65c95b134`
- source scope: `package-lock.json` and dependency/regression/handoff evidence only
- dependency change: jsPDF-compatible optional DOMPurify 3.4.8 -> 3.4.14; jsPDF remains 4.2.1 and jsPDF AutoTable remains 5.0.8
- package manifests, application source, Drizzle ORM/Kit, schema, migrations, database configuration, runtime settings, secrets, and production data: unchanged
- fresh audit: 0 critical, 2 high, 4 moderate, 1 low; no PDF/export finding remains
- focused verification: PDF/PNG/Print View and map export 89/89; locked map-export gate 90/90
- full local verification: migration validator; 415 modules / 1,232 relative imports with no cycle; server 594/594; client 700/700; standard and exact production-configured six-root builds passed
- rendered runtime verification: a two-page A3 jsPDF document passed landscape/portrait visual inspection with no clipping, overlap, broken content, embedded JavaScript, or encryption
- pull request and release commit: PR 44, merged to `main` at `608e79c655`
- GitHub quality gates: passed on the pull request (`33155357558`) and post-merge `main` (`33155425036`); the supported Cloudflare Pages preview check also passed
- Pages deployment: `https://cdd609b0.senior-resource-map.pages.dev`
- custom-domain parity: all 82 static files matched the local artifact, immutable deployment, and `https://app.carearound.sg`; aggregate SHA-256 `c3065b275deb7e30514ab7072ef8a5c989b5b94714ea621e12b1c31c5402d2e4`
- production verification: app root and `/discover` returned 200; API health returned OK; all six map roots and locked export markers passed
- authenticated production Export View UAT: reached ready state and downloaded a valid 7,280,650-byte one-page A3 PDF; rendered visual inspection passed; SHA-256 `9e416c4279f9dded3b14620cd02289392be6158812887b63da5777d54eb7b1f3`
- credential-based aggregate production smoke: not rerun because credentials were absent from this shell; targeted authenticated export UAT passed and the same-day prior 6/6 production smoke remains the latest aggregate result
- Worker/API deployment: not required and not performed

Ignore untracked `graft/` indexes and generated Playwright output when reviewing release source. Stage only explicitly named task files.

## Stable production behaviour

- The user confirmed WhatsApp sign-in in production opens WhatsApp, returns to the original browser tab, and completes as intended after `44d426d38`.
- Production smoke passed 6/6 on 2026-08-28: public app loading, partner password login, managed-resource entry and postal-import draft, create-map with API cleanup, saved-resource detail, and the reviewed multi-session schedule editor without saving.
- The smoke cleanup now supplies the app `Origin` header required by the established CSRF guard. Four old `Smoke Map` fixtures were removed through the authenticated API and zero remained after the passing run.
- The complete local quality gate passed: ordered migration validation, 415 source modules and 1,232 relative imports with no cycle, server 594/594, client 700/700, clean diff whitespace, and the production client build.

## Closeout evidence

- `docs/stabilisation-closeout-2026-08-28.md`: scope and release gate.
- `docs/database-assurance-2026-08-28.md`: read-only production schema comparison and historical fallback-account audit.
- `docs/dependency-triage-2026-08-28.md`: current 15-package advisory triage and staged upgrade order.
- `server/scripts/audit_schema_alignment.mjs`: metadata-only schema comparison with hashed connection identifiers.
- `server/test/schemaAlignmentAudit.test.js`: audit normalization and drift tests.
- `server/test/phoneLogin.test.js`: GudAuth provider challenge-verifier contract.
- `tests/smoke/pre-ship.spec.mjs`: CSRF-compatible setup and cleanup requests.
- `docs/regression-ledger.md`: current acceptance evidence and locked behaviour.

## Confirmed database state

- All 60 expected public tables and all 604 expected columns exist with matching data types.
- All 18 current production accounts were checked in memory against the removed bulk-import fallback credential; zero matched and no account was changed.
- No hard or soft asset currently uses the two legacy `partner_id` ownership links whose production delete action differs from source.
- Structural drift remains and is documented. The normalized login indexes are not applied.
- Dated provider-console evidence confirms a six-hour point-in-time recovery window, no snapshots, and no backup schedule. A restore rehearsal has not been performed.

## Do not do

- Do not run a production migration or schema bootstrap.
- Do not combine the PDF/export candidate release or Drizzle dependency work with unrelated feature or schema changes.
- Do not expose or rotate secrets.
- Do not delete or reset the primary dirty checkout.
- Do not mix the filtered-export work into this closeout.
- Do not claim migration-ready backup/restore coverage until a scheduled snapshot exists and a non-production recovery rehearsal is recorded.
- Do not rerun or expand this completed dependency release without a new scoped review.

## Remaining risks and next decision

1. **Dependency remediation:** the Hono/React Router/Vite/PostCSS and separate PDF/export batches are released. The audit is reduced to 2 high, 4 moderate, and 1 low affected packages, with no web/API or PDF/export finding remaining. Drizzle ORM/Kit still requires a dedicated compatibility project because it has database-wide blast radius.
2. **Migration readiness:** production schema changes remain frozen until scheduled snapshots exist, recovery is rehearsed outside the production branch, and a reviewed reconciliation plan exists.
3. **Schema drift:** source and production differ in nullability, two legacy foreign-key actions, one legacy audience-zone link, a share-token index definition, and legacy enums.
4. **Private-file quota:** aggregate storage quota control remains the one original Phase 1 finding not implemented.

Recommended next step: confirm that Neon scheduled snapshots are actually active, then plan a non-production restore rehearsal and schema-reconciliation review. Keep Drizzle, schema migrations, and production data changes frozen until those recovery gates are evidenced.
