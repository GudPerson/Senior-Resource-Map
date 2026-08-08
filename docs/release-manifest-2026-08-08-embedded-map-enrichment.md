# Release Manifest: Embedded-map Presentation Enrichment

- Date: 2026-08-08
- Branch: `codex/map-only-embed-v1`
- Base: `50306c949d`
- Compatible Worker commit: `699b33ca`
- Client commit: `bfd17423`
- Status: release candidate; production verification pending.

## Candidate outcome

- The website embed automatically uses the locked Detailed-map v3 overview
  surface at displayed zoom 14 and v2 native surface at displayed zoom 15,
  retaining the regular-map fallback and the existing fixed-layer memory cap.
- A selected resource preview displays its logo, then map-category icon,
  category icon, or letter fallback.
- An owner may explicitly mark an existing Print View annotation `Share this
  annotation`. Only opted-in annotations are sanitized into the frozen shared
  snapshot on `Update shared link` and rendered read-only in the embed.
- Private annotations, personal places, private notes/files, owner tools,
  account context, and the annotation visibility flag never enter the public
  embed response. Ordinary Shared Maps remain annotation-free.

## Blast radius and compatibility

The server change adds one optional `isShared` property inside the existing
schema-version-1 annotation JSON document and one `embeddedAnnotations` field
inside the existing JSONB share snapshot. It adds no database table/column,
route, migration, authentication, authorization, resource-visibility, or R2
change. An old client ignores the new embed response field. The new client
treats that field as optional, so it remains compatible with the old Worker.

The client reuses `DirectoryMap`, `FixedTownSurfaceLayer`, the accepted fixed
surface/index validators, and `PrintAnnotationLayer` in read-only mode. It does
not add map style controls, download assets, live owner-data reads, geolocation,
or editing to the iframe.

## Required deployment order

1. Push the feature branch as the reviewed reference.
2. Fast-forward clean local `main` to `699b33ca`, push `main`, and deploy the
   Worker from a clean checkout synchronized with `origin/main`.
3. Verify API health plus unknown/disabled embed failure states.
4. Fast-forward `main` to the final client/documentation commit and push.
5. Build and deploy Pages with the production API URL and all six locked map
   roots through `npm run deploy:client`.
6. Verify local, immutable Pages, and custom-domain HTML/JS/CSS/lazy chunks by
   MIME, bytes, and SHA-256 before browser acceptance.
7. Run production smoke and disposable-map UAT, then update this manifest,
   regression ledger, and handoff with exact release evidence.

## Verification completed before deployment

- Focused server annotation/share/embed: 59/59.
- Focused client embed/map/annotation: 93/93.
- Full Worker/server: 520/520.
- Full client/source: 587/587.
- Locked map/print aggregate: 84/84.
- Exact six-root production build: pass.
- `git diff --check`: pass.

## Production acceptance matrix

- Existing embed allowlist, iframe framing, guest-only payload, search,
  categories, pins/clusters, list-only disclosure, and revocation still work.
- At displayed zoom 14, the iframe renders only the accepted v3 overview fixed
  surface; at displayed zoom 15, only the accepted v2 native fixed surface.
  Outside coverage or after a bounded load failure, the regular map remains
  usable and no retry loop is created.
- A selected resource preview shows its expected logo or deterministic
  fallback without changing the resource link.
- A private annotation is absent from the frozen snapshot and embed response.
  An explicitly shared annotation appears read-only only after `Update shared
  link`. Unchecking and updating removes it from a fresh response.
- The ordinary Shared Map endpoint/page remains annotation-free. An
  authenticated browser session does not change the embed payload.
- Owner Print View annotation editing, autosave, duplicate, undo/redo,
  PNG/PDF export, My Map, Shared Map, and core authenticated smoke remain green.

## Rollback

1. Roll back Pages first to the previous verified map-only embed deployment.
   This removes Detailed/logo/annotation presentation while leaving the frozen
   embed and its revocation controls available.
2. If needed, deploy the previous verified Worker after Pages rollback. The new
   client treats annotations as optional, and the previous client ignores the
   new snapshot field, so either order is privacy-safe; Worker-first remains
   the normal forward sequence.
3. Keep existing annotation documents and share snapshots. No database or R2
   rollback is required. Updating a shared link under the previous Worker will
   naturally replace the optional snapshot field.
4. Delete only disposable UAT maps created for this release. Do not mutate an
   existing owner map or Shared Map snapshot for verification.
