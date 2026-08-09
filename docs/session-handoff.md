# CareAround SG Fresh-Chat Handoff

Last updated: 2026-08-09 (Asia/Singapore)

## Map Studio integrated release candidate (2026-08-09)

- `codex/map-studio-state-model` now contains the complete additive goal through
  Explore, Design, and Studio Export. All version 1 design paths are wired to
  existing map/card/layout seams; several private named views use explicit
  save and optimistic document revisions; temporary exploration and export-only
  settings remain outside persistence.
- Studio Export reuses `?view=print` and the dedicated hidden-capture pipeline.
  Direct reload resolves the saved named view before enabling export. The
  ordinary Print View remains available and unchanged by default. Shared Map
  and embed do not import, request, or publish Studio state.
- The additive `my_map_studio_documents` schema has been applied and verified
  against the configured CareAround database with no backfill, existing-row
  rewrite, or destructive operation. Compatible Worker and Pages deployments
  are still pending.
- Final local gates pass: client 616/616, server 539/539, map lockdown 84/84,
  ordinary and exact six-root production builds, and diff check. Signed-in
  disposable-map UAT passed two named views, explicit persistence,
  desktop/mobile Design, category filtering, Studio Export direct reload,
  390 px no-overflow, and the mobile focus resource card. Production smoke is
  6/6.
- Release sequence: audit and commit only intended Map Studio files; push the
  feature branch; release the compatible Worker; publish the exact validated
  client artifact to a Pages preview and verify it; promote that artifact to
  production; then repeat authenticated disposable-map UAT plus Shared/embed,
  ordinary Print, Detailed, auth, and artifact-parity checks. Stop on any failed
  gate or material privacy/regression issue.
- Explicit exclusions remain: no Studio view data in frozen Shared/embed
  snapshots, no Print View retirement, no destructive database work, no
  secrets/auth changes, and no route consolidation.

## Map Studio phase 1 architecture and state model (2026-08-09, local candidate)

- Work is isolated on `codex/map-studio-state-model` from base
  `fe91f9667355239ca16cf314277659e51e78db9c`. It adds a pure versioned model,
  focused tests, and `docs/map-studio-architecture.md`. Phase 2 now imports its
  commands only through the owner helper/panel; Phase 3 feeds only the sanitized
  active draft into owner interactive maps. No design is fed into the export
  renderer.
- The model separates explicit-save named-view design from temporary
  exploration and export-only settings. It supports create, rename, duplicate,
  select, save/update, set-default, and delete; rejects stale saves; and
  requires explicit discard before switching away from a dirty draft.
- Existing My Map resources, category order, notes, private annotation
  geometry, personal places, frozen Shared Map/embed snapshots, auth,
  `DirectoryMap`, and the dedicated Print View/export renderer are unchanged.
- Verification passes: focused 10/10, full client/source 600/600, ordinary
  client build, map lockdown 84/84, exact six-root build, and diff check.
- Phase 2 now adds the approved local owner persistence/API and named-view UI
  slices described below. Route consolidation, shared/embed view data, database
  application, and deployment remain outside the current candidate.

## Map Studio phase 2 owner schema/API and UI (2026-08-09, local candidate)

- Current Neon HTTP patterns favour one atomic
  `my_map_studio_documents` row per My Map over separate view rows. The JSON
  document owns the validated view collection/default ID while optimistic
  revision remains a database column, allowing one compare-and-swap save.
- `server/src/utils/mapStudioDocument.js` is now wired only to a new owner
  controller and the private My Map duplication path. It accepts the Phase 1
  document and strictly excludes exploration, export settings, annotation
  geometry, unknown fields/versions, invalid view identity, invalid cameras,
  unbounded layer references, oversized revisions, and documents above 512
  KiB. Stored-data corruption fails closed.
- Authenticated non-guest owners have GET/PUT under `/my-maps/:id/studio`. An
  absent row returns `document: null` so the client can build its legacy default
  in memory. The first explicit save atomically inserts revision one; later
  saves compare-and-swap the expected revision and return 409 on conflict
  without a read-before-write race.
- Private Studio saves must not update `my_maps.updated_at` or change frozen
  share/embed staleness. My Map duplication validates and copies a persisted
  document privately at revision one; deletion cascades. Guest, Shared Map,
  embed, existing owner detail, annotations, and personal-place paths do not
  load Studio state.
- `my_map_studio_documents`, `ensureMapStudioSchema`, its verifier, and the
  narrow `bootstrap:map-studio-schema` command are implemented. No configured
  database was mutated and no production backfill is planned. The table must be
  applied and verified before any compatible Worker deployment.
- The owner My Map route now has an isolated multilingual named-view panel in
  both the V2 and classic layouts. It supports create, rename, duplicate,
  select, set-default, delete, explicit Save/Discard, dirty unload/view-switch
  protection, and non-destructive 409 recovery. A Studio load failure is local
  to the panel. Print View, Shared Map, and embed do not render or call it.
- The client editor keeps the persisted server revision, working named-view
  document, and temporary design session separate. Phase 3 applies the selected
  draft only to private owner `DirectoryMap` instances; Print View remains
  separate. Current bubble defaults, Detailed surfaces, focus cards, notes,
  annotations, personal places, and exports remain on their locked components.
- Focused owner UI/state/API coverage passes 52/52, full server 539/539, full
  client/source 611/611, ordinary build, map lockdown 84/84, exact six-root
  build, and diff checks. Nothing is committed, pushed, or deployed. Production
  schema application, compatible Worker/client rollout, Phase 3 renderer
  adapters, and Shared Map/embed publication remain separately gated.

## Map Studio phase 3 Explore/Design runtime (2026-08-09, local candidate)

- `client/src/lib/mapStudioInteractiveAdapter.js` remains a pure translation
  from saved/draft design to existing interactive seams. The owner page now
  consumes it only after the current map's private Studio load succeeds and
  applies it to V2 and classic desktop/mobile map shells.
- Scoped map colour, detail mode, fixed/fit camera, category-bubble/numbered pin
  style, annotation visibility, and the semantic map-height token are
  adapter-ready. The default emits no cluster, pin-badge, or category-icon
  override, preserving the current V2 bubble behavior.
- Interactive pin size, label detail, resource/category filtering, and
  resource-panel placement are explicitly deferred. They must not appear as
  working controls until pins and every desktop/mobile card or sticky/focus
  layout update together.
- `MapStudioViewsPanel` remains the canonical session/document owner. Its
  guarded runtime snapshot and narrow controller coordinate explicit modes,
  Design-only draft patches, and temporary exploration without exposing either
  full document to renderers. Save retains the latest temporary camera even if
  the map moves while the compare-and-swap request is in flight.
- `MapStudioDesignControls.jsx` mounts inside the private panel. Map-settings
  colour and Standard/Detailed actions use the same draft and automatically
  enter Design. Scoped colour also chooses the matching live and Detailed asset
  roots/manifests. The existing annotation overlay is filtered without changing
  annotation persistence. Fit/fixed camera and semantic height work through the
  existing controller, class, and resizable-frame seams.
- Explore search, hover, focus, selection, and camera movement stay outside the
  PUT. A panel load failure supplies no runtime model and leaves the old map
  behavior usable. V2 category-bubble defaults, cluster props, mobile complete
  focus cards, notes, personal places, actions, auth, Print View, Shared Map,
  and embed are not replaced.
- Pin size, label detail, resource/category filtering, resource-panel placement,
  Phase 4 export parity, Shared Map/embed view snapshots, and route consolidation
  remain deferred. No configured schema was applied and no commit, push, Worker,
  Pages deploy, or production UAT occurred.
