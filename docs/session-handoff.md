# CareAround SG Fresh-Chat Handoff

Last updated: 2026-07-12 (Asia/Singapore)

## Current release state

- Production app: `https://app.carearound.sg`
- Production client bundle: `assets/index-Qri8mQ9i.js`
- Production client CSS: `assets/index-B86VNPto.css`
- Production Pages deployment: `https://c9114285.senior-resource-map.pages.dev`
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
- The map-style release used the isolated worktree
  `/Users/sweetbuns/CareAroundSG-map-style-preference` on
  `codex/map-style-preference`.
- Exact base: `5e27379acdec98d8c2e8ed0f575d2b3ee8215639` (`Record Standard map recovery release`).
- Implementation commit: `a41b6c80d` (`Add persistent Default and Gray map styles`).
- Branch pushed to `origin/codex/map-style-preference`.
- Generated `output/playwright/test-results/` is local smoke noise and must not
  be staged.

## Locked map behavior

- `Default | Gray` is one persistent device preference across Discover, My
  Maps, Shared Maps, and print map rendering.
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

- Full client: 394/394 passed.
- Full server: 396/396 passed.
- R2 contract: 5/5 passed.
- Production-configured `npm run build:client`: passed with only the existing
  large-chunk advisory.
- `git diff --check`: passed.
- Production smoke: all five flows completed; dashboard resources passed on the
  configured retry after one 30-second visibility timeout.
- Gray R2 verifier: 88 chunks, 48,817,738 bytes, manifest SHA-256
  `58bb3880ee09b9b6bac938545048694b8d6a38728ddaf874db5e606971603640`,
  50.8 ms warm median and 382.5 ms p95.
- Production owner Detailed Default → Gray requested only six Gray chunks and
  zero live tiles. Four pin transforms were identical before/after.
- Production mobile retained two Gray chunks, fit both segmented controls in
  one row, and showed no end-scroll jitter.
- Production Discover used valid integer `Grey_HD` tiles; guest Shared Maps used
  12 `Grey_HD` tiles. Production browser consoles were clean.
- Screenshots and request details:
  `output/town-map-proof/uat-evidence.md`.

## Rollback

- Previous verified production baseline: commit
  `5e27379acdec98d8c2e8ed0f575d2b3ee8215639`, Pages deployment
  `https://65925a9b.senior-resource-map.pages.dev`.
- Client rollback does not require an API, schema, data, or R2 mutation. The
  separately versioned Gray objects can remain dormant.

## Recommended next step

Keep Detailed fixed-surface cartography owner-only until a separate expansion
is approved. If expanded, take Shared Maps before Discover because Shared Maps
already uses DirectoryMap while Discover has broader camera, filtering,
ranking, and islandwide coverage behavior.

## Fresh chat starter

```text
Continue CareAround SG from the active repo only: /Users/sweetbuns/CareAroundSG.

Act as the CareAround SG orchestrator. Read AGENTS.md,
docs/regression-ledger.md, docs/session-handoff.md, and
docs/release-checklist.md, then run git status --short --branch before changing
anything.

The persistent Default/Gray map-style release is live. Production serves
assets/index-Qri8mQ9i.js from Pages deployment
https://c9114285.senior-resource-map.pages.dev. Default/Gray applies across
Discover, My Maps, Shared Maps, and print maps. Owner Detailed mode remains
CCK/W01-only and uses fixed colour or native Gray assets from
https://maps.carearound.sg/v1/w01 and /v1/w01/gray with zero live tiles during
an active style switch.

The user's original worktree is still on codex/ai-cost-governor with unrelated
dirty AI work. Do not revert, stage, or modify it accidentally. The completed
map release is on origin/codex/map-style-preference; its isolated worktree is
/Users/sweetbuns/CareAroundSG-map-style-preference.

Recommended next gate: keep Detailed owner-only unless explicitly expanding;
if approved, evaluate Shared Maps before Discover.
```
