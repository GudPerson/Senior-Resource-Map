# Release Manifest: Map-only Website Embed V1

- Date: 2026-08-08
- Branch: `codex/map-only-embed-v1`
- Candidate base: `967cf183dd5edaf42d2cdc21b5c04cc5a1ed4b3c`
- Status: locally verified; commit, schema apply, push, deploy, and production
  UAT remain approval-gated.

## Release outcome

- An owner may enable the frozen Shared Map as a compact website iframe only
  after approving up to ten exact website origins.
- The iframe is guest-only and map-only. It excludes account, owner, editing,
  annotation, print/export, personal-place, private-note, private-file, and
  saved-profile surfaces.
- Disablement, origin removal, and unpublishing are live revocation controls.
- Ordinary app and Shared Map pages retain their existing anti-framing,
  visibility, copy/save, and frozen-snapshot contracts.

The complete product and failure-state contract is in
`docs/map-only-embed-v1-goal.md`. The locked reproduction and acceptance
evidence is in `docs/regression-ledger.md`.

## Release-line finding

At manifest preparation time:

- remote `main` is `9915de2a8ac924d101003d8506492529264fcfcf`;
- the candidate base is eight fast-forward commits ahead at `967cf183d`;
- those eight commits are the already-deployed annotation-transform and
  Detailed-map stabilization lineage recorded in the ledger; and
- `npm run deploy:server` requires a clean local `main` whose `HEAD` exactly
  matches `origin/main`.

A push to `main` may also start a Pages build. Therefore do not publish one
mixed server-and-client commit to `main` before the Worker is compatible.

## Required commit split

Prepare two consecutive commits on the candidate branch without changing the
already-validated combined tree.

### Commit A: compatible server and additive schema

Include only:

- `server/src/controllers/myMapsController.js`
- `server/src/controllers/sharedMapsController.js`
- `server/src/db/schema.js`
- `server/src/routes/myMaps.js`
- `server/src/routes/sharedMaps.js`
- `server/src/utils/boundarySchema.js`
- `server/src/utils/mapEmbed.js`
- `server/src/utils/mapEmbedSchema.js`
- `server/src/utils/myMapDirectory.js`
- `server/scripts/bootstrap_map_embed_schema.js`
- `server/package.json`
- `server/test/mapEmbed.test.js`
- `server/test/mapEmbedSchema.test.js`
- `server/test/myMapsController.test.js`
- `server/test/sharedMapsController.test.js`

This commit is backward compatible because both new columns default to
disabled/empty and the existing client does not call the new routes.

### Commit B: owner UI, map-only Pages route, and release evidence

Include the scoped client files and these documents:

- `docs/map-only-embed-v1-goal.md`
- `docs/release-manifest-2026-08-08-map-only-embed-v1.md`
- `docs/regression-ledger.md`
- `docs/session-handoff.md`

Do not stage any unrelated untracked file or prior output directory.

## Schema gate

The production database needs only these additive columns on `my_maps`:

- `embed_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `embed_allowed_origins JSONB NOT NULL DEFAULT '[]'::jsonb`

Production runtime schema bootstrap remains disabled. After confirming that
the configured target is the intended production database, apply the narrow,
idempotent two-column bootstrap before deploying Commit A's Worker:

```bash
npm run bootstrap:map-embed-schema --workspace=server
```

This command reuses the same two-column helper as the full boundary bootstrap,
then verifies both columns through `information_schema`. It does not execute
the rest of the boundary-schema catalogue.

Do not print, copy, rotate, or summarize database credentials.

## Deployment order

All steps below require the user's explicit release approval.

1. Create Commit A and Commit B on `codex/map-only-embed-v1`, then push the
   feature branch for a durable reviewed reference.
2. Apply the additive production schema from the reviewed candidate.
3. Fast-forward local `main` from `origin/main` to Commit A and push Commit A
   to `main`. This also reconciles the eight already-deployed stabilization
   commits without adding the embed client.
4. From clean synchronized `main` at Commit A, run `npm run deploy:server`.
5. Verify `https://api.carearound.sg/api/health` and both embed API failure
   states before publishing any client:
   - an unknown token returns unavailable;
   - an ordinary Shared Map with embedding disabled remains readable through
     its normal endpoint while its embed endpoints remain unavailable.