- Verification passes: focused runtime coverage 62/62, full client/source
  623/623, full server 539/539, ordinary client build, map lockdown 84/84, exact
  six-root production build, and diff check. The stale Browserslist dataset is
  the only build advisory. Signed-in desktop/mobile runtime UAT must wait for an
  explicitly approved schema/Worker/client release plan.

## Owner embed-preview Pages Function recovery (2026-08-09, production)

- The owner Share dialog preview briefly showed `app.carearound.sg refused to
  connect`. The map and approved origins were intact; direct exact static
  republishes had uploaded `client/dist` from the repository root and omitted
  the file-routed Pages Function under `client/functions`. `/embed/maps/*`
  therefore received ordinary SPA anti-framing headers.
- Recovery was deployment-only. The unchanged 80-file artifact and the Pages
  Function bundle were republished with Wrangler rooted at `client`. Preview
  `7c1f67de-8ee6-47a8-9288-60696bf38808` passed first, followed by production
  `0d2f2e51-72a1-4a2b-b1b2-f70cc78de56a` at
  `https://0d2f2e51.senior-resource-map.pages.dev`.
- Production `/embed/maps/*` now sends no XFO, `no-store`, and exact
  `frame-ancestors 'self' https://gudauth.app https://carearound.sg`. Ordinary
  routes retain XFO DENY and `frame-ancestors 'none'`. All 80 local,
  immutable, and custom-domain files match by MIME, bytes, and SHA-256.
- Signed-in Chrome UAT on existing map 25 confirms the Share preview renders
  and selecting a pin opens its resource preview. The screenshot is
  `output/release-logs/owner-embed-preview-function-recovery.png`. Focused
  framing coverage passes 10/10; no CareAround browser error, source change,
  Worker deploy, schema change, or map/data mutation occurred.
- Manual exact republishes must run from `client` or pass `--cwd client` and
  must show that Wrangler compiled and uploaded the Functions bundle and route
  manifest. `npm run deploy:client` already follows this contract.

## Owner mobile focus-card surface refinement (2026-08-08, production release)

- The owner My Map mobile `complete-preview` focus state now removes the
  category icon/label and coloured outer tray. A single selected resource card
  becomes the full-width visible focus surface; multi-resource focus retains
  its horizontal card rail.
- The rollout is guarded by the existing owner-only variant. Ordinary Shared
  Maps retain their category pill and tray. Desktop cards, owner Print View,
  embedded maps, pins, notes, actions, auth, API, snapshots, membership,
  annotations, exports, and Detailed-map assets are unchanged.
- Gates pass: focused map/focus coverage 79/79, full client/source 575/575,
  full server 521/521, ordinary client build, map lockdown 84/84 plus the exact
  six-root build, and `git diff --check`. The final production smoke suite
  exits zero with five first-attempt passes and one postal-import pass on its
  configured retry after a 45-second resolved-anchor timeout.
- Signed-in production Chrome UAT at 390 × 844 passes normal and full-map
  modes. Both contain zero category elements, the card and tray each measure
  370.8125 pixels wide, and client/scroll widths are both 371 pixels. The card
  retains resource details, notes, and `Open resource` without horizontal
  overflow. Production evidence is recorded in `design-qa.md`.
- Implementation `1202b6938` is pushed on
  `codex/owner-focus-card-surface-refinement` and `main`. The validated exact
  artifact is `https://ef29dac0.senior-resource-map.pages.dev`; all 80 local,
  immutable, and custom-domain files match by MIME, bytes, and SHA-256 at
  aggregate
  `a7841175b8b8e9f1fe2ddddf5f8b4dfd1edebd864460187354bf3ff0a18c7ec4`.
  API health and Discover return 200. No Worker changed. See
  `docs/release-manifest-2026-08-08-owner-mobile-focus-card-surface.md`.
- Preserve unrelated untracked workspace files when continuing this release
  line.

## Embedded bubbles and owner mobile focus card (2026-08-08, production release)

- On `codex/embed-bubbles-owner-focus-card`, the map-only embed now uses the
  current category-bubble collision mode rather than the legacy numeric cluster
  bubble. The owner V2 My Map mobile focus tray opts into the complete compact
  resource card already proven by the embed.
- The extracted card preserves logo/fallback, identity, optional public
  Programme/Service count, hours or schedule, Website, phone, supported social
  channels, and `Open resource`; the owner tray also retains the resource-note
  action and SPA return path. Its full-map variant can scroll vertically inside
  the existing 30svh safety bound.
- The rollout is explicitly owner-mobile-only. Ordinary Shared Map focus
  trays, desktop cards, Print View, frozen snapshots, Detailed surfaces, auth,
  API, schema, membership, annotations, and exports are unchanged.
- Gates pass: focused map/focus coverage 79/79, full client/source 590/590,
  server 521/521, ordinary client build, map lockdown 84/84 plus the exact
  six-root build, and `git diff --check`. Production Chrome UAT confirms four
  embed category bubbles, zero legacy clusters, complete unclipped preview
  actions at 400x520, and the signed-in owner focus card at 390x844. The
  immutable deployment also confirms the card in full-map mode. Public smoke
  passes 1/1; five authenticated smoke cases lacked configured credentials and
  are not claimed as passed.
- Implementation `b9a750ec` is pushed on the feature branch and `main`. After
  the expected Git-build race, the exact six-root artifact was accepted at
  `https://f74778c3.senior-resource-map.pages.dev`. A docs-only Git deployment
  followed, so the identical artifact was finally republished at
  `https://0f9629e7.senior-resource-map.pages.dev`. All 80 local, immutable,
  and custom-domain files match by MIME, bytes, and SHA-256 at aggregate
  `99468f3e9a667ed5f383c3eef6400d28e7a4b1f9fdc256396ac8b224cd500cb9`.
  API health, embed API/document, and Discover return 200. No Worker changed.
- Preserve all unrelated untracked workspace files when continuing this
  release line. See
  `docs/release-manifest-2026-08-08-embed-bubbles-owner-focus-card.md`.

## Embedded preview WWW and label refinement (2026-08-08, production release)

- On `codex/embed-preview-www-refinement`, the embedded Website action uses a
  compact globe-plus-`WWW` mark based on the user's supplied reference. The
  watermarked stock image is not bundled. The guest-open offering pill reads,
  for example, `4 Programmes / Services`, with the slash construction retained
  across supported locales.
- The patch is embed-only and translation-only. It does not change frozen
  snapshot data, eligibility counts, Group filters, annotations, Detailed map
  surfaces, My Map, Print View, auth, framing, or server behavior.
- At 400x520, Website, phone, Facebook, Instagram, and `Open resource` remain
  on one row. The 204-pixel card has equal client and scroll heights, so the
  refinement does not reintroduce the earlier whitespace, wrap, or clipping.
- Gates pass: focused embed/i18n 8/8, full client/source 575/575, full server
  521/521, ordinary client build, and map lockdown 84/84 plus the exact
  six-root build. Production Chrome UAT at 400x520 confirms the WWW mark, slash
  label, 204/204 card height, and one action row. The public production smoke
  case passes; five authenticated cases could not run because the configured
  smoke credentials were absent.
- Implementation `651692289` is pushed on
  `codex/embed-preview-www-refinement` and `main`. The accepted production
  deployment is `https://d76c9bf4.senior-resource-map.pages.dev`; all 81 local,
  immutable, and custom-domain files match by MIME, bytes, and SHA-256 at
  aggregate
  `c22921fb7de1ebb023bdab3c637036445adb23b00c60de7399856fc03a6fb023`.
  API health, the frozen embed endpoint, embed document, and Discover return
  200. No Worker deployment was needed. See
  `docs/release-manifest-2026-08-08-embedded-preview-www-refinement.md`.
