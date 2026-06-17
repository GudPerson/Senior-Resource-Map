# CareAround SG Fresh-Chat Handoff

Last updated: 2026-06-17 (Asia/Singapore)

## Intent / Goal

CareAround SG is a Singapore senior-care discovery and coordination platform. It helps seniors, caregivers, care teams, and community partners find support resources, save useful assets, build private/shared maps, and coordinate around resource information without turning every collaboration into a heavy approval workflow.

Current product pillars:

- Public Discover for care and support resources, with relevance from postal search, audience zones, and region boundaries.
- My Directory and My Maps for saved assets, private maps, shared maps, map notes, print/export, and resource-detail handoff.
- Resource stewardship through direct resource Owner/Staff access for places, offerings, templates, and local rollouts.
- Lightweight organisation governance for access lists, linked assets, covered offerings, and agreements.
- Admin support coverage based on Admin Region Scope and user profile location.
- Audit Trail for meaningful governance/resource changes, excluding everyday browsing and personal map actions.

## Operating Guardrails

- Work only in `/Users/sweetbuns/CareAroundSG`.
- Do not use archived or old checkout folders unless the user explicitly asks.
- Before code work, read `AGENTS.md`, `docs/regression-ledger.md`, and this handoff, then run `git status --short --branch`.
- Treat production as the source of truth for deployed behavior, but treat the current dirty branch as the source of truth for the in-progress My Map V2 work.
- Do not print, copy, summarize, commit, or modify secrets, `.env` values, smoke credentials, production auth, Gmail/email, GudAuth, or Worker secret values.
- Use narrow, ledger-backed changes. Do not refactor broad stable surfaces while fixing one visible UI issue.
- Commit, push, and deploy only when the user explicitly asks. Use `docs/release-checklist.md` before any release.

## Current Repo And Runtime State

- Repo: `/Users/sweetbuns/CareAroundSG`
- Remote: `https://github.com/GudPerson/Senior-Resource-Map.git`
- Branch: `codex/my-map-print-v2-refresh`
- Current HEAD: `23810915 Order My Map V2 cards by category`
- Worktree state: dirty, with uncommitted My Map V2 category/spacing follow-up work. The owner print-numbering experiment is parked locally and is not part of the intended release.
- Untracked files:
  - `server/test/myMapDirectoryCategorySource.test.js` is part of the current V2 category-color work and should be included when staging.
  - `output/playwright/test-results/.last-run.json` is generated Playwright output/noise and should not be staged unless deliberately needed.
- Local preview at handoff time: `http://localhost:5175/my-directory/maps/87?ui=v2` returned `200 OK`; it was started with `VITE_API_URL=https://api.carearound.sg/api npm run dev --workspace=client -- --host localhost --port 5175`.
- Production app at handoff time: `https://app.carearound.sg` served `assets/index-mJXDVc69.js` and `assets/index-BkuzdP3Y.css`.
- Production API health at handoff time: `https://api.carearound.sg/api/health` returned OK with timestamp `2026-06-16T16:28:43.106Z`.

## Locked Stable Behavior

- Classic/stable My Map remains available through `/my-directory/maps/:id?ui=stable`.
- Print view still takes priority when `view=print` is present.
- V2 keeps the stable V1 owner toolbar/search/distance header; only the map/list body was refreshed.
- V2 uses badge-free saved-place pins instead of cluster bubble markers; same-postal hard assets share one split-color pin while their cards remain separate.
- V2 card ordering is mapped resources first, then not-shown-on-map resources; within each group it sorts by category A-Z and resource name A-Z.
- Desktop columns split the ordered sequence in half left to right; mobile renders the same sequence vertically.
- Not-shown-on-map resources render as normal cards with a gray `Unmapped` pill rather than a separate special section.
- Postal codes with multiple hard assets render one card per hard asset but one shared same-postal saved-place pin; same-postal hover peer highlighting remains.
- Owner print refinement is KIV for this release after UAT showed the latest print pin-numbering/spreading experiment was not improving enough. Do not include the parked print experiment unless the user explicitly reopens it.
- Shared-map print intentionally remains on the classic numbered print format until explicitly refreshed.
- Existing auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, and production database behavior should not change as part of this V2 UI work.

## Current In-Progress My Map V2 Work

The following files are currently changed and should be reviewed before any commit:

- `client/src/components/DirectoryMap.jsx`
- `client/src/components/MyMapV2PreviewScaffold.jsx`
- `client/src/components/SharedMapDirectoryList.jsx`
- `client/src/features/discover/discoverUtils.js`
- `client/src/lib/directoryPresentation.js`
- `client/src/lib/i18n.js`
- `client/src/pages/MyMapDetailPage.jsx`
- `client/test/directoryMapMarkerMode.test.js`
- `client/test/directoryPresentationV2Order.test.js`
- `client/test/myMapV2Scaffold.test.js`
- `client/test/sharedMapDirectoryListRefinement.test.js`
- `docs/regression-ledger.md`
- `server/src/utils/myMapDirectory.js`
- `server/test/myMapDirectoryCategorySource.test.js`

Current local behavior intended by these changes:

