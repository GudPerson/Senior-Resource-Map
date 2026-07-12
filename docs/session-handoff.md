# CareAround SG Fresh-Chat Handoff

Last updated: 2026-07-12 (Asia/Singapore)

## Current release state

- Production app: `https://app.carearound.sg`
- Production client bundle: `assets/index-Ds2cwQWb.js`
- Production client CSS: `assets/index-r02V7GVR.css`
- Production Pages deployment: `https://12fec3c0.senior-resource-map.pages.dev`
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
- Implementation commit: `e0fbb31a2` (`Unify responsive map settings layout`).
- Branch pushed to `origin/codex/shared-map-settings-layout`.
- Generated `output/playwright/test-results/` is local smoke noise and must not
  be staged.

## Locked map behavior

- `Default | Gray` is one persistent device preference across Discover, My
  Maps, Shared Maps, and print map rendering.
- My Maps and Discover now use the same compact upper-right `Map` settings
  button. Desktop opens an anchored popover; mobile opens the existing
  CareAround bottom sheet. The settings no longer permanently cover the map
  centre.
- My Map owners see Map detail plus Map colour. Discover and guest Shared Maps
  show only Map colour. Discover zoom controls now use the upper-left lane,
  matching DirectoryMap placement.
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

- Focused map/layout checks: 35/35 passed.
- Full client: 397/397 passed.
- Full server: 396/396 passed.
- Production-configured `npm run build:client`: passed with only the existing
  large-chunk advisory.
- `git diff --check`: passed.
- Production smoke completed all five flows; the postal-import flow passed on
  its configured retry after one 45-second anchor-result timeout.
- Signed-in production browser UAT at 1440x1000 and 390x844 confirmed the same
  popover/sheet placement on My Maps and Discover, unchanged map bounds while
  opening settings and changing colour, and 0 px end-scroll movement across 20
  animation frames.
- Production browser UAT recorded zero application console errors. Network
  inspection found only expected Leaflet/R2 request cancellation during camera,
  style, viewport, and route changes, Cloudflare RUM cancellation, and the
  pre-existing external OneMap badge SVG Chromium ORB block. Attribution text
  remained visible.
- Screenshots and UAT results are local under
  `output/playwright/shared-map-settings-layout/`.

## Rollback

- Previous verified production baseline: commit
  `b9fb904b51c49fdf9068aca21f0b99124077d338`, Pages deployment
  `https://c9114285.senior-resource-map.pages.dev`.
- Client rollback does not require an API, schema, data, or R2 mutation. The
  separately versioned Gray objects can remain dormant.

## Recommended next step

Monitor the shared `Map` button and mobile sheet in normal use before adding
more map settings. Any future choice should go inside this shared panel rather
than returning permanent controls to the map centre. Keep Detailed
fixed-surface cartography owner-only unless a separate expansion is approved.

## Fresh chat starter

```text
Continue CareAround SG from the active repo only: /Users/sweetbuns/CareAroundSG.

Act as the CareAround SG orchestrator. Read AGENTS.md,
docs/regression-ledger.md, docs/session-handoff.md, and
docs/release-checklist.md, then run git status --short --branch before changing
anything.

The responsive shared map-settings release is live. Production serves
assets/index-Ds2cwQWb.js from Pages deployment
https://12fec3c0.senior-resource-map.pages.dev. My Maps and Discover now use
one upper-right Map button, an anchored desktop popover, and the shared mobile
bottom sheet. Default/Gray remains persistent across Discover, My Maps, Shared
Maps, and print maps. Owner Detailed remains CCK/W01-only.

The user's original worktree is still on codex/ai-cost-governor with unrelated
dirty AI work. Do not revert, stage, or modify it accidentally. The completed
release is on origin/codex/shared-map-settings-layout; its isolated worktree is
/Users/sweetbuns/CareAroundSG-shared-map-settings-layout.

Recommended next gate: monitor the shared Map panel before adding more map
choices, and keep Detailed owner-only unless explicitly expanding it.
```
