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

## 2026-08-08 complete embedded-resource preview local release candidate

- Current behavior: one selected embedded-map resource is presented as one
  content-dense card. Its logo/fallback, name, and address form the identity
  block. Optional operating hours or schedule, website, visible tap-to-call
  number, supported social-channel icons, and `Open resource` follow without
  repeating the resource name or address. At 400x520 the website, phone,
  social, and resource actions share one 44-pixel-target row and no longer sit
  below an internal scroll boundary.
- Public-offering pill: a hard Place snapshot now carries the deduplicated
  count of linked or hosted Programmes and Services that a guest can access.
  Promotions, hidden/deleted or scheduled-hidden offerings, member-only
  offerings, audience-scoped offerings, and eligibility-gated offerings do
  not count. The optional pill reads, for example, `4 programmes and services`.
- Snapshot boundary: the count is calculated only while creating or updating
  the existing frozen My Map share snapshot. Existing live tokens retain their
  previous data until the owner intentionally uses `Update shared link`; the
  embed does not query live offerings. Contact details retain the prior
  sanitized embed-only snapshot contract.
- Architecture and blast radius: the change is limited to the existing batched
  hard-asset share hydration, snapshot row normalization, embed presentation
  helper, and embed-only card. There is no schema, route, auth, permission,
  map-membership, Group-filter, annotation, Print View, export, R2, framing, or
  ordinary Shared Map behavior change.
- Reproduction and acceptance: update a shared link containing a hard Place
  with public hours, contact channels, and guest-open Programmes/Services. Open
  its approved iframe at 400x520, select the pin, and confirm the complete card
  is visible without scrolling or duplicate identity. Confirm the pill excludes
  non-guest offerings, optional rows disappear cleanly when fields are absent,
  and the desktop card retains its labelled operating-hours treatment.
- Verification: full server coverage passes 521/521; full client/source
  coverage passes 574/574; map lockdown passes 84/84; the exact six-root
  production client build passes with only the established browsers-data
  advisory; and `git diff --check` passes. Playwright visual QA passes at
  400x520 and 1280x900. At the compact viewport the card's `clientHeight` and
  `scrollHeight` are both 204 pixels, and all five Website, phone, Facebook,
  Instagram, and `Open resource` actions are visible. See `design-qa.md`.
- Release state: validated local candidate on `codex/map-only-embed-v1`;
  production identifiers and artifact parity will be recorded after the
  approved Worker-first release.

## 2026-08-08 embedded-map contacts and Group filters production release

- Current behavior: a selected embedded-map pin shows the place name and
  address once. A one-resource preview no longer repeats that same name or its
  category inside the card; multi-resource or differently named hosted rows
  retain their distinguishing names. The row keeps its resource logo/fallback,
  a compact website icon, a visible tap-to-call number, recognizable Facebook,
  Instagram, TikTok, YouTube, and LinkedIn icon actions, and the explicit
  `Open resource` link. At the documented 400x520 minimum, the preview may use
  the available map height and scroll internally rather than clipping actions.
- Group-filter behavior: selecting a Group category retains the Group's
  list-only row and reveals each public member resource that is also present in
  the frozen shared-map directory. Exact frozen `groupMemberAssetKeys` support
  Place and Offering members after the next share update; legacy
  `mapFocusPlaceKeys` continue to recover mapped Place members. Members absent
  from the shared map and unrelated resources at the same location are not
  added.
- Snapshot and privacy boundary: website, public contact phone, and supported
  social links are sanitized and frozen only when the owner uses `Update shared
  link`. Existing live share tokens keep their prior snapshot until updated.
  The fields are applied only to the embed response; the ordinary Shared Map
  response remains contact-free. Email, WhatsApp, private notes, personal
  places, owner tools, and live resource reads are not added. Unsafe URL
  schemes, credentials, control characters, and malformed phone values are
  removed.
- Architecture and blast radius: the change is limited to My Map snapshot
  normalization, the existing publish/update snapshot path, the embed-only
  guest response, and embed presentation/filter helpers. There is no database
  schema, route, auth, permission, framing, R2, Print View, annotation, export,
  map membership, or ordinary Shared Map behavior change.
- Reproduction and acceptance: update an owned shared link containing one
  public Group and its mapped member resources, then open its approved iframe
  at 400x520. Select the Group category and confirm the mapped count and pins
  contain its in-map members rather than zero. Select one pin and confirm the
  name/address appear once, the logo/fallback is present, the phone number is
  visible and uses `tel:`, website/social actions use compact recognizable
  icons, and `Open resource` remains available. Confirm an ordinary Shared Map
  response does not contain the frozen contact fields.
- Verification: focused red-to-green client/server coverage passes 9/9; full
  server coverage passes 520/520; full client/source coverage passes 574/574;
  map lockdown passes 84/84; and the exact six-root production build passes
  with only the established browsers-data advisory. Mocked built-app UAT at
  400x520 confirms a Group filter retains two mapped member pins and the
  compact preview exposes Website, `tel:+6567695070`, Facebook, and `Open
  resource` through accessible links. Local Detailed-manifest CORS failures
  are expected in this cross-origin preview and did not affect the live-map
  fallback or the asserted behavior.
- Production release: implementation commit `ce37a5954` is on
  `codex/map-only-embed-v1` and `main`. Worker version
  `1971d14c-54f0-4d0c-8f61-0eab30722cc8` was deployed first; API health and
  both public share endpoints returned 200, while the ordinary Shared Map
  response remained contact-free. The exact six-root client deployed at
  `https://b8dc25b5.senior-resource-map.pages.dev`. All 81 public artifacts
  matched local, immutable Pages, and `https://app.carearound.sg` by bytes and
  SHA-256 with aggregate
  `972a4e186846edb5afed7b43333b6fa317458605f542111020b42f3f3de667e0`.
  Production Playwright UAT at 400x520 confirmed 4 mapped resources, all 4
  mapped Group-member pins remain after selecting ICCP, and a selected place
  shows its name/address only once. Public production smoke passed 1/1; the
  five authenticated cases were not run because their configured credentials
  were absent. Existing map 25 and its frozen snapshot were read-only during
  verification, so the owner must use `Update shared link` once before its
  embed receives newly frozen contact fields and exact member keys.

## 2026-08-08 embedded-map presentation enrichment production release

- Current behavior: the website embed reuses the production Detailed-map
  fixed surfaces automatically when the locked six-root build enables them.
  The compact resource preview now displays the resource logo, then the map
  category icon, category icon, or a letter fallback. No new map setting,
  owner action, download surface, or geolocation control is exposed in the
  iframe.
- Annotation privacy contract: owner Print View annotations remain private by
  default. An owner must select an annotation and explicitly enable `Share
  this annotation`; the annotation becomes public only after `Update shared
  link`. Publishing freezes only opted-in annotations into the existing Shared
  Map snapshot, strips the visibility flag, and exposes the sanitized shapes
  read-only only to the embed endpoint. The ordinary Shared Map endpoint and
  page remain annotation-free. Duplicates always start private, and changing
  only the share flag does not invalidate PNG/PDF capture preparation.
- Snapshot and stale-state behavior: changes to the public annotation subset
  advance the owner map update timestamp so the existing Share dialog warns
  that its frozen link is stale. Private-only annotation edits do not create a
  public-share warning. Unchecking a previously shared annotation leaves the
  old frozen snapshot public until the owner intentionally updates the shared
  link, matching the existing resource/note snapshot contract.
- Architecture and blast radius: server commit `699b33ca` adds one optional
  boolean inside the existing annotation JSON document and one sanitized
  snapshot field; no table, route, migration, permission, auth, personal-place,
  resource-visibility, or R2 change is introduced. Client commit `bfd17423`
  adds one embed-only fixed-surface loader and read-only presentation changes.
  Existing owner My Map, Print View editing, six-root Detailed behavior,
  annotations, exports, Shared Map directory, embed allowlist/revocation,
  framing policy, and list-only disclosures retain their current contracts.
- Reproduction and acceptance: in an owned map's Print View, select one
  annotation, enable `Share this annotation`, save, and confirm the Share
  dialog requests an update. Update the shared link and load the approved
  iframe. At displayed zoom 14 confirm the v3 overview surface; at zoom 15
  confirm the v2 native surface; where unavailable confirm the regular map
  remains usable. Select a pin and confirm its resource preview has logo/icon
  fallback. Confirm the opted-in annotation renders read-only, a private
  annotation does not, and the ordinary Shared Map still has no annotation.
  Uncheck the shared annotation, update the shared link, and confirm it is no
  longer in a fresh embed response.
- Verification: focused server coverage passes 59/59; focused
  embed/map/annotation client coverage passes 93/93; the full server suite
  passes 520/520; full client/source coverage passes 587/587; map lockdown
  passes 84/84; `git diff --check` passes; and the exact six-root production
  build passes with only the established browsers-data advisory. Worker
  `10d07e2a-2d22-4dfc-8080-ed0d3aa72f59` and Pages
  `https://d584a8d6.senior-resource-map.pages.dev` are live. All 80 local,
  immutable, and custom-domain artifacts match by MIME, bytes, and SHA-256;
  aggregate SHA-256 is
  `2be419b82246c3674fb73691e40f028bd07251720d404a3bdc4a5c3bb92d5827`.
  Automatic deployment `2bbe37de` briefly displaced the first controlled
  deploy after the `main` push; the validated dist was republished only after
  that build completed.
- Production acceptance: public smoke passes 1/1. Five authenticated smoke
  cases were not started because their configured credentials were absent, so
  6/6 is not claimed. Signed-in Chrome UAT on existing map 25 confirmed two v2
  native Detailed chunks at displayed zoom 15, zero live basemap tiles, and
  the expected selected-resource logo without mutation. Disposable map 298
  proved annotation opt-in, sanitized frozen read-only rendering, opt-out and
  snapshot update removal, and the ordinary Shared Map's annotation-free
  response. It was then unpublished and deleted; its retired token returns
  404 from both public Shared Map API routes.

## 2026-08-08 map-only website embed V1 production release

- Current behavior: a My Map owner must first publish the existing frozen
  Shared Map snapshot, then may separately approve up to ten exact website
  origins and enable `Website embed`. The Share dialog previews the compact
  map, displays mapped and list-only counts, and generates one lazy 520-pixel
  iframe. Disablement or approved-origin removal is live and does not require
  republishing; unpublishing disables embedding and a future republish remains
  disabled until the owner explicitly enables it again. Enabling requires a
  matching frozen snapshot; a legacy published map must use `Update shared
  link` first rather than falling back to live owner data.
- Guest boundary: `/embed/maps/:token` boots a separate client provider tree
  without auth, Google sign-in, saved resources, account navigation, or PWA
  registration. Its credential-free API response is rebuilt through the
  existing frozen guest Shared Map and additionally omits asset summaries,
  notes, save/access/profile metadata, personal places, print annotations, and
  embed settings. The UI exposes only map name, category-bubble pins/clusters,
  search, category filters, reset/zoom, one selected-resource preview,
  list-only disclosure, full-map/resource links, and required attribution.
- Framing and revocation boundary: ordinary app HTML keeps global
  `frame-ancestors 'none'` plus `X-Frame-Options: DENY`. One Pages Function is
  routed only for `/embed/maps/*`, verifies the live allowlist through a
  minimal Worker endpoint, removes the frame header only from that response,
  sets exact `frame-ancestors 'self' <approved origins>`, disables sensitive
  browser permissions, prevents indexing/caching on both Pages and Worker
  responses, and serves a no-data
  unavailable document if configuration cannot be verified. Origins require
  HTTPS in production; paths, queries, fragments, credentials, wildcards, and
  unsafe persisted values fail closed. HTTP is limited to loopback UAT.
- Architecture and blast radius: additive `embed_enabled` and
  `embed_allowed_origins` My Map columns, one authenticated owner PATCH, two
  guest read endpoints, one isolated embed bootstrap/page, and one additive
  Share-dialog section. Existing `/shared/maps/:token`, sharing snapshots,
  Shared Map copy/save, owner My Map, Print View, Detailed surfaces,
  annotations, exports, visibility filtering, auth/session behavior, and
  global headers retain their current contracts. The release starts from
  deployed source base `967cf183d` on `codex/map-only-embed-v1`.
  The approval-gated schema apply is narrowed to those two columns through
  `bootstrap:map-embed-schema`; it verifies both and does not execute the wider
  boundary-schema catalogue.
- Reproduction and acceptance: publish an owned map, add an exact approved
  origin, enable Website embed, and confirm preview/code appear. Load the code
  at a 900x520 approved parent and confirm map/search/filter/pin preview,
  external-tab links, list-only notice, and attribution. At a coarse pointer,
  confirm the interaction guard, Done, and Escape release. At 399 pixels high,
  confirm guidance requests at least 400 pixels. Load the identical iframe from
  an unapproved parent and confirm the browser blocks it through
  `frame-ancestors`. Disable embedding, remove the parent origin, and unpublish
  in turn; each next load must fail closed while the ordinary Shared Map stays
  readable where applicable. Confirm a browser session cookie never changes
  the embed viewer or payload.
- Verification: full server coverage passes 517/517; full client/source
  coverage passes 587/587; the map-lockdown aggregate passes 84/84; and the
  exact six-root production build passes with only the established advisories.
  Production smoke passes 6/6. Authenticated custom-domain Playwright UAT on a
  disposable duplicate with one mapped pin passes owner Share preview,
  approved 900x520 desktop search and pin preview, unapproved-parent CSP block,
  mobile guard/Done/Escape, the sub-400-pixel warning, guest payload privacy,
  authenticated/guest payload parity, live origin removal, embed disablement,
  unpublish revocation, republish token rotation, and disabled-by-default
  republish. All disposable maps were verified deleted and the private mapped
  source remained unchanged.
- Release evidence: additive schema verification found exactly the two embed
  columns. Server commit `0720e206d` deployed as Worker version
  `5604c307-7c70-45ec-98eb-1470d1e51576` before client commit `3d4c1a66b`.
  Cloudflare edge recovery `d57fdf35a` replaced the unsupported Function fetch
  redirect mode, and owner-preview recovery `eaf06c32c` allowed only same-origin
  frames while retaining ordinary `frame-ancestors 'none'` and XFO DENY.
  Exact production Pages deployment
  `https://990a7047.senior-resource-map.pages.dev` and
  `https://app.carearound.sg` match the controlled 80-file static manifest
  byte-for-byte at aggregate SHA-256
  `0302b635f630e85dfdf41955c47d86ea0a3e125aacbe18f8ab7a53cac604dc89`,
  with no JavaScript/CSS MIME failures. Unknown embed tokens fail closed through
  the Pages Function with 404 and `no-store`; ordinary HTML remains globally
  non-frameable.
- Release state: production release complete. Both planned functional commits
  were followed by two narrowly scoped, test-backed recovery commits discovered
  by edge and authenticated production UAT. No R2 object, existing map,
  resource, Shared Map snapshot, auth setting, permission, or secret changed.
  `docs/release-manifest-2026-08-08-map-only-embed-v1.md` records the full
  release and rollback evidence.

## 2026-08-07 owner Print View Detailed-map transient-load stabilization release

- Candidate behavior: owner My Map Print View uses the same locked fractional
  zoom-step resolver in both the Leaflet counter and the external print control
  dock. A contained raw camera at `13.9` is therefore displayed as level `13`,
  not rounded up to a misleading level `14`. Exact zoom 14 continues to select
  the v3 overview atlas and exact zoom 15 continues to select the v2 native
  surface.
- A terminal source or selected-surface manifest error now exposes one explicit
  `Retry detailed map` action inside Map appearance. The action clears only the
  local fallback notice and increments one reload generation, aborting any
  superseded source requests and restarting the existing bounded loaders for
  the four Default/Gray native/overview source roots. It does not introduce an
  autonomous retry loop, change the camera, rewrite fixed-map selection, or
  alter R2 assets. While the reload is pending the retry action disappears; on
  success the existing Detailed auto-mode resumes.
- Tier-status boundary: the Map detail control now evaluates the manifest,
  asset root, availability, and outside-coverage state for the active zoom
  tier supplied by `DirectoryMap`. A native-tier error cannot falsely label a
  healthy zoom-14 overview tier unavailable, and an overview-tier error cannot
  hide a healthy zoom-15 native tier.
- Known-good reference and blast radius: this candidate starts from annotation
  release evidence commit `699568b4a` and accepted production Pages deployment
  `https://6c8562eb.senior-resource-map.pages.dev`. The patch is limited to the
  external print zoom label, existing Map detail status/action control, and the
  owner page's existing fixed-map source effects. It does not change zoom/tier
  thresholds, containment, camera fitting, chunk pruning or memory caps,
  manifests/chunks, attribution, map colour, resource pins/cards, annotations,
  Print layout, PNG/PDF export, Shared Maps, auth, permissions, API/Worker,
  schema, secrets, R2 objects, or production data.
- Reproduction and acceptance: open an owned map in Print View with Detailed
  compiled in. At a contained raw zoom `13.9`, confirm both visible zoom
  counters say `13`. At exact zoom 14, confirm only v3 overview chunks render;
  at exact zoom 15, confirm only v2 native chunks render; at both tiers confirm
  no OneMap live tiles remain under the Detailed surface. Force all four root
  source requests through their bounded terminal failure, open Map appearance,
  confirm the regular-map fallback and `Retry detailed map` action, restore the
  source responses, select Retry once, and confirm the action disappears,
  Detailed becomes available/selected, fixed layers render, and no full-page
  reload is required.
- Pre-deploy verification: new source guards first failed against the rounded
  external label and missing reload/action path, then passed after the patch.
  Focused map/print coverage passed 68/68; the locked map aggregate passed
  84/84; full client/source coverage passed 572/572; full server coverage passed
  502/502; `git diff --check` passed; and the exact six-root production client
  build passed with only the existing browsers-data and large-chunk advisories.
  Mocked-auth real-Leaflet built-app
  UAT forced four retryable 503 responses for each native/overview Default/Gray
  root until terminal fallback, then restored the sources and confirmed the
  explicit retry recovered to Detailed with fixed layers and zero live tiles.
  The same browser proved raw zoom `13.9` displayed `13` in both counters,
  zoom 15 rendered 18 native v2 layers and zero overview/live-tile layers, and
  zoom 14 rendered 48 overview v3 layers and zero native/live-tile layers
  across the visible and hidden export maps.
- Release state: implementation commit `fd098c980` is pushed on
  `codex/annotation-drawing-ux`. The feature-branch Pages preview deployed at
  `https://5ecf7da4.senior-resource-map.pages.dev`; the identical validated
  `client/dist` was explicitly published to the production branch at
  `https://6ee1710f.senior-resource-map.pages.dev`.
- Artifact verification: local, immutable production, and
  `https://app.carearound.sg` copies returned 200 with matching bytes, SHA-256,
  and MIME for `index.html`
  (`42fb3394e86e29871a61d703e648d841474dff25b7e2ab1f86432ce18aefa243`),
  entry JavaScript
  (`77cde00bf4a761008cd1a78396176f52f0b213d1a5c84356d075f7ae5457255f`),
  CSS (`5b514c320796df984cc22e19b072a6c68ae0c3acd0769c72f6b53a0f1e9c665b`),
  My Map (`0b48c038b74f3072e489efb24d6393baf3a19ffb0f146e190a8ac719f5f1ae55`),
  map export (`863ebe6062a9862b40cdf6be19f50ce2ef8219a97d70e85eed8f40890c2bc9f5`),
  Shared Map (`92bd2d47beb400ba785acab3731aec9756432adf86ed51c5f0527106461be2c5`),
  and shared distance runtime
  (`bf7d312e2967c884cbbc0ff2751f0f133058fddbb5b5625fb7f18fa9918e7e97`).
  The deployed bundle retained all six fixed-map roots and the locked map/export
  markers; core routes returned 200 and the production API health endpoint
  returned JSON `status: ok`.
- Production acceptance: authenticated custom-domain smoke passed 6/6 across
  public load, partner login/resources, postal import, disposable-map
  creation/cleanup, saved-resource navigation, and schedule editing. Signed-in
  Chrome UAT on the real 35-resource owner map 258 opened Print View at the
  corrected contained level 13, then confirmed displayed zoom 14 in `town` /
  `overview` mode with 12 v3 chunks and zero native/live tiles, and displayed
  zoom 15 in `town` / `native` mode with 8 v2 chunks and zero overview/live
  tiles. Map appearance showed Detailed selected and available, with no
  unavailable notice or retry action in the healthy state. No production
  failure was injected and no map content was mutated. No Worker/API, schema,
  auth, permission, secret, R2 asset, Shared Map visibility, or production-data
  change was deployed.

## 2026-08-07 owner Print View annotation-tool refinement release

- Released behavior: the owner Full-map Print View annotation toolbar no
  longer offers the location-style `Label pin` creation tool. Existing saved
  pins remain compatible. The on-map Move and Rotate handles replace ambiguous
  text glyphs with clean four-arrow and single-clockwise-arrow SVG icons while
  retaining their 44-pixel drag targets.
- Shape rotation now supports lines, boxes, circles, and boundaries. Lines and
  boundaries rotate their geometry; boundaries also rotate their inside note.
  Boxes render from their existing two opposite corners plus one bounded saved
  angle, so their outline and note rotate together without converting their
  stored geometry. Circles keep the same centre and radius while only their
  inside note rotates. Rotated boxes retain visible opposite-corner adjustment
  handles and one completed drag remains one Undo/autosave step.
- Architecture and compatibility boundary: optional `rotationDegrees` metadata
  is normalized to `[-180, 180)` only for box, circle, and boundary annotations.
  It is an additive schema-version-1 JSON field accepted by the Worker
  validator; there is no database migration or table/API-route change. Old
  documents remain valid, zero-degree annotations keep their existing shape,
  Duplicate preserves the angle, and invalid or unsupported rotation metadata
  is rejected or removed. Pin normalization, persistence, rendering, export,
  selection, relabelling, Move, Duplicate, Delete, Undo/Redo, and layer order
  remain intact. Shared Map, auth, permissions, map assets, resource pins, and
  production data are unchanged.
- Reproduction and acceptance: open an owned map in Full-map Print View and
  choose Annotate. Confirm no `Label pin` creation option appears and the
  remaining seven tools do. Select Move and Rotate and confirm the new icons
  are recognisable. Rotate a line, box, circle with an inside note, and boundary;
  confirm live pointer-following updates, the circle outline remains fixed,
  the box outline follows its note, and Undo reverses exactly one completed
  drag. Return to Select and resize the rotated box from either visible corner.
  Duplicate each rotated area shape, wait for Saved, reload, and confirm visible
  and PNG/PDF export parity. Confirm any previously saved pin still renders and
  retains its non-creation actions.
- Release verification: the new client and server contracts failed
  before implementation, then passed. Focused client/server annotation coverage
  passed 23/23; full client/source coverage passed 572/572; full server coverage
  passed 502/502; map-lockdown coverage passed 84/84; and the exact six-root
  production client build passed with only the existing browsers-data and
  large-chunk advisories. A mocked-auth real-Leaflet built-app check confirmed
  the refined icons, live box rotation, circle-text-only rotation, Saved state,
  Undo availability, and correctly attached rotated-box adjustment handles.
- Release state: implementation commit
  `61182bf52f3760f052414cf0519c6ffa4388342b` is pushed on
  `codex/annotation-drawing-ux`. Compatible Worker version
  `9b06d6b5-e94e-4342-8ec2-8e3002d9c6e3` deployed first to
  `api.carearound.sg`; its production health endpoint returned 200 JSON
  `status: ok`. The exact validated `client/dist` then deployed to the Pages
  production branch at `https://6c8562eb.senior-resource-map.pages.dev`.
- Artifact verification: local, immutable Pages, and
  `https://app.carearound.sg` copies returned 200 with matching bytes, SHA-256,
  and MIME for `index.html` (`607ab090292079e4ae853d2b08cb267051583b1f4b1d6d027a66374ce8a9109c`),
  entry JavaScript (`0bb6c16a0eb5a76af03f1d6d07f39c384fe08ee0e8d8f8a0f46feef09853098b`),
  CSS (`5b514c320796df984cc22e19b072a6c68ae0c3acd0769c72f6b53a0f1e9c665b`),
  My Map (`2029c510b0002739196356f0eddb0970cee3abcf975e21cb4e3930a8b7c162c2`),
  map export (`55bdcad6ecb2006dea931d519e3a343822d894ff9655cc522096a3efa295352a`),
  Shared Map (`18459689022a1273762214ac6b152bc6f4683756d2ae49ba5ffc6d7b096ce541`),
  and shared distance runtime
  (`762e6287fadc07932ed9b623dd1e027f952258ef7bf00b5de8653bd95a775cb6`).
- Production acceptance: authenticated custom-domain smoke passed 6/6 across
  login, resources, postal import, disposable-map creation/cleanup,
  saved-resource navigation, and schedule editing. A second authenticated
  disposable-map check saved rectangle angle 31, circle-note angle -42, and
  polygon angle 76 through the deployed Worker; all three reloaded exactly as
  revision advanced from 0 to 1. The temporary map was deleted in `finally`.
  No UAT data remains. No database migration, table/API-route, auth,
  permission, secret, map-asset, Shared Map visibility, or production-resource
  change was deployed.

## 2026-08-07 owner Print View annotation transform tools release

- Released behavior: owner Full-map Print View annotation editing adds
  dedicated Move and Rotate modes plus a one-click Duplicate action. Move
  translates a selected pin, line, box, circle, or boundary as one item without
  changing its internal geometry. Shapes use a highlighted 44-pixel centre
  handle; pins remain directly draggable. Rotate gives selected lines and
  boundaries a highlighted 44-pixel rotation handle with a live guide. Boxes
  remain axis-aligned, circles have no visible orientation, and pins have no
  rotation contract, so the toolbar explains that those types do not rotate.
  Duplicate creates one slightly offset private copy directly above the source
  layer and selects it for immediate adjustment.
- Architecture and blast radius: translation and rotation operate only on the
  existing annotation point arrays. Boundary transforms keep `points` and
  `controlPoints` identical, and every live drag preview remains local Leaflet
  state until mouse-up performs one existing annotation-document replacement.
  Duplicate creates a new existing-shape record with a new annotation id and
  performs one document replacement. There is no new document field, API,
  schema, ownership, permission, autosave, export, Shared Map, map-asset,
  category-order, resource-removal, or production-data path. Rotation is
  intentionally limited instead of changing the two-corner rectangle model.
- Known-good reference: this candidate starts from the locked Release 2
  implementation `9915de2a8ac924d101003d8506492529264fcfcf` and final evidence
  branch commit `4bdeade6ffe0d400b59a051eec4420d73702ae07`. Existing drawing
  previews, control-point adjustment, one-step Undo, serialized autosave,
  private persistence, frozen export preparation, PNG/PDF parity, map behavior,
  six Detailed roots, and Shared Map privacy remain the comparison baseline.
- Reproduction steps: sign in as a map owner, open Full-map Print View and
  Annotate, select each annotation type, choose Move, and drag the highlighted
  centre handle or selected pin. Confirm the whole annotation follows live and
  one Undo restores its exact prior geometry. Select a line and boundary,
  choose Rotate, and drag the rotation handle around the centre; confirm the
  shape and any in-shape note follow live and one Undo reverses only that
  rotation. Select a box, circle, or pin in Rotate and confirm the explicit
  unsupported guidance with no transform handle. Choose Duplicate on each
  selected type; confirm one offset copy appears immediately above the source,
  becomes selected, preserves its content/style, and disappears with one Undo.
  Wait for Saved, close the editor, reload, and verify visible/export parity.
- Acceptance criteria: Move supports all five saved annotation types without
  point distortion; Rotate supports lines and boundaries without adding saved
  rotation metadata; live transform paths update before document commits;
  every completed transform and duplicate action produces exactly one history
  and autosave step; duplicate ids are new and its geometry is visibly offset;
  drawing modes still suppress existing-shape hit testing; Select control-point
  editing, layer ordering, deletion, Undo/Redo, persistence, exports, private
  ownership, and map behavior remain unchanged.
- Release verification: geometry and source coverage passed
  15/15; focused annotation, layer, and Print View coverage passed 47/47; full
  client/source coverage passed 571/571; full server coverage passed 502/502;
  map-lockdown coverage passed 83/83; and the exact six-root production client
  build passed. A disposable real-Leaflet harness proved Duplicate increased
  the document commit count from zero to one and rendered two independent
  paths. During Move, the selected SVG path changed while the count stayed at
  one, then mouse-up changed it to two. During Rotate, the path again changed
  live while the count stayed at two, then mouse-up changed it to three. Move
  and Rotate handles were both 44 by 44 pixels, and the final browser console
  had zero warnings/errors. The harness and Vite process were removed.
- Release state: implementation commit
  `d0f7662c052154127b08cd399b7e1ad64012c791` was pushed to
  `codex/annotation-drawing-ux`. The exact validated `client/dist` deployed to
  branch preview `https://0611ba33.senior-resource-map.pages.dev` and was then
  explicitly published to the Pages production branch at
  `https://00082b30.senior-resource-map.pages.dev`. The immutable production
  deployment and `https://app.carearound.sg` are byte-identical to local HTML,
  entry JavaScript, CSS, My Map, map-export, Shared Map, and shared-runtime
  artifacts with correct MIME types. Their SHA-256 values are respectively
  `cd74b329fdb09ce7435ceefc12c0ff794f87681ffd83cbcbf5f88ec86656454a`,
  `a74f7b732d2eba2d1f16758ba8404c9059ee4a88b8d3346cecf9f56a58c92712`,
  `5b514c320796df984cc22e19b072a6c68ae0c3acd0769c72f6b53a0f1e9c665b`,
  `358c6f6a0d2f4ceb6a4089ead959b4ed7f9d8f7d4abd4de0fb89aa92b0572543`,
  `4ad361dbb3b5f45ac0036b339844126532519b46037cba5cc30329baffec4876`,
  `a599faa2d433d1e2ca8c10553d3c4b0066f401f9f276bf22899b711f5cf32d97`,
  and `f250af9caef27464359f50f80a6b7177284149abdd2c4b308a76121fe75beecc`.
  The custom domain briefly served SPA HTML for two new JavaScript paths during
  edge propagation; both recovered to exact JavaScript bytes before the gate
  continued. Core app routes returned 200, API health returned `status: ok`,
  required six-root and annotation markers passed, forbidden rollback markers
  stayed absent, and authenticated production smoke passed 6/6 with its
  temporary map cleaned up. No Worker, schema, auth, secret, map-asset, Shared
  Map visibility, or production-resource deployment was performed.
  Product-specific owner UAT of Move, Rotate, Duplicate, Undo/Redo,
  persistence, and export parity remains the next acceptance gate.

## 2026-08-07 owner Print View annotation umbrella stabilization gate

- Stable behavior: Product Release 1 and Product Release 2 now form one locked
  owner Print View annotation baseline. Selected line, rectangle, circle, and
  polygon control points follow the pointer during a drag, preserve rapid
  sequential edits, and commit one annotation-document change per completed
  drag. Line, box, and circle show request-animation-frame-throttled live
  previews and create on click two; boundary drawing previews each next edge
  and completes once through Done or Enter after three points. Existing shapes
  receive input only in Select mode. Private persistence, revision ordering,
  autosave, undo/redo, the frozen hidden-export snapshot, Resource PNG
  independence, latest-document PNG/PDF readiness, owner-only editing, and
  Shared Map privacy remain unchanged.
- Known-good release chain: the pre-enhancement comparison baseline is
  `234ff092a`. Release 1 is implementation commit `295ebfd4b` with evidence
  commit `6fbb049d` and immutable Pages deployment
  `https://f2f6179a.senior-resource-map.pages.dev`. Release 2 is implementation
  commit `9915de2a8ac924d101003d8506492529264fcfcf` on production `main`, with
  evidence commit `1bf49939cf448cad688dbcc6b7d6001d3c62d079` on
  `codex/annotation-drawing-ux` and immutable Pages deployment
  `https://8f9840b9.senior-resource-map.pages.dev`. Release 2 contains Release 1
  in its Git ancestry. Each release remains independently reversible: redeploy
  Release 1 to remove only the drawing-UX slice, or redeploy `234ff092a` to
  remove both interaction slices without a Worker or schema rollback.
- Final quantitative performance evidence: a disposable real-Leaflet browser
  harness imported the current combined production component. All four polygon
  targets retained logical `44px` by `44px` dimensions; one drag produced eight
  distinct live SVG paths. That drag plus 30 rapid alternating vertex drags
  produced exactly 31 committed snapshots. Both final handle centres matched
  their accepted endpoints with zero-pixel drift, and the browser reported no
  warning or error. The harness and its Vite process were removed, and the
  worktree returned to its prior unrelated-untracked-only state.
- Final regression evidence: focused annotation and Print View coverage passed
  41/41; combined client/source and town-map coverage passed 585/585; full
  server coverage passed 502/502; map-lockdown coverage passed 81/81; the
  map-lockdown aggregate and exact six-root production client build passed;
  and `git diff --check` passed. The build retained native Default/Gray,
  zoom-14 atlas Default/Gray, and Print Master Default/Gray roots. Only the
  existing browsers-data and large-chunk advisories were emitted.
- Final artifact verification: fresh local `client/dist`, the immutable Release
  2 deployment, and `https://app.carearound.sg` were byte-identical with the
  correct MIME type for HTML, entry JavaScript, CSS, My Map, map export, Shared
  Map, and the shared map runtime. Their SHA-256 values remained
  `bdb158c0567820bbe6b1eafe6fb8316a2e2f81c26149af7c9d5ffbaf32d89db7`,
  `e663e6daa352ea3d070d71d97cb8effc21a7a7f476fa1dd2b278f846c958b2a9`,
  `409ba9ac3df8e5e9554757073689b53c74888a618abe55d27d4fe6851c6d0b0b`,
  `573e2d78a6071c536f3225c78dd31f569dfd3ae84adf724a3b7e8c7e98cd41d6`,
  `1c6cd69b4681188b7116b8a069e34e25a8eb3d4543555d1d5143d8c573c689f0`,
  `9f9cd830ac7678d7084dd5af9f67ef90784391109cde9a07a3e6e4f441fa8ceb`,
  and `89d46223f343e2691f4bd3041ec8749e76b694770938de470cdab707aae70243`.
  `/`, `/login`, `/discover`, and `/my-directory/maps` returned 200 app shells,
  and `https://api.carearound.sg/api/health` returned 200 with JSON `status: ok`.
- Final authenticated production UAT: owner map 258 started with only its
  established private annotation. A temporary boundary showed two different
  live next-edge paths before a second point was saved; Done stayed disabled at
  two points and enabled at three; Enter completed one selected three-point
  boundary, and a repeated Enter did not add a pane. Its three logical 44-pixel
  handles accepted two consecutive drags; the second path differed from the
  first, and one Undo restored exactly the first accepted geometry. Autosave
  reached Saved. After the editor closed, Map PNG and PDF became ready and the
  temporary annotation appeared on both visible and hidden-export surfaces. It
  survived a full reload, was reselected and deleted, and autosave again reached
  Saved. A final clean reload retained the original annotation on both surfaces,
  contained no temporary annotation, reached `Map ready to download`, and
  produced no new application warning or error. The authorized UAT advanced the
  private annotation revision but left no temporary content behind.
- Final acceptance: the umbrella annotation goal is technically stabilized and
  has no remaining runtime, production, data-cleanup, or UAT gap. Standalone
  text, arrow, freehand/lasso, road-snap, and touch-only editing remain
  intentionally unsupported. This final gate changes documentation only; it
  does not deploy a Worker, schema, auth, permission, secret, map asset, or
  production-resource change.

## 2026-08-07 owner Print View annotation drawing UX

- Current candidate behavior: on branch `codex/annotation-drawing-ux`, owner
  Full-map Print View drawing tools show live geometry after the first click.
  Line, box, and circle preview the pointer position and create immediately on
  the second click; they no longer require a separate Done action. Boundary
  drawing keeps its multi-point workflow, previews each next edge, and can
  finish with Done or Enter after three points. The toolbar gives step-specific
  guidance, and a selected shape tells the owner to drag its highlighted
  control points. Existing annotations accept selection and drag input only in
  Select mode, so they do not intercept clicks while a drawing tool is active.
- Known-good reference: this Release 2 candidate is based on Release 1 evidence
  commit `6fbb049d`, whose production implementation is `295ebfd4b`. Release 1
  remains the reference for responsive control-point dragging, one commit per
  drag, private persistence, undo/autosave, frozen hidden-export scheduling,
  PNG/PDF parity, map pins and camera, Detailed/Live layers, and Shared Map
  privacy.
- Architecture and blast radius: pointer previews are request-animation-frame
  throttled and held only in local annotation-layer state. Preview coordinates
  are normalized for rendering but never enter the annotation document. Only
  the existing final `onCreate` path creates an annotation. The two-point tools
  complete through that path on click two; polygon retains the same bounded
  control-point document and existing Done callback, with Enter as an additive
  shortcut. Existing annotation hit testing is disabled only while a drawing
  tool is active and returns unchanged in Select mode. There is no API, schema,
  owner/privacy, annotation-document, autosave, export, PDF, resource pin,
  category order, resource-card removal, map asset, Shared Map, or production
  data change.
- Reproduction steps: sign in as a map owner, open Full-map Print View, and
  open Annotate. Choose Draw line, click its start, and move the pointer;
  confirm the unfinished line follows the pointer and the helper advances from
  step 1 to step 2. Click its end and confirm one selected line appears without
  choosing Done. Repeat for Draw box and Draw circle. Choose Draw boundary,
  add two points, confirm the next edge previews, add a third point, and finish
  once with Enter; repeat with Done. Start a new boundary directly on top of an
  existing shape and confirm drawing continues instead of selecting that
  shape. Return to Select and confirm saved shapes can still be selected and
  adjusted with their control points.
- Acceptance criteria: live line, box, circle, and boundary previews track the
  pointer without adding saved points or annotation revisions; line, box, and
  circle create exactly once on click two; their Done action is absent;
  boundary Done remains disabled below three points and Enter/Done create
  exactly once at or above three; repeated Enter after completion is inert;
  drawing over an existing annotation does not change tools or leave a stray
  draft point; Select-mode shape editing remains available. Existing private
  persistence, revision ordering, autosave, undo/redo, exports, map behavior,
  and sharing boundaries remain intact.
- Verification result before the Release 2 gate: focused annotation and Print
  View coverage passed 41/41; full client/source coverage passed 569/569, and
  the same suite plus town-map script coverage passed 585/585; full server
  coverage passed 502/502; map-lockdown coverage passed 81/81; and the exact
  six-root production client build completed successfully. A disposable local
  harness rendered the production annotation layer and toolbar in a real
  Leaflet map. Before the second click, a line preview changed from
  `M625 233L775 333` to `M625 233L825 383` while commit count remained zero;
  click two produced one selected two-point line and two edit handles. Box and
  circle previews rendered before click two and each then produced one selected
  two-point annotation without residual draft geometry. A boundary started on
  top of an existing circle without selecting it, previewed its next edge,
  enabled Done only after point three, and Enter produced one three-point
  polygon; a repeated Enter did not increment the commit count. The final
  selected polygon rendered three control handles. The browser reported zero
  errors and zero warnings. The disposable harness and browser artifacts were
  removed after inspection. Release 2 has not been committed, pushed,
  deployed, or production-UATed at this ledger entry.
- Production release: implementation commit
  `9915de2a8ac924d101003d8506492529264fcfcf` was pushed to
  `codex/annotation-drawing-ux` and fast-forwarded to `main`. The final exact
  six-root artifact was published to Cloudflare Pages production at
  `https://8f9840b9.senior-resource-map.pages.dev`. One otherwise exact direct
  upload was discarded as release evidence because its expanded commit
  metadata was mistyped; the final deployment carries the Git-confirmed full
  SHA above. A concurrent Git-triggered production build briefly won the custom
  domain and returned SPA HTML for the new My Map and Shared Map JavaScript
  paths. The final exact publish and propagation restored byte-identical HTML,
  entry, CSS, My Map, map-export, Shared Map, and shared map-runtime assets on
  both the immutable preview and `https://app.carearound.sg`, with correct MIME
  types. Their SHA-256 values were
  `bdb158c0567820bbe6b1eafe6fb8316a2e2f81c26149af7c9d5ffbaf32d89db7`,
  `e663e6daa352ea3d070d71d97cb8effc21a7a7f476fa1dd2b278f846c958b2a9`,
  `409ba9ac3df8e5e9554757073689b53c74888a618abe55d27d4fe6851c6d0b0b`,
  `573e2d78a6071c536f3225c78dd31f569dfd3ae84adf724a3b7e8c7e98cd41d6`,
  `1c6cd69b4681188b7116b8a069e34e25a8eb3d4543555d1d5143d8c573c689f0`,
  `9f9cd830ac7678d7084dd5af9f67ef90784391109cde9a07a3e6e4f441fa8ceb`,
  and `89d46223f343e2691f4bd3041ec8749e76b694770938de470cdab707aae70243`.
  The deployed build retained all six map roots, `resize moveend zoomend`, the
  regular-map fallback, `Save PDF`, the Release 2 helper copy, and
  request-animation-frame preview scheduling; retired Standard-map wording and
  `Save A3 PDF` remained absent. Core app routes and production API health
  returned 200/OK. No Worker, schema, auth, permission, secret, map asset, or
  production-resource release was made.
- Authenticated production UAT: owner map 258 began with its existing private
  boundary. Line preview geometry changed at two pointer positions before
  click two created one selected two-point line with two handles and no Done
  action. Box and circle each rendered a live preview, completed on click two,
  exposed two handles, and left no residual draft. Each temporary two-point
  shape was removed and autosaved. A temporary boundary then started directly
  on the existing saved boundary without selecting it or leaving a stray
  draft. Its next edge previewed after points one and two, Done was disabled at
  two points and enabled at three, and Enter created one selected three-point
  polygon; a repeated Enter left the pane count unchanged. The polygon reached
  Saved, survived a full reload, reselected with three handles, and was deleted.
  A final reload proved the original boundary remained in visible and export
  surfaces while every temporary annotation was absent and the map reached
  `Map ready to download`. One session-check timeout occurred during the earlier
  repeated reload sequence but the signed-in map remained usable; a clean
  time-bounded final reload reproduced no application warning or error. The
  authorized UAT advanced the private annotation revision but left no temporary
  annotation content behind.

## 2026-08-07 owner Print View annotation interaction performance

- Current behavior: in owner Full-map Print View annotation editing, line,
  rectangle, circle, and polygon control points update the selected Leaflet
  shape continuously during a drag. Each completed drag commits exactly one
  annotation-document change, so undo remains one step per adjustment. A
  latest-geometry reference carries a rapid second drag forward from the first
  drag's committed coordinates instead of allowing an older React render to
  restore a point. Control-point hit targets are 44 by 44 pixels while their
  visible dots remain compact. While the annotation editor is open, the hidden
  map-export surface holds its last prepared annotation snapshot instead of
  regenerating after every edit; map-dependent downloads become unready until
  the editor closes and one preparation uses the latest saved document.
  Resource PNG remains independently usable throughout.
- Known-good reference: production Release 1 is implementation commit
  `295ebfd4b` on `codex/annotation-interaction-performance` and `main`. The
  prior production behavior at `234ff092a` remains the comparison baseline for
  private annotation persistence, one document and revision, undo/redo, sparse
  polygon anchors, rounded render-only paths, Resource PNG independence,
  nonblank hidden-export readiness, and PNG/PDF parity.
- Architecture and blast radius: this is a client-only interaction and export
  scheduling change. Drag previews are transient local Leaflet mutations;
  persistence still passes through the existing normalized annotation document
  only on drag end. The hidden export panel remains mounted with a frozen
  prepared snapshot, then advances to the latest annotation document when the
  editor closes. There is no API, schema, ownership, sharing, autosave format,
  annotation-document shape, map mode, pin, Detailed/Live asset-root, PDF
  generator, or production-data change. Shared Maps still expose no annotation
  editor or private annotation data.
- Reproduction steps: sign in as a map owner, open Print View in Full-map mode,
  open Annotate, select a polygon, and drag multiple control points rapidly.
  Confirm the path follows each handle, earlier points do not revert, and each
  drag creates one undo step. Repeat with a line, rectangle, and circle; for a
  circle, moving its centre must carry the radius handle with it. Confirm the
  hit area is usable without visually oversized dots. While editing, confirm
  Resource PNG remains available and map-dependent exports wait; close the
  editor, wait for nonblank readiness, and compare the latest annotations in
  PNG and PDF output. Confirm shared and classic map surfaces are unchanged.
- Acceptance criteria: shape geometry follows every handle without visible
  lag or stale-point reversion; rapid sequential edits preserve all accepted
  coordinates; exactly one persistent change and undo entry is produced per
  drag; circle centre/radius geometry remains coherent; control targets meet
  the 44-pixel touch-target size; annotation edits do not continuously rebuild
  the hidden export map; closing the editor prepares the exact latest private
  document; export readiness never implies a stale map image. Existing privacy,
  autosave, undo/redo, sparse-anchor persistence, rounded display geometry,
  Resource PNG independence, map pins/camera/modes, Detailed/Live layers,
  category order, card removal, sharing, authentication, and exports remain
  intact.
- Verification result before release: focused annotation and Print View export
  coverage passed 39/39. Full client/source coverage passed 587/587; full
  server coverage passed 502/502; map-lockdown coverage passed 79/79; and the
  exact six-root production client build completed successfully. A temporary
  local runtime harness imported the production annotation layer into a real
  Leaflet map: all four polygon handles measured 44 by 44 pixels, 30 rapid
  alternating vertex drags produced exactly 30 commits, and every final handle
  centre matched its expected position with no reversion or console error.
  `git diff --check` passed before this ledger update. The pre-release custom
  domain baseline returned 200 with the expected MIME types for HTML, entry
  JavaScript, CSS, My Map, and map-export assets. Their SHA-256 values were
  `eee43f3b6491d4bb09232a2e4cca654d92f34bf389423fa3ccb457452799f80d`,
  `12dc8392e0d61dcadf06733c4d1851dbd78c3ee6645e3be2c17318fbe4ba638d`,
  `409ba9ac3df8e5e9554757073689b53c74888a618abe55d27d4fe6851c6d0b0b`,
  `c49ca7499d545e30c78cbeaecaabc42de9fdf77448eec24a019dc641437fa68e`,
  and `3fafceefcd63a8942c9245eb6c7321060c7c11c1787b127505d32e5d7131975d`.
  Production API health also returned 200.
- Production release: implementation commit `295ebfd4b` was pushed to
  `codex/annotation-interaction-performance` and fast-forwarded to `main`. The
  exact validated six-root `client/dist` was published directly to Cloudflare
  Pages production at `https://f2f6179a.senior-resource-map.pages.dev`. The
  first exact preview at `https://5ac3f945.senior-resource-map.pages.dev` was
  correct, but a concurrent Git-triggered production build briefly won the
  custom domain with different HTML and a Shared Map lazy-chunk request that
  returned SPA HTML. The second exact publish restored full parity. The final
  preview and `https://app.carearound.sg` served byte-identical HTML, entry,
  CSS, My Map, map-export, and Shared Map assets with correct MIME types. Their
  SHA-256 values were
  `d1989cec367cfe0342a461c627f552903e314d36351f1344649d54a1194718f0`,
  `da06aef58f70876acbbce9b5f75b67b7f1480cbbb05cf0b088017cfefc998429`,
  `409ba9ac3df8e5e9554757073689b53c74888a618abe55d27d4fe6851c6d0b0b`,
  `053a263e285dbf4ea028320c5ec891e946809d641024bbeadfabee247491fea5`,
  `7ebddac269bec04cde9fea3bb53b82d6b7032ed5a0036bb6f08a9cc00c01754f`,
  and `a6535a1ac552a1dc5a8ea64cf034911b0b099352e7e5d8113e82e283cdc6b5d7`.
  The deployed build retained all six Detailed/overview/Print Master roots,
  `resize moveend zoomend`, the regular-map fallback, and `Save PDF`; it kept
  the retired Standard-map wording and `Save A3 PDF` absent. `/`, `/login`,
  `/discover`, and `/my-directory/maps` returned the app shell, and production
  API health returned 200/OK. No Worker, schema, auth, permission, secret, map
  asset, or production-resource release was made.
- Authenticated production UAT: owner map 258 began with its existing private
  annotation document. A temporary four-point polygon exposed four compact
  control dots with the intended 44-pixel logical hit targets. Two rapid
  consecutive vertex drags preserved both accepted positions and updated the
  rounded path; one Undo reverted only the second drag while the first remained
  applied. During editing, Resource PNG remained enabled, Map PNG and PDF
  remained disabled, and the hidden export surface intentionally omitted the
  temporary polygon. Closing the editor moved the exact latest polygon path
  into the hidden surface and enabled both map-dependent downloads after the
  nonblank readiness probe. The resulting 5920 by 3644 Map PNG was 5,267,993
  bytes with SHA-256
  `ee2de23deffa7cb070248bb0eea9e6f171dc5131c7dd69935e1e393fa279ccb5`.
  The two-page A3 PDF was 8,050,869 bytes with SHA-256
  `317471f7a0790df7831d3f3b5443a5ab4d6cf8c31c34f2af06018b3aa93c1981`.
  Visual rendering confirmed the same temporary-polygon geometry, map state,
  pins, attribution, and nonblank Detailed surface in Map PNG and PDF page 1,
  without clipping or layout defects. The temporary polygon was then deleted,
  autosave reached Saved, and a fresh reload proved it remained absent while
  the original private annotation rehydrated in the visible and export
  surfaces. The authorized UAT advanced the private annotation revision but
  left no temporary annotation content behind.

## 2026-08-06 owner My Map resource-card removal

- Current behavior: an owner can remove an individual saved Place directly
  from the ordinary My Map card shell, in the same card-level action area used
  by a personal place. A nested Offering keeps its own row-level Remove action
  so a multi-resource location card never has an ambiguous delete target. The
  confirmation names the selected resource, explains that it remains saved in
  My Directory, blocks repeated submission, and refreshes authoritative map
  membership after the API succeeds. Manage resources remains available for
  bulk membership changes.
- Known-good reference: the released My Map category-sequence baseline at
  `fda0ce681` remains the reference for category ordering, resource ordering,
  V2 and classic owner layouts, personal places, notes, map focus, Shared Maps,
  Print View, exports, Detailed/Live layers, and authentication.
- Architecture and blast radius: this is a client-only presentation path over
  the existing owner-protected resource-removal endpoint. Ordinary Place cards
  intentionally suppress a repeated underlying Place row because the card
  title already represents it; the corrected implementation renders that
  primary Place's action on the card shell. Non-primary Offerings retain their
  precise row action. Both paths are owner-only and interactive-only. The
  existing parent handler performs the mutation and authoritative reload;
  confirmation and in-flight guards remain unchanged. There is no API, schema,
  card grouping, resource record, saved-resource, or personal-place change.
- Reproduction steps: sign in and open an owner My Map with an ordinary Place
  card such as the Place cards beside the map. Select the card-level Remove,
  cancel the named prompt, and confirm no membership changes. Repeat and
  confirm removal; verify only that Place and its pin leave the map and that the
  Place remains saved in My Directory. On a card with nested Offerings, verify
  each nested Remove targets only its named Offering. Open a Shared Map and
  Print View and confirm the actions are absent. Confirm Manage resources still
  supports bulk selection.
- Acceptance criteria: a repeated primary Place exposes Remove on its
  interactive owner card shell; nested Offerings expose their own row action;
  no card-level action appears when there is no exact primary Place target;
  cancellation makes no API mutation; repeated submission is blocked; API or
  refresh failure remains visible and does not imply success. Saved resources,
  category sequence, personal places, notes, map pins and focus, filters,
  sharing, Print View, exports, Detailed/Live controls, authorization, Worker
  behavior, schema, and production data remain unchanged.
- Verification result before release: focused card-removal, i18n, shared
  confirmation, Shared Map directory, personal-place, V2, and Print View
  coverage passed 91/91. Full client coverage passed 564/564 and full server
  coverage passed 502/502. `npm run verify:map-lockdown` passed 77/77 and
  completed the required six-root production client build. `git diff --check`
  passed. Custom-domain artifact, smoke, and authenticated disposable-map
  release gates also passed as recorded below.
- Initial production release: implementation commit `83dabe03` was pushed on
  `codex/my-map-card-remove-action`, fast-forwarded to `main`, and deployed as
  the exact validated client artifact to
  `https://b2837a2f.senior-resource-map.pages.dev`. The preview and
  `https://app.carearound.sg` served byte-identical HTML, entry, CSS, and My Map
  chunks with correct MIME types. Their SHA-256 values were
  `9fbd86c3a4ad619d2fe7dd8b9cfd150d86abe13caca457a72c4807da734079d7`,
  `fe3f07cae6a2f8f5099527ab4022bd821d7102c866b16dee6e03a1ca167edfab`,
  `409ba9ac3df8e5e9554757073689b53c74888a618abe55d27d4fe6851c6d0b0b`,
  and `22a1ed0aef5f78f9e79c5f53a385337ce04b2c0c5f0de5da5039e83aee389816`.
  `/`, `/login`, `/discover`, and `/my-directory/maps` returned 200, and
  production API health returned 200/OK. The six-flow production smoke suite
  exited successfully; its dashboard login check passed on the built-in retry
  after one slow first attempt, with the other five flows passing directly.
  Authenticated disposable-map UAT then proved cancel sent no DELETE, confirm
  sent exactly one successful DELETE, saved-resource membership changed from
  12 to 11, the removed Offering remained saved in My Directory, the refreshed
  owner UI removed its row, and Print View exposed zero card-removal actions.
  Disposable maps 277 and 278 were deleted after verification. This was a
  client-only Pages release; no Worker, schema, secret, permission, or lasting
  production-resource change was made.
- Clarification and correction: the user's card screenshot confirmed that the
  primary Place action must live on the ordinary card shell like the personal
  place action. The initial release attached removal to visible nested rows;
  because the repeated primary Place row is intentionally suppressed, ordinary
  Place-only cards did not show it. Focused correction coverage passed 83/83;
  full client coverage passed 565/565 and full server coverage passed 502/502.
  `npm run verify:map-lockdown` passed 77/77 and completed the required six-root
  production client build. Artifact parity and primary-Place disposable-map UAT
  remain release gates.

## 2026-08-06 owner My Map custom category sequence

- Current behavior: an owner using the current My Map experience can open
  Arrange categories and move whole resource categories earlier or later. The
  owner Print View toolbar exposes the same Arrange categories action, so the
  sequence can be changed without returning to the interactive map. The saved
  sequence is applied to the owner directory, shared-map directory, Print View,
  and PDF ledger. Resource cards remain alphabetically ordered by name within
  each category; this enhancement does not expose or persist any resource-level
  sequence.
- Known-good reference: the released My Map and Print View behavior at
  `27237aab1` remains the baseline for map rendering, pins, filters, notes,
  personal places, sharing, and export behavior. The enhancement is additive
  to the current V2 owner interface; the explicit classic fallback remains
  unchanged.
- Architecture and blast radius: category sequence is stored as a normalized,
  deduplicated `category_order` JSONB array on the owning My Map. A narrow
  owner-only PATCH endpoint updates only that field and `updated_at`. The
  existing directory presentation comparator and PDF ledger consume the saved
  category rank while preserving their resource-name tie-breakers. Map copies
  inherit the sequence, and frozen shared maps receive it through the existing
  publish snapshot so an already-published share changes only after republish.
  Unknown or newly introduced categories append alphabetically, which keeps
  legacy maps and partial saved sequences deterministic.
- Reproduction steps: sign in, open an owner map with at least two resource
  categories in the current My Map interface, choose Arrange categories, move
  a category, and save. Confirm category sections change position while every
  resource inside each section remains A-Z. Open Print View, choose Arrange
  categories from its screen-only toolbar, change the sequence, and save;
  confirm the Print View directory refreshes to that saved order and the
  arrangement control is absent from print/export output. Refresh the page,
  generate the PDF ledger, and publish or republish a shared map; confirm the
  same category sequence appears in each surface. Open the map with `?ui=stable`
  and confirm the classic fallback is unchanged.
- Acceptance criteria: only an authenticated map owner can save the category
  sequence; invalid, duplicate, oversized, and mixed-case inputs normalize to
  a bounded canonical list; unranked categories append A-Z; resources never
  gain sequence controls or stored positions; owner Print View reuses the same
  persistent modal and owner-only endpoint instead of keeping a session-only
  print sequence; copied and newly published maps preserve category order.
  Existing My Map selection, filters, map/list modes, Leaflet pins, annotations,
  personal places, sharing privacy, Print View, Detailed/Live controls, exports,
  and authorization remain intact.
- Verification result before release: focused category-order, controller,
  copy/share, directory-presentation, PDF-ledger, schema, i18n, and source
  contract coverage passed. Full server coverage passed 502/502 and full client
  coverage passed 562/562. `npm run verify:map-lockdown` passed 77/77 and
  completed the required six-root production client build. `git diff --check`
  passed. For the follow-up Print View access enhancement, focused category,
  directory, i18n, V2, and Print View coverage passed 68/68; the full client
  suite passed 566/566; `npm run build:client` passed; and
  `npm run verify:map-lockdown` passed 78/78 and completed the required exact
  six-root production client build.
- Follow-up production release: implementation commit `234ff092a` was pushed
  to `codex/print-view-category-arrangement` and fast-forwarded to `main`. The
  exact validated six-root `client/dist` was published directly to Cloudflare
  Pages production at `https://b3d33883.senior-resource-map.pages.dev`. The
  preview and `https://app.carearound.sg` matched local HTML, entry JavaScript,
  CSS, My Map, and Shared Map bytes with the correct MIME types. HTML SHA-256
  was `eee43f3b6491d4bb09232a2e4cca654d92f34bf389423fa3ccb457452799f80d`;
  entry JavaScript was
  `12dc8392e0d61dcadf06733c4d1851dbd78c3ee6645e3be2c17318fbe4ba638d`;
  CSS was `409ba9ac3df8e5e9554757073689b53c74888a618abe55d27d4fe6851c6d0b0b`;
  and the My Map chunk was
  `c49ca7499d545e30c78cbeaecaabc42de9fdf77448eec24a019dc641437fa68e`.
  The deployed My Map chunk contains the Print View category-order trigger and
  retains the six Detailed/Live asset roots. Public app routes returned the app
  shell, production API health returned OK, and no Worker, schema, secret,
  permission, or production-data change was deployed.

## 2026-08-06 owner My Map resource membership and loading recovery

- Current behavior: opening Choose map resources first refreshes the
  authoritative map membership and shows a visible, accessible loading
  indicator while that refresh is in progress. Selection controls remain
  disabled until membership is known. Updating the map keeps the busy
  indicator visible through both the resource mutations and the final map
  refresh; it closes only when the refreshed server membership exactly matches
  the user's selected resources. The server still rejects a true duplicate.
- Root cause and known-good reference: authenticated production inspection of
  owner map 258 reproduced the authoritative `GET /api/my-maps/258` failure as
  Cloudflare's `Too many subrequests by single Worker invocation` error. My Map
  detail hydrated every saved resource with a separate live-asset query and
  could also write refreshed snapshots one by one. The client retained its
  cached directory when that refresh failed, while the saved-resource picker
  could hold newer data. A successful add followed by the failed refresh then
  looked unchecked and a retry correctly hit the server's duplicate guard.
  The picker also rebuilt its initial selection Set from a new array reference
  during unrelated parent renders, allowing in-progress checkbox state to be
  reset.
- Architecture and blast radius: My Map detail now batch-loads all live Places
  and Offerings in at most one query per resource type, while production D1
  snapshot refresh writes use the existing database batch capability. Mocks
  without relational batch methods retain the old compatibility fallback. The
  client uses a small pure membership-diff helper, a one-operation in-flight
  guard, `Promise.allSettled`, and an authoritative post-mutation refresh. A
  duplicate response is treated as recovered only when the final key set is an
  exact match; partial or failed updates keep the modal open with an error.
- Reproduction steps: sign in as the owner of a map containing several saved
  resources, add another saved Place or Offering, reopen Choose map resources,
  and confirm the new resource is checked and appears in the map after refresh.
  Repeat from a stale client snapshot whose server already contains the
  selected resource and confirm Update map reconciles without presenting a
  false duplicate error. Observe the loading indicator while opening and
  updating the picker. Load a map with at least 60 resources and confirm detail
  hydration uses a batched resource read rather than one read per resource.
- Acceptance criteria: authoritative membership drives checkbox state and map
  rendering; the modal cannot submit while membership is loading or unavailable;
  refresh failure never closes the modal as though the update succeeded; true
  duplicates remain blocked; large maps stay below the Worker subrequest limit;
  the spinner is announced through `role=status` and `aria-busy`. Saved-resource
  eligibility, map coordinates, pins, personal places, descriptions, notes,
  sharing, Print View, Detailed/Live surfaces, auth, schema, and production data
  remain unchanged.
- Verification result before release: focused client and server coverage passed
  47/47, including deterministic stale-duplicate reconciliation and a 60-resource
  one-batch hydration fixture. Full client coverage passed 540/540 and full
  server coverage passed 498/498. `npm run verify:map-lockdown` passed 77/77 and
  completed the required six-root production client build. `git diff --check`
  passed.
- Production release: implementation commit `b6dc916a` was pushed on
  `codex/my-map-resource-sync-recovery`. The Worker dry-run passed and production
  version `0ded8dbb-45c2-4b91-bd00-4424b3b526bf` was deployed; `/api/health`
  returned `200` and authenticated owner map 258 loaded 42 resources without the
  earlier Worker subrequest error. The already-validated six-root client artifact
  was deployed without rebuilding to
  `https://c7b6bf26.senior-resource-map.pages.dev`. The preview and
  `https://app.carearound.sg` served the exact local entry, CSS, and My Map chunk:
  `c77bfd333934f430239c10d5075d0fa60822d222ce5e15071682ae82a87fbdf3`,
  `b20754b2e1b782d63a5dea0371e8b7a131f3e5a1f294148652b9ecbd9ce36851`,
  and `208e846e9afffd68d7b989eb2754b9ea72f588db1c4bb426910bc80cc8dfc507`.
  Signed-in custom-domain UAT confirmed the released map loads with no
  subrequest error, opening Manage resources shows the loading status, and the
  settled picker reports 41 selected saved resources with 41 checked rows and
  no false duplicate error. The map contains one additional personal place,
  explaining its total of 42 resources. No picker selection was changed and no
  schema, secret, permission, or production-data mutation was introduced by the
  verification.

## 2026-08-05 owner Print View adjustable pin and number size

- Current behavior: the existing Print layout panel exposes Standard, Large,
  and Extra large pin-and-number sizes whenever resource pins are shown. The
  selected size scales the coloured badge circle, grouped badge spacing, and
  numeric label together in both the visible preview and the hidden PNG/PDF
  export surface. Standard remains the default and reset value.
- Architecture and blast radius: the session-only `printMapState` stores a
  normalized size token and maps it to bounded 1x, 1.25x, or 1.5x rendering.
  `DirectoryPrintView` supplies that scale only to Print badge markers; ordinary
  My Map pins, category bubbles, Shared Maps, and saved coordinates are
  unchanged. The size token participates in the capture-readiness key so a
  changed size invalidates an earlier prepared export. The existing collision
  solver receives the scaled marker and lobe dimensions rather than estimating
  from the Standard badge.
- Reproduction steps: sign in as the owner of map 258, open Print View and the
  Print layout panel, keep resource pins visible, and switch Pin and number size
  between Standard, Large, and Extra large. Confirm the map preview updates,
  nearby and grouped numbers remain legible after the map settles, and saved
  Map PNG/PDF output matches the selected preview size. Hide resource pins and
  confirm the size choices are progressively hidden; reset Print View and
  confirm Standard returns.
- Acceptance criteria: the three size choices are keyboard-accessible 44 px
  controls with localized labels and helper copy; Standard output is unchanged;
  pin circles and numbers scale together; visible and exported maps use the same
  setting; changing size re-prepares map-dependent exports. Pin numbering,
  colours, collision handling, grouped-place association, coordinates, camera,
  Detailed/Live layers, annotations, map height, cards, descriptions, personal
  places, QR, auth, API, schema, Worker, R2, and production data remain
  unchanged.
- Verification result before release: focused Print View, Directory Map, and
  collision coverage passed 45/45, including deterministic size normalization,
  reset, capture-key invalidation, scaled geometry, and control contracts.
  Full client coverage passed 552/552, full server coverage passed 497/497,
  `npm run verify:map-lockdown` passed 77/77 and completed the required
  six-root production client build, and `git diff --check` passed.
- Production release: implementation commit `561e63c1` was pushed on
  `codex/print-pin-size-control` and the validated client artifact was deployed
  to `https://123af0bd.senior-resource-map.pages.dev`. The preview and
  `https://app.carearound.sg` served byte-identical HTML, entry, CSS, My Map,
  and map-export artifacts with correct MIME types after normal edge
  propagation. Entry SHA-256 was
  `1e37c8bc5fba6254dc8f3d21c201ffe430207fe8897680e4ab53f89cfd1850f2`;
  My Map SHA-256 was
  `04d57a74af2d75903d9ac33a9c604ddf38e19e24266ef90ef3b6a5bb07f710dc`;
  map-export SHA-256 was
  `bca2fd623008254e1de1c07d8d7c8c48a86e8ab2ca5ba20a5f8ffe084e0ff296`.
  All six map roots and required map markers were present, forbidden legacy
  labels were absent, `/discover`, `/login`, and `/privacy` returned 200, and
  the production API health endpoint returned 200/OK.
- Authenticated production UAT: owner map 258 exposed the localized Standard,
  Large, and Extra large controls. Live marker evidence confirmed scales 1,
  1.25, and 1.5 with the expected pin and numeral growth. Full-map Extra large
  returned to `Map ready to download` without an alert, proving the shared
  hidden export surface re-prepared successfully. Standard remained the reset
  value. No download was triggered during UAT, so final PowerPoint legibility
  remains a user-side output check. No Worker, API, schema, auth, permission,
  R2, or production-data change was deployed.

## 2026-08-05 owner Print View redraw collision and full-height follow-up

- Current behavior: Print View collision offsets are restored whenever Leaflet
  redraws or replaces numeric marker icons after a solved layout, so badges do
  not fall back onto their geographic-anchor margins after zoom, map-detail,
  colour, camera, height, or layout updates. Same-coordinate grouped badge
  lobes remain visibly associated but use 90% rather than 76% centre spacing
  so their numbers have more separation. In Full-map layout, the bottom resize
  handle now extends the map from the existing 720 px minimum up to 1440 px;
  the 900 px default and ordinary-layout 300-720 px bounds are unchanged.
- Root cause and known-good reference: authenticated production inspection on
  owner map 258 confirmed the current six-root release bundle was loaded. The
  supplied state displayed zoom 15 and retained five separate-icon overlaps,
  including approximately 13.1 px for 14/30, 12.8 px for 6/19, 12.6 px for
  16/26, and 8.6 px for 3/12. At actual zoom 16 only 14/30 retained a small
  1.4 px overlap. Every affected icon was marked solved but its margin had
  returned to the original Leaflet anchor value. The existing drift observer
  deliberately protected interactive category bubbles only; Print badges
  could therefore be reset after the scheduled solver passes. The Full-map
  resize state also exposed a fixed 1080 px maximum, which the user's handle
  had already reached.
- Reproduction steps: sign in as the owner of map 258, open Print View in Full
  layout, and inspect the northwest and Jurong East badge groups at displayed
  zoom 15 and 16. Wait for the map to settle, change zoom and map appearance,
  then confirm separated badges remain separated. Drag the bottom resize handle
  beyond the previous limit and confirm its value can reach 1440 px; repeat
  with Map PNG and PDF export readiness.
- Acceptance criteria: separate Print badges retain solved display-only offsets
  after Leaflet redraws; grouped same-coordinate lobes remain one composite pin
  with clearer numerals; no saved latitude/longitude or geographic anchor is
  changed. Full-map height can reach 1440 px without changing its default,
  minimum, ordinary layout bounds, fixed 1480 px export width, or export safety
  caps. Numbering, colours, cards, descriptions, personal places, annotations,
  map layers, Detailed/Live behavior, QR, auth, API, schema, Worker, R2, and
  production data remain unchanged.
- Verification and deployment: focused collision and Print View coverage
  passed 44/44, full client/source coverage passed 551/551, full server coverage
  passed 497/497, and locked map coverage passed 76/76 together with the exact
  six-root production client build. `git diff --check` passed. Commit
  `9691b28c9` was pushed on `codex/print-pin-spacing-height-followup`, and the
  unchanged validated artifact deployed to
  `https://1b86effd.senior-resource-map.pages.dev`. The preview and
  `https://app.carearound.sg` serve the exact local entry, CSS, My Map, and
  shared Directory Map bytes with correct JavaScript/CSS MIME types. The
  custom-domain HTML references the same entry and CSS and differs only by the
  expected Cloudflare Web Analytics beacon. HTML SHA-256 is
  `119d75fb31c1eddb793d2e744fbfffd06b29a792c00067e2465266ca2a8e3b05`, entry
  SHA-256 is
  `f50edbea05efdcbe87ef1255d6833395c54c199215d8d477995f5c99117b538e`, My Map
  SHA-256 is
  `2d3cd1efdb0f392168c9ec9d40ea6acdb3319e07cb211a8a286e7b4bca1414f8`, and
  shared Directory Map SHA-256 is
  `b18e3f5b4b619f0e8c508ae9595314f190584d6fcccc3b3f5c9a2fa9642d4a5f`.
  The production bundle retained all six map roots and required copy, excluded
  the retired copy, and API health returned 200. Authenticated post-deploy
  browser measurement was attempted but not recorded because the already-open
  Chrome tab could not be claimed before the control timeout; the pre-deploy
  authenticated reproduction, deterministic redraw contract, artifact parity,
  and locked-map gates remain the release evidence. Only the client Print badge
  presentation, Full-map height bound, focused contracts, and this ledger entry
  changed; no server, database, schema, API, Worker, R2, coordinate, or
  production-data change was deployed.

## 2026-08-05 owner Print View pin-number visibility recovery

- Current behavior: every settled owner Print View map reruns the existing
  numeric-badge collision layout against the marker positions produced by the
  final map camera. Nearby badges may still move within the established
  44-pixel display-offset limit, but a zero offset cached during an earlier
  render no longer prevents the final collision pass from separating them.
- Root cause and known-good reference: production map 258 showed five pairs of
  separate marker icons overlapping after every icon had been marked collision
  solved. Read-only browser measurements found approximate penetrations of
  9.5 px for 3/12, 15.1 px for 6/19, 2.3 px for 10/29, 14.5 px for 14/30, and
  13.9 px for 16/26 on the visible Print map, with the hidden export surface
  showing the same pattern at its scale. Their CSS margins remained at the
  original anchor values. An early render could therefore cache a zero offset;
  at the later focused zoom, a stored-offset shortcut restored that stale value
  and returned before `resolvePrintBadgeBubbleLayout`. Branch
  `codex/print-pin-number-visibility` removes only that short-circuit so the
  existing scheduled settled passes reach the existing solver.
- Reproduction steps: sign in as the owner of map 258, open Print View with the
  Detailed map, and inspect the close badge pairs around the northwest group
  and Jurong East group after the camera settles. Confirm each number remains
  readable on the visible preview and on saved Map PNG/PDF output. Repeat after
  changing zoom, map detail, map colour, and print layout.
- Acceptance criteria: separate numeric marker badges are recomputed after the
  Print camera settles and do not retain a stale pre-fit zero offset; map
  coordinates and the existing bounded display-only offsets remain unchanged;
  same-location multi-lobe badges retain their established grouped artwork.
  Numbering, colours, list/card order, personal-place controls, descriptions,
  annotations, map layers, Detailed/Live behavior, exports, QR, auth, API,
  schema, Worker, and production data remain unchanged.
- Verification and deployment: focused collision and Directory Map
  coverage passed 17/17, including the new deterministic contract that settled
  passes cannot bypass the solver with a focused-zoom stored offset. Full
  client/source coverage passed 550/550. Locked map coverage passed 76/76 and
  the exact six-root production client build completed with only the established
  Browserslist and large-chunk advisories. `git diff --check` passed. Commit
  `c605d4937` was pushed on `codex/print-pin-number-visibility`, and the unchanged
  validated artifact deployed to
  `https://1b8c637e.senior-resource-map.pages.dev`. The preview and
  `https://app.carearound.sg` matched local HTML, entry, CSS, My Map, and shared
  Directory Map bytes with correct MIME types. HTML SHA-256 is
  `a26d7e1b8abaaa654e40656bb92b2781c06fcc20d5b7868eead2696e06b3a14b`,
  entry SHA-256 is
  `9899feba2e21a7279beb73c74e8fcb87bc78eebd3ab9fd5e7f696fe0a3d817d0`,
  My Map SHA-256 is
  `cc8c5aabc31d11d4efbdfbc9dfa9e6c6a9bd9a1f957529544386a1d6ca9c6fad`,
  and shared Directory Map SHA-256 is
  `06329ba37b2abf6c241d4501c59522506cb9a108e41e87acdc36548028d3119c`.
  The production bundle retained all six map roots and required copy, excluded
  the retired copy, and API health returned 200. No server, database, schema,
  API, Worker, R2, coordinate, or production-data change was deployed.

## 2026-08-05 owner Print View personal-place description font recovery

- Current behavior: every saved Print View short description renders at the
  same type size as the visible resource or personal-place name on its card,
  in both the on-screen preview and PNG/PDF export surfaces. Text colour,
  highlight colour, ordering, edit/remove actions, and persistent description
  mode are unchanged.
- Root cause and known-good reference: repeated-name personal places remain in
  the nested resource-row path so their Print View edit/remove actions can stay
  directly on the card. That path correctly suppresses the duplicate inner
  name, but still assigned the smaller nested-row type class to the
  description. Production inspection on owner map 258 measured 6.6 px for the
  affected Ivory Heights and Upcoming descriptions beside 9 px visible card
  names; ordinary resource descriptions correctly measured 9 px. Branch
  `codex/print-description-font-consistency` resolves the description class
  from the visible title: the existing nested-row size when its own name is
  shown, or the existing group-title size when the duplicate name is hidden.
- Reproduction steps: sign in as the owner of map 258, open Print View with
  `Add short description` active, and compare Ivory Heights and the two
  Upcoming personal-place descriptions with their card names. Compare those
  cards with IMM Building and Community Plaza, then save Resource PNG and PDF
  outputs and inspect the same cards.
- Acceptance criteria: computed description and visible-name font sizes match
  for repeated-name personal places and ordinary resources in compact and
  regular Print View layouts; no duplicate name is introduced; personal-place
  edit/remove actions remain screen-only; colours and highlights remain
  independent; resource ordering, cards, columns, map geometry, pins,
  annotations, Detailed/Live maps, QR, auth, API, schema, Worker, and production
  data remain unchanged.
- Verification result before deploy: the focused source regression failed
  before the patch and passed afterward. Focused personal-place, descriptor,
  and Print View coverage passed 39/39; the full client suite passed 549/549;
  the full server suite passed 497/497; and the locked map suite passed 76/76
  together with the exact six-root production client build. `git diff --check`
  passed. Commit `f06dc783a` deployed the unchanged validated artifact to
  `https://b69ee0fc.senior-resource-map.pages.dev`. Preview and custom-domain
  HTML, entry, CSS, My Map, and shared-directory assets matched local bytes;
  index SHA-256 is
  `767a208f08540718e11d2639a9b676985f8368a5f56e33ddedcc4f54ea5ba9b0`,
  entry SHA-256 is
  `0cec3b6bd0e6eaa2e5498ab8e958d4eef2c1b769748ddf19dda57bfb53d37aab`,
  and My Map SHA-256 is
  `6df9cb15bc2b3e8001514c408b99aa4d4789bda1f16f1f6579408cbed029585b`.
  The custom bundle retained all six required map roots, `The regular map is
  still shown.`, and `Save PDF`, with the retired labels absent. Signed-in
  production UAT on map 258 measured 9 px for Ivory Heights, both Upcoming
  descriptions, and their visible 9 px names; ordinary IMM and Town Council
  cards remained 9 px. Production API health returned OK. No Worker, schema,
  API, database, map-data, or personal-place-data deployment was made.

## 2026-08-04 Detailed-map production artifact recovery

- Current behavior: owner My Map and Print View retain the Detailed/Live map
  source control, the Detailed fixed surface, Default/Gray appearance choices,
  zoom-14 overview support, zoom-15 native detail, and the retained Print
  Master export roots alongside the newly released Print View personal-place
  controls.
- Root cause and known-good reference: after `npm run verify:map-lockdown`
  produced the correct six-root client, a later ordinary
  `VITE_API_URL=... npm run build:client` rebuilt `client/dist` without
  `VITE_TOWN_MAP_PROOF_ENABLED` or the six required map roots. The direct Pages
  upload then published that smaller artifact, compiling the Detailed-map
  control out without changing source, R2 assets, Leaflet, or map data. The
  recovery uses unchanged commit `3bdc4ad0d` and only the existing
  `npm run verify:map-lockdown` production build contract.
- Reproduction steps: open an owned map in Print View, open Map settings, and
  observe that the regressed build shows only Map colour while the Detailed/
  Live source control is absent. Inspect the published bundle and confirm the
  native-scale, zoom-14 atlas, and Print Master root markers are all absent.
- Acceptance criteria: the production entry, CSS, My Map, and shared directory
  chunks match the validated six-root `client/dist` byte-for-byte; all six
  Default/Gray roots, `The regular map is still shown.`, and `Save PDF` are
  present; `Standard map is still on` and `Save A3 PDF` remain absent. No
  Worker, schema, auth, R2, API, database, coordinate, personal-place, or
  production-data change is included.
- Verification and deployment: locked map coverage passed 76/76 and its exact
  six-root production build passed. The corrected Pages deployment is
  `https://475a68f8.senior-resource-map.pages.dev`. Preview and custom-domain
  CSS, My Map, entry, and shared directory artifacts matched local bytes; entry
  SHA-256 is `c77615858c62489deb3f216c8c145944cb6dd42ef9a57cc8a41d3a12d32c4053`,
  My Map SHA-256 is
  `70ab3e64a2141dc49741e63b5afa1d8302214856fcf18c0ea6ca940a2cdc36b2`,
  and shared directory SHA-256 is
  `10a281c292b4146b0460b58e47b7c4c4863f4ad36379eaed8e5d9efe9a196912`.
  All six root markers and required/forbidden copy markers passed on
  `app.carearound.sg`; production API health returned OK. `git diff --check`
  passed.

## 2026-08-04 owner Print View personal-place controls and persistent description mode

- Current behavior: authenticated map owners can add or attach a personal place
  from the Print View toolbar, choose a new location directly on the print map,
  and edit or remove an attached personal place from its visible print card.
  The controls reuse the established private My Places chooser, editor,
  categories, map-link mutations, and progress states. `Add short description`
  remains active after saving or cancelling an individual description editor
  and while using other print tools; it turns off only when the owner presses
  the toolbar action again or exits Print View.
- Known-good reference: branch `codex/print-personal-place-controls`, based on
  deployed selected-pin anchor commit `b94199aae`. The change is client-only and
  limited to owner Print View wiring, screen-only personal-place card actions,
  focused source contracts, and this ledger entry. Existing authenticated APIs
  remain the only mutation path.
- Reproduction steps: sign in as a map owner and open an owned map in Print
  View. Choose `Add personal place`, attach an existing My Places entry, and
  confirm the preview refreshes. Choose it again, select `Choose map location`,
  click an unoccupied map point, complete or cancel the existing editor, and
  confirm the print route remains active. Use the card edit action, then remove
  a personal place from the map. Turn on `Add short description`, save or cancel
  two card edits in succession, and confirm the toolbar mode stays active until
  it is pressed again; exit and reopen Print View and confirm it starts off.
- Acceptance criteria: add, attach, location placement, edit, and remove use the
  existing owner-only personal-place API and refresh the same Print View;
  placement mode suppresses print-pin selection while accepting background map
  clicks and shows the existing placement/progress status; edit/remove controls
  appear only in the screen preview and are absent from PNG/PDF export renders
  and browser printing. Personal places remain excluded from shared maps,
  snapshots, Discover, guest views, and public payloads. Annotation, map-layer,
  Detailed-map, selection, export, QR, auth, schema, Worker, and production-data
  behavior remain unchanged.
- Verification result before deploy: red-first focused coverage failed on the
  missing controls and one-shot description reset, then the focused Print View
  and personal-place contracts passed 35/35. Broader owner My Map, Print View,
  annotation, resource-layer, shared-map, server privacy, and personal-place
  coverage passed 171/171. The full client suite passed 549/549, the full server
  suite passed 497/497, and the locked map suite passed 76/76 together with its
  six-root production build. A signed-in production probe then exposed that the
  existing annotation status prop could hide the new placement guidance; a
  red-first contract reproduced the collision, the statuses were merged, and
  focused 35/35, full client 549/549, full server 497/497, and locked map 76/76
  coverage passed again before the corrective client deploy. `git diff --check`
  passed.

## 2026-08-04 selected My Map category pin geographic-anchor recovery

- Current behavior: on owner My Map and interactive Shared Map category-bubble
  views, the explicitly selected or focused resource marker stays on its real
  Leaflet geographic anchor and renders above neighbouring markers. The shared
  collision solver continues to spread only the unselected neighbouring
  category bubbles for readability. Print View retains its existing numeric
  badge collision behavior and every unselected interactive marker retains the
  established weighted spreading behavior.
- Known-good reference: branch `codex/fix-selected-map-pin-anchor`, based on
  current `origin/main` commit `26d3163c9`. Production resource `hard-17882`
  uses postal code `600308` and coordinates near the official OneMap Block 308
  point. Read-only production inspection showed its selected Leaflet icon being
  visually displaced by a preserved collision margin even though its map
  coordinate was correct; no resource-data correction is required.
- Reproduction steps: open owner My Map `258`, select `Jurong Central Zone E
  RN`, and zoom to the Block 308 area. Inspect the selected category bubble
  against the building footprint and nearby category bubbles. Deselect it and
  select a neighbouring resource. Repeat after a pan, zoom, and reload, then
  check owner Print View and an interactive Shared Map.
- Acceptance criteria: the selected/focused category bubble has zero collision
  displacement from its Leaflet anchor, remains above nearby bubbles, and stays
  anchored after delayed layout passes, map movement, and redraws. Unselected
  bubbles may move to avoid overlap; Print View badge layout, saved coordinates,
  postal validation, camera behavior, clustering, Detailed-map alignment,
  exports, notes, sharing, auth, API, schema, permissions, and production data
  remain unchanged.
- Verification result before deploy: red-first collision-policy coverage failed
  before the new helper existed, then passed 3/3. Focused category-bubble,
  My Map, Shared Map, Detailed-map, Print View, and annotation coverage passed
  158/158. Full client coverage passed 548/548 after carrying forward the
  previously approved deterministic Care Calendar test-clock correction; no
  Calendar production logic changed. Full server coverage passed 497/497.
  The exact six-root production client build passed with only the established
  bundle-size advisory, and `git diff --check` passed.

## 2026-08-01 Authenticated High-Detail Town Maps download library (production released)

- Current behavior: signed-in users with My Directory access can open
  `/my-directory/town-maps`, search all 32 validated Default-colour town maps
  by name, code, or planning area, preview lightweight lazy-loaded thumbnails,
  and download a lossless `10,000 x 7,000` PNG with 300-DPI metadata or a clean
  175% single-page PDF. The catalogue displays file sizes and the exact
  `OneMap (c) contributors | Singapore Land Authority` attribution. Large
  downloads go directly to the versioned map asset host; they are not bundled,
  Worker-buffered, or cached by the PWA.
- Known-good reference: branch `codex/high-detail-town-map-downloads`, based on
  production commit `548829758bd58b040073199cafc2a6a1da4d8387`. The change is
  isolated to a new protected, lazy client route and a new R2 publishing and
  validation toolchain. It does not change Leaflet, My Map, Print View,
  Standard/Detailed switching, zoom thresholds, cameras, pins, annotations,
  clustering, existing exports, fixed-surface assets, auth policy, schema,
  Worker code, or production data.
- Reproduction steps: sign in with Directory access and open
  `/my-directory/town-maps`. Confirm 32 cards, search `S01` and a town name,
  switch through all four languages, and download Southern Islands in both
  formats. Repeat at a 390 x 844 viewport and confirm the large-download
  guidance. In a fresh navigation timing window, confirm the library initially
  fetches only `catalogue.json` and visible thumbnails. Open an existing My Map
  and confirm it makes no request under
  `/v4/town-map-downloads-20260801-r2/default`.
- Acceptance criteria: the strict catalogue contains exactly the canonical 32
  map codes and 96 unique asset URLs; every source and prepared object matches
  its SHA-256 and byte size; PNGs are lossless RGB `10000 x 7000` with 300-DPI
  metadata; PDFs are one `1750 x 1225 mm` page at the approved 175% profile;
  every file retains the exact attribution; thumbnails are intersection-gated;
  loading, unavailable, no-results, preview-error, and download-error states
  are accessible; filenames, MIME types, CORS, immutable caching, catalogue
  revalidation, and PDF byte ranges match the publishing contract. The uploader
  remains dry-run by default, rejects any non-vacant prefix, has no delete path,
  repeats the object-specific vacancy check before every PUT attempt, uploads
  binaries and thumbnails first, and publishes the catalogue last.
- Verification result before deploy: source validation and preparation passed
  for all 32 PNGs, 32 PDFs, and 32 thumbnails. The approved second-root plan
  contains 99 R2 objects and 2,862,256,987 bytes; its catalogue SHA-256 is
  `fbf2bb7cecdb70399db9548520e2b0c91f8a4ba45002bfc03dd0b9247994a955`.
  Focused module/publisher coverage passed 20/20; all town-map R2 coverage passed
  16/16; `npm run verify:map-lockdown` passed 75/75 plus its exact six-root
  build. Broad client coverage passed 532/533; its sole failure is the existing
  date-expired Care Calendar planning fixture on untouched code. Desktop and
  mobile authenticated UAT passed, including matching hashes for representative
  downloaded PNG/PDF files and zero download-library requests from My Map. The
  second dry-run targets exact approved prefix
  `v4/town-map-downloads-20260801-r2/default` and requires a query-free exact
  public C08 download canary before uploading the remaining objects. The first
  R2 apply at `v4/town-map-downloads-20260801/default` uploaded all 96
  binaries/thumbnails and both supporting
  metadata objects, but stopped safely before `catalogue.json`. Cloudflare's
  compressed Node HEAD response initially hid JSON `Content-Length`; the tools
  now request identity encoding and retry bounded checks. The query-free S01
  PNG downloaded at its exact 5,875,064 bytes and catalogue hash, all 32 PDF
  leading-byte range probes passed, and direct authenticated R2 retrieval
  proved the stored C08 PNG matches its exact 52,677,239 bytes and SHA-256.
  However, C08 custom-domain delivery is not release-ready: a full public GET
  transferred only 6.4 MB in 120 seconds, and multiple mid-file PNG ranges
  returned correct `206` headers without bodies before timeout. The catalogue
  remains 404, so no client can discover the partial root. Do not resume,
  overwrite, delete, or publish that root. The approved second apply at
  `v4/town-map-downloads-20260801-r2/default` passed its query-free full C08
  canary at 52,677,239 bytes and exact SHA-256, then published all 99 objects
  with `catalogue.json` last. The complete remote verifier passed 99/99 object
  HEAD checks, 98/98 non-catalogue hashes, 64/64 PNG/PDF download hashes,
  32/32 thumbnail hashes, and 32/32 PDF range checks with the CareAround CORS
  origin. A separate normal query-free S01 PDF download returned HTTP 200,
  5,220,043 bytes and the exact
  `b1d00e1f656c706ba5d7b513c10e5fb49288574a7260b674f69d7f7f84422b40`
  hash, with `application/pdf`, the attachment filename, byte ranges, and
  one-year immutable caching.
- Production release follow-up: the user approved the CareAround SG production
  client release on 2026-08-02. Code commit `485910dc0` was pushed on
  `codex/high-detail-town-map-downloads`, and the exact validated six-root
  `client/dist` deployed to Cloudflare Pages at
  `https://ff9d8d64.senior-resource-map.pages.dev`. The preview and
  `https://app.carearound.sg` matched the local bytes for HTML, entry JS, CSS,
  Town Maps, My Map, and map-export chunks. The entry SHA-256 is
  `c48e51ec19627ad9093176d0549465c9342bb6646fb582202fb9f6002c0989de`;
  the Town Maps chunk SHA-256 is
  `eea095a9b25bec046e006df1b78485c54efbe59fc84c3fe1dd30c91f2020ac2e`.
  Authenticated production UAT passed at `1440 x 900` and `390 x 844`: the
  catalogue showed all 32 maps, loaded only three initial visible previews,
  rendered no PNG/PDF DOM URLs before selection, searched `S01`, started the
  exact Southern Islands PNG and PDF downloads without an error, retained
  attribution, displayed the mobile Wi-Fi warning without horizontal overflow,
  and showed translated module strings in English, Chinese, Malay, and Tamil.
  A fresh My Map route load exposed no download-catalogue, thumbnail, PNG, or
  PDF URL and no app-origin console error. The authenticated owner had zero
  saved My Maps, so an existing-map production navigation was not fabricated;
  the earlier local authenticated existing-map network-isolation UAT remains
  the stronger interaction proof. Production API health returned OK at
  `2026-08-01T18:05:49.362Z`. No Worker, schema, auth, permission, secret,
  production-data, Leaflet, My Map, Print View, or existing export change was
  deployed.

## 2026-08-01 Discover Save These Results recovery

- Current behavior: the signed-in Discover `Save these results` checkbox uses
  callable bulk save/remove actions from the shared Saved Resources provider.
  The provider deduplicates result references, skips resources already in the
  requested state, and processes at most four existing favorite-toggle requests
  concurrently. Each resource retains the established optimistic update and
  rollback behavior, while the control remains pending until every attempted
  update settles.
- Known-good reference: branch `codex/fix-discover-save-all`, recovering the
  missing provider contract reported as `Kr is not a function` on production
  Discover. The change is client-only and does not alter the favorites API,
  saved-resource hydration/order, resource visibility, Discover search or
  ranking, My Directory filtering, My Maps, Care Calendar, auth, schema, or
  production data.
- Reproduction steps: sign in, open `/discover?q=st+andrews`, and choose `Save
  these results`. Confirm the matching unsaved resource becomes saved without
  an error banner and appears in My Directory. Choose the checkbox again and
  confirm it is removed. Repeat with a search containing a mixture of saved and
  unsaved Places and Offerings, then confirm only rows whose state must change
  issue requests.
- Acceptance criteria: Discover never calls an undefined bulk action; duplicate
  result references are updated once; save skips already-saved rows and remove
  skips unsaved rows; one failed resource rolls back only that resource and
  surfaces the existing error notice after the remaining requests settle;
  individual save/remove controls and My Directory's bounded saved-resource
  hydration remain unchanged.
- Verification result before deploy: focused Saved Resources and Discover
  coverage passed 12/12. Broad client/source coverage passed 534/535; its sole
  failure is the established date-expired Care Calendar planning fixture on
  untouched code. `npm run build:client` passed with only the established
  Browserslist age and large-chunk advisories.

## 2026-08-01 Unified personal-place short descriptions in owner Print View

- Current behavior: the personal-place create/edit form no longer includes a
  separate short-description field. In owner Print View, `Add short
  description` and the existing multi-description formatting editor now apply
  to managed resources and personal-place cards alike. Personal-place
  descriptions are stored on that map's reusable-place link, so editing one
  map does not change another map that uses the same private library place.
  Existing library descriptions are migrated once into every current map link;
  new links start with an explicit empty map-description list.
- Known-good reference: branch
  `codex/personal-place-map-short-descriptions`. The change is limited to the
  owner-only My Map personal-place link, its authenticated update endpoint,
  Print View description controls, duplicate-map copying, and compatibility
  migration. It does not add personal places to Discover, shared snapshots, or
  guest routes, and it does not change Leaflet geometry, Print View export, map
  notes, the reusable library record, or public resource data.
- Reproduction steps: sign in as a map owner, open an owned map with a personal
  place, and enter Print View. Choose `Add short description`, select the
  personal-place card, add two independently styled descriptions, save, and
  refresh. Open another owned map using the same personal place and confirm its
  descriptions are unchanged. Duplicate the first map and confirm its
  personal-place descriptions are retained. Start creating or editing a
  personal place and confirm the duplicate short-description field is absent.
- Acceptance criteria: every owner Print View personal-place card exposes the
  same add/edit description action as managed-resource cards; up to 20 ordered
  descriptions retain text and highlight colours after save and refresh;
  removing all descriptions remains empty; descriptions stay private and
  map-specific; duplicate maps copy the values independently; old personal
  descriptions are preserved by the idempotent boundary migration; personal
  place create/edit, image upload, reuse, detach, shared-map privacy, and map
  rendering remain unchanged.
- Verification result before deploy: focused client/schema/controller coverage
  passed 46/46; full server coverage passed 497/497; the owner My Map/Print View
  lockdown gate passed 74/74 and its exact six-root production client build;
  `git diff --check` and JavaScript syntax checks passed.

## 2026-07-31 Owner personal-place creation guidance and image upload draft preservation

- Current behavior: starting a new personal place labels the map-first step as
  `Choose map location`, then keeps a prominent prompt inside the map explaining
  that the details form opens after the owner clicks or taps a location. Adding
  or changing an image in that editor keeps the in-progress form values intact.
  The editor initializes from the selected draft only once per open create/edit
  session; late category-list refreshes can fill an empty category selection
  without rebuilding the rest of the draft. Personal-place image uploads also
  stay on the cookie-scoped API base instead of trying fallback API bases.
- Known-good reference: branch
  `codex/personal-place-create-guidance`, building on the image draft
  preservation release. The change is client-only and scoped to the personal
  place chooser, placement guidance, editor initialization, translations, and
  the API client upload base guard. It does not change Personal Places
  visibility, public Discover resources, Shared Maps, map geometry, Print View
  export, schemas, or server upload validation.
- Reproduction steps: sign in as a map owner, open an owned My Map, choose `Add
  personal place`, then select `Choose map location`. Confirm the chooser closes
  into a prominent in-map prompt that says the details form opens next. Click
  or tap the map and confirm the editor opens. Fill a name and location fields,
  then choose a PNG/JPEG/WebP image. Confirm the image preview appears and the
  existing name, category, postal code, address, latitude, longitude, and short
  description remain. Repeat after editing an existing personal place.
- Acceptance criteria: the map-location step must be explicit before and after
  the chooser closes; selecting a location must open the editor; image upload
  success or failure must not blank the editor form; category data refreshes
  must not reset in-progress edits; authenticated upload requests must not fall
  through to fallback API bases; save still creates or updates an owner-only
  personal place; existing My Places library, map placement, reusable-place
  attachment, Print View, and Detailed-map behavior remain unchanged.
- Verification result before deploy: focused client coverage passed 23/23 with
  `node --test client/test/apiRequest.test.js
  client/test/i18nCoverage.test.js
  client/test/myMapPersonalPlacesSource.test.js`; `git diff --check` and
  `npm run verify:map-lockdown` passed, including the 74/74 locked map tests and
  exact six-root production client build.

## 2026-07-31 Owner My Map duplicate action

- Current behavior: authenticated non-guest map owners can duplicate one of
  their own My Maps from the My Maps card list. The copy is created as a new
  private map named `Copy of ...`, with a numeric suffix when needed. It opens
  immediately after creation. Managed-resource rows, saved snapshots, private
  and share-marked map notes, map-only short descriptions, reusable
  personal-place links, and Print View annotation documents are copied into
  independent rows for the new map. The new map does not inherit the source
  map's shared status, share token, share snapshot, or public URL.
- Known-good reference: branch `codex/duplicate-my-map`. The change is scoped
  to the owner-only My Maps duplicate endpoint and My Directory card action. It
  does not alter Discover visibility, public shared-map snapshots, saved
  resource ownership rules, Personal Places library records, map geometry,
  Detailed-map rendering, Print View export, schemas, or auth/session policy.
- Reproduction steps: sign in as a map owner, open My Directory, choose the My
  Maps tab, and select `Duplicate` on an existing map. Confirm the newly opened
  map is named `Copy of <source name>`, includes the same managed resources and
  reusable personal places, and remains private even if the source map was
  shared. Repeat when an existing copy already exists and confirm the new copy
  receives the next numeric suffix.
- Acceptance criteria: guests and non-owners cannot duplicate a map; the new
  map has its own resource, note, short-description, and annotation rows; the
  Personal Places library record is not cloned or exposed publicly; source
  share tokens and frozen share snapshots are never copied; and existing
  create, rename, delete, share, Print View, and Detailed-map behavior remains
  unchanged.
- Verification result before deploy: full server coverage passed 496/496 with
  `npm run test:server`; client source and i18n coverage passed 10/10 with
  `node --test client/test/myMapsLoading.test.js
  client/test/i18nCoverage.test.js`; the owner My Map/Print View lockdown gate
  passed 74/74 plus the exact six-root production client build with
  `npm run verify:map-lockdown`; the default client production build and
  `git diff --check` passed. Production smoke credentials were unavailable in
  this shell, so post-deploy verification uses API health, public route, bundle,
  and unauthenticated endpoint checks.

## 2026-08-01 Owner Print View verified download readiness

- Current behavior: owner Print View prepares its hidden export map as soon as
  the workspace opens. `Save Map PNG`, combined `Save PNG`, and `Save PDF` stay
  disabled while the actual export surface loads and while a low-resolution
  capture probe checks that the map frame is not blank. The toolbar shows
  preparation/checking progress, confirms when the map is ready, and exposes a
  retry action when preparation fails. In Full map, `Save Resource PNG` remains
  available independently because it does not contain a map. Final exports
  retain the existing full-resolution blank-frame check and retry.
- Known-good reference: branch `codex/print-export-readiness-indicator`. The
  change is client-only and limited to the owner Print View hidden export
  lifecycle, download controls, localized readiness feedback, and focused
  coverage. It does not alter map data, map cameras, Detailed-map selection,
  annotations, resource cards, export composition, sharing, ownership, APIs,
  schemas, or production data.
- Reproduction steps: sign in as a map owner and open an owned map in Print
  View on a slow or cold browser session. Move or resize the preview map while
  the hidden export map is loading. Confirm the map-dependent download buttons
  remain disabled while the progress indicator is visible, then become enabled
  only after `Map ready to download` appears. In Full map, confirm `Save
  Resource PNG` remains usable during map preparation. Force or encounter a
  preparation failure and confirm the retry control restarts preparation.
- Acceptance criteria: no map-dependent download can start before a nonblank
  capture from the hidden export map has been verified; readiness resets after
  map, layout, annotation, directory, or anchor changes; failure leaves map
  downloads disabled with clear retryable feedback; Resource PNG remains
  independent; existing final blank rejection and all locked map behavior stay
  unchanged.
- Verification result before release: focused Print View coverage passed 25/25
  with `node --test client/test/printMapWorkspace.test.js`; complete locked-map
  coverage passed 75/75 with `npm run verify:map-lockdown`; both the default and
  exact six-root production client builds completed with only the established
  large-chunk advisory. Full client/source coverage passed 523/524; the sole
  failure is the existing date-expired Care Calendar planning-conflict fixture,
  outside this Print View change.

## 2026-07-31 Owner Print View blank export recovery

- Current behavior: owner Full-map Print View splits the former combined image
  action into `Save Resource PNG` and `Save Map PNG`. Resource PNG captures only
  the resource page and does not wait on map readiness. Map PNG and PDF export
  wait for the hidden Detailed fixed-surface map images to complete and decode
  before declaring the capture map ready. Map pages are captured with
  cache-busted image fetches, checked for a near-uniform blank map frame,
  retried once after an additional paint wait, and then rejected with a visible
  export error instead of creating a finished PNG/PDF with an empty map. PNG
  downloads are saved from blobs. The hidden export surface remains mounted
  only during a save, but is kept paintable instead of being placed far
  offscreen.
- Known-good reference: branch `codex/print-export-blank-recovery`. The change
  is client-only and limited to the owner Print View export readiness/download
  path plus focused source coverage. It does not alter visible map data, map
  camera controls, Detailed-map selection, annotations, resource cards, PDF
  layout, sharing, ownership, APIs, schemas, or production data.
- Reproduction steps: sign in as a map owner and open an owned map in Print
  View. Choose `Full map`, confirm Detailed is visible, and choose `Save
  Resource PNG`; confirm only the resource page downloads. Then choose `Save
  Map PNG`; confirm the map image downloads with the rendered map. Repeat with
  `Save PDF` and inspect that the map page contains the map rather than a plain
  empty rectangle. On a slower browser, move or resize the map before export
  and retry immediately.
- Acceptance criteria: hidden export maps wait for fixed-surface image decode
  and paint readiness; map capture retries once when the sampled map frame is
  blank; a still-blank capture surfaces an export error instead of saving an
  empty map; Full-map PNG export is split into independent map/resource blob
  downloads; existing regular Print View layout and interactive My Map
  behavior remain unchanged.
- Verification result before deploy: focused Print View source coverage passed
  24/24 with `node --test client/test/printMapWorkspace.test.js`; complete
  locked-map coverage passed 74/74 with `npm run verify:map-lockdown`; the
  production-style six-root client build completed with only the established
  large-chunk advisory; and `git diff --check` passed.

## 2026-07-31 Owner Print View floating layout settings panel

- Current behavior: the sticky owner Print View toolbar remains a compact
  command surface while `Print layout` opens as a floating right-side settings
  panel on desktop. The panel is anchored below the toolbar, is 400 px wide,
  stays within the viewport with independent vertical scrolling, and closes
  through its existing close button or the Escape key. On smaller screens the
  controls retain the established full-width touch layout.
- Known-good reference: branch `codex/print-layout-side-panel`. The change is
  limited to presentation and keyboard dismissal for the existing
  `PrintLayoutControls`; it does not alter print state, layout choices, map
  geometry, annotations, descriptors, exports, APIs, schemas, or ownership.
- Reproduction steps: sign in as a map owner and open map 258 in Print View on
  desktop. Scroll the preview, open `Print layout`, and confirm the toolbar
  height does not grow. Scroll the settings panel independently, change layout
  and card-column options, close it with Escape, reopen and close with the X
  button, then repeat at a compact viewport.
- Acceptance criteria: the desktop panel floats at the right below the sticky
  toolbar without moving the preview down; it does not overlap the global
  navigation or extend beyond the viewport; panel controls remain keyboard
  accessible and internally scrollable; Escape and X close it; layout changes
  still update the preview; compact view retains the full-width touch layout;
  the toolbar and panel remain absent from print and saved image/PDF output;
  all locked map behavior remains unchanged.
- Verification result before deploy: `node --test
  client/test/printMapWorkspace.test.js` passed 22/22, `npm run
  verify:map-lockdown` passed 72/72 plus the exact six-root production client
  build, `npm run build:client` passed, and `git diff --check` passed. Owner
  desktop UAT on map 258 confirmed the floating panel no longer expands the
  sticky toolbar or obscures most of the map. The compact fallback remains
  covered by the responsive implementation and focused source assertions.

## 2026-07-31 Owner Print View sticky workspace toolbar

- Current behavior: the owner Print View workspace toolbar remains visible
  while the page and map preview scroll. It is sticky below the global
  navigation at 56 px on compact screens and 64 px from the `sm` breakpoint,
  stays above the map surface but below the global navigation, and keeps the
  existing responsive actions and expandable Print layout controls. The
  toolbar remains excluded from browser printing and PNG/PDF export surfaces.
- Known-good reference: branch `codex/print-toolbar-sticky`. The change is
  limited to the existing owner Print View toolbar wrapper and its focused
  source regression. It does not change Leaflet, map sizing or camera state,
  Detailed-map selection, annotations, resource cards, descriptor data,
  ownership, APIs, schemas, or export composition.
- Reproduction steps: sign in as a map owner and open map 258 in Print View.
  Record the toolbar position, scroll down through the map preview and resource
  cards, and confirm the toolbar remains immediately below the global
  navigation. Open and close Print layout after scrolling, then save a PNG or
  PDF and inspect the output.
- Acceptance criteria: computed toolbar position is `sticky`; desktop `top`
  resolves to 64 px and compact `top` resolves to 56 px; the toolbar's viewport
  top remains stable after page scroll; buttons and panels keep their existing
  behavior; the toolbar does not overlap the global navigation; preview scroll
  position is not reset; the toolbar remains absent from print and saved
  image/PDF output; all locked map behavior remains unchanged.
- Verification result before deploy: focused Print View coverage passed 22/22.
  The complete locked-map gate passed 72/72 and its exact six-root production
  client build passed with only the established large-chunk advisory. The full
  server suite passed 493/493. Authenticated localhost UAT on owner map 258
  measured `position: sticky`, `top: 64px`, and viewport top 65 px before
  scrolling; after a 282.5 px page scroll, the toolbar remained at viewport top
  64 px with the same 69.375 px height.

## 2026-07-30 Owner Print View descriptor readability and formatting

- Current behavior: Print View renders a resource address and its optional short
  descriptions at the same type size as that card's resource name in compact
  and regular layouts. An owner can add up to 20 ordered map-only short
  descriptions, edit or remove each one, choose an independent text colour and
  optional highlight for each description, and inspect each result in the
  editor preview. The saved formatting appears in Print View cards and
  image/PDF exports. Existing single unformatted descriptions are migrated into
  the first description slot and retain the established slate text colour.
- Known-good reference: branch `codex/print-description-formatting`. Formatting
  is stored only on the owner's map-resource link, with the first item mirrored
  into the legacy `my_map_assets` fields for older clients. It does not modify
  the source resource, personal-place data, public Discover data, map geometry,
  pins, numbering, annotations, layout state, or shared-map snapshots.
- Reproduction steps: sign in as a map owner and open map 258 in Print View.
  Choose a layout that shows full details and compare each resource name,
  address, and description. Choose `Add short description`, add a second
  description, give the two descriptions different text/highlight colours,
  save, refresh, change print layouts, and save a PNG or PDF. Remove only the
  second description, refresh again, and inspect the map's shared snapshot
  separately.
- Acceptance criteria: addresses and descriptions match the corresponding name
  size in compact and regular Print View cards; every description keeps its own
  colour and highlight after save, refresh, layout changes, and export;
  no-highlight can be restored; invalid colour values fall back safely; an
  older cached client that submits the legacy single-description payload
  updates only the first item without clearing later items; owner-only
  descriptor text and formatting remain absent from shared snapshots; all
  established map and annotation behavior remains unchanged.
- Verification result before deploy: focused descriptor, schema, privacy,
  personal-place, and source tests passed 44/44. The complete server suite
  passed 493/493. The locked-map suite passed 72/72 and its exact six-root
  production client build passed. A subsequent normal client build also passed,
  with only the established large-chunk advisory. Authenticated localhost owner
  UAT on map 258 added a second independently styled description, saved it,
  reloaded and confirmed both descriptions, then removed the second item and
  reloaded to confirm the original remained. A non-required broad client sweep
  passed 525/526; its sole failure reproduces in isolation in the untouched Care
  Calendar planning test because that test's fixed 20 Jul 2026 events are now
  expired relative to the current date. No calendar source or test file is
  changed in this release.

## 2026-07-30 Migrated personal-place detach persistence

- Current behavior: removing a personal place from an owner map deletes the V2
  map link. If that reusable personal place originated from the legacy
  map-specific table, detaching it from its original map also deletes only that
  matching legacy row so the compatibility bootstrap cannot recreate the link
  on refresh. The reusable personal-place library record and links to any other
  owner maps remain intact.
- Known-good reference: branch `codex/print-description-formatting`, controller
  `detachPersonalPlaceFromMap`, and the migrated-place regression in
  `server/test/myMapsController.test.js`.
- Reproduction steps: migrate a legacy personal place into the reusable V2
  library, attach the same reusable place to a second owner map, detach it from
  its original map, then run the V1-to-V2 compatibility bootstrap or refresh
  the owner map.
- Acceptance criteria: the removed place does not return to the original map;
  the original legacy row is gone; the reusable owner-library place remains;
  the second map link remains; another user's maps/places and normal resource
  assets are unchanged.
- Verification result before deploy: the focused 44/44 suite includes an exact
  migrated-place detach case that verifies legacy-row deletion, reusable-place
  retention, and other-map-link retention. The full server suite passed
  493/493.

## 2026-07-30 Owner Print View annotation continuity and card columns

- Current behavior: saved owner annotations render from the same annotation
  layer in Balanced, Side map, and Full map. Full map remains the only editing
  canvas; choosing `Annotate` from another layout opens Full map instead of
  creating a second layout-specific annotation state. Full map supports 2-6
  category-aware resource columns. Side map supports 1 or 2 category-aware
  card columns beside the map. Balanced remains one column even after returning
  from a two-column Side map.
- Known-good reference: branch
  `codex/print-layout-annotation-continuity`. The change is limited to owner
  Print View presentation and print-state normalization. It does not alter
  annotation persistence, coordinates, layering, interactive-map continuity,
  resource ownership, numbering, Detailed-map surfaces, API behavior,
  production data, or personal-place privacy.
- Reproduction steps: sign in as an owner and open map 258 in Print View at
  displayed zoom 14. Confirm a saved annotation is visible in Balanced. Open
  `Print layout`, choose Side map and Card columns `2`, then choose Full map
  and Card columns `6`, and finally return to Balanced. At each step inspect
  the same annotation, resource order, category grouping, map zoom, and
  Detailed-map surface. Repeat with the map on either side in Side map.
- Acceptance criteria: the same saved annotations remain visible in all three
  layouts and exports; annotation editing remains Full-only; Side map exposes
  only 1 or 2 columns; Full map exposes 2-6 columns; categories stay together
  unless a long category must flow to the next column; numbers and ordering do
  not change; returning to Balanced restores one column; displayed zoom 14
  retains fixed Detailed image layers, zero live tile-pane images, and visible
  Singapore Land Authority attribution.
- Verification result before deploy: focused Print View, annotation, and layer
  tests passed 36/36. The map-lockdown suite passed 72/72, server tests passed
  490/490, and the production-style six-root client build passed with only the
  established large-chunk advisory. Authenticated Chrome UAT on local map 258
  using the production API confirmed Side map with 2 columns, Full map with 6
  columns, and Balanced restored to 1 column. The same saved annotation pane
  remained present in every layout; displayed zoom stayed at 14; fixed Detailed
  image layers remained active; and the live Leaflet tile pane stayed empty.
  No CareAround browser errors were recorded.
- Production release: commit `395895852` was pushed to
  `codex/print-layout-annotation-continuity` and `main`. Cloudflare Pages first
  produced immutable preview
  `https://5c330c47.senior-resource-map.pages.dev`; the validated `client/dist`
  was then explicitly republished to production as
  `https://b3b474ec.senior-resource-map.pages.dev` after the custom domain was
  observed serving its previous entry bundle.
- Production artifact proof: `https://app.carearound.sg` serves entry bundle
  `/assets/index-COubuHAm.js` with SHA-256
  `5cc15ab8f8d570baa79369056099a1c050e61c9f17d98945c673b678353aad9b`,
  stylesheet `/assets/index-BTGWrUum.css` with SHA-256
  `1da99cb6d77833f36e0dfe089fdabf2572f4833d4985b9dfe6561ad510ae89c3`,
  My Map chunk `/assets/MyMapDetailPage-zKeWWqFh.js` with SHA-256
  `d48e1d27dce31f8c7d5762b75c7e46abf2b8a88e6eafe87dd642102069f6b548`,
  and Directory/Map chunk
  `/assets/useDirectoryDistanceAnchor-BzwrZIV6.js` with SHA-256
  `a9dddfc9b241c0e61e0e8381e4bec51f47a698813922d7ed75330e7248f1c685`.
  All four custom-domain files matched the validated production build byte for
  byte and returned the expected content types.
- Production behavior proof: authenticated owner UAT on
  `https://app.carearound.sg/my-directory/maps/258?view=print` confirmed the
  same annotation pane in Balanced, Side map with 2 columns, Full map with 6
  columns, and Balanced restored to 1 column. Displayed zoom remained 14,
  fixed Detailed layers remained active, the live tile pane stayed empty, and
  Singapore Land Authority attribution remained visible. The API health check
  returned `status: ok`. Production smoke credentials were not available in
  the release shell, so the credentialed smoke suite was not run; authenticated
  production owner UAT and exact custom-domain artifact proof were retained
  instead. This was a client-only release with no Worker/API, schema, data,
  authentication, ownership, or privacy change.

## 2026-07-30 Zoom-14 Detailed continuous atlas release

- Current behavior: owner My Map and Print View use the established native
  fixed surfaces at displayed zoom 15 and above. Displayed zoom 14 uses one
  continuous Singapore overview atlas, so panning no longer crosses
  town-surface edges or waits for a per-town handoff. Default and Gray have
  separate immutable roots. The normal Leaflet camera, resource pins,
  annotations, map resizing, map settings, and export pipeline are unchanged.
  While a covered fixed surface is genuinely loading, the map and settings show
  `Loading detailed map...`; controlled fallback remains available outside the
  atlas coverage and recovers when the full viewport re-enters coverage.
- Known-good reference: branch `codex/detailed-map-zoom14-overview`, using
  immutable roots
  `https://maps.carearound.sg/v3/zoom14-atlas-20260730/default` and
  `https://maps.carearound.sg/v3/zoom14-atlas-20260730/gray`. The atlas is
  deterministically generated from the complete authorised local OneMap
  zoom-17 cache and remains a fixed image-overlay surface rather than a live
  tile pyramid. The release is client and static-map-asset only; Worker/API,
  schema, production data, map ownership, annotations, and personal-place
  privacy are unchanged.
- Reproduction steps: sign in as an owner and open map 269 in Print View. From
  displayed zoom 15, zoom out once to displayed zoom 14. Pan east and west
  across the former town-plate boundaries, resize the map taller, switch
  Default to Gray and back, reload, and reactivate displayed zoom 14. Save a
  PNG. Repeat the fixed-overlay and zero-live-tile checks on the production
  custom domain after deployment.
- Acceptance criteria: displayed zoom 14 uses only the continuous overview
  atlas; displayed zoom 15 and above continue to use only the established
  native collection; covered pans, resize, Default/Gray switching, and reload
  do not leave Detailed stuck on the regular map; the Leaflet live tile pane
  stays empty while Detailed is active; Singapore Land Authority attribution
  remains visible; owner authentication survives reload; and PNG export
  completes without a map-readiness error. The six production map roots are a
  required build contract, and Default and Gray upload commands must remain
  isolated to their own immutable prefixes.
- Verification result before deploy: the continuous atlas validation passed
  for one Default and one Gray surface, each with 2,109 chunks. Full public
  verification fetched and hash-checked all 2,109 Default chunks
  (153,236,225 bytes, index
  `be1e2a41c5395cd72111268cebd8e763741bb653bcee08c4c33bbb719e83792b`)
  and all 2,109 Gray chunks (100,217,117 bytes, index
  `8a7e1f054edf076083a499bd19d79775714e5e2f65a9454ea844e9d437bd640e`).
  Both roots returned the expected CareAround CORS header and revalidating
  index cache policy. Map-lockdown tests passed 71/71, R2 deployment tests
  passed 8/8, server tests passed 490/490, the exact six-root production build
  passed, and `git diff --check` passed. The broad client suite passed 519/520;
  its only failure remains the already-recorded date-sensitive Care Calendar
  planning-conflict fixture. Authenticated Chrome UAT on map 269 confirmed
  displayed zoom 14 with 12-15 visible fixed chunks, zero live tile-pane
  images, east/west movement across former plate edges, map-height resize from
  about 348 to 460 pixels, Default/Gray switching, reload/session continuity,
  zoom-14 reactivation, visible attribution, and PNG completion without the
  prior map-readiness error.

## 2026-07-30 Feature-gated zoom-14 Detailed overview trial

- Current behavior: the normal local and production Detailed map contract is
  unchanged at displayed zoom 15. The opt-in
  `npm run dev:client:zoom14-overview` trial adds a separate, lower-resolution
  overview collection at displayed zoom 14 while retaining the native fixed
  surface at zoom 15 and above. The tier boundary uses the exact native
  threshold, and native containment yields during the 15-to-14 handoff so an
  internal fractional zoom cannot immediately restore the native tier. Map
  settings report level 14 only when the overview collection is configured.
  A genuine overview-surface manifest handoff now shows `Loading detailed
  map...` on the map surface and inside Map settings until the selected fixed
  surface is ready. Outside-coverage fallback remains a separate state and
  does not show the loading message.
- Known-good reference: branch `codex/detailed-map-zoom14-overview`, based on
  the production zoom-15 Detailed-map baseline and recovery sequence recorded
  below. The trial is client-only and feature-gated. Production asset roots,
  default local startup, native manifests, annotations, resource pins, owner
  privacy, API behavior, and production data remain unchanged.
- Reproduction steps: start the opt-in local client, sign in as an owner, and
  open maps 269 and 258 in Print View. From a covered displayed zoom 15, zoom
  out once to displayed zoom 14. Pan far enough to change the selected overview
  surface from C01 to C02 on map 269 and from W04 to W01 on map 258. Resize the
  map, switch Default to Gray and back, complete a 14-to-15-to-14 round trip,
  reload, and reactivate zoom 14. Pan beyond the generated overview envelope
  until the regular map appears, then return until the full settled viewport
  is contained by an overview surface.
- Acceptance criteria: displayed zoom 14 uses only the overview collection;
  displayed zoom 15 and above use only the native collection; movement and
  plate changes do not regress to the regular map while the settled viewport
  remains covered; genuine outside-coverage fallback returns to Detailed
  automatically once the full viewport re-enters coverage; resize and
  Default/Gray switching preserve Detailed; the Leaflet tile pane stays empty;
  Singapore Land Authority attribution remains visible; reload preserves the
  owner session; and disabling the trial flag restores the established
  zoom-15-only contract. Future 100% zoom-14 coverage must cover every supported
  viewport envelope, including boundary overlap, rather than only every
  Singapore point or town centre. A pending covered-surface handoff must show
  the visible loading message, remove it when fixed image layers are ready, and
  never reuse it for a genuinely outside-coverage viewport.
- Verification result before deploy: the generated overview validation passed
  for 32 Default and 32 Gray surfaces. Focused surface, integration, settings,
  and local-configuration coverage passed 42/42. Map-lockdown, Print View, and
  annotation coverage passed 70/70, followed by the exact four-root
  production-style client build with only the established large-chunk
  advisory. The broad client suite passed 518/519; its only failure is the
  already-recorded date-sensitive Care Calendar planning-conflict fixture.
  Authenticated Chrome UAT confirmed C01-to-C02 and W04-to-W01 movement at
  displayed zoom 14, map-height resize from 360 to 440 pixels, Default/Gray
  switching, a 14-to-15-to-14 round trip, reload and reactivation, fixed image
  overlays throughout, zero live tile-pane images, no unavailable message,
  visible attribution, and owner-session continuity. Follow-up UAT on map 269
  confirmed that leaving the current overview envelope falls back, returning
  only the viewport centre remains in fallback while an edge is still outside,
  and Detailed recovers without a reload or mode toggle once the full viewport
  is covered again. Follow-up instrumentation reproduced the reported sequence:
  covered overview movement briefly entered the real pending state, repeated
  containment adjustments advanced the internal zoom from `14.7` through
  `14.9` to native `15.0`, and an uncached overview handoff displayed the new
  in-map loading message for about 1.6 seconds before fixed image layers
  returned. Panning beyond the generated envelope showed no loading message.
  Focused surface, integration, settings, and local-configuration coverage
  remained green at 42/42. This trial has not been committed, pushed, or
  deployed.

## 2026-07-30 Owner Print View image-export readiness recovery

- Current behavior: the high-resolution offscreen export surface is mounted
  only after an owner chooses `Save PNG`, `Save Map PNG`, `Save Resource PNG`,
  or `Save PDF`, and it
  is released as soon as that export finishes or fails. Idle Print View keeps
  only the visible map surface in memory. Each save starts from a fresh capture
  readiness state while retaining the existing cached-image load handling and
  frozen print-map state.
- Known-good reference: branch
  `codex/my-map-owner-regression-recovery`, based on the production zoom-15
  Detailed-map and cached-image readiness fixes in `e33972f31`, `f5940d9e1`,
  `c0ccbd06`, and `54b7029e`. The change is limited to the client export
  lifecycle and does not alter the visible Print View map, Detailed-map zoom
  eligibility, fixed-surface manifests or assets, annotations, resource
  numbering, PDFs, owner privacy, API behavior, or production data.
- Reproduction steps: sign in as an owner, open an owned map in Print View,
  choose `Full map`, and leave the map at displayed zoom 15 with the Detailed
  fixed surface visible. Choose `Save Map PNG`, then `Save Resource PNG`.
  Confirm that the fresh export surface finishes loading and that both the map
  and resources images download without the message `Image export failed
  because the directory map did not finish loading`.
- Acceptance criteria: Print View does not keep a duplicate offscreen Detailed
  map mounted while idle; save actions mount a fresh high-resolution surface;
  Map PNG waits for real map readiness; Resource PNG remains independent of map
  readiness; the map PNG contains the Detailed basemap, resource pins, and
  annotations; the resources PNG retains the selected layout; no readiness
  error is shown; and the offscreen surface unmounts after completion.
- Verification result before deploy: authenticated local owner UAT on map 269
  at Full-map zoom 15 downloaded
  `iccp-queenstown-4-map.png` at 5920 x 4432 and
  `iccp-queenstown-4-resources.png` at 5920 x 1560 with no export error. Visual
  inspection confirmed the Detailed basemap, numbered resource pins, saved
  polygon annotation, Singapore Land Authority attribution, and map framing in
  the map image. Map-lockdown coverage passed 66/66 and the exact four-root
  production client build passed with the established large-chunk advisory via
  `npm run verify:map-lockdown`; `git diff --check` passed.

## 2026-07-29 Owner My Map placement, Detailed map, and annotation visibility recovery

- Current behavior: owner My Map can enter `Add personal place` placement mode
  from the chooser and the map remains clickable while the chooser closes, so
  clicking or tapping the map opens the personal-place editor instead of
  silently dropping the wizard. Saved Print View annotations are loaded for the
  owner My Map detail route and rendered read-only on the normal interactive
  owner map; annotation creation/editing remains limited to desktop Full-map
  Print View, and shared maps still receive no print-annotation payload or
  overlay. The Detailed fixed-town map buffers only transient negative viewport
  eligibility during move/resize/zoom settling, reducing flicker back to the
  standard map while preserving the real outside-surface fallback.
- Known-good reference: branch `codex/my-map-owner-regression-recovery`, based
  on `codex/community-plaza-coordinate-correction` before tracked edits. The
  change is client-only and does not alter resource governance, personal-place
  privacy, public Discover resources, shared-map snapshots, notes storage,
  annotation persistence schema, Leaflet marker data, Cloudflare Worker/API
  behavior, auth/session, postal validation, imports, or production data.
- Reproduction steps: sign in as the owner, open an owned My Map, choose `Add
  personal place`, click `Create new`, then click the map and confirm the
  editor opens. Open the same owner map with saved print annotations and confirm
  the annotations appear on the interactive map as read-only overlays; open
  Print View Full-map to confirm annotation tools still own editing. Move,
  resize, or expand the zoom-15 Detailed map while the viewport remains within
  the covered surface and confirm it does not unnecessarily fall back to the
  standard map.
- Acceptance criteria: personal-place map placement stays active until a map
  coordinate is selected or cancelled; normal interactive map annotations are
  owner-only and read-only; Print View remains the only annotation editing
  workspace; Shared Maps and guest routes do not expose annotations; Detailed
  map fallback still occurs when a settled viewport is genuinely outside the
  available fixed-town surface.
- Verification result before deploy: focused source/map coverage passed 30/30
  with `node --test client/test/printAnnotations.test.js
  client/test/myMapPersonalPlacesSource.test.js
  client/test/fixedTownSurfaceIntegration.test.js
  client/test/directoryMapCamera.test.js`; broader map/print coverage passed
  63/63 with `node --test client/test/printMapWorkspace.test.js
  client/test/mapSettingsControl.test.js client/test/fixedTownSurface.test.js
  client/test/myMapV2Scaffold.test.js`; and the exact four-root production
  client build passed with the established large-chunk advisory via
  `npm run build:client:map-lockdown`. Full client source coverage was also
  attempted with `node --test client/test/*.test.js client/src/lib/*.test.js`
  and showed one repeatable unrelated Care Calendar planning-conflict assertion
  failure in `client/test/careCalendarPlanning.test.js`; the touched My Map,
  annotation, and fixed-town map guardrails remained green.
- 2026-07-29 Print View zoom-15 Detailed follow-up: the interactive owner Print
  View preview is now the only print map instance that reports fixed-surface
  viewport bounds for Detailed surface selection. Hidden export/capture maps
  consume the selected surface without overwriting it, so a covered displayed
  zoom step 15 preview does not fall back to live OneMap tiles because of an
  offscreen capture viewport. The resize containment helper also applies the
  minimum required fractional zoom immediately before listening for
  resize/move/zoom events, avoiding unnecessary promotion from displayed step
  15 to step 16 when the current covered viewport only needs containment. Focused
  map/print coverage passed 54/54 with `node --test
  client/test/printMapWorkspace.test.js
  client/test/fixedTownSurfaceIntegration.test.js
  client/test/fixedTownSurface.test.js
  client/test/mapSettingsControl.test.js`; `npm run build:client:map-lockdown`
  passed with the established large-chunk advisory; and `git diff --check`
  passed.
- 2026-07-29 Print View cold-start zoom-15 recovery: a Full-map Print View that
  opened directly at underlying zoom `15.0` could exceed the fixed-surface
  viewport memory guard by a small amount. The fallback stored rounded zoom
  step `15`, so the normal fractional containment adjustment within displayed
  step 15 could not retry Detailed until the UI reached step 16. The fallback
  now retains the exact failed zoom and retries after at least `0.05` fractional
  zoom advancement. The existing `384 MiB` memory guard remains unchanged.
  Full-map Print View also preserves the lower visible integer step while its
  containment helper applies a fractional internal zoom, so an internal
  `15.x` containment adjustment remains displayed as zoom step 15 instead of
  presenting itself as step 16. Other map counters retain their established
  nearest-step behavior.
  Reproduction must cold-load an authenticated owner Full-map Print View at
  displayed step 15, without first visiting step 16, and then cover resize,
  Default/Gray switching, and reload. Acceptance requires fixed-surface image
  overlays, no live Leaflet tile-pane images, visible Singapore Land Authority
  attribution, and session continuity throughout. Focused fixed-surface
  coverage passed 31/31, map-lockdown coverage passed 66/66, full server
  coverage passed 490/490, the exact four-root production client build passed
  with the established large-chunk advisory, and `git diff --check` passed.
  Full client source coverage passed 511/512 with only the same unrelated,
  repeatable Care Calendar planning-conflict assertion already recorded above.
- 2026-07-29 My Map lazy-chunk cache recovery: production UAT of the zoom-15
  follow-up reached the route-level `Page update needed` fallback on the custom
  domain even though the exact immutable Pages deployment loaded the same owner
  Print View successfully at displayed step 15. Browser diagnostics identified
  a failed dynamic import for the cached `MyMapDetailPage` chunk, while direct
  custom-domain checks returned the current chunk as JavaScript with matching
  bytes. This isolated the failure to the custom domain's four-hour static
  cache plus the PWA's cache-first asset response, not to auth, API data, React
  rendering, or Detailed-map selection. The My Map route now carries
  `data-route-cache-version="2026-07-29.1"` to rotate its lazy chunk, and PWA
  cache `v3` revalidates `/assets/` with the network before refreshing its
  offline copy. It still falls back to a valid cached JavaScript asset when the
  network is unavailable and still rejects HTML fallbacks as build assets.
  Reproduce by loading an older controlled PWA cache, publishing a build whose
  entry dependency changes, and opening an authenticated owner My Map route.
  Acceptance requires the custom-domain route to load without the update
  fallback, the service worker to replace stale build assets without caching
  HTML, offline cached assets to remain usable, and Full-map Print View to show
  Detailed fixed-surface overlays at displayed step 15. Focused PWA and
  fixed-surface coverage passed 40/40; map-lockdown coverage passed 66/66; the
  exact four-root production client build passed with the established
  large-chunk advisory; and `git diff --check` passed. Full client source
  coverage passed 513/514 with only the same unrelated, repeatable Care
  Calendar planning-conflict assertion already recorded above. Full server
  coverage remained green at 490/490 from the same client-only release run.
  Release follow-up: implementation commits `c0ccbd06`, `54b7029e`, and
  `465cce54` were pushed to `codex/my-map-owner-regression-recovery`. The
  validated client was explicitly published to the Pages production branch at
  `https://a7378ec6.senior-resource-map.pages.dev`; the custom domain serves
  `assets/index-BO3mqbup.js`,
  `assets/MyMapDetailPage-CRi8hNNe.js`,
  `assets/useDirectoryDistanceAnchor-nhODyfps.js`, and PWA cache `v3`.
  A post-propagation audit matched all 59 deployed client assets to the
  validated `client/dist` files with correct non-HTML content types. Fresh
  authenticated custom-domain UAT on owner Print View map 269 cold-loaded at
  visible zoom 15 with `Detailed` selected, eight fixed-surface image layers,
  zero live tile-pane images, Singapore Land Authority attribution, and no
  CareAround application warnings or errors. The same state survived
  Default/Gray switching, map-height resize, and reload with owner session
  continuity and without the route update fallback. Production public smoke
  passed 1/1 and API health returned OK at
  `2026-07-29T15:16:37.914Z`. The credentialed smoke subset was not run because
  its account variables were unavailable in the release shell. No Worker/API,
  R2, schema, auth, permission, map-data, or production-data deployment was
  performed.

## 2026-07-28 Admin Places CSV required-header import recovery

- Current behavior: Admin Data Tools can upload Places CSV files generated from
  the CareAround workbook template/export labels, including required headers
  such as `name *`, `postalCode *`, `Postal Code *`, and canonical headers such
  as `name` and `postalCode`. Client-side CSV batching canonicalizes those
  labels before building batch files, so required display markers do not erase
  the actual values.
- Known-good reference: branch `codex/admin-csv-import-header-normalization`,
  based on `ba99dced8`. The change is client-only and does not alter workbook
  schemas, server import validation, resource ownership rules, subregion
  derivation, geocoding, cache rebuilds, audit logging, Discover, or map
  behavior.
- Reproduction steps: download or prepare a Places CSV whose header row uses
  the display labels `externalKey *`, `name *`, `country *`, `postalCode *`,
  and `ownershipMode *`; upload it through Admin Tools -> Asset Workbook Tools
  -> Places. Confirm the client CSV batcher preserves row values for `name` and
  `postalCode` instead of reporting every row as missing those fields.
- Acceptance criteria: CSV and Excel imports continue to accept canonical and
  display-labelled workbook headers case-insensitively. Required-field markers,
  spaces, underscores, punctuation, and a UTF-8 BOM in CSV headers must not
  stop the batching step from finding canonical required fields. Server-side
  validation and import rules remain authoritative after batching.
- Verification result before deploy: focused client source coverage passed
  `node --test client/test/adminAssetWorkbookCsvHeaders.test.js`; the original
  `Enriched_CareAround_RC_RN_list.csv` reproduced the old lookup failure with
  1,093/1,093 rows missing `name` and `postalCode`, while the patched lookup
  recovered both fields for 1,093/1,093 rows with no Papa parse errors. Server
  `parseWorkbookRows` accepted both the original display-labelled CSV and the
  cleaned import-ready copy as 1,093 Places rows. `npm run build:client` passed
  with only the established large-chunk advisory, and `git diff --check` passed.
- 2026-07-28 Worker subrequest-limit follow-up: after the header recovery, the
  production import reached the Places path but failed with `Too many
  subrequests by single Worker invocation`. Places CSV uploads now use 100-row
  client batches instead of 500-row batches; server Places import prefetches
  postal-code and existing-key lookups in 1,000-key chunks instead of 20-key
  chunks; system-owned Places rows skip unused partner/subregion/audience-zone
  reference lookups; and Places map-cache refresh is queued as a post-import
  task that refreshes `all` first, then affected regions without recursively
  rebuilding `all` after every region. The importer still writes through the
  same server validation, ownership checks, postal-code subregion derivation,
  geocoding fallback, upsert contract, and audit event. Verification passed
  focused coverage with `node --test client/test/adminAssetWorkbookCsvHeaders.test.js`
  and `node --test server/test/cacheBuilder.test.js server/test/workbookImportSubrequestBudgetSource.test.js`;
  full server coverage passed 483/483 with `npm run test:server`;
  `npm run build:client` passed with only the established large-chunk advisory;
  and `git diff --check` passed.
- 2026-07-28 postal fallback follow-up: production UAT of the 1,093-row
  `Enriched_CareAround_RC_RN_list_import_ready.csv` showed 1,068 Places
  created/updated, then rejected 25 rows. The leading-zero Singapore postals
  were being parsed from CSV numeric cells as five-digit numbers such as
  `50034`, `80006`, and `90005`; Places workbook parsing now normalizes
  `postalCode` cells through the shared postal-code normalizer before subregion
  lookup and import reporting. Valid SG Places rows that already include
  Singapore-bounds latitude/longitude can use the Singapore fallback region and
  cache the postal code without another live OneMap call, keeping the stricter
  live OneMap fallback for imported rows without trusted coordinates. OneMap
  non-JSON responses now produce clean validation/geocoding errors instead of
  raw JSON parser text. Verification passed focused coverage with
  `node --test server/test/workbookSecurity.test.js server/test/singaporePostalFallback.test.js server/test/workbookImportSubrequestBudgetSource.test.js`;
  full server coverage passed 486/486 with `npm run test:server`; and
  `git diff --check` passed. A local parser probe against
  `Enriched_CareAround_RC_RN_list_import_ready.csv` kept the affected
  leading-zero rows as `050034`, `050538`, `080006`, `080012`, `080104`,
  `080333`, `081004`, `085701`, `088995`, `089774`, `090005`, `090022`,
  `090034`, `090108`, `090114`, and `098917`.
- 2026-07-28 OneMap throttle follow-up: a retry of the same import created or
  updated 1,090 Places and left three errors for `460151`, `521232`, and
  `542175`. Those rows were valid OneMap postals but had blank `lat`/`lng`, so
  they used the server geocoding path and OneMap returned HTTP 429. Places
  import now caches geocoded coordinates by postal code within each batch, so
  repeated blank-coordinate postals such as `460151` do not make duplicate
  OneMap calls. The geocoder retries transient OneMap 429/5xx responses with a
  short capped backoff and still prefers exact `POSTAL` matches from the
  response before accepting coordinates. Verification passed focused coverage
  with `node --test server/test/workbookSecurity.test.js server/test/singaporePostalFallback.test.js server/test/workbookImportSubrequestBudgetSource.test.js`;
  full server coverage passed 487/487 with `npm run test:server`; and
  `git diff --check` passed.

## 2026-07-28 Manage Resources search operator and search bar polish

- Current behavior: Manage Resources keeps simple searches paginated and
  server-filtered, but Discovery-style operator searches such as `rn,rc` and
  `rn/rc` now load the scoped managed dataset without sending the operator
  query as a literal server `q` value. Client-side Manage Resources search then
  applies comma groups as AND and slash groups as OR across Place, Offering,
  Group, and Template list text. Filtered workbook export keeps the established
  server-filtered path for simple Place searches and uses ordered ids for
  client-only operator searches. The Manage Resources search icon is centered
  in a fixed full-height icon slot so it stays aligned with the input text.
- Known-good reference: branch `codex/manage-resources-search-polish`, based
  on `64502aa3a`. The change is client-only and does not alter server search
  utilities, workbook schemas, access-control rules, Discover ranking, public
  visibility, My Directory, My Maps, map behavior, imports, or production data.
- Reproduction steps: sign in as a user with Manage Resources access, open
  `/dashboard/resources`, search Places for `rn,rc`, and confirm Resident
  Network / Residents' Committee rows are returned instead of an empty literal
  `rn,rc` result. Search `rn/rc` and confirm either phrase can match. Confirm a
  simple search such as `frcs` still uses the normal server-filtered list and
  filtered workbook export remains available.
- Acceptance criteria: comma-separated phrases must all match within at least
  one searchable field group, slash-separated groups must match as alternatives,
  repeated or empty operators must not break the search, managed-resource
  scoping must remain enforced before any client-side filtering, and the search
  icon must remain vertically centered across normal and larger text settings.
- Verification result before deploy: focused client coverage passed 16/16 with
  `node --test client/test/resourceListLoading.test.js client/test/resourceSearch.test.js`;
  `npm run build:client` passed with the established large-chunk advisory;
  full server coverage passed 487/487 with `npm run test:server`; and
  `git diff --check` passed.
- 2026-07-28 resource-list load recovery follow-up: Manage Resources now loads
  Places, Offerings, and Groups as separate bounded list families. Offerings
  request `assetMode=offering`, which the Worker treats as every soft asset
  except Groups so generated child offerings remain in the Offerings tab.
  Groups request `assetMode=group` through their own loader, loading state,
  error state, count, and pagination. A slow or failed Groups request no longer
  blocks Offerings from rendering or forces the Offerings count to zero. The
  change does not alter Discover, public visibility, access-control rules,
  workbook schemas, imports, ownership, resource detail, My Directory, My Maps,
  auth/session behavior, or production data.
- Verification result before deploy: focused coverage passed 31/31 with
  `node --test client/test/resourceListLoading.test.js client/test/groupAssetUiSource.test.js`;
  the Worker source guard passed with
  `node --test server/test/softAssetAssetModeFilterSource.test.js`; full
  server coverage passed 488/488 with `npm run test:server`; standard
  `npm run build:client` passed with the established large-chunk advisory; and
  the exact four-root production client build passed with the established
  large-chunk advisory.
- 2026-07-28 hard-list budget follow-up: managed Places list summaries no
  longer hydrate membership previews or organization resource links for every
  page. The Memberships drawer now fetches the single detailed Place record on
  demand, preserving the member preview there while keeping initial Places list
  requests inside the Worker subrequest budget. This keeps the list endpoint
  scoped, paginated, and lightweight without changing resource details,
  membership QR generation, imports, public Discover, ownership, visibility, or
  production data.
- Verification result before deploy: focused client coverage passed 32/32 with
  `node --test client/test/resourceListLoading.test.js client/test/groupAssetUiSource.test.js`;
  focused server coverage passed 14/14 with
  `node --test server/test/hardAssetSummaryListBudgetSource.test.js server/test/softAssetAssetModeFilterSource.test.js server/test/resourceListScope.test.js`;
  full server coverage passed 489/489 with `npm run test:server`; standard
  `npm run build:client` passed with the established large-chunk advisory; and
  the exact four-root production client build passed with the established
  large-chunk advisory.
- 2026-07-28 database-wait amplification hotfix and managed-resource save
  follow-up: production evidence showed the initial full `/subregions` request
  taking about 95.8 seconds while the three managed Place, Offering, and Group
  list requests took about 58-63 seconds with low Worker CPU. Later retries
  recovered to about 3 seconds as the database path warmed. The page now loads
  Region names and postal counts with `includePostalCodes=false`; full postal
  coverage is loaded once, on demand, only before a Place create, import, edit,
  or Memberships workflow that needs exact postal matching. The detailed
  result is cached for that page session and a late lightweight response cannot
  replace it. Managed page requests now carry an abort signal, and a 45-second
  timeout aborts and stops instead of starting up to two more live copies.
  Immediate non-timeout failures retain the established bounded retry. Places,
  Offerings, and Groups also expose the existing shared heart control so an
  operator can save or remove a managed resource from My Directory without
  returning to Discover.
- Reproduction steps: sign in with Manage Resources access and open
  `/dashboard/resources`. Confirm the default page requests summary Region
  metadata without the full postal list and renders Place, Offering, and Group
  counts independently. Open a Place create/import/edit or Memberships flow
  and confirm exact postal coverage loads before the postal-dependent UI.
  Trigger or simulate a resource page timeout and confirm only one request is
  made for that attempt. Use the heart control on a Place, Offering, and Group;
  confirm the state also appears in My Directory and can be removed from either
  surface.
- Acceptance criteria: default Manage Resources loading must not fetch the full
  Region postal-code payload; postal-dependent Place workflows must retain
  exact configured-region and Singapore fallback behavior; timed-out resource
  requests must be aborted without duplicate retry load while fast transient
  failures can still retry; the shared saved-resource API and optimistic state
  remain the only source of truth for favourites; and no server schema,
  permissions, ownership, import, visibility, Discover ranking/filtering,
  My Maps, auth/session, or production-data behavior changes.
- Verification result before deploy: focused client coverage passed 38/38 with
  `node --test client/test/paginatedResults.test.js client/test/apiRequest.test.js client/test/resourceListLoading.test.js client/test/savedAssetsContextSource.test.js`;
  all 495 client tests outside the known date-sensitive
  `careCalendarPlanning.test.js` fixture passed; the full client run passed
  498/499 with only that unchanged July 20 expiry fixture failing, matching the
  existing ledgered baseline; full server coverage passed 489/489 with
  `npm run test:server`; the exact four-root production client build passed
  with the established large-chunk advisory; and `git diff --check` passed.
  Credentialed smoke was unavailable because the smoke username and password
  were not present in the shell.

## 2026-07-27 Owner Full map Print layer controls

- Current behavior: a signed-in map owner on a desktop-capable Print View can
  open `Map layers` from the `Full map` surface. Resource visibility can be
  changed for all mapped resources, for CareAround or Personal places, or for
  an individual category, including custom personal-place categories.
  Annotation visibility can be changed for the whole annotation layer or for
  one saved annotation. Annotation rows retain the existing backward/forward
  controls, and those controls continue to update the persisted annotation
  document order. Visibility choices last only for the current Print View
  session and reset on reload.
- Resource cards remain complete when map pins are hidden. Hidden pins do not
  renumber the surviving pins, change their colours, or refit the map camera.
  The visible owner preview and hidden PNG/PDF capture surface receive the same
  filtered resource pins and annotations. Resource pins remain in their
  established Leaflet marker pane; annotation ordering does not interleave
  resources into the annotation z-order.
- Known-good reference: branch `codex/print-map-layers`, based on
  `c500da944`. The implementation is client-only and adds no schema, API,
  sharing, or persistence contract for visibility.
- Reproduction steps: sign in as a non-guest owner, open an owned My Map with
  `?view=print`, choose `Full map`, and open `Map layers`. Hide Personal places
  and confirm only personal-place pins disappear while every resource card,
  the resource total, surviving pin number, map centre, and zoom remain
  unchanged. Restore that group, hide one CareAround or personal category, and
  repeat. Hide one annotation and then all annotations; confirm resource pins
  remain. Confirm the screen preview and export capture surface show the same
  visible layers. Reload and confirm all visibility controls reset while the
  saved annotations and their order remain. Switch to Balanced or Side map and
  confirm the layer control is absent. Open an interactive owner map, a shared
  map, and a guest view and confirm no layer control is exposed.
- Acceptance criteria: layer visibility is owner-only, desktop-only,
  `Full map` Print View state; it is not stored in the annotation document,
  map record, local storage, shared-map snapshot, or server. Resource cards
  and export directory content remain complete. Filtering uses stable place
  keys and preserves original pin numbers, colours, grouping, map fit inputs,
  and camera state. Preview, PNG, and PDF map surfaces match. Annotation
  visibility does not delete or rewrite an annotation. Existing annotation
  order remains the only z-order model and can still be persisted through the
  established editor workflow. Interactive My Map, Balanced and Side layouts,
  Shared Maps, Discover, managed Resources, personal-place privacy, map notes,
  Detailed basemap behavior, imports, governance, and AI remain unchanged.
- Verification result before deploy: focused layer, Print View, and annotation
  coverage passed 32/32; map-lockdown coverage passed 61/61; full server
  coverage passed 481/481; local Detailed-map configuration coverage passed
  2/2; and the exact four-root production client build passed with only the
  established large-chunk advisory. The broad client suite passed 492/493; its
  only failure is the previously recorded date-sensitive Care Calendar
  conflict fixture whose fixed 2026-07-20 events are now expired and whose
  source is untouched here. Authenticated Chrome UAT on map 258 confirmed
  screen/export parity when hiding Personal places, Outdoor, and Boundary 1;
  all 22 resource cards and original pin numbers remained; visibility reset
  after reload; and the owner session remained authenticated. At zoom 15 the
  Print View retained 24 Detailed image overlays, zero live tile images,
  attribution, Default/Gray switching, and Detailed behavior after keyboard
  resize.
- Production release result: implementation commit `f07417c37` was pushed on
  `codex/print-map-layers` and fast-forwarded to `main`. The exact validated
  four-root `client/dist` was explicitly published to the production Pages
  branch at `https://7efb5b23.senior-resource-map.pages.dev` after the
  connected Git build produced a mismatched cached directory chunk. The custom
  domain then served `assets/index-DZLT63u3.js`,
  `assets/index-DqBjD9xl.css`,
  `assets/MyMapDetailPage-mX-pib7E.js`, and
  `assets/useDirectoryDistanceAnchor-d-A3YUR2.js`; all four files matched the
  validated local artifacts byte-for-byte. Production API health returned OK
  at `2026-07-27T04:08:51.254Z`, and production smoke passed all 6/6 release
  journeys, including authenticated partner access, postal import, map
  creation, saved-resource detail, and schedule review. No Worker/API, schema,
  database, shared-map, public-resource, or production-data change was
  deployed.
- Rollback: remove `PrintMapLayersControl` and its session visibility fields,
  restore Print View to pass the full pin and annotation arrays to both
  surfaces, and remove the optional `DirectoryMap.renderPins` split. No API,
  schema, annotation-document, personal-place, shared-map, or public-resource
  rollback is required.

## 2026-07-26 Private My Map Print annotations V1

- Current behavior: every signed-in non-guest map owner using a hover-capable
  fine-pointer device can open `Annotate` from any Print View layout. If the
  current layout is Balanced or Side focus, `Annotate` switches directly to
  `Full map` before opening the editor. Annotation rendering and editing remain
  limited to the owner `Full map` layout. The focused toolset contains labelled
  pins, lines, rectangles, circles, and point-by-point polygon boundaries; the
  earlier standalone text and arrow tools are retired.
  Rectangle, circle, and polygon notes render directly inside their shapes
  without a separate text box. Owners can choose preset or custom colours,
  text colour, font size, line weight, fill opacity, and dashed lines. New
  annotation outlines and line drafts are solid by default; `Dashed line` is
  an explicit option that updates both the draft and saved annotation. Each
  drawing tool gives a contextual map instruction and exposes explicit `Done
  drawing` and `Cancel tool` controls. `Undo last point` removes only the latest
  draft anchor, and Backspace remains available as a keyboard shortcut.
  Selected annotations can move backward or forward one layer at a time, with
  document array order serving as the persisted layer order.
- Annotation edits autosave to one revisioned document per owned map, retain a
  bounded and debounced local draft on save failure, expose undo/redo and
  visible map-surface save feedback, and can be retried after a load failure.
  Text and slider edits preview locally and commit on blur or pointer release
  instead of rerendering and saving the map for every input event. Saved
  polygon anchors remain sparse and editable while the map renders a
  deterministic rounded path derived from those anchors. Phone and tablet Full
  map Print View render saved annotations read-only and do not expose the
  editor. Balanced and Side focus layouts do not render annotations. The
  visible Full map owner preview and hidden Full map PNG/PDF capture use the
  same annotation document.
- Known-good reference: branch `codex/print-map-annotations`, based on
  `0745e2012`. The annotation table is private through `my_maps.user_id` and
  deletes with its map. Shared-map snapshots and APIs do not query or serialize
  annotation documents.
- Reproduction steps: run the production schema bootstrap, sign in as any
  non-guest user, open an owned My Map, choose Print View, leave the layout on
  Balanced, then choose `Annotate` on a desktop pointer device. Confirm the
  layout changes to `Full map`, the editor opens, and existing saved annotations
  reappear. Repeat in a narrow desktop browser window and confirm that pointer
  capability, rather than a 1024px viewport threshold, keeps `Annotate`
  available. Place and edit a pin, line, rectangle, circle, and polygon. Confirm
  each drawing tool shows its helper instruction and can be completed with the
  tick or abandoned with the cross. Confirm a new line and shape draft use a
  solid outline, select `Dashed line`, and confirm the draft and saved
  annotation become dashed. While drafting, place one point incorrectly,
  choose `Undo last point`, and confirm only that point is removed. Add shape
  notes and confirm they appear within their shapes; change custom shape and
  font colours and font size. Overlap two annotations, move the selected
  annotation backward and forward, then reload and confirm the layer order
  persists. Confirm polygon corners render rounded while edit handles remain
  on the original sparse anchors. Save PNG and PDF exports and confirm both
  match the visible Full map preview. Switch to Balanced or Side focus and
  confirm annotations and the editor are absent; reopen Full map and confirm
  the saved annotations return. Open the same Full map Print View at a phone or
  tablet breakpoint and confirm the saved annotations remain visible but
  `Annotate` is absent. Open the public Shared Map link and confirm annotations
  are absent.
- Acceptance criteria: annotation reads and writes require an authenticated
  non-guest owner; guests and non-owners are rejected; stale revisions fail
  rather than overwriting another session; annotation count, point count,
  labels, colours, opacity, line weight, ids, and geometry types are bounded;
  freehand/lasso input is rejected; map deletion cascades the document;
  Shared Maps, Discover, managed Resources, personal-place data, imports,
  governance, AI, interactive My Map, resource pins, map camera, Detailed
  basemap selection, and map notes remain unchanged. Polygon persistence keeps
  sparse control anchors as the only editable and saved geometry. Corner
  rounding is render-only, deterministic, bounded, and does not move or add
  edit handles. Annotation type, typography, style, and point-count schemas
  reject the retired text and arrow types. Layer order is bounded by the
  existing annotation count and persisted without a second ordering model.
  Annotations render only in the owner Full map layout, including export.
  Opening the editor from another owner Print View layout must switch to Full
  map without deleting or rewriting the saved annotation document. No
  road-provider request, road-refinement API route, road attribution, or
  road-snap metadata is required.
- Verification result before deploy: annotation model/controller coverage
  and focused client normalization, smoothing, editor-source, and responsive
  coverage passed 13/13; map-lockdown coverage passed 59/59; full server
  coverage passed 481/481; and the exact four-root production client build
  passed with only the established large-chunk advisory. Final
  `git diff --check`, exact build, and served-artifact verification are release
  gates immediately before deployment. Authenticated browser UAT remains a
  user-assisted check because the available Chrome session is signed out.
- 2026-07-27 annotation discoverability recovery: a narrow desktop browser
  window no longer loses `Annotate` solely because its viewport is below
  1024px. Hover and fine-pointer capability now identify the desktop editing
  surface. Choosing `Annotate` from Balanced or Side focus closes Print layout,
  switches to Full map, reloads the private annotation document, and opens the
  editor; the saved layer remains hidden in non-Full layouts. Focused
  annotation, Print View, and personal-place source coverage passed 34/34;
  map-lockdown coverage passed 60/60; full server coverage passed 481/481; the
  exact four-root production client build passed with only the established
  large-chunk advisory; and `git diff --check` passed. Authenticated Chrome UAT
  on map 258 at a 733px viewport confirmed `Annotate` remained available in
  Balanced, automatically opened `full-map`, restored the saved polygon and
  editor, and retained Detailed at zoom 15 with visible fixed-surface overlays,
  attribution, and zero live tile images. Rollback is limited to the
  desktop-capability query, the toolbar transition handler, and its explanatory
  copy; annotation persistence, schemas, Full-map-only rendering, exports, and
  shared-map exclusion are unchanged.
- 2026-07-27 solid annotation default recovery: the draft renderer now follows
  the active annotation style instead of hard-coding a dashed preview. New
  annotation lines and shape outlines start solid, while the existing `Dashed
  line` checkbox remains an explicit opt-in and saved dashed annotations remain
  unchanged. Focused annotation coverage passed 8/8; map-lockdown coverage
  passed 62/62; full server coverage passed 481/481; and the exact four-root
  production client build passed with only the established large-chunk
  advisory.
- 2026-07-28 custom shape-colour picker recovery: the existing custom
  shape-colour input is now a clearly labelled `Custom` control that shows the
  current swatch and hexadecimal value. Preset shape colours, separate text
  colour, outline/fill coupling, saved annotation styles, and the annotation
  document schema are unchanged. Authenticated Chrome UAT on map 258 confirmed
  the control rendered inside the Full-map annotation toolbar as `Custom
  #0F766E`, remained fully contained, and retained its accessible `Shape colour
  picker` label. Focused annotation coverage passed 8/8; map-lockdown coverage
  passed 62/62; full server coverage passed 481/481; `git diff --check` passed;
  and the exact four-root production client build passed with only the
  established large-chunk advisory.
- Polygon smoothing and road-snap removal rollback: the rounded display path is
  isolated in `client/src/lib/printAnnotations.js` and can be removed without
  changing saved geometry. Full annotation rollback removes the annotation API
  routes, private document table/controller, editor/layer components, and
  optional `DirectoryMap.mapOverlay` prop; no public resource or shared-map
  rollback is required.
- 2026-07-27 road-snap removal and polygon interaction lock: the experimental
  road-refinement provider, server adapter and route, client API helper,
  toolbar controls, tolerance state, attribution hook, and provider-error
  handling were removed. Previously saved local polygons that contain
  generated refinement points normalize back to their original sparse
  `controlPoints`. Polygon display now uses bounded render-only quadratic
  corner sampling, while dragging still updates only the original anchors.
  Drafting exposes `Undo last point` only when at least one point exists and
  removes exactly the most recent point. No external network request is made
  when drawing or editing a boundary.
- 2026-07-29 polygon point-limit increase: owner Full-map Print View polygon
  drafting now allows up to 200 sparse control anchors per boundary. The
  toolbar helper states the active limit, client normalization preserves 200
  anchors and truncates anything beyond that, and the server validator accepts
  200-anchor polygons while still rejecting larger control-point arrays. The
  annotation document remains bounded by the existing 100-annotation and
  2,000-total-point caps, so this does not make freehand or unlimited geometry
  valid. Render-only polygon corner smoothing remains capped to 500 display
  points, preserving editable sparse anchors and export performance.
- 2026-07-26 repeatable local UAT startup recovery: `npm run dev:server` now
  starts the local Wrangler Worker with an explicit development-only
  `NODE_ENV` override while preserving the production `wrangler.toml`. This
  restores localhost JWT fallback and non-secure `SameSite=Lax` session
  cookies without adding or changing a secret. Schema changes remain
  deliberately separate through the idempotent, database-mutating
  `npm run uat:local:prepare` command. Before sharing a local UAT link, run the
  prepare command when the feature changes the boundary schema, start both
  app surfaces, verify API and client HTTP responses, then complete one
  authenticated route check. A source-level regression test locks the local
  development override, explicit schema command, and unchanged production
  configuration. The Vite development client also unregisters stale
  localhost CareAround service workers, clears only `carearound-*` caches, and
  reloads once when a previously controlled tab needs to move back to the
  live development shell. Production PWA registration remains enabled on
  HTTPS non-localhost origins and is disabled on localhost, including local
  production previews. The configured annotation table was prepared and
  confirmed present; focused local-auth, PWA, and annotation coverage passed
  22/22; full server coverage passed 480/480; `git diff --check` passed; and
  the exact four-root production client build passed. Chrome then loaded the
  live Vite `/@vite/client` and `/src/main.jsx` entries instead of the stale
  production bundle. The final owner-route check requires the user to sign in
  again because retiring the stale localhost app state intentionally leaves a
  fresh credential form.
- 2026-07-26 local Detailed-map UAT contract recovery: authenticated Print
  View UAT exposed that the previous default `npm run dev:client` command
  omitted every `VITE_TOWN_MAP_*` variable. The stable Detailed implementation
  and production build remained intact, but local Vite compiled the feature
  out and rendered live OneMap tiles at zoom 15. The default local client
  command now includes the same native-scale Default, native-scale Gray,
  Print Master Default, and Print Master Gray roots as the production build.
  An explicit `dev:client:without-detailed-map` command retains the intentional
  fallback path. `npm run verify:map-lockdown` now owns the focused fixed
  surface, integration, map-settings, Print View, and annotation tests plus
  the exact four-root production build. A source regression test prevents
  either the local UAT roots or combined verification command from drifting.
  The new command passed 58/58 focused checks and its exact four-root build
  passed with only the established large-chunk advisory. Browser verification
  of the actual Leaflet image-overlay layer remains the final handoff check
  after the user signs in again following the required Vite restart.
- 2026-07-26 local Detailed-map CORS recovery: authenticated owner-map UAT
  then confirmed that all four build variables were present while zoom 15
  still rendered no fixed-surface image overlays. The public map asset host
  returned the manifest successfully to non-browser clients but omitted the
  CORS response header required by a localhost browser, so the source loader
  reached its unavailable fallback. Normal `npm run dev:client` now points
  the same four versioned asset families through a localhost-only,
  same-origin Vite proxy. Production builds retain the direct
  `https://maps.carearound.sg` roots and no map, API, auth, or deployment
  behavior changes. The local config test now locks both the proxy roots and
  the production four-root build separately. The proxied index, W04 manifest,
  and a W04 image chunk returned `200`; local-config coverage passed 4/4;
  map-lockdown coverage passed 58/58; and the exact four-root production build
  passed with only the established large-chunk advisory. Authenticated Chrome
  UAT then confirmed the owner interactive map at zoom 15 used 15 visible W04
  image overlays and zero live OneMap tiles. Owner Print View used 24 overlays
  and zero live tiles at zoom 15; retained all 24 after keyboard resizing;
  retained Detailed across Default and Gray; kept attribution visible; and
  returned to the owned Print View after a controlled reload without showing
  the sign-in form. Zooming the reloaded Print View from its normal zoom 14
  start to zoom 15 restored 24 Detailed overlays and zero live tiles.

## 2026-07-24 Private My Places Library V2

- Current behavior: every signed-in non-guest user has a private My Places
  library under My Directory. A personal place can be reused on multiple owned
  My Maps without duplicating the place record. Removing it from one map only
  detaches that map link; deleting it from My Places removes it from every map.
  Users can create, rename, recolour, re-icon, reorder, archive, and restore
  their own categories from the curated icon and colour controls. Category
  changes propagate to every linked owner map, category header badge, pin,
  search result, distance-sorted row, and owner Print/PDF/PNG export. Personal
  place cards keep a neutral location icon so category identity is not
  presented as a managed-resource logo.
- Known-good reference: implementation branch
  `codex/my-places-library-v2`, based on the sealed V1 commit `2f61b13cc` and
  local rollback tag `personal-places-v1-2026-07-24`. Release commit
  `e026ab92c` is on both the feature branch and `main`.
- Reproduction steps: sign in as any non-guest role; open My Directory and
  choose `My Places`; create a category with an icon and colour, then create a
  place in that category. Attach the same place to two owned maps. Confirm both
  maps show the same category styling; edit the category and confirm both maps
  update. Remove the place from one map and confirm it remains in the library
  and on the other map. Delete it from My Places and confirm it disappears from
  every map. Publish or open a shared link and confirm it is absent.
- Acceptance criteria: category, place, and map-link operations require an
  authenticated non-guest owner; a user cannot read or mutate another user's
  places, categories, or map links; map deletion removes only its links and
  preserves reusable library places; library deletion cascades all links;
  simultaneous first-load library and category requests seed each starter
  category once without surfacing a unique-constraint error;
  category header badges and personal-place map pins use the selected category
  icon and colour, while each personal-place card retains a neutral location
  icon; legacy V1 places without a category use the gray `map-pin` category
  fallback;
  legacy V1 rows are backfilled idempotently into one canonical place plus its
  original map link; shared-map snapshots, shared APIs, guests, Discover,
  managed Resources, imports, governance, and AI enrichment never receive
  personal places or personal categories.
- Verification result before deploy: focused My Maps/controller coverage passed
  22/22; focused V2 schema, presentation, source, marker, and i18n coverage
  passed 37/37; full server coverage passed 461/461; locked map coverage passed
  77/77; the DirectoryMap camera guard passed 7/7; and the exact
  production-style client build passed with native-scale Default, native-scale
  Gray, print-master Default, and print-master Gray roots. The broader client
  suite passed 469/470; its only failure is the previously recorded,
  date-sensitive Care Calendar conflict test whose fixed 2026-07-20 events are
  now expired and whose source is untouched by V2.
- 2026-07-24 first-load category race recovery: signed-in local UAT exposed
  concurrent `/personal-places` and `/personal-places/categories` requests
  racing to create the same starter categories. Starter-category insertion now
  uses the `(user_id, normalized_name)` unique index as an idempotent conflict
  boundary. A simultaneous first-load regression test passes, focused V2
  server coverage passes 26/26, and full server coverage passes 462/462. Local
  Chrome reload then returned two backfilled V1 places with existing map-use
  counts and no duplicate-key error.
- 2026-07-24 category badge and pin alignment recovery: local map 258 UAT
  confirmed the custom tree icon in the Outdoor category header and map marker,
  with neutral location icons in personal-place cards. The Personal place
  categories wizard now separates `Pin icon` and `Badge` controls and previews
  both the category badge and stable map-pin presentation. Focused client and
  server coverage passed 74/74, locked map coverage passed 77/77, full server
  coverage passed 463/463, and the exact four-root production-style client
  build passed. Chrome DOM evidence confirmed visible `#15803D` tree and
  `#64748b` map-pin strokes in the two personal-place map markers.
- 2026-07-24 custom category icon and short-description follow-up: personal
  categories can now use an uploaded PNG, JPEG, or WebP icon of up to 2 MB in
  addition to the curated icon set. The upload reuses the stable image-upload
  control but has a dedicated authenticated non-guest endpoint and user-scoped
  Cloudinary folder; the existing managed-resource upload route remains
  operator-only. Personal-place `Private note` UI is replaced by a 240-character
  `Short description`, with legacy note text backfilled as the initial
  description. Personal-place cards no longer repeat the place name inside the
  card and show the short description in that space instead. Every saved hard
  or soft resource on an owner My Map also has an optional 240-character
  per-map short description. This metadata appears in owner cards, owner map
  search, and owner Print/PDF/PNG output without changing the source resource
  or Map Notes; it is excluded from shared-map snapshots and shared responses.
  The primary managed-resource row, which is normally suppressed when it
  repeats the card heading, now renders its description and owner edit action
  directly under that heading in interactive, focus-tray, and print layouts.
  Focused personal-place, directory, marker, and i18n coverage passed 100/100;
  full server coverage passed 466/466; locked map coverage passed 77/77; and
  the exact four-root production-style client build passed with the existing
  large chunk warning.
- 2026-07-27 Print View short-description editing placement: ordinary owner
  My Map cards now display saved per-map short descriptions without persistent
  add or edit prompts. The owner Print View toolbar owns a one-shot
  `Add short description` mode that reveals add actions for missing
  descriptions and edit actions for saved descriptions on the visible print
  resource layer. Saving or cancelling closes the editor and exits that mode,
  so its prompts remain hidden until the toolbar trigger is used again.
  Hidden PNG/PDF capture renderers, shared maps, and shared payloads never
  receive the editing callback or controls; saved text continues to follow the
  selected print label-detail setting. Rollback is limited to the transient
  Print View state and callback wiring; the existing descriptor API, storage,
  modal, owner export content, and personal-place privacy boundary are
  unchanged. Focused personal-place and Print View source coverage passed
  27/27; locked map/print coverage passed 60/60; and the exact four-root
  production-style client build passed with only the existing large chunk
  warning. Authenticated Chrome UAT on map 258 confirmed zero prompts before
  activation, 20 visible managed-resource actions after activation, zero
  hidden-export actions, and zero prompts with the trigger reset after Cancel.
  Ordinary My Map retained its saved personal-place description with no managed
  `Add short description` prompts. Print View at zoom 15 retained 24 Detailed
  fixed-surface overlays and zero live tile images.
- 2026-07-24 signed-in Chrome UAT: map 258 showed the `centre extension`
  personal place name once, its `Onboarding in 2027` short description, and no
  `Private note` field. Its editor exposed `Short description`. All 20 saved
  managed hard resources exposed an `Add short description` owner action, and
  the first resource opened the expected 240-character editor without a save.
  The personal category wizard remained usable and scrollable with curated and
  custom upload controls. The attempted local image transfer was correctly
  rejected because local Wrangler has no Cloudinary secret; the production
  Worker secret list confirms `CLOUDINARY_URL` is configured, but deployed
  upload transport remains an explicit release-preview UAT gate. Missing local
  upload configuration now returns a friendly 503
  `Custom icon upload is unavailable in this environment` response while
  retaining the diagnostic detail in server logs.
- 2026-07-24 owner print composition refinement: `Names + descriptions` is a
  distinct label-detail choice that shows saved personal-place and per-map
  resource descriptions without addresses or logos. `Names only` now excludes
  those descriptions. Full map keeps its map-only first page and adds a
  Full-map-only `Card columns` setting for 2, 3, or 4 ordered resource columns,
  defaulting to 2. Every numbered badge on that resources-below page is
  left-aligned; the locked Balanced and Side map layouts retain their
  map-facing badge positions and do not expose the column setting. Signed-in
  Chrome UAT on map 258 confirmed 22/22 Full-map resource badges at `start`,
  two columns split 11/11, three split 8/7/7, and four split 6/5/6/5 with no
  horizontal or text overflow. `Names + descriptions` showed `Onboarding in
  2027` without its address or logo, while `Names only` showed neither the
  description nor address. Focused print, directory, personal-place, and i18n
  coverage passed 60/60; locked map/print coverage passed 79/79; and the exact
  four-root production-style client build passed with only the existing large
  chunk warning.
- 2026-07-24 category-aware Full-map columns: the 2/3/4-column resource-page
  partitioner now treats a contiguous category run as a preferred block. It
  keeps ordinary categories within one column when the resulting page remains
  balanced, while a category that is materially taller than a normal column
  may flow into the next column and repeat its header. Signed-in Chrome UAT on
  map 258 at four columns confirmed all six `PA Resident Network (RN)` cards in
  one column and both `Senior Citizen Fitness Corner` cards in one column on
  both the visible and hidden export surfaces. The resulting `6/6/4/6`
  distribution retained 22/22 left-aligned number badges. A synthetic
  oversized-category regression case confirmed that a 12-card category can
  still span columns. Focused print, directory, personal-place, and i18n
  coverage passed 61/61; locked map/print coverage passed 80/80; and the exact
  four-root production-style client build passed with only the existing large
  chunk warning.
- 2026-07-24 production release: the additive boundary-schema bootstrap
  completed before runtime deployment. It retained 2 legacy place rows,
  backfilled 2 reusable library places and 2 map links, and reported 0
  unbackfilled legacy places and 0 duplicate category names. `main` and
  `codex/my-places-library-v2` were pushed at `e026ab92c`. Worker version
  `a9ae70c5-19d8-4448-b7a7-73bd9ad24714` and Pages deployment
  `https://cc8cf910.senior-resource-map.pages.dev` were released. The custom
  domain served `assets/index-CEvzEMXS.js`,
  `assets/MyMapDetailPage-DZa1Qv6Q.js`,
  `assets/MyDirectoryPage-B1f6qxXS.js`,
  `assets/personalPlaceCategories-DJJVQ68J.js`,
  `assets/MapImageExportButton-CXUQwO3R.js`, and
  `assets/index-Dp7WHDGt.css`; each checked asset matched local `client/dist`
  byte-for-byte. API health returned OK and production smoke passed 6/6.
  Signed-in production UAT showed 2 reusable places and 8 categories in My
  Places, both private places plus short-description actions on owner map 258,
  and the Full-map screen/export resource pages at `6/6/4/6` with 22/22
  left-aligned badges. PA Resident Network and Senior Citizen Fitness Corner
  each appeared in one column, and the saved description remained visible.
  All 3 existing shared snapshots contained 0 personal-place rows and 0
  personal-place arrays. `CLOUDINARY_URL` remains configured as a Worker
  secret; no category-icon upload or other user-content mutation was performed
  during release verification. Full server coverage passed 466/466 and broad
  client coverage passed 473/474; the sole failure is the previously recorded
  expired Care Calendar fixture on source untouched by this release.
- 2026-07-24 personal-place action feedback, current location, and media
  follow-up: add, attach, edit, remove, and library-delete actions now expose a
  disabled pending state or an accessible live status while both the mutation
  and subsequent map refresh complete, followed by a short success message.
  My Map distance controls include the existing current-location interaction;
  it uses browser geolocation only for the current page session, never replaces
  the saved home/postal anchor, and clears through the existing distance-anchor
  control. Reusable personal places can store one optional uploaded PNG, JPEG,
  or WebP logo/image of up to 5 MB through a dedicated authenticated non-guest
  endpoint and user-scoped Cloudinary folder. The image occupies the normal
  resource-logo slot in owner library, chooser, map-card, and owner-export
  presentation; the category icon and colour continue to own category badges
  and map pins. Personal places and their image URLs remain absent from shared
  snapshots, shared APIs, Discover, managed Resources, imports, governance, and
  guest views. This follow-up requires the additive `logo_url` boundary-schema
  bootstrap before runtime deployment. Focused feedback, geolocation, image,
  owner-directory, and shared-exclusion coverage passed 56/56; full server
  coverage passed 466/466; focused locked owner-map coverage passed 64/64; and
  both the normal and exact four-root production-style client builds passed
  with only the existing large chunk warning. Broad client coverage passed
  465/466; the sole failure is the already recorded expired Care Calendar
  conflict fixture on source untouched by this follow-up.
- 2026-07-24 personal-place follow-up production release: the additive
  boundary-schema bootstrap completed before runtime deployment, and a direct
  `information_schema` probe confirmed `user_personal_places.logo_url` exists.
  `main` and `codex/personal-place-action-feedback` were pushed at
  `433c73092`. Worker version `142fd452-7f38-4c9a-a241-484f37bb909e` and Pages
  deployment `https://aad51e87.senior-resource-map.pages.dev` were released.
  The custom domain served `assets/index-DB5oQ5vl.js`,
  `assets/MyMapDetailPage-BkfNrm0C.js`,
  `assets/MyDirectoryPage-C_47b6-E.js`,
  `assets/ImageUpload-CCjzNfoA.js`,
  `assets/useDirectoryDistanceAnchor-C79bQ6_r.js`, and
  `assets/index-Cn-lymxK.css`; each checked asset matched local `client/dist`
  byte-for-byte. The deployed bundles retained all four versioned Detailed-map
  roots, the regular-map fallback, and `Save PDF`, while both retired map
  strings remained absent. API health returned OK, and the new image-upload
  endpoint returned the expected authentication rejection without a token.
  Signed-in read-only Chrome UAT on map 258 showed 22 owner resources, the
  `Use my current location` control, and `Logo or image` with PNG/JPEG/WebP
  5 MB guidance in the existing personal-place editor. My Places returned the
  two reusable records. No geolocation permission, upload, save, attach,
  remove, delete, or other user-content mutation was performed during release
  verification.
- 2026-07-24 personal-place feedback surface placement: pending and completion
  feedback for add, attach, edit, remove, and library-refresh operations now
  renders inside the owner `DirectoryMap` frame instead of at the bottom edge
  of the browser viewport. The map-owned overlay stays above map content,
  leaves the right-side map controls clear, and follows the existing desktop,
  mobile, empty-map, and V2 map surfaces without changing mutation timing,
  Leaflet state, resource cards, shared maps, or print/export output. Focused
  personal-place, V2 scaffold, map-presentation, and fixed-surface coverage
  passed 29/29; the locked owner-map gate passed 52/52; the exact four-root
  production-style client build passed with only the existing large chunk
  warning; and `git diff --check` passed. Source coverage explicitly rejects
  the former fixed bottom placement.
- 2026-07-24 current-location personal-place placement: while an owner is in
  `Add personal place` map-placement mode, clicking or tapping the visible
  current-location target now opens the existing personal-place editor at that
  target's exact latitude and longitude. Its visual shell is reduced from
  34 px to 26 px while retaining the existing 40 px interaction area. Outside
  placement mode the target remains a session-only distance anchor, and Home
  and temporary postal anchors retain their existing sizes and remain
  non-placeable. This does not change geolocation permission handling, saved
  home/postal data, map camera behavior, shared maps, print/export, APIs,
  schema, or personal-place visibility. Reproduce by
  enabling current location on an owned My Map, choosing `Add personal place`,
  starting map placement, and selecting the current-location marker. The
  editor must open at the marker coordinates; cancelling must leave the
  location anchor unchanged. Focused personal-place, marker, and camera
  coverage passed 27/27; broader owner/shared-map coverage passed 54/54; the
  locked owner-map gate passed 52/52; full server coverage passed 466/466; the
  exact four-root production-style client build passed with only the existing
  large chunk warning; and `git diff --check` passed.
- 2026-07-24 current-location placement production release: implementation
  commit `3fd28f1d9` was pushed to
  `codex/current-location-personal-place` and `main`. Cloudflare Pages
  production deployment `https://f604b534.senior-resource-map.pages.dev`
  published the validated client; no Worker, schema, database, auth, or secret
  deployment was performed. The custom domain served
  `assets/index-ysBoUPpW.js` and
  `assets/useDirectoryDistanceAnchor-K5J5dSxX.js`; both matched local
  `client/dist` byte-for-byte with SHA-256
  `3ddb680cc6908f1ffcd2f2c7783fd9f48e841e3cbcff9dbe8a716e9c93a0c2b2`
  and
  `f7c7e76787c2f2d0d9463f51c7e44a067a1791f189bedda72a2674662928ebd8`.
  The deployed bundles retained all four locked Detailed/Print Master roots,
  the current-location copy, and the 26 px visual shell marker. API health
  returned OK. Production smoke initially passed 4/6 while one run crossed
  the Pages bundle transition and the external postal search remained pending;
  a clean focused rerun passed both affected flows 2/2, completing all six
  production checks successfully.
- Release and rollback: before any deploy, run the additive boundary-schema
  bootstrap against the intended database, verify row/category/link counts,
  then complete signed-in owner and shared-link UAT. Roll back application code
  to tag `personal-places-v1-2026-07-24` or commit `2f61b13cc`; keep the
  additive V2 tables during rollback so no library data is discarded.

## 2026-07-23 Personal Places on My Map V1

- Current behavior: signed-in non-guest map owners can add, edit, and remove
  private personal places directly from the owner My Map surface. The owner
  enters add mode, clicks or taps the map, optionally uses OneMap lookup, and
  saves a compact local place record with name, category label, address,
  postal code, coordinates, and a private note. Personal places render as
  `personal_place` rows, cards, pins, search results, distance-sorted entries,
  and owner Print/PDF/PNG export content.
- Known-good reference: commit `2f61b13cc` on local branch
  `codex/personal-places-my-map-v1`, tagged
  `personal-places-v1-2026-07-24`. No deployment has happened for this
  implementation.
- Reproduction steps: sign in as a standard, caregiver, partner, or admin
  non-guest user; open an owned My Map; choose `Add personal place`; click or
  tap the map; fill or OneMap-lookup the form; save; confirm the new row
  appears in owner cards, pins, search, map focus, distance sorting, and owner
  print/export previews. Edit and remove the row. Publish or open a shared map
  link and confirm the personal place is absent.
- Acceptance criteria: guests and non-owners cannot create, update, delete, or
  fetch personal places through someone else's map; personal places are scoped
  to a single map and cascade with map deletion; the managed-resource
  `hard`/`soft` asset APIs, Discover, dashboard Resources, imports, AI
  enrichment, governance, shared-map snapshots, and guest views never receive
  `personal_place` rows; user-facing copy says `personal place`, not `asset`.
- Verification result: focused server My Maps/schema coverage passed 31/31;
  focused client presentation/source/i18n coverage passed 19/19; full server
  coverage passed 455/455; map lockdown coverage passed 77/77; the exact
  production-style `npm run build:client` passed with native-scale Default,
  native-scale Gray, print-master Default, and print-master Gray asset roots.
  `git diff --check` passed.
- Rollback: return to the pre-V1 base `5374844820ccd020ba3a8bfcdbb375894bbccae6`
  to remove the `my_map_personal_places` table bootstrap, API routes, owner UI,
  and directory merge. Existing deployed maps and shared snapshots are
  unaffected until V1 or V2 is deployed.

## 2026-07-23 map work stable baseline lock

- Current behavior: the July 2026 owner map work is locked at commit
  `97118d4919cda77f1be581b0489eaf327e2ef098`, tagged locally as
  `map-stable-2026-07-23`. Owner My Map and owner Print View retain the
  existing Leaflet interaction model while supporting versioned native-scale
  Detailed map surfaces, Default/Gray appearance, automatic Detailed at
  displayed zoom step 15, resize-safe Print View containment, readable numbered
  resource badges, and the simplified `Save PNG` / `Save PDF` print downloads.
- Known-good reference: production Pages deployment
  `https://8299e8cf.senior-resource-map.pages.dev` and custom domain
  `https://app.carearound.sg` serving `assets/index-BbMHCdJ9.js`,
  `assets/MyMapDetailPage-D1SJlYMS.js`,
  `assets/MapImageExportButton-CHH0QFSF.js`, and
  `assets/index-CRSe8Nl6.css`, all byte-matched to the validated local build.
  Stable manifest: `docs/stable-baselines/map-work-2026-07-23.md`.
- Reproduction steps: sign in as a map owner; open owner maps 25, 87, 150, and
  258 where practical; open `?view=print`; zoom to steps 14, 15, and 16; expand
  the print map height; open Map appearance; switch Default/Gray; confirm
  Detailed is automatic or selectable at step 15 when the current viewport is
  covered, but not at step 14; save PNG and PDF output; inspect QR,
  attribution, resource badges, and card/list focus.
- Acceptance criteria: Detailed activates at displayed step 15 when covered;
  map expansion does not force a fallback at step 15; fallback copy says the
  regular map is still shown, never `Standard map is still on`; `Save PDF`
  appears and `Save A3 PDF` does not; no Print Master user action appears;
  live OneMap basemap-tile requests stop while Detailed is active; pins remain
  aligned; clustering, camera, card focus, reset, mobile controls, QR, notes,
  Shared Maps, Discover, API, auth, permissions, data, ranking, filtering, and
  visibility remain unchanged.
- Verification result: focused fixed-surface, map-settings, and Print View
  coverage passed 49/49; server coverage passed 451/451; exact
  production-configured `npm run build:client` passed with all four Detailed
  asset roots; `git diff --check` passed; deployed bundles contained the v2
  native-scale roots, retained Print Master roots, `resize moveend zoomend`,
  `The regular map is still shown.`, and `Save PDF`, while old `Standard map is
  still on` and `Save A3 PDF` markers were absent. API health returned OK at
  `2026-07-23T10:20:23.608Z`.
- Future-work gate: before any future map or print deploy, run
  `node --test client/test/fixedTownSurface.test.js client/test/fixedTownSurfaceIntegration.test.js client/test/mapSettingsControl.test.js client/test/printMapWorkspace.test.js`,
  run the exact four-root production client build, and verify the custom-domain
  bundle hash and markers after Pages deployment. A Git-triggered Pages build
  alone is not sufficient evidence.
- Rollback: return to tag `map-stable-2026-07-23` / commit `97118d491` for the
  current stable map baseline. Any rollback or asset-root downgrade must be
  recorded here before deployment.

## 2026-07-23 owner Print View zoom-15 Detailed recovery

- Current behavior: owner Print View keeps the Detailed fixed-surface map
  eligible at the displayed zoom step 15 after map-height changes, zooming, or
  panning settle, as long as the camera centre remains inside the selected
  fixed surface. If the enlarged print frame needs a tiny adjustment, the
  print-only containment helper nudges the camera/underlying fractional zoom
  without changing the layman-facing step. Genuine outside-surface pans still
  fall back safely to the regular map.
- Known-good reference: source branch `codex/print-detailed-zoom15-recovery`,
  based on production `origin/main` at `7a50145d1`.
- Reproduction steps: sign in as a map owner; open an owner map with
  `?view=print`; expand the map height or choose a large/full map layout; zoom
  to displayed step 15; open Map appearance; confirm Detailed is available and
  either active automatically or selectable. Pan the camera centre outside the
  active detailed surface and confirm the regular-map fallback remains quiet.
- Acceptance criteria: Detailed activates automatically at displayed step 15
  when the map centre is inside the detailed surface; the fallback message no
  longer refers to `Standard map`; zoom 14 remains regular-map only; zoom 16
  remains Detailed; pins, QR, print exports, mobile controls, map colour,
  resource labels, Shared Maps, Discover, API, data, auth, permissions,
  ranking, filtering, and visibility remain unchanged.
- Verification result: focused fixed-surface, map-settings, and Print View
  coverage passed 49/49; server coverage passed 451/451; the exact
  production-configured client build passed with all four Detailed asset roots
  and only the existing large-chunk advisory; and `git diff --check` passed.
- Blast radius and rollback: one owner Print View/DirectoryMap fixed-surface
  containment listener and user-facing fallback copy. Reverting this row's
  source changes restores the prior resize-only containment and old message
  copy without changing map assets, data, or export formats.

## 2026-07-23 owner Print View PDF label refinement

- Current behavior: owner Print View shows the PDF export action as `Save PDF`
  in every supported locale. The exported file remains the existing A3 PDF
  composition; PNG labels, layout settings, map detail, colour, camera, pins,
  QR, attribution, and resource pages remain unchanged.
- Known-good reference: source commit `03caab768` on branch
  `codex/print-save-pdf-label`, based on production `origin/main` at
  `b294ea145668f97ad3279a6a0a153f74bdac3dde`.
- Reproduction steps: sign in as a map owner; open an owner map with
  `?view=print`; inspect the export toolbar on desktop and mobile; confirm the
  PDF export action reads `Save PDF`; save the PDF and confirm the existing PDF
  output path still works.
- Acceptance criteria: only the PDF action label changes; the PDF export still
  uses the established A3 output; no Print View layout, detailed-map, resource
  list, My Map, Shared Map, Discover, API, data, auth, permission, or saved
  resource behavior changes.
- Verification result: focused Print View and My Map action-label source
  coverage passed 20/20, including all-locale `Save PDF` coverage. The exact
  four-root production client build passed, and `git diff --check` passed.
- Blast radius and rollback: locale copy and source-contract coverage only.
  Revert `03caab768` to restore the previous `Save A3 PDF` label without
  changing export behavior or stored data.

## 2026-07-23 owner Print View mobile map-control density refinement

- Current behavior: the unscaled owner Print View control dock at phone and
  tablet widths uses 44px Map settings and zoom buttons, a matching 44px zoom
  readout, 15px bold zoom text, and 8px gaps. This keeps the controls usable
  while returning a little more space to the print preview.
- Known-good reference: pre-release implementation on branch
  `codex/print-detailed-resize-coverage`, based on production `origin/main` at
  `f68930205762826f6c594efcd248119847931529`, in isolated worktree
  `/Users/sweetbuns/CareAroundSG-print-detailed-resize-coverage`.
- Reproduction steps: sign in as a map owner; open `?view=print` at phone and
  tablet widths; confirm the external dock remains easy to tap without
  dominating the preview; use Map settings, zoom out, and zoom in; confirm the
  zoom readout updates. Repeat at desktop width and inspect a saved PNG/PDF.
- Acceptance criteria: every interactive mobile dock control remains at least
  44px square with an 8px gap and visible focus state; the zoom readout matches
  that footprint and remains legible; the existing settings sheet, Leaflet
  camera, Standard/Detailed state, and Default/Gray state remain shared; the
  dock is absent from desktop and saved exports; no map, asset, API, data,
  auth, permission, ranking, filtering, or visibility behavior changes.
- Verification result: focused map-settings, Print View, and fixed-surface
  contracts passed 25/25; server coverage passed 451/451; the exact
  production-configured client build passed with both native-scale styles and
  both print-master roots, with only the existing large-chunk advisory; and
  `git diff --check` passed. Release commit `79faeee09` was pushed to the
  isolated branch and `main`, then explicitly published to Cloudflare Pages
  production at `https://0d0ac80e.senior-resource-map.pages.dev`. The custom
  domain serves entry bundle `assets/index-CNANQ2eY.js` with SHA-256
  `2b3fe604d1831b0e41168bb5158745a8e017b6ab7620f0fb8a44fc7e126866eb`
  and map bundle `assets/MyMapDetailPage-OwbcAZGz.js` with SHA-256
  `a4ad3421d7f41ab801fd415b02d59dc01a0d924e6bfaf1200afc8f1594c3ca8b`,
  exactly matching the validated local build. The deployed lazy map chunk
  contains the external Print map control markers and compact dock footprint.
  Production root, Discover, and owner Print View returned HTTP 200, and API
  health returned OK at `2026-07-23T08:23:31.942Z`. Authenticated device UAT
  remains pending.
- Blast radius and rollback: one print-only mobile dock, one isolated
  `compactTouch` settings-trigger variant, one caller, and focused regression
  contracts. Reverting these density classes restores the prior 48px dock
  without changing map or export state.

## 2026-07-23 owner Print View expanded Detailed-map containment

- Current behavior: when an owner expands the Print View map vertically while
  Detailed is active at displayed zoom step 15, the print-only camera is kept
  just inside the active fixed-surface bounds. If the resized frame needs extra
  room, Leaflet may use a fractional zoom such as 15.1 while the layman-facing
  step remains 15. A genuine pan whose camera centre leaves the active surface
  still follows the established quiet Standard-map fallback.
- Known-good reference: pre-release implementation on branch
  `codex/print-detailed-resize-coverage`, based on production `origin/main` at
  `f68930205762826f6c594efcd248119847931529`, in isolated worktree
  `/Users/sweetbuns/CareAroundSG-print-detailed-resize-coverage`.
- Reproduction steps: sign in as a map owner; open `?view=print`; select Full
  map and expand the map to its maximum height; pan within the selected
  Detailed surface near its northern or southern edge; set the displayed zoom
  step to 15; open Map appearance and confirm Detailed remains available and
  selected. Pan the camera centre outside the surface and confirm Standard
  fallback still occurs.
- Acceptance criteria: the maximum-height Print View keeps Detailed at the
  displayed step 15 whenever the camera centre remains inside the selected
  fixed surface; the camera moves only the minimum distance needed; the
  fractional correction does not change the displayed integer step; fixed
  chunks, pins, print state, exports, mobile controls, and attribution remain
  unchanged; outside-surface fallback remains fail-safe; interactive My Map,
  Shared Maps, Discover, API, data, auth, permissions, ranking, filtering, and
  visibility remain unchanged.
- Verification result: focused fixed-surface and Print View coverage passed
  44/44; a headless Leaflet resize harness reproduced an out-of-bounds
  maximum-height viewport and confirmed the correction restored strict W01
  containment while retaining displayed step 15; server coverage passed
  451/451; the exact production-configured client build passed with both
  native-scale styles and both print-master roots, with only the existing
  large-chunk advisory; and `git diff --check` passed. Release commit
  `79faeee09` was pushed to the isolated branch and `main`, then explicitly
  published to Cloudflare Pages production at
  `https://0d0ac80e.senior-resource-map.pages.dev`. The custom-domain entry and
  map bundle hashes exactly matched the validated local build; both
  native-scale styles and both print-master roots were present; production
  root, Discover, and owner Print View returned HTTP 200; and API health
  returned OK at `2026-07-23T08:23:31.942Z`. Authenticated maximum-height
  device UAT remains pending.
- Blast radius and rollback: one optional `DirectoryMap` resize-containment
  prop enabled only by owner Print View, one internal Leaflet camera sync, and
  focused regression contracts. Removing that prop and sync restores the prior
  fallback behavior without changing any map assets or shared map callers.

## 2026-07-23 owner Print View mobile map-control dock

- Current behavior: owner Print View at phone and tablet widths presents one
  unscaled control dock above the print preview. The dock uses 48px touch
  targets for Map settings, zoom out, and zoom in, with an independent 48px
  zoom-level readout using a 16px bold number. It controls the existing Leaflet
  map and opens the existing Map appearance sheet, so Standard/Detailed,
  Default/Gray, camera, and export state remain shared with the preview. The
  smaller duplicate controls inside the scaled preview are hidden only while
  this owner-screen dock is active.
- Known-good reference: implementation commit
  `c07f7ce2e` on branch `codex/print-mobile-control-dock`, based on production
  `db5569db18f694c967efc8f749bdfe1d704f70e7`, in isolated worktree
  `/Users/sweetbuns/CareAroundSG-print-mobile-control-dock`.
- Reproduction steps: sign in as a map owner; open an owner map with
  `?view=print` at a phone or tablet width; confirm the dock is not scaled with
  the print sheet; use both zoom buttons and observe the zoom number; open Map
  settings and switch Standard/Detailed and Default/Gray. Repeat at desktop
  width, in Shared Map print, and in saved PNG/PDF output.
- Acceptance criteria: mobile controls meet the 48px touch-target size with an
  8px gap and visible focus state; the zoom number remains at least 16px and
  updates with Leaflet; boundary zoom buttons disable correctly; no scaled
  duplicate zoom/settings controls remain in owner mobile screen preview; the
  existing settings sheet and map state are reused; desktop, Shared Maps,
  Discover, interactive My Map, and saved exports remain unchanged; no API,
  data, auth, schema, permission, ranking, filtering, or visibility changes.
- Verification result: focused map-settings, Print View, and My
  Map contracts passed 34/34; full client/source coverage passed 452/453 with
  the sole Care Calendar planning-overlap assertion reproduced on unchanged
  `main`; server coverage passed 451/451; the exact four-root production client
  build passed with the existing chunk-size warning; and `git diff --check`
  passed. A fresh unauthenticated browser reached Login as expected, so
  authenticated interaction remains the final production UAT check. Release
  commit `6ae886c87` was fast-forwarded to `main` and explicitly published to
  Cloudflare Pages at
  `https://5b2e4226.senior-resource-map.pages.dev`. The custom domain served
  `assets/index-B9AUus9g.js` with SHA-256
  `c7c3e115621831bafbdd7734635c65f65ace453630ca15717a24ec064d27419d`
  and `assets/useDirectoryDistanceAnchor-BGOm97VB.js` with SHA-256
  `46696b926c5e27605670aa0f288031d94a03e03827fc69a1f0d7e6adfc2072b0`,
  exactly matching the local production build. The deployed map chunk contains
  the `Print map controls` and `data-print-mobile-map-controls` markers.
  Production root, `/discover`, and owner Print View routes returned HTTP 200,
  and API health returned OK at `2026-07-23T07:40:02.195Z`.
- Blast radius and rollback: one optional `DirectoryMap` portal target, an
  isolated mobile dock, a touch-size variant for the existing settings trigger,
  owner Print View screen-preview placement, and a scoped mobile CSS rule only.
  Revert `c07f7ce2e` to restore the scaled controls without changing any map
  data, export contents, or established map behavior.

## 2026-07-23 owner Print View simplification production release

- Current behavior: owner Print View presents one compact layout choice with
  `Balanced`, `Side map`, and `Full map`. Balanced and Side retain their
  established compositions; Full gives the map its own page and places
  resources on the next page. Map position appears only for Side, while map
  width appears only for Balanced and Side. The user-facing image-quality,
  page-format, resource-placement, and Print Master controls are removed. The
  supported image downloads are labelled `Save PNG`, or `Save Map PNG` and
  `Save Resource PNG` in Full map, plus `Save PDF`. The PDF continues to use
  the existing A3 output format. Existing map colour, Standard/Detailed,
  camera, zoom, height, pins, label detail, QR, and attribution behavior remain
  available.
- Known-good reference: commit
  `95daffb7cb29493c8ac698f5da64070595d6915b`, developed on branch
  `codex/print-view-simplification` in isolated worktree
  `/Users/sweetbuns/CareAroundSG-print-view-simplification`, fast-forwarded to
  `main`, pushed, and explicitly published to Cloudflare Pages.
- Reproduction steps: sign in as a map owner; open an owner map with
  `?view=print`; open Print layout on desktop and a phone-width viewport; switch
  among Balanced, Side map, and Full map; confirm map position and width appear
  only where relevant; toggle pins and label detail; save PNG output and the A3
  PDF; inspect the files, Detailed/colour controls, QR, attribution, and mobile
  toolbar wrapping.
- Acceptance criteria: the settings panel has no horizontal overflow and keeps
  44px touch targets; phone toolbar actions form a usable two-column grid;
  Balanced and Side keep resources beside the map; Full produces separate map
  and resource pages; PNG wording names the actual file type; A3 PDF retains
  the established higher internal capture path; the failing Print Master action
  and redundant quality/page-format controls are absent; no API, data, auth,
  permission, Shared Map, Discover, or interactive My Map behavior changes.
- Verification result: focused Print View, locale, PDF, and retained Print
  Master library coverage passed 28/28. Full client/source coverage passed 461/462;
  the sole Care Calendar planning-overlap assertion is the documented unrelated
  baseline failure. The server baseline passed 451/451. The exact four-root
  production client build passed after a clean dependency install. Mobile
  source contracts cover two-column toolbar wrapping, 44px targets, touch
  manipulation, compact three-mode controls, and overflow containment. The
  local UAT route and its proxied API health endpoint both returned HTTP 200.
  The validated Pages deployment is
  `https://86a6f8e0.senior-resource-map.pages.dev`; the custom domain served
  `assets/index-BnfI7_CR.js` with SHA-256
  `a35a26b13513b90ddbd79a54cfdcc6ebac66c2280c2fe5da20538ffaa371e23b`,
  exactly matching the local production build. Production bundle inspection
  confirmed the four versioned native-scale and retained Print Master asset
  roots, the new PNG/A3/layout labels, and no Print Master action. `/discover`
  and the owner Print View route returned HTTP 200, and API health returned OK
  at `2026-07-23T07:02:59.164Z`. Authenticated production interaction UAT was
  not automated because smoke credentials were unavailable in the release
  shell; the user-facing owner flow remains the final production UAT check.
- Blast radius and rollback: owner Print View state normalization, controls,
  export-action UI, toolbar responsiveness, locale copy, and regression
  contracts only. Print Master source modules and immutable asset roots remain
  untouched for possible future restoration. Revert this candidate to restore
  the previous controls and Print Master action.

## 2026-07-23 owner My Map action-label refinement

- Current behavior: the owner My Map action bar and mobile controls label the
  print workspace as `Print View`. The existing notes-ledger PDF action is
  labelled `Download Map Notes`, while its export content, loading state, error
  handling, and filename behavior remain unchanged.
- Known-good reference: source commit `bccf6d910` on isolated branch
  `codex/my-map-action-labels`, based on production `origin/main` at
  `88bac7328260c1a9acfbd6cc24b4d029ce7cab31`.
- Reproduction steps: sign in as a map owner; open an owner My Map on desktop
  and confirm the header actions; repeat on mobile and open the map controls;
  select `Download Map Notes` and inspect the generated notes-ledger PDF.
- Acceptance criteria: desktop and mobile use `Print View`; the notes PDF action
  uses `Download Map Notes` in every supported locale; the export remains an
  unfiltered notes ledger; Print View, Shared Maps, maps, notes, API, data,
  permissions, and all other owner interactions remain unchanged.
- Verification result: focused My Map PDF and ledger tests passed 15/15; full
  client/source coverage passed 451/452 with the sole existing Care Calendar
  planning-overlap failure documented on the unchanged production baseline;
  server coverage passed 451/451; the exact four-root production client build
  passed; and `git diff --check` passed.
- Blast radius and rollback: copy and locale dictionaries only, plus source
  contract coverage. Revert this refinement commit to restore the previous
  labels without changing any stored data or export behavior.

## 2026-07-23 Full Map Print Master v2 production release

- Current behavior: owner Print View retains its stable default composition and
  can opt into a Full map page with resources on a separate page. Users can
  save separate map/resource PNGs, a two-page A3 PDF, or (at Detailed zoom 15+
  with a matching print surface) a higher-detail Print Master PDF. The preview
  supports Default/Gray, Standard/Detailed, High resolution, numbered pins or a
  plain map, map resizing, and four label-detail levels. Print View selects
  Detailed automatically at zoom 15 when coverage is ready. Missing, invalid,
  or failed Print Master assets disable only the Print Master action; A3 and
  existing exports remain available.
- Known-good reference: source commits `2aab61303` and `2e64276e4` on isolated
  branch `codex/print-master-v2-integration`, based on production baseline
  `6814dad8785f0981fce01e748cb88a37150ee91d`; release commit `e4d52dd03` on
  `main`; validated Pages production deployment
  `https://9bf1306f.senior-resource-map.pages.dev`; Default Print Master root
  `https://maps.carearound.sg/v2/print-master-100-20260723/default` version
  `print-master-100-8523e7775f2589f3`; and Gray root
  `https://maps.carearound.sg/v2/print-master-100-20260723/gray` version
  `print-master-100-e46bde6437b66451`.
- Reproduction steps: build the client with the API URL, proof flag, both
  native-scale interactive roots, and both Print Master roots in
  `docs/release-checklist.md`; open an owner map with `?view=print`; set Full map
  page, Next page, High resolution, and Show pins; zoom to 15; select
  Detailed and Default/Gray; pan or resize as needed; save the two images, A3
  PDF, and Print Master PDF; repeat with Plain map; inspect the preview,
  downloaded pages, browser console, failed requests, attribution, and QR.
- Acceptance criteria: the stable standard print layout remains unchanged by
  default; map and resource pages are separate when selected; every export
  matches the chosen color, camera, pins, label detail, and page arrangement;
  QR and attribution remain visible; Detailed activates at zoom 15; hard 4xx
  asset errors fail safely without retry storms; transient chunk failures retry
  with bounded backoff; the compositor releases decoded chunks as it advances
  and refuses work above its 384 MiB estimate; both styles contain 32 surfaces
  and 2,741 chunks with validated identities; no live OneMap basemap tiles are
  used for Detailed; existing owner-map, mobile, Discover, Shared Maps, API,
  data, permissions, and saved-resource behavior remain unchanged.
- Verification result: strict packaging and focused coverage passed 67/67,
  town-map scripts 8/8, broader map/print coverage 215/215, server coverage
  451/451, retry-focused coverage 6/6, the exact four-root production build,
  and `git diff --check`. Full client/source coverage passed 449/450; the sole
  Care Calendar planning-overlap assertion also fails on the released baseline
  and is unrelated. Remote sampling verified 96 chunks per style plus CORS and
  range delivery; all 88 W01 Gray chunks also passed full-object GETs. The real
  browser compositor completed all 88 W01 chunks for Default and Gray into
  2,400 x 1,600 canvases with no visible gaps or seams; Gray took about 24.6
  seconds. Authenticated production UAT confirmed automatic Detailed, Gray,
  Full map + next-page resources, High resolution, pin hide/show, QR, and a
  complete 7,660,133-byte two-page A3 landscape PDF. The production
  custom-domain entry and lazy chunks match local `client/dist` byte for byte.
  A later dynamic-import failure was isolated to a long-running high-memory
  Chrome process because it affected an extension module too and direct module
  navigation returned valid JavaScript; no broad client workaround was added.
  After explicit Pages publication, public Discover returned 200, API health
  returned OK, all four collection manifests returned 200 with 32 surfaces,
  and the public Playwright smoke passed. Its five authenticated cases stopped
  before application assertions because the release shell had no smoke
  credentials; earlier signed-in production UAT supplies the authenticated
  evidence without introducing a production mutation.
- Blast radius and rollback: this is owner Print View and optional export
  tooling plus two external asset roots. It does not alter Leaflet, Standard
  defaults, My Map interactions, Discover, Shared Maps, Worker/API, schema,
  auth, permissions, ranking, visibility, or saved resources. Rebuilding
  without the two Print Master roots hides only the Print Master action; the
  previously released native-scale v2 client and immutable R2 roots remain the
  immediate rollback boundary.

## 2026-07-23 native-scale islandwide Detailed-map v2 production release

- Current behavior: the existing fixed-surface Detailed-map architecture now
  consumes the native-scale islandwide Default and Gray collections from
  versioned asset roots without changing Leaflet, pins, clustering, card-to-pin
  focus, notes, sharing, print composition, mobile behavior, or Standard-map
  defaults. W01 validation accepts both the deployed v1 identity and the exact
  native-scale v2 identity; all other surfaces continue through the existing
  collection validation path. The client still falls back to Standard when an
  index, manifest, chunk, coverage check, or Detailed load fails.
- Known-good reference: production roots
  `https://maps.carearound.sg/v2/native-scale-20260722/default` and
  `https://maps.carearound.sg/v2/native-scale-20260722/gray`, Pages deployment
  `https://dbbfff9f.senior-resource-map.pages.dev`, custom-domain entry bundle
  `assets/index-B13hWXr9.js` with SHA-256
  `8c8a523c4489a1effab6ff3740a164a6cf920ca62f72c45bc13aa739e1953c75`,
  and isolated source branch `codex/native-scale-map-assets-v2` based on
  `2a213b92a9d4a86926de83ad5bc23caab87d9416`.
- Reproduction steps: build with
  `VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/default`
  and
  `VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/gray`;
  open owner My Map and Print Map; switch Default/Gray; zoom through 14/15;
  pan across W01, W07, and E02; switch resource focus from cards; exercise
  reset, resize, notes, mobile, and print; inspect the request log and visible
  image overlays.
- Acceptance criteria: both collection indexes contain 32 surfaces and 2,741
  chunks; source bytes and SHA-256 values match the accepted native-scale
  edition; old and new W01 manifests pass exact identity checks while tampered
  W01 identities fail; only viewport-intersecting chunks remain mounted;
  Default/Gray switching preserves map state; zoom 15 activates Detailed;
  pins remain geographically aligned; no gaps or seams are visible; Detailed
  makes no live OneMap basemap-tile requests; Standard fallback, attribution,
  print, mobile, and existing map interactions remain stable.
- Verification result: R2 publication and full remote verification completed
  for every manifest and chunk in both styles. Default matched 32 surfaces, 2,741
  chunks, 1,475,991,567 bytes, collection version
  `sg-native-z18-default-dd278b0ec70837c2`, and index SHA-256
  `8ffcac00d0a3c5d37aad686d8ce750708171239744c16e070cad0926b74694f9`.
  Gray matched 32 surfaces, 2,741 chunks, 1,318,586,532 bytes, collection
  version `sg-native-z18-gray-93d7fb92af2690f6`, and index SHA-256
  `1b4dd3d62784afeb8661558ae7853c36d397094115a61b0d5c8a5240d150de3e`.
  Strict W01 checks accepted the deployed and native-scale Default/Gray
  identities and rejected altered source-manifest and chunk-set hashes.
  Fixed-surface/integration tests passed 27/27, R2 tests passed 6/6, and the
  broader map/print suite passed 201/201. The exact v2 production-mode client
  build passed with its existing large-chunk warning, and `git diff --check`
  passed. Local desktop, mobile, and print Playwright inspection found no
  console errors, blank gaps, or seams; viewport panning retained eight DOM
  chunks while replacing two off-screen chunks; the desktop print smoke used
  eight visible chunks (about 7.7 MiB encoded) and mobile zoom 15 used six
  (about 5.3 MiB encoded). Detailed requests used only the selected fixed
  collection; the OneMap logo remained as attribution, not a live basemap tile.
  The full client/source suite passed 443/444; the sole failure is the existing
  Care Calendar planning-overlap assertion, which also fails in unchanged
  `main` and is outside this map-only release. The exact built `index.html` and
  entry-bundle SHA matched the custom domain after explicit Pages publication.
  Authenticated production smoke on owner map 87 confirmed Standard at zoom 14,
  automatic Detailed at zoom 15, active Default/Gray controls, v2 W01 chunks,
  and zero new live OneMap tile requests after the Detailed and Gray switches.
  API health remained OK. Browser logging showed no CareAround application or
  map-asset error; one page-attributed message-channel closure came from an
  installed browser extension.
- Release boundary: the 2,741 immutable chunks and 32 manifests per style are
  published, with each short-cache collection index published last. The client
  bundle was explicitly deployed to the Pages production branch. No Worker,
  API, schema, auth, permission, data, ranking, filtering, visibility, saved
  resource, or production database change was made. The v1 islandwide roots
  remain intact for immediate asset rollback, and W01-only roots remain an
  emergency fallback. Source implementation commit `1334957bc` is merged into
  `main`. Before that push, the Cloudflare Pages Git build command was changed
  from the stale W01-only roots to both validated v2 roots, preventing later
  Git-triggered production builds from silently overwriting this release.

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
- Resource detail contact/social links
- Auth session continuity
- Secure multilingual foundation
- Phone identity uniqueness

## Audit matrix

| Surface | Current state | Known-good reference | Reproduction steps | Acceptance criteria | Last checked |
| --- | --- | --- | --- | --- | --- |
| Discover | Recovered and locked on stabilization branch | Screenshot `2026-04-23 9.06.20 AM` + user verification | Load `/discover`, test refresh consistency, search, scope, radius, saved pins, rail collapse/resize independence, map reset/anchor behavior | Counts stable across refreshes; no random reloads/radius changes; later approved UI preserved; rail resize and summary collapse independent | 2026-04-24 |
| Auth session continuity | Locked after the 2026-05-16 hotfix so session validation stays on the cookie-owning API origin, successful sign-ins clear stale WhatsApp attempt state, Admin Tools selected-user views do not silently fall back to the Super Admin cookie after transient session failures, and ambiguous empty `/auth/me` responses are confirmed before clearing a cold-loaded dashboard session | Commit `9cb61909` + production app bundle `assets/index-dHYmeiP9.js` + 2026-05-16 user confirmation that login stopped looping + 2026-05-30 selected-user view stability fix + 2026-06-03 report of post-login navigation/inactivity returning to Login | Sign in with email, Google, and WhatsApp where available; navigate `/discover`, `/my-directory`, `/dashboard/resources`, `/dashboard/admin`, and `/dashboard/profile`; from Admin Tools, open another user's account in a new tab; leave tabs idle, refocus them, refresh, and repeat after a deploy | Session checks for `/auth/me` never fall through to an origin that cannot receive the session cookie; transient primary session-check failures preserve the current signed-in user or selected-user view token instead of switching identity; successful empty `{ user: null }` session responses are rechecked before redirecting a newly loaded app to Login; definitive invalid/missing-token responses still sign the user out or exit an expired selected-user view; successful sign-in clears stale stored WhatsApp login attempts; saved assets, dashboard resources, and admin counts do not drop to zero because auth state was falsely cleared | 2026-06-03 |
| Auth transition handoff | Added explicit `/auth/transition` loading screen after successful auth to avoid transient return-to-login flicker; transition route can surface announcements/tips before dashboard handoff; WhatsApp auth now includes a same-device-number preflight confirmation and delayed recovery guidance | Commit `4e06af1d` (initial handoff) + `fae8b9b5` (register-mode copy, transition guard) + `9e52c7fe` (register-mode footer handoff link) + current auth polish commits (no-login-paint redirect, sample-number cleanup, auth-in-progress overlay, and WhatsApp preflight/recovery UX) + user verification in local `/login` and `/register` flows | Sign in with a regular account via email, Google, or WhatsApp, then observe post-submit route behavior before and after membership-token returns; start flow from both `Sign in` and `Register` tabs and confirm `/auth/transition` displays loading UI and continues to destination; confirm Google click/email submit shows the handoff while auth is in progress; confirm WhatsApp verified state moves into handoff before dashboard; confirm WhatsApp start stays disabled until the same-device checkbox is acknowledged and pending state shows recovery guidance after delay | Users should always see a dedicated loading handoff screen after auth starts or completes, not `/login` unless user intentionally navigates there or auth fails; WhatsApp sign-in/register requires confirming this device is logged into WhatsApp with the entered number; pending WhatsApp attempts help users recover with open-again, try-another-number, and Google/email options; Register tab offers WhatsApp registration entrypoint; WhatsApp sample numbers use `87654321` instead of a real personal number | 2026-05-16 |
| My Directory saved assets | Recovered and locked on stabilization branch | User-approved stabilization branch behavior | Load `/my-directory`, test search, scope, select-all, remove-selected | Saved cards render, filters work, bulk actions stable | 2026-04-22 |
| Private Maps interactive | Recovered and locked on stabilization branch; mobile map, legend, Map notes, and cards now scroll as one natural page while Map notes stick near the top after the map scrolls away; full map opens only from the visible map control and returns through an explicit Back to list control; list-only resources render as compact cards, adapt between side lanes and the map-notes column, respect font-size controls, and show saved logos before generic icons | `efc03d82`, related private-map commits + 2026-05-31 mobile map/list refinement + 2026-05-31 list-only layout refinement + 2026-06-27 natural-scroll/full-map follow-ups + 2026-06-28 stable-canvas reset | Create/open `/my-directory/maps/:id`, test hover, cluster click, selection; on mobile width, scroll the map and cards as one page, confirm Map notes remain accessible, open full-map mode from the visible map control, return with Back to list, and tap a numbered card badge; include a map with both mapped and list-only resources; toggle A-/A+ and include a list-only resource with a logo | Hover linking, cluster zoom/spiderfy, card↔pin sync stable; mobile natural scrolling preserves map/card order without collapse/reveal jumps; Map notes stay reachable after the map scrolls away and in explicit full-map mode; scroll gestures do not auto-open or resize the map; numbered card badges still zoom/focus the matching map pin; list-only resources never receive map pin numbers, follow mapped cards on desktop, use Group-first ordering on mobile, share the side card lanes when mapped resources are sparse, dock under Map notes when mapped resources are dense, resize with global font controls, and use saved logos when available | 2026-06-28 |
| Private Maps print/export | Recovered and locked on stabilization branch; print card links and map interactivity retested locally; hidden export surface moved off-screen after it was found overlapping live map hit-testing; print header copy wraps without truncating | `865461f4`, `940cc182` + user-approved stabilization layout pass | Open `?view=print`, test layout, grouped asset detail links, pin/cluster hover, top-edge pin hover, cluster click zoom/spiderfy, map reset, Save as image, header title/description wrapping, distance-anchor note placement, and `elementFromPoint` on visible marker centers | Wide layout, QR present, map name is not truncated, description wraps before QR area, distance anchor note sits just above map, grouped print entries navigate to detail pages, hover highlights matching card(s) with orange ring, top-edge pins remain responsive, cluster click expands, reset restores full map, export clone does not intercept marker hit-testing, capture succeeds, print preview matches approved baseline | 2026-04-25 |
| Shared maps | Recovered and locked on stabilization branch; mobile shared-map cluster taps retested after the 2026-05-18 regression; mobile map, legend, Map notes, and cards now scroll as one natural page while Map notes stick near the top after the map scrolls away; full map opens only from the visible map control and returns through an explicit Back to list control; list-only resources render with the same compact/adaptive, font-responsive, logo-aware presentation as private My Maps; shared-map sign-in now carries the current shared link through login and refreshes viewer permissions after auth changes | User-approved stabilization branch behavior + 2026-05-18 mobile cluster smoke + 2026-05-31 mobile map/list refinement + 2026-05-31 list-only layout refinement + 2026-06-09 shared-map login continuation + 2026-06-27 natural-scroll/full-map follow-ups + 2026-06-28 stable-canvas reset | Open shared directory as guest, choose sign in/register, complete login, and confirm the same shared map continues after the auth handoff; open the same shared link while already signed in; test copy/save flows, map notes, receiver-side note translation, mobile cluster tap sequence, mobile natural page scroll, explicit full-map open/return, numbered card badge focus, shared font-size controls, and a shared map containing list-only resources with and without logos | Shared view loads for guests and signed-in users; login returns to the same shared map instead of dropping to the dashboard or Login; signed-in recipients see copy/save actions without a manual refresh; shared note translations follow receiver language selection; mobile cluster taps split immediately without a center-only pause; large clusters split to the next visible cluster layer, and 2/3-resource clusters uncluster on the next tap when their resources fit in the map window; mobile natural scrolling and explicit full-map mode keep Map notes accessible without changing shared visibility, clustering, ranking, or save/copy rules; shared list-only resources stay visible without adding extra pins or private-only details; saved logos appear when available and generic icons remain fallback-only | 2026-06-28 |
| Dashboard resources/admin | Recovered and locked on stabilization branch; punctuation-normalized resource search retested locally; dashboard resource logos render inside stable contained frames; managed search now scopes full-pagination loads by query before client-only filtering; direct Staff managed place lists are server-scoped before counts/pagination; Super Admin managed resource lists use page-scoped database pagination for first-page load/retry; simple text search stays server-paginated while preserving category/tag matching | User-approved stabilization branch behavior + 2026-05-20 logo-frame polish + 2026-05-23 managed-search fetch stabilization + 2026-05-30 production staff-count/search report + 2026-06-01 slow load/retry report | Load `/dashboard/resources` and `/dashboard/admin`, test search, counts, export, uploaded/enriched logos with wide, tall, and square artwork, a managed search such as `frcs`, a Super Admin simple search such as `thk`, a Super Admin initial load/retry, and a direct Staff user-view with only assigned places | Search stable, counts consistent, filtered workbook export works, admin search does not reload on every letter, names with parentheses remain searchable; resource, offering, and template logos fit fully within their frames without cropping or overflowing; Super Admin managed first-page loads do not format the entire dataset before returning; comma/slash client-only searches and boundary filters still use a scoped full dataset; Staff counts/pagination show only assigned managed places | 2026-06-01 |
| Workbook import/export | Recovered and locked on stabilization branch; local full/filtered exports and import reports revalidated | Local verification artifacts in `output/workbook-local-2026-04-25T05-42-07-819Z` | Run places export/import, standalone offering import, template import, rollout import, filtered workbook flows, error-report flows; re-open exported `.xlsx` files with `openpyxl` | No timeout/subrequest regressions; reports accurate; filtered/full export formats round-trip safely; `.xlsx` files include `Guide`, `Data`, and `Reference` sheets | 2026-04-25 |
| Subregion boundary upload | Guarded so boundary CSV upload adds to existing boundaries by default; replace remains explicit and warning-gated; large range CSVs are batched before hitting server row limits | User report on 2026-05-12 with `Clustered_SG_Postal_Codes copy.csv` and production alert showing 5,000-row rejection plus prior wipe-out from replace behavior | Open `/dashboard/admin` > Subregions, upload a boundary CSV with `subregion!D` + `Running_Range`, then test adding a small one-code CSV to an existing subregion | Upload defaults to Add mode; existing postal codes are preserved unless Replace is explicitly chosen; files over 5,000 source rows are split client-side; Replace mode is blocked for multi-batch files to avoid partial deletion; UI explains add vs replace clearly | 2026-05-12 |
| SG postal fallback for place writes | Added Phase 1 fallback so Super Admins and actors scoped to `Singapore / SIN` can create/import SG places even when a valid OneMap postal code is not yet in exact Region boundary rows; exact Region boundaries stay untouched and the validated code is cached into `subregion_postal_codes` | 2026-05-18 SG boundary repair after valid codes `822211`, `821264`, `762317`, `730887`, `670454`, and `543279` were missing from the configured SG Region | Create or import a place with a Singapore postal code that has no exact Region row, with OneMap returning an exact `POSTAL` match; also try a non-SG country and a mismatched OneMap result | Valid SG postal codes fall back to `Singapore / SIN`, cache with `ON CONFLICT DO NOTHING`, and reuse OneMap coordinates for the write; invalid/mismatched OneMap results remain rejected; non-SG countries do not use the SG fallback; normal overlapping/exact Region matches continue to win first | 2026-05-18 |
| Hard asset boundary visibility | Locked the corrected Phase 2 model: Region boundaries must not hide hard assets from users or admins; boundaries remain metadata/governance inputs and are used for soft-asset targeting/visibility, not place visibility | 2026-05-18 clarification that hard assets are visible places while boundaries primarily help owners/staff/admins target soft assets to public users | Open Discover and dashboard resources as users/admins with different Region scopes; search for hard assets outside the account's Region; also check hidden direct assignments | Visible hard assets remain visible regardless of Region boundary; hidden hard assets only appear in managed views for Super Admins or direct hard-asset Owner/Staff; soft assets still respect region/audience targeting rules | 2026-05-18 |
| Asset create/edit forms | Recovered and locked on stabilization branch; place create, inline place edit, offering create/edit, template create/edit, and rollout edit checked locally; offering create/edit public contact and action fields now match import-review coverage | Local browser verification on `/dashboard/resources` with current `server/.env` API + 2026-05-25 offering field parity checks | Open place/offering/template forms and edit existing assets; create or edit an offering and compare public contact/action fields with Import Material review rows | No blank screens; hard-place inline edit renders expected fields; modal create/edit flows render expected fields; rollout editor opens inherited/local sections; offering forms expose Contact phone, WhatsApp contact, Contact email, Action button label/link, and Venue note | 2026-05-25 |
| Resource detail contact/social links | Restored after regression where early-stage social media links disappeared from hard-asset detail cards; hard assets now persist `social_links`, dashboard/import/enrichment flows preserve supported channels, and resource details render website plus supported social channels without exposing private data | April 2026 archived CareAround implementation with `hard_assets.social_links`, social link helpers, import extraction, asset-form editing, and detail-card rendering | Create or edit a hard asset with Facebook/Instagram/TikTok/YouTube/LinkedIn links, open its resource detail card from Discover or dashboard, and test a social URL accidentally entered in Website | Supported social URLs are normalized and shown as Social channels; ordinary websites still render as Website; social-only website values are split into social channels instead of broken website links; unsupported domains are ignored; server schema bootstrap includes `hard_assets.social_links` before production deploy | 2026-05-18 |
| AI enrichment | Recovered and locked for credentialed flows; grounded AI is now cost-governed and off by default unless `GROUNDED_AI_ENABLED=true`; Vertex Search grounding no longer uses controlled-generation schema/JSON mode; tags-only enrichment can fall through to a deeper grounded pass only when that cost gate is enabled; social links are preserved; Google Maps preview/static-map, inline lazy-load placeholders, or generic service carousel images are not accepted ahead of organization logos; collateral AI import prefers direct Gemini when configured and caches repeated extraction results through Worker KV when available | Live Worker API `https://senior-resource-map-api.joshuachua79.workers.dev/api` with configured `VERTEX_AI_*` and `GOOGLE_MAPS_API_KEY` secrets; 2026-05-19 local live probe for `Precious Active Ageing Centre (Sunshine Gardens)`; 2026-05-20 local live probes for `New Life Community Services Active Ageing Centre (Care) @Jelapang` and `SASCO@Khatib`; 2026-07-13 AI cost-control stack in `docs/ai-cost-control-stack.md`; 2026-07-13 Worker secret-name check confirmed Gemini and dedicated Translation secrets without exposing values | Fill a place draft name, postal code, and address; call `/hard-assets/import/enrich-draft`; call `/hard-assets/import/google-candidates` with `enrich: true`; preview selected Google candidates; run collateral import with Gemini configured; repeat the same collateral import to confirm cache reuse; repeat with `GROUNDED_AI_ENABLED` unset and then enabled; verify AI cache and daily counters write under `ai-cost-control:*` KV keys when `MAP_CACHE` is available | Button enables only with required draft fields; unconfigured/empty enrichment response gives visible feedback instead of silently doing nothing; grounded AI web fallback is blocked unless explicitly enabled and quota remains available; manual enrich and Google preview still return validated logo URLs only when the source/website exposes a usable image, preferring organization logo filenames over service carousel/award/placeholder images; collateral import uses direct Gemini before Vertex unless `AI_IMPORT_PROVIDER=vertex` is explicitly set; repeated imports can reuse the server cache instead of billing again; daily quotas use Worker KV when available with local memory fallback; public Discover ranking, sorting, visibility, saved maps, auth, and translation review behavior are unchanged | 2026-07-13 |
| Import Material refresh saves | Locked after FRCS June 2026 calendar refresh exposed partial save behavior from row-by-row create/link/tag work in the Worker API; import review now carries public WhatsApp contact through extraction, matching, and save payloads | 2026-05-23 FRCS calendar local extraction probe returned 22 reviewed rows; production UAT showed partial saves before the bulk commit fix; 2026-05-25 offering field parity checks | Import the same host programme calendar in refresh mode, review update/create actions, save all rows, then re-search the host in `/dashboard/resources` and open the resource detail; confirm reviewed rows include WhatsApp contact alongside phone, email, CTA, and venue note | Save reviewed rows uses bulk creation, bulk location linking, and bulk tag sync so a 20+ row calendar does not silently stop after a few rows; row-level failures name the affected programme; re-importing a refreshed calendar updates matching offerings and creates only missing ones; explicit missing-offering hide/ended choices remain user-reviewed; blank imported WhatsApp contact preserves existing values during refresh | 2026-05-25 |
| Restricted resource notes/files | Added protected notes/files surface for places and offerings; private content is fetched through dedicated authenticated APIs and excluded from public resource/map snapshots; protected file viewing renders image/PDF previews inline only after permission checks; additional read-only viewer grants are limited to Region Admins and active unrelated asset operators | `codex/partner-private-detail` implementation + 2026-05-20 restricted-viewer eligibility hardening | Open/edit a place or offering as an authorised owner/staff/admin, add notes/files/access grants, then open detail as same-asset Owner/Staff, Region Admin grant, unrelated active Owner/Staff grant, stale/revoked operator grant, standard user, and guest | Same-asset Owner/Staff and inherited linked-asset operators can manage; Region Admins and active unrelated asset operators can be explicitly added as read-only viewers; normal users and stale/revoked operators cannot view even if an old grant remains; PDF/image previews pass through permission-checked route; public saved-map/shared-map snapshots do not include private fields | 2026-05-21 |
| Pilot governance foundation | Added neutral Organisation governance under Admin Tools using `partner_organizations` as legal-counterparty records; organisation admin/staff access manages or views governance context only and never grants resource edit rights; agreement references, consent records, notification preferences, opt-outs, sensitive audit logs, manual retention metadata, resource freshness fields, and dormant recommendation-review records are established; Archived/Paused organisation controls now show explicit locked-state guidance instead of appearing silently unresponsive | 2026-05-22 pilot governance implementation plan + local governance/server verification + 2026-05-30 governance control clarity fix | As Super Admin, create an organisation, assign organisation admin/staff, attach an agreement, link a hard/soft resource, update profile consent/preferences/opt-outs, patch resource freshness, inspect audit logs and retention queue; then sign in or view as organisation admin/staff without asset access; set an organisation to Archived or Paused and confirm new access/link/agreement controls explain the lock while profile status can still be changed back | No global `organisation_admin` user role is added; organisation access does not edit linked resources unless the user also has direct Asset Owner/Staff access; Region Admin role alone does not grant organisation access; notification prefs persist but external email/WhatsApp/SMS delivery stays disabled in V1; consent history is versioned; opt-outs remain durable; retention review marks records manually without auto-delete; Archived/Paused organisations block new access, linked resources, and agreement records until set back to Active or Draft, with visible guidance rather than silent dead controls; existing Auth, Discover, My Directory, My Maps, Shared Maps, Dashboard Resources/Admin, restricted notes/files, and multilingual surfaces stay stable | 2026-05-30 |
| Organisation governance access design | Locked the expanded Organisation governance access model: Organisation Admins can manage the organisation access list, Organisation Staff can open a read-only Organisation workspace, eligible linked places cover their hosted/linked offerings, Region Admin creators receive default Owner access for new places and standalone offerings, and resource-change audits can attach to organisation coverage including offerings covered through linked places. Follow-up stability polish keeps errors near the relevant Organisation profile/access/resource/agreement section and batches link-candidate/covered-offering loading to avoid Worker subrequest-limit failures. | 2026-06-03 user-approved organisation governance access design + branch `codex/org-governance-access-design` + 2026-06-03 production report of local section errors, empty link-resource candidates, read-only staff controls, and Cloudflare Worker subrequest errors | As Super Admin, seed the first Organisation Admin and link eligible assets. As Organisation Admin, add/remove other Organisation Admins and Staff without removing the final active admin, link only eligible places or individual offerings, review covered offerings, agreements, and organisation audit rows, and confirm linked-place coverage includes hosted/linked offerings. As Organisation Staff, open `/dashboard/organization` and verify read-only access to organisation access, linked assets, covered offerings, and agreements. As Region Admin, create a place and standalone offering and confirm default Owner access is granted only for those created assets. | Organisation governance remains separate from asset edit permissions; Organisation Admin/Staff access never grants resource editing by itself; users can belong to only one active organisation; linked assets are blocked unless all active asset Owners/Staff belong to the organisation and the asset has no conflicting active organisation link; linking a place automatically covers hosted/linked offerings; Organisation Staff cannot mutate governance records; Organisation Admins cannot remove the last active Organisation Admin; direct asset Staff/Owner resource-list stabilization remains locked; infrastructure failures are shown as retryable local section messages without exposing raw database/Worker internals; auth, Gmail/email, GudAuth, secrets, public visibility, Discover, My Maps, and Shared Maps behavior are unchanged | 2026-06-03 |
| Audit trail Phase 1 | Added a scoped operational Audit Trail for Super Admins and Organisation Admins. Phase 1 records resource create/update/hide/show/delete, resource access changes, workbook imports/exports, and existing governance/privacy/restricted-content audit events. Everyday search/browsing and personal map actions are intentionally excluded. | 2026-06-02 user-approved Phase 1 audit scope | As Super Admin, open `/dashboard/admin` > Audit Trail or `/dashboard/audit` and review all rows. As an Organisation Admin, open `/dashboard/audit` and review only rows linked to that organisation. As organisation staff or a normal user, confirm the audit link is absent and direct access is denied. Create/edit/hide/show/delete resources, update direct access, and import/export workbooks. | Super Admin can review all audit rows; Organisation Admin can review only rows with their organisation ID; rows without an organisation remain Super Admin-only; staff do not gain audit access; metadata stores operational summaries such as changed field names/counts, not request bodies, secrets, postal-code internals, or private public-user activity; no AI provider, AI chat, Gmail/email, GudAuth, production auth, or secret behavior changes are introduced. | 2026-06-02 |
| Direct hard-asset access and local audience zones | Added direct Owner/Staff memberships for hard assets, asset-scoped staff APIs, dashboard Access/Zones panels, direct Staff edit rights for assigned places and hosted/linked offerings, local audience-zone use with Region/Super approval for global sharing, and guardrails so asset Staff do not inherit workbook admin exports or hard-asset hide/delete rights | 2026-05-15 asset-access architecture UAT | Assign Owner/Staff to a place, sign in as Staff, edit the place, linked offering, and partner-only content, then confirm hide/delete and admin workbook export are denied; sign in as Owner, add/remove Staff and create a local zone; sign in as Region Admin to assign Owners and approve/share zones | Direct asset access replaces new partner-owner assignment flows while legacy partner-owned reads remain; standard users still need explicit asset assignment for dashboard Resources; Owner can manage Staff but not Owners; Staff can edit assigned asset surfaces but cannot manage access, hide, or delete hard assets; production schema requires explicit bootstrap or migration before deploy | 2026-05-15 |
| Secure multilingual foundation | Added security headers/rate limits, request body guardrails, route-level JSON schema validation, admin/import payload guards, resource translation persistence, Google Translation trigger hooks, checklist-style partner/admin translation review, one-click fill for all target languages, user-facing locale fallback, and access-control/privacy regression coverage | `codex/secure-multilingual-foundation` implementation + `codex/security-foundation` hardening passes + 2026-05-20 translation workflow streamline | Save/edit place, offering, template, and child offering; open dashboard translation review; fill all missing/outdated target-language text in one action; refresh a single language; switch locale in nav; load resource cards/details; inspect API/static headers; submit malformed/oversized/invalid-shape API payloads; submit malformed admin/import JSON for audience zones, subregions, partner boundaries, and filtered workbook export; test standard-user access against partner-only, translation-review, and admin export APIs | English remains canonical; Mandarin/Malay/Tamil rows persist when translation is configured; translation review summarizes ready/missing/needs-review states in layman wording; one-click fill requests all target languages without auto-approving them; reviewed machine translations become Ready; staff-edited translations become Needs review instead of being overwritten when English changes; stale/missing translations fall back to English; public snapshots exclude private data; public translation payloads keep translated text and stale fallback hints without review/source metadata; CSP/HSTS/nosniff/frame/referrer headers present; rate limits block repeated high-risk requests; malformed, oversized, invalid-shape, and nested-cell JSON requests fail cleanly before sensitive handlers continue while normal spreadsheet-style scalar rows remain supported | 2026-05-20 |
| Client route recovery | Added route-level error boundary after intermittent blank-page reports during client-side navigation from dashboard to lazy-loaded routes such as My Directory; likely stale or failed route chunk after app/deploy update | `codex/client-route-recovery` implementation | Navigate between `/dashboard`, `/dashboard/admin`, `/dashboard/resources`, `/my-directory`, and `/discover`; keep a tab open across deploys where possible | Lazy route load failures auto-refresh once for the current path; repeated route failures show a recovery card instead of a blank page; normal route loading still shows the existing loading state | 2026-05-05 |
| Dashboard navigation recovery | Hardened dashboard sidebar and overview launchpad navigation after a production report where Manage My Resources, My Profile, and Admin Tools could leave an already-open dashboard tab stuck on the overview after a deploy; Audit Trail now has an overview launchpad card for the same users who already receive the sidebar entry | 2026-05-29 production report from a signed-in Super Admin dashboard tab + 2026-06-03 Super Admin report that Audit Trail was visible in the sidebar but missing from the dashboard overview | Open `/dashboard` and use the sidebar plus overview launchpad to navigate to Manage My Resources, My Profile, Admin Tools, and Audit Trail after a Cloudflare Pages deploy | Dashboard critical links use document navigation so clicks recover from stale in-memory SPA route state; overview launchpad items are real links rather than JS-only buttons; users with audit access see Audit Trail on the dashboard overview as well as the sidebar; dashboard route permissions remain unchanged | 2026-06-03 |
| Phone identity uniqueness | Phase 1 added a Singapore account-phone normalizer; Phase 2A adds a separate `user_phone_identities` table with active-only uniqueness and a read-only duplicate audit, while current login/session behavior and existing `users.phone` values remain unchanged | `codex/phone-normalization-phase1` + `codex/phone-identity-phase2a` implementation | Run focused phone normalization and phone identity schema/audit tests; run session/auth regression tests before any future phone-login wiring; review duplicate `users.phone` groups before any legacy backfill | Singapore account identity phones normalize to E.164 (`+65...`) consistently; blank/invalid values fail safely; one active `phone_e164` maps to at most one user; one user has at most one active phone identity in V1; future WhatsApp/GudAuth account lookup must use `user_phone_identities.phone_e164`, not raw `users.phone`; no GudAuth login or production backfill is enabled yet | 2026-05-06 |
| WhatsApp phone login and signup | Phone login uses GudAuth verification plus active verified phone identities; unknown verified phones enter a guided standard-user signup flow; return links recover in-progress attempts even if the login marker is stripped from the URL; mobile and tablet launch uses the native WhatsApp app URL instead of stopping on the web `Open app` interstitial, with a larger interim loader on coarse-pointer screens and an interim-page self-redirect plus fallback button once the code is ready; phone-first account creation requires a soft acknowledgement that it may create a separate account; phone-first users can add a real recovery email/password from Profile before unlinking WhatsApp | `codex/phone-login-phase4a` implementation + `80e6820c` mobile launch behavior | Start WhatsApp sign-in from `/login` on desktop, Android, iPhone, and tablet widths; confirm the prepared code opens in WhatsApp on mobile/tablet without remaining stuck on the interim loader or requiring the WhatsApp web interstitial; send the prefilled WhatsApp code; click the GudAuth return link; test both an existing verified phone and a new phone that has no CareAround account; create a phone-first account, add a recovery email/password in Profile, and then unlink WhatsApp | Browser calls only CareAround `/api` routes; raw `users.phone` is not trusted for login; legacy/unverified/revoked identities cannot log in; exactly one active verified identity creates a normal session; unknown verified phones ask for display name and optional postal code before creating a standard user; phone-first account creation is disabled until the separate-account acknowledgement is checked; placeholder phone-only email is hidden as `No email added`; stored attempts resume after WhatsApp return without needing a manual refresh or check button; mobile/tablet launch URLs prefer `whatsapp://send` with the generated code while desktop keeps the web WhatsApp URL; if automatic app launch is blocked, the interim page exposes a large direct `Open WhatsApp` fallback; unlinking WhatsApp is blocked while the account still has a phone-only placeholder email, and succeeds only after a real recovery email/password is saved | 2026-05-13 |

## Recent stabilization notes

### 2026-06-10 Session recheck before API auth-expired logout

- Current behavior: dashboard navigation and My Directory interactions no longer clear the signed-in user immediately when a normal API request emits the shared `carearound:auth-expired` event. The event now confirms the active session through `/auth/me` first, preserving the current user when the cookie-owning API still reports a valid session. Definitive invalid or missing-token responses from `/auth/me` still sign the user out.
- Known-good reference: locked Auth session continuity row above, plus the 2026-06-10 user report that mobile dashboard interactions could intermittently return to Login, with recent examples when opening Audit and My Directory.
- Reproduction steps: sign in on mobile, navigate through `/dashboard/audit` and `/my-directory?section=my-maps`, and trigger or encounter a non-auth API response that raises `carearound:auth-expired`. Confirm the app rechecks `/auth/me` before deciding whether to redirect to Login.
- Acceptance criteria: transient or non-auth API auth-expired events do not kick a still-valid user to Login; genuinely expired sessions still go to Login after `/auth/me` confirms no valid user; Audit, My Directory, My Maps, shared-map continuation, saved assets, session focus/visibility checks, and dashboard data loading keep their existing behavior.
- Verification result: `node --test client/test/authSession.test.js` first failed on the old immediate-clear handler, then passed after the patch. Focused auth/navigation coverage passed 22/22 with `node --test client/test/authSession.test.js client/test/apiRequest.test.js client/test/myMapsLoading.test.js client/test/dashboardNavigationRecovery.test.js`; full client coverage passed 196/196 with `node --test client/test/*.test.js client/src/lib/*.test.js`; `npm run test:server` passed 347/347; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and local mobile browser verification with mocked API confirmed `/dashboard/audit` and `/my-directory?section=my-maps` both stayed signed in after a simulated `carearound:auth-expired` event. No Worker deploy, backend API change, auth secret change, schema change, access-control permission change, Discover change, My Maps data/shared visibility change, Grab behavior change, or production database change was introduced by this local patch.
- Production release follow-up: commit `9904c15f` was fast-forwarded to `main`, pushed, and deployed to Cloudflare Pages on 2026-06-10. The final explicit production-branch publish completed at `https://d04a0f4a.senior-resource-map.pages.dev`; custom domain `https://app.carearound.sg` returned `200` and served `assets/index-vAtitDl4.js`; production API health returned `200`. Production-domain browser verification with mocked signed-in API responses at phone viewport confirmed `/dashboard/audit` stayed on `/dashboard/audit` with `GudPerson` visible and `/my-directory?section=my-maps` stayed on `/my-directory` with `GudPerson` visible after a simulated `carearound:auth-expired` event; both routes performed a fresh `/auth/me` recheck, there were no console warnings, and the only failed request was an unrelated Cloudflare RUM beacon abort. No Worker deploy, backend API change, auth secret change, schema change, access-control permission change, Discover change, My Maps data/shared visibility change, Grab behavior change, or production database change was introduced by this release.

### 2026-06-10 Route and auth loading stabilization

- Current behavior: branch `codex/fix-route-loading-dup` keeps the auth boot loader at the app shell for protected Dashboard and My Directory routes only, while public routes such as Discover, shared maps, auth handoff, and resource detail can render without waiting for an unrelated auth boot check. Protected routes no longer layer a second route-level auth loader on top of the shell loader. Session checks ignore stale non-forced responses when a newer user state has already been applied. Resource-detail, saved-asset, and protected-content reads can suppress the global `carearound:auth-expired` event when a local resource request reports an auth-shaped 401, preventing a valid signed-in session from flickering back to Login. Resource detail navigation now prefers React Router SPA navigation when a router navigate function is available.
- Known-good reference: locked Auth session continuity, Client route recovery, Dashboard navigation recovery, My Directory saved assets, and Resource detail contact/social links rows above, plus production `main` commit `d0047324` and current branch commits `0da67851`, `f4153fd8`, `d3331db4`, `b244f6ee`, and `5bf3ebe0` after the 2026-06-10 route/loading regression loop.
- Reproduction steps: open `/dashboard/audit` and `/my-directory?section=my-maps` with a valid signed-in session while auth boot and auth-expired rechecks run; dispatch or encounter a `carearound:auth-expired` event from a non-session API request; open `/resource/hard/:id` from another app route and from a direct URL; simulate a resource-detail 401 `Invalid token` response while `/auth/me` still returns the current user.
- Acceptance criteria: protected Dashboard and My Directory routes show one stable loading handoff while auth boot settles and then remain on the requested route when the session is valid; public routes are not blocked by the protected-shell auth loader and do not redirect to Login unless an actual protected route requires auth; stale session checks do not overwrite newer user state; local resource-detail/read failures do not dispatch an extra global auth-expired event or clear a valid user; genuine `/auth/me` invalid/missing-token responses still sign the user out; route navigation, saved assets, My Maps, shared maps, resource visibility, access-control permissions, Discover ranking/filtering, schema, Worker API, Gmail/email, GudAuth, secrets, and production data remain unchanged.
- Verification result: focused auth/navigation coverage passed 23/23 with `node --test client/test/authSession.test.js client/test/apiRequest.test.js client/test/dashboardNavigationRecovery.test.js client/test/myMapsLoading.test.js`; full client coverage passed 197/197 with `node --test client/test/*.test.js client/src/lib/*.test.js`; `npm run test:server` passed 347/347; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and `git diff --check` passed on 2026-06-10. Local built-app browser verification against `http://localhost:4173` with mocked signed-in API responses confirmed `/dashboard/audit` stayed signed in after a simulated `carearound:auth-expired` event, `/my-directory?section=my-maps` did not fall to Login, `/resource/hard/17525` rendered through the SPA route, and a mocked `/hard-assets/999` `Invalid token` response showed the public not-found state without dispatching an extra auth-expired event. Full authenticated smoke was not run because `SMOKE_PARTNER_USERNAME`, `SMOKE_PARTNER_PASSWORD`, `SMOKE_BASE_URL`, and `SMOKE_API_BASE` were not present in the shell; narrower live unauthenticated checks confirmed `https://app.carearound.sg/discover` returned `200`, `https://app.carearound.sg/resource/hard/17525` returned `200`, and `https://api.carearound.sg/api/health` returned `200`. No Worker deploy, backend API change, auth secret change, schema change, access-control permission change, Discover change, Shared Maps data/shared visibility change, Grab behavior change, Gmail/email change, GudAuth change, or production database change was introduced by this branch.
- Production recovery release follow-up: after Admin Tools access was blocked by the route/auth loading regression and a smoke user could not be created through the UI, `main` was fast-forwarded from `d0047324` to `ed956eb4` and pushed on 2026-06-10 with the authenticated smoke gap explicitly accepted as a recovery constraint. `VITE_API_URL=https://api.carearound.sg/api npm run deploy:client` completed successfully and deployed Cloudflare Pages at `https://ab48e7c0.senior-resource-map.pages.dev`; the production custom domain served `assets/index-oEGgYSv4.js`, which contains the `suppressAuthExpired` and `carearound:auth-expired` route/session markers. Production `https://app.carearound.sg/discover`, `/dashboard/admin`, and `/resource/hard/17525` returned `200`; production API health returned `200` with timestamp `2026-06-10T15:58:04.644Z`. Production-domain browser verification with mocked signed-in API responses confirmed `/dashboard/audit` stayed signed in after a simulated `carearound:auth-expired` event, `/my-directory?section=my-maps` did not fall to Login, `/resource/hard/17525` rendered through the SPA route, and a mocked `/hard-assets/999` `Invalid token` response showed the public not-found state without dispatching an extra auth-expired event. The only browser request failures were Cloudflare RUM/navigation aborts while moving between routes. No Worker deploy, backend API change, auth secret change, schema change, access-control permission change, Discover change, Shared Maps data/shared visibility change, Grab behavior change, Gmail/email change, GudAuth change, or production database change was introduced by this release. Next recovery step is human UAT of Admin Tools with an existing admin login, then create or reset a dedicated smoke account and rerun `npm run test:smoke` with `SMOKE_BASE_URL=https://app.carearound.sg` and `SMOKE_API_BASE=https://api.carearound.sg/api`.

### 2026-06-10 My Maps load resilience

- Current behavior: private My Maps list and private map detail loads now retry short-lived load failures before showing a final error. The My Maps tab keeps a loading state until the first list request has actually settled, so a slow or temporarily failed first request does not flash an empty state that appears fixed only after a browser refresh. If all retries fail, the user sees a retry action instead of needing to refresh the whole app. Expired-session and access-denied style responses still stop immediately so login/access behavior is unchanged. Print-only image export code and PDF generation code are lazy-loaded only when the user enters print view or clicks `Download PDF`, so normal My Map detail loading does not parse the export stack upfront.
- Known-good reference: locked My Directory saved assets and Private Maps interactive rows above, plus the 2026-06-10 user report that maps could lag inconsistently and appear only after refresh.
- Reproduction steps: open `/my-directory?section=my-maps` and simulate the first `/my-maps` response failing before a successful retry; open `/my-directory/maps/:id` and simulate the first map-detail response failing before a successful retry; repeat with an expired-session response and confirm the request is not retried as a normal load error.
- Acceptance criteria: transient My Maps list/detail failures recover without manual refresh; genuine empty map lists still show the empty state only after a successful zero-result load; final failures offer a retry action; expired sessions and access failures keep existing auth/access behavior; map pins, clustering, notes, private/shared visibility, Discover, Grab, backend API, schema, secrets, and Worker behavior remain unchanged.
- Verification result: `node --test client/test/myMapsLoading.test.js client/test/i18n.test.js` passed 6/6; `node --test client/test/*.test.js client/src/lib/*.test.js` passed 180/180; `npm run test:server` passed 347/347; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and local built-app browser verification confirmed a mocked first `/my-maps` failure recovered on the second request and a mocked first `/my-maps/87` failure recovered on the second request without a page refresh. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Grab behavior change, or production Pages deploy was introduced by this local patch.
- Preview release follow-up: implementation commit `9c6429f5` was pushed to `codex/my-maps-load-resilience`; Cloudflare Pages preview deployed at `https://f8bacb15.senior-resource-map.pages.dev` with branch alias `https://codex-my-maps-load-resilienc.senior-resource-map.pages.dev`, serving `assets/index-sk1PO4qt.js`; preview root returned `200`; production API health returned `200`; and deployed-preview browser verification with mocked API confirmed `/my-directory?section=my-maps` recovered from one temporary `/my-maps` failure and `/my-directory/maps/87` recovered from one temporary `/my-maps/87` failure without page refresh. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Grab behavior change, or production Pages deploy was introduced by this preview.
- Production release follow-up: after user approved production release, `main` fast-forwarded from `656bdd6b` to `4ece54b5` and was pushed on 2026-06-10. Pre-release gates passed again: `npm run test:server` passed 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed. Cloudflare Pages production deploy completed at `https://020c59d2.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200`, served `assets/index-CMx70fQL.js`, and included the `assets/myMapsLoading-D_UnskC8.js` lazy chunk; production API health returned `200`; production custom-domain browser verification with mocked API confirmed `/my-directory?section=my-maps` recovered from one temporary `/my-maps` failure and `/my-directory/maps/87` recovered from one temporary `/my-maps/87` failure without page refresh; public `/discover` loaded `Showing 1637 resources` with no failed requests. Production smoke was not run because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were not available in the shell. No Worker deploy, backend API change, auth secret change, schema change, Discover ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.
- Local performance follow-up: on 2026-06-10 the normal My Map detail route was found to include print-only image-export code and PDF generator code in the initial route chunk. The fix lazy-loads `MapImageExportButton` only in print view and lazy-loads `myMapPdfGenerator` only after the `Download PDF` click. Verification passed focused My Map/PDF loading coverage 19/19, full client coverage 195/195, `npm run test:server` 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and a phone-sized local browser check at `http://localhost:5173/my-directory/maps/87` with mocked signed-in My Map data. The built My Map detail chunk reduced from the previous deployed `MyMapDetailPage-CClV8qIu.js` 51.13 kB / 16.60 kB gzip to `MyMapDetailPage-BQWgiPZh.js` 25.57 kB / 7.12 kB gzip; `MapImageExportButton-B7gdu8vr.js` and `myMapPdfGenerator-cAtLDcgz.js` are now separate lazy chunks. The browser check confirmed no `MapImageExportButton`, `myMapPdfGenerator`, `jspdf`, `autotable`, `html-to-image`, `index.es`, or `html2canvas` modules loaded before the PDF click; after the click only the PDF generator, `jspdf`, and `jspdf-autotable` loaded. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this local patch.
- Production release follow-up: performance/spacing commit `eb08c808` was fast-forwarded to `main`, pushed, and deployed to Cloudflare Pages on 2026-06-10 at `https://987fef4b.senior-resource-map.pages.dev` after an explicit production-branch publish aligned Pages root and custom domain. The custom domain `https://app.carearound.sg` returned `200`, served `assets/index-BvRV0WMR.js`, and referenced the optimized `assets/MyMapDetailPage-BQWgiPZh.js` chunk; production API health returned `200`. Deployed bundle inspection confirmed `MyMapDetailPage-BQWgiPZh.js` is 25,569 bytes and contains dynamic imports for `MapImageExportButton-B7gdu8vr.js` and `myMapPdfGenerator-cAtLDcgz.js` but not the image-export implementation body. Production-domain browser verification with mocked signed-in My Map data at phone viewport confirmed no `MapImageExportButton`, `myMapPdfGenerator`, `jspdf`, `autotable`, `html-to-image`, `index.es`, or `html2canvas` modules loaded before the PDF click; after the click only `myMapPdfGenerator-cAtLDcgz.js`, `jspdf.plugin.autotable-B0IxatYY.js`, and `jspdf.es.min-qPaxpc-J.js` loaded. The same smoke downloaded `my-partners-ledger.pdf` at 12,811 bytes with no failed requests or console warnings. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.

### 2026-06-09 Shared map login continuation

- Current behavior: shared-map sign-in links now include a safe `returnTo` value for the current `/shared/maps/:token` path, so guests who sign in from a shared map continue back to that same map after the auth handoff. If auth state changes while the shared map is open, the page quietly refreshes the shared-map viewer permissions once, keeping the current map/list view in place. Signed-in non-owners can see shared-map save/copy actions from the app auth state while the backend still enforces the final copy/save permissions. Empty shared maps can gain a home/distance anchor without tripping a map hook-order crash.
- Known-good reference: existing shared-map public view and `AuthPage` return-to handling before this fix; user report on 2026-06-09 that shared maps did not continue after login and could appear in logged-out status for signed-in users.
- Reproduction steps: open a shared map link as a guest, tap Sign in, complete login, and confirm the app returns to the same shared map instead of `/dashboard` or Login. Open a shared map link while already signed in and confirm copy/save actions appear without a manual refresh. Repeat on mobile drawer controls and desktop shared-map header.
- Acceptance criteria: shared maps remain public for guests; unsafe or unrelated return targets are ignored; all shared-map sign-in entry points use the continuation link; auth changes trigger at most one quiet viewer refresh per token/auth state; empty/list-only maps remain renderable when distance context appears; map pins, clustering, notes, translations, ranking, shared visibility, list-only presentation, My Maps, Discover, Grab, backend auth, secrets, schema, and Worker behavior remain unchanged.
- Verification result: `node --test client/test/sharedMapContinuation.test.js client/test/directoryMapCamera.test.js client/test/directoryMapPresentation.test.js client/test/sharedMapDirectoryListRefinement.test.js` passed 10/10; `node --test client/test/*.test.js client/src/lib/*.test.js` passed 174/174; `npm run test:server` passed 347/347; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and `git diff --check` passed on 2026-06-09. Local browser verification with mocked shared-map API confirmed desktop and mobile guest sign-in links render `/login?returnTo=%2Fshared%2Fmaps%2Fdemo-token%3Ffrom%3Dshare%23place-2`; a signed-in mocked viewer with a stale guest shared-map payload triggered exactly two shared-map requests, showed `Copy to My Maps` and `Save`, and showed zero Login links. No Worker deploy, backend API change, auth secret change, schema change, Discover change, My Maps behavior change, Grab behavior change, or production Pages deploy was introduced by this local patch.
- Preview release follow-up: implementation commit `41ba4386` was pushed to `codex/shared-map-login-continuation`; Cloudflare Pages preview deployed at `https://94116319.senior-resource-map.pages.dev` with branch alias `https://codex-shared-map-login-conti.senior-resource-map.pages.dev`, serving `assets/index-DSMkO0ZA.js`. Preview browser verification with mocked shared-map API confirmed desktop and mobile guest sign-in links render `/login?returnTo=%2Fshared%2Fmaps%2Fdemo-token%3Ffrom%3Dshare%23place-2`; a signed-in mocked viewer with a stale guest shared-map payload triggered exactly two shared-map requests, showed `Copy to My Maps` and `Save`, and showed zero Login links. Preview root returned `200`, and production API health returned `200`. No Worker deploy, backend API change, auth secret change, schema change, Discover change, My Maps behavior change, Grab behavior change, or production Pages deploy was introduced by this preview.
- Owner continuation follow-up: when a signed-in user opens a shared link for a map they own, the shared-map page now replaces the public snapshot route with `/my-directory/maps/:mapId` after the shared payload confirms ownership. This keeps personal/private notes and owner controls in the My Map surface while preserving the public shared view for guests and signed-in recipients. Verification result on 2026-06-10: `node --test client/test/sharedMapContinuation.test.js` passed 4/4; `node --test client/test/sharedMapContinuation.test.js client/test/directoryMapCamera.test.js client/test/directoryMapPresentation.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/mapNotes.test.js` passed 15/15; `node --test client/test/*.test.js client/src/lib/*.test.js` passed 175/175; `npm run test:server` passed 347/347; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; `git diff --check` passed; and local built-app browser verification with mocked API confirmed signed-in recipients stay on `/shared/maps/:token` with `Copy to My Maps`, while signed-in owners are replaced to `/my-directory/maps/87` with `Map notes` visible.
- Owner continuation preview follow-up: implementation commit `21d71b73` was pushed to `codex/shared-map-login-continuation`; Cloudflare Pages preview deployed at `https://affccc67.senior-resource-map.pages.dev`, serving `assets/index-BLDCspUi.js`, with branch alias `https://codex-shared-map-login-conti.senior-resource-map.pages.dev` later observed serving `assets/index-Cbi2qdi2.js` after the ledger-only commit. Preview root and branch alias returned `200`, production API health returned `200`, and deployed-preview browser verification with mocked API confirmed signed-in recipients stay on `/shared/maps/:token` with `Copy to My Maps`, while signed-in owners are replaced to `/my-directory/maps/87` with `Map notes` visible. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Grab behavior change, or production Pages deploy was introduced by this preview.
- Production release follow-up: user confirmed preview UAT passed, then `main` fast-forwarded from `49cabb97` to `96153a6b` and was pushed on 2026-06-10. Pre-release gates passed again: `npm run test:server` passed 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed. Cloudflare Pages production deploy completed at `https://2ffbcdfe.senior-resource-map.pages.dev`; the production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-Cbi2qdi2.js`; production API health returned `200`; and production custom-domain browser verification with mocked API confirmed `/discover` loads, signed-in recipients stay on `/shared/maps/:token` with `Copy to My Maps`, and signed-in owners are replaced to `/my-directory/maps/87` with `Map notes` visible. Production smoke was not run because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were not available in the shell. No Worker deploy, backend API change, auth secret change, schema change, Discover ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.

### 2026-06-09 Resource detail Open in Grab prototype

- Current behavior: resource detail pages now show a separate `Open in Grab` action when the primary place has an address or coordinates. The existing `Get directions (Google Maps)` action remains unchanged. The Grab action uses the public Grab OneLink wrapper with a `grab://open` booking deep link and only passes the resource destination title/address/coordinates; no backend API, saved profile data, pickup point, auth state, sharing, Discover card, My Map, or shared-map behavior is changed.
- Known-good reference: resource detail Google Maps and Share actions on the current branch before this prototype, plus Grab Partner Farefeed documentation showing `deepLink`, `directDeepLink`, `screenType=BOOKING`, and drop-off address/latitude/longitude parameters.
- Reproduction steps: open a hard-asset resource detail page with an address and coordinates; confirm both `Get directions (Google Maps)` and `Open in Grab` appear; open a detail page with no destination data and confirm neither destination action is added; switch supported UI languages and confirm the Grab label translates.
- Acceptance criteria: Google Maps continues to open exactly as before; `Open in Grab` is resource-detail-only and does not appear in Discover cards, mobile browse cards, My Maps, or shared maps; the generated href uses the documented OneLink/Grab deep-link shape; missing destination data returns no Grab link; translated locales do not fall back to English.
- Verification result: `node --test client/test/rideHailingLinks.test.js`, `node --test client/test/i18nCoverage.test.js`, `node --test client/test/resourceDetailPresentation.test.js`, `node --test client/test/*.test.js client/src/lib/*.test.js`, and `npm run build:client` passed on 2026-06-09. The build kept the existing large chunk warning. Preview/mobile UAT deployment is allowed before production release; phone-level Grab app behavior still needs manual iOS/Android UAT because this is a frontend-only prototype, not the official authenticated Farefeed API path.
- Preview release follow-up: implementation commit `7b718092` was pushed to `codex/open-in-grab-prototype`; Cloudflare Pages preview deployed at `https://0204a5ed.senior-resource-map.pages.dev` with branch alias `https://codex-open-in-grab-prototype.senior-resource-map.pages.dev`. Mobile-width browser verification on `/resource/hard/17525` loaded the live API, showed `Get directions (Google Maps)`, `Open in Grab`, and `Share resource`, and generated a Grab OneLink href with the Braddell Heights destination title, address, latitude, and longitude. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Discover, My Maps, Shared Maps, ranking, sorting, filtering, visibility, or eligibility behavior was changed.
- Production release follow-up: after user mobile UAT confirmed the preview looked good and worked well, `main` was fast-forwarded to `810da635` and pushed. `npm run test:server` passed 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `VITE_API_URL=https://api.carearound.sg/api npm run deploy:client` deployed Cloudflare Pages at `https://b1441469.senior-resource-map.pages.dev`. Production `https://app.carearound.sg` served `assets/index-C6_tQ1GA.js`; API health returned OK; mobile-width browser verification on `/resource/hard/17525` showed `Get directions (Google Maps)`, `Open in Grab`, and `Share resource` with a Grab OneLink destination href; public `/discover` loaded `Showing 1637 resources` with no failed API responses. Full authenticated production smoke was not run because smoke credentials were not present in the shell. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Discover ranking/filtering/visibility, My Maps, Shared Maps, or eligibility behavior was changed.
- Grab paste-guide follow-up: after mobile UAT showed Grab overrides coordinate labels and address-only links do not set a destination, branch `codex/grab-address-first-destination` switched address-backed resources to copy a short Grab search string before opening Grab booking. The copied format is `Singapore <postal code>` plus a new line and the first 23 characters of the resource name, for example `Singapore 550307` and `PCF Sparkle Care Active`. A first-use guide explains tapping `Where to?` and pasting into the destination field; a local opt-out marker skips the guide on future clicks. Verification on 2026-06-09: `node --test client/test/rideHailingLinks.test.js client/test/resourceDetailPresentation.test.js client/test/i18nCoverage.test.js` passed 15/15, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and Cloudflare Pages preview deployed at `https://dedb32ad.senior-resource-map.pages.dev` with branch alias `https://codex-grab-address-first-des.senior-resource-map.pages.dev`. Mobile-width browser verification on `/resource/hard/17525` showed the guide, copied `Singapore 550307\nPCF Sparkle Care Active`, opened Grab booking without drop-off parameters, and confirmed the guide opt-out skips the overlay on the next click. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Discover, My Maps, Shared Maps, ranking, sorting, filtering, visibility, or eligibility behavior was changed.
- Grab full-address guide refinement: after mobile UAT showed resource-name fragments such as `cent` could steer Grab suggestions toward unrelated landmarks, the address-backed Grab action now copies the full displayed address again instead of the short postal-code-plus-name format. The first-use guide replaces the old explanatory sentence with the resource/place title, then shows the copied full address and the same two-step `Where to?` / paste instruction. Verification on 2026-06-09: commit `03cbe964` was pushed to `codex/grab-address-first-destination`; `node --test client/test/rideHailingLinks.test.js client/test/i18nCoverage.test.js client/test/resourceDetailPresentation.test.js` passed 15/15, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed. Cloudflare Pages preview deployed at `https://20870054.senior-resource-map.pages.dev` with branch alias `https://codex-grab-address-first-des.senior-resource-map.pages.dev`, serving `assets/index-DX7as9H3.js`; preview `/resource/hard/17525` returned `200`; production API health returned OK; bundle inspection confirmed the old `We copied a short destination` sentence was absent; mobile-width browser verification showed `PCF Sparkle Care Active Ageing Centre (Care) @ Braddell Heights` in the guide and copied `307 Serangoon Avenue 2 #01-44 Singapore 550307` to the clipboard. No Worker deploy, production Pages deploy, auth, Gmail/email, GudAuth, secret, schema, Google Maps, Discover, My Maps, Shared Maps, ranking, sorting, filtering, visibility, or eligibility behavior was changed.
- Production full-address release follow-up: after user approved the full-address preview, `main` was fast-forwarded to `32070bdb` and pushed. `npm run test:server` passed 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `VITE_API_URL=https://api.carearound.sg/api npm run deploy:client` deployed Cloudflare Pages at `https://51abe959.senior-resource-map.pages.dev`. Production `https://app.carearound.sg/resource/hard/17525` and `/discover` returned `200` and served `assets/index-DX7as9H3.js`; production API health returned OK at `2026-06-09T15:32:52.344Z`; bundle inspection confirmed the old `We copied a short destination` sentence was absent; mobile-width browser verification on production showed `PCF Sparkle Care Active Ageing Centre (Care) @ Braddell Heights` in the guide and copied `307 Serangoon Avenue 2 #01-44 Singapore 550307` to the clipboard. Authenticated smoke was not run because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were not present in the shell. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Google Maps, Discover ranking/filtering/visibility, My Maps, Shared Maps, or eligibility behavior was changed.
- Desktop visibility follow-up: after production desktop UAT showed the Grab action in Chrome desktop, the resource detail Grab action is now limited to phone-sized views only. Desktop and wider embedded views keep `Get directions (Google Maps)` and `Share resource`; phone-sized views still show the Grab copy/open guide. Verification on 2026-06-09: commit `a6c29631` was pushed to `codex/hide-grab-desktop`; `node --test client/test/resourceDetailPresentation.test.js client/test/rideHailingLinks.test.js client/test/i18nCoverage.test.js` passed 16/16, `npm run test:server` passed 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed. Cloudflare Pages preview deployed at `https://178a98ea.senior-resource-map.pages.dev` with branch alias `https://codex-hide-grab-desktop.senior-resource-map.pages.dev`; preview `/resource/hard/15718` at `1440x900` had zero Grab actions with Google and Share still visible, while `390x844` kept one `Copy address & open Grab` action plus Google and Share. Production release follow-up: `main` was fast-forwarded to `a6c29631` and pushed; `VITE_API_URL=https://api.carearound.sg/api npm run deploy:client` deployed Cloudflare Pages at `https://ff2c82b8.senior-resource-map.pages.dev`; production `https://app.carearound.sg/resource/hard/15718` and `/discover` returned `200` and served `assets/index-CjwmnAUt.js`; production API health returned OK at `2026-06-09T15:46:24.849Z`; production browser verification showed `/resource/hard/15718` at `1440x900` had zero Grab actions and retained Google and Share, while `390x844` kept one Grab action plus Google and Share. Authenticated smoke was not run because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were not present in the shell. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Google Maps, Discover ranking/filtering/visibility, My Maps, Shared Maps, or eligibility behavior was changed.

### 2026-06-03 Auth session empty-check and Audit Trail overview card

- Current behavior: successful empty `/auth/me` responses are treated as ambiguous during a cold dashboard session check and are rechecked briefly before clearing the user. Definitive signed-out responses still clear the session immediately. Users who already have Audit Trail access through the sidebar also see an Audit Trail card on the dashboard overview.
- Known-good reference: 2026-06-03 production report that post-login navigation or short inactivity could return the user to Login, plus the Super Admin report that Audit Trail was visible in the sidebar but missing from the overview dashboard.
- Reproduction steps: sign in, navigate between dashboard routes, leave the tab idle briefly, refocus or refresh, and confirm the user remains signed in unless the API returns a definitive signed-out response. Open `/dashboard` as a user with audit access and confirm the Audit Trail launch card appears and opens `/dashboard/audit`.
- Acceptance criteria: transient or ambiguous empty session checks do not falsely log out a cold-loaded dashboard; selected-user and normal session protections remain unchanged; Audit Trail overview visibility matches existing audit access rules; Admin Tools nesting remains unchanged; no Worker, auth secret, Gmail/email, GudAuth, production secret, permission, resource visibility, search, sorting, map, or Discover behavior changes.
- Verification result: focused client session/navigation/i18n tests passed 20/20, focused server auth/session tests passed 8/8, `npm run test:server` passed 313/313, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 143/143, `npm run build:client` passed with the existing large chunk warning, `git diff --check` passed, and production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api` on 2026-06-03.
- Deployment evidence: PR #39 merged to `main` as `d6c4d717`; Cloudflare Pages client deploy completed at `https://f191140a.senior-resource-map.pages.dev`; production custom domain served `assets/index-B3orhY8h.js` and dashboard overview chunk `assets/DashboardOverview-BZo5tnU1.js` containing `dash-audit`; `https://api.carearound.sg/api/health` returned `{"status":"ok","timestamp":"2026-06-03T05:56:30.350Z"}`. No Worker deploy, auth, Gmail/email, GudAuth, or secret changes were made.

### 2026-06-03 Organisation governance access design

- Current behavior: Organisation governance remains separate from resource editing. Super Admins still seed the first organisation access. Organisation Admins can manage Admin/Staff access inside an active organisation, but cannot remove the final active Organisation Admin. Organisation Staff can open `/dashboard/organization` in read-only mode and review the organisation access list, linked resources, covered offerings, agreement coverage, and agreement records. Organisation Admins can link only eligible places or offerings; a linked place automatically covers hosted and linked offerings for organisation context. Region Admins who create a place are granted default Owner access to that new place, and Region Admins who create a standalone unlinked offering are granted default Owner access to that offering. Hosted/linked offerings do not auto-grant extra ownership. Resource-change audit rows can be associated with organisation coverage, including offerings covered through linked places.
- Known-good reference: 2026-06-03 user-approved organisation access design discussion covering Region Admin creator defaults, Organisation Admin access management, Organisation Staff read-only context, eligible linked assets, inherited offering coverage, and organisation resource-change audit expectations.
- Reproduction steps: as Super Admin, add the first Organisation Admin and link an eligible place. As Organisation Admin, add another Organisation Admin and Staff member, attempt to remove the final admin, link a place with all active asset operators inside the same organisation, try linking a place with an unadded operator, link an individual offering, and review covered offerings/agreements/audit rows. As Organisation Staff, open `/dashboard/organization` and confirm read-only organisation context. As Region Admin, create a place and standalone offering and confirm default Owner access appears only for those directly created assets.
- Acceptance criteria: Organisation Admin/Staff access never grants resource edit permissions by itself; Organisation Admins can add/remove organisation Admin/Staff users inside open organisations while final-admin protection stays active; Organisation Staff can view, not mutate, organisation context; users are limited to one active organisation membership; linked resources require all active asset Owners/Staff to already belong to the organisation and no conflicting active organisation link; linking a place automatically includes hosted/linked offerings for organisation context and audit coverage; Region Admin creator Owner grants are limited to newly created places and standalone offerings; direct asset Staff resource-load stabilization remains unchanged; public UI/API does not expose private postal codes, Region IDs, Audience Zone IDs, internal zone names, secrets, or implementation labels; auth, Gmail/email, GudAuth, production secrets, Discover, My Maps, Shared Maps, ranking, sorting, visibility, and eligibility remain unchanged.
- Verification result: `node --test server/test/governance.test.js server/test/auditTrail.test.js server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js` passed 36/36, `npm run test:server` passed 313/313, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 141/141, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-03. PR #38 merged as `e38db49b`; Cloudflare Worker `senior-resource-map-api` deployed version `7597a55b-a9f9-480f-a95f-cead3a87b3e8`; Cloudflare Pages deployed `https://17287324.senior-resource-map.pages.dev`; production custom domain served `assets/index-CJWQmQiU.js`; `/dashboard/organization` returned `200`; production API health returned OK; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No auth, Gmail/email, GudAuth, secret, schema, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.
- Stability polish follow-up: Organisation profile, Organisation access, Linked resources, and Agreement records now show action failures beside the relevant section instead of only at the page top. Raw infrastructure messages such as Worker subrequest/database errors are converted to a short retryable local message while business-rule errors, such as final-admin protection, remain specific. Linked place coverage is loaded in one batched pass across organisations, and hard-resource link candidates are evaluated with batched active-link, active-operator, and organisation-membership context before returning eligible candidates. This preserves the existing eligibility model while avoiding repeated per-resource lookups that can hit the Cloudflare Worker subrequest limit. Verification result: `node --test server/test/governance.test.js` passed 17/17, `npm run test:server` passed 315/315, `node --test client/test/governanceOrganizationUi.test.js` passed 8/8, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 144/144, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-03. Commit `9df7f384` was fast-forwarded to `main`; Cloudflare Worker `senior-resource-map-api` deployed version `87abde54-b67e-4f7b-8dd7-28c540aceef8`; Cloudflare Pages deployed `https://6f8a8d46.senior-resource-map.pages.dev`; production custom domain served `assets/index-DsD4E5IV.js`; `/dashboard/organization` returned `200`; production API health returned OK; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No auth, Gmail/email, GudAuth, secret, schema, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.
- Production UAT follow-up: final-admin protection still returned the correct API `403`, but a background eligible-user candidate refresh could clear the local Organisation access action error before the admin could read it. Candidate-refresh failures are now tagged separately so successful candidate refreshes clear only candidate-load errors, not business-rule action errors. Verification result: `node --test client/test/governanceOrganizationUi.test.js` passed 9/9, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 145/145, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-03. Commit `6d26bf28` was pushed to `main`; Cloudflare Pages deployed `https://34e25d32.senior-resource-map.pages.dev`; production custom domain served `assets/index-czP_gecc.js`; production API health returned OK; focused production Organisation governance UAT passed for Super Admin, Organisation Admin, and Organisation Staff with zero governance `5xx`, zero non-aborted request failures, and zero suspect Worker/subrequest console errors; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.
- Blank linked-resource dropdown follow-up: production org `Entrust Healthcare Group` showed no hard-resource candidates for the empty linked-resource dropdown even though direct Owner rows existed for Healthcare Group and Hyqel Zainudin. Searching by `bento` returned Healthcare Group's place and searching by `precious` returned Hyqel's three places, confirming the eligibility rule was correct but the blank dropdown's global hard-asset sample missed eligible resources. The empty hard-resource candidate path now seeds from the organisation's active access users' direct hard-asset staff memberships, deduplicates those places, and then reuses the existing active-link/operator/organisation-membership eligibility filter before returning candidates. Search-based candidates keep the existing hard-asset text search. Verification result: red/green regression coverage added in `server/test/governance.test.js`; `node --test server/test/governance.test.js` passed 18/18, `npm run test:server` passed 316/316, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-03. Commit `a2f88ff9` was pushed to `main`; Cloudflare Worker `senior-resource-map-api` deployed version `afc7914f-e671-43c3-8116-7bf24db59759`; production API health returned OK; production `/governance/organizations/6/resource-candidates?type=hard&q=` returned the expected four candidates (`bento place test` plus the three Precious Active Ageing Centre places); searched production candidates still returned `bento` 1/1 and `precious` 3/3; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No Pages deploy, auth, Gmail/email, GudAuth, secret, schema, resource edit permission, Discover, My Maps, Shared Maps, ranking, sorting, public visibility, or resource eligibility behavior was changed.

### 2026-06-02 Audit trail Phase 1

- Current behavior: Super Admins can open the Audit Trail from Admin Tools or `/dashboard/audit` and review sensitive operational history. Organisation Admins can open `/dashboard/audit` and review only audit rows tied to their active organisation admin access. Organisation staff and standard users do not receive an audit entry point and direct access is denied. New resource-change audit records are written for place/offering/template creates, edits, hide/show changes, deletes, access grants/revocations, availability updates, workbook imports, and workbook exports. Existing governance, privacy, restricted-content, and selected-user-view audit rows continue to use the same underlying audit table.
- Intentional exclusions: everyday Discover/search/browsing activity, personal map actions, saved-resource activity, and AI chat/querying are not included in Phase 1. A future strict audit-query assistant can be explored later against this ledger-backed surface, but no AI provider, prompt, or secret is added here.
- Known-good reference: user-approved 2026-06-02 Phase 1 scope: Super Admin plus Organisation Admin audit trail, leave everyday search/browsing and personal map actions out, and keep the implementation narrow.
- Reproduction steps: as Super Admin, open `/dashboard/admin` and select Audit Trail, then open `/dashboard/audit`; use category/action filters and pagination. As an Organisation Admin, open `/dashboard/audit` and confirm only organisation-linked rows appear. As organisation staff or a standard user, confirm the sidebar link is absent and direct route access is blocked. Create, edit, hide, show, and delete a place/offering/template; add and revoke direct asset access; import/export a workbook; then refresh the audit trail.
- Acceptance criteria: Super Admins see all audit rows; Organisation Admins see only rows whose `organizationId` matches active organisation admin access; rows without an organisation remain Super Admin-only; staff do not gain audit access; resource-change metadata contains summaries such as action type, resource type, changed field names, and counts instead of raw request bodies or secret-like values; public-user postal codes, Region IDs, Audience Zone IDs, zone names, private map actions, and normal search/browsing actions are not logged; auth, Gmail/email, GudAuth, and production secret behavior are untouched.
- Verification result: `node --test server/test/auditTrail.test.js`, `node --test server/test/assetOperatorAuthorization.test.js`, `npm run test:server` passed 305/305, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 131/131, `npm run build:client` passed with the existing large chunk warning, `git diff --check` passed, and the changed-file high-risk credential literal scan was clean on 2026-06-02. PR #34 merged as `b4fe978f`; Cloudflare Worker `senior-resource-map-api` deployed version `fffdfae7-299a-46f1-8b7b-78a1c0e08364`; Cloudflare Pages deployed `https://86514875.senior-resource-map.pages.dev`; production custom domain served `assets/index-BXxEc_AX.js` with `AuditTrailPage-pt-xiei8.js` and `AuditTrailPanel-BpYd4M9P.js`; production API health returned OK; unauthenticated `/api/governance/audit-logs` returned a protected-route `401` instead of a missing route; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.
- UX polish follow-up: Audit Trail filters now align consistently, the organisation filter uses organisation names and includes all organisation statuses, and each trail card leads with a plain-language summary while retaining technical action details as secondary context. Verification result: `node --test client/test/auditTrailPresentation.test.js` passed 4/4, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 135/135, `npm run build:client` passed with the existing large chunk warning, `git diff --check` passed, and the changed-file high-risk credential literal scan was clean on 2026-06-02. PR #35 merged as `52a6efd6` from feature commit `3d80ddfd`; Cloudflare Pages deployed `https://0b0e27c2.senior-resource-map.pages.dev`; no Worker deploy was needed or performed for this client-only polish. Production custom domain served `assets/index-fmfw7mrw.js` with `AuditTrailPanel-3I_ChfgO.js` and `AuditTrailPage-B-RBY4zo.js`; `/dashboard/audit` returned `200`; production API health returned OK; unauthenticated `/api/governance/audit-logs` returned a protected-route `401`; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.
- Phase 1B detail polish: future organisation profile update logs now store safe change metadata, including changed field names and before/after values only for allowlisted fields such as organisation name and status. Contact, notes, description, secrets, request bodies, postal-code internals, private user activity, and unrestricted free-text values remain hidden; older update rows without detail metadata show a clear note that detailed field changes were not recorded for that older entry. Verification result: `node --test server/test/auditTrail.test.js` passed 7/7, `node --test client/test/auditTrailPresentation.test.js` passed 6/6, `npm run test:server` passed 306/306, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 137/137, `npm run build:client` passed with the existing large chunk warning, `git diff --check` passed, and the changed-file high-risk credential literal scan was clean on 2026-06-02. PR #36 merged as `e44c95bf` from feature commit `97d8106b`; Cloudflare Worker `senior-resource-map-api` deployed version `86853a2f-2d36-404f-89de-2df900cd7b4b`; Cloudflare Pages deployed `https://85efe723.senior-resource-map.pages.dev`; production custom domain served `assets/index-CcNCiYE_.js` with `AuditTrailPanel-CCHgfiPt.js`, `AuditTrailPage-CwrjWfTR.js`, and `AdminPage-D3q72y5y.js`; `/dashboard/audit` returned `200`; production API health returned OK; unauthenticated `/api/governance/audit-logs` returned a protected-route `401`; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No auth, Gmail/email, GudAuth, Worker secret, database credential, search, map, Discover, or resource visibility behavior was changed.

### 2026-06-01 Dashboard resources failed-load recovery state

- Current behavior: Dashboard Resources distinguishes a failed resource load from a successful zero-result load. If the first managed-resource request fails, the tabs show placeholder counts and the list area shows a recoverable load message with Retry instead of `No places found`. If the browser reports offline, the copy says the user seems offline; otherwise it says the connection or server may be briefly slow. If a refresh fails after rows are already visible, the existing rows remain visible and the warning banner explains the transient load problem.
- Known-good reference: 2026-06-01 production screenshot showing `/dashboard/resources` with `Places (0)`, `Offerings (0)`, `Templates (0)`, and `No places found` after a random fetch failure even though resources normally load after a refresh.
- Reproduction steps: open `/dashboard/resources` as an authorised resource manager; simulate a failed hard/soft resource request before any successful load; retry once connectivity/API is available; repeat after a successful load while rows are visible and while a search/filter leaves no visible rows.
- Acceptance criteria: true successful zero-result searches still show the empty state; failed initial loads show a retryable load-error state instead of real zero-data copy; offline wording appears only when the browser reports offline; transient API/network failures use neutral retry wording; previously loaded rows are not replaced by a false empty state; search, sorting, pagination, export, create/edit actions, permissions, auth, Gmail/email, GudAuth, Worker, and secret behavior remain unchanged.
- Verification result: `node --test client/test/resourceLoadState.test.js` failed before the helper existed, then a follow-up red test confirmed failed refreshes with zero visible rows would incorrectly show `empty` before the helper was tightened. `node --test client/test/resourceLoadState.test.js client/test/resourceListLoading.test.js client/test/paginatedResults.test.js` passed 14/14, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 129/129, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-01.
- Deployment evidence: PR #32 merged to `main` as `1f3761ad`; Cloudflare Pages production deployment completed at `https://4a1798b5.senior-resource-map.pages.dev`. Production custom domain served `assets/index-Bz2qoGJ2.js` and resource-management chunk `assets/ResourcesPage-Dm1Ptvo1.js` containing `We could not load your resources just now`, `You seem to be offline`, `Reconnect to the internet`, and `Retry`; `https://api.carearound.sg/api/health` returned `{"status":"ok","timestamp":"2026-06-01T15:22:21.699Z"}`. No Worker deploy, auth, Gmail/email, GudAuth, permission, search, sort, pagination, export, or secret changes were made.
- Admin Tools Regional Admin follow-up: production selected-user view for Healthcare Group on `/dashboard/admin` showed `Resource pages failed to load` and zero resources. Direct production API probes as that selected Regional Admin showed first hard/soft resource pages could succeed, but the Admin Tools full hydration path repeated eight heavy hard-resource page requests and began receiving Cloudflare HTML `503` responses on later pages, with the soft resource first page also intermittently returning `503` under the same sequence. Admin Tools now avoids eager all-page resource hydration for Regional Admin views: it keeps the first successful hard/soft page plus the server-reported total count, avoiding the repeated Worker-heavy page sequence while preserving the same managed `regionScoped` request parameters and resource permissions. Verification result: red/green coverage added in `client/test/resourceListLoading.test.js`; `node --test client/test/resourceListLoading.test.js` passed 6/6, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 146/146, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-03. Commit `433afa06` was pushed to `main`; Cloudflare Pages deployed `https://4a111ddd.senior-resource-map.pages.dev`; production custom domain served `assets/index-B1dvrdkv.js` with `assets/AdminPage-ZT_8oITT.js` containing the Regional Admin hydration guard; focused production browser verification as selected user Healthcare Group loaded `/dashboard/admin`, showed `bento place test`, showed no resource-load error or false empty state, and observed zero failed API responses; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, resource edit permission, organisation governance, public visibility, Discover, My Maps, Shared Maps, ranking, sorting, or resource eligibility behavior was changed.

### 2026-06-01 Discover mobile zero-place summary cleanup

- Current behavior: mobile/narrow Discover result cards hide the location summary for soft resources with zero linked/display places instead of showing `Available at 0 places`. Soft resources with real display addresses or positive linked-place counts still show the existing location summary, and coordinate-backed direction targets keep the existing direction affordance.
- Known-good reference: 2026-06-01 user screenshot showing `THK Home Help Services (Meals-on-Wheels West)` displaying `Available at 0 places` in mobile Discover browse mode.
- Reproduction steps: open `/discover` at mobile/narrow width with a standalone/list-only soft result that has no linked display location; compare it with soft results that have real addresses and soft results that have positive linked-place counts.
- Acceptance criteria: no Discover result card shows `Available at 0 places`; zero-place soft results do not show an empty or broken location box; positive counts, real locations, and direction-capable coordinate targets remain unchanged; no ranking, filtering, sorting, visibility, eligibility, saved-resource, direction, map, Worker, auth, Gmail/email, GudAuth, or secret behavior changes.
- Verification result: `node --test client/test/discoveryMobileCardPresentation.test.js` failed before the presentation helper existed and passed after the patch. `node --test client/test/discoveryMobileCardPresentation.test.js client/test/discoveryCache.test.js client/test/i18nCoverage.test.js` passed 9/9, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 124/124, and `npm run build:client` passed with the existing large chunk warning on 2026-06-01.
- Deployment evidence: PR #31 merged to `main` as `f64b938a`; Cloudflare Pages client deployment completed at `https://3dc98a50.senior-resource-map.pages.dev`; production custom domain served `assets/index-B71WofPU.js`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-06-01T14:04:20.055Z`. A read-only mobile production browser probe on `/discover` loaded `Showing 1638 resources`, found `THK Home Help Services (Meals-on-Wheels West)`, and confirmed `Available at 0 places` was absent. No Worker deploy, auth, Gmail/email, GudAuth, or secret changes were made.

### 2026-06-02 Discover multi-host soft-asset anchor verification

- Current behavior: Discover soft resources with multiple visible linked places use the nearest coordinate-valid linked place as the display/distance/directions anchor when an active location context exists, such as signed-in home, searched postal code, or Locate Me. Without an active location context, Discover preserves the first visible linked place as the default display anchor.
- Known-good reference: 2026-06-02 code inspection of `getBestLocation` and Discover result normalization after the user asked to confirm whether multi-host soft resources use a fixed main host or an adaptive nearest host.
- Reproduction steps: load `/discover` with a multi-host soft resource; compare no-location browsing with a home/searched-postal/Locate Me context near a non-first linked place; inspect the card address, distance pill, and directions target.
- Acceptance criteria: active location contexts choose the nearest linked place for display and directions; no-location browsing keeps the existing first-place fallback; location count still reflects all visible linked places; no ranking, filtering, sorting, visibility, eligibility, saved-resource, recommendation-indicator, map, Worker, auth, Gmail/email, GudAuth, or secret behavior changes.
- Verification result: `node --test client/test/discoveryLocationAnchor.test.js` passed 2/2, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 131/131, and `npm run build:client` passed with the existing large chunk warning on 2026-06-02.

### 2026-05-31 My Map and shared map mobile map/list collapse refinement

- Current behavior: My Map and shared-map mobile views keep the existing map pins, number badges, clusters, notes, and resource-card ordering, while adding a presentation-only map panel state. Scrolling resource cards upward collapses the map to a compact height and refits the map camera so visible pins re-enter the smaller map. Pulling down while already at the top card expands the map again. Tapping a numbered card badge expands the map before using the existing view-on-map focus path, so the current zoom-to-pin behavior is preserved. Tapping a compact mobile cluster zooms first so the cluster splits, then performs a settled bounds fit after the mobile map panel transition so both close and wider-spread child pins stay framed inside the current map viewport.
- Known-good reference: locked Private Maps interactive and Shared maps rows above, including the 2026-05-18 mobile cluster smoke that fixed single-tap cluster expansion.
- Reproduction steps: open a private map under `/my-directory/maps/:id` and a shared map under `/shared/maps/:token` at mobile width; scroll resource cards upward, pull down at the top card, tap numbered card badges, and tap map pins/clusters. After the map collapses, confirm the visible pins remain inside the smaller map without requiring the map reset/zoom-out control. After tapping a cluster, confirm exploded child pins are centered inside the map viewport.
- Acceptance criteria: the map collapses/expands only on mobile interactive map/list pages; desktop, print/export, map notes, copy/save, resource visibility, ranking, clustering, and detail navigation stay unchanged; card number badges still focus the matching map pin after expanding the map; collapsing or expanding the map does not strand pins outside the resized map; compact cluster taps fit child pins inside the current mobile viewport.
- Verification result: `node --test client/test/mobileMapPanelBehavior.test.js client/test/mapClusterInteraction.test.js`, `node --test client/test/*.test.js`, and `npm run build:client` passed on 2026-05-31. A follow-up production report showed slow mobile scroll could shrink only the sticky spacing because each scroll event was below the original per-event collapse delta; `client/test/mobileMapPanelBehavior.test.js` now covers slow threshold-crossing scroll and the collapse rule triggers once the user crosses into the card area while scrolling downward. A second production report showed the map still did not visibly collapse; the root cause was revised to browser scroll anchoring after the height shrink being interpreted as an expand event. `client/test/mobileMapPanelBehavior.test.js` now covers that anchoring rebound and ordinary page-scroll events no longer expand a collapsed map; expansion stays on intentional top-pull and numbered-badge paths. A third production report showed the map height itself still did not move; the confirmed root cause was React Leaflet storing `MapContainer` `className` at initial render. `DirectoryMap` now puts dynamic height on a React-owned frame and keeps the Leaflet container at full height; `client/test/directoryMapPresentation.test.js` covers this class boundary. A fourth production report showed the compact map resized correctly but retained the old camera until the reset/zoom-out control was pressed, and cluster explosions could leave pins at the viewport edge. `client/test/directoryMapCamera.test.js` now covers refitting on mobile map layout changes without overriding active focused pins or selected clusters; `client/test/mapClusterInteraction.test.js` now covers compact cluster activation fitting child pins instead of centering the old cluster point. A fifth production report showed the 8-resource cluster highlighted but did not split; the confirmed root cause was compact `fitBounds` choosing a zoom level that still kept the cluster grouped. `client/test/mapClusterInteraction.test.js` now covers compact cluster activation zooming before fitting child pins, and `DirectoryMap` reframes child bounds only after the zoom settles. A sixth production report showed wider-spread child pins could still sit at the compact map edges; the confirmed root cause was the post-zoom reframe being pan-only and able to run before the mobile panel height transition settled. `client/test/mapClusterInteraction.test.js` now covers the second settled reframe after mobile panel expansion, and `DirectoryMap` uses a compact bounds fit after zoom so wider child pins can be centred without changing map data. `node --test client/test/directoryMapCamera.test.js client/test/mobileMapPanelBehavior.test.js client/test/directoryMapPresentation.test.js client/test/mapClusterInteraction.test.js`, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 116/116, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-05-31.
- Deployment evidence: PR #22 merged to `main` as `c4a0aa1a`; Cloudflare Pages client deployment completed at `https://3f39b896.senior-resource-map.pages.dev`; production custom domain served `assets/index-BYtSSgPa.js`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T01:57:38.371Z`. Slow-scroll hotfix PR #23 merged to `main` as `67cbd921`; Cloudflare Pages client deployment completed at `https://9f332509.senior-resource-map.pages.dev`; production custom domain served `assets/index-k5CLgkEm.js`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T02:25:31.483Z`. Scroll-anchoring hotfix PR #24 merged to `main` as `90f56503`; Cloudflare Pages client deployment completed at `https://25e76d2a.senior-resource-map.pages.dev`; production custom domain served `assets/index-C_vvwkLX.js`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T03:14:29.663Z`. Wrapper-height hotfix PR #25 merged to `main` as `ed14fee2`; Cloudflare Pages client deployment completed at `https://a8357c16.senior-resource-map.pages.dev`; production custom domain served `assets/index-CjhZAUX7.js`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T03:35:42.909Z`. Camera-fit hotfix PR #26 merged to `main` as `6c8e284b`; Cloudflare Pages client deployment completed at `https://777d6006.senior-resource-map.pages.dev`; production custom domain served `assets/index-CkJOMsdl.js` and shared directory chunk `assets/useDirectoryDistanceAnchor-COsf6KHP.js` containing `fit-child-bounds`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T04:39:21.514Z`. Compact cluster expansion hotfix PR #27 merged to `main` as `ea1d1475`; Cloudflare Pages client deployment completed at `https://b09d4067.senior-resource-map.pages.dev`; production custom domain served `assets/index-BPhsf86f.js` and shared directory chunk `assets/useDirectoryDistanceAnchor-MnEQ0qq6.js` containing `zoom-then-fit-child-bounds`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T05:15:25.191Z`. Wider cluster fit hotfix PR #28 merged to `main` as `0db6e283`; Cloudflare Pages client deployment completed at `https://c1ebaf4d.senior-resource-map.pages.dev`; production custom domain served `assets/index-CYzr13lT.js` and shared directory chunk `assets/useDirectoryDistanceAnchor-dHvbmTsV.js` containing `zoom-then-fit-child-bounds`, `fitBounds`, and the settled `420ms` reframe; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T05:40:09.536Z`. No Worker deploy, auth, Gmail/email, GudAuth, or secret changes were made.

### 2026-05-31 My Map and shared map list-only resource layout refinement

- Current behavior: resources without map coordinates render as compact list-only cards instead of a large explanatory section in interactive My Map and shared-map views. Mobile keeps a single-column flow of Map, Map notes, mapped resources, then list-only resources. Desktop keeps mapped resources in the existing left/right pin-order lanes; when the mapped list is sparse, list-only cards are placed after mapped cards in the shorter side lane, and when the mapped list is dense, list-only cards dock under Map notes at the map-column width.
- Known-good reference: user-approved 2026-05-31 layout discussion and design spec `docs/superpowers/specs/2026-05-31-my-map-unmapped-layout-design.md`.
- Reproduction steps: open a private My Map and a shared map that contain both mapped and list-only resources; compare mobile and desktop widths; test a sparse map and a dense map; open Map notes and resource detail links from list-only cards.
- Acceptance criteria: list-only resources never receive map pin numbers, mapped cards remain first, mobile list-only cards follow mapped cards, sparse desktop list-only cards share the side card lanes after mapped cards, dense desktop list-only cards align under Map notes, and Map notes/save/remove/detail actions remain available without changing shared-map visibility or map pin behavior.
- Verification result: `node --test client/test/directoryPresentationLayout.test.js client/test/mapNotes.test.js client/test/mobileMapPanelBehavior.test.js` passed 15/15, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 119/119, and `npm run build:client` passed with the existing large chunk warning on 2026-05-31. `git diff --check` passed on 2026-05-31.
- Deployment evidence: PR #29 merged to `main` as `1b068e0a`; Cloudflare Pages client deployment completed at `https://497676e7.senior-resource-map.pages.dev`; production custom domain served `assets/index-Ud3qpoSE.js` and shared directory chunk `assets/useDirectoryDistanceAnchor-Cad5c81m.js` containing `desktopUnmappedPlacement`, `side-lanes`, and `map-column`; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T15:11:47.668Z`. No Worker deploy, auth, Gmail/email, GudAuth, or secret changes were made.

### 2026-05-31 My Map and shared map card scaling/logo refinement

- Current behavior: interactive My Map and shared-map cards use rem-based text and badge sizing in the mapped and list-only card surfaces, so global font-size controls can shrink or enlarge the cards with the surrounding interface. List-only cards show the saved resource logo when one exists, and use the category icon only as a fallback.
- Known-good reference: 2026-05-31 user screenshot showing A- selected while map cards retained fixed sizing, plus the request that list-only cards use logos where available.
- Reproduction steps: open `/my-directory/maps/:id` and a shared map with mapped and list-only resources; toggle A- and A+; inspect mapped card number badges, list-only card labels, and a list-only resource with a saved logo.
- Acceptance criteria: card text, badge, and logo/number badge sizing respond to the app font-size controls without changing map data, ordering, clustering, notes, save/copy/remove behavior, or detail navigation; list-only cards render saved logos where available and fall back to the existing generic resource icon when no logo exists or the logo fails to load.
- Verification result: `node --test client/test/sharedMapDirectoryListRefinement.test.js` initially failed on fixed pixel sizing and missing list-only logo wiring, then passed after the patch. `node --test client/test/directoryPresentationLayout.test.js client/test/mapNotes.test.js client/test/sharedMapDirectoryListRefinement.test.js` passed 9/9, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 121/121, and `npm run build:client` passed with the existing large chunk warning on 2026-05-31.
- Deployment evidence: PR #30 merged to `main` as `ecde9f6e`; Cloudflare Pages client deployment completed at `https://94df9829.senior-resource-map.pages.dev`. The following docs-only deploy-record push produced Git-triggered production deployment `https://6f28accc.senior-resource-map.pages.dev`; production custom domain served `assets/index-Dk_TsXHu.js` and shared directory chunk `assets/useDirectoryDistanceAnchor-Dy02d1rk.js` containing the rem-based card sizing and logo-aware badge code; `https://api.carearound.sg/api/health` returned `{"status":"ok"}` at `2026-05-31T15:42:04.548Z`. No Worker deploy, auth, Gmail/email, GudAuth, or secret changes were made.

### 2026-05-30 Dashboard resource managed-list scope and search stabilization

- Current behavior: dashboard managed place lists now scope standard direct-asset Staff users to their explicitly assigned places before returning counts and pagination. Super Admins can still see all managed places; Region Admins keep the visible-place governance view; legacy partner and partner-staff access remains limited to the partner-owned managed surface. Simple text searches such as `thk` stay server-paginated instead of loading every managed page first, while comma/slash client-only search operators and boundary filters still use the scoped full dataset.
- Search preservation: place search now uses a shared server-side search helper covering name, category, address, postal code, description, and tag names. Offering search also includes tag names alongside existing offering, host-place, and linked-place fields.
- Known-good reference: 2026-05-30 production report where a Staff user with three assigned places saw all-place counts/pagination in Manage My Resources, and Super Admin simple search was slower than expected.
- Reproduction steps: view `/dashboard/resources` as a standard user with direct access to only a few assigned places; confirm the Places tab count and pagination match those assignments. As Super Admin, search a simple term such as `thk`; confirm results use normal paginated API search. Also test comma/slash searches and boundary-filtered views so client-only filtering remains supported.
- Acceptance criteria: Staff users do not see all-place counts, all-place pagination, or page navigation failures for resources they are not assigned to; Super Admin simple search no longer triggers a full managed-dataset load; category/tag searches still work for places and offerings; Dashboard Resources/Admin permissions remain unchanged.
- Verification result: `node --test server/test/hardAssetSearch.test.js server/test/softAssetSearch.test.js`, `node --test server/test/resourceListScope.test.js`, `node --test client/test/resourceListLoading.test.js`, `node --test client/test/*.test.js` passed 86/86, `npm run test:server` passed 297/297, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-05-30.

### 2026-05-29 Discover location indicators Phase 1

- Current behavior: branch `codex/discover-location-indicators-v2` adds display-only Discover card indicators for already-visible resources. The Worker endpoint accepts compact hard/soft resource refs and an optional searched postal context, then returns only boolean flags keyed by those resource refs. The client decorates the already-ordered displayed card list and renders an original glossy yellow-orange circle with a white filled star and/or public-safe recommendation pill without changing ranking, sorting, filtering, visibility, access rules, saved-map behavior, or the existing distance pill. The national `Singapore / SIN` Region is ignored for indicator relevance so it cannot make all SG resources appear recommended.
- Known-good reference: clean GitHub `origin/main` at `b7af05c4` plus approved design spec `docs/superpowers/specs/2026-05-29-discover-location-indicators-design.md`. Archived attempt `e8cf4913` was used as reference only, not restored wholesale.
- Reproduction steps: load `/discover` as guest and signed-in user; search by postal code; compare card order/counts before and after indicator fetch; confirm cards within the signed-in user's home Region can show `Recommended for you`, cards within the searched postal Region can show `Recommended for this location`, and resources within matching Audience Zone context can show only the star icon.
- Acceptance criteria: indicator fetch failures fall closed to no badges; endpoint responses expose no saved profile postal code, searched postal code, Region IDs, Audience Zone IDs, zone names, or internal labels; public UI does not say `Audience Zone`, `subregion`, `boundary`, or `service boundary`; national SG fallback coverage does not trigger `Recommended for you` or `Recommended for this location`; Phase 1 does not add exact Locate Me Region matching because reverse geocoding would require a separately approved geolocation/privacy path.
- Verification result: `node --test client/test/locationIndicators.test.js`, `node --test server/test/discoveryController.test.js`, `node --test server/test/discoveryLocationIndicators.test.js`, `node --test client/test/*.test.js` passed 72/72, `npm run test:server` passed 290/290, `npm run build:client` passed with the existing large chunk warning, and `npm run test:smoke` passed 5/5 against the Cloudflare Pages preview on 2026-05-29. `npx wrangler deploy --config wrangler.toml --dry-run` passed, then the Worker was deployed as version `14989a09-79f1-49e3-89d7-60248b283a96`; `POST /api/discovery/location-indicators` returned 200 JSON for empty input and real public resource refs, with only boolean indicator fields and no postal code, Region ID, Audience Zone ID, zone name, or internal wording in the response.
- Follow-up result: after the SG Region was found to create blanket recommendations, `node --test server/test/discoveryLocationIndicators.test.js`, `node --test server/test/discoveryController.test.js server/test/discoveryLocationIndicators.test.js`, `node --test client/test/locationIndicators.test.js`, `node --test client/test/*.test.js`, `npm run test:server`, `npm run build:client`, and `git diff --check` passed on 2026-05-29. Worker version `c7cebace-1536-4227-a313-a1650dfcfc74` ignored national SG fallback coverage for indicators; the live Braddell resource `hard:17525` changed from `withinContextRegion: true` to `false` for Bukit Batok postal context `650386`.
- Visual polish result: the audience-zone star indicator was changed from a thin outline icon to an original flat brand-teal circle with a white filled star, using no external or watermarked asset. `node --test client/test/discoveryLocationIndicatorBadges.test.js`, `node --test client/test/*.test.js`, `npm run build:client`, and `git diff --check` passed on 2026-05-29.
- Soft-asset follow-up result: tied soft assets now inherit Audience Zone indicator relevance from their host hard asset or linked hard-asset locations, so host-place zones can produce the star on the soft card without changing ranking, sorting, filtering, or the distance pill. Normal visible soft-asset responses now hide exact saved-profile mismatches instead of returning a `This may not match your profile` notice; managed resource views keep operator access. UI follow-up: user-facing resource cards/details/shared-map lists no longer render the profile-match warning or missing-profile-details prompt at all, while backend visibility and access metadata remain unchanged. `node --test server/test/discoveryLocationIndicators.test.js`, `node --test server/test/eligibility.test.js`, `npm run test:server`, `node --test client/test/*.test.js`, `npm run build:client`, `npx wrangler deploy --config wrangler.toml --dry-run`, and `git diff --check` passed on 2026-05-29. Worker version `03260580-da7c-4157-a8d2-827ba4a362a6` returned `withinAudienceZone: true` for soft resource `soft:89` and host place `hard:18397` under postal context `681809`; production smoke passed 5/5 after one transient saved-asset setup rerun passed cleanly. Additional UI-only verification on 2026-05-29: `node --test client/test/offeringAccessNotice.test.js`, `node --test client/test/*.test.js`, and `npm run build:client` passed. Production confirmation for merge commit `03400ef9`: Cloudflare Pages completed successfully, the live bundle `https://app.carearound.sg/assets/index-DWuLvOke.js` did not contain the removed profile-warning strings, and `npm run test:smoke` passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.
- Locate Me follow-up result: Locate Me can now supply a temporary coordinate context to the existing Discover location-indicator Worker endpoint, which reverse-geocodes the coordinate server-side into a postal context for Region/Audience Zone matching and returns only the existing boolean indicator fields. This is display-only: it does not save a profile postal code, does not link the user to a Region, does not change Admin scope, does not change resource Owner/Staff access, and does not change Discover ranking, filtering, visibility, saved-map behavior, or the distance pill. Searched postal-code context still uses the explicit postal code, while home/profile postal context still produces `Recommended for you` without sending it as a searched-location context. The national `Singapore / SIN` Region remains ignored for indicator relevance, and the endpoint is rate-limited to protect the reverse-geocode path.
- Locate Me follow-up reproduction steps: load `/discover`, use profile/home postal browsing, searched postal-code browsing, and Locate Me; compare card order/counts before and after indicator fetch; confirm searched postal and Locate Me contexts can show `Recommended for this location`, profile/home context can show `Recommended for you`, matching Audience Zone context can show the star icon, and no user/profile/Region/IAM assignment changes occur.
- Locate Me follow-up acceptance criteria: indicator responses expose no saved profile postal code, searched postal code, derived postal code, exact coordinates, Region IDs, Audience Zone IDs, zone names, or internal labels; invalid or non-Singapore coordinates fall closed to no location-context badges; reverse-geocode failure falls closed without blocking Discover results; public UI still avoids `Audience Zone`, `subregion`, `boundary`, and `service boundary`; Locate Me remains a temporary search context only.
- Locate Me follow-up verification result: `node --test server/test/discoveryController.test.js server/test/discoveryLocationContext.test.js server/test/discoveryLocationIndicators.test.js`, `node --test client/test/locationIndicators.test.js`, `npm run test:server`, `node --test client/test/*.test.js client/src/lib/*.test.js`, `npm run build:client`, and `git diff --check` passed on 2026-06-06. `npm run build:client` retained the existing large chunk warning.
- Locate Me follow-up release result: commit `f4d8a874` deployed the Worker as `senior-resource-map-api` version `11cca18b-8dab-4832-baf0-426a4555ecd6`; Cloudflare Pages deployed `https://d9c6d318.senior-resource-map.pages.dev`; the production custom domain served `assets/index-XTh0z5-H.js`; production API health returned OK; a dummy `POST /api/discovery/location-indicators` returned `{ "indicators": {} }`; direct production indicator probes returned matching Region booleans for both explicit postal and temporary coordinate context, and invalid non-Singapore coordinates fell closed to false booleans. Pre-deploy production smoke passed 5/5. Post-deploy smoke repeatedly passed 4/5 with the remaining failure in the smoke helper's saved-resource setup for Create Map/Saved Detail, while a targeted create-map rerun passed; no failing smoke evidence pointed at the Locate Me indicator path, Discover loading, dashboard resources, postal import, or the Worker health path.

### 2026-05-29 Discover desktop search-panel expansion

- Current behavior: the desktop Discover search panel still auto-collapses while browsing results, and the existing `Edit search` filter button still expands it. When collapsed, the panel also expands if the user scrolls back to the first/top result card and continues pulling upward/downward toward the search panel, or if the user pulls down/wheels upward over the collapsed search summary itself.
- Known-good reference: approved user request on 2026-05-29 to add two non-button expand behaviors without changing search results, filters, ranking, sorting, map pins, saved assets, or the distance pill.
- Reproduction steps: open `/discover` at desktop width; scroll down the result list until the full search panel collapses into `CURRENT SEARCH`; scroll or wheel back to the top result card and continue upward to confirm the full panel reopens; collapse it again and wheel upward/pull down over the collapsed summary to confirm the same expansion; confirm `Edit search` still expands directly.
- Acceptance criteria: expansion is desktop browse-mode only; mid-list upward scrolls do not reopen the panel; top-card sticky-header offset still counts as being at the top; no search/filter data changes occur.
- Verification result: `node --test client/test/discoverySearchPanelBehavior.test.js`, `node --test client/test/*.test.js`, `npm run build:client`, and `git diff --check` passed on 2026-05-29. Local browser verification against `http://localhost:5173/discover` with production API fallback confirmed collapse on downward results scroll, expansion from top-result upward wheel, and expansion from collapsed-summary upward wheel.

### 2026-05-29 UI translation coverage refresh

- Current behavior: all static UI dictionary keys now exist for English, Mandarin, Malay, and Tamil. Recent user-facing labels from auth handoff/WhatsApp, Discover indicators and map controls, dashboard navigation/profile pilot controls, saved-resource buttons, membership linking, shared-map/My Map notes, and mobile directory workspace use the shared locale helper instead of falling back to hardcoded English.
- Follow-up: Discover cards now localize the short Get directions button, and hard-asset programme/service/promotion count labels in Discover cards and resource detail tabs use translated display labels while keeping the underlying bucket values unchanged.
- Known-good reference: user request on 2026-05-29 to make sure translations are applied and updated after recent enhancements.
- Reproduction steps: switch the top-nav language selector between English, Mandarin, Malay, and Tamil; open login/register, WhatsApp sign-in fallback, Discover, dashboard profile, My Directory/My Maps, shared maps, and membership linking; check that static UI labels on those user-facing surfaces change with the selected language.
- Acceptance criteria: translated locales define the same UI key set as English; recent user-facing UI keys do not fall back to English; Discover/resource cards do not hardcode the short directions label; programme/service/promotion count labels localize on cards and resource detail tabs; admin/resource-management operational pages and legal baseline text remain English unless separately reviewed because the multilingual foundation already records those deeper/regulated surfaces as accuracy-sensitive.
- Verification result: `node --test client/test/i18nCoverage.test.js client/test/i18n.test.js`, `node --test client/test/*.test.js` passed 85/85, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-05-29. Follow-up verification on 2026-05-29: `node --test client/test/i18nCoverage.test.js` passed 3/3, `node --test client/test/*.test.js` passed 86/86, and `npm run build:client` passed with the existing large chunk warning.

### 2026-05-25 Offering contact field parity

- Current behavior: create/edit offering and Import Material review rows expose the same public contact/action fields: Contact phone, WhatsApp contact, Contact email, Action button label, Action button link, and Venue note. Collateral import prompts, review matching, grouped extraction rows, create payloads, and update payloads now preserve `whatsappContact` the same way as the other optional offering contact fields.
- Known-good reference: user report on 2026-05-25 that create-new offering and import-offering review had drifted: create/edit showed WhatsApp contact but not email/CTA, while import review showed email/CTA but not WhatsApp.
- Reproduction steps: open `/dashboard/resources`, create or edit an offering, then run Import Material review for a host place and compare the public contact/action fields. Refresh an existing offering with a changed WhatsApp contact and confirm the import review reports the field diff; leave imported WhatsApp blank and confirm refresh preserves the existing value.
- Acceptance criteria: both manual create/edit and import review have the same public contact/action field set; import extraction can request and group WhatsApp contact; import matching includes WhatsApp diffs; create/update commit payloads save WhatsApp contact without changing database schema or discovery contact rendering.
- Verification result: `node --test client/test/*.test.js` passed 65/65, `npm run test:server` passed 286/286, `npm run build:client` passed, and `git diff --check` passed on 2026-05-25.

### 2026-05-20/21 Restricted notes/files read-only viewer hardening

- Current behavior: additional restricted-content viewers are read-only grants for Region Admins and active unrelated asset Owners/Staff only; normal users are not selectable and stale grants stop working once a user loses the role/access that made them eligible. Region Admin eligibility comes from the role plus explicit grant, not from matching the asset's Region. Candidate loading uses explicit joins so Drizzle's multiple user relations for staff creator/updater fields cannot collapse the dropdown into an empty list. The `All eligible read-only viewers` dropdown action expands to the current eligible candidates and stores explicit user grants; it is not a future-facing wildcard.
- Known-good reference: user clarification on 2026-05-20 that Additional viewers must still exist for Region Admins and unrelated Owners/Staff, but normal users must not be assignable and removed Owner/Staff privileges must not leave restricted-content access behind.
- Reproduction steps: edit a place or offering restricted-content panel; open the additional read-only viewer selector; add a Region Admin and an unrelated active operator; then revoke a previously granted operator's access and test the protected content/file route again.
- Acceptance criteria: same-resource editors already manage content and are excluded from the read-only selector; Region Admins and active unrelated hard/soft asset operators can be selected individually or via the current-candidate `All` action; Region Admins do not need to match the asset's Region because the grant is explicit and read-only; normal users, revoked operators, and stale grant holders cannot read restricted notes/files; public snapshots remain free of restricted fields.
- Verification result: `node --test client/test/privateResourceAccess.test.js`, `node --test client/test/*.test.js`, `node --test server/test/privateResourceContent.test.js`, `npm run test:server`, and `npm run build:client` passed on 2026-05-21.

### 2026-05-20 Translation workflow streamline

- Current behavior: dashboard translation review can fill missing or outdated text for Mandarin, Malay, and Tamil in one action while keeping the existing single-language refresh and manual review controls.
- Known-good reference: user request on 2026-05-20 to avoid running the translation workflow one language at a time.
- Reproduction steps: edit a saved place, offering, or template with English text; open Translation review; click `Fill all missing text`; then check each language card and field editor.
- Acceptance criteria: one action sends all target locales to the existing regenerate endpoint; the UI shows a concise result summary; staff-edited or reviewed wording is not overwritten or auto-approved; individual language refresh and save-review still work.
- Verification result: `node --test client/test/*.test.js` passed 49/49, `node --test server/test/resourceTranslations.test.js` passed 7/7, and `npm run build:client` passed on 2026-05-20.

### 2026-05-20 Dashboard logo-frame containment

- Current behavior: dashboard resource, offering, and template logo thumbnails use fixed frames with contained image fitting, so wide or tall uploaded logos remain fully visible instead of being cropped by the frame.
- Known-good reference: user report on 2026-05-20 showing wide organization logos overflowing/cropping in `/dashboard/resources`.
- Reproduction steps: open `/dashboard/resources` with resources that use wide, tall, and square logos; check place cards, offering cards, and template cards.
- Acceptance criteria: logos stay inside their visible frame, preserve aspect ratio, and do not alter card spacing; banner images remain cropped separately because banners intentionally fill their hero area.
- Verification result: `npm run build:client` passed and `git diff --check` passed on 2026-05-20.

### 2026-07-13 AI cost-control release

- Current behavior: AI import uses direct Gemini by default when configured, grounded AI enrichment is explicitly disabled in production unless `GROUNDED_AI_ENABLED=true`, and repeated AI import/enrichment calls use Worker KV-backed cache/counter keys when `MAP_CACHE` is available. Translation uses dedicated `GOOGLE_TRANSLATE_*` credentials before the legacy Vertex-named fallback.
- Known-good reference: user-confirmed Google Cloud billing budget on 2026-07-13, Cloudflare Worker secret-name check confirming `GEMINI_API_KEY` and dedicated `GOOGLE_TRANSLATE_*` secrets, and `docs/ai-cost-control-stack.md`.
- Reproduction steps: run focused AI/import tests; run full server tests; build the client with `VITE_API_URL=https://api.carearound.sg/api`; deploy Worker and Pages; confirm Worker bindings show `AI_IMPORT_PROVIDER=gemini`, `GROUNDED_AI_ENABLED=false`, and `MAP_CACHE`; confirm production API health and custom-domain bundle; run production smoke.
- Acceptance criteria: grounded AI web fallback is blocked by default; collateral import prefers Gemini unless explicitly set to Vertex; daily quota and cache controls work with Worker KV; public Discover, dashboard resources, import wizard, create-map, saved-resource detail, auth/session, translation review, public visibility, and saved-map behavior remain stable.
- Verification result: `npm run test:server` passed 405/405 before release and again after the production Worker variable alignment; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; `git diff --check` passed; Cloudflare Worker `senior-resource-map-api` deployed version `bfeaffb9-a30c-4058-b98d-f03ba63fbf61` with `AI_IMPORT_PROVIDER=gemini`, `GROUNDED_AI_ENABLED=false`, and `MAP_CACHE`; Cloudflare Pages branch preview deployed `https://b748152c.senior-resource-map.pages.dev` with alias `https://codex-ai-cost-governor.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://c34e14cc.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-DdUQLiMS.js` and `assets/index-gdJR9SuY.css`; production API health returned OK at `2026-07-13T14:19:43.852Z`; the first smoke run passed with one retried partner-dashboard check, and the full production smoke rerun passed 5/5 using `SMOKE_BASE_URL=https://app.carearound.sg` and `SMOKE_API_BASE=https://api.carearound.sg/api` without printing smoke credentials. No schema bootstrap, production data mutation, auth/session change, postal validation change, public visibility change, Gmail/email change, GudAuth secret change, or secret rotation was performed.

### 2026-07-18 Gemini collateral model availability recovery

- Current behavior: direct Gemini collateral preview uses `gemini-3.1-flash-lite`; the model is explicit in the Worker configuration and remains the server default when no override is supplied. Grounded AI remains disabled and preview remains review-only.
- Known-good reference: implementation commit `61e90a493` on pushed `main`, production Worker version `42507ea8-951f-418a-899b-645e2d163406`, and signed-in production UAT with `TWV-July-Eng.jpeg` for REACH-SLEC Active Ageing Centre @ Teck Whye Vista.
- Reproduction steps: configure a valid `GEMINI_API_KEY`, `AI_IMPORT_PROVIDER=gemini`, `GEMINI_API_MODEL=gemini-3.1-flash-lite`, and `GROUNDED_AI_ENABLED=false`; open `/dashboard/resources`; upload the reference image; select Preview extracted offerings while tailing the Worker.
- Acceptance criteria: preview returns HTTP 200 without creating or updating records; the review screen renders extracted rows; the Worker does not call the unavailable `gemini-2.5-flash-lite` model; auth, visibility, translation, grounded-search, and commit behavior are unchanged.
- Verification result: the prior production request on Worker `adef30fb-b8db-41b3-8cae-7c486163fd0e` returned HTTP 404 because Google no longer made `gemini-2.5-flash-lite` available to the new key. After the production model variable was changed, Worker `c418c468-290c-40e6-9a59-905a9acda535` returned HTTP 200 in 8.1 seconds with no Worker logs or exceptions, and the client rendered 26 review rows. Focused AI import tests passed 13/13, the full server suite passed 439/439, and `git diff --check` passed before release. Implementation commit `61e90a493` was pushed to the recovery branch and fast-forwarded into pushed `main`; the guarded Worker deploy produced `42507ea8-951f-418a-899b-645e2d163406` with the expected Gemini model binding. Production API health returned OK at `2026-07-18T08:11:20.401Z`, post-deploy smoke passed 6/6, and the post-deploy collateral-preview request returned HTTP 200 in 3.2 seconds with no Worker logs or exceptions. Save reviewed rows was not selected, so no production resource data changed.

### 2026-07-18 Collateral schedule first-cut and review workspace

- Current behavior in the release candidate: collateral extraction requests
  explicit individual or weekly Singapore-time schedule rows in addition to
  the source schedule text. Every proposed row passes through the canonical
  Offering schedule validator before it reaches the review UI. Invalid or
  empty cached placeholders are removed, the extraction cache key carries a
  versioned contract, and free-text parsing is used only when the AI returns no
  valid structured rows. The review list labels only validated rows as ready;
  Programme rows without reliable dates show a manual-review recovery state.
  At ordinary desktop widths below 1536 px, the host and batch summary move
  above the review list so the Offering and schedule controls receive the full
  workspace width. The two-column summary rail remains available on very wide
  screens, and Duplicate, Remove, Collapse, and Expand controls keep at least
  44 px touch height.
- Known-good reference: branch
  `codex/collateral-import-schedule-first-cut`, based on pushed production
  `main` after the Gemini model recovery and Care Calendar planning release.
  The reference material is `TWV-July-Eng.jpeg` for REACH-SLEC Active Ageing
  Centre @ Teck Whye Vista; the existing production preview returned 26 rows
  but showed an empty schedule placeholder inside a 448 px review card at a
  1470 px viewport.
- Reproduction steps: sign in, open `/dashboard/resources`, search for the
  REACH-SLEC Teck Whye Vista Place, select Import Material, upload the reference
  image, and preview without saving. Confirm exact calendar cells produce
  populated individual rows, explicit recurring series produce weekly rows,
  and unclear source wording stays visible for manual review without creating
  a placeholder. Review the same output at 390, 768, 1024, 1470, and 1536 px.
- Acceptance criteria: extracted dates and times are first-cut proposals and
  never bypass staff review; no date, year, time, weekday, or recurrence
  boundary is invented; invalid rows cannot be published; a blank or
  unparseable import still cannot clear an existing schedule; structured rows
  remain the canonical input when present so a recurrence end date cannot be
  misread as a separate session; Services and Promotions without schedules are
  not incorrectly flagged as missing Programme schedules; no horizontal
  overflow or cramped two-column schedule inputs appear at the reported 1470
  px desktop size. Auth, access, visibility, matching, saved resources,
  Offering revision guards, Care Calendar planning, My Maps, Shared Maps,
  notifications, schema, secrets, and production data remain unchanged.
- Verification and deployment result: focused collateral, Offering schedule,
  matching, review-source, contact-parity, and Offering-wizard coverage passed
  52/52. Full server coverage passed 442/442; full client/source coverage
  passed 434/434; the exact production-configured map-enabled client build
  passed and produced candidate `assets/ResourcesPage-C9FvpeZx.js` and
  `assets/index-CvQOOpB_.css`; and `git diff --check` passed. The first focused
  run caught a recurrence boundary being parsed as a separate one-time session;
  the corrected implementation now suppresses text fallback whenever validated
  structured rows are present. Implementation commit `0ff5964c7` was pushed to
  `main`, the Worker deployed as version
  `49bcdd9f-489c-4f7c-826c-f076efa60f5e`, and Cloudflare Pages deployed
  `https://5f69cb4b.senior-resource-map.pages.dev`. Production custom domain
  `https://app.carearound.sg` served `assets/index-BUCrPSUa.js`,
  `assets/ResourcesPage-C9FvpeZx.js`, and `assets/index-CvQOOpB_.css` with
  both W01 map asset-base markers preserved. Production API health returned OK
  at `2026-07-18T13:26:23.912Z`, and production smoke passed 6/6. Production
  collateral preview was attempted read-only for additional evidence, but the
  ad hoc verifier stopped at automated login rather than the import route; no
  Save reviewed rows action or resource mutation was performed.

### 2026-07-18 Collateral calendar text-to-schedule recovery

- Current behavior: collateral extraction uses a
  two-stage schedule path. The AI still performs the visual/text pass and
  preserves visible calendar context such as `July 2026`, row time text, and
  date bullets. The server then deterministically converts safe text patterns
  like `9.30AM - 10.30AM` plus `6/7, 13/7, 20/7, 27/7` into individual
  Singapore-time schedule rows before the review UI opens. The AI cache
  contract is versioned to `3` so production does not reuse the previous
  no-schedule extraction result.
- Known-good reference: user production screenshot on 2026-07-18 showing the
  deployed import review still reporting `Schedules ready 0` and `Need schedule
  review 26` for `TWV-July-Eng.jpeg`, despite the flyer clearly containing July
  2026 programme time ranges and date bullets.
- Reproduction steps: sign in, open `/dashboard/resources`, choose Import
  Material for the relevant host, upload `/Users/sweetbuns/Downloads/TWV-July-Eng.jpeg`,
  and preview without saving. Inspect Zumba Gold and similar programme rows
  whose extracted schedule text uses a time line followed by shorthand date
  bullets.
- Acceptance criteria: exact row text with visible month/year context produces
  individual reviewed schedule rows; dot-separated times such as `9.30AM` parse
  safely; same-line date bullets produce multiple rows; shorthand dates without
  a year context remain manual-review text; invalid dates stay unparsed; an
  import with no valid rows still cannot clear an existing schedule. Auth,
  access, visibility, saved resources, Care Calendar planning, matching,
  schema, secrets, and production data remain unchanged.
- Verification and deployment result: focused parser and collateral coverage
  passed 31/31. Full server coverage passed 446/446, including workbook
  schedule round-trip, collateral import, AI cache, saved-resource, and Worker
  release-line guards. `git diff --check` passed. Implementation commit
  `d1a1718f0` was pushed to `main`, and the Worker deployed as version
  `4c21ed1e-77e7-4992-9f57-9447b09937d5`. Production API health returned OK at
  `2026-07-18T14:09:48.271Z`, and production smoke passed 6/6 after deploy.
  No client code, Pages bundle, schema, secret, auth, or production data change
  was included; production custom domain remained on `assets/index-BUCrPSUa.js`
  and `assets/index-CvQOOpB_.css`.

### 2026-07-18 Collateral weekday-range schedule parsing

- Current behavior: collateral extraction also recognizes visible monthly
  programme schedules written as weekday ranges with one or more time windows.
  For example, when the row inherits a visible context such as `JULY 2026`,
  `Mon to Wed & Fri: 9AM - 12PM, 1.30PM - 5PM` becomes two bounded weekly
  reviewed rows for Monday, Tuesday, Wednesday, and Friday, and
  `Thurs: 1.30PM - 5PM` becomes a bounded Thursday weekly row. The repeat
  boundary is the visible calendar month. The same weekday text without a
  month/year context remains manual-review text.
- Known-good reference: user production screenshot on 2026-07-18 showing the
  remaining manual-review row from `TWV-July-Eng.jpeg` with source wording
  `Mon to Wed & Fri: 9AM - 12PM, 1.30PM - 5PM` and
  `Thurs: 1.30PM - 5PM`.
- Reproduction steps: sign in, open `/dashboard/resources`, choose Import
  Material for the relevant host, upload `/Users/sweetbuns/Downloads/TWV-July-Eng.jpeg`,
  and preview without saving. Inspect the Board Games row. Confirm the row
  proposes three reviewed weekly rows when the July 2026 heading is present,
  and confirm the same wording without a month/year context stays in manual
  review.
- Acceptance criteria: weekday aliases and weekday ranges parse only when the
  source also provides a visible month/year context; multiple printed time
  windows become separate reviewed rows; repeat boundaries are bounded to the
  visible month; no weekday, month, year, or repeat boundary is invented; an
  import with no valid rows still cannot clear an existing schedule. Auth,
  access, visibility, saved resources, Care Calendar planning, matching,
  schema, secrets, client bundles, and production data remain unchanged.
- Verification and deployment result: focused Offering schedule and collateral
  import coverage passed 34/34. Full server coverage passed 449/449, including
  workbook schedule round-trip, collateral import, AI cache, saved-resource,
  and Worker release-line guards. `git diff --check` passed. Implementation
  commit `c4f7529fe` was pushed to `main`. Follow-up commit `f7b0dcaa0` bumped
  the collateral extraction cache contract to `4` so old cached review output
  cannot preserve the prior manual-review result. The Worker deployed as
  version `9467218c-4e17-4cca-a630-50bd4e916ab5`. Production API health
  returned OK at `2026-07-18T14:46:22.468Z`. The first production smoke attempt
  passed public load but stopped because smoke credentials were not exported;
  rerunning with local `smoke.env` passed production smoke 6/6, and the final
  post-cache-bump production smoke also passed 6/6. No client code, Pages
  bundle, schema, secret, auth, or production data change was included.

### 2026-07-18 Collateral incomplete-schedule extraction recovery

- Current behavior: the primary Gemini collateral schema requires the visible
  calendar context, source schedule text, session lines, and schedule-entry
  fields instead of allowing a name-only row to count as a complete
  extraction. If a multi-programme calendar still returns at least three
  Programme rows with no schedule evidence at all, the Worker performs one
  quota-counted, schedule-only transcription pass over the same collateral.
  That pass preserves exact printed month/year, time, date-bullet, and weekday
  wording; the existing deterministic parser remains responsible for creating
  validated Singapore-time review rows. An empty or failed rescue is not
  cached, so one weak model response cannot pin a no-schedule preview for the
  cache lifetime. Save reviewed rows and all publish/replacement safeguards are
  unchanged.
- Known-good reference: user production screenshot on 2026-07-18 after the
  cache-contract `4` rollout showing a fresh `TWV-July-Eng.jpeg` preview with
  26 extracted names at 50% confidence but `Schedules ready 0` and `Need
  schedule review 26`. The regression occurred because the model omitted
  optional schedule fields and the server accepted and cached the name-only
  batch.
- Reproduction steps: sign in, open `/dashboard/resources`, choose Import
  Material for REACH-SLEC Active Ageing Centre @ Teck Whye Vista, return to the
  upload step with `/Users/sweetbuns/Downloads/TWV-July-Eng.jpeg`, and select
  Preview extracted offerings without saving. Confirm the batch summary shows
  all 26 rows ready, Zumba Gold shows four dated rows, and Board Games shows
  three bounded weekly rows for its two weekday lines and split time windows.
- Acceptance criteria: a name-only multi-programme calendar triggers the
  focused schedule transcription; exact source wording is matched only to the
  same normalized Offering name; deterministic validation still rejects
  missing context, invalid dates, and invented schedule data; a rescue failure
  returns reviewable rows with a warning and is not cached; repeated successful
  previews use the normal cache; no reviewed row is saved automatically. Auth,
  access, visibility, matching, Offerings, schedule revision guards, Care
  Calendar, saved resources, My Maps, Shared Maps, schema, secrets, client
  bundles, and unrelated production data remain unchanged.
- Verification and deployment result: focused Offering schedule and collateral
  import coverage passed 36/36, including name-only rescue, weekday-range
  parsing, incomplete-result no-cache behavior, and normal successful caching.
  Full server coverage passed 451/451. The exact production-configured,
  Detailed-map-enabled client build passed with the existing large-chunk
  advisory, and `git diff --check` passed. Implementation commit `b014c4187`
  was pushed to `main`; cache contract `5` invalidates the incomplete contract
  `4` result. The Worker deployed as version
  `a522111b-b161-419c-8e50-6eb0a4105976`. Production API health returned OK at
  `2026-07-18T15:08:03.543Z`, and production smoke passed 6/6. Signed-in,
  read-only production UAT against the retained TWV upload returned 26
  schedules-ready rows and 0 schedule-review rows; Zumba Gold contained four
  correct July sessions and Board Games contained three weekly rows. Save
  reviewed rows was not selected, so no Offering, schedule, or personal
  calendar data changed. No client deploy, schema, secret, or auth change was
  included.

### 2026-05-20 AI enrichment logo selection recovery

- Current behavior: website logo metadata now treats separators like `_` as valid logo filename boundaries, so organization logo files such as `LOGO_NLCS...` and `NLCS-Logo...` win over generic service carousel or award images.
- Known-good reference: local live `/api/hard-assets/import/enrich-draft` probe for `New Life Community Services Active Ageing Centre (Care) @Jelapang` returned the New Life organization logo path instead of the charity transparency award carousel graphic.
- Reproduction steps: enrich a place draft with name `New Life Community Services Active Ageing Centre (Care) @Jelapang`, postal code `670526`, and category `Active Ageing Centre (AAC)`; check that the logo does not use `Homepage_Carousel_CC-01.png`.
- Acceptance criteria: website metadata prefers organization logo filenames and site/header/nav logo hints; lower-confidence service/programme/carousel/award/certification images remain fallback-only; AI enrichment still returns the other grounded fields.
- Verification result: `node --test server/test/websiteMetadata.test.js` passed 4/4, focused enrichment suite passed 17/17, and local live New Life probe returned website, phone, hours, description, social links, and the organization logo path on 2026-05-20.

### 2026-05-20 AI enrichment SASCO fallback recovery

- Current behavior: `SASCO@Khatib` drafts use an official SASCO contact fallback for stable address, phone, website, description, services, and logo selection when the first grounded AI pass returns only contact, hours, social links, or tags.
- Known-good reference: local live `/api/hard-assets/import/enrich-draft` probe for `SASCO@Khatib` returned the SASCO contact-backed address, website, phone, hours, description, services, social links, and `SASCO-Site-Logo.png` instead of an inline lazy-load placeholder.
- Reproduction steps: enrich a place draft with name `SASCO@Khatib`, postal code `760813`, address `Singapore 760813`, and category `Active Ageing Centre (AAC)`.
- Acceptance criteria: partial AI output is merged with the official SASCO fallback; inline `data:image` placeholders are not returned as logos; metadata prefers the real SASCO site logo where available.
- Verification result: `node --test server/test/hardAssetsEnrichment.test.js` passed 7/7, `node --test server/test/websiteMetadata.test.js` passed 6/6, and a local live SASCO probe returned address, website, phone, hours, description, services, social links, and the SASCO site logo on 2026-05-20.

### 2026-05-20 AI enrichment All Saints fallback recovery

- Current behavior: All Saints Silver Lifestyle Club drafts use an official-directory fallback for stable address, contact, website, service, and description fields when the first grounded AI pass is partial; website logo metadata prefers the All Saints site brand image over generic page/service images.
- Known-good reference: local live `/api/hard-assets/import/enrich-draft` probe for `All Saints Silver Lifestyle Club @ Yishun Fern Grove` returned official fallback details and `WeCARE-All-saints-home.png` instead of `nursing-home-5.png` or other generic page images.
- Reproduction steps: enrich a place draft with name `All Saints Silver Lifestyle Club @ Yishun Fern Grove`, postal code `760674`, address `Singapore 760674`, and category `Active Ageing Centre (AAC)`.
- Acceptance criteria: enrichment returns address, website, phone, description, service tags, and a brand logo; partial AI output with only contact/tags or a generic image is merged with the official fallback instead of being treated as complete.
- Verification result: focused website metadata and hard-asset enrichment tests passed, and a local live All Saints probe returned address, website, phone, hours, description, 8 services, social links, and the All Saints brand image on 2026-05-20.

### 2026-05-19 Place enrichment quality recovery

- Current behavior: place enrichment keeps flyer/programme extraction untouched while improving hard-place enrichment with richer grounded output, official social-link preservation, validated logo metadata, and a fallback from tags-only AI output to a deeper grounded search.
- Known-good reference: local live `/api/hard-assets/import/enrich-draft` probe for `Precious Active Ageing Centre (Sunshine Gardens)` returned official website/source, phone, operating hours, description, logo present, service tags, and Facebook/Instagram links with no Google Maps preview logo.
- Reproduction steps: enrich a place draft with name `Precious Active Ageing Centre (Sunshine Gardens)`, postal code `682488`, address `Singapore 682488`, and category `Active Ageing Centre (AAC)`; also test a Google Places result that has only a Maps URL and static-map preview metadata.
- Acceptance criteria: Vertex requests with Search grounding omit controlled-generation schema and JSON mode; tags-only AI results do not block deeper enrichment; supported social links are merged from AI output or the source page; Google Maps pages are not scraped for logos; Maps static preview images stay out of `logoUrl`.
- Verification result: focused enrichment suite passed 16/16, local live probe returned rich Precious AAC fields, and `npm run test:server` passed 247/247 on 2026-05-19.

### 2026-05-18 Resource detail social-link restore

- Current behavior: hard assets carry `social_links` again, dashboard/import/enrichment flows preserve supported social channels, and resource detail cards render ordinary Website links separately from Social channels.
- Known-good reference: April 2026 archived CareAround implementation that previously included `hard_assets.social_links`, social-link helpers, import extraction, asset-form editing, and detail-card rendering.
- Reproduction steps: create or edit a hard asset with supported social links; open the resource detail card; confirm supported channels render; enter a social URL in Website and confirm it is shown as a social channel.
- Acceptance criteria: supported social links are normalized, unsupported domains are ignored, ordinary websites remain usable, social-only website entries are split into Social channels, and production schema bootstrap adds `hard_assets.social_links` before Worker deploy.
- Verification result: `node --test client/test/*.test.js` passed 37/37, `npm run test:server` passed 235/235, and `npm run build:client` passed on 2026-05-18.

### 2026-05-16 Auth session and stale WhatsApp attempt hotfix

- Current behavior: `/auth/me` session validation uses only the cookie-owning API origin, so a transient failure on `api.carearound.sg` cannot fall through to a different origin that lacks the session cookie and falsely clear the signed-in user.
- Known-good reference: production report on 2026-05-16 where random fallback behavior showed zero resources, empty saved assets, and redirects back to login/signup after the user had already signed in.
- Reproduction steps: sign in, keep `/discover`, `/dashboard/resources`, `/dashboard/admin`, `/my-directory`, and `/dashboard/profile` open across focus/visibility changes, then confirm session checks do not switch to the worker fallback origin for cookie auth.
- Acceptance criteria: signed-in users remain signed in unless the primary session endpoint definitively returns an invalid or missing token; successful email, Google, or phone sign-in clears stale stored WhatsApp login attempts so the login page does not re-open an old signup-required state.
- Verification result: `node --test client/test/*.test.js` passed 26/26, `npm run build:client` passed, `npm run test:server` passed 223/223, and production public smoke for `/` -> `/discover` passed on 2026-05-16. Full credentialed smoke was blocked because smoke credentials were not set in the shell.

### 2026-07-02 WhatsApp phone-login attempt verifier

- Current behavior: public WhatsApp phone-login polling and phone-first signup completion require both the serial attempt id and a browser-held high-entropy attempt verifier. The server stores only a SHA-256 verifier hash on `phone_login_attempts`; id-only poll or signup calls fail before provider polling, session issuance, or account creation.
- Known-good reference: Codex Security finding `occ_4a70bc471388b34ce5d5bef0` for public phone-login attempt-id replay, plus the locked WhatsApp phone-login and Auth session continuity rows above.
- Reproduction steps: start WhatsApp sign-in from `/login` or `/register`, confirm the initiating browser can poll and resume the attempt after the GudAuth return, then attempt to poll or complete signup with only `/api/auth/phone/:attemptId` and no verifier.
- Acceptance criteria: the initiating browser can still complete existing verified-phone login and guided phone-first signup; stale stored attempts without a verifier are ignored; missing or wrong verifier returns a safe failure; raw `users.phone` is still not trusted; no Gmail/email, Google login, profile phone-linking, Discover, My Directory, dashboard resource, or secret behavior changes.
- Verification result: `node --test server/test/phoneLogin.test.js server/test/phoneIdentitySchema.test.js client/test/phoneLoginAttemptStorage.test.js` passed 27/27, `npm run test:server` passed 383/383, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 366/366, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning on 2026-07-02.

### 2026-05-30 Admin Tools selected-user view stability

- Current behavior: when a Super Admin opens another user's account from Admin Tools, the selected-user session token is preserved across transient `/auth/me` failures. Temporary network, timeout, or server failures no longer clear the selected-user token and then re-check with the normal Super Admin cookie. Definitive expired or invalid selected-user tokens can still exit back to the normal Super Admin session.
- Known-good reference: 2026-05-30 production report where newly opened selected-user tabs intermittently returned to `GudPerson` instead of staying in the selected user's account.
- Reproduction steps: sign in as Super Admin, open Admin Tools, enter another user's account in a new tab, then simulate or observe a temporary selected-user `/auth/me` failure during initial load, focus, or refocus.
- Acceptance criteria: transient selected-user session failures must not silently switch identity back to the Super Admin account; existing normal-session preservation stays unchanged; expired/invalid selected-user tokens still clear safely; no auth, Gmail, email, GudAuth, or secret behavior changes.
- Verification result: `node --test client/test/authSession.test.js` passed 7/7, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 93/93, `node --test server/test/sessionAuth.test.js server/test/authController.test.js server/test/profileImpersonation.test.js` passed 9/9, `npm run test:server` passed 297/297, and `npm run build:client` passed with the existing large chunk warning on 2026-05-30. PR #18 merged as `8bfabd07`; Cloudflare Pages deployed `https://992a7911.senior-resource-map.pages.dev`, and the production custom domain served bundle `assets/index-ChTjqbm6.js`. Production health returned OK. Post-deploy smoke had two unrelated transient timeouts across two full runs, but the failed checks passed on targeted rerun: saved resource detail passed 1/1, partner login/resources passed 1/1, and the other full-run checks passed 4/5 each time.

### 2026-05-30 Admin organisation locked-control clarity

- Current behavior: Admin Tools organisation governance still blocks new access, linked resources, and agreement records while an organisation is Archived or Paused. Those sections now show inline guidance telling admins to set the Organisation profile status to Active or Draft and click Save Organisation before adding new records. Disabled search controls, selects, agreement fields, and submit buttons use visible disabled styling and explanatory titles instead of looking clickable but doing nothing. Existing access/resource/agreement removal and existing agreement editing remain available where they were already allowed.
- Known-good reference: 2026-05-30 production report that multiple Admin Tools organisation buttons and fields appeared unresponsive on an Archived organisation.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin`, switch to Organisations, choose an Archived or Paused organisation, then inspect Organisation access, Linked resources, and Agreement records. Change the Organisation profile status back to Active or Draft and save before adding new records.
- Acceptance criteria: the governance model remains unchanged; Archived/Paused organisations cannot receive new access, linked resources, or agreement records; controls for locked new-record actions visibly explain why they are disabled; the profile status selector and Save Organisation remain usable so admins can reopen the organisation; no auth, Gmail, email, GudAuth, Worker, or secret behavior changes.
- Verification result: `node --test client/test/governanceOrganizationUi.test.js` passed 4/4, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 97/97, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-05-30. PR #19 merged as `b7aa7a1a`; Cloudflare Pages deployed `https://eec03ae0.senior-resource-map.pages.dev`, and the production custom domain served bundle `assets/index-BQFrS5Iu.js`. Production health returned OK. A read-only production browser probe confirmed the Admin Organisations tab loaded for the smoke account; that account currently saw the selected organisation as open for new records, so archived-state live verification was limited to focused UI logic tests and build output rather than mutating production data.

### 2026-05-30 Admin organisation status pills

- Current behavior: Admin Tools organisation list cards show a compact status pill beside each organisation name. Active, Draft, Paused, and Archived statuses keep their existing governance meaning and now have distinct visual labels before the admin opens the profile form.
- Known-good reference: 2026-05-30 production screenshot request where the selected organisation profile showed Archived status, but the organisation list cards did not show status at a glance.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin`, switch to Organisations, and compare the organisation list cards against the selected Organisation profile status field.
- Acceptance criteria: every organisation list card shows the normalized governance status; selecting cards and saving organisation status continue to work; status pills do not grant or remove access, do not change locked-control behavior, and do not touch auth, Gmail, email, GudAuth, Worker, or secret behavior.
- Verification result: `node --test client/test/governanceOrganizationUi.test.js` passed 5/5, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 98/98, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-05-30. PR #20 merged as `c1148f5b`; Cloudflare Pages deployed `https://da272d00.senior-resource-map.pages.dev`, and the production custom domain served bundle `assets/index-DDy2fcPF.js`. Production health returned OK. A read-only production Chrome check confirmed the Admin Organisations list displayed `ARCHIVED` and `ACTIVE` status pills on organisation cards without changing data.

### 2026-05-30 Standalone offering detail cleanup

- Current behavior: public offering detail pages now use the offering's saved public Contact phone before falling back to legacy phone fields or linked-place phone. Standalone offerings with no linked places no longer show `Available at 0 places`, `Sorted nearest to ...`, or `No linked places are listed yet`. Banner images use an adaptive contained hero frame instead of a fixed-height cropped strip, while logo-only resources keep the prior contained logo frame.
- Known-good reference: 2026-05-30 production screenshots for `/resource/soft/166`, where the edit form showed Contact phone `6050 2080`, but the public detail card omitted it and displayed empty linked-place/sorting copy for a standalone offering.
- Reproduction steps: edit an offering with Contact phone and no linked places, save, then open `/resource/soft/:id` from the public detail route. Compare the public detail card with the edit form and inspect the banner frame.
- Acceptance criteria: Contact phone appears when saved on the offering; no empty linked-place or postal-sort copy appears for standalone offerings; linked offerings still show linked places and distance order when actual linked places exist; the banner remains responsive without cropping important image content; no auth, Gmail, email, GudAuth, Worker, or secret behavior changes.
- Verification result: `node --test client/test/resourceDetailPresentation.test.js` passed 4/4, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 102/102, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-05-30. PR #21 merged as `97d6e316`; Cloudflare Pages deployed `https://f2bc6c42.senior-resource-map.pages.dev`, and the production custom domain served bundle `assets/index-kkhouf5U.js`. Production health returned OK. A read-only production Chrome check on `/resource/soft/166` confirmed Contact phone `6050 2080` was visible, `Available at 0 places`, `Sorted nearest`, and `No linked places are listed yet` were absent, and the banner image used the adaptive contained hero class with a rendered height of about 411px.

### 2026-05-16 Production database source reconciliation

- Current behavior: repo-local database checks must use the same Neon database that serves `api.carearound.sg`; otherwise phone/login cleanup can appear correct locally while production still contains different users, attempts, and resource rows.
- Known-good reference: production `/api/hard-assets` and the confirmed live database both list `Fei Yue Active Ageing Centre (Sunshine Court)` as the newest hard asset, and the live database contains the recent WhatsApp login attempt sequence.
- Reproduction steps: run `npm run audit:db-fingerprint` and compare the non-secret counts/top hard assets against a fresh production `/api/hard-assets` response before any production data cleanup.
- Acceptance criteria: `server/.env` points at the confirmed live database; tracked scripts/config files do not contain database connection strings; future cleanup scripts print only non-secret database fingerprints/counts before mutating data.
- Verification result: local `server/.env` was reconciled to the confirmed live database on 2026-05-16, `server/migrate_regions.js` was changed to read `DATABASE_URL` from env, and Drizzle config was moved to env-backed `server/drizzle.config.js`.

### 2026-06-01 Dashboard resources managed-list pagination

- Current behavior: Super Admin managed resource list endpoints page directly at the database for dashboard first-page and retry loads. Hard-asset summary lists and soft-asset lists count matching rows, fetch only the requested page, and then format that page instead of hydrating and formatting the full managed dataset before returning.
- Known-good reference: 2026-06-01 production report that `/dashboard/resources` could sit on skeleton cards and then show zero resources after slow retry. Production timing probes showed public list endpoints taking multiple seconds, especially soft-asset list calls; the dashboard path was waiting for both hard and soft list calls before leaving loading state.
- Reproduction steps: sign in as Super Admin, open `/dashboard/resources`, wait for the default Places/Offerings/Templates counts and cards, then retry after a transient failure and run a simple managed search such as `thk`. Separately inspect a Staff user-view with only assigned places.
- Acceptance criteria: Super Admin managed hard summary and soft lists use database `count` plus `limit/offset` page fetches; dashboard counts remain accurate; the first page no longer depends on formatting the full managed dataset; public, Regional Admin, Staff, visibility-sensitive, comma/slash, and boundary-filter flows preserve their existing filtering-before-pagination behavior; no auth, Gmail, email, GudAuth, Worker secrets, export permissions, or visibility rules change.
- Verification result: red/green coverage added in `server/test/resourceListScope.test.js`; `node --test server/test/resourceListScope.test.js` passed 10/10, syntax checks passed for the touched controllers, `npm run test:server` passed 299/299, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-01. Production smoke initially passed 4/5 because the saved-resource-detail check waited for a full page load after a document navigation; production probing confirmed the saved detail link itself opened correctly, the smoke now waits for the resource detail route at `domcontentloaded`, targeted saved-resource smoke passed 1/1, and full production smoke passed 5/5 on 2026-06-02 before deploy. PR #33 merged as `500389e0`, Cloudflare Worker `senior-resource-map-api` deployed version `faa7cc06-2391-4f0c-ba4f-c0457055d339`, production API health returned OK, and post-deploy production smoke passed 5/5 on 2026-06-02.

### 2026-06-02 Direct asset staff resource-load stabilization

- Current behavior: standard users with direct Staff or Owner access to places or offerings load `/dashboard/resources` through a scoped managed-list path. Assigned places are filtered by their direct place IDs before count/pagination. Offerings are filtered to directly assigned offerings plus offerings linked to, or hosted by, assigned places before count/pagination. Direct staff permissions stay unchanged: they can work on assigned surfaces, but do not gain hide/delete/access-management powers unless their existing permission summary already allows those actions.
- Known-good reference: 2026-06-02 production report where the selected-user view for Hyqel Zainudin, a direct staff member for Precious Active Ageing Centre (Sunshine Gardens), repeatedly failed to load `/dashboard/resources` while broader organisation/admin behavior remained under separate review.
- Reproduction steps: sign in as Super Admin, open a selected-user view for a standard direct asset staff account, then open `/dashboard/resources`. Confirm the Places tab shows only assigned places, the Offerings tab includes linked/hosted offerings for those places and directly assigned offerings, pagination/counts reflect only that scoped set, and unrelated places or offerings do not appear.
- Acceptance criteria: direct Staff/Owner resource lists do not trigger all-resource managed pagination; assigned places appear; unassigned places do not appear; linked/hosted/direct offerings appear; unrelated offerings do not appear; counts and pagination are scoped; organisation governance/admin, region admin, audit, user management, auth, Gmail/email, GudAuth, Worker secrets, and role architecture remain unchanged.
- Verification result: red/green coverage added in `server/test/resourceListScope.test.js`; `node --test server/test/resourceListScope.test.js` passed 11/11, `node --test server/test/assetOperatorAuthorization.test.js server/test/accessControlPrivacy.test.js server/test/governance.test.js` passed 28/28, `npm run test:server` passed 307/307, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 137/137, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-02. Branch commit `276fd9c3` deployed Cloudflare Worker `senior-resource-map-api` version `96017b14-f8b4-4018-ad34-ae81d8ec8b12`; production API health returned OK, and production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api` on 2026-06-02. No Cloudflare Pages deploy was needed because this was a server-only fix.

### 2026-06-03 Dashboard My Assets first-page resilience

- Current behavior: `/dashboard/resources` first-page hard and soft managed resource loads now use the same retry-backed paginated page helper family already used by Admin Tools, so a transient first response failure keeps the My Assets page in loading/retry flow for another attempt instead of immediately showing a false `We could not load your resources just now` state.
- Known-good reference: 2026-06-03 production selected-user view for Hyqel Zainudin after FRCS Owner access was added. Production API returned 4 places (`FRCS Active Ageing Centre` plus the three Precious Active Ageing Centre places) and 21 FRCS-linked offerings, but the existing Chrome tab remained stuck on the generic load-error card until Retry eventually completed.
- Reproduction steps: sign in as Super Admin, open a selected-user view for Hyqel Zainudin or another standard direct asset operator, open `/dashboard/resources`, trigger a transient first managed hard/soft page failure, then retry or reload. Confirm the page settles to the assigned place and offering counts instead of requiring repeated manual refreshes after one temporary failed call.
- Acceptance criteria: the My Assets first hard and soft page loads retry transient failures before surfacing the generic load-error card; successful responses still show scoped counts and cards; full-dataset comma/slash search and boundary-filter paths keep their existing fetch-all behavior; direct Staff/Owner scoping, organisation governance, admin resource loading, auth/session ownership, Gmail/email, GudAuth, Worker secrets, schema, and visibility rules remain unchanged.
- Verification result: red/green coverage added in `client/test/resourceListLoading.test.js`; `node --test client/test/resourceListLoading.test.js` passed 7/7, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 147/147, `npm run build:client` passed with the existing large chunk warning, `npm run test:server` passed 316/316, and `git diff --check` passed on 2026-06-03. Commit `1a2a8b25` was pushed to `main`; Cloudflare Pages deploy completed at `https://0241c344.senior-resource-map.pages.dev`, and production `https://app.carearound.sg` served patched bundle `assets/index-C1W2Fxaj.js` with `assets/ResourcesPage-CW8wj466.js`. Production smoke initially hit a transient login fetch failure, then reran green at 5/5. A focused production selected-user check for Hyqel Zainudin confirmed `/dashboard/resources` showed `Places (4)`, `Offerings (21)`, FRCS and Precious places were visible, no resource-load error appeared, and the hard/soft managed resource calls returned 200.

### 2026-06-06 Lean IAM group resource model

- Current behavior: Org Groups and Region Groups exist as coordination metadata only. Group Admin/Staff assignments do not grant resource Owner/Staff access, publishing control, restricted notes/files access, public Discover labels, or inter-organisation approval power.
- Known-good reference: `docs/superpowers/specs/2026-06-05-lean-iam-group-resource-model-design.md` and branch `codex/lean-iam-group-resource-model`.
- Reproduction steps: create an Org Group for an organisation, add a group Admin and Staff from existing organisation users, create a Region Group as Super Admin, link coordination organisations/resources, then confirm resource edit/publish controls still depend on direct resource Owner/Staff access and restricted notes/files still require existing restricted-content permission.
- Acceptance criteria: group roles organise coordination only; resource Owner/Staff remains the operational permission lane; Org Group Admins can prepare coordination context and manage Staff access inside their group but cannot grant resource ownership; Region Groups remain cross-organisation coordination context only; public Discover does not expose Region Group, ICCP SR, Org Group, approval, or internal-boundary wording; no email, WhatsApp, SMS, Gmail, GudAuth, auth behavior, or secret changes are introduced.
- Verification result: `node --test server/test/governanceGroups.test.js server/test/governance.test.js server/test/privateResourceContent.test.js server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js client/test/governanceOrganizationUi.test.js` passed 66/66, `npm run test:server` passed 331/331, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 151/151, and `npm run build:client` passed with the existing large chunk warning on 2026-06-06. Release follow-up: after `main` fast-forwarded to commit `1406af5f`, production group schema was applied with a temporary group-only Worker bootstrap version `b37f59e1-ed6d-46be-9e2a-e72da784ad40` and a dummy `POST /api/discovery/location-indicators` request returned an empty indicator response; the normal Worker was then redeployed without the temporary bootstrap flag as version `a7feb308-dfc1-4b89-a4b7-66e0938882ba`. Cloudflare Pages deployed `https://94d8bc6e.senior-resource-map.pages.dev`; the production custom domain served `assets/index-BDbDClRD.js`; production API health returned OK; authenticated `/api/governance/groups` returned `200`; and production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.

### 2026-06-06 Admin platform role display label

- Current behavior: the legacy platform role previously shown to users as `Region Admin` now displays as `Admin` in Admin Tools filters, user creation, user rows, bulk-upload guidance, restricted-content viewer copy, and relevant server error messages. The internal role key remains `regional_admin`; permissions, manager ownership, subregion scope checks, asset Owner/Staff rules, group governance roles, and route access are unchanged. The parser still accepts `Admin`, `Region Admin`, and `Regional Admin` as labels for `regional_admin` so old CSV/input flows remain compatible.
- Known-good reference: 2026-06-06 request to replace the old `Region Admin` platform role label with `Admin`, while preserving the recently stabilised IAM model and region/group boundaries.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin`, switch to Users, inspect the role filter, user role dropdown, selected user rows, create-account form, and CSV/bulk-upload help. Open a resource edit form with restricted notes/files and inspect the additional viewer selector copy. Submit old labels such as `Region Admin` or `Regional Admin` through supported role-normalization paths and confirm they still resolve to the same Admin platform role.
- Acceptance criteria: user-facing role labels say `Admin` instead of `Region Admin`/`Regional Admin`; old labels remain accepted for backward compatibility; no database role values change; no auth, Gmail, email, GudAuth, secret, schema, resource edit permission, organisation governance, group governance, Discover visibility, My Maps, or Shared Maps behavior changes.
- Verification result: `node --test client/test/resourceListLoading.test.js client/test/governanceOrganizationUi.test.js` passed 21/21, `node --test server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js server/test/userRoleArchitecture.test.js server/test/privateResourceContent.test.js` passed 27/27, `npm run test:server` passed 332/332, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 152/152, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-06. Production smoke passed 4/5 on the full pre-deploy run, with the saved-resource detail check failing once after Discover loaded in a signed-out state; a targeted rerun of that failed saved-resource detail smoke passed 1/1. Release follow-up: commit `b387bf90` was pushed to `main`; Cloudflare Worker `senior-resource-map-api` deployed version `a82232e5-c5d8-4abb-8b10-8dd320ac093c`; Cloudflare Pages deployed `https://5b3fec1e.senior-resource-map.pages.dev`; the production custom domain served `assets/index-CKNv1lrt.js`; the deployed AdminPage chunk `assets/AdminPage-CLREIlGX.js` no longer contained the old public admin label and did contain the new Admin bulk-upload copy; production API health returned OK; and post-deploy production smoke passed 5/5.

### 2026-06-07 Admin user assignment UI language

- Current behavior: Admin Tools > Users now separates profile location, account responsibility, assignment status, and Admin region scope in the table. The old `Derived Region` table header is shown as `Profile Region`; `Managed By` is shown as read-only `Account Assignment`; the old user-table `Ownership` chip is shown as `Assignment Status`; and Admin accounts get a separate `Region Scope` column. Inline manager reassignment from the Users table has been removed from the UI so account assignment changes can move into a deliberate workflow later. The underlying `managerUserId`, `user_subregions`, role, assignment validation, export fields, and server permissions are unchanged.
- Known-good reference: 2026-06-07 user-approved IAM clarification that Managed By should become an information window rather than an editable field, and that Admin region scope must be distinct from profile-derived region and resource ownership.
- Reproduction steps: open `/dashboard/admin` > Users as Super Admin, inspect table headers and any Admin/User rows, export matching users, and confirm Account Assignment is displayed as read-only text rather than an inline manager dropdown.
- Acceptance criteria: Users table copy distinguishes `Profile Region`, `Account Assignment`, `Assignment Status`, and `Region Scope`; invalid manager status is labelled as needing review rather than resource ownership; the user-table `Ownership` header is gone; inline manager dropdowns are not present; role editing and existing user actions remain available where previously allowed; no backend auth, access-control validation, resource Owner/Staff permission, organisation/group governance, schema, Gmail/email, GudAuth, secrets, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior changes.
- Verification result: `node --test client/test/adminUserAssignmentUi.test.js` passed 1/1, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 155/155, `npm run test:server` passed 336/336, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-07. Release follow-up: commit `436ce7b3` was pushed to `main`; Cloudflare Pages deployed `https://89976e1a.senior-resource-map.pages.dev`; production custom domain served `assets/index-CYCZIQ36.js` and AdminPage chunk `assets/AdminPage-DCQsL6qK.js`; `/dashboard/admin` returned `200` on both preview and production; production API health returned OK; deployed AdminPage contained `Profile Region`, `Account Assignment`, `Assignment Status`, and `Region Scope`, and no `handleManagerChange` inline manager handler. Full production smoke passed 4/5 with the create-map check timing out during login navigation; the targeted create-map smoke rerun passed 1/1, and the other full-run checks passed.

### 2026-06-07 Admin region scope workflow

- Current behavior: Super Admins can open a dedicated `Manage Region Scope` workflow from Admin rows in Admin Tools > Users and assign one or more Region boundaries to that Admin. The workflow writes only the existing `user_subregions` scope links for Admin accounts. `Account Assignment` remains read-only in the table, `managerUserId` is not changed, and Region Scope does not grant resource Owner/Staff access, organisation access, group access, or Discover relevance changes by itself.
- Known-good reference: Phase 2A Admin Region Scope Management approved on 2026-06-07 after the Admin assignment UI language cleanup.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin` > Users, click `Manage Region Scope` on an Admin row, add/remove Region boundaries, save, and confirm the Region Scope column updates. Try to remove a Region that still contains directly managed users for that Admin.
- Acceptance criteria: only Super Admins can save Admin region scope; non-Admin users cannot receive Admin region scope; invalid Region ids are rejected; removing a Region is blocked when directly managed users would fall outside the Admin's new scope; empty scope is allowed only when no directly managed user would be stranded; no schema, auth, Gmail/email, GudAuth, secrets, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior changes.
- Verification result: `node --test server/test/adminRegionScope.test.js server/test/userRoleArchitecture.test.js` passed 7/7, `node --test client/test/adminUserAssignmentUi.test.js` passed 1/1, `npm run test:server` passed 340/340, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 155/155, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-07. Release follow-up: commit `89f49d26` was pushed to `main`; Cloudflare Worker `senior-resource-map-api` deployed version `d4a44d70-305d-49bd-9e6b-bb40e8934a0c`; Cloudflare Pages deployed `https://ac8aa178.senior-resource-map.pages.dev`; production custom domain served `assets/index-CZyaa8_G.js` and AdminPage chunk `assets/AdminPage-jPejoZgy.js`; production API health returned OK; `/dashboard/admin` returned `200`; deployed AdminPage contained `Manage Region Scope` and the Region Scope guardrail copy; and production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.

### 2026-06-07 Admin support coverage user model

- Current behavior: Admin Tools > Users now uses `Support Coverage` as the main operational column instead of `Account Assignment` / `Managed By`. Support coverage is derived from a standard user's profile postal-code Region and active Admin Region Scope. Super Admins can see all users, including users with no postal code or unresolved profile Region. Admins can see standard users whose profile Region overlaps their Admin Region Scope, including self-registered users with no assigned manager. Users with no postal code or unresolved profile Region remain Super Admin-only until location details are completed. The old `managerUserId` field and manager endpoint remain legacy/internal for compatibility and destructive/direct-management safeguards, but they are no longer presented as the core user-list model, export model, or create-account requirement for normal User accounts.
- Known-good reference: 2026-06-07 user-approved IAM clarification that `Managed By` should be retired from the core user model, self-registered users should be supported through overlapping Admin Region Scope, and users with no postal/location resolution should remain Super Admin-only.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin` > Users, confirm the table shows `Support Coverage` and `Region Scope` without `Account Assignment` or `Assignment Status`; export matching users and confirm support coverage fields replace manager columns; create or bulk-upload a normal User without `managerUsername`; sign in as an Admin with Region Scope and confirm users in overlapping profile Regions appear while users with no postal/unresolved Region do not.
- Acceptance criteria: support coverage is derived from Region Scope and profile location, not manual ownership; overlapping Admin scopes can all see the same covered standard user; missing postal/unresolved profile Region users are visible only to Super Admins; Admin Region Scope remains separate from resource Owner/Staff, organisation access, group access, private notes/files, and Discover relevance; no schema, auth, Gmail/email, GudAuth, secrets, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior changes are introduced.
- Verification result: `node --test server/test/adminSupportCoverage.test.js server/test/adminRegionScope.test.js server/test/userRoleArchitecture.test.js` passed 11/11, `node --test client/test/adminUserAssignmentUi.test.js client/test/adminBoundaryFilters.test.js` passed 4/4, `npm run test:server` passed 344/344, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 155/155, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-07. Release follow-up: commit `29681cf7` was pushed to `main`; Cloudflare Worker `senior-resource-map-api` deployed version `0724f2a8-1e74-4ca3-8714-3c88cb6358e0`; Cloudflare Pages deployed `https://9cc271ec.senior-resource-map.pages.dev`; production custom domain served `assets/index-CG1BHBpH.js` and `assets/AdminPage-0boPshU5.js`; production API health returned OK; `/dashboard/admin` returned `200`; the deployed AdminPage chunk contained `Support Coverage` and did not contain `Account Assignment`, `Assignment Status`, or `Managed By`; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.

### 2026-06-07 Admin support context view

- Current behavior: Admin Tools > Users now includes a read-only `Support Context` action for visible user rows. The context view explains why the account appears in the user list, shows account role, profile postal code, profile Region, Support Coverage, Region Scope, and the Admins included in coverage when present. It is intentionally informational only and does not grant profile edits, role changes, account deletion, user-view access, resource ownership, organisation access, group access, or private notes/files access.
- Known-good reference: support-context follow-up approved on 2026-06-07 after retiring `Managed By` from the core user model and locking Support Coverage as the operational visibility model.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin` > Users, click `View support context` on Admin and User rows, and confirm the modal explains Support Coverage without presenting edit controls. Sign in as an Admin with Region Scope and confirm the same read-only context is available for visible covered users only.
- Acceptance criteria: user rows have a support-context action independent from old direct-manager edit controls; the modal is read-only; the copy states that Support Context does not grant profile edits, role changes, deletion, user-view access, resource ownership, organisation access, group access, or private notes/files access; Admin visibility continues to come from Support Coverage and existing server filtering; no schema, auth, Gmail/email, GudAuth, secrets, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior changes are introduced.
- Verification result: `node --test client/test/adminUserAssignmentUi.test.js` passed 1/1 after a failing test was added first, `node --test server/test/adminSupportCoverage.test.js server/test/adminRegionScope.test.js server/test/userRoleArchitecture.test.js` passed 11/11, `node --test client/test/adminUserAssignmentUi.test.js client/test/adminBoundaryFilters.test.js` passed 4/4, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 155/155, `npm run build:client` passed with the existing large chunk warning, `git diff --check` passed, and `npm run test:server` passed 344/344 on 2026-06-07. Release follow-up: implementation commit `bed18711` was pushed to `main`; Cloudflare Pages deployed `https://4f184fe3.senior-resource-map.pages.dev`; production custom domain served `assets/index-LT-A6R55.js` and AdminPage chunk `assets/AdminPage-CStWonDv.js`; `/dashboard/admin` returned `200` on both preview and production; production API health returned OK; the deployed AdminPage chunk contained `Support Context` and `View support context`, and did not contain `Account Assignment`, `Assignment Status`, or `Managed By`; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.

### 2026-06-07 Region-side Admin assignment view

- Current behavior: Admin Tools > Regions now shows `Assigned Admins` for each Region, derived from existing Admin Region Scope links. The Region list can also be searched by assigned Admin name, and Region metadata export includes assigned Admin names. This gives Super Admins the reverse view of the Phase 2A Admin Region Scope workflow without adding a new assignment path.
- Known-good reference: Phase 2B Region-side scope view approved on 2026-06-07 so Admin scope can be understood from both directions: Admin -> Regions and Region -> Admins.
- Reproduction steps: sign in as Super Admin, open `/dashboard/admin` > Regions, inspect the `Assigned Admins` column, search by an assigned Admin name, and export Region metadata. Compare the result with Admin Tools > Users > `Manage Region Scope` for an Admin row.
- Acceptance criteria: Region rows show assigned Admin names based on existing Region Scope only; Regions with no matching Admin show `No Admins assigned`; search can find Regions by assigned Admin names; Region metadata export includes assigned Admins; the view is read-only and does not grant resource editing, user ownership, profile edits, account deletion, organisation access, group access, private notes/files access, Discover relevance changes, or any new server-side visibility.
- Verification result: `node --test client/test/adminUserAssignmentUi.test.js` failed first on the missing `Assigned Admins` Region-side view, then passed 1/1 after implementation; `node --test client/test/adminUserAssignmentUi.test.js client/test/adminBoundaryFilters.test.js` passed 4/4; `node --test server/test/adminSupportCoverage.test.js server/test/adminRegionScope.test.js server/test/userRoleArchitecture.test.js` passed 11/11; `node --test client/test/*.test.js client/src/lib/*.test.js` passed 155/155; `npm run build:client` passed with the existing large chunk warning; `git diff --check` passed; and `npm run test:server` passed 344/344 on 2026-06-07. Release follow-up: implementation commit `0c7e8a8d` was pushed to `main`; Cloudflare Pages deployed `https://c41db677.senior-resource-map.pages.dev`, and the production custom domain served the Git-triggered production bundle from `https://5e654b73.senior-resource-map.pages.dev`; production custom domain served `assets/index-Cp8ywcJT.js` and AdminPage chunk `assets/AdminPage-CTsdnJDt.js`; `/dashboard/admin` returned `200` on both preview and production; production API health returned OK; the deployed AdminPage chunk contained `Assigned Admins`, `No Admins assigned`, and `Support Context`, and did not contain `Account Assignment`, `Assignment Status`, or `Managed By`; production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.

### 2026-06-07 Resource delete audit idempotency

- Current behavior: deleting a place, offering, or offering template records a delete audit row only when the database record transitions from active to deleted. Repeated clicks, browser retries, or concurrent duplicate delete requests against an already-deleted record return success without rebuilding caches or writing additional `resource_deleted` audit rows. Admin Tools single-resource delete buttons and My Assets delete confirmation modals show a deleting state and disable repeat submits while the request is running.
- Known-good reference: 2026-06-07 production audit screenshot showing multiple `Resource deleted` entries for one place after the confirmation dialog appeared unresponsive and the delete action was clicked multiple times.
- Reproduction steps: open `/dashboard/resources` or `/dashboard/admin`, choose a deletable place/offering/template, confirm deletion, and try clicking the delete confirmation/button again while the request is still running. Repeat the same DELETE request for an already-deleted resource id where the actor still has delete permission.
- Acceptance criteria: exactly one delete audit row is written for the active-to-deleted transition; duplicate delete requests return success without another audit row; delete UI controls show a busy/disabled state until the request resolves; normal permission checks, cache rebuilds on the first delete, resource Owner/Staff rules, organisation/group governance, auth, Gmail/email, GudAuth, secrets, schema, Discover, My Maps, Shared Maps, ranking, sorting, visibility, and eligibility behavior remain unchanged.
- Verification result: red/green coverage added in `server/test/resourceDeleteAuditIdempotency.test.js` and `client/test/resourceDeleteSubmitGuard.test.js`; `node --test server/test/resourceDeleteAuditIdempotency.test.js` passed 3/3, `node --test client/test/resourceDeleteSubmitGuard.test.js` passed 2/2, `npm run test:server` passed 347/347, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 157/157, `npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-07. Release follow-up: implementation commit `f0ced204` was pushed to `main`; Cloudflare Worker `senior-resource-map-api` deployed version `9d302987-321e-4239-ba23-0b0e3aa97eb1`; Cloudflare Pages deployed `https://997753d1.senior-resource-map.pages.dev`; production custom domain served `assets/index-DjfEIpUx.js`, `assets/AdminPage-BhTdTt_z.js`, and `assets/ResourcesPage-DDS0_KgI.js`; production API health returned OK; `/dashboard/audit` returned `200`; deployed Admin and Resources chunks contained the `Deleting...` busy state; and production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.

### 2026-06-07 Confirmation dialog consistency

- Current behavior: destructive confirmation prompts in Admin Tools, My Directory map deletion, asset access removal, asset audience-zone deletion, WhatsApp verification unlink, organisation draft deletion, and Google place-import discard/close guards use a shared CareAround-styled confirmation dialog instead of native browser `confirm(...)` boxes. The existing My Assets delete modal and delete busy/disabled states remain intact. Non-destructive `alert(...)` feedback is intentionally left for a later UI pass.
- Known-good reference: 2026-06-07 production screenshots showing Admin Tools resource deletion using the native `app.carearound.sg says` browser prompt while My Assets deletion used the styled in-app modal, plus the user request to search for and standardize message boxes like that example.
- Reproduction steps: open `/dashboard/admin` > Resources and trigger a single-resource delete confirmation; open `/dashboard/resources` and trigger a delete confirmation; open My Directory map deletion, asset access removal, audience-zone deletion, WhatsApp verification unlink, organisation draft deletion, and the Google place-import wizard with unsaved drafts. Confirm destructive confirmations share the same in-app dialog pattern and native browser confirm boxes no longer appear.
- Acceptance criteria: no client source outside the shared dialog component calls native `confirm(...)`; destructive confirmations render with an accessible modal structure, cancel/confirm labels, and disabled/loading support; import-wizard close guards still block closing until the user chooses; delete audit idempotency, delete busy-state guards, permissions, auth, Gmail/email, GudAuth, secrets, schema, resource Owner/Staff rules, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, and eligibility behavior remain unchanged.
- Verification result: red/green coverage added in `client/test/confirmationDialogConsistency.test.js`; `node --test client/test/confirmationDialogConsistency.test.js` passed 2/2, `node --test client/test/resourceDeleteSubmitGuard.test.js` passed 2/2, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 159/159, `npm run build:client` passed with the existing large chunk warning, `npm run test:server` passed 347/347, `npm run test:smoke` passed 5/5 before and after deploy, and `git diff --check` passed on 2026-06-07. Release follow-up: implementation commit `4d6c16df` was pushed to `main`; Cloudflare Pages deployed `https://d4a6e7c5.senior-resource-map.pages.dev`; production custom domain served `assets/index-DKBd6Unx.js`, `assets/ConfirmDialog-CaTw1rJK.js`, `assets/AdminPage-DTwraqeJ.js`, `assets/ResourcesPage-DIL6ANFm.js`, `assets/MyDirectoryPage-Bkgl0ARm.js`, and `assets/GovernanceOrganizationsPanel-C411_8h_.js`; production API health returned OK; `/dashboard/admin` returned `200`; the deployed index manifest referenced the shared `ConfirmDialog` chunk and did not contain native `confirm(...)` calls. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.

### 2026-06-07 Admin alert feedback consistency

- Current behavior: Admin Tools no longer uses native browser `alert(...)` message boxes for non-destructive feedback. User-facing notices now route through existing in-app Admin feedback, resource-section error feedback, audience-zone feedback, or region/subregion feedback, with row-level import details shown inside the page instead of a browser alert box. Destructive confirmation behavior remains on the shared CareAround confirmation dialog from the previous entry.
- Known-good reference: 2026-06-07 user-approved follow-up after confirmation dialog consistency to separately replace native `alert(...)` messages with inline/toast-style notices.
- Reproduction steps: open `/dashboard/admin`; trigger no-result user export, user role update failure, user delete failure, resource delete failure, category create/update/delete failure, audience-zone empty boundary export, user bulk upload with skipped/error rows, region metadata import failure, and region boundary upload failure. Confirm feedback appears in the page and native browser alert boxes do not appear.
- Acceptance criteria: no client source calls native `alert(...)`; long upload/import summaries remain visible as page feedback details; resource-section errors still appear near the Resources table; audience-zone and region/subregion messages stay near their relevant Admin Tools sections; destructive confirmation dialogs, delete audit idempotency, delete busy-state guards, permissions, auth, Gmail/email, GudAuth, secrets, schema, resource Owner/Staff rules, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, and eligibility behavior remain unchanged.
- Verification result: red/green coverage added in `client/test/alertFeedbackConsistency.test.js`; `node --test client/test/alertFeedbackConsistency.test.js` passed 1/1, `node --test client/test/alertFeedbackConsistency.test.js client/test/confirmationDialogConsistency.test.js client/test/resourceDeleteSubmitGuard.test.js` passed 5/5, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 160/160, `npm run build:client` passed with the existing large chunk warning, `npm run test:server` passed 347/347, `npm run test:smoke` passed 5/5 with the smoke env loaded before and after deploy, and `git diff --check` passed on 2026-06-07. Release follow-up: implementation commit `127dba91` was pushed to `main`; Cloudflare Pages deployed `https://122628af.senior-resource-map.pages.dev`; production custom domain served `assets/index-pHp0V_zn.js`, `assets/ConfirmDialog-C6wHhxXE.js`, `assets/AdminPage-OPLvCRuc.js`, `assets/ResourcesPage-BFfcAJwq.js`, `assets/MyDirectoryPage-BrwNR0TF.js`, and `assets/GovernanceOrganizationsPanel-CN8-Cx4k.js`; production API health returned OK; `/dashboard/admin` returned `200`; and the deployed AdminPage chunk did not contain native `alert(...)` calls. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, resource edit permission, organisation/group governance, Discover, My Maps, Shared Maps, ranking, sorting, visibility, or eligibility behavior was changed.

### 2026-06-07 Discover location badge responsiveness

- Current behavior: Discover location indicator badges keep their existing server-side meaning, but client rendering now starts badge lookup earlier for valid postal-code searches and caches badge booleans by location context plus user context. Visible cards still make a small direct request, while a bounded pending-postal warm-up can populate the cache before postal geocoding completes.
- Known-good reference: 2026-06-07 demo polish request that Region boundary `Recommended for you` / `Recommended for this location` badges and Audience Zone star-in-circle badges should appear as snappily as possible after a postal-code search.
- Reproduction steps: open `/discover`, search a Singapore postal code that is inside a configured Region boundary and Audience Zone, and observe the first visible cards plus subsequent visible batches. Repeat the same postal search in the same session.
- Acceptance criteria: badge matching logic, wording, icon presentation, ranking, sorting, filtering, visibility, eligibility, distance display, auth, Gmail/email, GudAuth, secrets, schema, My Maps, and Shared Maps behavior remain unchanged; only the client timing/caching of existing location-indicator booleans changes; visible card requests remain compact and bounded by the existing 1,000-resource endpoint limit.
- Verification result: `node --test client/test/locationIndicators.test.js` failed first on the missing prefetch helper, then passed 7/7 after implementation; `node --test client/test/locationIndicators.test.js client/test/discoveryLocationIndicatorBadges.test.js client/test/discoveryLocationAnchor.test.js` passed 10/10; `node --test client/test/*.test.js client/src/lib/*.test.js` passed 161/161; `npm run build:client` passed with the existing large chunk warning; `git diff --check` passed; and a local browser check against the production API base loaded `/discover`, searched postal code `681809`, and showed `Recommended for this location` on the first visible cards on 2026-06-07. Release follow-up: implementation commit `7bc98feb` was pushed to `main`; `npm run test:server` passed 347/347; `npm run build:client` passed with the existing large chunk warning; the partner smoke gate was explicitly bypassed by user instruction because smoke credentials were unavailable in the shell; Cloudflare Pages deployed `https://da6235bc.senior-resource-map.pages.dev`; production custom domain served `assets/index-B6ddWshb.js`; production API health returned OK; and a production browser check against `https://app.carearound.sg/discover` searched postal code `681809` and showed `Recommended for this location` on the first visible cards. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, ranking, sorting, filtering, visibility, eligibility, My Maps, or Shared Maps behavior was changed.

### 2026-06-10 My Map PDF ledger export

- Current behavior: signed-in My Map owners now have a `Download PDF` action in the My Map controls. The PDF is generated in the browser as a one-click download, includes the full unfiltered map contents by default, and groups all visible private-map resources by category with alphabetical resource ordering. Each ledger table uses a combined `Resource / Address` column beside a wider `Notes` column so long note bodies have more printable width. Note text keeps the original row breaks from My Map notes, multiple notes are separated with a blank row, copied markdown/code-fence artifacts are cleaned for PDF output, long unspaced note tokens are split so the Notes column can wrap, supported Markdown Lite note styling is rendered for PDF notes, and each note starts with a compact Singapore date label such as `[10/06/26] - note`. The PDF is intentionally report-style: it does not include the physical map snapshot, pin/map-number column, note visibility suffix, or long ISO timestamp suffix, so the output stays focused on extraction and analysis. The cover uses the map title once, category pages start directly with the category heading, cover-summary spacing is compact, and the typography is balanced for phone PDF readers with more moderate headings and larger ledger/table text. The PDF generator and heavy PDF libraries are lazy-loaded only when the user downloads a PDF.
- Known-good reference: 2026-06-10 approved My Map PDF overview design plus follow-up compact-report, mobile hierarchy, note-readability, and 2026-06-12 note-wrapping/date refinements: full map contents by default, all resources bucketed by category and alphabetical order, fields focused on resource name, category, address, and readable notes with `[dd/mm/yy] - note` prefixes, category pages without repeated large map titles, with note inclusion based on existing private My Map permissions and no physical map snapshot, pin-number column, visibility suffix, or long timestamp suffix.
- Reproduction steps: sign in as a non-guest directory user, open `/my-directory/maps/:mapId`, click `Download PDF`, and confirm a PDF file downloads without opening a separate print flow. Search/filter the interactive map before downloading and confirm the PDF still includes the full map contents. Confirm the PDF presents a category summary and two-column `Resource / Address` and `Notes` ledger tables without a physical map snapshot or pin-number column. Confirm notes preserve original line breaks, start with `[dd/mm/yy] -`, clean copied markdown/backtick artifacts, wrap inside the wider Notes column, render supported Markdown Lite emphasis and links readably, and use spacing between multiple notes. Confirm shared-map/public pages do not expose this owner-only download action.
- Acceptance criteria: PDF download stays owner-only on the signed-in My Map route; the PDF contains a summary plus all map resources grouped by category and sorted alphabetically; notes stay aligned to the correct resource, preserve their original line breaks, keep supported Markdown Lite styling readable in the PDF, and render only a compact date prefix before the note text; the PDF omits the physical map snapshot, pin/map-number column, note visibility suffix, and long timestamp suffix; the export does not change My Maps/Shared Maps data visibility, note permissions, search/filter behavior, resource ordering in the interactive view, auth, Gmail/email, GudAuth, secrets, schema, Discover, ranking, sorting, filtering, visibility, or eligibility behavior.
- Verification result: initial PDF ledger coverage passed 21/21 with `node --test client/test/mapNotes.test.js client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js client/test/myMapPdfExportButtonSource.test.js client/test/myMapPdfIntegrationSource.test.js client/test/directoryPresentationLayout.test.js client/test/i18n.test.js client/test/i18nCoverage.test.js`; full client coverage passed 190/190 with `node --test client/test/*.test.js client/src/lib/*.test.js`; `npm run test:server` passed 347/347; `npm run build:client` passed with the existing large chunk warning and emitted separate lazy PDF chunks; and a local browser smoke at `http://localhost:5173/my-directory/maps/87` with a signed-in fixture downloaded `pdf-qa-map-ledger.pdf` at 21,522 bytes with no failed requests on 2026-06-10. Follow-up compact-layout verification on 2026-06-10 passed focused PDF/i18n coverage 22/22 with the same focused command, full client coverage 191/191 with `node --test client/test/*.test.js client/src/lib/*.test.js`, `npm run test:server` 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check`. Local browser smoke at `http://localhost:5173/my-directory/maps/87` with mocked signed-in My Map data downloaded `pdf-compact-qa-map-ledger.pdf` at 18,769 bytes with no failed requests or console warnings. PDF text markers confirmed `Category summary` and `Resource` / `Address` / `Notes`, and found no `Map snapshot`, `Map snapshot unavailable`, `sourceMapNumber`, or `(#) Tj`; Quick Look thumbnail review showed the first page as a compact category summary without a physical map snapshot. Mobile hierarchy refinement on 2026-06-10 passed focused PDF coverage 11/11, focused PDF/i18n coverage 23/23, full client coverage 192/192 with `node --test client/test/*.test.js client/src/lib/*.test.js`, `npm run test:server` 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check`. A phone-sized local browser smoke at `http://localhost:5173/my-directory/maps/87` with mocked signed-in My Map data opened the mobile controls and downloaded `my-partners-ledger.pdf` at 12,873 bytes with no failed requests or console warnings. PDF text markers confirmed `My Partners` appears only as the cover title plus PDF metadata, category pages begin with `Active Ageing Centre (AAC)` / `Senior Care Centre (SCC)`, page footers use document page numbers, and no `Map snapshot`, `sourceMapNumber`, or `(#) Tj` markers were present. Quick Look thumbnail review showed the first page with a smaller cover title, moderate `Category summary` heading, and readable table text. Note-readability refinement on 2026-06-10 passed focused PDF coverage 13/13, focused PDF/i18n coverage 25/25, full client coverage 194/194 with `node --test client/test/*.test.js client/src/lib/*.test.js`, `npm run test:server` 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check`. A phone-sized local browser smoke at `http://localhost:5173/my-directory/maps/87` with mocked signed-in My Map data downloaded `my-partners-ledger.pdf` at 11,429 bytes with no failed requests or console warnings. PDF text markers confirmed `[100626] - Call before referral`, preserved note line breaks across `Ask for intake coordinator` and `Bring medication list`, separated multiple notes with row spacing, and found no `Private`, `Updated`, `2026-06-`, or ISO timestamp markers. Credentialed smoke env vars were not present in the shell, so the credentialed smoke suite was not run. No Worker deploy, auth, Gmail/email, GudAuth, secret, schema, Discover, Shared Maps, ranking, sorting, filtering, visibility, or eligibility behavior was changed.
- Production release follow-up: compact layout commit `4559d474` was fast-forwarded to `main` and pushed on 2026-06-10. Cloudflare Pages production deploy completed at `https://1f78a2c0.senior-resource-map.pages.dev` after a second explicit Pages publish cleared a transient custom-domain JS asset cache mismatch. The custom domain `https://app.carearound.sg` returned `200`, served `assets/index-D0Usi08A.js`, and the deployed shell referenced `assets/MyMapDetailPage-DQ5prGd2.js`; production API health returned `200`. Production-domain browser verification with mocked signed-in My Map data confirmed `/my-directory/maps/87` downloaded `pdf-compact-qa-map-ledger.pdf` at 15,421 bytes with no failed requests or console warnings, and the downloaded PDF text contained `Category summary` plus `Resource` / `Address` / `Notes` with no `Map snapshot`, `Map snapshot unavailable`, or `(#) Tj`. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.
- Production release follow-up: mobile hierarchy commit `aae8db3e` was fast-forwarded to `main`, pushed, and deployed to Cloudflare Pages on 2026-06-10 at `https://6b305e40.senior-resource-map.pages.dev`. The custom domain `https://app.carearound.sg` returned `200`, served `assets/index-DOVeFzjy.js`, and the deployed shell referenced `assets/MyMapDetailPage-CYxb7E1Z.js`; that My Map chunk contains the new cover/header, footer, and typography markers. Production API health returned `200`. Production-domain browser verification with mocked signed-in My Map data at phone viewport opened the mobile controls and downloaded `my-partners-ledger.pdf` at 12,873 bytes with no failed requests or console warnings. PDF text confirmed `My Partners` appears only as the cover title plus PDF metadata, category pages begin with `Active Ageing Centre (AAC)` / `Senior Care Centre (SCC)`, footers show document page numbers, and there were no `Map snapshot`, `sourceMapNumber`, or `(#) Tj` markers. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.
- Production release follow-up: note-readability commit `a5f80f86` was fast-forwarded to `main`, pushed, and deployed to Cloudflare Pages on 2026-06-10 at `https://07e1afe3.senior-resource-map.pages.dev` after an explicit production-branch publish aligned the Pages root and custom domain with the new bundle. The custom domain `https://app.carearound.sg` returned `200`, served `assets/index-sDJSpayI.js`, and referenced `assets/MyMapDetailPage-CClV8qIu.js`; that My Map chunk contains the `[${dateLabel}] - note` prefix and blank-row multi-note join, and no longer contains the old `Updated` suffix. Production API health returned `200`. Production-domain browser verification with mocked signed-in My Map data at phone viewport opened the mobile controls and downloaded `my-partners-ledger.pdf` at 8,558 bytes with no failed requests or console warnings. PDF text confirmed `[100626] - Call before referral`, preserved row breaks for `Ask for intake coordinator` and `Bring medication list`, placed `[100626] - Follow up with caregiver after visit` on a separate note row, and contained no `Private`, `Updated`, `2026-06-`, `T16`, or `T04` timestamp markers. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.
- Local spacing/loading follow-up: on 2026-06-10 the attached `my-partners-ledger (3).pdf` showed the cover summary/table block spaced too loosely. The fix moved the summary metrics, `Category summary` heading, and table upward, tightened category page title-to-table spacing with wrapped-title protection, and moved PDF generation behind a click-time dynamic import. Verification passed focused PDF/My Map loading coverage 19/19, full client coverage 195/195, `npm run test:server` 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and a phone-sized local browser download of `my-partners-ledger.pdf` at 12,811 bytes. Quick Look thumbnail review confirmed the first page now has tighter spacing between the cover header, summary metrics, `Category summary`, and the table; PDF text still confirmed `[100626] - Call before referral`, preserved row breaks for `Ask for intake coordinator` and `Bring medication list`, and found no `Private`, `Updated`, `2026-06-`, `T16`, or `T04` timestamp markers. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this local patch.
- Markdown layout follow-up: on 2026-06-13 the PDF ledger moved from separate `Resource`, `Address`, and `Notes` columns to a two-column `Resource / Address` plus wider `Notes` layout, while preserving supported Markdown Lite note styling for the PDF notes and keeping a cleaned plain-text fallback for extraction. Verification passed red-first focused PDF coverage 19/19 after the new tests failed against the old three-column/plain-text path, wider My Map/PDF/markdown/i18n coverage 65/65, full client coverage 249/249, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning. A generated local sample PDF was rendered to PNG with `pdftoppm`; visual review confirmed the two-column ledger and wider Notes column, while text extraction confirmed `Resource / Address Notes`, `[12/06/26] - APT 2.0 Meeting Notes`, and `Website (https://example.com/aac)` remained readable. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this local patch.
- Production release follow-up: performance/spacing commit `eb08c808` was deployed to Cloudflare Pages on 2026-06-10 at `https://987fef4b.senior-resource-map.pages.dev`; custom domain `https://app.carearound.sg` served `assets/index-BvRV0WMR.js`, `assets/MyMapDetailPage-BQWgiPZh.js`, and lazy PDF generator chunk `assets/myMapPdfGenerator-cAtLDcgz.js`. Production-domain browser verification with mocked signed-in My Map data at phone viewport downloaded `my-partners-ledger.pdf` at 12,811 bytes with no failed requests or console warnings. PDF stream coordinates confirmed the summary metrics moved to `y=88`, `Category summary` moved to `y=140`, and the category table starts at `y=156`; PDF text confirmed `[100626] - Call before referral`, preserved row breaks for `Ask for intake coordinator` and `Bring medication list`, placed `[100626] - Follow up with caregiver after visit` on a separate note row, and contained no `Private`, `Updated`, `2026-06-`, `T16`, or `T04` timestamp markers. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, or production database change was introduced by this release.
- Local flow-spacing follow-up: on 2026-06-10 the attached `my-partners-ledger (4).pdf` still showed a large blank lower half on the first page because the generator forced every category ledger to start on a new page. The fix lets the first category continue below the category summary when there is room, while adding a minimum-space check so category headings are not stranded at the bottom of a page. Verification passed focused PDF coverage 14/14, full client coverage 195/195, `npm run test:server` 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and Quick Look visual review of a generated `my-partners-ledger.pdf` confirmed `Active Ageing Centre (AAC)` and its table now start on page 1 under the summary table instead of leaving the page mostly blank. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, My Map loading behavior change, or production database change was introduced by this local patch.
- Production release follow-up: flow-spacing commit `310707c8` was fast-forwarded to `main`, pushed, and deployed to Cloudflare Pages on 2026-06-10 at `https://05151117.senior-resource-map.pages.dev`; custom domain `https://app.carearound.sg` served `assets/index-BfAOjvHu.js`, `assets/MyMapDetailPage-BMFZq2UK.js`, and lazy PDF generator chunk `assets/myMapPdfGenerator-C4komcCK.js`. Deployed bundle inspection confirmed the PDF generator contains `summaryToLedgerGap`, `minimumTableRoom`, and a conditional page-break rule instead of forcing every category onto a fresh page. Production-domain browser verification with mocked signed-in My Map data downloaded `my-partners-ledger.pdf` at 17,132 bytes, with no console warnings and with PDF chunks loading only after the download click; the only failed request was an unrelated external OneMap logo SVG blocked by the headless browser. Quick Look visual review of that production-downloaded PDF confirmed `Active Ageing Centre (AAC)` and its ledger table start on page 1 directly under the category summary, removing the large blank lower-half gap. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, My Map loading behavior change, or production database change was introduced by this release.
- Local note-layout follow-up: on 2026-06-12 the attached `my-partners-ledger (4).pdf` showed notes text drifting out of the page, copied markdown/backtick artifacts, and the old `[100626]` compact date labels. The fix changes note labels to `[dd/mm/yy]`, cleans obvious copied markdown/code-fence and letter-spaced paste artifacts before PDF generation, breaks very long unspaced note tokens so AutoTable can wrap them, and constrains the Resource / Address / Notes table to the printable page width with a wider fixed Notes column. Verification passed focused PDF coverage 13/13 with `node --test client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js`, focused My Map/shared-note/PDF coverage 33/33 with `node --test client/test/mapNotes.test.js client/test/mapNotesAutosave.test.js client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js client/test/myMapPdfExportButtonSource.test.js client/test/myMapPdfIntegrationSource.test.js client/test/sharedMapContinuation.test.js client/test/sharedMapDirectoryListRefinement.test.js`, full client coverage 218/218 with `node --test client/test/*.test.js client/src/lib/*.test.js`, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, My Map loading behavior change, or production database change was introduced by this local patch.
- Local hidden-character follow-up: on 2026-06-12 the attached `my-partners-ledger (7).pdf` confirmed the new slash date format but still showed older unedited note lines with template tick marks and awkward spacing, while newly edited notes looked correct. PDF extraction showed those older notes carried embedded null/control characters. The fix strips PDF-hostile control characters before markdown/backtick cleanup so older stored notes render like normal text without requiring each note to be manually edited. Verification passed focused PDF coverage 14/14, focused My Map/shared-note/PDF coverage 34/34, full client coverage 219/219, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning. A local generated PDF fixture using the same hidden-character note rendered as `[10/06/26] - 6. TCM` with no nulls, no stray backticks, and no duplicate date prefix. No Worker deploy, backend API change, auth secret change, schema change, Discover change, Shared Maps change, ranking/filtering/visibility change, Grab behavior change, My Map loading behavior change, or production database change was introduced by this local patch.

### 2026-06-11 Auth and smoke gate recovery

- Current behavior: cold protected-route session checks now allow a slower production `/auth/me` response before treating the user as signed out. Transient cold-load session failures are retried while definitive invalid/missing-token responses still clear the user. My Directory saved-assets loads now retry transient `/favorites` failures before showing an empty saved-resource state. The smoke suite now uses the real partner login UI with bounded retry/backoff, caches the first successful session for later tests, seeds smoke saved assets through authenticated setup calls when needed, and gives the currently slow production `/favorites` route enough time to return before opening create-map/detail flows.
- Known-good reference: the locked Auth session continuity, My Directory saved assets, Dashboard resources/admin, and release smoke rows above, plus the 2026-06-11 recovery evidence that production `/auth/login` intermittently returned `503`/browser `net::ERR_FAILED`, `/auth/me` could exceed the prior 5-second client timeout, and `/favorites` could return only after 30-63 seconds for the smoke account. Post-client-deploy Worker tail then confirmed `/auth/login` `503`s with `Worker exceeded CPU time limit`, while the production API health endpoint still returned `200`.
- Reproduction steps: load a protected route such as `/dashboard/resources` or `/my-directory` from a fresh page while signed in, with the production API base configured; repeat during a transient auth or saved-assets slowdown. Run the smoke suite with `SMOKE_BASE_URL=http://localhost:5173` and `SMOKE_API_BASE=https://api.carearound.sg/api` after loading the smoke credentials without printing them.
- Acceptance criteria: transient auth/session slowness does not immediately redirect a valid signed-in user to Login; definitive expired or missing sessions still sign out; My Directory does not show a false empty state after one transient `/favorites` failure; smoke setup does not create repeated saved-resource churn; production login does not spend Worker CPU on runtime preference-column DDL in production; public Discover, partner login, dashboard resources, postal import, create-map, and saved-resource detail smoke paths all pass, allowing bounded retries for observed production API jitter.
- Verification result: `node --test client/test/authSession.test.js client/src/lib/savedAssetsLoading.test.js` passed 14/14, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 202/202, `npm run test:server` passed 347/347, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed on 2026-06-11. Local-client smoke against the production API passed with Playwright retries enabled: public load and saved-resource detail passed directly; partner login, postal import, and create-map each passed on retry under observed production API jitter. Worker tail evidence showed `/auth/login` successful invocations taking about 1.9-4.5 seconds wall time, and a `/favorites` invocation returning `200` only after 63.3 seconds wall time. After production-client deploy, production-domain smoke exposed repeated `/auth/login` `503`s from Worker CPU-limit failures; the server follow-up skips the user-preference runtime column bootstrap in production while preserving local/dev bootstrap behavior. Verification for that follow-up passed `node --test server/test/boundarySchema.test.js`, `node --test server/test/authController.test.js server/test/sessionAuth.test.js server/test/phoneLogin.test.js server/test/phoneIdentitySchema.test.js server/test/userRoleArchitecture.test.js` 30/30, and `npm run test:server` 349/349. No secrets were printed or changed, and no backend schema change, Gmail/email change, GudAuth change, ranking/filtering/visibility change, or production database cleanup was performed.
- Production release follow-up: client recovery commit `4a5c7edd` deployed to Cloudflare Pages, then server mitigation commit `0319ed38` deployed the Worker as version `21b8bb9b-8266-479f-9399-bd6d1523a386`. Cloudflare Pages production deploy `https://4c7d5293.senior-resource-map.pages.dev` became the active custom-domain source; `https://app.carearound.sg` returned `200` and served `assets/index-CpENN1YC.js`, which contained the auth/session and saved-assets recovery markers. Production API health returned `200`; direct smoke-account probes confirmed `/auth/login` returned `200` with a session cookie and `/favorites` returned `200` with 19 saved resources; full production smoke passed 5/5 against `https://app.carearound.sg` plus `https://api.carearound.sg/api`.

### 2026-06-11 SG postal fallback form guard

- Current behavior: the place create/edit form no longer blocks a Super Admin or Singapore-scoped actor from saving a Singapore place only because the exact postal code is missing from local service-area rows. For those fallback candidates, the form shows that the postal code will be checked against Singapore before saving and lets the existing Worker API validate it with OneMap, cache the valid postal code under `Singapore / SIN`, and reuse the returned coordinates. Non-Singapore places, invalid postal formats, and actors outside the Singapore fallback scope remain blocked or rejected by the existing guards.
- Known-good reference: locked `SG postal fallback for place writes` row above, plus the 2026-06-11 production screenshot where editing `NTUC Health Active Ageing Centre (Care) (Bukit Batok West)` with postal code `650439` showed `Postal code does not match any configured service area` even though the server fallback was already in place.
- Reproduction steps: open `/dashboard/resources`, edit or create a Singapore place as Super Admin or an actor scoped to `Singapore / SIN`, enter a valid SG postal code that is not present in exact local service-area rows, and confirm the form allows save through the existing API fallback path. Also try an invalid postal code, a non-Singapore country, and a user outside the Singapore fallback scope.
- Acceptance criteria: valid Singapore fallback candidates are not blocked by the client-side form; the Worker remains responsible for OneMap validation, exact-postal caching, and final rejection of invalid or unauthorized fallback attempts; exact configured postal matches and ambiguous configured matches keep existing behavior; non-SG countries do not use fallback; resource ownership, access, Discover ranking/filtering/visibility, imports, auth, Gmail/email, GudAuth, secrets, schema, and production data remain unchanged.
- Verification result: `node --test client/test/postalBoundaries.test.js server/test/singaporePostalFallback.test.js` passed 8/8, `node --test client/test/*.test.js client/src/lib/*.test.js` passed 205/205, `npm run test:server` passed 349/349, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning on 2026-06-11.

### 2026-06-11 Dashboard resources partial-load resilience

- Current behavior: Dashboard Resources loads place and offering result families independently, so a transient failure in one family no longer forces the active tab for the other family into the full-page `We could not load your resources just now` state. Existing retry-backed page loads, server-side managed search, pagination, filtering, and retry messaging remain in place. If both place and offering loads fail, the page still shows the retryable load-error state.
- Known-good reference: locked Dashboard resources/admin row above, plus the 2026-06-11 production screenshot where searching `bukit` on `/dashboard/resources` showed the load-error card even though direct production probes for `/hard-assets?scope=managed&summary=true&q=bukit&page=1&pageSize=50` and `/soft-assets?scope=managed&q=bukit&page=1&pageSize=50` returned `200` with expected rows under observed API jitter.
- Reproduction steps: sign in as Super Admin, open `/dashboard/resources`, search `bukit`, and observe the Places and Offerings requests. Repeat while one resource-family request is slow or transiently fails.
- Acceptance criteria: a successful Places response can render the Places tab even if Offerings has a transient failure, and vice versa; both-family failure still surfaces the retry card; no resource permission, search matching, pagination, export, create/edit, auth/session, import, schema, Gmail/email, GudAuth, secret, Discover, My Directory, My Maps, ranking, filtering, or visibility behavior changes.
- Verification result: direct production probes after the report returned `200` for five repeated `bukit` managed searches, with observed response times from about 2.5s to 21.6s. A headless production UI reproduction loaded `/dashboard/resources`, searched `bukit`, and showed results in about 9.9s with both resource-family API calls returning `200`. Local verification after the resilience patch passed `node --test client/test/resourceListLoading.test.js client/test/resourceLoadState.test.js` 13/13, `node --test client/test/*.test.js client/src/lib/*.test.js` 206/206, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-11.

### 2026-06-11 Dashboard resources root performance guard

- Current behavior: Dashboard Resources no longer makes visible list cards wait for slow support metadata or the slowest resource family. Places and Offerings load/update independently; support metadata such as Regions, templates, audience zones, partner options, and partner boundaries loads outside the card-list path; search input is debounced before server requests; and managed Offerings requests use a lean `summary=true` response for dashboard cards while detail/edit/export paths continue to use full offering records.
- Known-good reference: the locked Dashboard resources/admin row plus the 2026-06-11 production timing evidence that the Super Admin smoke account saw `/soft-assets?scope=managed&page=1&pageSize=50` take about 66.7s for 50 of 58 rows, `/hard-assets?scope=managed&summary=true&page=1&pageSize=50` take about 8.3s, `/subregions` take about 10.8s, and `/users` hang long enough to stop the probe. The repeated regression pattern showed that retries and partial-load handling were not enough while the page kept coupling list rendering to heavyweight offering hydration and metadata fetches.
- Reproduction steps: sign in as Super Admin, open `/dashboard/resources`, observe the default Places tab, then type a common search such as `bukit`. Inspect network requests for `/hard-assets`, `/soft-assets`, `/subregions`, `/soft-asset-parents`, `/audience-zones`, and `/users`.
- Acceptance criteria: Places can render as soon as the Places request succeeds without waiting for Offerings, users, or Region metadata; Offerings dashboard cards use managed summary payloads and still show names, locations, category/tags, availability, ownership/governance context, visibility controls, and permissions; search typing does not fire a request per keystroke; edit/detail/export/import flows still fetch or use full records where needed; resource permission, search matching, pagination, filtered export, create/edit, auth/session, postal import, schema, Gmail/email, GudAuth, secrets, Discover, My Directory, My Maps, ranking, filtering, and visibility behavior remain unchanged.
- Verification result: focused coverage passed `node --test client/test/resourceListLoading.test.js client/test/resourceLoadState.test.js` 15/15 and `node --test server/test/softAssetSummary.test.js server/test/hardAssetSummary.test.js server/test/resourceListScope.test.js` 13/13. Full local validation passed `npm run test:server` 350/350, `node --test client/test/*.test.js client/src/lib/*.test.js` 208/208, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-11. A local patched API probe could not be run because this checkout does not contain `server/.env`.
- Production release follow-up: commit `633bf18c` was fast-forwarded to `main`, pushed, and deployed on 2026-06-11. Cloudflare Worker `senior-resource-map-api` deployed as version `8396d76c-3259-4364-9294-93a77c7db345`; Cloudflare Pages was explicitly published from the production branch at `https://5534c282.senior-resource-map.pages.dev`; custom domain `https://app.carearound.sg` returned `200`, served `assets/index-Bg7187VE.js`, and referenced `assets/ResourcesPage-CmlVvI5I.js`; production API health returned `200`. Live smoke-account probes showed the dashboard-managed default Offerings summary path `/soft-assets?scope=managed&summary=true&page=1&pageSize=50` returned 50 rows in about 4.5s, compared with the pre-fix full Offerings baseline of about 66.7s; the full default Offerings path returned in about 10.3s after the Worker deploy but is no longer used for dashboard cards. Production smoke against `https://app.carearound.sg` plus `https://api.carearound.sg/api` exited successfully; the first full run had retry-pass flakes in create-map cleanup and saved-resource detail opening, and the targeted rerun of those two checks passed 2/2. No auth secret, schema, postal import, permission, visibility, Discover ranking/filtering, My Directory, My Maps, Shared Maps, Gmail/email, GudAuth, or production database change was introduced by this release.

### 2026-07-24 Dashboard Resources editor/save/export performance guard

- Current behavior: Manage Resources opens Place editors from the authenticated managed-list edit summary when that summary is present, instead of blocking the modal on the full nested place detail payload. Older or non-summary records still fall back to the full detail fetch. Place/offering/group saves keep the database write and operational audit synchronous, but skip unchanged tag rewrites, skip translation refresh when English translatable fields did not change, and queue map-cache rebuilds after the response. Filtered workbook exports load only the reference datasets required by the selected workbook type; normal server-filtered Place exports post the active filter to the Worker instead of first fetching every matching page in the browser, and large server-filtered Place exports download as CSV to avoid Worker XLSX timeouts.
- Known-good reference: the 2026-07-24 production regression report where uploading a logo eventually saved but remained stuck on `Saving...`, opening a Place editor took about 6.1 seconds before editable controls appeared, and filtered workbook export timed out. Production console evidence also showed a secondary session-check timeout while the editor path was waiting on heavier resource work.
- Reproduction steps: sign in as Super Admin, open `/dashboard/resources`, edit a Place card from the managed list, save a logo/media-only change, save a text change, and export a filtered workbook for the active resource type. Observe the editor open path, save response timing, post-save translation/cache follow-up behavior, audit trail, and workbook response.
- Acceptance criteria: Place editor controls appear without waiting for nested offerings/translations when the managed summary has editor-ready fields; full detail fetch remains available as fallback; logo/media-only saves do not trigger translation refresh; unchanged tags do not rewrite tag links; map cache refresh can complete shortly after the save response; text edits still mark translations stale through the existing translation workflow; normal workbook exports keep the same workbook sheets while avoiding unrelated reference loads and browser-side full-page prefetch for server-filtered Places; large server-filtered Place exports complete as CSV rather than timing out in XLSX generation; no resource permission, ownership, visibility, search, pagination, Discover, My Directory, My Maps, audit schema, auth/session, Gmail/email, GudAuth, secret, or production database cleanup behavior changes.
- Verification result: focused server coverage passed `node --test server/test/hardAssetSummary.test.js server/test/hardAssetSaveFollowups.test.js server/test/softAssetSaveFollowups.test.js server/test/softAssetSummary.test.js server/test/tags.test.js` 9/9; focused workbook hotfix coverage passed `node --test server/test/workbookFilteredExport.test.js server/test/workbookContactFieldsSource.test.js server/test/workbookSecurity.test.js` 14/14 after the large-filtered-Place CSV fallback; focused resource-list source coverage passed `node --test client/test/resourceListLoading.test.js` 12/12 for the CSV export selector; focused client coverage passed `node --test client/test/resourceListLoading.test.js client/test/resourceWizardShellSource.test.js client/test/placeWizardSource.test.js` 18/18 after the export hotfix; full server coverage passed `npm run test:server` 473/473; `VITE_API_URL=https://api.carearound.sg/api VITE_TOWN_MAP_PROOF_ENABLED=true VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/default VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/gray VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL=https://maps.carearound.sg/v2/print-master-100-20260723/default VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL=https://maps.carearound.sg/v2/print-master-100-20260723/gray npm run build:client` passed with the existing large chunk warning. Broad client coverage was not green because `client/test/careCalendarPlanning.test.js` uses 2026-07-20 sample events that are expired on 2026-07-24 before conflict detection; no source diff touches Care Calendar. `git diff --check` passed on 2026-07-24.

### 2026-06-12 OneMap grey basemap readability

- Current behavior: Discover and Directory/My Maps use OneMap `Grey_HD` tiles instead of the more cluttered `Default_HD` or the over-simplified `GreyLite` style. The shared basemap still keeps OneMap attribution/logo and now allows native zoom level 19 so block numbers can render sharply when users zoom into HDB blocks.
- Known-good reference: the user-approved 2026-06-12 localhost preview at `/discover`, where `GreyLite` was cleaner but lost block numbers, and `Grey_HD` restored block numbers while keeping a calmer map background.
- Reproduction steps: open `/discover`, display the map, zoom into a block-level area such as Teck Whye, and confirm building/block labels remain visible. Open a Directory/My Map view and confirm the shared basemap still loads with pins, zoom controls, and OneMap attribution.
- Acceptance criteria: block numbers are visible at close zoom; map labels are sharper through native OneMap zoom 19; pins, clusters, map panel behavior, directory map captures, Discover results, search, ranking/filtering/visibility, saved assets, My Maps data, postal validation, auth, permissions, schema, Gmail/email, GudAuth, secrets, and backend APIs remain unchanged.
- Verification result: focused map coverage passed `node --test client/test/mapTheme.test.js client/test/directoryMapPresentation.test.js client/test/mapClusterInteraction.test.js client/test/mobileMapPanelBehavior.test.js` 17/17. The OneMap `Grey_HD` native tile for the Teck Whye sample returned `200` and showed block `38`; `GreyLite` at the same tile omitted the block number. `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning on 2026-06-12, and the built bundle contains `Grey_HD` without `GreyLite` or `Default_HD`.

### 2026-06-12 My Map notes autosave

- Current behavior: signed-in My Map owners no longer need a normal Save button for resource notes. Ordinary note text edits stay local while the owner is typing, then save when the notes panel closes, the owner returns to the notes list, or the page is hidden/refreshed with a keepalive save hint. Note removal and `Share this note` changes still save immediately. The editor shows `Saving...`, `Saved`, or a retry action after failures. Shared links are not republished automatically; the existing shared-note selection still only affects the next publish/update of a shared link.
- Known-good reference: locked Private Maps interactive, Shared maps, and My Map PDF rows above, plus the 2026-06-12 user request to remove the manual note-save step while preserving shared-note privacy and note/PDF behavior.
- Reproduction steps: sign in as a My Map owner, open `/my-directory/maps/:id`, open Map notes for a resource, type a note, confirm typing does not trigger a server save, close the notes panel or return to the notes list, and confirm the saved note appears after reload. Toggle `Share this note`, remove a note, and confirm those non-typing actions still save immediately. Repeat with a slow save response and confirm a newer draft is not overwritten by an older response.
- Acceptance criteria: note edits persist without pressing a normal Save button; failed saves surface retry without hiding the typed draft; slow or out-of-order save responses do not overwrite newer local note text; shared-map publication remains explicit; PDF note extraction, note timestamps, list-only resources, map pins, clustering, mobile map panel behavior, saved assets, Discover, ranking/filtering/visibility, auth, permissions, schema, Gmail/email, GudAuth, secrets, and backend APIs remain unchanged.
- Verification result: test-first coverage added `client/test/mapNotesAutosave.test.js`, which failed before the autosave helper existed and then passed 5/5 after the patch. Focused My Map/shared-note/PDF coverage passed `node --test client/test/mapNotesAutosave.test.js client/test/mapNotes.test.js client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js client/test/sharedMapContinuation.test.js client/test/sharedMapDirectoryListRefinement.test.js` 26/26. Full client coverage passed `node --test client/test/*.test.js client/src/lib/*.test.js` 215/215. `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning on 2026-06-12. No server, schema, auth, visibility, shared-link, PDF export, Gmail/email, GudAuth, secret, or production database change was introduced.

### 2026-06-13 My Map notes markdown helper

- Current behavior: My Map note text accepts the existing CareAround Markdown Lite formatting for bold, italic, bullet lists, numbered lists, and links. The note editor provides icon-only helper controls plus an optional preview so owners do not have to type markdown syntax manually. Notes are still stored and autosaved as the same plain text field; shared maps render only notes marked `Share this note`; and the My Map PDF ledger renders supported Markdown Lite note styling while keeping a clean plain-text fallback for extraction.
- Known-good reference: locked Private Maps interactive, Shared maps, My Map notes autosave, and My Map PDF ledger rows above, plus the 2026-06-13 user request for markdown notes with a markdown helper that avoids careful manual syntax typing.
- Reproduction steps: sign in as a My Map owner, open `/my-directory/maps/:id`, open Map notes for a resource, use the helper controls for bold, italic, bullet list, numbered list, and link formatting, toggle preview, wait for autosave, reload the map, and confirm the formatted note renders in the owner note view. Mark one note shared, update/publish the shared link, and confirm only shared notes render with safe Markdown Lite formatting. Download the My Map PDF and confirm the note keeps readable Markdown Lite styling with existing date labels and no table overflow.
- Acceptance criteria: markdown helper actions update only the note text draft and continue through the existing autosave payload; no raw HTML rendering or `dangerouslySetInnerHTML` is introduced for notes; unsupported or private notes are not exposed on shared links; shared-link publication remains explicit; PDF note cleanup removes markdown markers while preserving line breaks and list readability; note timestamps, list-only resources, map pins, clustering, mobile map panel behavior, saved assets, Discover, ranking/filtering/visibility, auth, permissions, schema, Gmail/email, GudAuth, secrets, and backend APIs remain unchanged.
- Verification result: test-first helper coverage passed `node --test client/test/mapNoteMarkdownToolbar.test.js` 5/5 after failing for the missing helper. Focused My Map/shared-note/markdown/PDF coverage passed `node --test client/test/mapNoteMarkdownToolbar.test.js client/test/markdownLite.test.js client/test/mapNotes.test.js client/test/mapNotesAutosave.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/sharedMapContinuation.test.js` 26/26, focused PDF coverage passed `node --test client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js client/test/myMapPdfExportButtonSource.test.js client/test/myMapPdfIntegrationSource.test.js` 19/19, and locale coverage passed `node --test client/test/i18n.test.js client/test/i18nCoverage.test.js` 4/4. Full client coverage passed `node --test client/test/*.test.js client/src/lib/*.test.js` 227/227; `npm run test:server` passed 350/350; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and smoke passed 5/5 using the configured smoke environment without exposing credentials. No Worker API, schema, auth, visibility, shared-link rule, Gmail/email, GudAuth, secret, or production database change was introduced.

### 2026-06-13 My Map notes adaptive text box

- Current behavior: the owner-side My Map note editor textarea grows to fit the note body as owners type, open existing long notes, or apply markdown-helper actions. The textarea hides its own inner scrollbar by default so the note card and overlay scroll naturally on mobile.
- Known-good reference: locked My Map notes autosave and markdown-helper behavior above, plus the 2026-06-13 mobile screenshot showing the note body clipped inside a small inner textarea.
- Reproduction steps: sign in as a My Map owner, open `/my-directory/maps/:id`, open Map notes for a resource, type or paste a multi-line note, apply markdown helper actions, close and reopen the note, and confirm the text box expands around the full note body without requiring an inner textarea scroll.
- Acceptance criteria: long note text remains visible in the editable box up to the existing note character limit; autosave, share-note toggles, note removal, markdown preview/helper actions, shared-link publication, PDF note cleanup, note timestamps, list-only resources, map pins, clustering, mobile map panel behavior, saved assets, Discover, ranking/filtering/visibility, auth, permissions, schema, Gmail/email, GudAuth, secrets, and backend APIs remain unchanged.
- Verification result: test-first adaptive textarea coverage passed `node --test client/test/adaptiveTextarea.test.js client/test/sharedMapDirectoryListRefinement.test.js` 8/8 after the missing helper red state. Focused note/autosave/shared-map/PDF coverage passed `node --test client/test/mapNoteMarkdownToolbar.test.js client/test/mapNotesAutosave.test.js client/test/mapNotes.test.js client/test/sharedMapContinuation.test.js client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js` 34/34. Full client coverage passed `node --test client/test/*.test.js client/src/lib/*.test.js` 231/231. `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning. No server, schema, auth, visibility, shared-link, PDF export, Gmail/email, GudAuth, secret, or production database change was introduced.
- Stable-preview follow-up: after mobile UAT showed disruptive movement while typing notes and preview opening as an extra block below the editor, the editor now reserves a stable autosave-status row and the Preview button toggles the same note body between edit and preview modes instead of mounting a second body below the textarea. Verification passed red-first source coverage in `client/test/sharedMapDirectoryListRefinement.test.js`, focused My Map note/autosave/shared-map/PDF coverage 44/44, full client coverage 233/233, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning. A phone-width local browser check against a mocked signed-in My Map confirmed the editor rendered with no console warnings, typing kept the autosave row at a stable 40px height through blank, `Saving...`, and `Saved`, and Preview mode had zero textareas with one note-body preview slot before toggling back to the editor. No server, schema, auth, visibility, shared-link, PDF export, Gmail/email, GudAuth, secret, or production database change was introduced.
- Typing-stability follow-up: after mobile UAT showed the note cursor moving while newly typed characters stopped appearing after the editor had worked briefly, the autosave row-sync now accepts server-returned note ids without replacing the active textarea key when the saved note content is unchanged. This protects the mobile keyboard/caret path because the server currently rewrites My Map notes by deleting and reinserting note rows, which can produce fresh note ids after autosave. Verification passed the new red-first autosave guard in `client/test/mapNotesAutosave.test.js`, focused My Map note/autosave/shared-map/PDF coverage 47/47, full client coverage 236/236, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-13. A phone-width local browser check against a mocked signed-in My Map confirmed the editor stayed focused after an id-changing autosave, kept exactly one textarea, showed `Saved`, and accepted a second line typed after the first save. No server, schema, auth, visibility, shared-link, PDF export, Gmail/email, GudAuth, secret, or production database change was introduced.
- Deferred-save follow-up: after mobile UAT still reproduced the unresponsive typing path, ordinary text input no longer starts a timed server autosave or blur flush. The editor now keeps typed notes local until an owner exits the note flow by closing the panel or returning to the resource list, while page hide/refresh triggers a best-effort keepalive save. `Share this note` and note removal remain immediate save actions. Verification passed focused My Map note/editor/shared-map/PDF coverage 47/47, full client coverage 238/238, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-13. A phone-width local browser check against a mocked signed-in My Map confirmed real keypresses continued appearing in the textarea, no server save occurred after a pause longer than the old autosave delay, closing the notes panel produced exactly one saved note, reopening showed the persisted note, and returning to the notes list saved the next edit. No server, schema, auth, visibility, shared-link, PDF export, Gmail/email, GudAuth, secret, or production database change was introduced.
- Character-limit follow-up: after UAT showed typing could still appear unresponsive when a long meeting note reached the silent 1000-character cap, the shared My Map note limit is now 3000 characters across the editor, client normalization, PDF extraction, API route validation, and shared-note translation input. The owner editor shows a live character counter and an explicit limit-reached message that directs users to split longer content into another note. Verification passed red-first coverage in `client/test/mapNotesAutosave.test.js`, `client/test/sharedMapDirectoryListRefinement.test.js`, and `server/test/myMapNoteLimitSource.test.js`; focused note/PDF/server/i18n coverage passed 32/32, wider My Map note/editor/shared-map/PDF/i18n coverage passed 53/53, focused server My Map/shared-note coverage passed 19/19, full client coverage passed 240/240, `npm run test:server` passed 351/351, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning on 2026-06-13. Local browser verification was not run because the dev server was stopped and this checkout does not contain the local server env file. No schema, auth, visibility, shared-link rule, Gmail/email, GudAuth, secret, or production database change was introduced.
- Hidden-trim and preview-label follow-up: production UAT showed the editor displayed `1000 / 3000 characters` but still stopped accepting text after 1000 characters because two owner-editor local update paths still sliced text to 1000 after the textarea limit had been raised. Those hidden trims now use `MAP_NOTE_MAX_LENGTH`, ordinary typing no longer surfaces the visible Saving/Saved pill, and the preview toggle now shows an explicit `Preview` label in editor mode and `Edit` label in preview mode. The save-status pill remains for immediate note actions such as `Share this note`, note removal, and manual retry. Verification on 2026-06-13 passed red-first source coverage in `client/test/sharedMapDirectoryListRefinement.test.js` 13/13 after the new tests failed against the hidden trims, visible-save-state contract, and missing explicit preview/edit label; focused notes/i18n coverage passed 17/17; wider My Map note/editor/shared-map/PDF/i18n coverage passed 56/56; full client coverage passed 243/243; `npm run test:server` passed 351/351; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and `git diff --check` passed. No server, schema, auth, visibility, shared-link rule, Gmail/email, GudAuth, secret, or production database change was introduced.
- Exit-stability follow-up: after production UAT confirmed the 3000-character limit and Preview/Edit toggle were fixed but typing still moved the editor and Back/Close appeared unresponsive, live textarea resizing is now capped at 260px before switching to inner textarea scroll, and Back/Close start a keepalive deferred save without waiting for that save to finish before exiting. Verification on 2026-06-13 passed red-first source coverage in `client/test/adaptiveTextarea.test.js` and `client/test/sharedMapDirectoryListRefinement.test.js` 18/18 after the new tests failed against the uncapped textarea and blocking exit-save behavior; wider My Map note/editor/shared-map/PDF/i18n coverage passed 58/58; full client coverage passed 245/245; `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning; and `git diff --check` passed. A local browser harness against `http://localhost:4173/my-directory/maps/87` could not be used as release evidence because the protected-route auth shell redirected to login before the mocked session settled. No server, schema, auth, visibility, shared-link rule, Gmail/email, GudAuth, secret, or production database change was introduced.

### 2026-06-14 My Map V2 preview scaffold

- Current behavior: branch `codex/my-map-print-v2-refresh` promotes the owner My Map V2 map/list layout to the default route at `/my-directory/maps/:id`, while the classic My Map UI remains reachable through `/my-directory/maps/:id?ui=stable` for rollback parity. Print view still takes priority when `view=print` is present. V2 keeps the stable V1 owner toolbar/search/distance header instead of the experimental V2 header, then renders the new map/list body underneath. V2 maps use main saved-place pins without the small resource/note count badge and deliberately disable the cluster layer so close pins behave like normal single markers, matching the main Discover map interaction model. Hard assets that share the same postal code now use one same-postal saved-place pin, with the inner circle split by the hard-asset category colors when multiple hard categories share that postal code; the resource cards remain separate. Hovering the shared postal pin highlights all same-postal member cards, and clicking a member card still focuses the shared pin. The map camera fits the visible pin coordinates, with enough top padding for saved-place pin artwork so top-edge pins are not clipped. The first-preview map sizing is restored after the larger height/width experiment was rolled back. V2 interactive resource cards use the saved asset logo or category fallback icon instead of numbered badges, and the old numbered legend is hidden in V2 because it no longer describes the interactive pin/card language. Owner print refinement is KIV for this release after UAT showed the print pin-numbering/spreading experiment was not improving enough; do not include that parked print experiment unless it is explicitly reopened. The rejected full-map experiment is not exposed in V2. The classic My Map fallback keeps numbered pins, numbered cards, legend, and the previous bubble cluster style.
- Known-good reference: local stable rollback tag `stable/my-map-before-facelift-2026-06-14` at commit `5e9cc1e5`, plus the locked Private Maps interactive, Shared maps, OneMap grey basemap, notes autosave, markdown helper, adaptive text box, and PDF ledger rows above.
- Reproduction steps: open an owner map at `/my-directory/maps/:id` and confirm the top toolbar/search/distance controls match the stable V1 owner header. Confirm the V2 body renders individual resource cards with badge-free main saved-place pins, one split-color saved-place pin for hard assets that share a postal code, no numbered legend, the restored first-preview map sizing, cards with permanent asset logos/icons, and no cluster marker wrapper. Hover a same-postal split pin and confirm all member cards highlight together without rendering duplicate pins for the same postal-code group; click a member card and confirm the map focuses the shared pin. Confirm the initial fit keeps the top-most visible pins inside the map frame instead of clipping the pin head. Confirm there is no Full map action in the default V2 view. Open `/my-directory/maps/:id?ui=stable` and confirm the classic UI renders with numbered circle markers, numbered resource cards, legend, and the previous bubble cluster style. Add `?view=print` to either route and confirm print view still opens instead of the interactive layout.
- Acceptance criteria: V2 is the default owner My Map view and remains reversible through the explicit classic fallback; no API, schema, auth, permission, shared-link, PDF-export, note-storage, postal validation, ranking/filtering/visibility, Gmail/email, GudAuth, secret, or production database behavior changes are introduced; My Map V1 remains available as the rollback path.
- Verification result: 2026-06-16 user UAT confirmed the default V2 pin framing sits comfortably inside the map. Focused V2/default-map coverage passed `node --test client/test/myMapV2Scaffold.test.js client/test/directoryMapMarkerMode.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapPresentation.test.js client/test/directoryMapCamera.test.js client/test/mapClusterInteraction.test.js client/test/mapTheme.test.js` 45/45. Full client coverage passed `node --test client/test/*.test.js client/src/lib/*.test.js` 267/267. Full server coverage passed `npm run test:server` 351/351. `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed. Authenticated smoke could not be run from the fresh shell because the smoke environment variables were not present; do not treat smoke as passed for this release unless it is rerun from a credentialed shell. No Worker API, schema, auth, permission, shared-link, PDF-export, note-storage, postal validation, ranking/filtering/visibility, Gmail/email, GudAuth, secret, or production database change was introduced.
- Toolbar follow-up: after production UAT showed the V2 header/search/action block was visually scattered compared with the stable V1 owner toolbar and the mobile V2 header had no mobile controls behavior, the V2 scaffold now delegates its desktop toolbar slot back to the existing `OwnerHeader` path and renders the existing `MyMapMobileControls` outside the padded V2 content so the original mobile sticky/drawer behavior is preserved. V2 changes remain limited to the map/list body. Verification passed focused V2/map coverage 45/45, full client coverage 267/267, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check` on 2026-06-16. No API, schema, auth, permission, shared-link, PDF-export, note-storage, postal validation, ranking/filtering/visibility, Gmail/email, GudAuth, secret, or production database change was introduced.
- Camera-padding follow-up: after mobile and desktop UAT showed the top pin framing was correct but the bottom map gap was visually larger, `DirectoryMap` now supports optional fit-padding overrides while preserving the shared defaults for stable My Map and shared-map surfaces. The V2 scaffold alone passes a tighter bottom-right fit padding so the initial camera zooms in slightly without reducing the top artwork protection for saved-place pins. Verification passed focused V2/map coverage 45/45, full client coverage 267/267, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check` on 2026-06-16. No API, schema, auth, permission, shared-link, PDF-export, note-storage, postal validation, ranking/filtering/visibility, Gmail/email, GudAuth, secret, or production database change was introduced.
- Card-ordering follow-up: V2 now uses a dedicated card presentation mode so the classic fallback, Shared maps, PDF export, postal validation, and existing geography-numbering path stay unchanged. V2 card order is mappable resources first, then not-shown-on-map resources; within each group it sorts by category A-Z and then resource name A-Z. Desktop columns split that ordered sequence in half from left to right, while mobile renders the same sequence vertically. Not-shown-on-map resources render as normal cards rather than a separate special section, but their logo tile does not trigger a map jump because no pin exists. Postal codes with multiple hard assets render one card per hard asset; the map still spreads close pins for reachability, and hovering a same-postal pin highlights all same-postal hard-asset cards. Slim category pills appear above each category run in V2 only. Verification passed `node --test client/test/directoryPresentationV2Order.test.js client/test/directoryPresentationLayout.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js client/test/directoryMapMarkerMode.test.js` 41/41, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 273/273, and `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-16. No API, schema, auth, permission, shared-link, PDF-export, note-storage, postal validation, ranking/filtering/visibility, Gmail/email, GudAuth, secret, or production database change was introduced.
- Category-color/address follow-up: V2 My Map now uses configured sub-category colors as the visual category language for the interactive map/list body. Category icons move out of V2 pins and into the category-run header beside the category pill; the pill adopts the category color while the `Unmapped` pill remains gray, and the category icon tile stays white with a colored outline. V2 saved-place pins keep the original teal body while the inner circle shows the hard-asset category color, or a split fill when multiple hard asset categories share the same postal-code pin. Soft asset rows do not add extra pin-color segments, though they still keep their normal card/category presentation. V2 logo cards show the resource name first and render the address directly underneath inside the title column with tight line-height, so the note badge column cannot add extra vertical space between the name and address. V2 presentation can recover a mapped hard-asset address from row-level address data when an older place snapshot is missing it, can keep postal-only Singapore addresses visible instead of stripping them to a blank line, and the owner page can backfill missing hard-asset addresses from the existing hard-asset detail endpoint without mutating map ownership, auth, schema, or production data. The owner My Map page also hydrates rows from the shared public sub-category metadata so colors appear even when an older My Map directory payload already has icons but not color fields. Classic My Map fallback and shared-map print keep their previous numbered/icon defaults. Verification passed focused V2/category/map coverage `node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js server/test/myMapDirectoryCategorySource.test.js` 48/48, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 282/282, full server coverage `npm run test:server` 352/352, production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check` on 2026-06-17.
- Tablet body-alignment follow-up: after 2026-06-18 tablet UAT showed the V2 owner map/list body hugging the left side and later confirmed the desktop-style tablet body is more useful than the stacked/mobile body, the V2 owner toolbar and three-column map/list body both activate from 1024px. The first desktop grid tier now uses compact tablet-fit side lanes, map width, and gap sizing before the larger `xl` desktop layout resumes. This keeps the side-by-side desktop experience on landscape tablets without forcing the wider desktop grid into too narrow a row, while leaving classic `?ui=stable`, shared maps, print view, pins, data ordering, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, and production data unchanged. Verification passed focused V2/tablet source coverage `node --test client/test/myMapV2Scaffold.test.js`, related My Map/map/mobile coverage `node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js client/test/mobileMapPanelBehavior.test.js` 59/59, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-18.
- Print KIV note: the 2026-06-17 owner print number-badge/toolbar/spreading experiment was parked locally and intentionally excluded from the stable My Map V2 release because UAT did not improve enough. Shared-map print remains classic until explicitly refreshed.
- Owner print bubble-layout follow-up: after 2026-06-18 UAT showed print badge `3` could still be covered by the joined `7/11` badge and nearby hover targets could feel unstable, the owner V2 print map now measures each rendered badge lobe after Leaflet positions the real coordinates, then applies a print-only, scale-aware bubble layout by marker margin so nearby number badges can touch but not cover each other. The visible lobe alone receives pointer events so transparent icon boxes no longer steal hover/click targets. A hover/selection state refresh now reruns the print badge layout after React/Leaflet redraws selected marker HTML, so hovering any pin does not drop the settled bubble offsets. The print badge solver also preserves settled offsets during focused zoom/reset camera movement, restoring remembered offsets while the map is moving and waiting for the full bubble solve until the map settles, so refreshed marker DOM does not briefly fall back to centred/base margins. Saved coordinates, V2 interactive saved-place pins, classic My Map, shared-map print, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification passed `node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js` 51/51, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 286/286, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check` on 2026-06-18. Local browser verification at `http://localhost:5175/my-directory/maps/87?view=print` confirmed visible labels `3`, `7`, `11`, `12`, and `1` resolve to their own lobe hit targets before hover and after hovering print badges `2` and `11`; the gap between `11` and `12` resolves to the map rather than a hidden marker box, and the settled external badge-overlap count around the problem cluster is zero. A follow-up zoom/reset sample confirmed pin `2` keeps its solved margin after focused zoom and all visible print badges keep their solved margins throughout reset while their screen positions move only with the map camera.
- Tablet print/distance-default follow-up: after 2026-06-18 tablet UAT showed the owner print preview map clipped at the bottom and mobile/tablet My Map still picked up the profile home postal code by default, the owner print screen preview now reserves the measured scaled sheet height instead of using a negative bottom margin that can crop the scaled map. My Map also opts out of the shared directory-distance hook's home-default behavior and uses a new no-default session-storage key so older auto-home state from previous builds does not re-enable home distance on mobile/tablet. The Home control remains available for manual activation, Shared maps keep their existing distance-anchor defaults, and V2 interactive pins/cards, classic `?ui=stable`, shared-map print, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification passed `node --test client/test/directoryDistanceAnchor.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js client/test/mobileMapPanelBehavior.test.js` 64/64, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 291/291, full server coverage `npm run test:server` 352/352, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-18.
- Hosted-programme category follow-up: after 2026-06-18 UAT showed `REACH Senior Centre @ Bukit Gombak Vista (BGV)` was added as programme rows but should still sit under the host place category on My Map, hosted programme rows can now carry additive host-place map category metadata. V2 uses that host category for the card category run, category icon/color, and saved-place pin color when the host place itself was not saved, while the row's own programme `subCategory`, programme detail path, eligibility, visibility, saved asset, and notes remain unchanged. Classic `?ui=stable`, shared maps, print view, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification passed `node --test client/test/directoryPresentationV2Order.test.js server/test/myMapDirectoryCategorySource.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapMarkerMode.test.js` 55/55 on 2026-06-18.
- Hosted-programme logo follow-up: after 2026-06-18 UAT showed hosted programme-only rows could show the soft programme category icon instead of the host asset logo, hosted programme rows now fall back to the mapped host place logo when the soft asset has no own logo. The row still keeps the programme resource identity, detail path, category facts, eligibility, visibility, saved asset, and notes, while the existing host category metadata continues to drive the V2 category run/pin color. Classic `?ui=stable`, shared maps, print view, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification passed focused My Map coverage `node --test client/test/directoryPresentationV2Order.test.js server/test/myMapDirectoryCategorySource.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapMarkerMode.test.js` 55/55, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 292/292, full server coverage `npm run test:server` 353/353, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-18.
- Shared Map facelift alignment follow-up: after owner My Map and owner print refinements were accepted on 2026-06-18, the interactive Shared Map page now opts into the same V2 card presentation, category pills, logo-first cards, teal saved-place pins with category-colored inner fills, same-postal grouping, and wider tablet/desktop map-list body used by the refreshed My Map. Shared Map also hydrates public sub-category color/icon metadata for older frozen share snapshots before rendering, while keeping the shared route, share token, guest access, sign-in continuation, copy/save actions, note translation, distance controls, and Shared Map print path unchanged. Classic owner My Map fallback, owner print, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification passed focused Shared Map/My Map coverage `node --test client/test/sharedMapContinuation.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/directoryMapMarkerMode.test.js client/test/myMapV2Scaffold.test.js` 59/59, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 294/294, full server coverage `npm run test:server` 353/353, production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, and `git diff --check` on 2026-06-18.
- Share-link update nudge follow-up: after 2026-06-18 UAT showed an existing shared link could be mistaken for the live owner map after new resources were added, the owner Share dialog now detects when the map has changed after `shareUpdatedAt` and asks the owner to update the existing shared link. The stale state keeps `Copy existing link` separate from the primary `Update shared link` action, while an up-to-date shared link still prioritizes copying. Shared links remain frozen snapshots until the owner intentionally updates them; no auto-publish, token regeneration, shared-map visibility, auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, or production data behavior changed. Verification passed focused share/i18n/shared coverage `node --test client/src/lib/shareMapStatus.test.js client/test/shareMapModal.test.js client/test/i18nCoverage.test.js client/test/sharedMapContinuation.test.js` 13/13, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 298/298, full server coverage `npm run test:server` 353/353, production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, `git diff --check`, and production smoke `set -a; source ./smoke.env; set +a; npm run test:smoke` 5/5 on 2026-06-19 without printing smoke secret values.
- Category bubble marker follow-up: after 2026-06-19 design review approved aligning My Map, Shared Map, and print marker behavior around the proven print bubble layout, owner My Map V2 and interactive Shared Map now use category-icon bubble markers. The same same-postal resource grouping stays intact, but each resource contributes its own visible 28px bubble lobe with its category icon on a white fill and a category-colored outer ring; a category-colored heart icon remains the fallback when no category icon is available. The shared bubble collision solver keeps nearby lobes readable and pointer-safe by settling marker margins while preserving the real coordinates and using only the visible lobe as the hover/click target. Category bubbles reuse remembered solved offsets as the warm start for later idle collision passes, so a late redraw does not collapse already-separated bubbles back into an overlapping cluster until hover refreshes the layout. Owner print keeps numeric badge bubbles, shared-map print stays on its print path, and classic owner My Map remains available at `?ui=stable` with numbered markers. Auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, production data, shared-link token behavior, and Worker/API behavior remain unchanged. Verification passed focused My Map/Shared Map marker coverage `node --test client/test/directoryMapMarkerMode.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/sharedMapDirectoryListRefinement.test.js` 60/60, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 299/299, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning on 2026-06-19.
- Category bubble drift follow-up: after 2026-06-19 production UAT showed interactive category bubbles could later regress to overlapping centered marker margins until hover refreshed the layout, the category-bubble collision sync now watches the Leaflet marker pane for late style or DOM resets while solved offsets are being preserved. If a rendered bubble drifts away from its remembered solved margin, the stored offset is restored immediately and a normal collision pass is scheduled, keeping My Map and interactive Shared Map bubbles in the settled solver state without requiring hover. Owner print remains on its numeric print-badge path, shared-map print stays unchanged, and classic owner My Map remains available at `?ui=stable` with numbered markers. Auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, production data, shared-link token behavior, and Worker/API behavior remain unchanged. Verification passed focused marker coverage `node --test client/test/directoryMapMarkerMode.test.js` 12/12, focused My Map/Shared Map marker coverage `node --test client/test/directoryMapMarkerMode.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/sharedMapDirectoryListRefinement.test.js` 60/60, full client coverage `node --test client/test/*.test.js client/src/lib/*.test.js` 299/299, full server coverage `npm run test:server` 353/353, production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning, `git diff --check`, production smoke `set -a; source ./smoke.env; set +a; npm run test:smoke` 5/5 without printing smoke secret values, and production API health OK on 2026-06-19.
- Discover saved-place top-framing follow-up: after 2026-06-19 production UAT showed northern Discover saved-place pins clipped against the top of the map viewport, Discover's saved-place fit camera first moved to a conservative 72px top clearance before fitting bounds. This is limited to Discover map camera padding for saved-place framing; Discover ranking, filtering, visibility, result counts, saved assets, distance anchors, My Directory, My Maps, Shared Maps, auth/session, schema, permissions, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed on the old 18px desktop top padding with `node --test client/test/discoveryMapCamera.test.js`, then passed after the padding fix. Focused Discover/map coverage passed 18/18 with `node --test client/test/discoveryMapCamera.test.js client/test/discoveryLocationAnchor.test.js client/test/discoverySearchPanelBehavior.test.js client/test/mapClusterInteraction.test.js client/test/mapTheme.test.js`; full client coverage passed 300/300 with `node --test client/test/*.test.js client/src/lib/*.test.js`; `git diff --check` passed; and production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-19.
- Discover balanced top-padding UAT follow-up: after 2026-06-19 UAT showed the conservative 72px Discover top padding felt too pulled back, the tighter 40px option was under review, 60px could still trigger a large Leaflet fit-zoom threshold jump, and mobile lower-right saved clusters could be clipped by the viewport edge, the Discover saved-place fit camera now keeps a balanced 60px top padding on desktop, gives mobile saved-place fits 60px left/top clearance plus 96px right and 72px bottom clearance, and uses 0.1 zoom snapping so fitted bounds can settle between whole zoom levels. This is now a locked Discover camera contract: future changes should not restore whole-step fit zoom or change the saved-place fit padding without rerunning the Discover camera regression test and UAT. Discover ranking, filtering, visibility, result counts, saved assets, distance anchors, My Directory, My Maps, Shared Maps, auth/session, schema, permissions, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Discover/map coverage 19/19 with `node --test client/test/discoveryMapCamera.test.js client/test/discoveryLocationAnchor.test.js client/test/discoverySearchPanelBehavior.test.js client/test/mapClusterInteraction.test.js client/test/mapTheme.test.js` on 2026-06-19.
- Discover search-tools refinement: after 2026-06-19 UAT requested a cleaner Discover search panel, the desktop Discover tools now place name/service/tag/address search and Area scope on the first row, with postal/Home/Locate location controls on the second row. Postal input resolves automatically after a valid 6-digit Singapore postal code is entered, so the explicit search button was removed from desktop and mobile filter surfaces. Radius distance filtering and radius selectors were removed; location context still sets the anchor, distance values, and distance sorting, but no longer hides resources by a radius threshold. Discover ranking, text matching, category tabs, Area boundary scope, saved-only filtering, result visibility, saved assets, My Directory, My Maps, Shared Maps, auth/session, schema, permissions, postal validation rules, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Discover/search coverage 21/21 with `node --test client/test/discoverySearchTools.test.js client/test/discoverySearchPanelBehavior.test.js client/test/discoveryLocationAnchor.test.js client/test/discoveryMapCamera.test.js client/test/mapClusterInteraction.test.js client/test/mapTheme.test.js` on 2026-06-19.
- Group asset V1 Discover/public collection: after 2026-06-20 design alignment, Group is a public-facing soft asset mode (`assetMode=group`) that collects exact public Places plus public non-Group soft assets, using `soft_asset_group_members` for membership. Groups are not a fourth Place bucket, hard/place assets cannot add a Group into their programme/service/promotion buckets, and Groups cannot nest other Groups. A Group with zero public members is excluded from public Discover. Public Group cards and detail pages show collection/member context separately from Place offering buckets. Groups do not create their own map pins or saved-place pins; saving a Group saves only the Group resource, while Discover Area filtering and Group search may use the exact public member locations and searchable member text. Discover ranking, category tabs, saved-only filtering, existing Place/programme/service/promotion visibility rules, My Directory/My Maps/Shared Maps, auth/session, permissions, postal validation rules, Gmail/email, GudAuth, secrets, Worker deploy behavior, and production data remain unchanged. This change intentionally adds schema/bootstrap support for exact Group membership and a dashboard Resources Groups tab/editor for manual member selection. Verification on 2026-06-20 passed focused server coverage 22/22 with `node --test server/test/softAssetGroups.test.js server/test/softAssetHierarchy.test.js server/test/softAssetSummary.test.js server/test/cleanSlate.test.js server/test/boundarySchema.test.js server/test/cacheBuilder.test.js`; focused client/Discover guardrail coverage 30/30 with `node --test client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/groupAssetUiSource.test.js client/test/discoverySearchTools.test.js client/test/discoverySearchPanelBehavior.test.js client/test/discoveryLocationAnchor.test.js client/test/discoveryMapCamera.test.js client/test/mapClusterInteraction.test.js client/test/mapTheme.test.js`; full server coverage `npm run test:server` 358/358; production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` with the existing large chunk warning; and `git diff --check`. No push or production deploy was performed.
- Group member picker UAT follow-up: after 2026-06-20 local UAT showed Group member search could return partial, inconsistent, or empty results across refreshes, the Group modal no longer reuses the dashboard's paged visible resource lists as its candidate source. Opening Create/Edit Group now loads a dedicated full paginated candidate set for eligible Places and public non-Group soft assets, then the picker searches that stable in-modal dataset. This leaves the main dashboard pagination, Discover search/ranking/visibility, Place offering buckets, My Directory/My Maps/Shared Maps, auth/session, permissions, postal validation rules, Gmail/email, GudAuth, secrets, Worker deploy behavior, and production data unchanged. Verification first failed against the old paged-list wiring with `node --test client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group/Discover guardrail coverage passed 18/18 with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/discoverySearchTools.test.js client/test/discoverySearchPanelBehavior.test.js`, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning.
- Group member search source follow-up: after 2026-06-25 production UAT showed Edit Group > Members returned `No available public members found` for `ntuc` even though public `/hard-assets?q=ntuc` returned 59 visible Place rows, the Group member candidate loader now uses a dedicated public candidate parameter set instead of the dashboard managed-resource params. This keeps the picker searchable across existing public Places and public non-Group soft assets, while the Group form still filters out hidden Places, member-only offerings, non-public soft assets, and nested Groups before showing addable rows. Dashboard managed-list pagination/search, direct Owner/Staff Group management, Group readiness, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, permissions, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the managed-param candidate source with `node --test client/test/resourceListLoading.test.js client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group/Discover/access coverage passed 84/84 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/privateResourceContent.test.js server/test/resourceTranslations.test.js server/test/visibility.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/governanceOrganizationUi.test.js client/test/resourceListLoading.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-25.
- Group member search source release follow-up: implementation commit `eb43726f` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://c7639f86.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://013e833a.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/dashboard/resources` returned `200` and served `assets/index-DThenZHa.js`; production API health returned OK; public `/hard-assets?q=ntuc` returned `200` with 59 visible Place rows; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group form media-upload follow-up: after 2026-06-20 local UAT requested upload support instead of raw logo/banner URL entry, the Group create/edit form now reuses the existing shared `ImageUpload` component for Group logo/icon and hero banner images. This uses the already protected `/upload` media path and does not add a new upload endpoint, storage flow, schema field, Discover search/ranking/visibility rule, Place offering bucket behavior, My Directory/My Maps/Shared Maps behavior, auth/session change, permission change, Gmail/email change, GudAuth change, secret change, Worker deploy behavior, or production data change. Verification first failed against the raw URL inputs with `node --test client/test/groupAssetUiSource.test.js`, then passed after the form swap. Focused Group/Discover guardrail coverage passed 19/19 with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/discoverySearchTools.test.js client/test/discoverySearchPanelBehavior.test.js`, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning.
- Group save-error clarity follow-up: after 2026-06-20 local UAT showed the Save Group button could flash `Saving...` and return to `Save Group` without an obvious created resource, investigation confirmed the local preview was still connected to the deployed API while the Group server/schema work remains local. A deployed API probe for `assetMode=group` returned standalone offerings, confirming the live Worker does not yet support the new Group mode. The Group form now maps the old API rejection into a clearer message and shows the save error near the submit buttons as well as the top of the modal. This is a client-side clarity fix only; actual Group creation still requires the Worker/schema release gate. Verification first failed for the missing clearer error helper with `node --test client/test/groupAssets.test.js`, then passed after the fix. Focused Group/Discover guardrail coverage passed 20/20 with `node --test client/test/groupAssets.test.js client/test/groupAssetUiSource.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/discoverySearchTools.test.js client/test/discoverySearchPanelBehavior.test.js`, and production-style client build `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning.
- Group Resource V2 and Region Group sunset follow-up: after 2026-06-23 product review concluded Region Groups do not add enough user value and public Groups should become first-class managed resources, Region Groups are now hidden from the normal Admin Tools tab list while their backend/schema behavior remains dormant for audit and rollback. Public Groups now use a guided Profile, Access, Members, Review flow; profile fields include description, schedule/notes, logo, banner, one gallery image, tags, contact/WhatsApp/email, CTA, and freshness/review notes, while address, postal code, map pin, eligibility, availability, service-region routing, Admin area, and legacy Owner dropdown are excluded. Group creation accepts initial direct Owner/Staff access and initial members through the existing soft-asset API, and saving requires at least one active direct Group Owner. Group management now follows direct Group Owner/Staff access: Owners and Staff can edit details and members; Owners and Super Admins can manage access, visibility, and deletion. Public readiness now requires the Group to be visible, have at least one active direct Owner, and have at least one valid public member. Groups still do not create map pins, cannot include Groups, cannot be added into Place offering buckets, and do not inherit management from Admin area, Region Groups, or Organisation governance. Verification passed focused Group/Discover/governance/access coverage 46/46 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/governanceGroups.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/governanceOrganizationUi.test.js`; full server coverage passed `npm run test:server` 359/359; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and production smoke passed 5/5 on 2026-06-24. Release follow-up: implementation commit `d2c2dc2a` was pushed to `codex/my-map-category-bubbles`; Cloudflare Worker `senior-resource-map-api` deployed version `34dbdd4a-82ce-431a-8934-2daa73b675e3`; Cloudflare Pages preview deployed `https://b19c4cb6.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://1eea20a5.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-eOS9G2F6.js`; production API health returned OK; and the public Group soft-asset endpoint returned `200` with a Group-mode response shape. No production data change, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group access nested-form UAT follow-up: after 2026-06-24 production UAT showed Edit Group > Access could return to the Resources dashboard when adding access, investigation found the Group wizard rendered as an outer submit form while the embedded Asset Access panel rendered its own Add access form. The Group wizard is now a non-form container, and Save Group is an explicit button action, so Add access submits only the access panel request and does not trigger Group save/navigation. This is a client-only form containment fix; direct Owner/Staff permissions, final-owner protection, Group readiness, Discover visibility, schema, auth/session, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the nested outer form with `node --test client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group/Discover/governance/access coverage passed 47/47 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/governanceGroups.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/governanceOrganizationUi.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-24.
- Group review-notes and Access button UAT follow-up: after 2026-06-24 UAT confirmed the Group `Review notes` field was not shown publicly and created redundant entry work, the Group wizard no longer exposes or saves that misleading field. The Group row Access button also now keeps its inline Group access drawer open on the Groups tab; the previous inline-action cleanup treated any non-soft drawer outside the hard-assets tab as stale and immediately cleared Group access. This is a client-only dashboard/form fix; direct Owner/Staff permissions, final-owner protection, Group readiness, Discover visibility, schema, auth/session, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the lingering review field and stale inline-action guard with `node --test client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group/access coverage passed 24/24 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-24.
- Group Resource V3 target-region visibility slice: after 2026-06-24 product alignment, Groups now adopt the Offering-style `Who can see this?` control while using existing Region boundaries as `Target region/s` instead of audience zones or target areas. Public Groups remain visible to everyone once readiness passes. Target-region Groups require at least one selected existing Region, remain manageable by direct Group Owner/Staff and Super Admins, and are excluded from public/guest discovery unless the signed-in viewer has a matching profile Region. The selected Region list also acts as the Group public area/boundary context for this V3 slice. Groups still do not create map pins, cannot include other Groups, cannot be added into Place offering buckets, and do not inherit management from Admin Region Scope, Region Groups, Organisation governance, or target-region selection. Existing member visibility rules remain unchanged: target-region Groups can collect public Places and public non-Group soft assets, while member-only, hidden, restricted, partner-boundary, audience-zone-only, or nested Group members stay excluded from the public Group payload. This slice does not add new Region-boundary creation, restricted notes/files, translation-management UI, schema changes, auth/session changes, postal validation changes, Discover ranking changes, Gmail/email changes, GudAuth changes, secrets, or production data changes. Verification passed focused Group/Discover/governance/access coverage 61/61 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/governanceGroups.test.js server/test/visibility.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/governanceOrganizationUi.test.js`; full server coverage passed `npm run test:server` 361/361; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-24. Release follow-up: implementation commit `33fb243a` was pushed to `codex/my-map-category-bubbles`; Cloudflare Worker `senior-resource-map-api` deployed version `c6c45eca-25e7-44ea-ab76-fae8e767406e`; Cloudflare Pages preview deployed `https://b6727b6f.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://2512d899.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-DcW5GNIH.js`; production API health returned OK; and production smoke passed 5/5. No production data change, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group Resource V3 protected-management slice: after 2026-06-24 product alignment that Groups should reach Place/Offering-quality management depth without losing the wizard UX, saved Groups now expose the shared translation-review panel and restricted notes/files panel on the Review step using the existing `soft` resource API path. Group management remains direct Owner/Staff only; normal users and guests remain outside dashboard Resources, while direct Group assignees can see the Groups tab without being granted broad Group creation rights. Group creation remains hidden unless the user already has managed-resource creation authority, and Groups still do not create map pins, cannot include Groups, cannot be added into Place offering buckets, and do not inherit management from Admin Region Scope, Region Groups, Organisation governance, or target-region selection. This slice does not add new schema, new API routes, new Region-boundary creation, auth/session changes, postal validation changes, Discover ranking changes, Gmail/email changes, GudAuth changes, secrets, or production data changes. Verification first failed against the missing protected panels and broad Groups-tab gate with `node --test client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group/protected-management coverage passed 69/69 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/privateResourceContent.test.js server/test/resourceTranslations.test.js server/test/visibility.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/governanceOrganizationUi.test.js`; full client coverage passed 317/317 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 362/362; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-24. Release follow-up: implementation commit `6a9bd7c5` was pushed to `codex/my-map-category-bubbles`; Cloudflare Worker `senior-resource-map-api` deployed version `5b2e98d0-105f-42aa-8e85-1ca8646d197c`; Cloudflare Pages preview deployed `https://b63c6290.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://dfaefb4e.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-C1eL4BDk.js`; production API health returned OK; and production smoke passed 5/5. No production data change, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group Resource V3 public-detail parity slice: after 2026-06-24 product alignment that public Groups should feel closer to Place/Offering-quality resource pages while preserving the wizard model, Group public detail pages now surface collection visibility, target-region summary when applicable, last-reviewed freshness date, uploaded gallery images, schedule/notes, contact phone, WhatsApp, email, CTA link, tags, and included-resource sections in the public resource detail experience. This is a client presentation slice only: Groups still do not create map pins, cannot include Groups, cannot be added into Place offering buckets, and do not inherit management from Admin Region Scope, Region Groups, Organisation governance, or target-region selection. The change does not add address, postal code, service-region routing, eligibility, availability, new Region-boundary creation, schema changes, API route changes, auth/session changes, postal validation changes, Discover ranking changes, Gmail/email changes, GudAuth changes, secrets, or production data changes. Verification first failed against missing public-detail helper/source coverage with `node --test client/test/groupAssets.test.js client/test/groupAssetUiSource.test.js`, then passed after the fix on 2026-06-25. Focused Group/public-detail coverage passed 71/71 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/privateResourceContent.test.js server/test/resourceTranslations.test.js server/test/visibility.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/governanceOrganizationUi.test.js`; full client coverage passed 319/319 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 362/362; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed. Release follow-up: implementation commit `70c8099f` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages preview deployed `https://2af4c26e.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://3b885e89.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-CZyOJbjk.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, production data change, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group Resource V3 profile/accountability slice: after 2026-06-25 product alignment that Group should keep the wizard UX but feel closer to Place-quality resource management, the Group Profile step now saves a Group sub-category, website, and supported social media links, while the public Group detail page renders Group website/social links through the same visible resource-link path used by Places. The manual `Freshness date` field was removed from the Group wizard; Group create/update now automatically stamps the editing user on the soft asset, and dashboard/public Group surfaces show a subtle `Last updated` record using the saved editor name plus update date when available. The change intentionally adds `soft_assets.website`, `soft_assets.social_links`, and `soft_assets.updated_by_user_id` schema/bootstrap support and keeps these lightweight profile/accountability fields on Group dashboard summaries. Groups still do not create map pins, cannot include Groups, cannot be added into Place offering buckets, and do not inherit management from Admin Region Scope, Region Groups, Organisation governance, or target-region selection. This slice does not add address, postal code, eligibility, availability, service-region routing, new Region-boundary creation, auth/session changes, postal validation changes, Discover ranking changes, Gmail/email changes, GudAuth changes, secrets, or production data changes. Verification first failed against missing update-summary helper, Group profile/social controls, and soft-asset bootstrap columns with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js server/test/phoneIdentitySchema.test.js`, then passed after the fix. Focused Group/profile/schema coverage passed 25/25 with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js server/test/phoneIdentitySchema.test.js`; focused server schema/summary coverage passed 18/18 with `node --test server/test/boundarySchema.test.js server/test/softAssetSummary.test.js server/test/phoneIdentitySchema.test.js`; full client coverage passed 320/320 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 364/364; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-25.
- Group Resource V3 profile/accountability release follow-up: after the local Neon `DATABASE_URL` was restored on 2026-06-25, the explicit schema gate `npm run bootstrap:boundary-schema --workspace=server` completed successfully against the intended Neon database before deploy. Pre-release checks passed again: `npm run test:server` passed 364/364, `VITE_API_URL=https://api.carearound.sg/api npm run build:client` passed with the existing large chunk warning, and `git diff --check` passed. Implementation commit `9d7570e2` was already pushed to `codex/my-map-category-bubbles`; Cloudflare Worker `senior-resource-map-api` deployed version `24f7fba8-c748-4ec1-9cfb-1a3f83cf5bf2`; Cloudflare Pages branch preview deployed `https://5c0582d2.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://560c6fe3.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200` and served `assets/index-C7jqMwb3.js`; production API health returned OK; public `/discover` and `/dashboard/resources` returned `200`; and the public Group soft-asset endpoint returned `200` with a Group-mode row exposing `website`, `socialLinks`, and `updatedByName` fields. Production smoke exited successfully, with the five checks passing after retry on three long-running flows: postal import wizard, create-map, and saved-resource detail. No auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, secret change, or production data mutation was performed.
- Group Resource V3 region/gallery management slice: after 2026-06-25 product alignment that Groups should keep the tabbed wizard while moving closer to Place-quality management depth, the Group Profile step now supports multiple uploaded gallery images through the existing `ImageUpload` media path, and save normalizes the gallery list before sending it to the existing soft-asset API. The Visibility step now makes Target region/s easier to manage by searching existing Region boundaries, showing removable selected Region chips, summarizing the selected boundary count, and repeating the target-region summary on Review. This is a client-only UI/helper slice: it does not create new Region boundaries, add map pins, allow nested Groups, allow Groups in Place buckets, change direct Owner/Staff management, change public readiness rules, add schema/API routes, change auth/session, change postal validation, change Discover ranking, change Gmail/email, change GudAuth, touch secrets, or mutate production data. Verification first failed against missing gallery and Region-search helpers with `node --test client/test/groupAssets.test.js client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group UI/helper coverage passed 16/16 with `node --test client/test/groupAssets.test.js client/test/groupAssetUiSource.test.js`; focused Group/Discover/access coverage passed 73/73 with `node --test server/test/softAssetGroups.test.js server/test/softAssetAccess.test.js server/test/privateResourceContent.test.js server/test/resourceTranslations.test.js server/test/visibility.test.js client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/discoveryCache.test.js client/test/governanceOrganizationUi.test.js`; full client coverage passed 321/321 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 364/364; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-25.
- Group Resource V3 region/gallery management release follow-up: implementation commit `62842d98` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://63d8c391.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://a22380b5.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/dashboard/resources` returned `200` and served `assets/index-CGs8NsT7.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- My Directory saved-assets load-failure follow-up: after 2026-06-25 production UAT showed My Directory rendering `0 saved resources` and Discover save actions failing for the signed-in GudPerson account, read-only production checks confirmed the account still had 39 saved rows and local current server hydration returned the same saved list. The client failure mode was saved-assets load/network failure being flattened into an empty list, which made the UI look wiped and could let an already-saved asset be toggled off from Discover. Saved-assets load failures now preserve any last known saved list, expose a saved-resource load error, show a retry state instead of the empty-state copy when no saved list could be loaded, and pause save/remove heart actions while saved state is loading or failed. This is a client-only guardrail fix; saved data, `/favorites` API behavior, schema, auth/session, permissions, postal validation, Discover ranking/visibility, My Maps data, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old clearing behavior with `node --test client/test/savedAssetsContextSource.test.js`, then passed after the fix. Focused saved-assets/Auth/Discover/My Directory/My Maps coverage passed 111/111; full client coverage passed 325/325 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 364/364; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-25.
- My Directory saved-assets load-failure release follow-up: implementation commit `74a35bd5` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://e215bc50.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://2cd53385.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory` returned `200` and served `assets/index-EdjhvwdD.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group wizard static action bar follow-up: after 2026-06-25 UAT found the Group wizard Back/Next footer redundant because creators already navigate by the top tabs, the Group modal now keeps the tab bar and bottom action bar static while only the workspace scrolls. The footer now offers Cancel, Preview, and Save Group on every step; Preview opens a read-only in-progress public resource-card preview that does not call save APIs, saved hearts, or resource-detail navigation. Submit validation still protects required profile, target-region, and first-owner rules and moves the creator to the first invalid section. This is a client-only Group wizard shell change; Group data, direct Owner/Staff access, final-owner protection, public readiness, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, permissions, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old Back/Next footer with `node --test client/test/groupAssetUiSource.test.js`, then passed after the fix. Focused Group UI coverage passed 33/33 with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/governanceOrganizationUi.test.js`; full client coverage passed 326/326 with `node --test client/test/*.test.js client/src/lib/*.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-25.
- Group wizard static action bar release follow-up: implementation commit `6557d1e6` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://188150a5.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://3fcab372.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/dashboard/resources` returned `200` and served `assets/index-CMztpwBx.js` after cache-bypass verification; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group wizard profile/detail-preview follow-up: after 2026-06-25 UAT found the editable contact phone, WhatsApp, email, CTA label, CTA URL, and update stamp better suited to the Profile step, those controls now live in Profile while Review shows a summary plus saved Group management tools. The footer Preview now opens a read-only public resource detail-page style preview, with hero/profile, collection visibility, update/accountability, schedule, website/contact/CTA/social fields, gallery, tags, and included-resource sections, instead of the compact Discover card preview. Preview remains local to the wizard and does not save, navigate to resource detail, call saved-heart APIs, change public readiness, alter Group member rules, or change direct Owner/Staff access. This is a client-only Group wizard presentation change; Group data, direct Owner/Staff access, final-owner protection, public readiness, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, permissions, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Group UI coverage 33/33, full client coverage 326/326, full server coverage `npm run test:server` 367/367, production-style client build with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`, and `git diff --check` on 2026-06-25. Local browser load of `/dashboard/resources` on localhost showed no framework overlay or console errors, but the authenticated Group modal preview was not visually exercised because the local browser session was at sign-in. Release follow-up: implementation commit `4c9c16fa` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://12475e7b.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://91604150.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/dashboard/resources`, and `/discover` returned `200` and served `assets/index-d5mpcg8K.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group wizard translation/restricted tab follow-up: after 2026-06-25 UAT found the Review step overloaded, the Group wizard now gives Translation review and Restricted notes/files their own top-level tabs, and the wizard tab labels no longer show numeric badges. The existing `soft` resource translation-review panel and restricted-notes/files editor are only repositioned; their API paths, permissions, read-only viewer rules, markdown/file behavior, final-owner protection, public readiness, member rules, direct Owner/Staff access, save flow, preview flow, Group data, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Group UI coverage 33/33, full client coverage 326/326, full server coverage `npm run test:server` 367/367, production-style client build with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`, and `git diff --check` on 2026-06-25. Release follow-up: implementation commit `b7ed8dc7` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://ff5f20d9.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://8925c7f8.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/dashboard/resources`, and `/discover` returned `200` and served `assets/index-D480rxRC.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group wizard review/legacy-note cleanup follow-up: after 2026-06-25 UAT found the Group Review tab redundant because the footer Preview now opens the in-progress detail page, the Group wizard now ends at the Restricted tab and keeps Cancel, Preview, and Save Group in the static footer. The Group Profile description field now reuses the existing markdown-aware description editor and preview, and the Group detail preview renders that markdown through the safe `MarkdownLiteText` path. The shared translation-review panel now accepts a narrow excluded-field list, and Group translation review excludes the legacy `venueNote` field while leaving non-Group offering/template translation behavior unchanged. This is a client-only Group wizard cleanup; Group data, translation API paths, restricted notes/files permissions, final-owner protection, public readiness, member rules, direct Owner/Staff access, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Group UI coverage 33/33 with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/governanceOrganizationUi.test.js`, full client coverage 326/326 with `node --test client/test/*.test.js client/src/lib/*.test.js`, full server coverage `npm run test:server` 367/367, production-style client build with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`, and `git diff --check` on 2026-06-25. Release follow-up: implementation commit `9f46e861` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://203f42c7.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://993a4da6.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/dashboard/resources`, and `/discover` returned `200` and served `assets/index-BDH-iYaL.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group dashboard access cleanup follow-up: after 2026-06-25 UAT found the row-level Group Access button redundant because Group access is already managed inside the wizard, Group rows on the Resources dashboard now show only the relevant row actions while keeping Owner/Staff management in the Group wizard Access tab. The inline Group access drawer was removed, and the inline-action guard now applies only to the remaining Place/Offering row drawers. The Group Profile markdown description path remains locked through `MarkdownDescriptionField` and safe `MarkdownLiteText` rendering. This is a client-only dashboard cleanup; Group data, access API paths, permissions, final-owner protection, public readiness, member rules, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Group UI coverage 33/33 with `node --test client/test/groupAssetUiSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js client/test/governanceOrganizationUi.test.js`, full server coverage `npm run test:server` 367/367, production-style client build with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`, and `git diff --check` on 2026-06-25. Release follow-up: implementation commit `3ec4bcb7` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://e222fb6c.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://3c9f743c.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/dashboard/resources` returned `200` and served `assets/index-BBjZyuuI.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Group shared wizard shell extraction: after the 2026-06-26 resource editor wizard-conversion plan, the existing Group wizard shell was extracted into `ResourceWizardShell` and Group now reuses that shared static tabbar, scrollable workspace, static Cancel/Preview/Save footer, and preview modal host. The Group tabs, step validation, in-wizard Access, Members, Translation review, Restricted notes/files, safe markdown description/preview, Group save payload, member rules, target-region visibility controls, and preview content remain unchanged. This is a client-only refactor for the next Place/Offering/Template wizard slices; Group data, access API paths, permissions, final-owner protection, public readiness, Discover ranking/visibility, Place buckets, My Directory/My Maps/Shared Maps, auth/session, schema, postal validation, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Group shell coverage 20/20 with `node --test client/test/groupAssetUiSource.test.js client/test/resourceWizardShellSource.test.js client/test/groupAssets.test.js client/test/discoveryGroupAssets.test.js`, full client coverage 327/327 with `node --test client/test/*.test.js client/src/lib/*.test.js`, full server coverage `npm run test:server` 367/367, production-style client build with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`, and `git diff --check` on 2026-06-26. Release follow-up: implementation commit `39d7fdfb` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://6e280aa3.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://acadba7a.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/dashboard/resources` returned `200` and served `assets/index-CaR1TyLI.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- Place/Offering/Template wizard conversion follow-up: after the 2026-06-26 resource editor wizard-conversion plan, Place, Offering, and Template editors now reuse the shared `ResourceWizardShell` pattern: static section tabs, scrollable workspace, static Cancel/Preview/Save footer, and visible-tab validation. Place management now keeps Profile, Location, Visibility, Access, Zones, Translate, and Restricted sections inside the modal, with row-level Access/Zones shortcuts removed only after the in-wizard management path was present. Offering management now keeps Profile, Schedule, Host & coverage, Visibility, Access, Translate, and Restricted sections inside the modal; standalone offerings use direct soft-asset access in the Access step, while linked/generated offerings keep their existing host-place inheritance and save-first behavior. Template editing now uses Profile, Defaults, Visibility, Generate, and Translate sections while preserving the existing parent-template API/payload path and deliberately not adding Template Access, Restricted notes/files, or private-file behavior. Group keeps the shared shell and its existing Group-only Access, Members, Translate, Restricted, target-region, markdown, preview, and save behavior. This is a client/editor workflow conversion; no schema, Worker/API route, production data, auth/session, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secret, resource permission, Group member/readiness, Place bucket, or My Directory/My Maps/Shared Maps behavior is changed. Verification passed focused wizard coverage 38/38 with `node --test client/test/resourceWizardShellSource.test.js client/test/groupAssetUiSource.test.js client/test/placeWizardSource.test.js client/test/offeringWizardSource.test.js client/test/templateWizardSource.test.js client/test/offeringContactFormParity.test.js client/test/resourceDeleteSubmitGuard.test.js`; full client source/unit coverage passed 347/347 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 367/367; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-26. No commit, push, or deploy was performed for this local follow-up.
- Resource wizard guidance follow-up: after 2026-06-26 UAT found the shared wizard validation banner useful but too easy to read as a system error, the `ResourceWizardShell` validation notice now uses a softer amber guidance treatment with an info icon, an action-neutral `Required detail needed` heading, and explicit reassurance that the draft remains in place. Invalid visible fields in the active wizard workspace are highlighted only after the user attempts to save or move to another section, so creators can connect the guidance message to the field needing attention without seeing premature warning styling; a follow-up UAT fix added native required markers to the Place name, country, postal code, and address controls and aligned Template bucket/sub-category required semantics so Place/Offering/Template/Group wizard-required inputs can use the same cue. The validation gates, section routing, save blocking, preview behavior, Access/Zones/Translate/Restricted management panels, Place/Offering/Template/Group payloads, permissions, schema, Worker/API routes, production data, auth/session, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, My Directory/My Maps, and Shared Maps remain unchanged. Verification passed focused wizard UI coverage 34/34 with `node --test client/test/resourceWizardShellSource.test.js client/test/offeringWizardSource.test.js client/test/groupAssetUiSource.test.js client/test/placeWizardSource.test.js client/test/templateWizardSource.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-26. No commit, push, or deploy was performed for this local follow-up.
- Resource wizard visibility/accountability follow-up: after 2026-06-26 UAT found the Place Visibility step showing a titled empty container plus manual freshness controls, the Place wizard now shows actual visibility controls for `Hide from App` and scheduled hide windows, and Place/Offering wizards show a read-only system update record instead of creator-maintained freshness date/source/status/confidence fields. Existing verification metadata fields and payload support remain preserved in the background for compatibility, but creator UX now treats recency/accountability as system-led, matching the Group wizard direction. This is a client-only wizard UX change; visibility routing, save payload shape, Access/Zones/Translate/Restricted management panels, Place/Offering/Template/Group permissions, schema, Worker/API routes, production data, auth/session, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, My Directory/My Maps, and Shared Maps remain unchanged. Verification passed focused wizard UI coverage 34/34 with `node --test client/test/resourceWizardShellSource.test.js client/test/offeringWizardSource.test.js client/test/groupAssetUiSource.test.js client/test/placeWizardSource.test.js client/test/templateWizardSource.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-26. No commit, push, or deploy was performed for this local follow-up.
- Resource wizard public contact parity follow-up: Place now includes optional public Contact email beside Phone and WhatsApp, and Template now includes Website, social media links, Contact phone, WhatsApp contact, and Contact email in the Profile step and preview. Hard-asset and Template parent save paths persist the new optional fields; generated place-specific offerings inherit Template website/social/contact defaults while preserving existing child override behavior for host-local contact fields. Offering and Group public-contact wizard behavior stays unchanged, Group remains list-only with no pin, Region Groups remain hidden, and Discover, My Map, private access/restricted content, permissions, auth/session, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification passed focused wizard/contact coverage with `node --test client/test/placeWizardSource.test.js client/test/templateWizardSource.test.js`, `node --test client/test/offeringWizardSource.test.js client/test/groupAssetUiSource.test.js`, and `node --test server/test/phoneIdentitySchema.test.js server/test/softAssetHierarchy.test.js server/test/resourceContactFieldsSource.test.js`; full server coverage passed with `npm run test:server`; and production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-07-01.
- Workbook public-contact/social parity follow-up: Places workbook import/export now includes Contact email plus supported social media URL columns (`facebookUrl`, `instagramUrl`, `tiktokUrl`, `youtubeUrl`, `linkedinUrl`); Standalone Offerings now include Website plus the same social URL columns; Templates now include Website, Contact phone, WhatsApp contact, Contact email, and the same social URL columns. The workbook maps those readable columns into the existing `social_links` JSON shape and the new public-contact columns rather than exposing raw JSON in spreadsheets. Template Rollouts intentionally remain host-specific override workbooks and do not expose website/social columns because generated child offerings inherit those fields from the Template parent unless the child override model is explicitly expanded later. Group workbook tools were not added in this pass because Group exports need a separate profile-plus-membership sheet design to preserve list-only/no-pin and no-nested-Group rules. Verification passed focused workbook coverage with `node --test server/test/workbookSecurity.test.js server/test/workbookContactFieldsSource.test.js`; full server coverage passed 377/377 with `npm run test:server` on 2026-07-01.
- Release follow-up: implementation commit `1f40c3de` was pushed to `codex/my-map-category-bubbles` on 2026-07-01. The explicit schema bootstrap completed before Worker/API deploy; Worker version `5aa95e98-5d1c-4704-b0b5-5dda04aefb39` was deployed to `api.carearound.sg`; Cloudflare Pages branch preview deployed at `https://5745e1b3.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed at `https://11e1af97.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-BbYxMzYS.js` and `assets/index-Coyian3x.css`; production API health returned OK; production smoke passed with one transient first-load retry and a clean rerun of the public-load check using `smoke.env` without printing secrets. No Group Data Tool, Region Group, Discover filter, My Map behavior, auth/session, Gmail/email, GudAuth, or secret behavior change was introduced.
- Group Data Tool follow-up: Admin Tools > Data Tools now exposes a Groups workbook alongside Places, Standalone Offerings, Templates, and Template Rollouts. The Group workbook uses a profile-plus-membership shape: stable `externalKey`, public profile/contact/social fields, `audienceMode`, optional `targetSubregionCodes`, and direct member links through `memberPlaceExternalKeys` and `memberOfferingExternalKeys`. Imports upsert only `assetMode: group` soft assets, replace the direct Group member list from the workbook row, reject nested/non-public/hidden member offerings through the existing public Group member eligibility rules, and default newly imported Groups to the importer as Owner so Groups are not created ownerless. Groups remain list-only, never create pins, never use `soft_asset_locations`, and still use the wizard Access step for Owner/Staff management. This pass does not add filtered My Resources Group workbook export. Verification first failed against missing Group workbook registry/server support with `node --test server/test/workbookGroupsSource.test.js` and `node --test client/test/adminDataToolsGroupsSource.test.js`, then passed after implementation; focused workbook/security/Group coverage passed 20/20 with `node --test server/test/workbookSecurity.test.js server/test/workbookContactFieldsSource.test.js server/test/workbookGroupsSource.test.js server/test/softAssetGroups.test.js`; focused Admin/Group client source coverage passed 27/27 with `node --test client/test/adminDataToolsGroupsSource.test.js client/test/groupAssetUiSource.test.js client/test/resourceListLoading.test.js`; full server coverage passed 381/381 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-07-01. Release follow-up: implementation commit `2d8f964b` was pushed to `codex/my-map-category-bubbles` on 2026-07-02; release gate was rerun with `npm run test:server` passing 381/381, production-style client build passing with the existing large chunk warning, and `git diff --check` passing; Worker/API deployed to `api.carearound.sg` with version `f09af8ce-edd3-4097-a3cd-97a4e6d1de89`; Cloudflare Pages branch preview deployed `https://f6a41c92.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://888d7b77.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-CJDsMvVM.js` and `assets/index-Coyian3x.css`; production API health returned OK; and production smoke passed 5/5 using `smoke.env` without printing secrets. No schema bootstrap, production data mutation, filtered My Resources Group workbook export, Region Group revival, Discover/My Map behavior change, auth/session change, postal validation change, Gmail/email change, GudAuth change, or secret change was performed.
- Dashboard sticky side menu follow-up: desktop dashboard-style shells now share a sticky side-menu wrapper so the left side menu remains pinned below the global navbar while long dashboard/resource/directory content scrolls. The wrapper is desktop-only, keeps the existing mobile drawer unchanged, preserves document-navigation sidebar links, and allows the side menu itself to scroll if its own content exceeds the viewport. Verification passed `node --test client/test/dashboardNavigationRecovery.test.js` 5/5, full server coverage passed 381/381 with `npm run test:server`, production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`, and `git diff --check` passed on 2026-07-02. Release follow-up: implementation commit `e0fa6845` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://e68c2ca6.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://af05d106.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-BI95jTUQ.js` and `assets/index-CV6oERwX.css`; deployed `DashboardNavigation-oV9kDwkL.js` contains the sticky sidebar wrapper; production API health returned OK; a production browser measurement on `/dashboard/resources` confirmed the side menu computed as `position: sticky` with `top: 64px` before and after page scroll; and production smoke passed 5/5 using `smoke.env` without printing secrets. No Worker/API deploy, schema bootstrap, production data mutation, route permission change, auth/session change, Discover/My Map behavior change, Gmail/email change, GudAuth change, or secret change was performed.
- Resource editor wizard chapter release follow-up: implementation commit `c40f569b` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://c9655fac.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://97ed69a2.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/dashboard/resources` returned `200` and served `assets/index-D-_RiQ81.js`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map Group member focus polish: Group assets remain list-only and still do not create map pins or pin numbers, but owner My Map and interactive Shared Map now use direct public Place members to connect Group cards to mapped member pins. Hovering a mapped Place pin highlights that Place and any list-only Group card containing it; selecting a Group logo focuses the mapped member Place pins with the same My Map padding path, using the existing single-pin zoom when only one mapped member exists and no map action when none exist. The payload is additive (`mapFocusPlaceKeys`) and filters to direct public Place members only; the client also backfills the same keys from public Group detail payloads when testing against an older API that has not deployed the directory payload enrichment yet. Soft Offering host locations, nested Groups, hidden/member-only entries, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, and production data remain unchanged. Verification first failed against missing Group focus metadata and camera helpers with `node --test server/test/myMapDirectoryCategorySource.test.js` and `node --test client/test/directoryPresentationV2Order.test.js client/test/directoryMapCamera.test.js`, then passed after the fix. Focused map/list coverage passed 60/60 with `node --test client/test/directoryGroupFocus.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryPresentationV2Order.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapCamera.test.js`; focused server Group/My Map coverage passed 9/9 with `node --test server/test/myMapDirectoryCategorySource.test.js server/test/softAssetGroups.test.js`; full client source/unit coverage passed 355/355 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; local browser smoke against the new client and production API passed 5/5; and production smoke passed 5/5 on 2026-06-26. Release follow-up: implementation commit `2855d71e` was pushed to `codex/my-map-category-bubbles`; Worker/API deployed to custom domain `api.carearound.sg` with version `3616c1fb-ea9c-48a3-9e3c-0fe792aceebd`; Cloudflare Pages branch preview deployed `https://6fcf90fb.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://6bbff72c.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-pxyPn0nR.js`; and production API health returned OK. No schema bootstrap, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, secret change, or production data mutation was performed.
- My Map Group card placement and hover-focus refinement: after 2026-06-26 UAT found the list-only Group card still sitting in the side rail and card hover/click targets feeling too narrow, focusable list-only Group cards now render under the center map notes entry instead of in the left/right card columns, omit the unhelpful location-unavailable line, and keep Group list-only semantics without creating pins or pin numbers. Hovering any interactive Place or Group card now feeds the same active-place key path used by pin hover, so mapped cards highlight their pins and Group cards highlight their mapped member pins. Clicking the non-interactive body area of a focusable card now triggers the same map focus action as the logo, while title links still open resource detail and note/action buttons keep their own behavior. Owner My Maps and interactive Shared Maps use the same shared list behavior. This is a client-only presentation/interaction refinement; Group membership, map pin creation, notes payloads, saved assets, sharing tokens, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused My Map/Shared Map/list/camera coverage 60/60 with `node --test client/test/directoryPresentationV2Order.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapCamera.test.js`; full client source/unit coverage passed 357/357 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; in-app browser localhost verification reached the protected route and redirected to Login without app errors or framework overlay; local browser smoke against the new client and production API passed 5/5; and production smoke passed 5/5 on 2026-06-26. Release follow-up: implementation commit `b581aa58` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://f49b437b.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://acd151b9.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-B-q1_M3n.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, secret change, or production data mutation was performed.
- Resource detail nested favorite polish: Place detail available-offering cards and Group detail included-resource cards now expose the same in-card `SaveAssetButton` heart used elsewhere, so signed-in users can favorite nested Places/Offerings directly without opening each resource first. Group included-resource cards were changed from actual button elements to keyboard-accessible card containers so the favorite button is not nested inside another button, while normal card click/keyboard activation still opens the nested resource detail. This is a client-only detail-page interaction refinement; Group membership, Place offering buckets, My Directory saved-asset API semantics, My Maps/Shared Maps map behavior, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the missing nested favorite controls with `node --test client/test/groupAssetUiSource.test.js`, then passed after the fix; focused saved-asset/detail coverage passed 21/21 with `node --test client/test/savedAssetsContextSource.test.js client/test/i18nCoverage.test.js client/test/groupAssetUiSource.test.js`; full client source/unit coverage passed 359/359 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-26. Release follow-up: implementation commit `206a1abe` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://f26f4a3e.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://8a46606e.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` returned `200`, served `assets/index-YJkRPC-3.js`, and `/discover` plus `/resource/soft/203` returned `200`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, secret change, or production data mutation was performed.
- My Map mobile adaptive map refinement: mobile owner My Map and interactive Shared Map keep the existing partial-height map on entry, still collapse while browsing down the resource cards, and now add a small drawer handle below the map legend that can open the map into a near-fullscreen mobile panel. The fullscreen state keeps the map notes entry available, raises the notes overlay above the fullscreen map, locks background page scroll until the user returns to the normal partial map, and preserves the existing card/marker focus path so selecting a resource card exits fullscreen back to the default partial-height map before focusing the pin or member-pin group. Scrolling while fullscreen does not collapse the map behind the user's tap state, and returning to the top/card selection still uses the existing mobile expand behavior. This is a client-only mobile presentation refinement on the shared My Map/Shared Map list component; resource ordering, map data, notes data, card selection, marker selection, print/export/share, Group pin semantics, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against missing fullscreen state and handle coverage with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Full client source/unit coverage passed 362/362 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; API health returned OK; public `/discover` returned `200`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `a41ecbc8` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://d098e73a.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://123abfd3.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-C9yo8gzg.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map mobile full-collapse follow-up: after 2026-06-27 mobile UAT found the mini-map collapse and full-width `Full map` button visually unhelpful, mobile owner My Map and interactive Shared Map now collapse the map frame fully to zero height while keeping the arrow tab and Map notes entry available. Scrolling back near the top card expands the default partial-height map again, while selecting/focusing a card still expands before the existing marker focus path. The fullscreen toggle is now a compact tab-style button with a simple up arrow to open the full map and down arrow to return from fullscreen; the mobile legend is hidden only while the map is collapsed. This is a client-only mobile presentation refinement on the shared map/list component; resource ordering, map data, notes data, marker selection, card selection, print/export/share, Group pin semantics, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the missing full-collapse, near-top expand, and arrow-tab expectations with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Full client source/unit coverage passed 363/363 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `cc17168b` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://a07104e4.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://41e93542.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-DlfSl_nc.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map mobile handle and zoomed-out pin-dot follow-up: after 2026-06-27 mobile UAT found the compact map tab arrow direction inverted, the normal partial/collapsed map tab now points down for opening the fuller map, while the fullscreen return state points up. Owner My Map and interactive Shared Map category-bubble pins now also switch to compact colour dots at broad zoom levels (`<=13.25`) by applying a map-container presentation class only; the same marker coordinates, lobe hit targets, hover routing, card selection, Group member focus, cluster behavior, notes access, and map camera paths remain in place. This is a client-only presentation refinement; resource ordering, map data, notes data, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the inverted arrow and missing compact category-bubble zoom state with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapMarkerMode.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 73/73 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js`; full client source/unit coverage passed 363/363 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `430a42ee` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://61baa234.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://b3279dae.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-CxKmcDSb.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map zoomed-out pin footprint refinement: after 2026-06-27 UAT found that the pin-dot treatment looked smaller but still kept the full category-bubble footprint, owner My Map and interactive Shared Map now rebuild category-bubble markers below the broad-zoom threshold with compact lobe geometry (`13px` dots and tighter lobe spacing) instead of only hiding the full-size artwork. The compact mode still uses the same mapped Place coordinates, lobe-specific hover/click routing, Group member focus keys, marker data, cluster rules, map camera behavior, and notes/card interactions; zooming back in restores the original dense-map category-bubble layout and collision behavior. This is a client-only presentation/interaction refinement; resource ordering, map data, notes data, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the missing compact lobe geometry and zoom-state marker rebuild expectations with `node --test client/test/directoryMapMarkerMode.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 84/84 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryPresentationV2Order.test.js`; full client source/unit coverage passed 363/363 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `bcf9510d` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://6348bfe9.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://b0d0289b.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-CbqBuHWu.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map mobile pin-dot threshold follow-up: after 2026-06-27 mobile UAT found compact dots engaging while there was still room for full category bubbles, owner My Map and interactive Shared Map now wait one more zoom step before shrinking category-bubble markers (`<=12.25` instead of `<=13.25`). Full category-bubble markers remain visible longer on mobile, while the existing compact 13px dot footprint still applies further out. This is a client-only threshold adjustment; marker geometry, map data, resource ordering, notes data, Group pin/list-only semantics, card/hover/focus routing, cluster rules, map camera behavior, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old threshold with `node --test client/test/directoryMapMarkerMode.test.js`, then passed after the fix. Focused marker/My Map/Shared Map/mobile coverage passed 44/44 with `node --test client/test/directoryMapMarkerMode.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/mobileMapPanelBehavior.test.js`; full client source/unit coverage passed 363/363 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `57724c10` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://89b6b38e.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://b54c5503.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-BrJYOivX.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map mobile Group card and compact-dot tap polish: after 2026-06-27 mobile UAT found the list-only Group card still saying `Location unavailable`, the Unmapped pill wrapping under the category icon, browser pinch zoom pushing the Map notes toolbar partly off-screen, and compact colour-dot taps jumping straight into one touched pin, owner My Map and interactive Shared Map now show list-only Group cards with `Group` metadata, stack the Unmapped pill under the category pill, lock page viewport scaling while the mobile map/list surface is active, and make compact category-dot taps zoom just past the dot threshold so normal badges are revealed for selection before any single-place focus. This is a client-only presentation/interaction refinement; Group remains list-only and still does not create pins or pin numbers, marker data, resource ordering, map data, notes data, card/hover/focus routing, cluster rules, map camera padding, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against missing Group label/pill layout, viewport-scale lock, and compact-dot reveal behavior with `node --test client/test/sharedMapDirectoryListRefinement.test.js` and `node --test client/test/directoryMapMarkerMode.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 85/85 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryPresentationV2Order.test.js`; full client source/unit coverage passed 364/364 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `01719f71` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://84d2765d.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://98e3fda7.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-IqxOakI6.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map mobile Group-first list ordering: after 2026-06-27 mobile UAT found list-only Group cards still sinking below mapped Place cards, owner My Map and interactive Shared Map now use a mobile-only display sequence that starts with list-only Group cards, then continues with the existing V2 card order. Desktop columns, map-column Group placement, card numbering, pin numbering, pins, map focus keys, notes rows, PDF/export paths, Shared Map print, and the desktop/map data order remain unchanged. Group remains list-only and still does not create pins or pin numbers. This is a client-only presentation refinement; map data, notes data, resource membership, resource ordering outside the mobile card sequence, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the missing `mobileDisplayGroups` ordering path with `node --test client/test/directoryPresentationV2Order.test.js` and missing renderer wiring in `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 86/86 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full client source/unit coverage passed 365/365 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed `npm run test:server` 368/368; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. Credentialed smoke was not run because smoke credentials were not present in the shell. Release follow-up: implementation commit `2b2d1dc1` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://2b872b9f.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://9fd8cafe.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg`, `/discover`, and `/my-directory/maps/87` returned `200` and served `assets/index-D7xC8dr5.js`; and production API health returned OK. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- My Map mobile collapse animation polish: after 2026-06-27 mobile UAT found the full map collapse/reveal feeling too sudden, owner My Map and interactive Shared Map now use a shared eased `500ms` transition for the mobile map frame and legend, fading/translating the map out when collapsed and using a slightly longer scroll-settle guard so repeated scroll events do not fight the animation. The collapse and near-top reveal trigger thresholds, full-screen tab behavior, card/pin selection, Group-first mobile order, Map notes access, map data, notes data, resource ordering outside mobile presentation, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old height-only `300ms` transition with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 87/87 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-27. No server, Worker/API, schema, auth/session, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secret, or production data change was introduced.
- My Map mobile cached-collapse polish: after 2026-06-27 mobile UAT found the softened collapse still jerky and briefly blanking while the map reloaded, owner My Map and interactive Shared Map now collapse only an outer mobile map viewport while keeping the mounted Leaflet map at its normal partial-height size. The normal expanded/collapsed states now share a stable `mobile-map-normal` layout signature, so ordinary list browsing does not ask the map camera to refit or invalidate as a new panel state; fullscreen still has its own layout signature for the intentional large-map transition. The collapse/reveal thresholds, full-screen tab behavior, card/pin selection, Group-first mobile order, compact-dot behavior, Map notes access, map data, notes data, resource ordering outside mobile presentation, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the missing cached-map contract with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 88/88 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full client coverage passed 367/367 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-27. No server, Worker/API, schema, auth/session, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secret, or production data change was introduced.
- My Map mobile no-jerk collapse polish: after 2026-06-27 mobile UAT found the cached collapse no longer vibrating but still showing a few visible jumps, owner My Map and interactive Shared Map now avoid animating competing `height`, `min-height`, and `max-height` constraints on the sticky mobile map block. The mobile map and legend collapse through a single grid-row transition while the mounted map stays cached, and the sticky map wrapper plus mobile card list opt out of browser scroll anchoring so the browser does not fight the animation with corrective scroll jumps. The collapse/reveal thresholds, full-screen tab behavior, card/pin selection, Group-first mobile order, compact-dot behavior, Map notes access, map data, notes data, resource ordering outside mobile presentation, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the missing grid-row/no-scroll-anchor contract with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 89/89 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full client coverage passed 368/368 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-27. No server, Worker/API, schema, auth/session, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secret, or production data change was introduced.
- My Map mobile scroll-settle and resource category selector polish: after 2026-06-27 mobile UAT still felt a few scroll-collapse jumps, owner My Map and interactive Shared Map now wait briefly for active scrolling to settle before applying the collapsed mobile map layout, while card/pin selection, near-top reveal, full-screen map mode, Map notes access, cached Leaflet mounting, Group-first mobile order, compact-dot behavior, and existing map camera rules remain unchanged. The Group wizard Profile step also restores category selection as a dropdown fed by the existing resource category metadata, and the visible label now reads `Category` across Group, Place, and Offering editors while preserving the existing `subCategory` payload/storage field for compatibility. This is a client-only interaction and editor-label refinement; it does not change map data, notes data, resource ordering, Group pin/list-only semantics, public readiness, saved resources, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification first failed against missing scroll-settle collapse handling and the old Group/Place/Offering category labels with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/groupAssetUiSource.test.js client/test/placeWizardSource.test.js client/test/offeringWizardSource.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/editor coverage passed 115/115 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/groupAssetUiSource.test.js client/test/placeWizardSource.test.js client/test/offeringWizardSource.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full client coverage passed 369/369 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed 368/368 with `npm run test:server`; and production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-27.
- My Map mobile collapse timing follow-up: after 2026-06-27 UAT found the previous scroll-settle guard made the map collapse only near the last card and made reveal feel delayed, owner My Map and interactive Shared Map now let the first real downward browse schedule one pending collapse without resetting that timer on every continued scroll event. Direct near-top wheel/touch gestures also cancel any pending collapse and reveal the default partial-height map immediately, while the passive window-scroll path still uses the existing rebound guard for browser scroll-anchoring corrections. This is a client-only timing refinement; the map stays mounted/cached, full-screen map mode, Map notes access, card/pin selection, Group-first mobile order, compact-dot behavior, map data, notes data, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old timer-reset and delayed direct-reveal behavior with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/editor coverage passed 117/117 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js client/test/groupAssetUiSource.test.js client/test/placeWizardSource.test.js client/test/offeringWizardSource.test.js`; full client coverage passed 371/371 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed 368/368 with `npm run test:server`; and production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-27.
- My Map mobile active-scroll smoothness follow-up: after 2026-06-27 video UAT still showed a few visible jumps and a ghosted map strip during full collapse, owner My Map and interactive Shared Map now avoid fading/translating the sticky outer map block while it is collapsing, keep the cached Leaflet map mounted behind a clipped grid-row viewport, reschedule collapse while scroll events are still arriving, and let near-top reveal clear the collapse cooldown immediately. This keeps the layout change out of active touch/momentum scrolling and avoids a competing opacity/transform animation on the heavy map surface. This is a client-only presentation refinement; map data, marker data, notes data, card/pin selection, full-screen map mode, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old outer opacity/transform transition and one-shot collapse timer with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 92/92 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js` on 2026-06-27.
- My Map mobile natural-scroll map follow-up: after 2026-06-27 UAT confirmed the collapse model still felt delayed/rough, owner My Map and interactive Shared Map now remove the mobile map collapse/reveal state entirely. The map, legend, Map notes entry, and cards scroll as one normal page; the Map notes entry reuses the existing mobile sticky positioning so it pins near the top after the map scrolls away and naturally returns under the map when scrolling back. The normal mobile map handle/fullscreen control and wheel/touch collapse listeners are removed from this path; card body map-focus, marker selection, cluster selection, sticky Map notes access, viewport-scale lock, Group-first mobile order, compact-dot behavior, map data, marker data, notes data, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old collapse/handle implementation with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then focused My Map/Shared Map/mobile/camera/marker coverage passed 78/78 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full client source/unit coverage passed 357/357 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and production smoke passed 5/5 on 2026-06-27.
- My Map mobile gesture full-map follow-up: after 2026-06-27 UAT approved the natural-scroll Option B baseline and asked to layer in gesture-driven full-map mode, owner My Map and interactive Shared Map now open an intentional fixed full-map overlay when mobile scrolling passes beyond the first resource card. The full-map overlay reuses the same map callbacks, keeps Map notes available, locks background page scroll, and returns to the default partial-map/list position when the user swipes upward from the bottom edge or taps the compact return control. Dismissing the overlay suppresses immediate re-open until the user returns toward the top/first-card area. This is a client-only presentation gesture; it does not revive the old collapse/reveal panel, change map data, marker data, card ordering, Group pin/list-only semantics, notes data, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification first failed against the missing gesture/full-map implementation with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 80/80 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full client source/unit coverage passed 359/359 with `node --test client/test/*.test.js client/src/lib/*.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and production smoke passed 5/5 on 2026-06-27.
- My Map mobile adjustable-map follow-up: after 2026-06-27 UAT found the scroll-past-first-card full-map trigger unreliable on mobile, owner My Map and interactive Shared Map now keep the mobile map in the normal page flow and let the user directly resize it from a small tab under the map. Pulling the tab down grows the mounted map through default, expanded, and near-fullscreen height steps; pulling up shrinks it one step; tapping cycles the same steps. The Leaflet map remains mounted during resizing, Map notes stay in the existing sticky mobile position, and the old fixed full-map overlay, background scroll lock, first-card query trigger, and bottom-edge swipe exit are removed. This is a client-only presentation refinement; map data, marker data, notes data, card/pin selection, cluster selection, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old auto-open overlay tests with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the adjustable-map implementation. Focused My Map/Shared Map/mobile/camera/marker coverage passed 80/80 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-27.
- My Map mobile chrome overlay follow-up: after 2026-06-27/2026-06-28 mobile UAT asked for the hamburger/title bar to stay sticky while the map scrolls behind it, owner My Map V2 now uses a compact mobile chrome bar with a slimmer rounded menu trigger and an explicit layer above Leaflet controls/panes. The map content is pulled under that bar so it can scroll behind the title/menu layer, while the drawer and Map notes modal use higher overlay layers so they still cover the compact chrome when opened. The Map notes sticky stop-line sits below the compact chrome so notes remain reachable. The stable fallback mobile header keeps its previous taller treatment, and this remains a client-only presentation change; map data, marker data, notes data, adjustable-map sizing, card/pin selection, cluster selection, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused My Map/Shared Map/mobile/camera/marker coverage 81/81 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-28.
- My Map mobile stable-canvas reset: after 2026-06-28 UX review found the adjustable-map/chrome-overlay path over-complicated the mobile My Map experience, owner My Map and interactive Shared Map now use a stable mobile canvas again: compact header, stable partial-height map, sticky Map notes, and cards scroll as one normal page. The adjustable pull tab, resize height steps, scroll-triggered full-map open, and negative-margin header overlay are removed. Full map is opened only by a visible map button and returns through an explicit Back to list control while Map notes remains available. This is a client-only presentation refinement; map data, marker data, notes data, card/pin selection, cluster selection, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the old adjustable-map contract with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then passed after the stable-canvas reset. Focused My Map/Shared Map/mobile coverage passed 44/44 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and smoke passed 5/5 using `smoke.env` without printing secrets on 2026-06-28.
- My Map mobile layer and full-map toggle polish: after 2026-06-28 mobile UAT showed the map overlapping the app toolbar, Map notes sticking with excess gap, and the full-map exit reading like a separate Back action, owner My Map and interactive Shared Map now raise the app toolbar and compact map title layer above Leaflet controls, tighten the owner Map notes sticky offset to sit directly under the mobile title stack, move the normal full-map button to the lower-right map corner, and use the matching lower-right reverse-map icon to return from full-map mode. The full-map sheet starts below the app toolbar so the global controls remain visually above the map, while Map notes remains available. This is a client-only presentation refinement; map data, marker data, notes data, card/pin selection, cluster selection, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification first failed against the previous z-index, top-right full-map button, and text Back control with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js`, then passed after the fix. Focused My Map/Shared Map/mobile/camera/marker coverage passed 81/81 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and smoke passed 5/5 using `smoke.env` without printing secrets on 2026-06-28.
- My Map mobile sticky notes gap polish: after 2026-06-28 mobile UAT still showed a gap between the global toolbar and the sticky Map notes card once the compact My Map title row scrolled away, owner My Map now pins the Map notes stop-line directly under the global mobile toolbar (`56px`, `64px` on small screens) instead of reserving the title-row height. Shared Map keeps its separate shared-page header offset. This is a client-only offset correction; map data, marker data, notes data, card/pin selection, cluster selection, full-map controls, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused owner/shared mobile coverage 44/44 with `node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapDirectoryListRefinement.test.js`; broader My Map/Shared Map/mobile/camera/marker coverage passed 81/81 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-28.
- My Map mobile discrete scroll-intent map states: after revisiting the mobile UX requirements on 2026-06-28, owner My Map and interactive Shared Map now use discrete scroll intent instead of a visible handle or live drawer. The normal mobile map stays mounted in its default partial-height frame until it has already scrolled above the toolbar area; continued downward browsing hides the map completely and leaves Map notes sticky below the top toolbar. Returning near the top reveals the partial map again. Full-map mode still opens from the visible map button, and a deliberate pull-down-at-top gesture is an additional fallback; swiping upward from the bottom edge of full-map mode returns to the default partial-map/card state. The implementation does not animate height, resize the map continuously, revive the adjustable tab, trigger full-map mode from passing the first card, or change map data, marker data, notes data, card/pin selection, cluster selection, Group-first mobile order, compact-dot behavior, resource ordering, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification first failed against the missing discrete state machine with `node --test client/test/sharedMapDirectoryListRefinement.test.js`, then focused mobile/list coverage passed 29/29 with the same command. Broader My Map/Shared Map/mobile/camera/marker coverage passed 81/81 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js` on 2026-06-28.
- My Map mobile focus tray follow-up: after 2026-06-28 UAT found that bringing the hidden map back on card selection pushed the selected card away from view, owner My Map and interactive Shared Map now show a compact mobile focus tray between the map and Map notes after a card-driven map focus action. Place selection shows the selected Place card copy with its category, logo, detail link, note action, and map-focus body action; Group selection shows only the mapped member Place cards that are already present as pins in the current map. Downward list browsing clears the tray, full-map mode clears it, and the underlying directory order stays unchanged. This is a client-only presentation layer; it does not change map data, marker data, notes data, saved resources, sharing tokens, Group pin/list-only semantics, Group membership rules, card ordering, compact-dot behavior, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification passed focused mobile/list coverage 30/30 with `node --test client/test/sharedMapDirectoryListRefinement.test.js`; broader My Map/Shared Map/mobile/camera/marker coverage passed 82/82 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and local smoke against `http://127.0.0.1:5175` plus production API passed 5/5 using `smoke.env` without printing secrets on 2026-06-28.
- My Map mobile focus tray grouped-pin fallback: after 2026-06-28 UAT found the focus tray appeared for Groups and some categories but not for AAC/SCC selections, the tray resolver now also understands grouped/postal map pin keys from the existing presentation pins, and the tray survives the parent page's temporary selection-clear while a card-triggered map reveal is settling. If a selected map key is not an exact visible card key but belongs to a grouped pin, the tray shows that pin's mapped member Place cards instead of disappearing. This keeps exact Place selections, Group member selections, list order, card/pin focus, map camera, Map notes, Group list-only semantics, compact-dot behavior, print/export/share, auth/session, schema, permissions, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data unchanged. Verification passed focused mobile/list coverage 30/30 with `node --test client/test/sharedMapDirectoryListRefinement.test.js`; broader My Map/Shared Map/mobile/camera/marker coverage passed 82/82 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and smoke passed 5/5 using `smoke.env` without printing secrets on 2026-06-28.
- My Map mobile full-map focus tray and pull-refresh guard: after 2026-06-28 mobile UX review, owner My Map and interactive Shared Map keep the existing mobile focus tray when the user opens full-map mode, render the same tray between the full map and Map notes, and open/update the tray when a pin/card section is selected from full-map mode. The mobile interactive map surface also temporarily disables root/body vertical overscroll while mounted to reduce browser pull-to-refresh on supported mobile browsers, then restores the previous page styles on unmount. This is a client-only presentation/lifecycle refinement; it does not change map data, marker data, notes data, saved resources, sharing tokens, Group pin/list-only semantics, Group membership rules, card ordering, compact-dot behavior, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification passed focused mobile/list coverage 30/30 with `node --test client/test/sharedMapDirectoryListRefinement.test.js`; broader My Map/Shared Map/mobile/camera/marker coverage passed 82/82 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and smoke passed 5/5 using `smoke.env` without printing secrets on 2026-06-28.
- My Map mobile full-map Group focus polish: after 2026-06-28 mobile UAT found that opening full-map mode from an active Group focus could stretch the member-card tray, inflate the tray text, and reset the map to the default all-pins camera, owner My Map and interactive Shared Map now derive a local full-map focus request from the active magic-window selection. Group and grouped-pin selections fit only their mapped member pins in the full-map instance, single selections keep the existing zoom-to-pin behavior, the full-map tray keeps the same readable card width as the normal magic window, and the full-map font-scaling guard is scoped to the map block instead of the tray/notes controls. This is a client-only full-map presentation/camera refinement; it does not change map data, marker data, notes data, saved resources, sharing tokens, Group pin/list-only semantics, Group membership rules, card ordering, compact-dot behavior, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification passed focused mobile/list coverage 30/30 with `node --test client/test/sharedMapDirectoryListRefinement.test.js`; broader My Map/Shared Map/mobile/camera/marker coverage passed 82/82 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; and production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-28.
- My Map mobile full-map accessibility layering polish: after 2026-06-28 UAT found that the mobile accessibility/font-size drawer opened behind the full-map sheet and the Map notes toolbar stayed visually above the drawer while ignoring A-/A+ text-size changes, the shared mobile bottom sheet now uses the top modal layer above full-map and navbar surfaces, while owner/shared My Map sticky Map notes wrappers no longer opt into `disable-font-scaling`. The map canvas and compact map chrome keep their fixed map-friendly typography, but Map notes title/count text scales with the app text-size controls. This is a client-only layering/accessibility refinement; it does not change map data, marker data, notes data, saved resources, sharing tokens, Group pin/list-only semantics, Group membership rules, card ordering, compact-dot behavior, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, or production data. Verification passed focused owner/shared mobile coverage 45/45 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js`; broader My Map/Shared Map/mobile/camera coverage passed 82/82 with `node --test client/test/mobileMapPanelBehavior.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/directoryMapMarkerMode.test.js client/test/directoryMapCamera.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-06-28.
- My Map mobile focus tray visual polish: after 2026-06-28 UAT found the mobile magic-window tray blending into the card list and category pills wasting space under larger text settings, owner My Map and interactive Shared Map now render the focus tray with a stronger selected-surface shade, let category icons grow with text-size changes at a dampened capped rate while reducing the icon footprint by about 30%, keep the category icon and pill on the same row, let category pills size to their readable text instead of stretching unnecessarily, and replace ellipsis with a right-to-left rolling label only after the rendered pill actually overflows while respecting reduced-motion settings. The magic-window category header now uses the same scale as the normal card category header, and Group focus shows the selected Group name as the secondary context pill instead of `Unmapped`. The Unmapped pill remains under normal list-only Group category headers outside the focus tray, and the underlying directory order, focus tray membership rules, map camera behavior, Map notes, card/pin selection, compact-dot behavior, Group pin/list-only semantics, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused owner/shared mobile coverage 45/45 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and smoke passed 5/5 using `smoke.env` without printing secrets on 2026-06-29. Release follow-up: implementation commit `2fcf4eda` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://ad0fd874.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://abdf0150.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-CD-ddr4U.js` and `assets/index-PCS8DcTl.css`; production API health returned OK; and production smoke passed 5/5. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, Discover ranking/visibility change, Gmail/email change, GudAuth change, or secret change was performed.
- Map notes preview-default polish: after 2026-06-29 mobile UAT found existing notes opening directly in edit mode, owner Map notes now default non-empty existing notes to the markdown preview state when the resource notes sheet opens or switches resources. Blank/new notes still open in edit mode, the explicit Preview/Edit toggle remains available, and autosave payloads, shared-note visibility, notes data, map data, card/pin selection, Group/list-only behavior, print/export/share, auth/session, schema, permissions, postal validation, Discover ranking/visibility, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused notes/mobile coverage 46/46 with `node --test client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-06-29.
- Discover service-area filter removal: after 2026-07-01 mobile UAT asked to remove the Service Area control from the Discover filter sheet, Discover no longer exposes the Service Area/Area selector on mobile or desktop and no longer shows a Service Area summary chip. Discover subregion loading is disabled for the browsing surface so a hidden non-SG selection cannot silently limit results; postal/Home/Locate, text search, resource type, saved-only, save-all-for-search, card layout, map/list modes, public visibility, result ordering, auth/session, schema, permissions, postal validation for resource writes, My Maps, Shared Maps, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Discover/notes/mobile coverage 48/48 with `node --test client/test/discoverySearchTools.test.js client/test/sharedMapDirectoryListRefinement.test.js client/test/myMapV2Scaffold.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-07-01. Release follow-up: implementation commit `be006c37` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://07e31d74.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://d8d5798a.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-DwYwp-Zd.js` and `assets/index-BG6TrBVH.css`; production API health returned OK; and production smoke passed 5/5 using `smoke.env` without printing secrets. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, My Maps/Shared Maps behavior change, Gmail/email change, GudAuth change, or secret change was performed.
- Discover mobile map action polish: after 2026-07-01 mobile UAT found the map-mode `List` and `Filter` buttons duplicative because list browsing and filtering belong in Browse mode, Discover mobile map mode now keeps `Browse` as the only header action. The old map-mode list drawer entry point was removed so users return to Browse before changing filters or scanning cards. Saved-place map pins, saved-only data, Browse-mode filter controls, text/postal/Home/Locate search, resource type, card layout, map/list modes, public visibility, result ordering, auth/session, schema, permissions, postal validation for resource writes, My Maps, Shared Maps, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Discover coverage 3/3 with `node --test client/test/discoverySearchTools.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and production smoke passed 5/5 using `smoke.env` without printing secrets on 2026-07-01. Release follow-up: implementation commit `455a1d0c` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://a58578f6.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://392a1223.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-C_vOiI9A.js` and `assets/index-Coyian3x.css`; production API health returned OK; and post-deploy production smoke passed 5/5 using `smoke.env` without printing secrets. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, My Maps/Shared Maps behavior change, Gmail/email change, GudAuth change, or secret change was performed.
- Discover mobile map header compaction: after 2026-07-01 mobile UAT found the map-mode helper copy and list-only count no longer relevant once Browse became the only map action, Discover mobile map mode now renders a compact header with `Map View`, the mapped saved-place count, and a small `Browse` button on the same row. The explanatory hint and `saved resources shown in the list only` copy were removed from that map header only; Browse-mode filters, saved-place map pins, saved-only data, text/postal/Home/Locate search, resource type, card layout, public visibility, result ordering, auth/session, schema, permissions, postal validation for resource writes, My Maps, Shared Maps, Gmail/email, GudAuth, secrets, Worker/API behavior, and production data remain unchanged. Verification passed focused Discover coverage 3/3 with `node --test client/test/discoverySearchTools.test.js`; full server coverage passed 368/368 with `npm run test:server`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; `git diff --check` passed; and production smoke passed 5/5 using `smoke.env` without printing secrets on 2026-07-01. Release follow-up: implementation commit `0ec42548` was pushed to `codex/my-map-category-bubbles`; Cloudflare Pages branch preview deployed `https://65628910.senior-resource-map.pages.dev` with alias `https://codex-my-map-category-bubble.senior-resource-map.pages.dev`; explicit production-branch Pages publish deployed `https://a1476e05.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg` served `assets/index-B0_gaMtQ.js` and `assets/index-Coyian3x.css`; production API health returned OK; and post-deploy production smoke passed 5/5 using `smoke.env` without printing secrets. No Worker/API deploy, schema bootstrap, production data mutation, auth/session change, postal validation change, My Maps/Shared Maps behavior change, Gmail/email change, GudAuth change, or secret change was performed.

- Security remediation for remaining Codex Security medium findings: after the 2026-07-02 security scan and the already-deployed phone-login verifier fix, the remaining five targeted findings were remediated server-side. Authenticated requests now reload the live user record before route authorization so stale JWT role claims cannot continue granting privileged access; Google sign-in now requires a verified Google subject and stores `users.google_subject` instead of linking by mutable email; managed resource-list scope now rejects standard users without direct operator access; website metadata enrichment blocks private/reserved metadata targets and unsafe redirects before fetching; and User View sessions are blocked from writing `/users/me` profile or password changes. This intentionally changes Google sign-in behavior for older email-only accounts without a stored Google subject: they must sign in another way or use a future explicit link flow rather than being silently email-linked. Discover browsing, My Maps/Shared Maps, phone-login verifier behavior, public resource visibility, workbook flows, Cloudflare deploy state, production data, and secrets remain unchanged. Verification passed focused security coverage 44/44 with `node --test test/authController.test.js test/sessionAuth.test.js test/resourceListScope.test.js test/websiteMetadata.test.js test/profileImpersonation.test.js test/accessControlPrivacy.test.js` from `server/`; hard-asset enrichment coverage 7/7 with `node --test test/hardAssetsEnrichment.test.js`; full server coverage 390/390 with `npm run test:server`; and production-style client build with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client` on 2026-07-02. No deploy was performed.
- Security remediation release follow-up: on 2026-07-02 the explicit boundary schema bootstrap completed before the Worker deploy, adding the Google subject schema path required by the release checklist. Cloudflare Worker `senior-resource-map-api` was deployed to custom domain `api.carearound.sg` as version `27145fd0-5249-44cf-8c76-b10172735da2`; production API health returned `{"status":"ok"}`; and production smoke passed 5/5 using `SMOKE_BASE_URL=https://app.carearound.sg` and `SMOKE_API_BASE=https://api.carearound.sg/api` without printing smoke credentials. No Pages/client deploy was performed because no client code changed.
- Security remediation for the 2026-07-02 fresh scan medium findings: after scan `8aaff940-544c-467e-a1bb-5aa0975808d8`, the six medium findings were patched as one release batch. Public discovery indicators now filter caller-supplied hard/soft resource IDs through normal viewer visibility before computing display badges; partner managed soft-asset lists now stay limited to the partner's own or staffed offerings instead of same-region offerings owned by others; frozen shared-map snapshots now drop hard assets that are no longer publicly visible while preserving the frozen snapshot behavior for still-visible rows; auth rate limits now ignore unverified `X-Session-Token` headers and group unauthenticated requests by network identity; phone-login polling now sends the verifier in `X-Phone-Login-Token` rather than the URL and the server no longer accepts query aliases; and global sub-category creation now requires Super Admin authorization. The shared visibility helper was also tightened so a guest cannot accidentally match an asset whose owner id was not loaded. Discover ranking/sorting, saved-map ordering, frozen shared-map notes for visible rows, direct staff dashboard access, phone-login session issuance, production data, schema, Gmail/email, GudAuth secrets, and Cloudflare configuration remain unchanged. Verification first failed against the six vulnerable behaviors, then passed focused coverage 45/45 with `node --test server/test/resourceListScope.test.js server/test/discoveryLocationIndicators.test.js server/test/sharedMapsController.test.js server/test/securityMiddleware.test.js server/test/subCategoriesAuth.test.js client/test/apiRequest.test.js`; full server coverage passed 395/395 with `npm run test:server`; full client coverage passed 367/367 with `node --test client/test/*.test.js client/src/lib/*.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-07-02. Deploy pending at ledger write time.
- Fresh-scan security remediation release follow-up: on 2026-07-02 Cloudflare Worker `senior-resource-map-api` was deployed to custom domain `api.carearound.sg` as version `e6f49ebf-93c3-4da7-acb5-b6e366998bfd`. Cloudflare Pages first deployed the branch preview `https://b89e5875.senior-resource-map.pages.dev` with alias `https://codex-security-medium-fixes.senior-resource-map.pages.dev`, then explicitly published the same build to the production branch at `https://2e1e5c32.senior-resource-map.pages.dev`. Production custom domain `https://app.carearound.sg` served `assets/index-o3Vvqw7m.js` and `assets/index-CV6oERwX.css`; production API health returned OK; an initial smoke run passed 4/5 with the partner-dashboard check showing a transient blank page, the isolated partner-dashboard rerun passed, and the full production smoke rerun passed 5/5 using `SMOKE_BASE_URL=https://app.carearound.sg` and `SMOKE_API_BASE=https://api.carearound.sg/api` without printing smoke credentials. No schema bootstrap, production data mutation, Gmail/email change, GudAuth secret change, or secret rotation was performed.
- Google explicit-link recovery follow-up: after 2026-07-03 production UAT showed older email/password accounts seeing `This email is already registered. Sign in with email first before linking Google.` when choosing Google sign-in, the secure no-auto-link rule remains in place but now has a complete recovery path. Unauthenticated Google sign-in for an existing email-only account returns a structured `google_link_required` response and the login page remembers the Google credential for that interaction. When the same person signs in with email/password, the client calls the authenticated `/auth/google/link` endpoint, the server verifies the Google token again, confirms the signed-in CareAround account email matches the verified Google email, blocks Google subjects already linked to another user, stores `users.google_subject`, refreshes the session cookie, and returns the normal session payload. Future Google sign-ins use the stable Google subject. This changes only the explicit Google linking recovery path; it does not restore mutable email-only auto-linking, does not change email/password login, registration, WhatsApp phone login, role authorization, Discover, My Maps, Shared Maps, resource visibility, production data, Gmail/email secrets, GudAuth secrets, or Cloudflare configuration. Verification first failed before the helper/client flow existed, then passed focused auth/link coverage 15/15 with `node --test server/test/authController.test.js client/test/googleLinking.test.js client/test/apiRequest.test.js`; full server coverage passed 396/396 with `npm run test:server`; full client coverage passed 370/370 with `node --test client/test/*.test.js client/src/lib/*.test.js`; production-style client build passed with the existing large chunk warning using `VITE_API_URL=https://api.carearound.sg/api npm run build:client`; and `git diff --check` passed on 2026-07-03. Deploy pending at ledger write time.
- Google explicit-link recovery release follow-up: on 2026-07-03 commit `dd2097307` was pushed to `codex/security-medium-fixes`; Cloudflare Worker `senior-resource-map-api` was deployed to custom domain `api.carearound.sg` as version `081f531a-8a69-468b-acd0-9db8cf6d3b3c`; Cloudflare Pages branch preview deployed `https://9bbea0b9.senior-resource-map.pages.dev` with alias `https://codex-security-medium-fixes.senior-resource-map.pages.dev`; the same build was explicitly published to the production branch at `https://e279acb5.senior-resource-map.pages.dev`; production custom domain `https://app.carearound.sg/login` served `assets/index-DwGljvPt.js` and `assets/index-CV6oERwX.css`; the live bundle contained `google_link_required`, `auth/google/link`, and the new link-next-time copy; production API health returned OK at `2026-07-03T03:42:14.028Z`; and production smoke passed 5/5 using `SMOKE_BASE_URL=https://app.carearound.sg` and `SMOKE_API_BASE=https://api.carearound.sg/api` without printing smoke credentials. No schema bootstrap, production data mutation, Gmail/email secret change, GudAuth secret change, or secret rotation was performed.

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
- AI enrichment

Active next recovery family:
- Release smoke and final deployment check

### 2026-07-11 CCK/W01 fixed-surface owner proof and hosted activation

- Current behavior: behind the build-time `VITE_TOWN_MAP_PROOF_ENABLED` flag, My Map
  owner view keeps Leaflet, the existing pins, clustering, selection, camera,
  reset, cards, and full-map interaction while switching automatically between
  a OneMap `Default_HD` `Standard` surface and the fixed CCK/W01 `Detailed`
  surface at zoom level 15. Detailed mode loads only visible geographically
  positioned W01 image chunks and renders no live OneMap tile images. The
  repository-wide `Grey_HD` default and all unflagged callers remain unchanged.
  If an owner selects the unavailable-looking `Detailed` control below level
  15, the map stays on `Standard` and explains that zooming in to level 15 will
  turn on Detailed automatically. The guidance clears at the eligible level.
  The flagged owner proof also keeps the normal mobile map frame in page flow
  at the end of a short resource list so touch momentum cannot alternate the
  page height and produce vertical vibration; the shared list component keeps
  its existing default behavior.
- Reproduction steps: start the local client with the proof flag and W01 asset
  base, open an owned `/my-directory/maps/:id`, verify `Standard` below zoom 15
  and automatic `Detailed` at zoom 15, select `Detailed` at zoom 14 and verify
  the plain-language guidance without a mode change, inspect tile/chunk
  requests, focus a card and switch modes, open/close full map, then at mobile
  width scroll beyond the last resource card and sample map height, page
  height, and scroll position.
- Acceptance criteria: Standard uses only `Default_HD` in the flagged owner
  proof; Detailed shows fixed W01 chunks with zero live OneMap tile images;
  selecting Detailed below level 15 explains the automatic threshold while
  leaving Standard active, and the guidance clears when Detailed activates;
  selection and pin alignment survive mode changes; the normal mobile map and
  page height do not collapse or oscillate at list end; Discover, Shared Maps,
  print/export, data, auth, and unflagged live maps are unchanged.
- Verification result: signed-in mobile UAT showed 6 `Default_HD` images and no
  `Original_HD`/`Grey_HD` images in Standard, then 6 visible W01 chunks and zero
  live tile images in Detailed. Before the mobile guard, list focus removed the
  approximately 300 px map footprint; after the guard, map height stayed
  298.44 px, page height stayed 1,266 px, and 16 samples over approximately
  560 ms showed no oscillation. Focused map/My Map coverage passed 126/126,
  full client coverage passed 390/390, `npm run build:client` passed with only
  the existing large-chunk advisory, and `git diff --check` passed. A follow-up
  signed-in check at zoom 14 kept 12 live tiles and zero fixed chunks while
  showing the guidance; zoom 15 then cleared it and switched to 20 fixed chunks
  with zero live tiles. Full local evidence is in
  `output/town-map-proof/uat-evidence.md`. Dormant release follow-up: implementation
  commit `ba69345ee` was pushed to `codex/cck-w01-town-map-proof`; Pages preview
  `https://9311acad.senior-resource-map.pages.dev` and production publish
  `https://88ed4e38.senior-resource-map.pages.dev` completed; the custom domain
  serves `assets/index-BasuxQyR.js` and returned 200 for the app, Discover, an
  owner-map route, and API health. Every `VITE_TOWN_MAP_*` build variable was
  omitted and the deployed bundle contains no localhost W01 URL, so this proof
  remains dormant and existing production map behavior is unchanged. Production
  smoke had four immediate passes and one dashboard-resources flow that passed
  on retry after a transient 30-second visibility timeout. No Worker/API or R2
  deployment, schema bootstrap, auth, permission, data, ranking, filtering,
  visibility, or saved-resource change was performed.
- Hosted activation follow-up: R2 bucket `carearound-town-map-assets` now serves
  versioned W01 assets at `https://maps.carearound.sg/v1/w01` through an active
  custom domain with minimum TLS 1.2 and read-only, release-origin CORS. The
  public verifier passed all 300 chunk hashes and 53,590,423 bytes, matching
  manifest SHA-256
  `be5f6ed4dfdea33606354f4457aebdc513c0f274f4ea7cb429bdce5d73056c76`
  and chunk-set SHA-256
  `81bd26441edaff1d761f9e395575f8e00b9303f25e1d7896307f7f3036bbc8c6`;
  chunk delivery measured 40.6 ms median and 652.7 ms p95. Enabled preview
  `https://ea750ad6.senior-resource-map.pages.dev` passed signed-in desktop,
  mobile, full-map, mode-swap, threshold, selection, alignment, viewport-culling,
  memory, end-scroll, clean-console, and zero-live-tile Detailed checks. A
  non-mutating mocked outside-W01 pin check kept Standard and the resource card
  visible with no fixed chunks. Exact production build gates passed focused map
  93/93, full client 390/390, full server 396/396, R2 contract 4/4,
  `npm run build:client`, and `git diff --check`. Pages production deployment
  `https://3ceb94d7.senior-resource-map.pages.dev` activated the flag using
  `https://maps.carearound.sg/v1/w01`; `https://app.carearound.sg` serves
  `assets/index-Du2wVU3_.js`, production API health returned OK, production
  smoke passed 5/5, and a fresh signed-in owner check showed 9 R2 chunks, 0 live
  OneMap tiles, attribution present, and 0 console errors or warnings. The
  pre-existing external OneMap badge SVG remains blocked by Chromium ORB while
  its attribution text remains visible. Immediate rollback is a Pages rebuild
  with all `VITE_TOWN_MAP_*` values omitted; dormant deployment
  `https://88ed4e38.senior-resource-map.pages.dev` is the verified reference.
  No Worker/API deploy, schema, auth, permission, data, Discover, Shared Maps,
  print/export, ranking, filtering, visibility, or saved-resource change was
  performed.
- Standard fractional-step recovery and production release: production owner
  map 150 reproduced a blank Standard surface at a displayed level 14 while
  Detailed remained healthy at the next step. Signed-in inspection found the
  fitted camera was actually at Leaflet zoom 14.30, inside the gap between the
  exact Standard tile ceiling of 14 and the rounded Detailed threshold of
  14.50. The narrow client correction normalizes only a settled camera inside
  that hidden gap back to exact level 14; maps already at or below 14, the
  Detailed threshold, manual Standard mode, fixed chunks, camera fit bounds,
  pins, and every unflagged DirectoryMap caller remain unchanged. Signed-in
  local UAT on map 150 rendered 12 Standard tiles at 14, 28 fixed chunks and 0
  live tiles at 15, then 12 Standard tiles at 14 again with the first pin's
  transform restored. Map 87 remained healthy with 20 Standard tiles and map
  25 remained healthy in Detailed with 0 live tiles. Focused coverage passed
  127/127, full client coverage passed 391/391, the exact enabled production
  build passed with the existing large-chunk advisory, and `git diff --check`
  passed. Release follow-up: commit `bbdc37d94` was pushed to
  `codex/cck-w01-town-map-proof`; Pages production deployment
  `https://65925a9b.senior-resource-map.pages.dev` completed; and
  `https://app.carearound.sg` serves `assets/index-Al1p94v0.js`. Fresh signed-in
  production verification on map 150 rendered 9 Standard tiles at 14, 20 fixed
  chunks and 0 live tiles at 15, then 9 Standard tiles at 14 again with the
  first pin returning to the same geographic transform. Map 87 remained healthy
  with 20 Standard tiles and map 25 remained healthy with 6 fixed chunks and 0
  live tiles in Detailed. Production API health returned OK and production
  smoke passed 5/5. Browser logs contained no CareAround application warnings
  or errors; the only logged error was an unrelated Chrome-extension
  content-script load failure on all checked tabs. No API/Worker deploy, R2
  mutation, schema, auth, permission, data, Discover, Shared Maps, print/export,
  ranking, filtering, visibility, or saved-resource change was made.

### 2026-07-12 persistent Default/Gray map colour preference

- Current behavior: a device-level `Default | Gray` control is available on
  Discover, My Maps, and Shared Maps, persists between routes, and also governs
  non-interactive print map rendering. Default uses OneMap `Default_HD`; Gray
  uses native OneMap `Grey_HD`. Owner W01 Detailed mode keeps the existing
  colour surface for Default and selects the completed native Grey fixed
  surface for Gray. The two Detailed manifests preload so an active
  fixed-surface colour switch does not fall through to live OneMap tiles.
  Standard/Detailed remains a separate owner-only control. Pins, clustering,
  camera, reset, cards, selection, attribution, full map, ranking, filtering,
  visibility, and data behavior are unchanged.
- Reproduction steps: clear the map-style preference and confirm Default on
  first load; select Gray on Discover and navigate to My Maps and a public
  Shared Map; verify the selection persists and live tile URLs use `Grey_HD`.
  On owned W01 map 25 at Detailed zoom, switch Default → Gray and inspect image
  requests, visible chunk count, marker transforms, selected card/camera state,
  attribution, console, and failed requests. Repeat at 390 px and overscroll
  past the final resource card.
- Acceptance criteria: Default is the safe fallback for missing/invalid stored
  values; Gray never uses a CSS grayscale filter; Detailed uses only the chosen
  fixed surface and loads only visible chunks; no live OneMap tile is requested
  by an active Detailed colour switch; Default/Gray changes do not remount the
  Leaflet MapContainer or move pins/camera; Discover fractional zoom stays
  valid; Shared Maps remains guest-readable; mobile controls fit and end-scroll
  does not oscillate.
- Verification result: the Gray W01 source validation and source-alignment QA
  passed. R2 published 88 allowlisted chunks under the isolated
  `v1/w01/gray` prefix, then the manifest. Public verification matched
  48,817,738 chunk bytes, manifest SHA-256
  `58bb3880ee09b9b6bac938545048694b8d6a38728ddaf874db5e606971603640`,
  and chunk-set SHA-256
  `5456cd4fb905dccaea7ba7f30610a34750163bff225bfc09634eb370600cb281`;
  warm-cache delivery was 50.8 ms median and 382.5 ms p95. Preview UAT at
  `https://codex-map-style-preference.senior-resource-map.pages.dev` showed six
  desktop chunks (~84.4 MiB decoded) and two mobile chunks (~28.1 MiB decoded),
  zero live tiles during the preloaded Detailed switch, exact four-pin transform
  parity between Default and Gray, persistent My Map/Discover/Shared selection,
  valid integer Discover tiles after the narrow layer-remount correction, zero
  mobile scroll jitter, and a clean guest-browser console. Screenshots and exact
  request evidence are in `output/town-map-proof/uat-evidence.md`. Production
  Pages deployment `https://c9114285.senior-resource-map.pages.dev` completed;
  `https://app.carearound.sg` serves `assets/index-Qri8mQ9i.js` and
  `assets/index-B86VNPto.css`, API health returned OK, and production smoke
  completed all five flows (dashboard resources passed on its configured retry
  after one 30-second visibility timeout). Fresh production browser UAT matched
  the preview: Default Detailed used six colour chunks, Default → Gray requested
  only six Gray chunks and zero live tiles, all four pin transforms stayed
  identical, mobile retained two Gray chunks, Discover used valid integer Gray
  tiles, guest Shared Maps used 12 Gray tiles, attribution remained visible,
  and both production browser sessions had zero application warnings or errors.
  No Worker/API deploy, schema, auth, permission, ranking, filtering,
  visibility, saved-resource, or production-data mutation was made.

### 2026-07-12 shared responsive map settings layout

- Current behavior: My Maps and Discover use one compact `Map` button in the
  map's upper-right control lane instead of keeping the map-detail and
  map-colour choices permanently across the map centre. Desktop opens the same
  `Map appearance` content in an anchored popover; mobile opens it in the
  existing CareAround bottom sheet. My Map owners see `Map detail` and
  `Map colour`; Discover and guest Shared Maps show only the choices available
  on those surfaces. Discover zoom controls now occupy the upper-left lane so
  the placement matches DirectoryMap. Closing the settings restores the full
  unobstructed map while the existing Leaflet map instance, camera, pins,
  clusters, selection, reset, full-map control, attribution, and persistent
  Default/Gray preference remain unchanged.
- Reproduction steps: open an owned `/my-directory/maps/:id` and Discover at
  desktop and 390 px widths; verify one upper-right `Map` button; open and close
  `Map appearance`; confirm the owner sheet contains Map detail plus Map colour
  while Discover contains Map colour only; switch Default/Gray; and confirm the
  map rectangle, selected resource, camera, and pin positions do not change.
  On mobile, scroll beyond the final My Map card and sample page scroll
  position after momentum settles.
- Acceptance criteria: My Maps and Discover share the same settings placement
  and responsive interaction; no permanent segmented controls consume the map
  centre; the mobile sheet is readable without shrinking the map; opening,
  closing, or changing a choice does not resize or remount MapContainer; the
  wrong-zoom Detailed guidance remains plain language inside the owner sheet;
  Shared Maps remain guest-readable; and no map, ranking, filtering,
  visibility, resource, auth, API, schema, or permission behavior changes.
- Verification result: focused map/layout coverage passed 35/35; full client
  coverage passed 397/397; full server coverage passed 396/396; local smoke
  passed 5/5; `npm run build:client` passed with only the existing large-chunk
  advisory; and `git diff --check` passed. Signed-in browser UAT on owner map 45
  and Discover at 1440x1000 and 390x844 confirmed the same popover/sheet
  pattern, stable map bounds while opening settings and changing colour, and a
  0 px mobile end-scroll range across 20 animation frames. Local-only CORS and
  OneMap badge ORB failures were expected for the `127.0.0.1` origin and must
  be rechecked from the production custom domain after deployment. Release
  follow-up: implementation commit `e0fbb31a2` was pushed to
  `codex/shared-map-settings-layout`; preview
  `https://8e0fec65.senior-resource-map.pages.dev` and production deployment
  `https://12fec3c0.senior-resource-map.pages.dev` completed; and
  `https://app.carearound.sg` serves `assets/index-Ds2cwQWb.js` with
  `assets/index-r02V7GVR.css`. Production smoke completed all five flows; the
  postal-import flow passed on its configured retry after one 45-second
  anchor-result timeout. Fresh signed-in production UAT repeated the stable
  desktop/mobile map-bound and 0 px end-scroll checks on My Map and Discover,
  and recorded zero application console errors. Network inspection found only
  expected Leaflet/R2 image cancellations during camera, style, viewport, and
  route changes, Cloudflare RUM cancellation, and the pre-existing external
  OneMap badge SVG Chromium ORB block; attribution text stayed visible. API
  health returned OK. No Worker/API, R2, schema, auth, permission, ranking,
  filtering, visibility, saved-resource, or production-data change was made.
- Compact-control release follow-up: commit `430114e9` replaced the visible
  `Map` label with the accessible settings icon, added a current zoom-step
  indicator to Discover, and placed desktop settings, reset, and zoom controls
  in one compact upper-right rail. My Map keeps the existing intentional reset
  behavior: the reset/recenter button only appears when there is more than one
  camera target to fit. Mobile keeps zoom on the left and uses compact 40 px
  map-control buttons when those controls are available. UI/UX spacing is 8 px
  between control groups; desktop controls are 34 px. Pre-deploy focused map
  coverage passed 17/17, full client coverage passed 397/397, full server
  coverage passed 396/396, the production-configured client build passed with
  only the existing large-chunk advisory, and `git diff --check` passed.
  Cloudflare Pages branch preview deployed
  `https://cc2ccc4f.senior-resource-map.pages.dev` with alias
  `https://codex-shared-map-settings-la.senior-resource-map.pages.dev`; the
  same built client was explicitly published to production at
  `https://7d55a391.senior-resource-map.pages.dev`. Production custom domain
  `https://app.carearound.sg` served `assets/index-DtQwAvZb.js` and
  `assets/index-B5_qVJbt.css`; production API health returned OK at
  `2026-07-12T04:04:28.562Z`; production smoke passed 5/5 using `smoke.env`
  without printing credentials. Signed-in production browser UAT on My Map 45
  and Discover confirmed desktop settings controls at 34 px, mobile settings
  and reset controls at 40 px where present, stable map bounds while opening
  settings and changing colour, 0 px mobile end-scroll movement, and zero
  application console errors. My Map 45 still hides reset because it has only
  one camera target, preserving the intentional behavior. Network inspection
  showed only expected Cloudflare RUM aborts, the pre-existing external OneMap
  badge SVG Chromium ORB block, and OneMap tile request aborts during camera,
  style, viewport, and route changes. No Worker/API, R2, schema, auth,
  permission, ranking, filtering, visibility, saved-resource, or production-data
  change was made.
- Mobile right-rail and Back-navigation follow-up: mobile My Map, Shared Map,
  and Discover map controls now use a 30 px visual size. Settings, conditional
  reset/recenter, zoom indicator, and zoom actions form one upper-right rail
  with 8 px gaps; the mobile full-map enter/exit controls use the same compact
  size. Desktop remains at the verified 34 px size. Mobile automatic camera
  fits and compact-cluster reframing reserve a wider right-side safe area so
  pins do not settle beneath the control rail. Interactive My Map/Shared Map
  resource links stay within React Router, while print links retain document
  navigation. A user-scoped, eight-entry in-memory My Map detail cache keeps a
  previously loaded owner map visible while its fresh API response settles,
  preventing the mobile browser/device Back action from restoring only empty
  loading-card outlines. The cache key requires both the signed-in user ID and
  map ID, so one account cannot reuse another account's cached map. Reproduction
  covered My Maps list → owner map → resource detail → browser Back and the
  explicit resource-detail Back action at a Pixel 7 / 390x844 viewport.
  Pre-deploy verification passed focused map/navigation coverage 89/89, full
  client coverage 398/398, full server coverage 396/396, the
  production-configured client build with only the existing large-chunk
  advisory, and `git diff --check`. Signed-in local browser UAT measured 30 px
  mobile settings/reset controls, 30 px zoom actions, 8 px control-group gaps,
  stable map bounds while settings opened, 0 px end-scroll movement, and a
  fully visible map after both Back paths. Production smoke completed all five
  flows; the postal-import flow passed its configured retry after one live
  service timeout and then passed a separate clean targeted rerun. No
  Worker/API, R2, schema, auth, permission, ranking, filtering, visibility,
  saved-resource, or production-data change is included.
  Release follow-up: implementation commit `4aa119777` was pushed to
  `codex/shared-map-settings-layout`; Cloudflare Pages branch preview deployed
  `https://a8808cb1.senior-resource-map.pages.dev`; and the same build was
  published to production at
  `https://65b0b64d.senior-resource-map.pages.dev`. The custom domain serves
  `assets/index-CGK0FNHf.js` and `assets/index-CXgnAuHp.css`; production API
  health returned OK at `2026-07-12T05:30:37.919Z`; and post-deploy production
  smoke passed 5/5 without retry. Fresh signed-in production UAT at 1440x1000
  and 390x844 repeated the 34 px desktop and 30 px mobile control measurements,
  the upper-right mobile rail, stable map bounds, and 0 px end-scroll movement.
  Device-style history Back from resource detail restored owner map 45 in
  16 ms from the user-scoped cache; the explicit in-app Back also restored the
  fully rendered map. Both paths preserved the same SPA document marker and
  recorded zero application console or page errors. Network inspection found
  only expected Cloudflare RUM cancellations, the pre-existing external OneMap
  badge SVG Chromium ORB block, and OneMap tile aborts during camera, viewport,
  style, and route changes.
- Mobile My Map entry-position follow-up: opening an owner My Map on a phone,
  including returning from an interactive resource detail with browser Back,
  now starts at the map and first card instead of restoring the previous
  card-list offset. A route-key observer in the app shell is limited to mobile
  `/my-directory/maps/:id` interactive routes; it absorbs Chrome's delayed
  history scroll restoration for 120 ms and then releases normal page
  scrolling. Desktop My Map, print view, Shared Maps, Discover, map selection,
  camera state, card ordering, and resource navigation remain unchanged.
  Focused map/navigation coverage passed 53/53, full client coverage passed
  399/399, the production-configured client build passed with only the existing
  large-chunk advisory, and `git diff --check` passed. Pixel 7 browser UAT
  forced a 2,156 px pre-navigation scroll offset, opened an interactive
  resource within the SPA, then used browser Back; My Map returned at scroll
  position 0 with `data-mobile-map-state="default"`, the map visible, the first
  card following Map notes, and zero page or application console errors. The
  local R2 manifest CORS failures remain expected for the `127.0.0.1` origin.
  No Worker/API, R2, schema, auth, permission, ranking, filtering, visibility,
  saved-resource, or production-data change is included.
  Release follow-up: implementation commit `4f3ea03a5` was pushed to
  `codex/shared-map-settings-layout`; preview
  `https://67fc2b24.senior-resource-map.pages.dev` and production deployment
  `https://825e09b9.senior-resource-map.pages.dev` completed. The production
  custom domain serves `assets/index-Dz8Yaxgj.js` and
  `assets/index-CXgnAuHp.css`; API health returned OK at
  `2026-07-12T07:05:34.812Z`; and post-deploy production smoke passed 5/5.
  Fresh production Pixel 7 UAT repeated the forced 2,156 px scroll → resource
  → browser Back flow and returned at scroll 0 with map state `default`, the
  map visible, the SPA marker preserved, and zero console or page errors.
- Desktop owner-map resize follow-up: an owned My Map with mapped resources now
  has a centred bottom-edge handle that can expand the map from its existing
  48vh/440-700 px baseline up to 78vh/840 px. The adjustment is deliberately
  desktop-only and session-only; it does not change mobile My Map, Discover,
  Shared Maps, print, saved preferences, or the default height on a future
  visit. Pointer dragging, Arrow Up/Down, Home/End, and double-click reset are
  supported through an accessible separator control. The existing Leaflet map
  instance is retained and receives only an opt-in size invalidation, without
  changing the layout signature or triggering a fit, so zoom, selected card,
  markers, and map interaction state remain intact. Focused map coverage passed
  58/58; full client coverage passed 393/393; full server coverage passed
  396/396; the production-configured client build passed with only the existing
  large-chunk advisory; pre-deploy production smoke passed 5/5; and
  `git diff --check` passed. Signed-in local browser UAT on owner map 45 at
  1440x1000 expanded the frame from 480 px to 700 px by drag and to the 780 px
  viewport cap by keyboard, kept its 620 px width, retained the same Leaflet
  element, zoom step 18, marker count, and selected FRCS card, then reset to
  480 px by Home and double click. At 390x844 the resize handle was absent and
  the existing mobile map and first card remained unchanged. The local R2
  manifest CORS failures and external OneMap badge SVG Chromium block remain
  expected for the `127.0.0.1` origin and must be rechecked on the production
  custom domain. No Worker/API, R2, schema, auth, permission, ranking,
  filtering, visibility, saved-resource, or production-data change is included.
  Release follow-up: implementation commit `5b31f77ce` was pushed to
  `codex/shared-map-settings-layout`; branch preview
  `https://f841058e.senior-resource-map.pages.dev` and production deployment
  `https://1b4ba521.senior-resource-map.pages.dev` completed from the same
  validated build. The custom domain serves `assets/index-B_XnqLS2.js` and
  `assets/index-C_bw69gG.css`; API health returned OK at
  `2026-07-12T08:34:57.939Z`; and post-deploy production smoke passed 5/5.
  Fresh signed-in preview and production UAT repeated every resize, reset,
  selection, marker, map-identity, width, and mobile-exclusion check with zero
  application console or page errors. Production network inspection found
  only expected route-change/favorites cancellations, Cloudflare RUM aborts,
  and the pre-existing external OneMap badge SVG Chromium ORB block.
  Corrective build follow-up: the first resize production build at
  `https://1b4ba521.senior-resource-map.pages.dev` omitted the build-time
  `VITE_TOWN_MAP_*` values and therefore hid the owner `Map detail` control.
  No source behavior was removed. The same commit was rebuilt with the locked
  production flag and both versioned W01 asset bases, then published at
  `https://aebc0610.senior-resource-map.pages.dev`. The custom domain now serves
  `assets/index-DYIrd1Ol.js`. Fresh signed-in production UAT on owner map 45
  confirmed Map detail and Detailed are visible; zoom 14 uses Standard; zoom 15
  automatically selects Detailed; 30 fixed chunks render with zero live
  OneMap tiles visible; the desktop resize handle remains available; and the
  browser recorded zero application console or page errors. Default and Gray
  R2 verification passed all 300/88 chunks and their manifest/chunk-set hashes,
  focused map coverage passed 43/43, the exact enabled production build passed,
  post-correction smoke passed 5/5, and API health returned OK. The release
  checklist now records all four required production build variables so a
  normal client rebuild cannot silently disable Detailed again.
- Owner Print Map workspace: the private owner `?view=print` route now starts
  from an independent, safe print baseline: fit-all camera, 360 px map height,
  and Standard detail, while carrying the user's existing Default/Gray colour
  preference. Owners can adjust zoom, pan, Standard/Detailed, Default/Gray, and
  map height from 300-720 px, then reset only the print map. The visible print
  preview and the hidden Save-as-image surface consume the same controlled
  camera, colour, detail, height, and fixed 1480 px capture width; browser Print
  uses that same visible preview. A capture-state key remounts only the hidden
  export basemap layer, ensuring a fresh tile/chunk readiness event after each
  visual change without altering interactive My Map behavior. Detailed remains
  owner-only and auto-applies at zoom 15; selecting it below zoom 15 keeps the
  request and shows the existing plain-language zoom guidance. Shared Map print
  callers retain their optional-prop defaults, and the separate owner PDF
  ledger is unchanged. Reproduction: open an owned map with `?view=print`,
  change colour, zoom/pan, detail, and height, then compare the preview with
  Save as image and browser Print; use Reset print map to restore the baseline.
  Pre-deploy verification passed focused print/map coverage 44/44, full client
  coverage 399/399, full server coverage 396/396, the exact Detailed-enabled
  production build with only the existing large-chunk advisory, pre-deploy
  production smoke 5/5, and `git diff --check`. Signed-in local browser UAT at
  1440x1000 and 390x844 confirmed identical screen/export state, a successful
  Gray PNG download after height and camera changes, print-only toolbar hiding,
  an accessible resize handle, and no horizontal mobile overflow. Local R2
  manifest CORS failures remain expected for `127.0.0.1`; Detailed Default/Gray
  capture and network behavior must be rechecked on the production custom
  domain. No Worker/API, R2, schema, auth, permission, ranking, filtering,
  visibility, saved-resource, PDF-ledger, Shared Map, or production-data change
  is included.
  Release follow-up: implementation commit `e031e266f` was pushed to
  `codex/shared-map-settings-layout`; Cloudflare Pages branch preview deployed
  `https://a1860626.senior-resource-map.pages.dev` with alias
  `https://codex-shared-map-settings-la.senior-resource-map.pages.dev`; and the
  same validated build was explicitly published to production at
  `https://c39e8088.senior-resource-map.pages.dev`. The production custom
  domain serves `assets/index-ByfQM4vi.js` and `assets/index-46zy6Sgb.css`; API
  health returned OK at `2026-07-12T10:20:40.749Z`; and post-deploy production
  smoke passed 5/5 without retry. Fresh signed-in production UAT on owner map
  45 confirmed Detailed Default with 9 visible/export chunks and Detailed Gray
  with 3 visible/export chunks, exact preview/export state parity, successful
  5920 px-wide PNG downloads for both styles, zero visible live tiles, zero
  live OneMap tile requests after Detailed was selected, and zero page errors.
  The export library emits one non-fatal CSP console notice while resolving its
  data-image placeholder; both downloads complete and render correctly. No
  Worker/API or R2 deployment was performed.
  Toolbar-alignment follow-up: the owner Print Map toolbar now keeps Back to
  interactive view, Reset print map, and Save as image together in one
  left-aligned responsive action group. The redundant in-app Print button is
  removed; browser/system printing remains available and still uses the same
  configured preview. The helper copy now describes the saved image only. The
  map-settings trigger uses a 13 px mobile right inset and the established
  12 px desktop inset so its centre aligns exactly with the differently sized
  zoom-control frame. Local signed-in browser UAT at 1440x1000 and 390x844
  measured a 0 px horizontal-centre delta at both widths, confirmed the Print
  button absent, kept all remaining actions left-aligned, downloaded the image,
  preserved exact preview/export state, and found no horizontal overflow or
  page errors. Focused print/map coverage passed 40/40, full client coverage
  passed 399/399, full server coverage passed 396/396, the exact
  Detailed-enabled production build passed with only the existing large-chunk
  advisory, pre-deploy production smoke passed 5/5, and `git diff --check`
  passed. No map camera, map data, export state, Shared Map, PDF ledger,
  Worker/API, R2, schema, auth, permission, ranking, filtering, visibility,
  saved-resource, or production-data behavior is changed.
  Release follow-up: implementation commit `68acd838f` was pushed to
  `codex/shared-map-settings-layout`; Cloudflare Pages branch preview deployed
  `https://fed3ada1.senior-resource-map.pages.dev` with the existing branch
  alias; and the same validated build was explicitly published to production
  at `https://61833821.senior-resource-map.pages.dev`. The production custom
  domain serves `assets/index-tuaHPNyy.js` and `assets/index-gdJR9SuY.css`; API
  health returned OK at `2026-07-12T11:07:03.863Z`; and post-deploy production
  smoke passed 5/5 without retry. Fresh signed-in production UAT repeated the
  0 px desktop/mobile control-centre delta, left-aligned toolbar grouping,
  absent Print button, exact preview/export state, successful image download,
  no horizontal overflow, and zero page errors. The known non-fatal image
  placeholder CSP notice remains unchanged. No Worker/API or R2 deploy was
  performed.
- Owner Print Map hybrid-layout lock: the existing centred, two-label-rail
  print sheet remains the exact `Balanced` default. An optional `Map focus`
  layout widens the same Leaflet map and consolidates all resource labels into
  one rail opposite the map; owners can choose map left/right and Wide/Extra
  wide within the fixed 1480 px capture canvas. Label detail is independently
  selectable as Names only, Names + logos, Names + addresses, or Full details,
  while every choice preserves the matching map number and category colour.
  Layout controls stay outside the printable sheet and use progressive
  disclosure, so map position and width appear only for Map focus. The visible
  preview and hidden Save-as-image surface consume the same normalized layout,
  side, width, label-detail, camera, detail, colour, and height state; Reset
  print map restores Balanced, fit-all, Standard, 360 px, Full details while
  preserving the user's global map-colour preference. Shared Map print keeps
  its existing defaults and does not receive these owner-only controls.
  Reproduction: open an owned map with `?view=print`; confirm Balanced matches
  the locked two-rail baseline; open Print layout; select Map focus, each side
  and width, and each label-detail choice; compare the preview with Save as
  image; then Reset print map and confirm the baseline returns. Pre-release
  verification passed focused print/i18n/list coverage 44/44, full client
  coverage 441/441, full server coverage 451/451, authenticated local smoke
  6/6, the exact islandwide Detailed-enabled production build with only the
  existing large-chunk advisory, and `git diff --check`. Signed-in local
  desktop UAT confirmed progressive disclosure, Balanced baseline parity,
  Map focus on both sides, Wide/Extra wide, Names only and Names + addresses,
  and exact visible/export state parity. Production image download, mobile
  width, custom-domain smoke, and API health remain release gates. No
  Worker/API, R2, map camera, map data, Detailed surface, Shared Map, PDF
  ledger, schema, auth, permission, ranking, filtering, visibility,
  saved-resource, or production-data behavior is changed.
  Release follow-up (2026-07-19): implementation commit `3a69101d6` and the
  narrow capture-readiness correction `f5940d9e1` were pushed through the
  isolated `codex/print-map-layout-composer` branch and fast-forwarded to
  `main`. The final production-configured client build passed with all four
  islandwide Detailed-map values and only the existing large-chunk advisory;
  full client coverage passed 442/442 and the earlier server run remained
  451/451 because the correction is client-only. The validated build was
  explicitly published at
  `https://4a06d8b0.senior-resource-map.pages.dev`, and the custom domain
  served the same `assets/index-CSi-sBxv.js` bundle. Fresh signed-in production
  UAT on owner map 87 confirmed Balanced remains the exact default; Map focus,
  right placement, Extra wide, and Names + addresses stay identical between
  the visible and hidden export surfaces; Save as image produced a readable
  5920 x 4296 PNG; mobile-width preview had zero horizontal overflow; and Reset
  restored Balanced, centred map, Wide, and Full details. API health returned
  OK at `2026-07-19T12:55:10.866Z`; the public smoke passed; and the browser
  recorded no application-origin console error. The authenticated smoke runner
  was not rerun after the capture correction because its local credential
  variables were unavailable; the same six-test production smoke had passed
  immediately before the client-only correction, and the affected owner route
  was rechecked through the signed-in production session. No Worker/API, R2,
  schema, auth, permission, ranking, filtering, visibility, saved-resource,
  PDF-ledger, Shared Map, or production-data deployment was performed.
- Owner Print Map compact badge refinement (local, 2026-07-19): `Names only`
  no longer reuses the large number-as-logo tile or waits for Leaflet cluster
  colour data. It renders one compact circular number badge from the resource
  group's category colour and removes the resource-logo slot, keeping dense
  owner maps as short as practical. Owner-print number badges now always face
  the map: the left label rail places them at each card's end, while the right
  label rail places them at each card's start. This rule covers both `Balanced`
  rails and either `Map focus` side; label modes with logos retain their logos,
  and label modes without logos do not reserve an empty tile. The visible
  preview and hidden Save-as-image surface share the same badge colour,
  position, and compact-label markup. Shared Map print retains its existing
  default card path because the behavior remains gated to owner print.
  Reproduction: open an owned map with `?view=print`; choose `Names only`; in
  `Map focus`, switch between Map on left and Map on right and confirm every
  number sits on the card edge nearest the map with no logo tile; switch to
  `Balanced` and confirm both rails face the centre map. Focused print/V2/list
  coverage passed 57/57, full client/source coverage passed 442/442, the exact
  islandwide Detailed-enabled production build passed with only the existing
  large-chunk advisory, and `git diff --check` passed. Signed-in local Chrome
  UAT on owner map 87 measured 15/15 compact badges, zero resource logos in
  `Names only`, four category colours, correct start/end placement for both
  Map focus sides, the expected 8 end-side and 7 start-side badges in Balanced,
  and exact screen/export parity. No application-origin console error was
  recorded; two unrelated Chrome-extension module errors remained outside the
  app origin. No commit, push, Pages/Worker/R2 deployment, schema, auth,
  permission, map-camera, map-data, Detailed-surface, PDF-ledger, Shared Map, or
  production-data change was performed.
- Owner Print Map badge readability and Balanced-width refinement (local,
  2026-07-19): owner-print number badges now use print-only fixed pixel tokens
  so the global `A-` control cannot shrink them below their normal readable
  size. Compact `Names only` badges remain 20px with 11px numerals, while the
  other label modes remain 28px with 13px numerals. Badge colour, map-facing
  placement, label composition, and visible/Save-as-image parity remain
  unchanged. `Balanced` keeps its existing `Wide` default at a 680px map with
  340px label rails, and now exposes the same opt-in `Extra wide` choice as Map
  focus: a 760px map with narrower 300px label rails. Reproduction: open an
  owned map with `?view=print`; reduce the site text size to its minimum; switch
  between `Names only` and `Full details` and confirm the badges remain readable;
  then select `Balanced` and compare `Wide` with `Extra wide`. Focused print/list
  coverage passed 42/42, full client/source coverage passed 442/442, the exact
  islandwide Detailed-enabled production build passed with only the existing
  large-chunk advisory, and `git diff --check` passed. Signed-in local Chrome
  UAT on owner map 87 measured a 9.6px root font with 15/15 compact badges at
  20px/11px and 15/15 regular badges at 28px/13px on both preview and export
  surfaces. Balanced `Wide` remained 680px and `Extra wide` measured 760px on
  both surfaces. No application-origin console error was recorded; one
  unrelated Chrome-extension module error remained outside the app origin. No
  commit, push, Pages/Worker/R2 deployment, schema, auth, permission,
  map-camera, map-data, Detailed-surface, PDF-ledger, Shared Map, or
  production-data change was performed.
  Release follow-up (2026-07-19): implementation commit `63f945d55` was pushed
  through `codex/print-badge-readability-balanced-width`, fast-forwarded to
  `main`, and published to Cloudflare Pages. The final validated production
  deployment is `https://ab92a278.senior-resource-map.pages.dev`; the custom
  domain served `assets/index-BBiB-zl5.js`,
  `assets/MyMapDetailPage-BbcbKnn5.js`, and `assets/index-BvqD4c2b.css` with
  both islandwide asset roots and no W01-only marker. The Git-triggered build
  briefly replaced the first validated upload with an older W01-root bundle;
  republishing the same validated `client/dist` explicitly to `--branch main`
  restored the correct custom-domain release. Signed-in production UAT on
  owner map 87 reproduced 15/15 20px/11px compact badges, 15/15 28px/13px
  regular badges, and the 760px Balanced `Extra wide` map with exact
  preview/export parity at the 9.6px root font. API health returned OK at
  `2026-07-19T15:50:29.699Z`, public Discover returned HTTP 200, and no
  application-origin console error was recorded. Authenticated smoke
  credentials were unavailable in the release shell, so the credentialed smoke
  suite was not claimed. No Worker, R2, schema, auth, permission, map-data,
  Detailed-surface, PDF-ledger, Shared Map, or production-data deployment was
  performed.
- Owner Detailed viewport-coverage correction: production tablet UAT showed a
  15-resource owner map staying on Standard at zoom 15 while the current
  viewport was inside the CCK/W01 Detailed surface. The root cause was the
  owner page disabling Detailed when any mapped resource in the full map was
  outside W01, even if the current viewport had visible W01 chunks. The
  recovery keeps the CCK/W01-only safety boundary but moves interactive owner
  availability to viewport coverage: Detailed can turn on at zoom 15 when the
  current viewport intersects W01 chunks, and the map falls back to Standard
  with plain-language copy when the current viewport is outside the Detailed
  area. Print keeps its existing full-map coverage guard. Focused fixed-town
  and map-settings coverage passed 24/24, the exact Detailed-enabled production
  build passed with only the existing large-chunk advisory, and `git diff
  --check` passed. No Worker/API, R2, schema, auth, permission, ranking,
  filtering, visibility, saved-resource, PDF-ledger, Shared Map, Discover, or
  production-data behavior is changed.
  Release follow-up: implementation commit `1cd0e3fcd` was pushed to
  `codex/shared-map-settings-layout`; branch preview deployed at
  `https://3a359e9c.senior-resource-map.pages.dev`; and the same validated
  build was explicitly published to the production branch at
  `https://31a7e541.senior-resource-map.pages.dev`. The production custom
  domain serves `assets/index-CIEHs-Cl.js`,
  `assets/MyMapDetailPage-CNTXUkYK.js`, and `assets/index-gdJR9SuY.css`; the
  deployed owner-map chunk contains the viewport Detailed coverage correction
  and both W01 asset bases. Production API health returned OK at
  `2026-07-13T02:11:38.937Z`; public `/discover` and owner
  `/my-directory/maps/150` returned 200; and production smoke passed 5/5 using
  the shared smoke environment without printing credentials. No Worker/API or
  R2 deployment was performed.
- Owner Detailed tablet-load resilience follow-up: subsequent Android tablet
  UAT showed the same W01 viewport remaining on Standard at zoom 15/16 while
  mobile activated Detailed normally. Production reproduction at a 1280x800
  viewport loaded 20 fixed chunks and zero OneMap tiles at zoom 15, narrowing
  the device-specific failure to the one-shot manifest/chunk transport path.
  The recovery keeps all manifest integrity, W01 coverage, zoom, memory, and
  Standard fallback checks intact while retrying only transient manifest
  responses and individual failed chunk images with bounded delays. Permanent
  manifest 4xx responses and invalid manifests still fail closed, and chunks
  still fall back to Standard after their bounded retries are exhausted.
  Focused fixed-town and map-settings coverage passed 26/26, full client
  coverage and full server coverage (396/396) passed, the exact
  Detailed-enabled production build passed with only the existing large-chunk
  advisory, and `git diff --check` passed. No map camera, selection, pins,
  clustering, card focus, map colour, print state, Shared Map, Discover,
  Worker/API, R2, schema, auth, permission, ranking, filtering, visibility,
  saved-resource, or production-data behavior is changed.
  Release follow-up: implementation commit `f4778e592` was pushed to
  `codex/shared-map-settings-layout` and the validated client build was
  explicitly published to the production Pages branch at
  `https://6abe2592.senior-resource-map.pages.dev`. The production custom
  domain serves `assets/index-DdUQLiMS.js`,
  `assets/MyMapDetailPage-D8TIxT43.js`, and
  `assets/index-gdJR9SuY.css`; deployed bundle inspection confirmed the
  manifest retry path and bounded delay markers. Signed-in production browser
  UAT at 1280x800 confirmed zoom 14 retained nine Standard tiles, then zoom 15
  automatically switched to 20/20 loaded fixed chunks with zero live OneMap
  tiles. Production API health returned OK at
  `2026-07-13T02:44:14.037Z`, and production smoke passed 5/5. No Worker/API
  or R2 deployment was performed.

### 2026-07-15 map baseline recovery on current main

- Current behavior: production was observed on 2026-07-15 serving current main
  commit `a1544508b`, which preserved the newer security and AI cost-control
  work but omitted the validated map baseline from
  `codex/shared-map-settings-layout`. The visible result was that My Map owner
  pages lost the shared upper-right map settings surface, zoom-step indicator,
  desktop resize handle, owner print workspace, and resilient Detailed-map
  behavior. This was a release-source regression, not a W01 asset, API, Worker,
  R2, data, or browser-cache failure.
- Known-good reference: `codex/shared-map-settings-layout` at `eb84067a1`,
  especially implementation commit `f4778e592`, production deployment
  `https://6abe2592.senior-resource-map.pages.dev`, and production bundles
  `assets/index-DdUQLiMS.js`, `assets/MyMapDetailPage-D8TIxT43.js`, and
  `assets/index-gdJR9SuY.css`.
- Reproduction steps: open `https://app.carearound.sg/my-directory/maps/150`
  and compare the live UI with the locked July map baseline. Inspect the live
  app bundle/source deployment, confirm it comes from `a1544508b`, and compare
  git history against `codex/shared-map-settings-layout`.
- Acceptance criteria: recover the validated map baseline onto current main
  without reverting the newer security/AI work; keep the original dirty user
  checkout untouched; preserve client-only scope; rebuild production with
  `VITE_API_URL`, `VITE_TOWN_MAP_PROOF_ENABLED`, `VITE_TOWN_MAP_ASSET_BASE_URL`,
  and `VITE_TOWN_MAP_GRAY_ASSET_BASE_URL`; verify focused map behavior, full
  client tests, full server tests, R2 contract checks, exact enabled client
  build, and `git diff --check`; then verify production serves the recovered
  bundle and API health remains OK. No Worker/API deploy, schema, auth,
  permission, ranking, filtering, visibility, saved-resource, R2, or
  production-data change is required.
- Verification result: clean recovery worktree
  `/Users/sweetbuns/CareAroundSG-map-baseline-recovery` on
  `codex/map-baseline-recovery` was created from current main `a1544508b` and
  merged with `codex/shared-map-settings-layout` before editing. A targeted diff
  against main confirmed the newer AI/security files under
  `client/src/components/HardAssetImportWizard.jsx`, `server/`,
  `docs/ai-cost-control-stack.md`, and `server/wrangler.toml` were unchanged by
  the recovery. Focused map coverage passed 102/102, full client coverage
  passed 411/411, full server coverage passed 405/405 after refreshing local
  dependencies, the exact Detailed-enabled production build passed with only
  the existing large-chunk advisory, R2 contract checks passed 5/5, and
  `git diff --check` passed. Release follow-up: recovery merge commit
  `8cd242ea0` was pushed to `origin/codex/map-baseline-recovery`, and the same
  validated client build was explicitly published to the production Pages
  branch at `https://cb703fe6.senior-resource-map.pages.dev`. The production
  custom domain serves `assets/index-Ds9nT_2R.js`,
  `assets/MyMapDetailPage-Bt2dyQYF.js`, and
  `assets/index-gdJR9SuY.css`; API health returned OK at
  `2026-07-15T13:45:36.101Z`; public route checks returned 200; and production
  smoke passed 5/5. Fresh signed-in production Chrome UAT on owner map 150
  confirmed the recovered `Map appearance` settings with Map detail, Detailed,
  Map colour, Default, and Gray; zoom level 14 rendered Standard with nine
  visible live tiles; zooming to level 15 automatically rendered 20 fixed W01
  chunks with zero visible live tiles and zero new OneMap tile requests during
  Detailed. The map settings button, zoom counter, and desktop resize handle
  were visible. Console inspection found no CareAround application errors; the
  only error was the unrelated Chrome-extension content-script load failure
  previously seen during map checks. No Worker/API deploy, R2 mutation, schema,
  auth, permission, data, Discover ranking/filtering, visibility,
  saved-resource, or production-data behavior was changed.

### 2026-07-15 PWA hardening baseline

- Current behavior: CareAround SG keeps its existing installable web-app
  foundation and adds a narrow production service worker registration. The
  worker is served from `/pwa/carearound-sw` with
  `Service-Worker-Allowed: /`, precaches only static PWA shell assets, uses
  cache-first behavior only for same-origin static assets, excludes `/api`
  traffic entirely, and returns a static offline fallback only for failed
  navigation requests. The manifest now records a stable app ID/scope,
  language, display fallback preferences, categories, and Discover/My Directory
  shortcuts. Cloudflare Pages serves the service worker, manifest, and offline
  page with `Cache-Control: no-cache` so update checks do not get trapped behind
  stale metadata.
- Known-good reference: `codex/pwa-hardening` from current `origin/main`
  `347b05397` after preserving the pre-existing dirty handoff doc in a local
  stash. Existing app shell, auth/session recovery, route chunk recovery, map
  baseline, Discover, My Directory/My Maps, Shared Maps, Dashboard resources,
  Worker/API, R2 map assets, schema, permissions, ranking, filtering,
  visibility, saved resources, and production data remain unchanged.
- Reproduction steps: build the client, open `https://app.carearound.sg` or a
  Pages preview over HTTPS, confirm `/site.webmanifest` links the app metadata
  and `/pwa/carearound-sw` registers in production, inspect DevTools
  Application storage to confirm the worker scope is `/`, go offline, and
  navigate to a new app route to confirm `/offline` appears. While online, verify API
  requests such as `/api/auth/me` or `/api/health` remain network-owned and are
  not served from Cache Storage.
- Acceptance criteria: app installation metadata is present without changing
  route behavior; the service worker does not cache or replay API/auth/upload
  responses; failed navigations show only the static offline fallback; static
  asset caching does not change Discover ranking/filtering/visibility, map
  camera/pin behavior, saved resources, auth/session state, dashboard resource
  loading, Worker/API behavior, or production data; route chunk recovery still
  handles stale lazy-loaded bundles.
- Verification result: focused PWA contract coverage passed 5/5 with
  `node --test client/test/pwaHardening.test.js` on 2026-07-15. Full client
  coverage passed 416/416 with
  `node --test client/test/*.test.js client/src/lib/*.test.js`; full server
  coverage passed 405/405 with `npm run test:server`; the exact
  Detailed-enabled production client build passed with only the existing
  large-chunk advisory using `VITE_API_URL=https://api.carearound.sg/api`,
  `VITE_TOWN_MAP_PROOF_ENABLED=true`,
  `VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v1/w01`, and
  `VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v1/w01/gray`;
  built output included `pwa/carearound-sw`, `offline.html`,
  `site.webmanifest`, and `_headers`; and `git diff --check` passed.
  Production Pages deployment `https://5e4e0f2a.senior-resource-map.pages.dev`
  reached `https://app.carearound.sg` as `assets/index-BAhyRlx3.js`.
  `https://app.carearound.sg/pwa/carearound-sw` returned JavaScript with
  `Cache-Control: no-cache` and `Service-Worker-Allowed: /`;
  `/site.webmanifest` included the stable app ID, scope, language, categories,
  and shortcuts; `/offline` returned the static offline page with
  `Cache-Control: no-cache`; and `https://api.carearound.sg/api/health`
  returned OK at `2026-07-15T15:46:46.412Z`. Production smoke passed all 5
  checks, with the postal import wizard passing on retry and then passing a
  targeted rerun. No Worker/API, schema, auth, data, map asset, or secret
  changes were deployed.
- Main merge evidence: `codex/pwa-hardening` was fast-forwarded into `main`
  and pushed as `f11124a0f` on 2026-07-16. The automatic Cloudflare Pages
  build briefly served `assets/index-ofyBC_ES.js`, which retained the PWA
  worker path but omitted the required Detailed-map build markers. Production
  was immediately redeployed from the local production build with the required
  map environment variables to `https://b4a0b91f.senior-resource-map.pages.dev`;
  `https://app.carearound.sg` settled back on `assets/index-BAhyRlx3.js` with
  `VITE_TOWN_MAP_PROOF_ENABLED=true`, both W01 asset-base markers, and
  `/pwa/carearound-sw` returning JavaScript with `Cache-Control: no-cache` and
  `Service-Worker-Allowed: /`. API health returned OK through the
  Cloudflare-resolved production IPs. Before the next `main` push, configure
  the Cloudflare Pages production build environment with the required map
  variables or deploy the prebuilt client explicitly with those variables.

### 2026-07-16 Care Calendar V1 baseline

- Current behavior: authenticated users have a new Upcoming-first Care
  Calendar at `/dashboard/calendar`. Saved soft activities appear passively
  when an authorised editor has enabled a reviewed structured schedule. Users
  may mark one exact occurrence as Planned, but that state is explicitly a
  personal intention and not a booking. Private owner My Map notes expose an
  Add to calendar action only after the note has a persisted owner-scoped ID;
  the resulting personal item contains the note reference, a user-selected
  date/time, and a bounded title without exposing the note through Shared Map
  payloads.
- Known-good reference: `codex/care-calendar-v1` from `origin/main`
  `6a5cc6b36`, using additive `soft_assets` structured-schedule columns plus
  `user_calendar_items` and `user_calendar_schedule_states`. The calendar API
  reuses the saved-resource visibility and eligibility resolver before
  returning or planning a source occurrence, and rechecks My Map ownership
  before reading or scheduling a note. V1 is fixed to
  `Asia/Singapore`, supports one-time or weekly activity schedules, and does
  not send email, WhatsApp, SMS, or push notifications.
- Reproduction steps: as an authorised Offering editor, enable Show in Care
  Calendar, enter a Singapore start/end, choose one-time or weekly recurrence,
  and save. As a user, save that activity and open Care Calendar; confirm the
  source occurrence is shown as Saved activity. Plan one occurrence and
  confirm only that exact occurrence becomes Planned. Change, cancel, or
  remove the source schedule and confirm the user sees a review warning without
  the personal plan being silently moved or deleted. In an owner My Map, save
  a private note, choose Add to calendar, add a date/time, and confirm the item
  appears as Private map note. Open the Shared Map and confirm no calendar
  item, private note, or calendar metadata is exposed.
- Acceptance criteria: only currently saved and visible soft activities can
  supply occurrences or accept a planned-session write; a source start must
  exactly match a current generated occurrence; source schedule revisions are
  acknowledged per user; changed, cancelled, and removed schedules remain
  reviewable; My Map note lookup and creation are owner-scoped; personal items
  can be deleted only by their owner; recurring expansion is capped at 180
  days; Shared Map and saved-resource response shapes remain unchanged; no
  external delivery channel is activated; existing auth, eligibility,
  visibility, map, directory, and resource-editor behavior remains intact.
- Verification result: focused calendar/auth/schema/reset coverage passed
  14/14, including Singapore recurrence, revision, invalid schedule, logged-out
  route, boundary schema, and clean-slate checks. Full server coverage passed
  411/411 with `npm run test:server`; full client/source coverage passed
  417/417 with
  `node --test client/test/*.test.js client/src/lib/*.test.js`; and
  `npm run build:client` plus `git diff --check` passed with only the existing
  large-chunk advisory. Synthetic-data Playwright UAT at desktop and 390x844
  mobile widths confirmed the saved/planned/private-note labels, review
  warnings, schedule-removal notice, action hierarchy, sidebar/mobile
  navigation, and responsive layout. The intended Neon database fingerprint
  was checked without exposing credentials, and the explicit additive
  production boundary-schema bootstrap completed before Worker deployment.
  No production calendar rows or Offering schedules were seeded during the
  bootstrap or UAT.
- Release follow-up: implementation commit `46f5d3b33` was pushed to
  `origin/codex/care-calendar-v1`. Cloudflare Worker
  `senior-resource-map-api` deployed to `api.carearound.sg` as version
  `e50b14ed-b1dd-4838-b10b-2b32ec9574c1`; production API health returned OK
  at `2026-07-16T16:31:00.292Z`; logged-out `/api/calendar` returned the
  expected 401; and an authenticated read-only probe returned 200 with
  `timezone=Asia/Singapore`, zero occurrences, zero personal items, and 17
  saved activities without structured schedules for the smoke account.
  Cloudflare Pages deployed the feature preview at
  `https://1cd2c5ba.senior-resource-map.pages.dev` and explicitly published
  the same validated build to the production branch at
  `https://07fea6b2.senior-resource-map.pages.dev`. The custom domain served
  `assets/index-7RjEQA7D.js`, `assets/index-06iwuSyN.css`, and
  `assets/CareCalendarPage-CwW43iXx.js`; the main bundle retained the required
  Default and Gray W01 asset-base markers. Production smoke passed 5/5. The
  first smoke invocation had not exported the sourced credential variables
  and stopped the four authenticated checks before login; the corrected
  exported run passed all checks. No production schedule or personal calendar
  item was created, no Shared Map payload changed, and no email, WhatsApp,
  SMS, push, secret, map asset, ranking, filtering, or visibility behavior was
  changed.
- Main reconciliation: release documentation commit `37ae26c03` was
  fast-forwarded from `codex/care-calendar-v1` into `main` and pushed. The
  exact validated client output was then republished after the main push at
  `https://6b38360d.senior-resource-map.pages.dev`; the custom domain remained
  on `assets/index-7RjEQA7D.js`, `assets/index-06iwuSyN.css`, and
  `assets/CareCalendarPage-CwW43iXx.js` with both required W01 markers.
- 2026-07-17 production query-budget recovery: mobile UAT reported Calendar
  failing with Cloudflare's per-invocation subrequest limit and then showing a
  contradictory empty state. The cause was `getCalendar` reusing the general
  Saved Resources loader, which resolved every saved place and Offering with
  one live-asset lookup per row. Commit `5f24231bd` on
  `codex/care-calendar-query-budget` limits the Calendar read to saved
  Offerings and resolves all of their live summaries in one batched relational
  lookup while reusing the same visibility and eligibility logic. A regression
  test covering 75 saved activities proves one favorites-list lookup and one
  batched Offering lookup with zero per-Offering lookups. Unexpected 500 details are
  sanitized, and the client no longer shows the empty state when the initial
  Calendar load failed. No schema, auth, ownership, visibility, eligibility,
  Saved Resources, My Map, Shared Map, or notification contract changed.
  Focused Calendar/saved/error-state coverage passed 14/14; full server passed
  412/412; full client/source passed 418/418; the production-configured build
  retained both W01 markers; and `git diff --check` passed. Worker version
  `81ee694d-0999-49bf-a5e9-411aefbc1f4c` deployed to
  `api.carearound.sg`; authenticated Calendar read returned 200 with 17 saved
  Offerings without schedules and no error. Pages preview
  `https://14c8d1a0.senior-resource-map.pages.dev` was promoted as the exact
  production build at `https://dd45e3e3.senior-resource-map.pages.dev`;
  `app.carearound.sg` served `assets/index-BC2k0Shg.js`,
  `assets/index-06iwuSyN.css`, and
  `assets/CareCalendarPage-BGDGXMZj.js`. All five production smoke flows
  passed, with the existing partner-login retry used once after an initial
  route-load timeout. Signed-in 390x844 production browser UAT loaded the
  Calendar, its 17 saved-without-schedule activities, and the empty agenda
  without the reported error or any console error/warning. Rollback targets
  are Worker `e50b14ed-b1dd-4838-b10b-2b32ec9574c1` and Pages
  `https://6b38360d.senior-resource-map.pages.dev`.

### 2026-07-17 Care Calendar Day view

- Current behavior: Care Calendar opens in a focused Day view for the selected
  Singapore date. Previous day, next day, Today, previous week, next week, and
  exact-date controls update the same date cursor. Timed items appear on an
  hourly rail that expands for early and late events, while all-day items have
  a separate row. Saved activities, personal Planned state, private map notes,
  and changed, cancelled, or removed schedule warnings retain their existing
  labels and actions. The right rail shows a compact seven-day navigator and
  saved activities that do not yet have a reviewed schedule. Week and Month
  remain visible but disabled for later ledger-backed releases.
- Known-good reference: implementation commit `e820f3ec3` on branch
  `codex/care-calendar-day-view`, based on production `main` `4cf13938e`, and
  the user-selected Option 1 Day-view composition. The implementation is
  client-only and reuses the existing calendar API, event-action contract,
  dashboard shell, translations, and visibility behavior. It requests exactly
  one bounded Singapore day at a time and ignores stale responses when a user
  navigates quickly.
- Reproduction steps: sign in and open `/dashboard/calendar`; confirm Day is
  selected and Week and Month explain that they are coming later. Move between
  adjacent days, return with Today, move the compact navigator by seven days,
  and choose an exact date. Confirm events appear under their Singapore start
  hour, an empty date shows the normal guidance, and a 23:00 event without an
  end time does not overflow the timeline. Plan a saved session, remove a
  personal plan or private note, and acknowledge a source-schedule warning to
  confirm the existing actions remain available.
- Acceptance criteria: each calendar read is bounded to the selected
  `Asia/Singapore` day; date navigation remains correct across month and year
  boundaries; a slower previous response cannot replace the currently
  selected date; early, late, and all-day events remain visible; Planned stays
  a personal intention rather than a booking; private map notes remain
  owner-only and absent from Shared Maps; review warnings and action controls
  remain intact; Week and Month do not behave as live views; desktop and 390 px
  mobile layouts have no horizontal overflow. No Worker, schema, auth,
  ownership, visibility, eligibility, saved-resource, My Map, Shared Map,
  notification, or map-asset behavior changes.
- Verification result before deploy: focused Day-view, Calendar error-state,
  and translation coverage passed 8/8; full client/source coverage passed
  422/422; full server coverage passed 419/419; the production-configured
  client build and `git diff --check` passed with only the existing large-chunk
  advisory. Browser QA at 1440x1024 and 390x844 confirmed the selected Day-view
  composition, working date controls, the empty-date state, no horizontal
  overflow, and zero application console errors or warnings. The final
  side-by-side comparison is recorded in
  `docs/design-qa-care-calendar-planning-views-2026-07-17.md`. The unchanged live
  release also passed all five production smoke journeys immediately before
  deployment.
- Release follow-up: `e820f3ec3` was fast-forwarded into `main` and pushed.
  The exact validated client was published first at preview
  `https://5f024c97.senior-resource-map.pages.dev` and then to production at
  `https://09a5d6d7.senior-resource-map.pages.dev`. The custom domain served
  `assets/index-C_u0jrHz.js`, `assets/index-e3qfr4cu.css`, and
  `assets/CareCalendarPage-CGAL8-WR.js`, with the Detailed-map activation and
  both W01 asset-base markers intact. Production API health returned OK at
  `2026-07-17T03:07:23.532Z`, and all five post-deploy production smoke
  journeys passed. Signed-in read-only GudPerson browser UAT loaded the Day
  view and saved-without-schedule list, moved from July 17 to July 18, and
  returned with Today without an error state or data mutation. No Worker,
  schema, auth, data, saved-resource, My Map, Shared Map, notification, map
  asset, or secret change was deployed. The Worker remains version
  `97509c9d-5769-4447-b816-8ddf65de2faf`; the previous Pages rollback target is
  `https://0e64c513.senior-resource-map.pages.dev`.

### 2026-07-17 Saved Resources bounded-hydration recovery

- Current behavior: My Directory and every consumer of the global Saved
  Resources state load the user's newest-first mixed Place and Offering list
  with one favorites query plus at most one live Place batch and one live
  Offering batch. The response is reconstructed in saved order, keeps the
  existing response shape and visibility rules, and retains missing, hidden,
  deleted, or inaccessible rows as unavailable saved snapshots. Audience
  context failure uses empty fail-closed audience sets, and a failed Place or
  Offering batch falls back only that resource family instead of failing the
  whole list. Single-resource save/remove validation remains strict and
  unchanged. Care Calendar's soft-only saved-Offering read delegates to the
  same canonical batch hydrator without loading Places.
- Known-good reference: the 2026-07-17 GudPerson `/my-directory` report and
  production Worker tail showing `Too many subrequests by single Worker
  invocation`; the configured database's 43-row mixed saved list; the earlier
  snapshot guard in `7e05889fd`; and branch
  `codex/saved-resources-permanent-fix` based on production `main`
  `4d54f4760`.
- Reproduction steps: sign in as an account with 43 mixed saved resources and
  load `/my-directory`; confirm `/api/favorites` returns the full ordered list
  rather than a 500. Repeat from Discover Saved-only, Create Map, My Maps,
  resource detail, and Care Calendar because the global Saved Resources
  provider loads on those routes. Simulate audience-context failure, then
  Place-batch and Offering-batch failures independently, and confirm safe
  snapshot rows remain available to the client. Attempt a normal save and
  remove to confirm write validation is unchanged.
- Acceptance criteria: list hydration uses one favorites lookup and at most one
  lookup per non-empty resource family regardless of saved-list size; database
  result ordering cannot change favorite order; the current flat response
  fields and available/unavailable semantics remain intact; one family failure
  cannot blank successful rows from the other; reads fail closed when audience
  context is unavailable; toggle writes still reject unavailable resources;
  Calendar remains soft-only; no schema, auth, ownership, eligibility,
  Discover ranking/filtering, My Map ownership, Shared Map visibility, or
  notification behavior changes. Production Worker deploys must run from a
  clean `main` whose `HEAD` matches freshly fetched `origin/main`, preventing a
  stale feature branch from replacing the canonical release.
- Verification result before deploy: focused favorites and release-line tests
  passed 14/14; an 80-item alternating mixed-resource test proved one favorites
  lookup, one Place batch, one Offering batch, zero per-row lookups, and stable
  order even when batch results were reversed. Independent batch failures,
  audience-context failure, snapshot fallback, the 75-item Calendar soft-only
  budget, and unchanged save/remove/race behavior passed. Full server coverage
  passed 419/419; full client/source coverage passed 418/418; the
  production-configured client build and `git diff --check` passed. A read-only
  query through the real configured database hydrated its 43 saved rows in
  order with all 43 available. The deploy guard's valid-state unit test passed
  and a live feature-branch invocation was blocked as designed.
- Release follow-up: implementation commit `dcfce3ba3` was pushed on
  `codex/saved-resources-permanent-fix`, fast-forwarded into `main`, and pushed
  before deployment. The guarded production deploy verified clean `main`
  matched `origin/main`, then published Cloudflare Worker version
  `97509c9d-5769-4447-b816-8ddf65de2faf`. Production API health returned OK at
  `2026-07-17T00:50:53.690Z`; unauthenticated `/api/favorites` retained its 401
  contract. Signed-in GudPerson production UAT reloaded `/my-directory`,
  rendered all 43 saved-resource cards, and showed no load error. The live
  Worker tail recorded `/auth/me` and `/favorites` as successful with no
  subrequest/database exception. Production smoke passed 5/5 across public
  load, partner dashboard access, postal import, Create Map, and saved-resource
  detail. The automatic `main` Pages publish at
  `https://0e64c513.senior-resource-map.pages.dev` produced the exact existing
  client assets `assets/index-BC2k0Shg.js` and
  `assets/index-06iwuSyN.css`, with the Detailed-map flag and both W01 map-base
  markers intact; no client code changed. No schema change, data mutation,
  auth, ownership, eligibility, visibility, ranking, My Map, Shared Map,
  Calendar schedule, or notification change was made.

### 2026-07-17 Offering multi-session schedule source

- Current behavior: an Offering has one reviewed schedule plan containing up to
  250 individually identified rows. Each row is either an individual session
  or a weekly recurring series and carries its own start, optional end,
  active/cancelled status, optional note, and recurrence boundary. Authorised
  editors can add, duplicate, remove, and amend rows in the existing Schedule
  step. CareAround generates the public Schedule summary and Care Calendar
  occurrences from those same rows, so editors no longer maintain competing
  public text and Calendar-only dates.
- Known-good reference: branch `codex/offering-session-schedules`, based on
  `main` `83759dcc2`. Active schedule rows remain on `soft_assets` so Calendar
  and resource reads stay within the Cloudflare Worker subrequest budget.
  Immutable revisions are recorded separately in
  `offering_schedule_versions`, while legacy single-schedule columns remain
  populated from the first row for rollback and older-client compatibility.
  Personal calendar rows now retain the stable source schedule-entry key, so
  two same-time sessions remain distinct.
- Reproduction steps: create or edit an Offering and open Schedule. Enable
  Publish sessions, add an individual row and a weekly row, set each row's
  status, and confirm the read-only public summary changes with the rows. Save,
  reopen, and confirm the rows round-trip. Save the Offering as a user and open
  Care Calendar; confirm each active generated occurrence is present and two
  same-time rows can be planned independently. Cancel a row and confirm it
  cannot be newly planned. Import collateral or a Standalone Offerings
  workbook containing exact session dates; review and amend the generated rows
  before saving. Repeat with a blank or unparseable schedule and confirm the
  existing published schedule is not cleared. Use `clearSchedule=TRUE` in the
  workbook to verify the explicit clear path.
- Acceptance criteria: structured rows are the canonical schedule source;
  public copy is generated rather than separately edited; legacy schedule text
  remains visible as migration guidance until structured rows replace it;
  recurring expansion remains bounded and fixed to `Asia/Singapore`; invalid
  rows block save; cancelled rows cannot accept new plans; stable entry keys
  distinguish same-time sessions; every published mutation records an
  immutable revision; a reviewed import replaces the current published plan
  while prior revisions remain auditable; blank or unparsed imports preserve
  the existing plan; prior personal plans are never silently moved or deleted
  and continue to use the existing Needs review warning. Saved Resources,
  visibility, eligibility, My Maps, Shared Maps, booking, availability, and
  external notification behavior remain unchanged.
- Verification result before deploy: focused schedule, workbook, collateral,
  Calendar, Offering-wizard, boundary-schema, and clean-slate coverage passed.
  Full server coverage passed 433/433; full client/source coverage passed
  426/426; the exact production-configured client build passed with only the
  existing large-chunk advisory; and `git diff --check` passed. The configured
  database fingerprint matched the intended target, the explicit additive
  boundary-schema bootstrap completed, and direct schema verification found
  the new schedule-plan columns, immutable version table and indexes, and
  personal source-entry key. Existing production smoke passed 5/5 before
  deployment. Authenticated local browser UAT passed the new Offering Schedule
  flow by opening the editor, enabling publication, adding a second row, and
  cancelling without saving. No production Offering, schedule, favorite, or
  personal Calendar row was created or changed during validation.
- Release follow-up: implementation commit `7c411b0f1` was pushed on
  `codex/offering-session-schedules`, fast-forwarded into `main`, and pushed
  before deployment. The explicit additive production boundary-schema
  bootstrap had completed before the guarded Worker release. Cloudflare Worker
  `senior-resource-map-api` deployed version
  `00b9a7df-88fe-41dc-bb5f-f4c49bd5e12a`; API health returned OK at
  `2026-07-17T09:54:01.724Z`. The exact production map-enabled client deployed
  to `https://8a4712f2.senior-resource-map.pages.dev`; the custom domain served
  `assets/index-CR0N52gf.js`, `assets/index-CpUykGFC.css`,
  `assets/CareCalendarPage-D6oNeApo.js`, and
  `assets/ResourcesPage-EU_q_WVj.js`. The main bundle retained the PWA worker
  path and both required W01 asset-base markers, and the service worker retained
  its no-cache and root-scope headers. Post-deploy production smoke passed all
  6 journeys, including the non-saving Offering multi-session editor check and
  the existing saved-resource detail journey. No production Offering,
  schedule, favorite, personal Calendar item, secret, or map asset was changed
  by release verification.

### 2026-07-17 Offering schedule publish guard and persistence recovery

- Current behavior: ordinary Offering saves cannot silently remove or overwrite
  a reviewed schedule. Existing editors carry the loaded schedule revision into
  each changed schedule save; the Worker rejects stale revisions and applies a
  revision compare-and-swap at the database write. Removing published sessions
  requires the shared `Unpublish sessions?` confirmation and an explicit
  unpublish action. Deprecated one-row schedule writes cannot overwrite a
  reviewed multi-session plan. Weekly rows must start on a selected repeat
  weekday, the last repeat date is inclusive in Singapore time, and the editor
  previews the next five generated Care Calendar sessions before save. The
  Publish sessions toggle thumb is positioned within its own track at both on
  and off states.
- Known-good reference: branch `codex/offering-schedule-publish-guard`, based on
  deployed multi-session baseline `fae90cdca`; the 2026-07-17 Line Dance report
  showed revision 1 published successfully and revision 2 silently replaced it
  with an empty plan three minutes later. The recovery preserves immutable
  version history and corrects the weekly series start to its first selected
  weekday before republishing.
- Reproduction steps: open an Offering with published sessions in two editor
  tabs. Change and save the first tab, then try to change the schedule from the
  stale tab; the stale save must be rejected without overwriting the new plan.
  Toggle Publish sessions off, cancel the warning, and confirm the sessions
  remain enabled; repeat and explicitly unpublish to test the destructive path.
  Create a Monday/Wednesday weekly row with a Saturday series start and confirm
  save is blocked; correct the start to Monday and confirm the generated preview
  begins Monday, includes Wednesday, and includes sessions on the selected last
  repeat date. Save, reopen, and load Care Calendar for an account that saved the
  Offering.
- Acceptance criteria: no normal or stale Offering save can clear a published
  plan without explicit confirmation and a matching revision; concurrent
  schedule writes cannot silently use last-write-wins; canonical rows still
  generate both public copy and Calendar occurrences; valid publish, explicit
  unpublish, imports, immutable versions, personal Needs review state, saved
  resources, visibility, eligibility, My Maps, Shared Maps, booking,
  availability, and external notification behavior remain unchanged.
- Verification result before deploy: focused schedule, persistence-contract,
  controller-wiring, Offering-wizard, and confirmation coverage passed 26/26;
  full server coverage passed 437/437; full client/source coverage passed
  427/427; the exact production-configured client build passed with only the
  existing large-chunk advisory; and `git diff --check` passed. The persistence
  contract publishes a revision, reopens it through the production serializer,
  and expands the expected Monday and Wednesday Care Calendar occurrences.
- Release follow-up: implementation commit `484c14d2d` is pushed on `main` and
  `codex/offering-schedule-publish-guard`. Production Worker
  `29f0d835-155b-4f70-a042-d1f960807f2e` and validated Pages deployment
  `https://c48142e0.senior-resource-map.pages.dev` are live. The custom domain
  serves `assets/index-B_m_21ZM.js`,
  `assets/ResourcesPage-Dl9Gvzsp.js`,
  `assets/CareCalendarPage-B9h-FsjV.js`, and both required W01 markers. Line
  Dance `soft_assets.id=168` was restored through the guarded API as revision
  3: Monday/Wednesday, 10:00-11:30 Singapore time, from Monday 20 July through
  the inclusive Wednesday 30 September 2026 boundary. Signed-in GudPerson
  production UAT reopened Care Calendar on Monday 20 July and showed the saved
  Line Dance occurrence at 10:00-11:30 with Needs review. The live editor
  showed the next five generated sessions, the corrected last-repeat field,
  and a centred Publish sessions thumb; its rendered 80%-zoom geometry was
  35.2 x 19.2 px with a 16 px thumb and approximately 1.6 px vertical/right
  insets, matching the intended 44 x 24 px track, 20 px thumb, and 2 px insets.
  Cancelling the Unpublish sessions warning left publication enabled and the
  preview intact. Post-deploy production smoke passed 6/6. No personal plan,
  favorite, external notification, Shared Map, My Map, booking, availability,
  or unrelated Offering was changed during release verification.

### 2026-07-18 Care Calendar planning views and Updates structure

- Current behavior: Care Calendar separates three user jobs. My Plans is the
  default section and shows only starred upcoming sessions plus private My Map
  calendar notes, with expired or acknowledged old plans kept in a collapsed
  30-day recent history instead of being deleted. Calendar shows saved activity
  schedules and private items in live Day, Week, and Month views. Updates
  groups changed, cancelled, or removed starred sessions by Offering until the
  user acknowledges the source revision. Adding a session to My Plans remains a
  private star/bookmark-style intention, not a booking, registration, capacity
  hold, or organiser notification.
- Known-good reference: branch `codex/care-calendar-planning-views`, based on
  pushed production `main` `3c190ce3f`, and rollout contract
  `docs/care-calendar-planning-views-rollout-plan.md`. The implementation
  reuses the existing personal calendar tables, saved-resource visibility
  rules, My Map note ownership checks, Offering schedule revisions, shared
  confirmation dialog, dashboard shell, and translation foundation. It adds an
  optional authenticated Calendar read `scope=plans` so broad My Plans and
  Updates ranges expand occurrences only for Offerings referenced by personal
  planned items.
- Reproduction steps: sign in and open `/dashboard/calendar`; confirm My Plans,
  Calendar, and Updates tabs are available. In Calendar, switch Day, Week, and
  Month, move the selected Singapore date, and open a dense Month date into
  Day. Star an active saved session, then confirm it appears once in My Plans
  and the source event changes to the planned state. Remove the plan and
  confirm the source schedule remains available. Add a private My Map note to a
  date and confirm Shared Maps do not receive the private note. Change or
  cancel a starred Offering schedule in a controlled test resource, then open
  Updates and confirm the old plan remains labelled until acknowledgement.
  Acknowledge the update and confirm no replacement is automatically starred.
- Acceptance criteria: saved-but-unstarred activities are visible calendar
  options, not personal conflicts; My Plans contains only starred sessions and
  private notes; source occurrences and matching personal plans do not render
  as duplicate My Plans rows; review acknowledgement clears the notice only and
  never moves, deletes, or restars the user's plan; replacement options require
  an explicit user star; conflict guidance compares only current personal
  plans and private notes; cancelled sessions cannot be newly planned; the
  planning read stays within the 180-day Calendar cap and uses bounded
  `scope=plans`; desktop and 390 px mobile layouts do not overflow. No schema,
  auth, Saved Resources payload, Discover ranking/filtering, Offering schedule
  publication, My Map ownership, Shared Map visibility, booking, availability,
  external notification, map asset, or secret behavior changes.
- Verification result before deploy: focused calendar day/planning/error and
  translation coverage passed 12/12; focused server calendar scope,
  multi-session source, and auth coverage passed 4/4; full server coverage
  passed 439/439; full client/source coverage passed 431/431; the exact
  production-configured client build passed with `VITE_API_URL`, Detailed-map
  activation, and both W01 asset bases; and `git diff --check` passed. The
  build produced candidate `assets/CareCalendarPage-OooRjuuN.js` and retained
  the existing large-chunk advisory only.
- Release follow-up: implementation commit `c7679051f` is pushed on `main` and
  `codex/care-calendar-planning-views`. Production Worker
  `bc786c9d-6842-4996-8e12-940d074b58ab` and validated Pages deployment
  `https://b7688e7b.senior-resource-map.pages.dev` are live. The custom domain
  serves `assets/index-BIVnrRr4.js`,
  `assets/CareCalendarPage-OooRjuuN.js`,
  `assets/ResourcesPage-2YERLYnQ.js`, `assets/index-BdQkhKX7.css`, and both
  required W01 map asset-base markers. Signed-in production QA confirmed the
  new My Plans, Calendar, and Updates sections, live Day/Week/Month switching,
  production mobile layout at 390 x 844 without horizontal overflow, and the
  Updates up-to-date empty state. Production smoke passed 6/6. No schema,
  saved-resource payload, Offering schedule publication, personal-plan
  migration, My Map ownership, Shared Map visibility, booking, availability,
  external notification, map asset, secret, or unrelated production data was
  changed during release verification.

### 2026-07-18 Islandwide Detailed fixed-surface coverage

- Current behavior: the owner My Map `Standard | Detailed` feature can use a
  version-rooted islandwide fixed-surface index instead of the original W01-only
  manifest. Default and Gray each expose 32 accepted fixed cartographic
  surfaces under the same runtime contract: Leaflet remains the interaction
  model, Detailed activates at zoom 15, only the selected area's visible chunks
  are loaded, off-screen chunks are pruned, and pins, clusters, card focus,
  reset, print/export controls, attribution, map colour preference, and mobile
  map/list behavior continue to use the existing DirectoryMap path.
- Known-good reference: branch `codex/islandwide-detailed-map` in worktree
  `/Users/sweetbuns/CareAroundSG-islandwide-detailed-map`, based on
  `2430c13e00909e13d13fa1426776fe61e196e8f8`. Generated local assets are kept
  outside the client bundle at `output/town-map-proof/assets/v1/islandwide/`.
  The Default index has 32 surfaces, 9,127 chunks, 1,158,852,117 chunk bytes,
  version `sg-islandwide-default-6905b50f6118a0d1`, and surface-set SHA-256
  `6905b50f6118a0d1e3626b8ba3cbda81e424e5255e8ddb2186647529b9deba6d`.
  The Gray index has 32 surfaces, 2,741 chunks, 1,034,027,208 chunk bytes,
  version `sg-islandwide-gray-e359a21a265ae825`, and surface-set SHA-256
  `e359a21a265ae825e22c20ed3d29ea0ad6d098d74c50ffe4fd351127012feb66`.
- Reproduction steps: start the local islandwide asset server at
  `http://127.0.0.1:4174/v1/islandwide` and the client with
  `VITE_TOWN_MAP_PROOF_ENABLED=true`,
  `VITE_TOWN_MAP_ASSET_BASE_URL=http://127.0.0.1:4174/v1/islandwide`, and
  `VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=http://127.0.0.1:4174/v1/islandwide/gray`.
  Open an owner My Map containing resources in different island areas, set Gray,
  focus a CCK/Yew Tee resource, then focus an eastern resource such as Bedok.
  Repeat at desktop and mobile widths.
- Acceptance criteria: Standard remains the low-zoom live OneMap default;
  Detailed chooses the correct islandwide surface for the current viewport or
  focused resource; switching between areas does not leave a blank Detailed map;
  no live OneMap tile requests are made after Detailed focus; only visible
  fixed chunks are in the DOM; OneMap and Singapore Land Authority attribution
  remain visible; card-to-pin alignment, selected card state, mobile map entry,
  map settings, zoom counter, print-map state, and resize controls remain
  stable; R2 upload plans publish chunks before per-surface manifests and the
  islandwide index.
- Verification result before deploy: desktop and mobile Playwright fixture
  smoke passed with CCK/Yew Tee and Bedok focus transitions, one visible fixed
  chunk after each Detailed focus, zero OneMap tile requests after both Detailed
  focus actions, zero failed requests, zero console entries, and zero page
  errors. Screenshots and report are under
  `output/town-map-proof/islandwide-uat/`. Focused map coverage passed 48/48;
  broader locked map/list coverage passed 114/114; R2 contract coverage passed
  6/6. R2 dry-runs validated the Default plan at prefix `v1/islandwide` with
  index SHA-256 `d9964919a620e21d7c1ac2b4ca21100fbfb72fdc67d2ddc6259c121fa4aec025`
  and the Gray plan at prefix `v1/islandwide/gray` with index SHA-256
  `ab8449946054b2806573915b3a2121ffc86dc87292f23eb64a5e14e6533a9648`.
  `npm run test:server` passed 449/449, and the production-configured client
  build passed with `VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v1/islandwide`
  and `VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v1/islandwide/gray`.
  Production release result: implementation branch `codex/islandwide-detailed-map`
  was merged into `main` and pushed as `5c22bc0d2`. Default R2 upload published
  32 surfaces and 9,127 chunks under `https://maps.carearound.sg/v1/islandwide`
  with index SHA-256
  `d9964919a620e21d7c1ac2b4ca21100fbfb72fdc67d2ddc6259c121fa4aec025`; Gray R2
  upload published 32 surfaces and 2,741 chunks under
  `https://maps.carearound.sg/v1/islandwide/gray` with index SHA-256
  `ab8449946054b2806573915b3a2121ffc86dc87292f23eb64a5e14e6533a9648`. Both
  public R2 verifiers passed sampled checks with `https://app.carearound.sg`
  CORS. The production-configured client build produced
  `assets/index-Vh7cG0dR.js`, `assets/MyMapDetailPage-BaiXyyne.js`, and
  `assets/index-CvQOOpB_.css`; the custom domain bundle contains both
  islandwide roots and no W01 root marker. The validated Pages production
  branch deployment is `https://a5028644.senior-resource-map.pages.dev`. A
  post-release docs push briefly proved the prior Pages Git-build environment
  was still stale, so the same islandwide `client/dist` was republished to the
  `main` Pages branch and the Cloudflare Pages production build variables were
  updated as project secrets for the four required `VITE_*` values. API
  health returned OK at `2026-07-19T02:12:15.343Z`, and production smoke passed
  6/6 on 2026-07-19. A non-mutating production browser probe with mocked owner
  map data but real deployed JS/CSS and real R2 assets loaded islandwide fixed
  chunks, kept four pins rendered, and made zero live OneMap tile requests
  after Detailed was active; the only OneMap network item was the known logo SVG
  block. Probe screenshot:
  `output/town-map-proof/islandwide-uat/production-mock-islandwide-owner.png`.
  No production data, Worker/API, schema, auth, Discover, Shared Map, or
  visibility behavior was changed by this proof.
- 2026-07-19 blank/partial surface recovery: production owner My Maps showed
  either an all-gray Detailed surface with pins or a partially detailed,
  partially gray frame when a selected/focused fixed surface did not safely
  cover the visible map viewport. The fixed-surface layer now removes its
  backdrop and attribution whenever it falls back, viewport eligibility now
  requires the active fixed surface to contain the visible frame as well as at
  least one intersecting chunk, and the surface selector prefers a surface that
  fully covers the viewport before falling back to narrower overlaps. The
  focused recovery checks passed with `node --test
  client/test/fixedTownSurface.test.js
  client/test/fixedTownSurfaceIntegration.test.js` 27/27; full client tests
  passed 438/438; `npm run test:server` passed 451/451; and the
  production-configured client build passed with the islandwide Default and
  Gray asset roots and no W01 root marker. The blast radius is limited to owner
  My Map fixed-surface rendering and DirectoryMap's Detailed fallback gate; no
  production data, Worker/API, schema, auth, Discover, Shared Map, resource
  visibility, ranking, filtering, or saved-resource behavior is changed.
- 2026-07-21 Print Map badge numeral visibility: owner Print Map marker badges
  keep the approved 25.5 px category-coloured circles, fixed geographic
  coordinates, collision offsets, card linking, and print/export composition,
  while increasing only the numeral sizes to 11.5 px for one digit, 10 px for
  two digits, and 8.5 px for longer labels. Reproduce on an owner
  `?view=print` map with at least 19 mapped resources and compare one- and
  two-digit pins at normal and reduced global text size. Acceptance requires
  the numerals to fill the existing badge more clearly without enlarging the
  marker footprint, moving pins, changing category colours, or affecting
  interactive My Map, Shared Map, Discover, fixed-surface selection, camera,
  clustering, or resource data. Focused Print Map/map-list coverage passed
  59/59; server coverage passed 451/451; the production-configured islandwide
  client build passed; and the intended source diff passed `git diff --check`
  before deployment. The full client suite passed 441/442; its only failure was
  the date-sensitive Care Calendar planning-conflict assertion, which also
  failed unchanged on the untouched `main` baseline and is outside this map-only
  blast radius.
- 2026-07-21 JEM coordinate correction: production Place `place-jem` (hard
  asset `33590`, postal code `608549`) was updated through the guarded Places
  workbook importer to the official OneMap position `1.33329334473462`,
  `103.743278742341` and address `50 Jurong Gateway Road, Singapore 608549`.
  The import report confirmed exactly 1 total, 0 created, 1 updated, 0 skipped,
  0 warnings, and 0 errors. The public hard-asset API then returned rounded
  persisted coordinates `1.3332933`, `103.7432787`, the same stable external
  key, and the corrected address. No other Place or resource record was
  modified by the workbook.
- 2026-07-21 Print Map numeral/JEM production follow-up: commit `ee40be51c`
  was fast-forwarded to `main`, pushed, and explicitly published from the
  production-configured islandwide `client/dist` to Cloudflare Pages at
  `https://cae4f497.senior-resource-map.pages.dev`. The custom domain served
  `assets/index-D0bkSGQg.js`, `assets/MyMapDetailPage-CO1bYjNy.js`, and shared
  map chunk `assets/useDirectoryDistanceAnchor-M5NkyD9o.js`; bundle inspection
  confirmed the Default and Gray `https://maps.carearound.sg/v1/islandwide`
  roots, no `/v1/w01` root, and the deployed 8.5/10/11.5 px numeral sizing.
  Production API health returned OK. Signed-in browser smoke on owner Print Map
  `258` rendered all 19 numbered cards and pins with no console warnings or
  errors; JEM card 17 showed `50 Jurong Gateway Road`, and its Leaflet marker at
  `translate3d(409px, 333px, 0px)` sat beside Westgate marker 18 at
  `translate3d(403px, 319px, 0px)`, consistent with the corrected OneMap
  position rather than the former eastern pin location.
- 2026-07-21 Print Map QR recovery: owner Print Map now renders a QR code
  whenever a usable interactive map URL exists. Public shared URLs remain the
  first choice; if a private owner map has no shared link yet, the QR falls back
  to the owner's interactive `/my-directory/maps/:id` URL with `view=print`
  removed. This restores the locked Print Map acceptance condition that the QR
  is present without changing map layout, badge coordinates, Detailed map
  activation, saved-image composition, sharing permissions, or public Shared Map
  behavior. Focused Print Map/map-list coverage passed 54/54; the
  production-configured islandwide client build passed; and the intended source
  diff passed `git diff --check` before deployment.
- 2026-07-21 production client-shell blank recovery: the custom domain and
  latest Pages deployment returned valid HTML, CSS, and
  `assets/index-oS2P0vLJ.js` with HTTP 200 while an existing Chrome session
  retained an empty React root. API health remained OK, the same bundle rendered
  from local preview, and a fresh Chromium production smoke rendered the latest
  Pages deployment; the immediately previous `assets/index-D0bkSGQg.js`
  deployment also rendered in the affected Chrome profile. This isolated the
  incident to a browser-scoped entry-module delivery/cache failure rather than
  an API, auth, data, or React-source outage. The recovery build forces a fresh
  hashed entry and loads a separate versioned
  `/app-shell-recovery-20260721-1.js` watchdog. The versioned path prevents the
  custom domain's four-hour static cache rule from pinning future watchdog
  revisions even though the Pages `_headers` contract also requests no-cache.
  If the root is still empty after six seconds, users see a plain-language
  recovery panel whose explicit action retries only the same-origin hashed entry
  with a cache-busting query. Reproduce by blocking the first hashed entry
  request while allowing the watchdog, or by loading a browser profile with a
  failed cached entry. Acceptance requires normal loads to remain unchanged,
  blank roots to become actionable instead of staying white, retries to remain
  same-origin and client-only, and no auth, API, service-worker, map, visibility,
  ranking, saved-resource, or production-data behavior to change. Focused shell,
  PWA, and locked Print Map coverage passed 17/17; full server coverage passed
  451/451; the exact islandwide production build passed and emitted candidate
  `assets/index-4119_yDJ.js`; and local public-route smoke passed. Full client
  coverage passed 443/444, with only the unchanged date-sensitive Care Calendar
  planning-conflict assertion failing outside this shell-only blast radius.
- Release follow-up: implementation commit `223e1da9e` and versioned-watchdog
  follow-up `22476dafa` are pushed on `main`. The exact validated client build
  was checked first at `https://0ab33d1a.senior-resource-map.pages.dev` and then
  explicitly published to the production Pages branch at
  `https://0897fdc2.senior-resource-map.pages.dev`. The custom domain serves
  `assets/index-4119_yDJ.js`, shell marker `2026-07-21.1`, the versioned
  watchdog, both islandwide map roots, and no W01 asset root. The original
  affected production Chrome tab rendered signed-in Discover after reload with
  no application-origin console warning or error; extension-origin errors were
  ignored. API health remained OK. Preview smoke passed 6/6. Production smoke
  passed all six flows with one initial partner-dashboard timeout recovered by
  the configured retry, and the partner-dashboard target then passed 1/1 on a
  clean rerun. No Worker/API, schema, auth, service-worker, map asset,
  visibility, saved-resource, or production-data change was deployed.
- 2026-07-28 dashboard route chunk cache recovery: production `/dashboard` and
  authenticated dashboard children showed the route-level `Please refresh this
  page` fallback after a 200 HTML fallback response was cached for a lazy
  `/assets/*.js` route chunk. The dashboard shell carries an invisible
  `data-route-cache-version="2026-07-28.2"` marker to rotate the affected route
  chunk URL, and the PWA service worker moved to `carearound-pwa:v2:static` with
  a guard that refuses to reuse or store `text/html` responses for `/assets/`.
  Acceptance requires `/dashboard`, `/dashboard/resources`, and
  `/dashboard/admin` to load route chunks as JavaScript on the custom domain,
  with no auth, API, visibility, import, search, map, or production-data
  behavior changed. Verification: focused PWA coverage passed 8/8,
  production-configured client build passed, `https://app.carearound.sg`
  served service worker `v2`, entry `assets/index-DGsR0f4j.js`, dashboard
  chunk `assets/DashboardPage-Ciu8jEnC.js`, resources chunk
  `assets/ResourcesPage-B1fvyNgy.js`, and admin chunk
  `assets/AdminPage-BG95sj08.js` as JavaScript. Signed-in Chrome UAT loaded
  `/dashboard`, `/dashboard/resources`, and `/dashboard/admin`; Resources search
  `rn/rc` returned results and Admin hydrated its resources table.

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

## Security Dependency Follow-Ups

Last reviewed: 2026-05-04.

- `hono`, `@hono/node-server`, and transitive YAML/minimatch-style advisories were updated with non-breaking audit fixes.
- `xlsx` high-severity advisories were removed from `npm audit` by replacing the vulnerable package with the SheetJS-compatible `@e965/xlsx@0.20.3` package and adding workbook import containment: `.xlsx`/`.csv` extension allowlist, 10 MB file cap, 5,000 data-row cap, 80-column cap, scalar cell validation, and bounded cell length checks. Verification: `npm run test:server` passed 117/117 and `npm run build:client` passed on 2026-05-04.
- KIV: `drizzle-orm` still reports a high-severity advisory. Current code scan did not find the advisory's riskiest dynamic identifier patterns, but the package remains officially vulnerable. Do not bundle this into routine feature work. Surface it explicitly with the product owner before starting, then handle it as a dedicated database-query migration with full server regression coverage, workbook/import checks, auth/session checks, discovery/resource checks, translation checks, partner-only checks, and My Maps checks.
- `drizzle-kit` still reports moderate dev-tool advisories through `esbuild`/`@esbuild-kit`; the available npm audit fix is also a breaking major upgrade and should be handled with the Drizzle migration.
- Production session signing now requires a real `JWT_SECRET`; local development keeps the fallback only outside production.