- Category pills use configured sub-category colors.
- Category icons sit beside the category pill, stay on a white tile, and use the category color only for the tile outline/accent.
- V2 saved-place pins keep the original teal saved-place body.
- The inner saved-place pin circle uses hard-asset category color only; it splits when multiple hard asset categories share the same postal code, ignores soft asset categories for pin fill, and same-postal hard assets share one pin instead of drawing duplicate spread pins.
- V2 My Map cards show resource name first, then address underneath.
- Interactive V2 card address spacing was tightened on 2026-06-17 by keeping the address inside the title column, so the note badge no longer pushes AAC addresses farther down than Day Rehab, SCC, or Homebase cards.
- V2 presentation can recover hard-asset addresses from row data when an older place snapshot is missing the address, keeps postal-only Singapore addresses visible, and owner My Map can backfill missing hard-asset addresses from the existing detail endpoint without mutating map data.
- My Map V2 hydrates rows from public sub-category metadata so colors appear even when an older My Map directory payload contains icons but not color fields.

## Verification Evidence

Latest checks on the dirty branch:

- Focused V2 category/map coverage passed `48/48` after the owner print experiment was parked:
  `node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js server/test/myMapDirectoryCategorySource.test.js`
- Full client coverage passed `282/282` after the KIV separation:
  `node --test client/test/*.test.js client/src/lib/*.test.js`
- Full server coverage passed `352/352`:
  `npm run test:server`
- Production-style client build passed with the existing large chunk warning:
  `VITE_API_URL=https://api.carearound.sg/api npm run build:client`
- Localhost returned HTTP 200 for `http://localhost:5175/my-directory/maps/87?ui=v2` before the release split.
- Authenticated Chrome visual smoke against `http://localhost:5175/my-directory/maps/87` confirmed `Singapore 680153` appears under `REACH-SLEC Active Ageing Centre @ Teck Whye Vista`, category icon tiles stay white with colored outlines, the Precious AAC + Diaverum same-postal pair renders as one orange/red split pin, hovering that one split pin highlights both member cards, single-hard-asset pins keep one inner color, soft asset category green is absent from marker fills, and AAC, Day Rehab, SCC, and Homebase cards all measured the same 2.92px title-to-address gap in the visible browser viewport.
- `git diff --check` passed after the KIV separation and evidence updates.

Not yet verified:

- Production smoke with credentials. Do not claim smoke passed unless the smoke environment is loaded and `npm run test:smoke` passes without printing secrets.

## Known Traps

- If `localhost:5175` shows `ERR_CONNECTION_REFUSED`, the local Vite preview is not running. Restart it with:
  `VITE_API_URL=https://api.carearound.sg/api npm run dev --workspace=client -- --host localhost --port 5175`
- Clean automated browser sessions usually redirect protected My Map routes to Login, so they are not a substitute for the user's authenticated Chrome view.
- Do not stage `output/playwright/test-results/.last-run.json` unless it is intentionally needed as test output.
- Do not widen this patch into auth, session, schema, access control, public visibility, Discover ranking, postal validation, or database changes.
- If releasing, keep Cloudflare Pages client deploy and Cloudflare Worker API deploy evidence separate. This V2 work should only need a Pages client deploy unless a later change truly touches Worker behavior.

## Recommended Next Step

First, refresh `http://localhost:5175/my-directory/maps/87?ui=v2` and visually confirm the interactive V2 address spacing, recovered Teck Whye Vista address, white outlined category icon tiles, and teal pins with colored/split inner circles. Keep owner print as KIV unless the user explicitly reopens that work.

If the visual check passes, run the final release gate:

```bash
node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js server/test/myMapDirectoryCategorySource.test.js
node --test client/test/*.test.js client/src/lib/*.test.js
npm run test:server
VITE_API_URL=https://api.carearound.sg/api npm run build:client
git diff --check
```

Then stage only the intended files, excluding generated Playwright output. Commit, push, and deploy only when the user says to proceed.

## Fresh Chat Starter Prompt

```text
Continue CareAround SG from the active repo only: /Users/sweetbuns/CareAroundSG.

Act as the CareAround SG orchestrator. Before changing anything, read AGENTS.md, docs/regression-ledger.md, docs/release-checklist.md, and docs/session-handoff.md. Then run git status --short --branch and summarize the current branch, dirty files, untracked files, and release risk.

Current context:
- We are on branch codex/my-map-print-v2-refresh.
- HEAD is 23810915 Order My Map V2 cards by category.
- There is uncommitted My Map V2 category/spacing work after that commit.
- The latest release focus is stable interactive My Map V2 styling: category-colored pills, colored/split inner saved-place pin circles, larger category icons beside category pills, V2 cards with resource name first and address below, and tighter interactive address spacing. Owner print numbering/spreading is KIV and excluded from the release unless explicitly reopened.
- Classic/stable My Map remains available with ?ui=stable and must not be broken.
- Shared-map print stays classic until explicitly refreshed.
- Do not touch auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, or production data unless I explicitly reopen those areas.

First task:
1. Confirm the local dirty branch state.
2. Inspect the V2 My Map files and the regression ledger row around "2026-06-14 My Map V2 preview scaffold".
3. Help me finish the final visual/UAT gate for http://localhost:5175/my-directory/maps/87?ui=v2.
4. If localhost is down, restart it with VITE_API_URL=https://api.carearound.sg/api npm run dev --workspace=client -- --host localhost --port 5175.
5. Do not commit, push, or deploy unless I explicitly ask.

If I ask to release, run the final gate from docs/session-handoff.md, stage only the intended files, exclude output/playwright/test-results/.last-run.json, then commit, push, and deploy the Cloudflare Pages client with VITE_API_URL=https://api.carearound.sg/api.
```