- Preserve unrelated untracked workspace files if continuing this release
  line.

## Complete embedded-resource preview (2026-08-08, production release)

- On `codex/map-only-embed-v1`, the embedded selected-resource card now shows
  one complete identity block (logo/fallback, name, address), optional hours or
  schedule, a guest-open Programmes/Services count pill, compact Website and
  social icons, the visible tap-to-call number, and `Open resource`. The former
  duplicated identity block is gone.
- UI/UX Pro guidance was applied as a targeted density pass: 4/8-pixel spacing,
  responsive logo/padding, one compact mobile hours line, and one wrapping
  action row while preserving 44-pixel targets and focus styles. At the
  documented 400x520 minimum, the complete 204-pixel card fits without an
  internal scrollbar; desktop keeps the labelled hours hierarchy.
- The pill counts only deduplicated linked/hosted Programmes and Services whose
  guest access resolves to granted. Promotions, hidden/deleted or
  scheduled-hidden, member-only, audience-scoped, and eligibility-gated
  offerings are excluded. The value is frozen only on `Update shared link`, so
  existing tokens retain their prior snapshot until the owner updates it.
- No schema, route, auth, permission, membership, Group-filter, annotation,
  Print View, export, R2, framing, ordinary Shared Map, or live-offering-read
  behavior changed. Preserve all unrelated untracked workspace files.
- Gates pass: server 521/521, client/source 574/574, map lockdown 84/84, exact
  six-root production build, `git diff --check`, and visual QA at 400x520 and
  1280x900. The compact proof exposes Website, phone, Facebook, Instagram, and
  `Open resource` without clipping. See `design-qa.md`.
- Implementation `f54ec727b` is pushed on `codex/map-only-embed-v1` and `main`.
  Worker `ec655f91-1ce8-4afc-ad3e-0a8d5432154d` is live; API health, ordinary
  Shared Map, and embed endpoints returned 200. Automatic Pages build
  `82dd8be3` completed first, then the exact six-root artifact was republished
  at `https://213d1357.senior-resource-map.pages.dev`.
- All 81 local, immutable, and custom-domain files match by MIME, bytes, and
  SHA-256 at aggregate
  `36dfdfd454f0d01a0dba3f4c6afd0a8dab5c3873f6363142448421767854969a`.
  Production serves the expected embed HTML and JavaScript chunk with the new
  count/contact paths. Map 25 was not mutated and still reports zero positive
  counts, as expected until its owner uses `Update shared link`.

## Embedded-map contacts and Group filters (2026-08-08, production release)

- On `codex/map-only-embed-v1`, the embed-only resource preview now removes a
  redundant one-resource name/category repeat while preserving names that
  distinguish hosted or multi-resource pins. It keeps the asset logo/fallback,
  adds a compact website icon, visible tap-to-call phone number, brand-icon
  social links, and the explicit resource link. The compact card uses available
  map height at the documented 400x520 minimum instead of clipping its actions.
- Contact data is a sanitized frozen snapshot created only by `Update shared
  link`. It is applied only by the embed endpoint; ordinary Shared Map payloads
  remain contact-free. Existing tokens require an intentional share update.
  Email, WhatsApp, private notes, personal places, owner data, and unsafe URLs
  are excluded.
- Selecting a Group category now includes public Group members that are also
  in the frozen shared map. New snapshots carry exact hard/soft member asset
  keys; legacy hard-Place focus keys remain compatible. This does not add
  out-of-map members or unrelated resources sharing a location.
- Gates pass: focused client/server 9/9, server 520/520, client/source 574/574,
  map lockdown 84/84, and the exact six-root production build. Mocked built-app
  UAT at 400x520 confirms two Group-member pins remain visible and the compact
  Website, phone, Facebook, and resource actions are accessible. Local
  cross-origin Detailed-manifest CORS errors are expected preview-environment
  noise; the regular map fallback remained usable.
- Implementation commit `ce37a5954` is pushed on
  `codex/map-only-embed-v1` and `main`. Worker
  `1971d14c-54f0-4d0c-8f61-0eab30722cc8` deployed first and both public map
  endpoints returned 200; the ordinary Shared Map payload remained free of
  website, contact-phone, and social fields. The exact six-root Pages artifact
  is `https://b8dc25b5.senior-resource-map.pages.dev`; all 81 local,
  immutable, and custom-domain files matched by bytes and SHA-256 at aggregate
  `972a4e186846edb5afed7b43333b6fa317458605f542111020b42f3f3de667e0`.
- Production Playwright UAT at 400x520 showed 4 mapped resources and retained
  all 4 pins when ICCP was selected. A selected Fei Yue place showed its name
  and address once, with the resource link preserved. Public smoke passed 1/1;
  five authenticated cases were unavailable because their configured
  credentials were absent. Map 25 and its existing frozen share were not
  mutated; its owner must use `Update shared link` once to freeze the new
  contact fields and exact Group-member keys. Preserve unrelated untracked
  workspace files.
- See
  `docs/release-manifest-2026-08-08-embedded-map-contacts-group-filter.md` for
  the release record and rollback boundary.

## Embedded-map presentation enrichment (2026-08-08, production release)

- Branch `codex/map-only-embed-v1` now contains compatible server commit
  `699b33ca` and client commit `bfd17423`. The embed automatically uses the
  locked Detailed-map native/overview fixed surfaces, and selected-resource
  previews show the resource logo with category-icon and letter fallbacks.
- Print annotations remain private by default. Owners can explicitly mark an
  annotation `Share this annotation`; only that public subset is sanitized
  into the frozen snapshot when `Update shared link` is used. The embed renders
  it read-only, while the ordinary Shared Map remains annotation-free.
  Duplicates start private. Public-subset changes make the Share dialog stale;
  private-only annotation changes do not.
- There is no schema migration, new route, permission change, personal-place
  exposure, live owner-data read, R2 change, or annotation editing inside the
  iframe. The existing allowlist, revocation, guest visibility, list-only,
  framing, My Map, Print View, export, and six-root contracts are preserved.
- Local gates pass: focused server 59/59, focused client 93/93, server 520/520,
  client/source 587/587, map lockdown 84/84, exact six-root production build,
  and `git diff --check`. Worker version
  `10d07e2a-2d22-4dfc-8080-ed0d3aa72f59` was deployed first.
- Accepted Pages production is
  `https://d584a8d6.senior-resource-map.pages.dev`. All 80 local, immutable,
  and custom-domain artifacts match by MIME, bytes, and SHA-256; aggregate
  SHA-256 is
  `2be419b82246c3674fb73691e40f028bd07251720d404a3bdc4a5c3bb92d5827`.
  A `main` push triggered automatic deployment `2bbe37de` without the locked
  build environment after the first controlled deploy, so the validated dist
  was deliberately republished after it completed. Keep this race in the
  release gate for future client deploys.
- Public smoke passed 1/1. The five authenticated smoke cases were not runnable
  because their configured username/password were absent, so this release does
  not claim 6/6. Signed-in Chrome UAT nevertheless proved the exact new paths:
  Detailed native fixed layers with zero live tiles, selected-resource logo,
  private-by-default annotation opt-in, frozen read-only rendering, opt-out
  removal, and an annotation-free ordinary Shared Map. Disposable map 298 was
  unpublished, deleted, removed from My Maps, and its retired public token now
  returns 404 from both Shared Map API routes. Existing map 25 was read-only.
- See `docs/release-manifest-2026-08-08-embedded-map-enrichment.md` for the
  deploy sequence, acceptance matrix, and rollback boundary.

## Map-only website embed V1 (2026-08-08, production release)