6. Fast-forward `main` to Commit B and push it only after Worker health passes.
7. Build and deploy Pages with the production API plus all six locked Detailed
   map asset roots through `npm run deploy:client`.
8. Verify immutable Pages artifacts and `https://app.carearound.sg` by MIME,
   bytes, and SHA-256 for HTML, entry JS, CSS, embed chunks, My Map, Shared Map,
   and map/export lazy chunks.
9. Run authenticated owner UAT on a disposable published map and clean it up.
10. Run approved and unapproved external-host iframe UAT, then record the
    Worker version, immutable Pages URL, custom-domain parity, and cleanup in
    the ledger and handoff.

## Production acceptance matrix

- Owner publishes a disposable map, adds an exact approved HTTPS origin,
  enables embedding, sees the 440/520-pixel preview, and copies the iframe.
- The approved external parent renders the 900x520 map with search, category
  filtering, pin/cluster interaction, resource preview, list-only disclosure,
  full-map links, and attribution.
- The same iframe on an unapproved parent is blocked by the exact
  `frame-ancestors` policy.
- A signed-in CareAround cookie does not change the iframe viewer or payload.
- Origin removal, embed disablement, and unpublishing each make the next embed
  document request fail closed without disabling the ordinary Shared Map where
  applicable.
- Republish rotates the token and leaves embedding disabled until explicitly
  re-enabled.
- Ordinary HTML retains `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- Embed HTML has its exact allowlist, no XFO, `Cache-Control: no-store`, disabled
  geolocation/camera/microphone/payment, and `noindex`.
- Core production smoke and the locked owner My Map, Shared Map, Print View,
  Detailed map, annotation, export, auth, and resource flows remain healthy.

## Current evidence

- Focused embed/client/server/header coverage: 96/96.
- Full client/source coverage: 572/572.
- Full server coverage: 517/517.
- Map-lockdown coverage: 84/84.
- Exact six-root production build: pass with only established advisories.
- Built-artifact approved-parent browser check: pass with zero console output.
- Built-artifact unapproved-parent check: blocked by exact CSP as expected.
- `git diff --check` and scoped secret/privacy scan: pass.
- Wrangler 4.120.0 Pages Function compilation: pass; generated routes include
  only `/embed/maps/*`, and the bundle contains the config fetch, exact CSP,
  asset binding, and fail-closed handler.
- Fresh rollback baseline: production API health returned `status: ok`;
  `https://app.carearound.sg` HTML was byte-identical to accepted immutable
  deployment `https://6ee1710f.senior-resource-map.pages.dev` at SHA-256
  `42fb3394e86e29871a61d703e648d841474dff25b7e2ab1f86432ce18aefa243`.
  The live shell referenced `assets/index-Dk78yPIY.js` and
  `assets/index-BltMdYHn.css` with correct JavaScript/CSS MIME, and ordinary
  HTML retained `frame-ancestors 'none'` plus `X-Frame-Options: DENY`.

## Rollback

1. Roll back Pages first to the previous verified immutable deployment. The
   previous global anti-framing response makes existing website embeds
   unavailable without exposing private data.
2. If required, redeploy the previous verified Worker after Pages rollback.
   If the Worker is rolled back first during an incident, the embed Function
   still fails closed because its configuration endpoint is unavailable.
3. Keep the two additive database columns. Do not drop them during rollback;
   older Workers ignore them and their defaults remain safe.
4. Disable and clean up the disposable production UAT embed/map if it still
   exists. Do not mutate ordinary user maps.

No R2 object, map asset root, authentication secret, authorization policy,
email/GudAuth setting, or existing Shared Map snapshot requires migration or
rollback for this release.
