# CareAround SG Fresh-Chat Handoff

Last updated: 2026-07-12 (Asia/Singapore)

## Current release state

- Production app: `https://app.carearound.sg`
- Production client bundle: `assets/index-Dz8Yaxgj.js`
- Production client CSS: `assets/index-CXgnAuHp.css`
- Production Pages deployment: `https://825e09b9.senior-resource-map.pages.dev`
- Production API: `https://api.carearound.sg/api/health` returned OK after the
  client release. No Worker/API deployment was performed.
- Map asset domain: `https://maps.carearound.sg`
  - Default W01: `/v1/w01`
  - Gray W01: `/v1/w01/gray`

## Repo and worktree state

- The user's original worktree remains `/Users/sweetbuns/CareAroundSG` on
  `codex/ai-cost-governor` at `437a4677930a268021affddbaf80d1f879f7727e`.
  Its unrelated AI changes and untracked files were not modified, staged, or
  reverted.
- The shared-settings release used the isolated worktree
  `/Users/sweetbuns/CareAroundSG-shared-map-settings-layout` on
  `codex/shared-map-settings-layout`.
- Exact base: `b9fb904b51c49fdf9068aca21f0b99124077d338` (verified
  persistent Default/Gray production baseline).
- Implementation commits: `e0fbb31a2` (`Unify responsive map settings layout`),
  `430114e9` (`Compact shared map controls`), `4aa119777`
  (`Refine mobile map controls and Back recovery`), and `4f3ea03a5`
  (`Reset mobile My Map entry position`).
- Branch pushed to `origin/codex/shared-map-settings-layout`.
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
- Default uses OneMap `Default_HD`; Gray uses native OneMap `Grey_HD`.
- My Map owner `Standard | Detailed` remains a separate control. Detailed stays
  owner-only and activates automatically at zoom 15.
- Detailed Default uses the accepted colour CCK/W01 fixed surface. Detailed
  Gray uses the accepted native OneMap Grey CCK/W01 fixed surface.
- Both W01 manifests preload. Switching colour while Detailed is active loads
  only visible fixed chunks and does not fall through to live OneMap tiles.
- Pins, clustering, card focus, camera, reset, selection, full map, attribution,
  outside-coverage fallback, ranking, filtering, visibility, and resource data
  remain unchanged.
- Discover remounts only its TileLayer when the preference changes. This avoids
  Leaflet's fractional-zoom redraw path without remounting the MapContainer or
  moving the camera.

## Release evidence

- Focused mobile entry/map/navigation checks: 53/53 passed.
- Full client: 399/399 passed.
- Full server: 396/396 passed.
- Production-configured `npm run build:client`: passed with only the existing
  large-chunk advisory.
- `git diff --check`: passed.
- Pre-deploy production smoke completed all five flows after the postal-import
  check passed its configured retry; its separate targeted rerun passed cleanly.
  Post-deploy production smoke passed 5/5 without retry.
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

## Rollback

- Previous verified production baseline: commit `745156488`, Pages deployment
  `https://65b0b64d.senior-resource-map.pages.dev`.
- Client rollback does not require an API, schema, data, or R2 mutation. The
  separately versioned Gray objects can remain dormant.

## Recommended next step

Confirm the corrected top-of-map entry on the user's affected Android device.
Then monitor the 30 px visual controls for mis-taps; if the rail feels too
precise, keep the 30 px artwork but expand the effective hit area without
increasing the visible footprint.

## Fresh chat starter

```text
Continue CareAround SG from the active repo only: /Users/sweetbuns/CareAroundSG.

Act as the CareAround SG orchestrator. Read AGENTS.md,
docs/regression-ledger.md, docs/session-handoff.md, and
docs/release-checklist.md, then run git status --short --branch before changing
anything.

The responsive shared map-settings release is live. Production serves
assets/index-Dz8Yaxgj.js from Pages deployment
https://825e09b9.senior-resource-map.pages.dev. My Maps and Discover now use
one compact upper-right icon-only Map settings button, an anchored desktop
popover, and the shared mobile bottom sheet. Default/Gray remains persistent
across Discover, My Maps, Shared Maps, and print maps. Owner Detailed remains
CCK/W01-only. My Map reset/recenter remains intentionally hidden on maps with
only one camera target. Mobile map controls use a 30 px upper-right rail with
wider right-side camera padding. Resource-detail browser Back restores the
owner map from a user-scoped in-memory snapshot while fresh data loads.
Mobile owner My Maps also reset delayed browser scroll restoration so every
entry starts at the map and first card instead of the previous list position.

The user's original worktree is still on codex/ai-cost-governor with unrelated
dirty AI work. Do not revert, stage, or modify it accidentally. The completed
release is on origin/codex/shared-map-settings-layout; its isolated worktree is
/Users/sweetbuns/CareAroundSG-shared-map-settings-layout.

Recommended next gate: confirm the corrected top-of-map entry on the affected
Android device, then keep Detailed owner-only unless explicitly expanding it.
```
