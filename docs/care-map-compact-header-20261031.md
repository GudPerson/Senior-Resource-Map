# Care Map compact header - local candidate, 31 October 2026

Release update (1 November): the user has authorized making this owner workspace the default. The following records the historical local candidate; current policy, fallback and release gates are in [the default-workspace release record](care-map-split-default-release-20261101.md).

This iteration replaces the large owner map identity card with a compact map title, a functional saved-view selector and a small Map Studio status indicator. It builds on the accepted local split workspace and remains **local only: no commit, push, deployment or production write**.

## Preserved baseline and review entry

New worktree: `/private/tmp/carearound-compact-header-20261031`, branch `codex/care-map-compact-header-20261031`. Its common Git directory matches `/Users/sweetbuns/CareAroundSG/.git`.

The starting point is public source `d8c108aeb04335a366c88d0caf757969ec47d5d7` plus the accepted split-workspace patch SHA256 `242d68a40797af37feafba4d33e94f32b7222436889b1faadf927623c90bd99d`. All22 payload hashes from that candidate's source manifest were verified before this iteration's edits. The original `/private/tmp/carearound-split-workspace-20261031` and its durable `care-map-split-implementation-20261031` artifacts remain the exact previous review/rollback reference; the dirty primary checkout and release-evidence worktree are preserved.

Use the existing owner `workspace=split` entry in this candidate. The optional workspace compile flag remains OFF by default. `workspace=current` and More -> Use current layout retain the existing flush/active-editor guards and select the retained released presentation. This does not restore the older large-card prototype; that prototype is preserved separately in its original candidate and artifact bundle. No schema or media rollback is involved.

## Header behavior

- Normal desktop header is a flat strip capped at520px, targeting a50px row: title, native view selector, explicit Explore/Design text, then the compact Studio indicator. The full map name remains available to accessibility tools and the native title tooltip while long visual text truncates.
- At narrow available width or larger text, it uses two readable compact rows. The native selector and indicator retain44px touch targets. The phone layout deliberately allows additional height for large text rather than shrinking type or clipping controls.
- Search and Map layers and design stay outside the resource/tool drawers in their separate row. The existing measured context bottom still governs panel/credit clearance; changing this header does not resize the map canvas or mount another map.
- Saved/pending/saving/loading/error indicators use distinct icons plus an accessible live message scoped to **Map Studio**. Failure has a short visible action as well as its complete status text. Clicking the indicator reveals existing Studio Retry/Reload recovery without entering Design or changing the selected view. Normal Studio/layers actions still enter Design explicitly.
- The header's native select works while Studio is closed. It uses the same current owner-derived options, active view and default marker as the inspector. It remains disabled while loading/saving/unavailable and during actual annotation/personal-place input ownership. The inspector's existing selector and view actions remain available.

## One owner and one view-change path

`MapStudioViewsPanel` publishes a memoized minimal view-options projection and the active view ID through the existing stable status callback. It does not publish a second Studio document or install a second controller. Memo dependencies include the working view array and default ID; callback dependencies include the active ID, so equal names or parent rerenders do not create stale values or a render loop.

Both the existing inspector event handler and the header's imperative entry delegate to one stable `selectView` callback. Its body retains the existing flush/check/select ordering. It reads the existing authoritative owner ref for the initial guard, waits for `flushPendingSave`, reads the current owner ref again, then calls the existing `selectOwnerMapStudioView`. This avoids capturing the initial null render through a stable imperative handle. No save algorithm, revision protocol, retry path or direct document mutation was introduced.

Header selection does not invoke `openLayoutSettings` or the mode changer. Failed save/conflict keeps the old selected view; queued patches must finish through the existing flush before switching. Named-view New/Rename/Duplicate/Set default/Delete, explicit Explore exit, notes/annotations, Current fallback and existing image/export contracts retain their original owners and handlers. Current/Discover/shared/embed/Print do not opt into this new header.

## Local evidence and boundaries

The final browser receipt, runtime/harness hashes and validation results are recorded in the leading regression-ledger/session-handoff entry and the new durable `care-map-compact-header-20261031/source-manifest.json`. Its browser suite extends the existing actual-App split-workspace fixture; it retains the prior20 behavioral cases and adds targeted header/queue/failure/geometry cases rather than introducing a second test application.

Reproduce from this worktree with:

```sh
node tests/browser/owner-split-workspace.mjs --out=/private/tmp/carearound-compact-header-recheck
npm run test:client
npm run build:client
npm run test:map-lockdown
npm run check:static
```

Initial checks exposed missing cached dependencies in the fresh Git checkout (`@e965/xlsx` and `fflate`), not a header compilation defect. The lockfile was installed offline without copying environment files or credentials. Those initial failed logs are retained separately; generated tracked dependency changes are restored after verification and excluded from the reviewed patch. One early browser assertion omitted the existing failure wording; its corrected replay is recorded separately from product evidence.

All browser resources/APIs/pixels are fictional and intercepted. Automated browser geometry, keyboard behavior, held/error/conflict responses and controller identity are not physical-device/PWA, production-backend or actual private-image/export-quality acceptance. Publication still requires explicit authority, exact-source release gates and the normal compatible paired publisher.

The durable recovery payload contains both a full patch against D8 and a compact-header-only delta against the verified previous split candidate, plus the complete changed-file bundle and hash inventory. Each is checked in an isolated scratch tree. It excludes dependencies, environment files, credentials and generated Graft content.


## Final accepted local result

Final browser matrix **26/26 PASS** at `/private/tmp/carearound-compact-header-final26/report.json`, with unchanged source/harness, zero JavaScript page errors and zero unexpected writes. The new durable folder holds43 accepted captures, including `compact-map-header.png`, an actual520x50 DOM-element screenshot. Its report SHA256 is `1b600db739978f70b40e7b2e74df1ed186c57a54ad8642dd023017548b40a356`; canonical runtime inventory SHA256 is `3727ec7537b8861f463f7fd8ef1e1fdfe614721a4f7412c6d48bb3bb4b28bc34`; exact final harness SHA256 is `aa161ea19d4cc76f19e7c633c4b9e345d7101e88ef2639c73a4d75206c4180b9`.

Final source checks pass client1047 plus environment5, explicit locked-map116, configured ten-root client build/compiler17, module/static and Git whitespace checks. These are local code/browser results, not release CI or production verification. The exact source manifest records baseline/seed history, every payload hash, patch/bundle hashes and successful scratch applications of both full and incremental recovery patches.
