# Owner Mobile Focus-Card Surface Release Manifest

Date: 2026-08-08 (Asia/Singapore)

## Release scope

- Remove the category icon/label above the selected resource in the owner My
  Map mobile `complete-preview` focus state.
- Remove the coloured outer focus tray so a single resource preview card is
  the full-width visible surface.
- Preserve the multi-resource horizontal rail and all existing resource
  details, notes, actions, and map-focus behavior.

## Architecture and blast radius

- Client-only, owner-mobile presentation change in
  `SharedMapDirectoryList`.
- The existing `complete-preview` variant is the only opted-in surface.
- Ordinary Shared Maps retain their category pill and tray. Desktop cards,
  owner Print View, embedded maps, pins, notes, actions, auth, API, snapshots,
  membership, annotations, exports, R2, and Detailed-map assets are unchanged.
- No Worker, schema, database, secret, permission, or map-asset change.

## Source and verification

- Implementation commit:
  `1202b6938d822c582d637cdfe9f096186cf44ee1`.
- Branch: `codex/owner-focus-card-surface-refinement`; also fast-forwarded to
  `main`.
- Focused map and focus-card tests: 79/79 passed.
- Full client/source tests: 575/575 passed.
- Full server tests: 521/521 passed.
- Production smoke: 6/6 passed.
- Map lockdown: 84/84 passed, followed by the exact six-root production build.
- Ordinary client build and `git diff --check` passed. The only build advisory
  was the established stale browsers-data notice.

## Deployment

- Git-triggered production deployment:
  `b4adab0d-5d67-4f16-87d1-79f37ef9dcbc`.
- First controlled exact publication:
  `efd5f7ed-16d9-4018-99df-e39ea6d2c211`.
- Accepted exact publication after the custom-domain alias converged:
  `ef29dac0-8689-451a-935a-e4eb673e130f`.
- Validated immutable URL: `https://ef29dac0.senior-resource-map.pages.dev`.
- Production URL: `https://app.carearound.sg`.
- No Worker deployment was performed because server behavior did not change.

## Production evidence

- All 80 public files match local, immutable Pages, and the custom domain by
  MIME type, byte length, and SHA-256.
- Aggregate manifest SHA-256:
  `a7841175b8b8e9f1fe2ddddf5f8b4dfd1edebd864460187354bf3ff0a18c7ec4`.
- The exact production entry is `assets/index-BdijEp2g.js`; all six locked
  Detailed-map roots and required/forbidden release markers remain correct.
- API health and Discover return 200.
- Signed-in production Chrome UAT at 390x844 confirms normal and full-map
  modes contain no category element or coloured outer tray. The card and tray
  each measure 370.8125 pixels wide; client and scroll widths are both 371
  pixels, so there is no horizontal overflow. Resource identity, address,
  hours, note behavior, and `Open resource` remain available.
- Production screenshots:
  `output/release-logs/owner-focus-card-surface-production-390x844.png` and
  `output/release-logs/owner-focus-card-surface-production-full-map-390x844.png`.

## Rollback

Rebuild prior source `19e3a191c` with the exact six production map roots and
republish that validated `client/dist` to Pages `main`. Do not roll back the
Worker, database, schema, or map assets because this release changes none of
them.
