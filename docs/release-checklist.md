# CareAround SG Release Checklist

This checklist is the pre-ship gate for launch-safe changes. Use it together with `docs/regression-ledger.md`; the ledger is the source of truth for locked surfaces and behavior-specific acceptance criteria.

Last refreshed: 2026-06-08 (Asia/Singapore)

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

- Organisation governance / Admin Region Scope stabilization
- Resource delete audit idempotency
- Shared confirmation dialog consistency
- Admin inline feedback consistency
- Discover location badge responsiveness

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
