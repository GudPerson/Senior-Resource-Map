# CareAround SG Release Checklist

This checklist is the pre-ship gate for launch-safe changes. Use it together with `docs/regression-ledger.md`; the ledger is the source of truth for locked surfaces and behavior-specific acceptance criteria.

Last refreshed: 2026-05-28 (Asia/Singapore)

## Current Stabilization Scope

The regression ledger currently treats these areas as locked or stabilized:

- Discover
- Auth session continuity
- Auth transition handoff
- My Directory saved assets
- Private Maps interactive
- Private Maps print/export
- My Map resource notes
- Shared maps
- Dashboard resources/admin
- Workbook import/export
- Subregion boundary upload
- SG postal fallback for place writes
- Hard asset boundary visibility
- Asset create/edit forms
- Resource detail contact/social links
- AI enrichment
- Import Material refresh saves
- Restricted resource notes/files
- Pilot governance foundation
- Direct hard-asset access and local audience zones
- Secure multilingual foundation
- Client route recovery
- Phone identity uniqueness
- WhatsApp phone login and signup

Current restart family in the ledger:

- State reset, green baseline verification, and then a deliberate next-feature choice.

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

For local browser verification, run both app surfaces:

```bash
npm run dev:server
npm run dev:client
```

Then run the release aggregate:

```bash
npm run verify:release
```

`verify:release` currently runs:

- `npm run test:server`
- `npm run build:client`
- `npm run test:smoke`

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

## 6. Deployed Health Check

Verify the API health endpoint returns OK:

```bash
curl https://senior-resource-map-api.joshuachua79.workers.dev/api/health
```

Expected response shape:

```json
{ "status": "ok", "timestamp": "..." }
```

## 7. Manual Post-Deploy Checks

After a deploy, manually verify the affected flow plus these core routes:

- open the deployed app and confirm `/discover` renders
- log in with a partner/admin account
- open `/dashboard/resources`
- open the postal import wizard and confirm search still returns results
- confirm saved assets still appear on Discover and in My Directory
- confirm a saved resource detail page opens correctly
- confirm create-map still allows asset selection and map creation

## 8. Guardrail For Cleanup

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
