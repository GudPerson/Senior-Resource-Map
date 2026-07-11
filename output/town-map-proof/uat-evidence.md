# CCK/W01 Town Map local proof — UAT evidence

Initial proof: 2026-07-10; owner refinements: 2026-07-11 (Asia/Singapore)

## July 11 hosted R2 activation and production release

- Cloudflare R2 bucket `carearound-town-map-assets` now serves the accepted
  colour W01 surface through the versioned custom-domain base
  `https://maps.carearound.sg/v1/w01`. The custom domain is active with minimum
  TLS 1.2; the `r2.dev` development hostname was not enabled.
- The read-only CORS policy permits only `GET` and `HEAD` from
  `https://app.carearound.sg` and the stable proof preview alias. It exposes
  cache, length, range, and ETag response metadata without a wildcard origin.
- The upload published 300 immutable JPEG chunks before the short-cache
  manifest. The public verifier downloaded and SHA-256 checked every chunk:
  300/300 passed, 53,590,423 chunk bytes matched, manifest SHA-256
  `be5f6ed4dfdea33606354f4457aebdc513c0f274f4ea7cb429bdce5d73056c76`
  matched, and chunk-set SHA-256
  `81bd26441edaff1d761f9e395575f8e00b9303f25e1d7896307f7f3036bbc8c6`
  matched version `w01-s50-q95-g3-81bd26441edaff1d`.
- Public delivery timing for the full verifier run was 256.6 ms for the
  manifest and 40.6 ms median / 652.7 ms p95 / 1,576 ms maximum for chunks.
  Versioned chunks returned immutable cache metadata; the manifest returned
  `public, max-age=300, must-revalidate`.
- Enabled branch preview:
  `https://ea750ad6.senior-resource-map.pages.dev`, with stable alias
  `https://codex-cck-w01-town-map-proof.senior-resource-map.pages.dev`.
- Production Pages deployment:
  `https://3ceb94d7.senior-resource-map.pages.dev`. The production custom domain
  serves `assets/index-Du2wVU3_.js`, `assets/index-E_ESjyBS.css`, and the
  owner-map chunk `assets/MyMapDetailPage-DBwVwYUt.js`.
- Fresh signed-in production verification on owner map 45 found 9 visible R2
  chunks, 0 live OneMap tile images, a selected `Detailed` control, visible
  Singapore Land Authority attribution, and 0 console errors or warnings. The
  only failed external request was the pre-existing OneMap badge SVG blocked by
  Chromium ORB; attribution text stayed visible and no cartographic tile failed.
- Standard/Detailed swaps preserved the marker transform and selected resource.
  At zoom 15, Detailed loaded 30 visible chunks and no live tiles; card focus at
  deep zoom pruned that to 1 visible chunk. At zoom 14, Standard stayed active,
  selecting Detailed showed `Zoom in to level 15. Detailed map will turn on
  automatically.`, and one zoom-in activated Detailed without losing context.
- A non-mutating mocked owner-response check moved the only pin outside W01.
  Standard stayed selected, Detailed became unavailable, 0 fixed chunks and 6
  live tiles rendered, and the resource card remained visible. No production
  map or resource data was changed for this check.
- Desktop preview at zoom 15 decoded 30 visible chunks without seams. Mobile
  normal-map UAT decoded 6 chunks (about 24 MiB); full-map UAT kept the normal
  map mounted and added 1 focused chunk (about 28 MiB combined), then returned
  to the list with selection intact. Sixteen end-scroll samples were identical
  (`scrollY=50`, page height 894 px, map height 284.953 px), so no jitter was
  observed.
- Production screenshots:
  `output/town-map-proof/release/production-desktop-detailed.png` and
  `output/town-map-proof/release/production-mobile-detailed.png`. Preview
  full-map evidence remains at
  `output/playwright/cck-w01-town-map-proof/preview-r2-mobile-full-map-detailed.png`.
- Final release gates passed: focused map coverage 93/93, full client coverage
  390/390, full server coverage 396/396, R2 contract coverage 4/4, exact enabled
  production build (2,385 modules, existing large-chunk advisory only),
  `git diff --check`, production API health, and production smoke 5/5.
- Fast rollback remains a Pages rebuild/deploy with every
  `VITE_TOWN_MAP_*` variable omitted. The last verified dormant deployment is
  `https://88ed4e38.senior-resource-map.pages.dev`; rollback requires no Worker,
  schema, data, auth, permission, DNS, or R2 mutation.