- Branch `codex/map-only-embed-v1` starts from deployed source base
  `967cf183d`. The owner Share dialog has opt-in Website embed settings for
  exact approved origins, a live enable/disable switch, preview, and generated
  lazy iframe code. The frozen Shared Map snapshot remains authoritative;
  embedding fails closed without a matching snapshot, while ordinary Shared
  Map compatibility and owner workflows are unchanged. A legacy published map
  must use `Update shared link` once before enabling an embed.
- The embed is guest-only and map-only. It boots outside auth, Google, saved
  resources, and PWA providers; uses a credential-free endpoint; and strips
  top-level assets plus notes, save/access/profile fields, personal places,
  annotations, and embed settings. It keeps map name, category-bubble
  pins/clusters, search/categories, zoom/reset, selected resource preview,
  list-only disclosure, external-tab links, and attribution.
- Global anti-framing remains locked. A Pages Function handles only
  `/embed/maps/*`, obtains the minimum live origin configuration, supplies a
  route-specific CSP and full Function-response security headers, removes XFO
  only there, and fails to a no-data unavailable document. Production origins
  are exact HTTPS origins; only loopback HTTP is allowed for UAT.
- The narrow production schema gate verified exactly `embed_enabled` and
  `embed_allowed_origins`. Server commit `0720e206d` deployed first as Worker
  version `5604c307-7c70-45ec-98eb-1470d1e51576`; client commit `3d4c1a66b`
  followed. Edge recovery `d57fdf35a` uses Cloudflare-supported manual redirect
  handling, and owner-preview recovery `eaf06c32c` permits only same-origin
  preview frames while ordinary pages keep `frame-ancestors 'none'` and XFO
  DENY.
- Final gates pass: server 517/517, client 587/587, map lockdown 84/84, exact
  six-root build, and production smoke 6/6. Authenticated production UAT passes
  owner preview, approved desktop, blocked unapproved origin, mobile touch
  release, height warning, private-field exclusion, session parity, live origin
  removal, disable/unpublish revocation, token rotation, and cleanup.
- Exact Pages production is
  `https://990a7047.senior-resource-map.pages.dev`. Its 80-file static manifest
  and `https://app.carearound.sg` match the controlled build byte-for-byte at
  SHA-256 `0302b635f630e85dfdf41955c47d86ea0a3e125aacbe18f8ab7a53cac604dc89`
  with correct JS/CSS MIME types. Unknown embeds fail closed with 404/no-store.
  All disposable maps were deleted and the mapped source fixture remained
  private and unchanged. Preserve unrelated untracked files and see
  `docs/release-manifest-2026-08-08-map-only-embed-v1.md` for rollback details.

## Print View Detailed-map transient-load stabilization (2026-08-07, production release)

- Branch `codex/annotation-drawing-ux` contains a client-only stabilization for
  the owner My Map Print View. The external print zoom dock now uses the same
  containment-aware displayed-step resolver as the locked Leaflet counter, so
  raw `13.9` displays `13` instead of a false `14`.
- Terminal native/overview manifest failures expose one explicit
  `Retry detailed map` action. It restarts the four existing bounded
  Default/Gray source loaders through a reload generation and abort cleanup;
  there is no autonomous retry loop, page reload, camera change, threshold
  change, R2 mutation, or new network endpoint. Map appearance status now
  follows the active overview/native tier instead of always reading native.
- Red-first regression coverage passed focused map/print 68/68, map lockdown
  84/84, full client/source 572/572, and full server 502/502. The exact six-root
  production build passed with only the established warnings. Mocked-auth
  built-app Leaflet UAT
  proved terminal failure to user-triggered recovery, raw `13.9` to displayed
  `13`, native-only zoom 15, overview-only zoom 14, and zero live OneMap tiles
  under both Detailed tiers.
- Implementation `fd098c980` is pushed on `codex/annotation-drawing-ux`.
  Feature preview `https://5ecf7da4.senior-resource-map.pages.dev` and explicit
  production deployment `https://6ee1710f.senior-resource-map.pages.dev` use
  the same validated build. Local, immutable production, and custom-domain
  HTML, entry, CSS, My Map, export, Shared Map, and shared-runtime artifacts are
  byte-identical with correct MIME types; all six map roots and locked bundle
  markers remain present. Core routes and API health passed.
- Authenticated production smoke passed 6/6 with its disposable map cleaned up.
  Signed-in Chrome UAT on owner map 258 confirmed corrected contained level 13,
  v3 overview-only Detailed at displayed zoom 14, v2 native-only Detailed at
  displayed zoom 15, zero live OneMap tiles beneath both, and a healthy Detailed
  selected state with no unavailable/retry UI. No production failure was
  injected and no map content was mutated. No Worker/API, schema, auth,
  permission, secret, R2 asset, Shared Map visibility, or production-data
  change was deployed.

## Print View annotation-tool refinement (2026-08-07, production release)

- The annotation toolbar removes only the `Label pin` creation option;
  existing saved pins retain all compatibility paths. On-map Move and Rotate
  handles now use clear four-arrow and single-clockwise-arrow SVG icons with the
  existing 44-pixel targets.
- Rotate now supports lines, boxes, circles, and boundaries. Boxes keep their
  two-corner saved geometry and add one optional bounded `rotationDegrees`
  value; their outline and note turn together. Boundaries turn their geometry
  and note. Circles retain their outline, centre, and radius while their inside
  note turns. Rotated-box adjustment handles remain attached to its visible
  opposite corners, and Duplicate preserves the angle.
- The field is an additive schema-version-1 JSON property. Client normalization
  and the Worker request validator both bound it; no database migration,
  table/API-route, auth, permission, Shared Map, resource-pin, map-asset, or
  production-data change is included.
- Verification passed focused client/server annotation coverage 23/23, full
  client/source 572/572, full server 502/502, map lockdown 84/84, and the exact
  six-root production build. Mocked-auth built-app Leaflet UAT confirmed both
  refined icons, live box rotation, circle-text-only rotation, Saved/Undo state,
  and visible rotated-box control handles.
- Implementation `61182bf52f3760f052414cf0519c6ffa4388342b` is pushed on
  `codex/annotation-drawing-ux`. Compatible Worker version
  `9b06d6b5-e94e-4342-8ec2-8e3002d9c6e3` deployed before the exact Pages build
  at `https://6c8562eb.senior-resource-map.pages.dev`. Local, immutable Pages,
  and `https://app.carearound.sg` HTML, entry, CSS, My Map, export, Shared Map,
  and shared-runtime artifacts are byte-identical with correct MIME types.
- Authenticated production smoke passed 6/6. A narrower disposable-map check
  then saved and reloaded rotated rectangle, circle, and polygon annotations,
  advanced revision 0 to 1, and deleted the temporary map. API health passed.
  No temporary UAT data, database migration, table/API-route, auth, permission,
  secret, map-asset, Shared Map visibility, or production-resource change
  remains.

## Print View annotation transform tools (2026-08-07, production release)

- Branch `codex/annotation-drawing-ux` contains client-only implementation
  commit `d0f7662c052154127b08cd399b7e1ad64012c791` for Move, Rotate, and
  Duplicate. Move translates pins, lines,
  boxes, circles, and boundaries as whole items. Rotate is deliberately limited
  to lines and boundaries so the existing two-corner box model and saved
  annotation schema stay unchanged. Duplicate inserts one slightly offset copy
  immediately above the source and selects it.
- Transform previews use local request-animation-frame Leaflet updates and
  commit once on mouse-up. Duplicate performs one document update. Existing
  Undo/Redo, serialized autosave, private persistence, export preparation,
  PNG/PDF parity, map modes/assets, and Shared Map privacy are unchanged.
