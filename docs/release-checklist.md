# CareAround SG Release Checklist

This is the pre-ship stabilization checklist for launch-safe changes.

## 1. Green baseline

- Run `npm run test:server`
- Expected result: `59/59` passing
- Run `npm run build:client`
- Expected result: production build succeeds
- Known note: the bundle-size warning should shrink once route-level code splitting is active, but the build itself must stay green

## 2. Browser smoke gate

Install the browser once on the machine that runs the smoke suite:

```bash
npm run test:smoke:install-browser
```

Set the required environment variables:

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

## 3. Full local verification

For local verification, run both app surfaces before the smoke suite:

```bash
npm run dev:server
npm run dev:client
```

Then run:

```bash
npm run verify:release
```

## 4. Deployed health check

Verify the API health endpoint returns OK:

```bash
curl https://senior-resource-map-api.joshuachua79.workers.dev/api/health
```

Expected response shape:

```json
{ "status": "ok", "timestamp": "..." }
```

## 5. Manual post-deploy checks

- Open the deployed app and confirm `/discover` renders
- Log in with a partner/admin account
- Open `/dashboard/resources`
- Open the postal import wizard and confirm search still returns results
- Confirm saved assets still appear on Discover and in My Directory
- Confirm a saved resource detail page opens correctly
- Confirm create-map still allows asset selection and map creation

## 6. Guardrail for post-launch cleanup

Do not do broad refactors before ship just because files are large. After launch, clean up in small slices behind this same checklist, starting with:

- `client/src/pages/dashboard/ResourcesPage.jsx`
- `client/src/components/AssetForm.jsx`
- `client/src/components/HardAssetImportWizard.jsx`
- `client/src/pages/dashboard/AdminPage.jsx`
- `client/src/pages/DiscoverPage.jsx`
