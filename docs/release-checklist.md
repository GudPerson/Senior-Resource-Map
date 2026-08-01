# CareAround SG Release Checklist

This checklist is the pre-ship gate for launch-safe changes. Use it together with `docs/regression-ledger.md`; the ledger is the source of truth for locked surfaces and behavior-specific acceptance criteria.

Last refreshed: 2026-08-01 (Asia/Singapore)

## When To Use This Checklist

Use this checklist before any push/deploy that could affect the live app, Cloudflare Pages, Cloudflare Worker API, database schema, public visibility, auth/session behavior, Discover, My Directory/My Maps, dashboard resources, admin tools, imports, or access-control behavior.

For documentation-only demo-prep work, runtime tests are not required. Run `git diff --check`, inspect the changed docs for accidental secrets, and keep local documentation commits unpushed before the live demo unless the user explicitly asks to publish them. A push to `main` may trigger Cloudflare Pages production deployment.

## Current Stabilization Scope

The regression ledger currently treats these areas as locked or stabilized:

- Discover
- Discover location badges and temporary location context
- My Directory saved assets
- Private Maps interactive
- Private Maps print/export
- Shared maps
- Dashboard resources/admin
- Care Calendar
- Workbook import/export
- Asset create/edit forms
- AI enrichment
- Restricted notes/files and protected resource detail content
- Direct resource Owner/Staff access, Asset Access, and Audience Zones
- Organisation governance, Org Groups, and Region Groups
- Admin Region Scope and Support Coverage
- Shared confirmation dialog and inline feedback patterns
- Audit Trail behavior for governance/resource changes
- Secure multilingual foundation
- Client route recovery
- Phone identity uniqueness
- WhatsApp phone login and signup
- Subregion boundary upload

Recent release families in the ledger include:

- Owner My Map / Print View Detailed map stability
- Owner Print View PNG/PDF export simplification
- Organisation governance / Admin Region Scope stabilization
- Resource delete audit idempotency
- Shared confirmation dialog consistency
- Admin inline feedback consistency
- Discover location badge responsiveness
- Care Calendar planning views and schedule update review

Before release work, review the relevant row in `docs/regression-ledger.md` for reproduction steps, known-good references, acceptance criteria, and any deploy gates.

## 1. Green Baseline

Run:

```bash
npm run test:server
npm run build:client
```

Expected result:

- server tests complete successfully
- client production build completes successfully
- non-fatal bundle-size warnings may be reviewed, but they do not block unless they indicate a new functional regression

Do not rely on an old hard-coded test count. The suite has grown over time, so use pass/fail status from the current run.

For client deploys, the Pages build must have the same-site Worker API configured:

```bash
VITE_API_URL=https://api.carearound.sg/api npm run build:client
```

The deploy script validates this before publishing.

While the owner Detailed fixed-surface map is active in production, every
client build must also keep its build-time activation and all versioned asset
bases. The islandwide release line should use these exact roots:

```bash
VITE_API_URL=https://api.carearound.sg/api \
VITE_TOWN_MAP_PROOF_ENABLED=true \
VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/default \
VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/gray \
VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED=true \
VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL=https://maps.carearound.sg/v3/zoom14-atlas-20260730/default \
VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL=https://maps.carearound.sg/v3/zoom14-atlas-20260730/gray \
VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL=https://maps.carearound.sg/v2/print-master-100-20260723/default \
VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL=https://maps.carearound.sg/v2/print-master-100-20260723/gray \
npm run build:client
```

Omitting the interactive `VITE_TOWN_MAP_*` values intentionally compiles Map
detail out of the owner client. The two zoom-14 atlas roots extend Detailed one
displayed zoom step without replacing the established zoom-15 native roots.
The two print-master roots remain retained build-contract roots; the current
stable UX does not expose a Print Master button. Omitting any of the six map
roots is a rollback or dormant-contract change, not the normal production
build, and `npm run deploy:client` rejects omission.
For immediate asset rollback, rebuild with the retained islandwide v1 roots
`/v1/islandwide` and `/v1/islandwide/gray` and set
`VITE_ALLOW_TOWN_MAP_ROLLBACK=true`. The older W01-only roots `/v1/w01` and
`/v1/w01/gray` remain the narrower emergency fallback. Record either rollback
in `docs/regression-ledger.md`.

### Owner map lockdown gate

Before any deploy that touches `DirectoryMap`, fixed-town surfaces, owner My
Map, map settings, owner Print View, map export, or map-related build
configuration:

```bash
node --test client/test/fixedTownSurface.test.js \
  client/test/fixedTownSurfaceIntegration.test.js \
  client/test/mapSettingsControl.test.js \
  client/test/printMapWorkspace.test.js
```

Then run the exact six-root production client build above.

After any Pages deploy, verify the custom-domain bundle, not only the Pages
preview. The deployed bundle must preserve:

- v2 native-scale Default and Gray roots;
- v3 zoom-14 atlas Default and Gray roots;
- retained print-master roots;
- `resize moveend zoomend` containment;
- `The regular map is still shown.`;
- `Save PDF`;
- no `Standard map is still on`;
- no `Save A3 PDF`;
- no visible Print Master action.

