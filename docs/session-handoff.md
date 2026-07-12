# CareAround SG Fresh-Chat Handoff

Last updated: 2026-07-12 (Asia/Singapore)

## Current release state

- Production app: `https://app.carearound.sg`
- Production client bundle: `assets/index-ByfQM4vi.js`
- Production client CSS: `assets/index-46zy6Sgb.css`
- Production Pages deployment: `https://c39e8088.senior-resource-map.pages.dev`
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
  (`Reset mobile My Map entry position`), and `5b31f77ce`
  (`Add accessible desktop My Map resizing`), `a02d14d75`
  (`Lock enabled Detailed map release build`), and `e031e266f`
  (`Add configurable owner print map workspace`).
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

## Rollback

- Previous verified production baseline: commit `a02d14d75`, Pages deployment
  `https://aebc0610.senior-resource-map.pages.dev`.
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

The owner Print Map workspace is live. Production serves
assets/index-ByfQM4vi.js from Pages deployment
https://c39e8088.senior-resource-map.pages.dev. My Maps and Discover use
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
Production client builds must retain the enabled `VITE_TOWN_MAP_*` values;
omitting them hides Map detail and is reserved only for an intentional rollback.

The user's original worktree is still on codex/ai-cost-governor with unrelated
dirty AI work. Do not revert, stage, or modify it accidentally. The completed
release is on origin/codex/shared-map-settings-layout; its isolated worktree is
/Users/sweetbuns/CareAroundSG-shared-map-settings-layout.

Recommended next gate: UAT owner Print Map on a few real multi-resource maps.
If it remains clear and stable, expand the controlled print workspace to Shared
Map print only; leave Discover and the owner PDF ledger unchanged.
```
