# Mobile annotations and Map Notes images — 13 October 2026

Status: validated implementation candidate, explicitly authorized for commit, push and protected paired deployment on 13 October 2026; deployment acceptance remains pending.

Work is isolated on `codex/care-map-mobile-notes-images-20261013`, based on accepted public source `e5008250192e79f944a57efee7cb9eda7b75db92` in the maintained release checkout. The dirty primary tree and original personal-place retry candidate retain their original binary-diff hashes. Pre-release validation involved no commit, push, deployment, production map write, binding change or schema migration. On 13 October the user explicitly approved: Commit, push and deploy both. The protected paired release and its independent acceptance checks are authorized.

Owned Care Maps expose Annotate on coarse-touch devices. The responsive tray uses 44px buttons, horizontal tool/action strips and an expandable, scrollable options area. Native drawing, handle dragging and exact Undo/Redo use the existing geographic editor; camera, pin accuracy, gesture engine, geometry representation and limits remain unchanged. Annotation editing keeps the existing north-up behavior.

Map Notes has a per-resource image gallery, separate from text autosave. The legacy text save replaces note IDs, so galleries bind to stable map-resource membership IDs in a revisioned owner-private R2 document. Existing private media validation, normalization and combined 20-image / 20 MB account quota apply. PNG/JPEG/WebP uploads default private; Download saves the normalized stored bytes. Four images decode at a time, and changing pages releases old object URLs.

Public-resource images require Share this image followed by explicit publish/update. Publication checks the reviewed image-document revision before writes, protecting stale and older browser tabs. Shared viewers receive only the frozen selected-image allowlist; current resource visibility/publication policy and link validity are checked again for every image GET. Image-only shared notes remain discoverable. Personal-place images remain private, and embeds exclude note images. Unselecting/removing a private-gallery image does not rewrite an existing share; update or withdraw the link to end shared access. Already downloaded copies cannot be recalled.

Owner Duplicate remaps image galleries to new resource/personal-place memberships and resets photo sharing. A failed attachment copy rolls back only the newly created private map. Saving a shared map copy does not copy image files into the recipient's account; viewers download from the original link. Runtime Guide procedures and new UI messages cover English, Chinese, Malay and Tamil; authored/canonical Help library content is unchanged.

Reproduction: on an owned Care Map at 390×844 and 768×1024, open menu → Edit content → Annotate, draw a box, drag an unobstructed 44px handle, Undo/Redo and wait for Saved. Expand Annotation options and reach Add image, Import boundaries and Tag Resources, then close. Open Map notes → resource; type unsaved text, upload/download an image, select sharing and add further private images. Require text to survive, exact downloaded digest, a four-image decode bound and old URLs released on Next images. Close/reload, review selected-image count, publish and open the link as a guest. Require only selected images, no owner controls, and denied private/revoked/withdrawn-image reads. Repeat existing fullscreen/header, native/overview, rotation, zoom and export checks.

Local verification: `npm run verify:quality` passes server **1,224/1,224**, client **1,027/1,027**, environment **5/5**, CMS **73/73**, compiler-contract **17/17**, 11 migrations, module graph **641 modules / 1,946 edges without cycles**, diff/static gates and production client build. Locked-map check **112** passes; existing map controls **46/46**, synthetic exact-shape GeoJSON **13/13**, and new native Chromium touch/image replay **39/39** pass without page exceptions or unexpected application writes. All browser data, storage and images are fictional/intercepted; this is neither physical Android/PWA UAT nor production upload/publication proof. The previously attached Downloads GeoJSON file is now absent; the failed sample run is retained separately from the passing committed-fixture replay.

Earlier failed checks remain recorded: wrong schema-export fixture, broad Guide intent matcher, stale source assertions, personal-copy ID mapping, overbroad test rollback, native touches obscured by controls, cramped mobile options and browser selector/async-wait issues. Product fixes and fixture corrections are distinguished in the handoff. Final passing evidence and source inventory: `output/care-map-mobile-notes-images-20261013/` in the primary workspace; detailed handoff: `docs/care-map-mobile-notes-images-20261013.md`.

The user has explicitly authorized commit/push and the protected paired Worker+client release. Required production acceptance: exact source CI, unchanged owner Help snapshot, existing bindings, protected publisher approval/receipt, independent Worker source provenance and Pages byte/MIME/SHA parity. Device assessment should include a real Android installed PWA and tablet after release.

## Architectural and privacy review

- New attachment modules: shared metadata normalization; owner-scoped R2 gallery repository; owner and published-byte controllers; isolated client gallery/loader; localized Guide facts.
- No note-ID/schema migration is needed. Existing text autosave does not know or replace the attachment document.
- Gallery edits use whole-document revisions and R2 ETag conditional writes. Repeating the same desired state confirms an uncertain prior write; conflicting state requires Reload images.
- Every gallery request checks the owned map and current membership; personal memberships also check private-place ownership. Reusing another account's asset digest is denied by the media namespace.
- Private metadata and image bytes use private/no-store responses. Shared bytes are streamed only after current policy checks and a matching immutable published image reference. No public hosted image URL is accepted.
- Existing JSON CSRF, authentication, method guards and private upload validation remain active. Quotas cover both annotation and note images.
- The shared review revision prevents an older client from silently publishing selected photos it did not display. Text-only legacy publication remains compatible when no images are selected.
- Removed/re-added resources get new membership IDs and cannot resurrect a detached gallery. Immutable media remains reusable under the existing account quota; Remove image detaches an attachment rather than deleting bytes referenced elsewhere.
- A saved shared-map copy excludes image files. Owner Duplicate retains galleries privately and rolls back the new copy if attachment persistence fails.
- Four-image pages bound decoded image memory; account/map/resource/token changes abort loads and revoke object URLs. Share-checkbox updates do not re-decode unchanged images.
- No private image pixels are added to Guide prompts, OCR, analytics or public Help content. The Guide contains reviewed workflow instructions only.

## Evidence and limitations

The final replay runs the actual owner and shared pages, real private-media/gallery HTTP handlers and real storage validation with fictional accounts, memory R2 and synthetic PNGs. Unit/integration tests separately exercise the actual publish/copy controllers and shared visibility policy. Browser publication persistence is a fixture; it is not a production publisher proof.

The successful mobile replay records 39 assertions, including touch creation/drag/Undo/Redo, reachable annotation options, download-byte digest, preserved text, private defaults, frozen explicit sharing, four-image decode/object-URL bounds and guest/revocation checks. Existing locked-map controls add 46 assertions, and the exact-shape committed GeoJSON replay adds 13. The missing external sample attempt remains a failure, not relabeled as a pass.

The first quality run passed all server checks and failed two legacy literal source assertions after adding the review revision; these were updated to retain both annotation and image-review requirements. Earlier targeted failures identified and corrected personal-copy membership mapping and exposed a fake rollback that removed all maps. Native-touch failures first hit rotation/pin controls; unobstructed hit checks fixed the fixture. Later options-layout checks found a real zero-height scroll region on short maps; expanded options now receive the full available tray height while tool/actions stay reachable.

Physical Android Chrome/PWA and tablet behavior still needs user assessment. No production user session was reloaded and no real note/image/map was created or changed.
