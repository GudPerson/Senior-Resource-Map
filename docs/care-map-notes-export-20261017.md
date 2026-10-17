# Care Map notes and images download — 17 October 2026

Status: local implementation verified. The user explicitly authorized commit, push and the protected production deployment on 17 October 2026. Publication and live acceptance are in progress; browser download acceptance remains pending.

## Result

On an owned Care Map with attached note images, the existing download action becomes **Download notes & images (ZIP)**. One ZIP contains:

- The complete, unfiltered notes PDF, with an image appendix.
- The original saved PNG, JPEG and WebP bytes, in resource folders.
- An offline `index.html` showing each resource's notes and images together.
- `notes-and-images.json` for searchable correspondence between resource, note and image references.

Resources use `R001`, text notes use `R001-N1`, and images use `R001-I1`. The same references appear in the PDF, index, manifest and image filenames. Identical resource names cannot overwrite one another. Repeated image bytes are fetched once while retaining each resource's independent association. Image-only personal places and list-only resources are included. Text-only maps retain the existing PDF output and filename.

Current storage associates images with a resource's collection of notes. It does not record which individual text entry an image belongs to. The export explicitly states this relationship instead of inventing one. Creating individual image-to-text-note links would be a separate product/data change.

## Scope and privacy

The patch is frontend-only: the export button, ledger image metadata, isolated archive helper, PDF generation, four-language status/error messages, tests and the existing lockfile declaration for the already-installed `fflate` package. It reuses the gallery's authenticated image loader and owner API routes. No new share link, remote file upload, media publication, schema, authentication or permission change occurs. Notes/images are not written back during export. Shared-map and embed downloads remain unchanged.

Images are loaded sequentially with cancellation, per-image timeout and object-URL cleanup. Missing, revoked, invalid or undecodable attachments fail the entire download; retry starts afresh. Archive generation does not silently omit failures. A 64 MB aggregate attachment limit prevents repeated image associations from causing unbounded export memory use and has a translated error. Index text is escaped, filenames stay relative, and the index disallows scripts and network requests.

## Implementation location

- Active primary root: `/Users/sweetbuns/CareAroundSG`.
- Isolated new clone: `output/care-map-notes-download-20261017/source` inside the active root.
- Branch: `codex/care-map-notes-download-20261017`.
- Baseline: `09873392d9b069ec51baa69a9c755932d81a2806`, the primary checkout's last observed `origin/main`.
- Existing primary runtime changes are preserved. Its older runtime was not edited or used for the build.
- Fetching into the primary `.git` was denied; the fresh clone avoids modifying that worktree. Remote refresh from the isolated clone was unavailable because GitHub DNS is blocked. Do not claim that the baseline was freshly compared with remote or current production.

## Validation

- Full client tests: **1,038 / 1,038**, plus **5 / 5** environment checks.
- Full server tests: **1,235 / 1,235** after restoring the exact locked `@electric-sql/pglite@0.5.8` test dependency from SHA-512-verified cached bytes. No server implementation was changed.
- Locked-map suite: **112 / 112**, plus its build and **17 / 17** compiler/environment contracts.
- Production `npm run build:client`: passed on the final runtime source.
- Module graph: **648 modules / 1,967 relative edges**, no cycles.
- Export tests cover all three image formats, byte-exact ZIP extraction, embedded PDF image pages, matching notes/references, duplicate names/resources/bytes, image-only rows, text-only PDFs, invalid/failed reads, retries, cancellation/timeouts, URL cleanup, HTML escaping and the memory bound.
- Fictional PDF/ZIP samples are in `output/care-map-notes-download-20261017/pdf-qa/`. All five pages were rendered and visually checked with macOS PDFKit/CoreGraphics and isolated-page `sips` rendering. Portrait, landscape and square images fit without cropping; matching references and single image-page footers were checked. The first multi-page renderer showed an isolated last-page rasterization artifact; independent isolated-page rendering confirms correct PDF text and pixels.
- `tests/browser/care-map-notes-export.mjs` exercises the actual owner route with fictional intercepted APIs on desktop/phone/tablet, missing-image failure/retry, PNG/JPEG/WebP bytes and list-only/personal-place content. It could not start because the environment denies listening on localhost (`EPERM` at 127.0.0.1:4217). No browser-download, actual device or production acceptance is claimed.

The first export run used an invalid tiny PNG fixture and an overbroad old `DirectoryMap` source matcher; a deterministic valid PNG and a word-boundary matcher corrected the fixtures. A FileSaver CommonJS interop error was corrected to the compatible default import. Initial missing-dependency server failures and all browser restrictions remain distinct from passing final checks.

## Before release

Run the retained browser replay in an environment that permits a local server, complete normal credentialed smoke and real-device download checks, refresh/reconcile current main, then use `docs/release-checklist.md`. Preserve the latest private authored Help snapshot through the existing protected publication workflow; do not deploy this clone's public-baseline Help content directly. The user authorized this exact release on 17 October 2026. Record final deployment identities and proof boundaries in the output handoff after verification.