- Blast radius remains client-only and owner-view-only: no Discover, Shared
  Maps, print/export, API, schema, authentication, permission, ranking,
  filtering, visibility, or saved-resource behavior changed.

## July 11 R2 activation preparation

- The intended hosted boundary is the dedicated
  `carearound-town-map-assets` bucket with versioned object prefix `v1/w01` and
  public base `https://maps.carearound.sg/v1/w01`.
- The deployment dry run verifies the committed manifest, the exact 300-file
  source allowlist, every JPEG size and SHA-256 hash, the 53,590,423-byte total,
  and chunk-set integrity before any Cloudflare write. Apply mode uploads every
  immutable chunk first and publishes the five-minute-cache manifest last.
- The CORS policy is read-only (`GET` and `HEAD`), excludes wildcard origins,
  and allows only the production app plus the stable proof preview alias.
- The public verifier downloads and hashes all 300 chunks, checks total bytes,
  content types, immutable cache metadata, production-origin CORS, and reports
  manifest and chunk latency percentiles.
- R2 tooling coverage passed 4/4, the full source dry run passed, script/JSON
  syntax checks passed, and `git diff --check` passed. This preparation gate was
  later cleared when the account owner enabled R2; the completed hosted rollout
  is recorded above.

## July 11 dormant production client release

- Implementation commit `ba69345ee` was pushed to
  `codex/cck-w01-town-map-proof`.
- Cloudflare Pages branch preview:
  `https://9311acad.senior-resource-map.pages.dev`, with alias
  `https://codex-cck-w01-town-map-proof.senior-resource-map.pages.dev`.
- The exact preview bundle was published to the Pages production branch at
  `https://88ed4e38.senior-resource-map.pages.dev`.
- `https://app.carearound.sg` serves `assets/index-BasuxQyR.js` and
  `assets/index-E_ESjyBS.css`; the app root, Discover, an owner-map route, and
  production API health all returned HTTP 200 after release.
- The release explicitly omitted every `VITE_TOWN_MAP_*` variable. The deployed
  bundle contains no local W01 asset URL or Town Map environment name, so the
  proof is dormant and existing production map behavior is unchanged. No W01
  chunks were uploaded to Pages or R2.
- Production smoke completed with four immediate passes and one flaky flow:
  dashboard resources missed its first 30-second `New Place` visibility check,
  then passed on the configured retry. Postal import, create-map selection and
  submission, saved-resource detail, and public app loading passed.
- No Worker/API deployment, R2 creation, schema bootstrap, authentication,
  permission, data, ranking, filtering, visibility, or saved-resource change
  was performed.

## July 11 wrong-zoom Detailed guidance

- Below zoom level 15, `Detailed` remains visually unavailable but can now be
  selected to explain what happens next. The map stays on `Standard` and shows
  the plain-language message: `Zoom in to level 15. Detailed map will turn on
  automatically.`
- Mobile uses the shorter message `Zoom in to 15 for Detailed.` so the control
  and guidance remain on one row without overlapping the map controls.
- The guidance clears when the user selects `Standard` or reaches zoom 15.
  Reaching zoom 15 still turns on `Detailed` automatically; no camera, marker,
  selection, or fixed-surface threshold behavior changed.
- The unavailable control uses `aria-disabled` rather than the native disabled
  attribute, so it can explain the unavailable state while still exposing that
  state to assistive technology. The message is announced through a polite live
  status region.

Signed-in Chrome evidence on owner map 25:

| Check | Result |
| --- | --- |
| Before selecting Detailed at zoom 14 | no guidance; `aria-disabled=true`; Standard remained selected |
| After selecting Detailed at zoom 14 | desktop guidance visible; 12 live tiles; 0 fixed W01 chunks |
| Mobile layout | compact guidance fitted the map row; control and status shared the same right edge with no horizontal overflow |
| Automatic zoom 14 to 15 | Detailed selected automatically; guidance cleared; 20 fixed W01 chunks; 0 live tiles |

Guidance screenshots:

- `output/playwright/cck-w01-town-map-proof/desktop-detailed-wrong-zoom-guidance.png`
- `output/playwright/cck-w01-town-map-proof/mobile-detailed-wrong-zoom-guidance.png`

