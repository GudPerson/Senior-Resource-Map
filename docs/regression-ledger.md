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
| Auth session continuity | Locked after the 2026-05-16 hotfix so session validation stays on the cookie-owning API origin and successful sign-ins clear stale WhatsApp attempt state | Commit `9cb61909` + production app bundle `assets/index-dHYmeiP9.js` + 2026-05-16 user confirmation that login stopped looping | Sign in with email, Google, and WhatsApp where available; navigate `/discover`, `/my-directory`, `/dashboard/resources`, `/dashboard/admin`, and `/dashboard/profile`; leave the tab idle, refocus it, refresh, and repeat after a deploy | Session checks for `/auth/me` never fall through to an origin that cannot receive the session cookie; transient primary session-check failures preserve the current signed-in user; definitive invalid/missing-token responses still sign the user out; successful sign-in clears stale stored WhatsApp login attempts; saved assets, dashboard resources, and admin counts do not drop to zero because auth state was falsely cleared | 2026-05-16 |
| Auth transition handoff | Added explicit `/auth/transition` loading screen after successful auth to avoid transient return-to-login flicker; transition route can surface announcements/tips before dashboard handoff; WhatsApp auth now includes a same-device-number preflight confirmation and delayed recovery guidance | Commit `4e06af1d` (initial handoff) + `fae8b9b5` (register-mode copy, transition guard) + `9e52c7fe` (register-mode footer handoff link) + current auth polish commits (no-login-paint redirect, sample-number cleanup, auth-in-progress overlay, and WhatsApp preflight/recovery UX) + user verification in local `/login` and `/register` flows | Sign in with a regular account via email, Google, or WhatsApp, then observe post-submit route behavior before and after membership-token returns; start flow from both `Sign in` and `Register` tabs and confirm `/auth/transition` displays loading UI and continues to destination; confirm Google click/email submit shows the handoff while auth is in progress; confirm WhatsApp verified state moves into handoff before dashboard; confirm WhatsApp start stays disabled until the same-device checkbox is acknowledged and pending state shows recovery guidance after delay | Users should always see a dedicated loading handoff screen after auth starts or completes, not `/login` unless user intentionally navigates there or auth fails; WhatsApp sign-in/register requires confirming this device is logged into WhatsApp with the entered number; pending WhatsApp attempts help users recover with open-again, try-another-number, and Google/email options; Register tab offers WhatsApp registration entrypoint; WhatsApp sample numbers use `87654321` instead of a real personal number | 2026-05-16 |
| My Directory saved assets | Recovered and locked on stabilization branch | User-approved stabilization branch behavior | Load `/my-directory`, test search, scope, select-all, remove-selected | Saved cards render, filters work, bulk actions stable | 2026-04-22 |
| Private Maps interactive | Recovered and locked on stabilization branch | `efc03d82`, related private-map commits | Create/open `/my-directory/maps/:id`, test hover, cluster click, selection | Hover linking, cluster zoom/spiderfy, card↔pin sync stable | 2026-04-22 |
| Private Maps print/export | Recovered and locked on stabilization branch; print card links and map interactivity retested locally; hidden export surface moved off-screen after it was found overlapping live map hit-testing; print header copy wraps without truncating | `865461f4`, `940cc182` + user-approved stabilization layout pass | Open `?view=print`, test layout, grouped asset detail links, pin/cluster hover, top-edge pin hover, cluster click zoom/spiderfy, map reset, Save as image, header title/description wrapping, distance-anchor note placement, and `elementFromPoint` on visible marker centers | Wide layout, QR present, map name is not truncated, description wraps before QR area, distance anchor note sits just above map, grouped print entries navigate to detail pages, hover highlights matching card(s) with orange ring, top-edge pins remain responsive, cluster click expands, reset restores full map, export clone does not intercept marker hit-testing, capture succeeds, print preview matches approved baseline | 2026-04-25 |
| Shared maps | Recovered and locked on stabilization branch; mobile shared-map cluster taps retested after the 2026-05-18 regression where touch users needed a quick double tap to explode clusters | User-approved stabilization branch behavior + 2026-05-18 mobile cluster smoke | Open shared directory as guest/logged-in user, test copy/save flows, map notes, receiver-side note translation, and mobile cluster tap sequence | Shared view loads, copy/save behavior correct; shared note translations follow receiver language selection; mobile cluster taps split immediately without a center-only pause; large clusters split to the next visible cluster layer, and 2/3-resource clusters uncluster on the next tap when their resources fit in the map window | 2026-05-18 |
| Dashboard resources/admin | Recovered and locked on stabilization branch; punctuation-normalized resource search retested locally | User-approved stabilization branch behavior | Load `/dashboard/resources` and `/dashboard/admin`, test search, counts, export | Search stable, counts consistent, filtered workbook export works, admin search does not reload on every letter, names with parentheses remain searchable | 2026-04-25 |
| Workbook import/export | Recovered and locked on stabilization branch; local full/filtered exports and import reports revalidated | Local verification artifacts in `output/workbook-local-2026-04-25T05-42-07-819Z` | Run places export/import, standalone offering import, template import, rollout import, filtered workbook flows, error-report flows; re-open exported `.xlsx` files with `openpyxl` | No timeout/subrequest regressions; reports accurate; filtered/full export formats round-trip safely; `.xlsx` files include `Guide`, `Data`, and `Reference` sheets | 2026-04-25 |
| Subregion boundary upload | Guarded so boundary CSV upload adds to existing boundaries by default; replace remains explicit and warning-gated; large range CSVs are batched before hitting server row limits | User report on 2026-05-12 with `Clustered_SG_Postal_Codes copy.csv` and production alert showing 5,000-row rejection plus prior wipe-out from replace behavior | Open `/dashboard/admin` > Subregions, upload a boundary CSV with `subregion!D` + `Running_Range`, then test adding a small one-code CSV to an existing subregion | Upload defaults to Add mode; existing postal codes are preserved unless Replace is explicitly chosen; files over 5,000 source rows are split client-side; Replace mode is blocked for multi-batch files to avoid partial deletion; UI explains add vs replace clearly | 2026-05-12 |
| SG postal fallback for place writes | Added Phase 1 fallback so Super Admins and actors scoped to `Singapore / SIN` can create/import SG places even when a valid OneMap postal code is not yet in exact Region boundary rows; exact Region boundaries stay untouched and the validated code is cached into `subregion_postal_codes` | 2026-05-18 SG boundary repair after valid codes `822211`, `821264`, `762317`, `730887`, `670454`, and `543279` were missing from the configured SG Region | Create or import a place with a Singapore postal code that has no exact Region row, with OneMap returning an exact `POSTAL` match; also try a non-SG country and a mismatched OneMap result | Valid SG postal codes fall back to `Singapore / SIN`, cache with `ON CONFLICT DO NOTHING`, and reuse OneMap coordinates for the write; invalid/mismatched OneMap results remain rejected; non-SG countries do not use the SG fallback; normal overlapping/exact Region matches continue to win first | 2026-05-18 |
| Hard asset boundary visibility | Locked the corrected Phase 2 model: Region boundaries must not hide hard assets from users or admins; boundaries remain metadata/governance inputs and are used for soft-asset targeting/visibility, not place visibility | 2026-05-18 clarification that hard assets are visible places while boundaries primarily help owners/staff/admins target soft assets to public users | Open Discover and dashboard resources as users/admins with different Region scopes; search for hard assets outside the account's Region; also check hidden direct assignments | Visible hard assets remain visible regardless of Region boundary; hidden hard assets only appear in managed views for Super Admins or direct hard-asset Owner/Staff; soft assets still respect region/audience targeting rules | 2026-05-18 |
| Asset create/edit forms | Recovered and locked on stabilization branch; place create, inline place edit, offering create/edit, template create/edit, and rollout edit checked locally | Local browser verification on `/dashboard/resources` with current `server/.env` API | Open place/offering/template forms and edit existing assets | No blank screens; hard-place inline edit renders expected fields; modal create/edit flows render expected fields; rollout editor opens inherited/local sections | 2026-04-25 |
| Resource detail contact/social links | Restored after regression where early-stage social media links disappeared from hard-asset detail cards; hard assets now persist `social_links`, dashboard/import/enrichment flows preserve supported channels, and resource details render website plus supported social channels without exposing private data | April 2026 archived CareAround implementation with `hard_assets.social_links`, social link helpers, import extraction, asset-form editing, and detail-card rendering | Create or edit a hard asset with Facebook/Instagram/TikTok/YouTube/LinkedIn links, open its resource detail card from Discover or dashboard, and test a social URL accidentally entered in Website | Supported social URLs are normalized and shown as Social channels; ordinary websites still render as Website; social-only website values are split into social channels instead of broken website links; unsupported domains are ignored; server schema bootstrap includes `hard_assets.social_links` before production deploy | 2026-05-18 |
| AI enrichment | Recovered and locked for credentialed flows; Vertex Search grounding no longer uses controlled-generation schema/JSON mode, tags-only enrichment falls through to a deeper grounded pass, social links are preserved, and Google Maps preview/static-map or generic service carousel images are not accepted ahead of organization logos | Live Worker API `https://senior-resource-map-api.joshuachua79.workers.dev/api` with configured `VERTEX_AI_*` and `GOOGLE_MAPS_API_KEY` secrets; 2026-05-19 local live probe for `Precious Active Ageing Centre (Sunshine Gardens)`; 2026-05-20 local live probe for `New Life Community Services Active Ageing Centre (Care) @Jelapang` | Fill a place draft name, postal code, and address; call `/hard-assets/import/enrich-draft`; call `/hard-assets/import/google-candidates` with `enrich: true`; preview selected Google candidates | Button enables only with required draft fields; unconfigured/empty enrichment response gives visible feedback instead of silently doing nothing; live Vertex returns grounded website, phone, hours, descriptions, service tags, source titles, confidence, and supported social links where findable; manual enrich and Google preview return validated logo URLs only when the source/website exposes a usable image, preferring organization logo filenames over service carousel/award images | 2026-05-20 |
| Partner-only detail content | Added protected notes/files surface for places and offerings; private content is fetched through dedicated authenticated APIs and excluded from public resource/map snapshots; partner file viewing renders image/PDF previews inline instead of showing a download-only row | `codex/partner-private-detail` implementation + automated verification | Open/edit a place or offering as an authorised partner/admin, add notes/files/access grants, then open detail as owner, granted partner, standard user, and guest | Owner-chain editors can manage notes/files/access; granted partners can view only; unauthorised users see nothing; PDF/image previews pass through permission-checked route; public saved-map/shared-map snapshots do not include private fields | 2026-04-30 |
| Direct hard-asset access and local audience zones | Added direct Owner/Staff memberships for hard assets, asset-scoped staff APIs, dashboard Access/Zones panels, direct Staff edit rights for assigned places and hosted/linked offerings, local audience-zone use with Region/Super approval for global sharing, and guardrails so asset Staff do not inherit workbook admin exports or hard-asset hide/delete rights | 2026-05-15 asset-access architecture UAT | Assign Owner/Staff to a place, sign in as Staff, edit the place, linked offering, and partner-only content, then confirm hide/delete and admin workbook export are denied; sign in as Owner, add/remove Staff and create a local zone; sign in as Region Admin to assign Owners and approve/share zones | Direct asset access replaces new partner-owner assignment flows while legacy partner-owned reads remain; standard users still need explicit asset assignment for dashboard Resources; Owner can manage Staff but not Owners; Staff can edit assigned asset surfaces but cannot manage access, hide, or delete hard assets; production schema requires explicit bootstrap or migration before deploy | 2026-05-15 |
| Secure multilingual foundation | Added security headers/rate limits, request body guardrails, route-level JSON schema validation, admin/import payload guards, resource translation persistence, Google Translation trigger hooks, checklist-style partner/admin translation review, user-facing locale fallback, and access-control/privacy regression coverage | `codex/secure-multilingual-foundation` implementation + `codex/security-foundation` hardening passes | Save/edit place, offering, template, and child offering; open dashboard translation review; switch locale in nav; load resource cards/details; inspect API/static headers; submit malformed/oversized/invalid-shape API payloads; submit malformed admin/import JSON for audience zones, subregions, partner boundaries, and filtered workbook export; test standard-user access against partner-only, translation-review, and admin export APIs | English remains canonical; Mandarin/Malay/Tamil rows persist when translation is configured; translation review summarizes ready/missing/needs-review states in layman wording; reviewed machine translations become Ready; staff-edited translations become Needs review instead of being overwritten when English changes; stale/missing translations fall back to English; public snapshots exclude private data; public translation payloads keep translated text and stale fallback hints without review/source metadata; CSP/HSTS/nosniff/frame/referrer headers present; rate limits block repeated high-risk requests; malformed, oversized, invalid-shape, and nested-cell JSON requests fail cleanly before sensitive handlers continue while normal spreadsheet-style scalar rows remain supported | 2026-05-02 |
| Client route recovery | Added route-level error boundary after intermittent blank-page reports during client-side navigation from dashboard to lazy-loaded routes such as My Directory; likely stale or failed route chunk after app/deploy update | `codex/client-route-recovery` implementation | Navigate between `/dashboard`, `/dashboard/admin`, `/dashboard/resources`, `/my-directory`, and `/discover`; keep a tab open across deploys where possible | Lazy route load failures auto-refresh once for the current path; repeated route failures show a recovery card instead of a blank page; normal route loading still shows the existing loading state | 2026-05-05 |
| Phone identity uniqueness | Phase 1 added a Singapore account-phone normalizer; Phase 2A adds a separate `user_phone_identities` table with active-only uniqueness and a read-only duplicate audit, while current login/session behavior and existing `users.phone` values remain unchanged | `codex/phone-normalization-phase1` + `codex/phone-identity-phase2a` implementation | Run focused phone normalization and phone identity schema/audit tests; run session/auth regression tests before any future phone-login wiring; review duplicate `users.phone` groups before any legacy backfill | Singapore account identity phones normalize to E.164 (`+65...`) consistently; blank/invalid values fail safely; one active `phone_e164` maps to at most one user; one user has at most one active phone identity in V1; future WhatsApp/GudAuth account lookup must use `user_phone_identities.phone_e164`, not raw `users.phone`; no GudAuth login or production backfill is enabled yet | 2026-05-06 |
| WhatsApp phone login and signup | Phone login uses GudAuth verification plus active verified phone identities; unknown verified phones enter a guided standard-user signup flow; return links recover in-progress attempts even if the login marker is stripped from the URL; mobile and tablet launch uses the native WhatsApp app URL instead of stopping on the web `Open app` interstitial, with a larger interim loader on coarse-pointer screens and an interim-page self-redirect plus fallback button once the code is ready; phone-first account creation requires a soft acknowledgement that it may create a separate account; phone-first users can add a real recovery email/password from Profile before unlinking WhatsApp | `codex/phone-login-phase4a` implementation + `80e6820c` mobile launch behavior | Start WhatsApp sign-in from `/login` on desktop, Android, iPhone, and tablet widths; confirm the prepared code opens in WhatsApp on mobile/tablet without remaining stuck on the interim loader or requiring the WhatsApp web interstitial; send the prefilled WhatsApp code; click the GudAuth return link; test both an existing verified phone and a new phone that has no CareAround account; create a phone-first account, add a recovery email/password in Profile, and then unlink WhatsApp | Browser calls only CareAround `/api` routes; raw `users.phone` is not trusted for login; legacy/unverified/revoked identities cannot log in; exactly one active verified identity creates a normal session; unknown verified phones ask for display name and optional postal code before creating a standard user; phone-first account creation is disabled until the separate-account acknowledgement is checked; placeholder phone-only email is hidden as `No email added`; stored attempts resume after WhatsApp return without needing a manual refresh or check button; mobile/tablet launch URLs prefer `whatsapp://send` with the generated code while desktop keeps the web WhatsApp URL; if automatic app launch is blocked, the interim page exposes a large direct `Open WhatsApp` fallback; unlinking WhatsApp is blocked while the account still has a phone-only placeholder email, and succeeds only after a real recovery email/password is saved | 2026-05-13 |

