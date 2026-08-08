# Embedded Bubbles and Owner Focus Card Release Manifest

Date: 2026-08-08 (Asia/Singapore)

## Release scope

- Align the map-only embed with the current category-bubble collision behavior
  used by interactive My Map, replacing its legacy numeric cluster bubble.
- Reuse the complete embedded resource-preview presentation in the owner V2 My
  Map mobile focus tray, including normal and full-map modes.
- Preserve ordinary Shared Map focus cards, desktop cards, Print View, map
  focus, notes, SPA return navigation, and the locked Detailed-map roots.

## Architecture and blast radius

- Client-only presentation change.
- The embed changes one `DirectoryMap` cluster-mode prop.
- The extracted compact card is shared, but the owner focus-card rollout is
  guarded by an explicit opt-in prop whose default retains the old card.
- No Worker, API, schema, auth, snapshot, permission, membership, annotation,
  export, R2, framing, or map-asset change.

## Source and verification

- Implementation commit: `b9a750ec968a5400de2b3c5c77db1d2c4e03e71f`.
- Branch: `codex/embed-bubbles-owner-focus-card`.
- Focused map and focus-card tests: 79/79 passed.
- Full client/source tests: 590/590 passed.
- Full server tests: 521/521 passed.
- Map lockdown: 84/84 passed, followed by the exact six-root production build.
- Ordinary client build and `git diff --check` passed. The only build advisory
  was the established stale browsers-data notice.

## Deployment gate

- Push the validated implementation to `main`, wait for the Git-triggered
  Pages build to settle, then directly publish the already validated
  `client/dist` with cache skipping.
- Confirm the complete local/immutable/custom-domain manifest by MIME type,
  byte length, and SHA-256 before acceptance.
- Confirm API health, the frozen embed endpoint/document, Discover, embedded
  category-bubble behavior, and signed-in owner My Map mobile focus cards.
- No Worker deployment is planned because server behavior is unchanged.

## Rollback

Rebuild prior source `2f5ac0ac1` with the exact six production map roots and
republish that validated `client/dist` to Pages `main`. Do not roll back the
Worker, database, or map assets because this release changes none of them.