Latest automated gates:

- Focused map/client matrix: 93/93 passed.
- Full client suite (`client/test/*.test.js` plus `client/src/lib/*.test.js`):
  390/390 passed.
- `npm run build:client`: passed; 2,385 modules built in 4.82 seconds,
  with only the existing large-chunk advisory.

## July 11 Default/Detailed and mobile end-scroll stabilization

- The locally flagged owner proof now uses OneMap `Default_HD` for its
  `Standard` surface. The repository-wide `Grey_HD` default remains unchanged,
  so Discover, Shared Maps, and every unflagged `DirectoryMap` caller retain
  their existing map style.
- The owner-facing fixed-surface label is now `Detailed`; loading, unavailable,
  and automatic-switch guidance use the same plain-language term.
- The mobile vibration came from the inherited list-focus behavior removing the
  entire normal-map frame from page flow after downward scroll. At the short-list
  boundary this reduced the page height by approximately 300 px, clamped the
  scroll position, and could repeatedly retrigger the layout change under touch
  momentum.
- A new default-off `preserveMobileMapFrameInFlow` boundary keeps the owner
  proof's map footprint and Leaflet layout signature stable. Only the locally
  flagged My Map owner view opts in; the shared component's existing default is
  unchanged.

Signed-in Chrome evidence on owner map 25 at the reported mobile boundary:

| Check | Result |
| --- | --- |
| Pre-fix end scroll | map frame became `hidden`; height fell to 0; page height fell from about 1,273 px to 968 px |
| Post-fix end scroll | map frame stayed 298.44 px high; page height stayed 1,266 px; scroll position stayed 388.33 px |
| Stability sample | 16 consecutive samples over approximately 560 ms were identical; no oscillation or layout collapse |
| Standard-map network/DOM | 6 `Default_HD` tile images; 0 `Original_HD`; 0 `Grey_HD` |
| Detailed-map network/DOM | 6 visible local W01 image chunks; 0 live OneMap tile images |
| Mobile full-map round trip | opened and returned to the normal list without losing the normal map |
| Fresh browser console | 0 CareAround errors; 0 CareAround warnings |

Latest screenshots:

- `output/playwright/cck-w01-town-map-proof/mobile-default-standard-detailed-control.png`
- `output/playwright/cck-w01-town-map-proof/mobile-detailed-normal.png`
- `output/playwright/cck-w01-town-map-proof/mobile-detailed-default-bottom-scroll-stable.png`

Latest automated gates:

- Focused map/My Map matrix: 126/126 passed.
- Full client suite (`client/test/*.test.js` plus `client/src/lib/*.test.js`):
  390/390 passed.
- `npm run build:client`: passed; 2,385 modules built in 4.35 seconds,
  with only the existing large-chunk advisory.

## July 11 zoom-11 framing lock refinement

- The owner-proof zoom-11 overview centre moved east from longitude `103.8198`
  to `103.846`. This moves the rendered OneMap surface left by approximately
  38 CSS pixels at zoom 11 and removes the exposed blue gutter at the western
  edge of the desktop frame.
- Zoom 11 is now a locked overview only for the locally flagged owner proof.
  Leaflet dragging is disabled while that minimum step is active, and any
  programmatic pan is returned to the configured overview centre. Zooming to
  12 or higher restores the map instance's prior draggable state.
- The lock uses a one-screen-pixel centre tolerance and a re-entry guard. This
  accommodates Leaflet's world-pixel rounding without repeated `moveend` /
  `panTo` calls. The fresh post-guard browser run had no CareAround console
  errors or warnings.
- `DirectoryMap` keeps the new camera lock off by default. Only the three
  locally flagged My Map owner instances opt in; Shared Maps, Discover, print,
  and unflagged maps retain their existing camera behavior.

Signed-in Chrome evidence on owner map 25:

| Check | Result |
| --- | --- |
| Desktop zoom 11 framing | no uniform blue left gutter; Singapore routes remain centred; attribution and controls unchanged |
| Desktop drag at zoom 11 | ignored; map pane stayed at `translate3d(-152px, -36px, 0px)` |
| Desktop drag at zoom 12 | enabled; map pane moved from `translate3d(-152px, -36px, 0px)` to `translate3d(69.7928px, -36px, 0px)` |
| Return to zoom 11 | snapped back once and removed Leaflet's draggable classes |
| Mobile normal map | no left gutter; drag ignored at zoom 11; control and route framing remain in view |
| Mobile full map | independent zoom-11 lock; drag ignored without affecting the mounted normal map |
| Fresh desktop and mobile console pass | 0 CareAround errors; 0 CareAround warnings |

