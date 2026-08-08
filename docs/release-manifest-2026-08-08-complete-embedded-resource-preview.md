# Release Manifest: Complete Embedded-resource Preview

- Date: 2026-08-08
- Branch: `codex/map-only-embed-v1`
- Status: validated local release candidate; production identifiers pending.

## Intended outcome

- A selected embedded-map Place shows one complete identity block: resource
  logo/fallback, name, and address.
- Optional operating hours or schedule, website, visible tap-to-call number,
  supported social-channel icons, and `Open resource` appear without duplicate
  identity content.
- A compact pill shows the number of deduplicated linked or hosted Programmes
  and Services that are available to a guest. Promotions, hidden/deleted or
  scheduled-hidden, member-only, audience-scoped, and eligibility-gated
  offerings are excluded.
- At 400x520 the complete 204-pixel preview fits without internal scrolling;
  all action targets remain at least 44 pixels.

## Privacy and compatibility

The offering count is calculated only when the owner creates or updates the
existing frozen Shared Map snapshot. Existing share tokens retain their prior
snapshot until `Update shared link` is used, and the embed never reads live
offerings. Contact fields retain the sanitized embed-only snapshot contract.
All additions are optional, so older snapshots remain compatible. No database
schema, route, authentication, permission, map membership, Group filter,
annotation, Print View, export, R2, framing, or ordinary Shared Map behavior is
changed.

## Pre-release verification

- Full Worker/server suite: 521/521.
- Full client/source suite: 574/574.
- Locked map/print aggregate: 84/84.
- Exact API and six-root production client build: pass.
- `git diff --check`: pass.
- Visual QA: pass at 400x520 and 1280x900; see `design-qa.md`.

## Deployment order

1. Commit and push the validated implementation branch.
2. Fast-forward and push `main`, then immediately deploy and verify the
   compatible Worker while the automatic Pages build is still in progress.
3. Allow that automatic build to settle without accepting it as the release.
4. Publish the already validated exact six-root `client/dist` through the
   controlled Pages release.
5. Compare local, immutable Pages, and `https://app.carearound.sg` artifacts by
   MIME type, byte length, and SHA-256.
6. Verify API health and the public embed route without mutating map 25 or its
   frozen snapshot.

## Rollback

1. Roll back Pages first to the preceding verified embedded-map deployment.
2. If necessary, redeploy the preceding Worker after the client rollback.
3. Do not delete or rewrite existing shared snapshots. No schema or R2 rollback
   is required.
4. Do not mutate an owner map merely to verify rollback; use a disposable map
   only with explicit authorization and assured cleanup.