- Verification passed: focused annotation/Print View 47/47, full client/source
  571/571, server 502/502, map lockdown 83/83, and exact six-root client build.
  A disposable real-Leaflet harness proved one commit each for Duplicate, Move,
  and Rotate, live pre-commit SVG changes, 44-pixel transform handles, and zero
  browser warnings/errors. The harness was removed.
- The branch preview is `https://0611ba33.senior-resource-map.pages.dev`; the
  explicit production deployment is
  `https://00082b30.senior-resource-map.pages.dev`. Local, immutable
  production, and custom-domain HTML, entry, CSS, My Map, map-export, Shared
  Map, and shared-runtime artifacts are byte-identical with correct MIME types.
  Core routes and API health passed, and authenticated production smoke passed
  6/6 with its temporary map cleaned up. The custom domain briefly returned SPA
  HTML for two new JavaScript paths during propagation, then recovered to exact
  artifact parity before the release gate continued.
- No Worker, schema, auth, permission, secret, map asset, Shared Map visibility,
  or production-resource deployment occurred. The next gate is owner UAT on a
  disposable annotation covering Move, Rotate, Duplicate, Undo/Redo, reload
  persistence, and Map PNG/PDF parity.

## Print View annotation umbrella release (2026-08-07, stabilized)

- The two-release annotation improvement is live and the final stabilization
  gate has passed. Release 1 implementation `295ebfd4b` fixed live
  control-point dragging, stale-point reversion, one-commit-per-drag undo, 44px
  targets, and hidden-export rebuild churn. Release 2 implementation
  `9915de2a8ac924d101003d8506492529264fcfcf` added live drawing previews,
  two-click line/box/circle creation, multi-point boundary Done/Enter, contextual
  guidance, and drawing-mode hit-test isolation. Production `main` is the
  Release 2 implementation commit.
- The accepted immutable production deployment is
  `https://8f9840b9.senior-resource-map.pages.dev`. Fresh final verification
  proved local `client/dist`, the immutable deployment, and
  `https://app.carearound.sg` byte-identical for HTML, entry, CSS, My Map,
  map-export, Shared Map, and shared runtime assets with correct MIME types.
  Core routes returned 200 and production API health returned JSON `status: ok`.
- Fresh final gates passed: annotation/Print View 41/41, combined
  client/source/town-map 585/585, server 502/502, map lockdown 81/81, the
  map-lockdown aggregate, and the exact six-root production build. A real
  Leaflet performance probe produced eight distinct live paths during one
  drag, exactly 31 commits for 31 completed drags, zero endpoint drift, and no
  browser warning/error.
- Final signed-in production UAT on owner map 258 covered live next-edge
  previews, boundary Done/Enter gating, inert repeated Enter, two consecutive
  control-point drags, one-step Undo, autosave, visible/export parity, and full
  reload persistence. The temporary boundary was deleted. A clean reload left
  only the original private annotation on both visible and export surfaces,
  reached map-ready state, and produced no new application warning or error.
- Stable source of truth:
  `docs/stable-baselines/print-view-annotations-2026-08-07.md`, plus the two
  2026-08-07 annotation entries and umbrella stabilization entry at the top of
  `docs/regression-ledger.md`. Evidence commit
  `1bf49939cf448cad688dbcc6b7d6001d3c62d079` is already pushed on
  `codex/annotation-drawing-ux`; the final documentation lock belongs on that
  feature branch only and must not be pushed to `main` or trigger a production
  deployment.
- No Worker, schema, auth, permission, secret, map asset, Shared Map visibility,
  or production-resource change belongs to this umbrella release. Do not reopen
  annotation product work unless a new regression or a separately approved tool
  is requested. Standalone text, arrow, freehand/lasso, road-snap, and
  touch-only editing remain intentionally unsupported.

## High-Detail Town Maps production release (2026-08-02, verified)

- Isolated worktree:
  `/Users/sweetbuns/CareAroundSG-high-detail-town-maps`; branch
  `codex/high-detail-town-map-downloads`; exact production base
  `548829758bd58b040073199cafc2a6a1da4d8387`.
- New protected route: `/my-directory/town-maps`. It is a separate lazy-loaded
  download catalogue and has no My Map shortcut. My Map, Print View,
  personalised `Save Map PNG` / `Save PDF`, Leaflet, map modes, six fixed-map
  roots, zoom behavior, cameras, markers, privacy, APIs, schemas, and Worker
  code remain unchanged.
- Published and remotely verified immutable R2 prefix:
  `v4/town-map-downloads-20260801-r2/default`; 99 objects and 2,862,256,987 bytes.
  Catalogue SHA-256:
  `fbf2bb7cecdb70399db9548520e2b0c91f8a4ba45002bfc03dd0b9247994a955`.
  The tool is dry-run by default, preflights all object keys as absent, has no
  overwrite/delete path, proves C08 through a query-free exact custom-domain
  download before continuing, and publishes `catalogue.json` last.
- The user approved this second exact prefix on 2026-08-02. Both the independent
  preflight and the `--apply` path confirmed all 99 keys were vacant before the
  first write.
- Local gates passed: source/library validation for all 32 PNG/PDF pairs,
  focused module/publisher 20/20, town-map R2 16/16, locked map/print 75/75,
  exact six-root build, desktop/mobile authenticated UAT, representative real
  PNG/PDF download hashes, and My Map network isolation. Broad client tests are
  532/533 with only the known date-expired Care Calendar fixture failing on
  untouched production-baseline code.
- The approved first R2 apply wrote 96 binaries/thumbnails and two metadata
  objects but failed closed before `catalogue.json`. The catalogue remains 404
  and the client has not been deployed. S01's real public PNG URL downloads at
  the exact size/hash and all 32 PDF leading ranges pass, while direct R2
  retrieval proves C08 is stored at its exact size/hash. C08's custom-domain
  path is not release-ready: the query-free full GET transferred only 6.4 MB in
  120 seconds and some mid-file ranges returned `206` headers without a body.
- The approved second apply passed the 52,677,239-byte C08 query-free public
  canary with its exact SHA-256, uploaded all 99 planned objects, verified the
  assets and metadata, and published `catalogue.json` last. The complete remote
  verifier passed 99/99 HEAD checks, 98/98 non-catalogue hashes, 64/64 PNG/PDF
  download hashes, 32/32 thumbnail hashes, and 32/32 PDF range requests. A
  separate normal S01 PDF download returned the exact 5,220,043 bytes and
  SHA-256 with the correct MIME, attachment filename, immutable cache policy,
  range support, and CareAround CORS.
- Do not resume, overwrite, delete, or finalize
  `v4/town-map-downloads-20260801/default`. Keep this partial root untouched as
  forensic evidence. Keep the verified
  `v4/town-map-downloads-20260801-r2/default` root immutable and do not rerun its
  uploader.
- Production code commit `485910dc0` is pushed on
  `codex/high-detail-town-map-downloads`. The exact six-root production build
  deployed to `https://ff9d8d64.senior-resource-map.pages.dev`; the preview and
  `https://app.carearound.sg` matched local HTML, entry, CSS, Town Maps, My Map,
  and map-export bytes. Entry SHA-256:
  `c48e51ec19627ad9093176d0549465c9342bb6646fb582202fb9f6002c0989de`;
  Town Maps chunk SHA-256:
  `eea095a9b25bec046e006df1b78485c54efbe59fc84c3fe1dd30c91f2020ac2e`.