Latest framing screenshots:

- `output/playwright/cck-w01-town-map-proof/desktop-standard-original-z11-left-shift-locked.png`
- `output/playwright/cck-w01-town-map-proof/mobile-standard-original-z11-left-shift-locked.png`
- `output/playwright/cck-w01-town-map-proof/mobile-full-standard-original-z11-left-shift-locked.png`

Latest automated gates:

- Focused map/My Map matrix: 126/126 passed.
- Full client suite (`client/test/*.test.js` plus `client/src/lib/*.test.js`):
  390/390 passed.
- `npm run build:client`: passed; 2,385 modules built in 4.25 seconds,
  with only the existing large-chunk advisory.
- `git diff --check`: passed.

## July 11 Standard/Easy-read refinement

- The flagged owner proof's outermost zoom-out level is now 11 instead of 10.
  The `−` control disables at 11, the counter reads `11`, and entering that
  level recentres the Singapore overview so OneMap coverage fills the frame.
- The native owner-proof surface now uses OneMap `Original_HD`, following user
  visual preference. The repository-wide `Grey_HD` default remains unchanged,
  so Discover, Shared Maps, and unflagged `DirectoryMap` callers are untouched.
- The fixed W01 surface is back to its accepted colour presentation. The local
  grayscale environment switch is now opt-in rather than the default; a future
  user-facing colour/gray asset choice remains parked.
- The public labels are `Standard` and `Easy-read`. Below the fixed-surface
  threshold, the inline descriptor says `Easy-read turns on automatically at
  zoom 15.` Desktop uses the full text; mobile uses `Auto at zoom 15`.
- A rounded zoom-level counter sits above the existing Leaflet `+` and `−`
  controls. It follows the same rounded tile level used by automatic
  Standard/Easy-read switching.

Signed-in browser evidence on owner map 45:

| Check | Result |
| --- | --- |
| Desktop minimum view | counter 11; `−` disabled; Singapore centred with no outer gray border |
| Standard-map network | 38 `Original_HD` tile resources; 0 `Default_HD`; 0 `Grey_HD` |
| Mobile inline control | 246 × 30 px total; no overlap with zoom or full-map controls; no label wrapping |
| Mobile button text | `scrollWidth === clientWidth` for Standard and Easy-read |
| Automatic 14 → 15 transition | 12 fixed W01 chunks; 0 live OneMap tile requests; 0 failures or console/page errors |
| Fixed-surface colour | 0 chunks with a grayscale CSS filter |
| Mobile normal/full maps | independent counters (`15` and `16`) and independent map controls |
| Card/pin alignment | identical `translate3d(178px, 143px, 0px)` through Easy-read → Standard → Easy-read |

Refinement screenshots:

- `output/playwright/cck-w01-town-map-proof/desktop-refinement-standard-original-z11.png`
- `output/playwright/cck-w01-town-map-proof/mobile-refinement-standard-original-z11.png`
- `output/playwright/cck-w01-town-map-proof/mobile-refinement-easy-read-colour-z15.png`

Refinement automated gates:

- Focused map/My Map matrix: 126/126 passed.
- Full client suite: 390/390 passed.
- `npm run build:client`: passed; 2,384 modules built in 4.68 seconds,
  with only the existing large-chunk advisory.
- `git diff --check`: passed. New refinement files contain no trailing
  whitespace; the older `DirectoryMap.jsx` base still contains unrelated
  pre-existing trailing spaces outside this diff and was not reformatted.

## Earlier July 11 automatic gray iteration

- The flagged owner proof now uses an automatic preference. Each mounted
  `DirectoryMap` resolves its own effective basemap from its settled camera:
  Town at the W01 threshold and Live below it. This prevents the mobile normal
  map and mobile full map from racing over one shared zoom value.
- The Town threshold moved from 16 to 15. Eligibility now follows Leaflet's
  rounded tile level: fitted zoom `14.5` and above uses level 15 and Town;
  `14.49` and below uses level 14 and Live. This makes one additional `−`
  click available on both desktop and mobile without changing `zoomSnap` or
  any Live-map camera rule.
