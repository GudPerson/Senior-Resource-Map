# Care Map image allowances — 20 October 2026

## Release contract

Each resource membership in a Care Map has its own gallery of up to 20 images across that resource's notes. Other resources and other maps have independent galleries. The old account-wide 20-upload ceiling is removed. Account storage increases from 20 MiB to 1 GiB (shown as 1 GB in the product), shared by note images and map annotation images. Gallery UI shows its image count and the account's stored-byte usage in all four languages. The separate 20-image annotation placement limit on each map stays intact.

The existing automatic resizing, 2 MiB normalized-file limit, 2048-pixel sides, four-million-pixel bound, owner-only access, personal-place privacy, explicit image sharing, frozen shared publication, and authenticated download paths are preserved. Immutable media remain reusable by owned copies, annotations, undo history and published links. Removing an image frees a gallery slot; it does not erase the shared stored file or reclaim its byte reservation. Permanent unused-media deletion is outside this release.

The previous 100-gallery/500-reference per-map metadata limits are removed; a bounded 4 MiB gallery document supports larger maps without introducing a 20-image map-wide ceiling. The account metadata ledger is bounded to 8 MiB; its former 20-image count check is removed. Byte reservations remain conditional and retries deduplicate immutable stored bytes. Existing v1 ledgers and gallery documents remain readable without a schema migration.

## Scope and regression checks

Baseline: production public source `9e76851d3bf136e19e270f7fc2c8dceeffe44142`. Work is isolated on `codex/care-map-image-allowance-20261020` in the maintained release checkout. Preserve the unrelated dirty primary worktree. No environment file, credential, resource row, SQL schema or parked security finding is changed.

Acceptance:

- Three resources in one map can each store 20 distinct images (60 total).
- The same resource in a second map has an independent gallery.
- A 21st image cannot be attached to a full resource gallery; removing one restores a slot.
- Unique account uploads and stored bytes can exceed the former 20-image/20 MiB thresholds.
- Concurrent uploads cannot exceed the new 1 GiB byte allowance; exact-boundary and deduplicated retry behavior passes.
- Old image references remain readable and private. Guests, impersonation, foreign maps and foreign media remain denied; shared links retain only their explicitly published images.
- Desktop, phone and tablet replay covers a full resource, another resource's upload, another map's empty gallery, removal, readable usage, and a complete 60-image ZIP with exact original bytes.
- Full server/client/CMS/static/build, locked-map and export browser checks pass before release.

Local evidence is retained in `output/care-map-image-allowance-20261020/`. Actual browser checks use fictional accounts, intercepted APIs and an in-memory bucket; no production fixture data is created. Physical-device proof is not claimed.

## Recovery

Existing immutable objects are not rewritten or deleted. After accounts exceed the former limits, do not deploy a historical Worker that rejects v1 ledgers with more than 20 assets or more than 20 MiB. Any targeted rollback must preserve the expanded ledger reader and storage allowance so new and old image references remain usable. Use a forward fix for an unrelated regression rather than restoring the old quota parser.

Final source/CI and paired Worker/Pages deployment identities are recorded in the local production handoff after verification. Authored Help content is retained through the normal protected publisher; code-backed Guide instructions and four-language UI copy describe the new allowance.
