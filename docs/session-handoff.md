# CareAround SG Fresh-Chat Handoff

Last updated: 2026-07-15 (Asia/Singapore)

## Current release state

- Production app: `https://app.carearound.sg`
- Production client bundle: `assets/index-BAhyRlx3.js`
- Production My Map owner chunk: `assets/MyMapDetailPage-CFsb5dOE.js`
- Production client CSS: `assets/index-gdJR9SuY.css`
- Production Pages deployment: `https://b4a0b91f.senior-resource-map.pages.dev`
- Production API: `https://api.carearound.sg/api/health` returned OK at
  `2026-07-15T15:46:46.412Z`. No Worker/API deployment was performed.
- Map asset domain: `https://maps.carearound.sg`
  - Default W01: `/v1/w01`
  - Gray W01: `/v1/w01/gray`

## Repo and worktree state

- Current in-progress branch for PWA hardening:
  `codex/pwa-hardening`, created from current `origin/main` `347b05397`.
- The pre-existing dirty `docs/session-handoff.md` rewrite from the original
  checkout was preserved in the local stash named
  `preserve pre-pwa session handoff` before this branch was created.
- Current PWA scope is client-only: service worker registration from
  `/pwa/carearound-sw` with root scope allowed, static offline fallback,
  manifest metadata, Cloudflare Pages headers, tests, and ledger/handoff
  documentation.
- The service worker must not cache `/api` traffic, auth/session checks,
  uploads, Worker responses, R2 map manifests/chunks, or production data.
- This active worktree is now `/Users/sweetbuns/CareAroundSG` on
  `codex/pwa-hardening`, not `main`. Before this branch was created, the
  checkout was `main` at `a1544508b46e9933e5f9f3c8b71412885264095f` and was
  30 commits behind `origin/main`.
- Existing untracked local artifacts remain local and should not be staged by
  default: `.agents/`, `.superpowers/`,
  `docs/competitor-analysis-2026-06-25.md`,
  `docs/map-stable-baseline-2026-07-12.md`,
  `docs/superpowers/plans/2026-06-26-resource-editor-wizard-conversion.md`,
  `output/playwright/test-results/`, and
  `output/playwright/wizard-uat-2026-06-26/`.
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

- Previous verified production baseline: commit `e031e266f`, Pages deployment
  `https://c39e8088.senior-resource-map.pages.dev`.
- Client rollback does not require an API, schema, data, or R2 mutation. The
  separately versioned Gray objects can remain dormant.

## Recommended next step

Use the owner Print Map workspace across a few real multi-resource maps and
confirm the independent print baseline is understandable. If that UAT stays
positive, expand the same controlled-state boundary to Shared Map print next;
keep Discover and the separate PDF ledger out of that follow-up.

## Fresh chat starter

```text
Continue CareAround SG from the active repo only: /Users/sweetbuns/CareAroundSG.

Act as the CareAround SG orchestrator. Read AGENTS.md,
docs/regression-ledger.md, docs/session-handoff.md, and
docs/release-checklist.md, then run git status --short --branch before changing
anything.

The recovered map baseline is live on current main. Production serves
assets/index-Ds9nT_2R.js and owner-map chunk
assets/MyMapDetailPage-Bt2dyQYF.js from Pages deployment
https://cb703fe6.senior-resource-map.pages.dev. My Maps and Discover use
one compact upper-right icon-only Map settings button, an anchored desktop
popover, and the shared mobile bottom sheet. Default/Gray remains persistent
across Discover, My Maps, Shared Maps, and print maps. Owner Detailed remains
CCK/W01-only. My Map reset/recenter remains intentionally hidden on maps with
only one camera target. Mobile map controls use a 30 px upper-right rail with
wider right-side camera padding. Resource-detail browser Back restores the
owner map from a user-scoped in-memory snapshot while fresh data loads.
Mobile owner My Maps also reset delayed browser scroll restoration so every
entry starts at the map and first card instead of the previous list position.
Desktop owner My Maps with mapped resources now have a centred bottom-edge
resize handle that expands the existing map in place up to 78vh/840 px. It is
session-only, keyboard accessible, absent on mobile, and preserves the Leaflet
instance, selection, markers, and camera context.
Owner print starts independently at fit all, Standard, and 360 px while carrying
only the Default/Gray preference. Print allows zoom, pan, detail, colour, and a
300-720 px height. Save as image and browser Print match the configured preview;
Shared Map print and the owner PDF ledger are unchanged.
The print toolbar now keeps Back, Reset, and Save as image left-aligned and no
longer shows an in-app Print button. Map settings aligns exactly with the zoom
rail on desktop and mobile.
Production client builds must retain the enabled `VITE_TOWN_MAP_*` values;
omitting them hides Map detail and is reserved only for an intentional rollback.

The user's original worktree is still `/Users/sweetbuns/CareAroundSG` on current
main with unrelated dirty local files. Do not revert, stage, or modify it
accidentally. The completed recovery release is on
origin/codex/map-baseline-recovery; its isolated worktree is
/Users/sweetbuns/CareAroundSG-map-baseline-recovery. It merges current main
`a1544508b` with validated map branch `eb84067a1`.

Recommended next gate: UAT owner Print Map on a few real multi-resource maps.
If it remains clear and stable, expand the controlled print workspace to Shared
Map print only; leave Discover and the owner PDF ledger unchanged.
```