- Clicking Live is a per-map manual override throughout the current eligible
  zoom band. Clicking Town re-arms automation immediately; leaving the Town
  band and returning also releases the override automatically. No
  `MapContainer` key or recreation was added, so selection and camera state
  survive the swap.
- The accepted colour W01 chunks now have a reversible, Town-layer-only CSS
  grayscale preview. The source bytes, URLs, hashes, bounds, labels,
  attribution, and manifest remain unchanged. `VITE_TOWN_MAP_GRAYSCALE=false`
  restores the accepted source colours for comparison.
- Low-zoom retention padding is disabled through zoom 16. A 256 MiB decoded
  budget applies to each mounted map's complete retained overlay set during
  settled and animated zoom states; an oversized viewport fails quietly to
  Live and retries after zooming into a safer level.

Clean signed-in Playwright evidence on owner map 45:

| Check | Result |
| --- | --- |
| Town-only zoom 16 → added step | 30 visible chunks at about 130 CSS px each |
| Cache-disabled automatic Live → Town crossing | 30 fixed W01 chunk requests from `127.0.0.1:4174`; 0 live OneMap tile requests; 0 failed requests |
| Next `−` step | Live map, 0 fixed chunks, 12 live tile nodes |
| Returning one `+` step | Town map, 30 fixed chunks, 0 live tile nodes |
| Card focus and Live override | selected card stayed selected; marker transform stayed identical |
| Re-arm Town after deeper Live zoom | selected card and camera preserved; 1 fixed chunk; 0 live tiles |
| Manual override after leaving the Town band | returning one `+` step restored Town automatically |
| Clicking the already-active Live control below the band | remained Live; one `+` step still restored Town automatically |
| Oversized-viewport memory fallback | synthetic 3,000 px map fell back at level 15 and recovered at safe level 16 |
| Mobile normal/full-map independence | full map stayed Live for comparison while normal map stayed Town; both returned to Town independently |
| Fresh interaction console capture | 0 errors, 0 warnings, 0 page errors |

Signed-in map 25 visual and memory observations:

- Desktop added step: 28 visible chunks, approximately 112 MiB decoded, gray
  filter active, 0 live tile nodes, and OneMap/Singapore Land Authority
  attribution visible.
- Mobile normal map: 6 chunks, approximately 24 MiB decoded.
- Mobile full map at the added fitted `14.9` step: 32 chunks, approximately
  128 MiB decoded; together with the mounted normal map, approximately 152 MiB.
- The next mobile `−` step changed to Live; one `+` step restored Town
  automatically. No blank gap or visible chunk seam was found in the saved
  desktop or mobile screenshots.
- Cache-cleared Town transitions had no failed manifest or chunk requests. One
  standalone responsive remount reported `ERR_BLOCKED_BY_ORB` for the existing
  external OneMap badge SVG; the attribution text and badge remained visible in
  the signed-in Chrome UAT and saved screenshots. This request is outside the
  fixed W01 surface and was not changed in the proof.
- Manual Live survived a deeper zoom. Re-enabling Town preserved all marker
  transforms. Card focus and Reset both stayed in Town and retained aligned
  markers on map 25.

July 11 screenshots:

- `output/town-map-proof/desktop-map25-town-gray-z15.png`
- `output/town-map-proof/mobile-map25-town-gray-extra-step.png`
- `output/playwright/cck-w01-town-map-proof/desktop-town-gray-auto-z15-final.png`
- `output/playwright/cck-w01-town-map-proof/mobile-town-gray-auto-normal-final.png`
- `output/playwright/cck-w01-town-map-proof/mobile-town-gray-auto-extra-step-final.png`

## Grounding and scope

- Worktree: `/Users/sweetbuns/CareAroundSG-cck-w01-town-map-proof`
- Branch: `codex/cck-w01-town-map-proof`
- Exact base: `437a4677930a268021affddbaf80d1f879f7727e`
- Original dirty checkout remained on `codex/ai-cost-governor` at the same commit and was not modified, staged, reverted, or switched.
- Client-only, My Map owner view only, CCK/W01 only.
- No commit, push, deployment, API, schema, authentication, permission, ranking, filtering, visibility, saved-resource, Discover, Shared Maps, print, or export change.

## Local runtime