If any of those markers drift, stop and fix before continuing with unrelated
work. The local stable reference is tag `map-stable-2026-07-23` at
`97118d4919cda77f1be581b0489eaf327e2ef098`.

### High-Detail Town Maps download-library gate

The authenticated download library is separate from the interactive Detailed
map and its personalised Print View exports. For any release that touches
`/my-directory/town-maps` or its publishing scripts:

```bash
npm run test:town-map-downloads
npm run town-map:r2:test
npm run town-map:downloads:r2:plan
npm run verify:map-lockdown
```

The approved immutable publication root is
`v4/town-map-downloads-20260801-r2/default`. The upload plan must contain exactly
32 PNGs, 32 PDFs, 32 thumbnails, two supporting metadata objects, and one
catalogue. Do not run `npm run town-map:downloads:r2:upload` without the user's
explicit release approval. The uploader must prove the entire prefix is vacant
before writing, repeat the object-specific vacancy check before every PUT
attempt, never overwrite or delete an object, prove the C08 PNG with a
query-free exact public download before continuing, publish the remaining
binaries and thumbnails before metadata, and publish `catalogue.json` last. If
an apply run is interrupted, use a newly approved immutable prefix instead of resuming the
partial root.

After publication, run the full remote verifier:

```bash
npm run town-map:downloads:r2:verify:full
```

Publication evidence on 2026-08-02: the approved root published all 99 objects
with the catalogue last; the full verifier passed 99 object HEAD checks, 98
non-catalogue hashes, all 32 thumbnail hashes, all 64 PNG/PDF hashes, and all 32
PDF range checks. Do not rerun the uploader against this occupied immutable
root.

It must verify all object sizes, hashes, MIME types, cache policy, read-only
CareAround CORS, reliable download filenames, and PDF byte-range responses.
Then deploy the client with the unchanged six-root interactive-map environment
above. Authenticated desktop and mobile UAT must confirm that the library loads
only its small catalogue and visible thumbnails until a download is chosen,
and that visiting My Map fetches none of this download collection. Do not add
the binary collection to Git, the client bundle, the Worker, the service worker,
or PWA precache.

## 2. Browser Smoke Gate

Install the browser once on the machine that runs the smoke suite:

```bash
npm run test:smoke:install-browser
```

Set the required environment variables without printing real credentials:

```bash
export SMOKE_BASE_URL="http://127.0.0.1:5173"
export SMOKE_PARTNER_USERNAME="your-partner-username"
export SMOKE_PARTNER_PASSWORD="your-partner-password"
```

Optional overrides:

```bash
export SMOKE_POSTAL_CODE="680153"
export SMOKE_POSTAL_KEYWORD="active ageing"
export SMOKE_API_BASE="http://127.0.0.1:5173/api"
```

For production smoke, use:

```bash
export SMOKE_BASE_URL="https://app.carearound.sg"
export SMOKE_API_BASE="https://api.carearound.sg/api"
```

Do not print, paste, commit, or summarize smoke usernames/passwords.

Run:

```bash
npm run test:smoke
```

The smoke suite covers:

- public `/discover` load
- partner login
- `/dashboard/resources` load
- postal import wizard search and draft-open flow
- create-map asset selection and submit path
- saved resource detail open path

## 3. Full Local Verification

For a new feature that adds or changes boundary-schema tables or columns,
prepare the configured UAT database explicitly before starting the app:

```bash
npm run uat:local:prepare
```

This command is idempotent but database-mutating. Run it only when the
configured `server/.env` database is the intended UAT target. Normal local
server startup never applies schema changes implicitly.

For local browser verification, run both app surfaces in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

`dev:server` overrides only the local Worker `NODE_ENV` to `development`.
This keeps localhost session cookies usable and activates the existing
development JWT fallback without adding a local secret or changing the
production Worker configuration. The Vite development client also retires
stale CareAround service workers and caches on localhost so an older
production bundle cannot intercept local navigation or send sign-in to the
production API. Before handing off a UAT link, verify:

The default `dev:client` command includes the same four Detailed-map asset
families as the production build, so owner My Map and Print View UAT cannot
silently compile Detailed out. For localhost only, those roots use the
same-origin `/__carearound-town-maps` Vite proxy because the public map asset
host does not currently return a browser CORS header for manifest requests.
Production builds keep the direct versioned `https://maps.carearound.sg`
roots. `dev:client:without-detailed-map` is available only for an explicit
fallback or isolation check; do not use it for normal UAT.

For any enhancement that touches My Map, `DirectoryMap`, Print View, map
settings, export, or their presentation pipeline, run the combined gate:

```bash
npm run verify:map-lockdown
```

```bash
curl http://localhost:8787/api/health
curl -I http://localhost:5173/login
```

Then sign in and confirm the affected authenticated route loads without a
`JWT_SECRET is required in production`, missing-relation error, or a cached
production client bundle. At owner Print View zoom 15, confirm Detailed chunks
replace the OneMap tile surface, attribution remains present, and Default/Gray
plus map-frame resize keep Detailed active. A local map that reports Detailed
as unavailable must also be checked for a successful same-origin
`/__carearound-town-maps/.../manifest.json` response before product map code is
changed.