## Recent stabilization notes

### 2026-05-20 AI enrichment logo selection recovery

- Current behavior: website logo metadata now treats separators like `_` as valid logo filename boundaries, so organization logo files such as `LOGO_NLCS...` and `NLCS-Logo...` win over generic service carousel or award images.
- Known-good reference: local live `/api/hard-assets/import/enrich-draft` probe for `New Life Community Services Active Ageing Centre (Care) @Jelapang` returned the New Life organization logo path instead of the charity transparency award carousel graphic.
- Reproduction steps: enrich a place draft with name `New Life Community Services Active Ageing Centre (Care) @Jelapang`, postal code `670526`, and category `Active Ageing Centre (AAC)`; check that the logo does not use `Homepage_Carousel_CC-01.png`.
- Acceptance criteria: website metadata prefers organization logo filenames and site/header/nav logo hints; lower-confidence service/programme/carousel/award/certification images remain fallback-only; AI enrichment still returns the other grounded fields.
- Verification result: `node --test server/test/websiteMetadata.test.js` passed 4/4, focused enrichment suite passed 17/17, and local live New Life probe returned website, phone, hours, description, social links, and the organization logo path on 2026-05-20.

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

### 2026-05-16 Production database source reconciliation

- Current behavior: repo-local database checks must use the same Neon database that serves `api.carearound.sg`; otherwise phone/login cleanup can appear correct locally while production still contains different users, attempts, and resource rows.
- Known-good reference: production `/api/hard-assets` and the confirmed live database both list `Fei Yue Active Ageing Centre (Sunshine Court)` as the newest hard asset, and the live database contains the recent WhatsApp login attempt sequence.
- Reproduction steps: run `npm run audit:db-fingerprint` and compare the non-secret counts/top hard assets against a fresh production `/api/hard-assets` response before any production data cleanup.
- Acceptance criteria: `server/.env` points at the confirmed live database; tracked scripts/config files do not contain database connection strings; future cleanup scripts print only non-secret database fingerprints/counts before mutating data.
- Verification result: local `server/.env` was reconciled to the confirmed live database on 2026-05-16, `server/migrate_regions.js` was changed to read `DATABASE_URL` from env, and Drizzle config was moved to env-backed `server/drizzle.config.js`.

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