- CareAround owner URLs: `http://127.0.0.1:5174/my-directory/maps/25`
  (user-session visual UAT) and `http://127.0.0.1:5174/my-directory/maps/45`
  (clean Playwright UAT)
- W01 asset base: `http://127.0.0.1:4174/v1/w01`
- API health: `http://127.0.0.1:8787/api/health`
- Final health check: client 200, asset manifest 200, API 200.

The local client was started with:

```sh
VITE_TOWN_MAP_PROOF_ENABLED=true \
VITE_TOWN_MAP_ASSET_BASE_URL=http://127.0.0.1:4174/v1/w01 \
npm run dev --workspace=client -- --host 127.0.0.1 --port 5174
```

## Asset contract

- Manifest: `output/town-map-proof/assets/v1/w01/manifest.json`
- Schema: `carearound.fixed-town-surface` v1
- Version: `w01-s50-q95-g3-81bd26441edaff1d`
- Manifest SHA-256: `be5f6ed4dfdea33606354f4457aebdc513c0f274f4ea7cb429bdce5d73056c76`
- Chunk-set SHA-256: `81bd26441edaff1d761f9e395575f8e00b9303f25e1d7896307f7f3036bbc8c6`
- 300 JPEG chunks, 53,590,423 bytes total.
- Retained chunk-grid dimensions: 19,813 × 14,982 pixels.
- Accepted readability metadata: 175%, preserved image streams and text, no raster resampling.
- The client validator rejects identity, integrity, projection, bounds, retained-dimension, grid, profile, or readability drift before enabling Town mode.
- The local server allowlists only the manifest and its 300 chunks, verifies every byte count and SHA-256 at startup, exposes CORS/timing headers, and keeps the SG MAP source read-only.

Manifest regeneration was byte-for-byte deterministic: SHA-256 before and after regeneration was the same value above.

## Browser evidence

Playwright used the authenticated owner route at desktop 1440 × 1000 and mobile 390 × 844.

### Network and culling

After clearing browser cache and resource timings immediately before each Town transition:

| View | Fixed chunks | Encoded bytes | Transfer bytes | Slowest local response | OneMap tile requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, fitted zoom 16 | 9 | 1,828,489 | 1,831,189 | 9.6 ms | 0 |
| Mobile, fitted zoom 16 | 6 | 1,022,945 | 1,024,745 | 8.9 ms | 0 |
| Selected-place focus, zoom 18/19 | 1 | 150,878 | approximately 151 KB with headers | local/cache | 0 |

- Town mode had zero `https://www.onemap.gov.sg/maps/tiles/` requests and zero live tile DOM nodes.
- At rest the DOM contained exactly the fixed chunks intersecting the visible viewport: desktop 9, mobile 6, focused view 1.
- Across three sustained deep-zoom drags, retention stayed bounded at 1–2 chunks. Settled counts were 1, 1, and 2; the final viewport crossed a real chunk boundary.
- The two adjacent deep-zoom chunks overlapped by 2 CSS pixels after the seam guard, so there was no geometric gap.
- Browser console: 0 errors, 0 warnings.
- Failed dynamic or static network requests: 0.

### Interaction and alignment

- `DirectoryMap` remains Live by default. In the locally flagged owner proof,
  a reload now uses the automatic preference and selects Town when that map
  instance settles at the W01 threshold.
- The marker center was identical across the Live/Town swap at fitted zoom: `(700.5546875, 530.1953125)`.
- After card focus, Live and Town both kept the selected card and the same marker center: `(700.5546875, 529.1953125)`.
- At zoom 19 the marker remained on the same 386 Bukit Batok West Avenue building footprint while the same fixed labels enlarged.
- Switching Live → Town and Town → Live preserved the selected-place state and camera.
- In the final focused-card pass, the marker stayed at
  `translate3d(309px, 263px, 0px)` and the selected-card class stayed identical
  through Town → Live → Town.
- The initial proof raised Town to zoom 16. The July 11 iteration instead keeps
  the existing camera and resolves Town automatically at the added zoom-15
  step, while leaving Live camera rules unchanged.