- Authenticated custom-domain UAT passed desktop `1440 x 900`, mobile
  `390 x 844`, 32-map completeness, three-preview initial lazy loading, no
  preselected PNG/PDF DOM URLs, `S01` search, real Southern Islands PNG/PDF
  download starts, attribution, mobile Wi-Fi guidance, no horizontal overflow,
  and complete English/Chinese/Malay/Tamil presentation. A fresh My Map route
  loaded no download-library URL or app-origin console error. The authenticated
  owner had zero saved My Maps, so no production test map was created; local
  authenticated existing-map UAT remains the interaction-level network proof.
  Production API health returned OK. No Worker, schema, auth, permission,
  secret, or production-data change was deployed.

## Map stable baseline lock (2026-07-23)

- Stable map commit: `97118d4919cda77f1be581b0489eaf327e2ef098`
  (`Fix print detailed map at zoom 15`).
- Local stable tag: `map-stable-2026-07-23`.
- Lockdown branch: `codex/map-work-lockdown-20260723`.
- Stable manifest:
  `docs/stable-baselines/map-work-2026-07-23.md`.
- Production Pages deployment:
  `https://8299e8cf.senior-resource-map.pages.dev`.
- Custom domain `https://app.carearound.sg` served the validated bundle set:
  `assets/index-BbMHCdJ9.js`,
  `assets/MyMapDetailPage-D1SJlYMS.js`,
  `assets/MapImageExportButton-CHH0QFSF.js`, and
  `assets/index-CRSe8Nl6.css`.
- Locked behavior: owner My Map and owner Print View keep the existing Leaflet
  interaction model; Detailed activates at displayed zoom step 15 when covered,
  including after Print View map resizing; fallback copy says the regular map
  is still shown; Print View downloads are `Save PNG` / `Save PDF`; `Save A3
  PDF`, the old `Standard map is still on` wording, and a visible Print Master
  action are release blockers.
- Future map work must begin by reading
  `docs/stable-baselines/map-work-2026-07-23.md`,
  `docs/regression-ledger.md`, this handoff, and
  `docs/release-checklist.md`, then running the focused map/print tests and the
  exact four-root production client build before deploy.

## Private My Places Library V2 production release (2026-07-24)

- Release commit `e026ab92c` is pushed on `codex/my-places-library-v2` and
  fast-forwarded to `main`. It delivers a private reusable My Places library,
  multi-map place links, custom categories with curated or uploaded icons and
  colours, personal-place descriptions, per-map managed-resource descriptions,
  and the owner Full-map 2/3/4-column print controls.
- The additive production schema bootstrap retained 2 legacy rows and
  backfilled 2 library places plus 2 map links. It reported 0 unbackfilled
  legacy places and 0 duplicate category names. Keep the additive V2 tables
  during any application rollback so library data is not discarded.
- Production Worker version:
  `a9ae70c5-19d8-4448-b7a7-73bd9ad24714`.
  Production Pages deployment:
  `https://cc8cf910.senior-resource-map.pages.dev`.
- `https://app.carearound.sg` served the exact validated client bundle. The
  entry, CSS, My Map, My Directory, category, export, and map chunks matched
  local `client/dist` byte-for-byte and retained all four Detailed/Print Master
  roots and locked map markers.
- Full server coverage passed 466/466, locked map/print coverage passed 80/80,
  the exact four-root production build passed, and production smoke passed
  6/6. Broad client coverage passed 473/474; the only failure is the existing
  expired Care Calendar planning fixture on untouched source.
- Signed-in production UAT confirmed 2 reusable places and 8 categories in My
  Places, both private places on owner map 258, and the Full-map screen/export
  resource pages at `6/6/4/6` with 22/22 left-aligned badges. PA Resident
  Network and Senior Citizen Fitness Corner each stay in one column. All 3
  existing shared snapshots contained 0 personal-place rows and arrays.
- Rollback application code to `personal-places-v1-2026-07-24` /
  `2f61b13cc`, while retaining the additive V2 tables. The pre-release map
  baseline remains `map-stable-2026-07-23`.

## Native-scale islandwide Detailed-map v2 release (2026-07-23)

- Isolated worktree:
  `/Users/sweetbuns/CareAroundSG-native-scale-map-v2`
- Branch: `codex/native-scale-map-assets-v2`
- Exact base: `2a213b92a9d4a86926de83ad5bc23caab87d9416`
  (`origin/main` when the worktree was created).
- Scope: asset-version upgrade for the existing islandwide fixed-surface
  Detailed map. It adds strict native-scale W01 identities, native collection
  source-layout support, v2 environment gates, and operational documentation;
  it does not redesign the map or change Leaflet, Standard-map defaults, pins,
  clusters, camera/focus, notes, sharing, print composition, or mobile behavior.
- Published production roots:
  - Default:
    `https://maps.carearound.sg/v2/native-scale-20260722/default`
  - Gray:
    `https://maps.carearound.sg/v2/native-scale-20260722/gray`
- Source validation and full remote R2 verification completed across all 32
  surfaces and 2,741 chunks per style. Default matched 1,475,991,567 bytes and collection version
  `sg-native-z18-default-dd278b0ec70837c2`; Gray matched 1,318,586,532 bytes
  and `sg-native-z18-gray-93d7fb92af2690f6`. Exact native-scale and deployed
  W01 identities pass; tampered W01 identities fail.
- Verification completed: fixed-surface/integration 27/27, R2 6/6,
  broader map/print 201/201, exact v2 production-mode client build, and
  `git diff --check`. Desktop, mobile, and print browser inspection covered
  Default/Gray switching, zoom-15 Detailed activation, pin alignment,
  viewport chunk replacement/unloading, seams/gaps, console errors, failed
  map requests, and absence of live OneMap basemap-tile traffic in Detailed.
  Full client/source coverage passed 443/444; its only failure is the existing
  Care Calendar planning-overlap assertion, which also fails in unchanged
  `main` and is unrelated to this map release.
- R2 publication completed in the guarded order: immutable chunks, then the 32
  manifests, then the short-cache collection index. Cloudflare Pages deployment
  `https://dbbfff9f.senior-resource-map.pages.dev` published the exact validated
  client to the production branch. `https://app.carearound.sg` serves
  `assets/index-B13hWXr9.js`; its SHA-256
  `8c8a523c4489a1effab6ff3740a164a6cf920ca62f72c45bc13aa739e1953c75`
  matches local `client/dist` and contains both v2 roots with no v1 marker.
  Authenticated production smoke on owner map 87 confirmed Standard at zoom 14,
  automatic Detailed at zoom 15, Default/Gray v2 W01 chunks, and no new live
  OneMap tile requests after the Detailed and Gray switches. The API health
  endpoint remained OK. Keep the untouched v1 islandwide roots as rollback.
- No Worker, API, schema, auth, permission, data, ranking, filtering,
  visibility, saved-resource, or database mutation was included. Source
  implementation commit `1334957bc` is merged into `main`. Before the push,
  the Cloudflare Pages Git build command was updated from the stale W01-only
  roots to both validated v2 roots, so later `main` builds retain this release.

## Full Map Print Master v2 production release (2026-07-23)

- Isolated worktree:
  `/Users/sweetbuns/CareAroundSG-print-master-v2`
- Branch: `codex/print-master-v2-integration`; exact base
  `6814dad8785f0981fce01e748cb88a37150ee91d` (`origin/main` when created).
  The unrelated dirty main checkout was not switched, staged, or modified.
- Implementation commits: `2aab61303` adds the islandwide Print Master export;
  `2e64276e4` retries transient R2 chunk-fetch failures up to five times with
  bounded backoff while keeping hard 4xx responses non-retriable.
- Scope: owner Print View only. It adds an optional Full map page, a separate
  next-page resource directory, separate map/resource PNG downloads, a two-page
  A3 PDF, a higher-detail Print Master PDF, optional numbered-resource pins,
  print-only automatic Detailed activation, and a 384 MiB print compositor
  safety cap. Leaflet, owner-map interaction, Standard defaults, Discover,
  Shared Maps, API, schema, auth, permissions, ranking, visibility, and saved
  resources are unchanged.
