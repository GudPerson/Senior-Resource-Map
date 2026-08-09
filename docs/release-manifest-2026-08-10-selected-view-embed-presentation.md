# Release Manifest: Selected-view Embed Presentation

- Date: 2026-08-10 (Asia/Singapore)
- Branch: `codex/map-studio-print-card-parity`
- Status: validated candidate; production release pending.

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

## Release order

1. Commit and push the reviewed candidate branch.
2. Reconcile the candidate onto clean, synchronized `main` without including
   unrelated untracked files.
3. Deploy the compatible Worker first and verify API health plus old-snapshot
   fallback.
4. Publish the exact already-validated six-root `client/dist` with Pages
   Functions, `_headers`, and `_routes.json`.
5. Verify immutable and custom-domain artifacts, API payload privacy, ordinary
   anti-framing, embed framing/no-store, and selected-view frozen-update UAT on
   a disposable map.

## Rollback

- Roll back Pages first to the previous verified deployment, then redeploy the
  previous Worker if required. Existing snapshots remain readable because the
  client and Worker both fail safely to the established embed defaults when
  `embeddedPresentation` is absent.
- Do not delete Studio rows, share snapshots, embed columns, R2 assets, user
  maps, or production data during rollback.