- With an in-coverage temporary anchor (`680309`), card focus reduced the view to one chunk; Reset restored the four-chunk fitted view, cleared selection, kept Town active, and loaded no live tiles.
- With an out-of-coverage temporary anchor (`018956`), Town immediately changed to Live, disabled Town, and showed: `Some places are outside CCK. Live map is still on.` Clearing the anchor removed the status and re-enabled Town.
- Mobile normal/full-map open, selected card focus, Live/Town switching, reset, and return-to-list all remained stable.
- The existing cluster implementation was unchanged; its focused automated interaction tests passed. The one-resource UAT map did not provide a manual multi-pin cluster.

### Memory observations

- Desktop fitted Town view: 9 decoded 1024 × 1024 chunks, approximately 36 MiB of decoded image memory.
- Mobile fitted Town view: 6 chunks, approximately 24 MiB decoded.
- Focused view: 1 chunk, approximately 4 MiB decoded.
- A synthetic 3,000 px-wide map exercised the per-map limit: 52 chunks at safe
  level 16 used approximately 208 MiB; the level-15 view fell back to Live
  before loading an over-budget set, then automatically recovered to the same
  52-chunk Town view after zooming in.
- Mobile full map briefly held the normal six-chunk map plus one focused full-map chunk: approximately 28 MiB decoded. This is bounded but is the main proof-level memory caveat because the stable mobile shell keeps its normal map mounted behind the full-map view.
- Garbage-collected page JavaScript heap was about 25 MiB in both Live and Town; fixed-image decode memory is separate from that heap.
- Loading the entire W01 surface at once would be approximately 1,132 MiB decoded, which confirms why viewport culling is required. The proof never loaded the full surface.

The headed browser window was also inspected after a cross-chunk pan. A Playwright clipped screenshot produced black compositor blocks for that cross-origin, multi-image frame; the live window did not. The corrupted capture is excluded from deliverables. Clean Playwright element screenshots were inspected for the delivered desktop and mobile states.

## Screenshots

- Desktop fitted Town map: `output/playwright/cck-w01-town-map-proof/desktop-town-map-z16-final.png`
- Desktop deep/readable Town map: `output/playwright/cck-w01-town-map-proof/desktop-town-map-readable-final.png`
- Mobile normal map: `output/playwright/cck-w01-town-map-proof/mobile-town-map-normal-final.png`
- Mobile full map: `output/playwright/cck-w01-town-map-proof/mobile-town-map-full-final.png`

## Automated verification

Focused map/My Map matrix:

```sh
node --test client/test/fixedTownSurface.test.js client/test/fixedTownSurfaceIntegration.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapPresentation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js client/test/mapClusterInteraction.test.js client/test/mapTheme.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryPresentationLayout.test.js client/test/directoryGroupFocus.test.js client/test/directoryDistanceAnchor.test.js client/test/myMapsLoading.test.js client/test/sharedMapContinuation.test.js
```

Result: 121/121 passed; 0 failed, skipped, cancelled, or todo.

Full client suite:

```sh
node --test client/test/*.test.js client/src/lib/*.test.js
```

Result: 385/385 passed; 0 failed, skipped, cancelled, or todo.

Build and static gates:

```sh
npm run build:client
node --check scripts/town-map/generate-w01-manifest.mjs
node --check scripts/town-map/serve-w01-assets.mjs
npm run town-map:manifest
git diff --check
```

Results: all passed. Vite built 2,384 modules in 4.18 seconds and emitted only the repository's existing large-chunk advisory.

July 11 rerun after the automatic zoom, low-zoom guard, and grayscale preview:

- Focused map/My Map matrix: 123/123 passed.
- Full client suite (`client/test/*.test.js` plus `client/src/lib/*.test.js`):
  387/387 passed.
- `npm run build:client`: passed; 2,384 modules built in 4.56 seconds,
  with only the existing large-chunk advisory.
- Manifest regeneration remained deterministic with SHA-256
  `be5f6ed4dfdea33606354f4457aebdc513c0f274f4ea7cb429bdce5d73056c76`.
- Both Town-map scripts passed `node --check`; `git diff --check` and
  untracked-file trailing-whitespace checks passed.
- Final local health: client 200, W01 manifest 200, API health 200.

## Recommendation

Expand to Shared Maps next, not Discover. Shared Maps already shares the DirectoryMap/list interaction stack, so the next proof can validate public/read-only ownership boundaries and multi-resource coverage with a smaller blast radius. Discover adds ranking, filtering, moving search context, and broader coverage behavior, so it should wait until asset hosting, multi-town selection, and mobile full-map memory are settled.
