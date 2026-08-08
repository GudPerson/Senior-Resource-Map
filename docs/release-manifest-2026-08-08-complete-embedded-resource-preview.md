# Release Manifest: Complete Embedded-resource Preview

- Date: 2026-08-08
- Branch: `codex/map-only-embed-v1`
- Released implementation commit: `f54ec727b3100f24cf864122871aa85d419901d6`
- Status: production release verified on 2026-08-08.

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

## Deployment record

1. `codex/map-only-embed-v1` and `main` were fast-forwarded to `f54ec727b` and
   pushed.
2. The guarded clean-`main` Worker release deployed version
   `ec655f91-1ce8-4afc-ad3e-0a8d5432154d`. API health, ordinary Shared Map,
   and embed endpoints returned 200.
3. Automatic Pages build `82dd8be3` completed. It was not accepted as the
   release because it did not use the controlled six-root artifact.
4. The exact production API URL and six locked Detailed-map roots built and
   deployed. A final identical publish after the automatic build settled is
   available at `https://213d1357.senior-resource-map.pages.dev`.
5. All 81 public files matched local `client/dist`, the immutable Pages URL,
   and `https://app.carearound.sg` by MIME, byte length, and SHA-256 with
   aggregate
   `36dfdfd454f0d01a0dba3f4c6afd0a8dab5c3873f6363142448421767854969a`.
6. The production embed document and lazy chunk return the expected HTML and
   JavaScript MIME types and carry the new count/contact paths. Existing map 25
   was not mutated; its four hard rows retain zero positive counts until its
   owner intentionally uses `Update shared link`.

## Rollback

1. Roll back Pages first to the preceding verified embedded-map deployment.
2. If necessary, redeploy the preceding Worker after the client rollback.
3. Do not delete or rewrite existing shared snapshots. No schema or R2 rollback
   is required.
4. Do not mutate an owner map merely to verify rollback; use a disposable map
   only with explicit authorization and assured cleanup.