For Print annotation changes, first choose the desktop `Full map` layout.
Exercise the pin, line, rectangle, circle, and polygon tools; confirm each tool
shows a contextual helper and can be completed or cancelled explicitly. Check
`Undo last point`, in-shape notes, custom shape and font colours, font size,
and backward/forward layer ordering. Confirm input and slider changes do not
trigger a save on every movement, reload to verify persistence, and verify
PNG/PDF parity. Switch to Balanced and Side map and confirm the same saved
annotations remain visible while the editing toolbar stays Full-only. Returning
to Balanced after Side map must restore its one-column resource layout.
Standalone text, arrow, freehand/lasso, and road-snap tools are intentionally
unsupported.

Then run the release aggregate:

```bash
npm run verify:release
```

`verify:release` currently runs:

- `npm run test:server`
- `npm run build:client`
- `npm run test:smoke`

If smoke credentials are unavailable, do not pretend the smoke gate passed. Record the missing credential constraint and run the narrower checks that do not need secrets, such as API health, public Discover load, and behavior-specific unauthenticated probes.

## 4. Behavior-Specific Checks

For any touched locked surface:

1. Open the matching row in `docs/regression-ledger.md`.
2. Reproduce or inspect the behavior described there.
3. Compare against the known-good reference when practical.
4. Record new evidence in the ledger if the behavior was recovered, stabilized, or changed.

Do not deploy a stabilization fix until the relevant ledger row has been reviewed and the required validation has passed.

## 5. Schema Deployment Gate

For changes that touch `server/src/db/schema.js` or `server/src/utils/boundarySchema.js`, apply the explicit schema bootstrap to the intended Neon database before deploying the Worker:

```bash
npm run bootstrap:boundary-schema --workspace=server
```

Production runtime schema bootstrap remains disabled by default. Do not rely on normal API traffic to create new tables, columns, or indexes.

## 6. Deploy Commands

Deploy the Worker API only after server/data validation passes:

```bash
npm run deploy:server
```

The Worker deploy command enforces the production release line before Wrangler runs. It fetches `origin/main` and requires:

- the current branch to be `main`
- local `HEAD` to match `origin/main`
- no uncommitted tracked-file changes

Do not deploy the production Worker from a feature branch. Merge and push the validated change to `main` first; any future branch previews must use a distinct Worker environment and route.

Deploy the Cloudflare Pages client only after the client build and relevant smoke/behavior checks pass:

```bash
VITE_API_URL=https://api.carearound.sg/api npm run deploy:client
```

Keep Worker and Pages deploy evidence separate in the release note. Record Worker versions, Pages preview URLs, custom-domain bundle names, and any smoke constraints.

## 7. Deployed Health Check

Verify the API health endpoint returns OK:

```bash
curl https://api.carearound.sg/api/health
```

Expected response shape:

```json
{ "status": "ok", "timestamp": "..." }
```

The older Workers.dev API URL may still be useful for fallback investigation, but the custom API domain is the production source of truth.

## 8. Manual Post-Deploy Checks

After a deploy, manually verify the affected flow plus these core routes:

- open the deployed app and confirm `/discover` renders
- log in with a partner/admin account
- open `/dashboard/resources`
- open the postal import wizard and confirm search still returns results
- confirm saved resources still appear on Discover and in My Directory
- confirm a saved resource detail page opens correctly
- confirm create-map still allows resource selection and map creation
- for Discover/location work, confirm badge appearance is display-only and does not change ranking, filtering, visibility, saved-map behavior, or the distance pill
- for Organisation/Admin work, confirm Organisation access, Org Groups, Region Groups, Admin Region Scope, and Resource Owner/Staff access remain separate

## 9. Guardrail For Cleanup

Do not do broad refactors before ship just because files are large. After launch, clean up in small slices behind this same checklist, starting with:

- `client/src/pages/dashboard/ResourcesPage.jsx`
- `client/src/components/AssetForm.jsx`
- `client/src/components/HardAssetImportWizard.jsx`
- `client/src/pages/dashboard/AdminPage.jsx`
- `client/src/pages/DiscoverPage.jsx`

For documentation-only cleanup, runtime tests are not required, but run:

```bash
git diff --check
```

Also scan the changed docs for accidental secrets or raw credential material before committing.

## 10. Parked Security Findings

The 5 review findings remain KIV until after the live production demo unless the user explicitly reopens them:

1. Auth rate limiting can be bypassed if a caller rotates arbitrary `X-Session-Token` values.
2. Cookie-authenticated My Maps share creation needs a CSRF/origin guard.
3. Public resource payloads expose more internal eligibility/governance metadata than public users need.
4. Session JWTs carry more personal/access data than necessary.
5. Dependency advisories need narrow triage and upgrades or mitigations.

After the demo, fix one item at a time with focused tests, regression-ledger evidence, and this release checklist before deploying.
