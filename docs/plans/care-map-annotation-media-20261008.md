# Private Care Map annotation links and images

Status: implementation authorized on 8 October 2026; local feature and Guide acceptance passed; compatible production release authorized by the existing commit/push/deploy instruction.

## User contract

1. Select an existing annotation and choose Tag Resources. The checklist contains resources already attached to that map. One annotation may link to several resources; the reverse lookup is derived.
2. Choose Appear, Pulse or Highlight. Card activation retains its existing map focus and additionally activates its linked annotations. Read-only annotation activation emphasizes linked visible cards. Repeated programme cards at different hosts represent the same linked resource; explain that scope in the picker.
3. Appear annotations are conditional during ordinary owner browsing. Explicitly hidden Studio layers/items remain hidden. Editing and static export retain normal annotation visibility. Pulse runs briefly, then retains a steady selected cue; reduced motion skips animation. Selection never changes the saved annotation or Studio design.
4. Upload an image, place it on the map, move it and resize it without distorting its proportions. New image annotations use the same tagging controls. Browser normalization bounds ordinary photos before upload and strips original metadata.
5. This phase is the private owner map. New image objects do not enter ordinary Shared Maps or website embeds. Existing explicitly shared shape geometry retains its current sharing behavior; new linking/attention metadata is excluded from public snapshots.

## Narrow architecture

- Reuse the revisioned annotation JSON document with schemaVersion 1. Old documents, geometry, style, local recovery and undo/redo remain compatible. Optional resourceLinks use typed source IDs: hard, soft, personal_place; resourceBehaviour is appear, pulse or highlight. Empty link sets omit both fields. The picker and duplication guard enforce 200 links per annotation and 2,000 links across the document.
- Validate links against the requested owned map on the server; detach stale memberships while retaining annotation contents. Owner duplication preserves these source identities. Runtime activation is separate from editor selection, and browse selection never enables drag handles.
- An image has type image, two geographic bounds and image metadata assetId/width/height/alt. Asset IDs are immutable lowercase SHA-256 references; external image URLs and bytes are not annotation state.
- Private media uses the existing R2 binding through a separate owner namespace and map-owner API gate. It does not use CMS authorization/publication endpoints. JPEG/PNG/WebP only: bounded signatures, dimensions and bytes. Normalized bounds: 2 MB per file, 2048 pixels per side and 4 million pixels. Each map may contain at most 20 image objects within the existing 100 annotation limit. Owner quota: 20 distinct images and 20 MB, enforced with conditional reservation. Same-owner copies reuse immutable media; no destructive garbage collection in this phase.
- Guide instructions use a small source-backed supplement in English, Mandarin, Malay and Tamil. New images/tags and legacy annotation-sharing answers explain the private boundary; AI grounding and restored history retain it. Optional request locale is not saved to the history schema. Approved authored CMS content and generated library remain unchanged.
- Authenticated private image reads use private/no-store and nosniff. Blob URLs stay in runtime only, with stale-load cancellation and cleanup. Missing storage disables image uploads without breaking existing shapes or tagging. Existing cookie/CSRF protections remain.
- Owner Print View and PNG/PDF exports receive the same decoded private image sources, without transient activation effects. Missing or failed image decoding blocks export visibly rather than substituting an invisible image.

## Protected behavior

Preserve card map focus, hover, nested links/actions, mobile trays, explicit resource removal, category/filter ordering, geographic overlays/attribution, fixed-surface memory bounds, saved named views, private personal places, annotation autosave/recovery/revision conflicts, ordinary shared-map payloads, and frozen embed sharing opt-in/publication flush. No database migration, role grant, secret/configuration change, Help library rewrite or shared-feature expansion is included.

## Acceptance

- Meaningful unit/server checks: legacy annotation compatibility, bounded metadata, foreign/stale memberships, owner isolation, quota races/retries, duplicate maps, private sanitization and failed/missing media.
- Runtime link checks: one-to-many and reverse selection, grouped programme cards, hidden layers/resources, map/view switches, brief pulse/reduced motion, unchanged card actions and no activation in persistent documents.
- Browser checks at desktop and phone width: tag checklist/behavior, ordinary card and annotation activation, image upload/place/move/aspect-preserving resize, save/reload and undo/redo, private image decode and export failures. Use fictional/intercepted fixtures before any real data mutation.
- Full client build and server suite, locked map checks, static/diff validation and independent patch review before treating this as ready. Production/physical-device acceptance is separate from local fixtures.

## Workspace and release

Base: released public 55845136efb6c77f47636bbbc525c0767d536912. Branch: codex/care-map-annotation-media-20261008. Work in the clean reused current release checkout; preserve the unrelated dirty primary. The existing explicit commit/push/deploy instruction, followed by approval to implement the recommended features, covers this exact compatible release after concrete acceptance. Reuse the approved private paired release workflow with the unchanged published authored library. Only the public source pin advances as normal release metadata; credentials, bindings, schema and unrelated drafts remain protected. No production fixture writes are authorized. This plan does not claim a deployed feature.

## Local evidence, 8 October 2026

- Full quality: server 1,170/1,170, CMS 73/73, compiler/environment 17/17 and static checks pass. Client release verification and locked map checks are recorded in the evidence packet. All failures from earlier harness probes and actual pane/blob export defects remain in private evidence; final fixes were independently reviewed.
- Current-code fictional Chromium: 15/15 tagging cases, including both directions, two programme hosts, hidden views, all three saved modes, repeated pulse, reduced motion, four languages and 390px browsing. No unexpected writes or page errors.
- Native image upload/place/move/aspect resize, undo/redo, delete/undo, blob revocation, save/reload and caption without refetch pass. Actual PNG/PDF downloads include the decoded private image. Actual missing-media error prevents download; Retry recovers.
- Focused Guide route, mock grounding, restored history and protected Help-content checks pass. No paid model or production resource fixture was used.
- Independent review closed V2 card forwarding, detach/revision refresh, image and tag budgets, transient pane updates, repeated pulse, localized errors, caption request identity and blob export cache-busting defects.
- These are local/source checks, not physical-device or production image-write acceptance. Production delivery will be recorded separately after commit and paired release.