- Published production-ready Print Master roots:
  - Default:
    `https://maps.carearound.sg/v2/print-master-100-20260723/default`
    (`print-master-100-8523e7775f2589f3`)
  - Gray:
    `https://maps.carearound.sg/v2/print-master-100-20260723/gray`
    (`print-master-100-e46bde6437b66451`)
  Each style contains 32 surfaces and 2,741 immutable chunks. Default totals
  3,993,473,518 bytes; Gray totals 3,587,868,812 bytes. The complete W01 Gray
  surface was additionally fetched as 88/88 full objects (146,757,237 bytes).
- Browser-compositor evidence used the production manifests/chunks and the
  released compositor. It completed all 88 W01 chunks for both styles and
  produced complete 2,400 x 1,600 canvases with no visible gaps or seams:
  `/Users/sweetbuns/CareAroundSG-print-assets/evidence/print-master-default-browser-compositor-w01-20260723.png`
  and
  `/Users/sweetbuns/CareAroundSG-print-assets/evidence/print-master-gray-browser-compositor-w01-20260723.png`.
  Gray completed in about 24.6 seconds. Sampled remote verification covered 96
  chunks per style; Default median/p95/max were 769/3,338/5,249 ms and Gray
  512/1,419/2,590 ms. Production CORS and range delivery were verified.
- Authenticated owner Print View UAT on map 87 confirmed zoom-15 automatic
  Detailed activation, Gray selection, Full map + next-page resources, High
  resolution, pin hide/show, QR retention, and a complete two-page A3 PDF.
  Evidence:
  `/Users/sweetbuns/CareAroundSG-print-assets/evidence/production-owner-print-detailed-gray-zoom15-20260723.jpg`,
  `/Users/sweetbuns/CareAroundSG-print-assets/evidence/production-owner-print-fullpage-hires-plain-20260723.jpg`,
  and `/Users/sweetbuns/Downloads/my-partners-print (2).pdf`. The PDF is A3
  landscape, two pages, and 7,660,133 bytes; both rendered pages were inspected.
- Verification completed before promotion: packaging/focused coverage 67/67,
  town-map scripts 8/8, broader map/print 215/215, server 451/451, retry-focused
  coverage 6/6, exact four-root production client build, and
  `git diff --check`. Full client/source coverage passed 449/450; its sole Care
  Calendar planning-overlap failure reproduces on the released baseline and is
  outside this map/export release.
- Validated production Pages deployment:
  `https://9bf1306f.senior-resource-map.pages.dev`. The custom domain serves
  `assets/index-Bj6IIhs7.js`, `assets/MyMapDetailPage-D3kaxG9r.js`, and
  `assets/MapImageExportButton-DC5me1s8.js`; their content and SHA-256 values
  match the validated local `client/dist`.
- A long-running, high-memory Chrome process later failed dynamic imports for
  both the CareAround route and an installed extension even though direct
  navigation to the exact route module returned the correct JavaScript. Do not
  add an application workaround for that browser-process failure. The current
  five-attempt retry was instead verified in a fresh isolated compositor using
  the exact production R2 objects. A fresh authenticated Print Master PDF
  download remains the recommended first post-release UAT check.
- Rollback: rebuild without the two Print Master roots to hide only the Print
  Master action, or restore the native-scale v2 client bundle. The interactive
  Detailed roots remain
  `/v2/native-scale-20260722/default` and `/v2/native-scale-20260722/gray`, and
  all immutable Print Master objects may remain in R2 without affecting users.
- Release commit `e4d52dd03` is on both
  `codex/print-master-v2-integration` and `main`. The exact validated
  `client/dist` was explicitly published to the Pages production branch after
  promotion. Post-deploy checks confirmed the custom-domain entry, My Map
  route, export chunk, and CSS are byte-for-byte local matches; public Discover
  and the API health endpoint returned 200/OK; all four interactive/Print
  Master collection manifests returned 200, 32 surfaces, JSON, and the Print
  Master manifest allowed the production app origin. The public production
  Playwright smoke passed. Its five authenticated cases were not runnable in
  the release shell because smoke credentials were absent; earlier signed-in
  production UAT and the non-mutating compositor/export evidence above remain
  the authenticated release evidence.

## Current release state

- Production app: `https://app.carearound.sg`
- Stable map baseline: `map-stable-2026-07-23` at
  `97118d4919cda77f1be581b0489eaf327e2ef098`.
- Production client bundle: `assets/index-CEvzEMXS.js`
- Production Care Calendar chunk: `assets/CareCalendarPage-B5khzVOM.js`
- Production Resources chunk: `assets/ResourcesPage-B_a45vRP.js`
- Production My Directory chunk: `assets/MyDirectoryPage-B1f6qxXS.js`
- Production My Map owner chunk: `assets/MyMapDetailPage-DZa1Qv6Q.js`
- Production personal-category chunk:
  `assets/personalPlaceCategories-DJJVQ68J.js`
- Production map-export chunk: `assets/MapImageExportButton-CXUQwO3R.js`
- Production client CSS: `assets/index-Dp7WHDGt.css`
- Validated production Pages deployment:
  `https://cc8cf910.senior-resource-map.pages.dev`
- Production Care Calendar preview:
  `https://5f024c97.senior-resource-map.pages.dev`
- Production API: `https://api.carearound.sg/api/health` returned OK at
  `2026-07-24T05:26:45.043Z`.
- Production Worker version:
  `a9ae70c5-19d8-4448-b7a7-73bd9ad24714`.
- Current map release markers to preserve: v2 native-scale Default and Gray
  roots, retained Print Master roots, `resize moveend zoomend` containment,
  `The regular map is still shown.`, and `Save PDF`. The deployed map bundle
  must not contain the old `Standard map is still on` fallback or `Save A3 PDF`
  label.
- Owner Print Map badge-readability release commit `63f945d55` is merged,
  pushed, and deployed on Pages. At the smallest global text setting, signed-in
  production UAT on owner map 87 measured all 15 compact number badges at
  20px/11px and all 15 regular badges at 28px/13px on both visible and export
  surfaces. Balanced `Wide` remains the 680px default and the opt-in `Extra
  wide` map measures 760px on both surfaces. Focused Print Map coverage passed
  42/42, full client/source coverage passed 442/442, full server coverage
  passed 451/451, the exact islandwide production build passed, and the custom
  domain served the validated bundle above with no application-origin console
  error. The authenticated smoke credentials were unavailable in the release
  shell; API health, public Discover, bundle markers, and signed-in owner UAT
  were used as the post-deploy gate instead.
- Production AI collateral import uses `gemini-3.1-flash-lite`. Signed-in
  production UAT on 2026-07-18 returned 26 schedules-ready review rows and 0
  schedule-review rows from `TWV-July-Eng.jpeg`. Post-deploy smoke passed 6/6,
  and no production resource changes were saved.
- Collateral schedule first-cut release commit `0ff5964c7` is deployed on the
  Worker and Pages. The import review UI drops invalid cached schedule
  placeholders, labels validated schedule rows as ready, gives ordinary desktop
  widths the full review workspace, and keeps the W01 map proof asset roots in
  the production bundle. Post-deploy production smoke passed 6/6. An additional
  ad hoc read-only collateral-preview probe was attempted, but the helper
  stopped at automated login before reaching the import route; no Save reviewed
  rows action or production resource mutation was performed.
