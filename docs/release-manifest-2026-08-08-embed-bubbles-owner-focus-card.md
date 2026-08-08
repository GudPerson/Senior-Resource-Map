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

## Deployment

- Git-triggered production deployment:
  `667d0f59-f04b-4ddb-bf04-650749d9d3fa`.
- Accepted controlled six-root publication after the Git-build race settled:
  `f74778c3-d4b3-4451-8eb9-3141907b446c`.
- Docs-only Git deployment: `ebfc3be0-a886-4c19-8619-5fe9823d2bc1`.
- Final identical six-root republication after the release record was pushed:
  `0f9629e7-2f72-4205-a26d-7dd996d66509`.
- Final immutable URL: `https://0f9629e7.senior-resource-map.pages.dev`.
- Production URL: `https://app.carearound.sg`.
- No Worker deployment was performed because server behavior did not change.

## Production evidence

- All 80 public files match local, immutable Pages, and the custom domain by
  MIME type, byte length, and SHA-256.
- Aggregate manifest SHA-256:
  `99468f3e9a667ed5f383c3eef6400d28e7a4b1f9fdc256396ac8b224cd500cb9`.
- All six locked Detailed-map roots and required/forbidden release markers
  remain present in the deployed JavaScript.
- API health, the frozen embed API, production embed document, and Discover
  return 200.
- Production Chrome UAT at 400x520 reports four category-bubble icons/lobes,
  zero legacy cluster markers, and visible Website, phone, and `Open resource`
  actions with no internal card overflow.
- Signed-in production owner UAT at 390x844 confirms the complete focus card,
  public Programme/Service count, hours, contact actions, and SPA `returnTo`
  path. The immutable deployment confirms the same card in full-map mode with
  the tray's bounded vertical scrolling.
- Production smoke: the public case passed. Five authenticated cases were not
  runnable because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were
  absent; they are not claimed as passed.

## Rollback

Rebuild prior source `2f5ac0ac1` with the exact six production map roots and
republish that validated `client/dist` to Pages `main`. Do not roll back the
Worker, database, or map assets because this release changes none of them.
