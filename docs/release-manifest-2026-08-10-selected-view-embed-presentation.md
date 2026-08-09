# Release Manifest: Selected-view Embed Presentation

- Date: 2026-08-10 (Asia/Singapore)
- Branch: `codex/map-studio-print-card-parity`
- Release commit: `61ac302bd`
- Status: released and production-verified.

## Scope

- Make the currently selected saved Map Studio named view the presentation
  source when the owner explicitly uses `Update shared link`.
- Persist one frozen, versioned `embeddedPresentation` envelope containing only
  map style, detail mode, pin style, pin size, pin visibility, and annotation
  visibility.
- Render that envelope through the existing map-only embed while retaining
  stable legacy defaults for old snapshots and maps with no saved Studio row.

## Privacy and compatibility contract

- The Worker resolves the selected view from the persisted owner-only Studio
  document and copies only the six allowlisted settings into the public share
  snapshot.
- No view id/name, Studio document, draft, camera, label, hidden-layer id,
  layout, docking, card-column, export, owner-control, personal-place, private
  note, private descriptor, or other editor field is published.
- Existing guest visibility, shared-note/annotation filtering, embedded-contact
  sanitisation, exact-origin framing, revocation, and `no-store` behavior remain
  unchanged.
- The ordinary Shared Map response omits `embeddedPresentation`; only the
  map-only embed endpoint receives it.
- There is no schema, database migration, R2, secret, authentication, or
  authorization change.

## Validation

- Focused owner/share/embed/privacy tests: 85/85 passed.
- Full server suite: passed.
- Full client suite: 630/630 passed.
- Map lockdown: 84/84 passed.
- Ordinary and exact six-root production client builds: passed.
- `git diff --check`: passed.
- Worker version `81a20bd0-4487-40a6-9ad5-5e4fbd66b4a0` is live on
  `api.carearound.sg`.
- Pages was re-published manually from the exact validated `client/dist` after
  the release-record push triggered an incomplete Git build. All 82 deployable
  files on the final immutable deployment and `app.carearound.sg` match the
  local artifact by MIME, bytes, and SHA-256; canonical path/hash register:
  `cfbc04c5420a0814830b7fab20c3030e2036b8033c6b4cc01d3e44df5a1f54b9`.
- Ordinary app routes retain XFO DENY and `frame-ancestors 'none'`. The
  production embed document remains `no-store`, has no XFO, and uses only its
  exact configured frame ancestors. The embed API is public, guest-only, and
  `no-store`.
- A signed-in disposable production copy proved the complete freeze cycle:
  initial publication emitted `category-icon` + `standard`; switching to the
  other persisted named view did not change the embed; explicit
  `Update shared link` changed it to `numbered` + `standard`; the live embed
  rendered numbered pins and no Studio/owner controls. Public payload checks
  found no Studio document, view identity, personal places, print/export
  settings, docking, card columns, or owner state. The ordinary Shared Map
  response omitted `embeddedPresentation`.
- The disposable map and token were deleted after UAT; the former embed now
  returns 404. Existing user maps and live share tokens were not changed.
- Credentialed Playwright smoke was unavailable because the local smoke
  username/password variables are unset. The equivalent authenticated owner
  path was exercised through the existing signed-in browser session, with API,
  header, privacy, and artifact checks run independently.

## Release order completed

1. Pushed the reviewed candidate branch and fast-forwarded synchronized
   `main`, preserving unrelated untracked files.
2. Deployed the compatible Worker first and verified API health plus an
   existing pre-envelope snapshot's legacy defaults.
3. Published the exact already-validated six-root `client/dist` with Pages
   Functions, `_headers`, `_routes.json`, and `--skip-caching`.
4. Held the release during an initial custom-domain edge race, then verified
   the complete settled manifest before running frozen-update UAT.

## Rollback

- Roll back Pages first to the previous verified deployment, then redeploy the
  previous Worker if required. Existing snapshots remain readable because the
  client and Worker both fail safely to the established embed defaults when
  `embeddedPresentation` is absent.
- Do not delete Studio rows, share snapshots, embed columns, R2 assets, user
  maps, or production data during rollback.
