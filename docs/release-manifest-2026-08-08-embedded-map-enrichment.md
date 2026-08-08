# Release Manifest: Embedded-map Presentation Enrichment

- Date: 2026-08-08
- Branch: `codex/map-only-embed-v1`
- Base: `50306c949d`
- Compatible Worker commit: `699b33caf5a20a9409483de9d70aae5e167ed182`
- Client commit: `bfd174231`
- Released implementation commit: `2033a36f7`
- Status: production release verified on 2026-08-08.

## Released outcome

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

## Deployment record

1. The Worker-compatible server commit was pushed to `main` and deployed
   first. Production Worker version:
   `10d07e2a-2d22-4dfc-8080-ed0d3aa72f59`.
2. API health returned `200`/`status: ok`; an unknown embed returned `404`;
   the existing owner map's ordinary Shared Map response remained
   annotation-free and its embed response accepted the optional empty
   `printAnnotations` field.
3. `main` was fast-forwarded to `2033a36f7`, pushed, and built with the
   production API URL and all six locked Detailed-map roots.
4. The first controlled Pages deployment was `d4a59034`. The `main` push then
   triggered automatic deployment `2bbe37de` without the locked build
   environment and temporarily displaced it on the custom domain. The already
   validated `client/dist` was republished after that automatic build
   completed.
5. The accepted production Pages deployment is
   `https://d584a8d6.senior-resource-map.pages.dev`.
6. All 80 public artifacts matched local `client/dist`, the accepted immutable
   deployment, and `https://app.carearound.sg` by MIME, bytes, and SHA-256.
   Aggregate SHA-256:
   `2be419b82246c3674fb73691e40f028bd07251720d404a3bdc4a5c3bb92d5827`.

## Verification completed before deployment

- Focused server annotation/share/embed: 59/59.
- Focused client embed/map/annotation: 93/93.
- Full Worker/server: 520/520.
- Full client/source: 587/587.
- Locked map/print aggregate: 84/84.
- Exact six-root production build: pass.
- `git diff --check`: pass.

## Production acceptance

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
- Public production smoke passed 1/1. The five authenticated smoke cases could
  not start because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were
  not configured in the release environment; this release does not claim a
  6/6 smoke run.
- Signed-in Chrome UAT on existing owner map 25 confirmed current production
  script loading, two v2 native Detailed chunks at displayed zoom 15, zero
  live basemap tiles, and the expected Fei Yue Brickland logo in its selected
  resource preview. The existing map and its snapshot were not mutated.
- Disposable signed-in map 298 proved the complete annotation path: a drawn
  line was private by default, became a sanitized read-only embed annotation
  only after opting in and updating the shared link, and disappeared from a
  fresh embed response after opting out and updating again. The ordinary
  Shared Map endpoint never exposed `printAnnotations` or `isShared`.
- The disposable map was unpublished and deleted. It is absent from My Maps,
  and both `/api/shared-maps/:token` and `/api/shared-maps/:token/embed` return
  `404` for its retired token.

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