- Collateral calendar text-to-schedule recovery commit `d1a1718f0` is merged,
  pushed, and deployed on the Worker. This follow-up addresses the production
  finding that `TWV-July-Eng.jpeg` still produced `Schedules ready 0` because
  the parser could not convert flyer shorthand dates such as `6/7` without an
  explicit year on the same line. The deployed fix adds schedule context
  extraction (`calendarContext` / `scheduleContext`), bumps the AI cache
  contract to `3`, parses dot-separated times and date bullets with a visible
  month/year context, and leaves shorthand dates without a year context in
  manual review. Focused parser/collateral coverage passed 31/31, full server
  passed 446/446, `git diff --check` passed, API health returned OK, and
  production smoke passed 6/6 after deployment. No client, Pages bundle, schema,
  secret, auth, or production data change was included.
- Collateral weekday-range schedule parser commit `c4f7529fe` plus cache
  contract bump commit `f7b0dcaa0` are merged, pushed, and deployed on the
  Worker. This follow-up handles the remaining Board Games-style
  `TWV-July-Eng.jpeg` row:
  `Mon to Wed & Fri: 9AM - 12PM, 1.30PM - 5PM` and
  `Thurs: 1.30PM - 5PM`. With visible context such as `JULY 2026`, the parser
  now creates bounded weekly reviewed rows for the printed weekday ranges and
  split time windows. The same weekday wording without month/year context stays
  in manual review. The cache contract is version `4` so stale v3 collateral
  previews are not reused. Focused parser/collateral coverage passed 34/34,
  full server passed 449/449, `git diff --check` passed, API health returned
  OK, and production smoke passed 6/6 after the final Worker deploy. No client,
  Pages bundle, schema, secret, auth, or production data change was included.
- Collateral incomplete-schedule recovery commit `b014c4187` is merged,
  pushed, and deployed on the Worker. Production UAT after the previous cache
  bump showed the fresh Gemini response had regressed to 26 name-only rows at
  50% confidence because schedule fields were optional and that incomplete
  batch was accepted and cached. Contract `5` now requires schedule text fields
  in the primary extraction and adds a bounded, quota-counted schedule-only
  transcription when a 3+ Programme calendar has no schedule evidence. Empty
  rescue results are not cached. Focused schedule/collateral coverage passed
  36/36, full server passed 451/451, the exact production map-enabled client
  build and `git diff --check` passed, API health returned OK, and production
  smoke passed 6/6. Signed-in read-only production UAT with the retained
  `TWV-July-Eng.jpeg` upload returned `Schedules ready 26` and `Need schedule
  review 0`; Zumba Gold had four correct July rows and Board Games had three
  weekly rows. Save reviewed rows was not selected. No client deploy, schema,
  secret, auth, or production data change was included.
- Islandwide Detailed-map release commit `5c22bc0d2` is merged, pushed, and
  deployed on the production Pages branch. The custom domain bundle contains
  the islandwide Default root `https://maps.carearound.sg/v1/islandwide`, the
  islandwide Gray root `https://maps.carearound.sg/v1/islandwide/gray`, and no
  W01 asset-root marker. The first direct Pages deploy produced a correct
  preview, but the custom domain remained on an older map bundle until the same
  validated `client/dist` was explicitly published to the `main` Pages branch.
  Keep future client releases on the release-checklist production build command
  and repeat the explicit `--branch main` publish after any `main` push that
  could trigger a Pages build. The 2026-07-19 Print Map release confirmed that
  the Git-triggered build still emitted the older W01 roots and briefly replaced
  the validated upload. The final explicit `main` publish restored the
  islandwide bundle. Treat the dashboard environment configuration as needing
  re-verification; do not rely on the Git-triggered build until it produces the
  islandwide markers itself.
- Map asset domain: `https://maps.carearound.sg`
  - Default W01: `/v1/w01`
  - Gray W01: `/v1/w01/gray`
  - Production islandwide Default: `/v1/islandwide`
  - Production islandwide Gray: `/v1/islandwide/gray`

## Repo and worktree state

- Current worktree branch: `main`, matching pushed `origin/main` at
  `63f945d55`. The Print Map badge-readability refinement was developed in
  `/Users/sweetbuns/CareAroundSG-print-map-layout-composer` on
  `codex/print-badge-readability-balanced-width`, then fast-forwarded to
  `main`. The islandwide Detailed-map release is merged from
  `/Users/sweetbuns/CareAroundSG-islandwide-detailed-map` on
  `codex/islandwide-detailed-map`; the owner Detailed fixed-surface path now
  resolves a 32-surface islandwide index for both Default and Gray without
  bundling generated chunks into the client. Existing unrelated local artifacts
  remain untracked.
- Collateral schedule first-cut branch:
  `codex/collateral-import-schedule-first-cut`; implementation commit
  `0ff5964c7` adds validated structured first-cut schedules to collateral
  extraction, versions and revalidates cached extraction output, removes empty
  schedule placeholders, and expands the batch review workspace below the 1536
  px breakpoint. Focused coverage passed 52/52, full server passed 442/442,
  full client/source passed 434/434, the exact production map-enabled client
  build passed, `git diff --check` passed, and production smoke passed 6/6
  after Worker and Pages deployment.
- Production `main` includes islandwide Detailed-map release commit
  `5c22bc0d2`, collateral incomplete-schedule recovery commit `b014c4187`,
  collateral cache contract bump commit `f7b0dcaa0`, collateral
  weekday-range parser commit `c4f7529fe`, collateral
  calendar text-to-schedule recovery commit
  `d1a1718f0`, collateral schedule first-cut commit `0ff5964c7`, Gemini
  collateral model recovery commit
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
- Detailed Default uses the accepted colour fixed-surface asset set. Detailed
  Gray uses the accepted native OneMap Grey fixed-surface asset set. The
  pending islandwide branch resolves these through 32-surface islandwide
  indexes and lazy per-surface manifests instead of the older W01-only
  manifest.
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
- Both fixed-surface sources preload. In the pending islandwide branch, only
  the root indexes preload; the active area's per-surface manifest and visible
  chunks load lazily. Switching colour or focused area while Detailed is active
  loads only visible fixed chunks and does not fall through to live OneMap
  tiles.
- Every production client rebuild must include all four values:
  `VITE_API_URL=https://api.carearound.sg/api`,
  `VITE_TOWN_MAP_PROOF_ENABLED=true`, the Default fixed-surface asset base, and
  the Gray fixed-surface asset base. The pending islandwide build should use
  `https://maps.carearound.sg/v1/islandwide` and
  `https://maps.carearound.sg/v1/islandwide/gray`. Omitting the town-map
  variables intentionally compiles the owner Map detail control out of the
  bundle and is now rollback-only behavior.
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
- Pending islandwide Detailed-map validation on
  `codex/islandwide-detailed-map` passed desktop and mobile fixture browser
  smoke using local islandwide assets: CCK/Yew Tee and Bedok focus transitions
  each rendered one visible fixed chunk, made zero OneMap tile requests after
  Detailed focus, and had zero failed requests, console entries, or page errors.
  Evidence is under `output/town-map-proof/islandwide-uat/`. Focused map
  coverage passed 48/48, broader locked map/list coverage passed 114/114, R2
  contract coverage passed 6/6, server coverage passed 449/449, and the
  production-configured islandwide client build passed with only the existing
  large-chunk advisory. Deploy is pending.

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
`a522111b-b161-419c-8e50-6eb0a4105976`.

Gemini collateral import is recovered on `gemini-3.1-flash-lite` from commit
`61e90a493`, with incomplete schedule recovery in `b014c4187`. Signed-in
production preview returned 26 schedules-ready rows and 0 schedule-review rows
from `TWV-July-Eng.jpeg`; production smoke passed 6/6, and no review rows were
saved.

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
