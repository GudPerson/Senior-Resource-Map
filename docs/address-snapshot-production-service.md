# Care Map address snapshot service

Status: **production connection prepared and locally validated; not released**. The original Discover/Care Map layout, Map Studio, export controls and existing postal verification remain the baseline. The local sidecar is optional; production requests use the existing authenticated API.

## Data and storage

The approved existing CSV contains 143,807 address rows and 122,261 postal codes. Its SHA-256 is `2d9740ed84cea78fd571ddc5c06e14c13d780bf47f4d50f405804c2e473b18e4`. Prepared time `2026-11-02T16:06:56.006Z` displays as 3 November in Singapore. This is file preparation evidence, not per-address verification. Source ages vary and coverage may be incomplete or outdated; the UI keeps this notice visible.

The deterministic builder creates 549 spatial tiles, each with a binary coordinate index and JSON address pack, plus one manifest: **1,099 objects / 28,877,797 bytes** for the fresh recovery candidate. Manifest SHA-256 is `0670fbbce22de6a82b776008eecaa2791737e2ddcc41e58403a03601000ee4e2` (320,450 bytes). Objects stay under `address-snapshot/v1/<source SHA>-r2/` in the existing private CMS R2 bucket. The existing binding is reused; no new public object route, mutable current pointer, database import/schema, credentials or scraper is added. Dataset payloads remain outside Git, client bundles and service-worker caches.

Read-only storage checks found public r2.dev access disabled, no custom domain and no completed-object expiry rule. The all-prefix seven-day rule aborts incomplete multipart uploads only. Reviewed CMS storage/publisher paths contain no bucket-wide cleanup or address-prefix deletion.

## API and supported areas

Signed-in, live, non-guest users use `/api/address-snapshot/metadata`, `/nearby` and `/area`. Existing authentication checks remain active. JSON responses are private/no-store and vary with credentials. Guest, disabled and stale sessions cannot query. Request geometry/results are not persisted by this feature. Catalogue resources continue through the existing visibility-filtered catalogue API; the address snapshot does not grant resource access or change ranking.

Metadata returns the dated snapshot identity and limits. Every query, including the first, pins its `snapshotSha256`; later pages and complete CSV export retain that first identity. Address queries support circles and the actual rendered rotated rectangles, rounded polygons, multipart shapes and holes. No outline is silently simplified. Original coordinate precision and distinct source rows are retained, including shared postal codes.

The production admission limits are 1 MiB JSON body, 10,000 geometry points, 1,000 rows/page, 1,000 m nearby radius, 16 candidate tiles, 32,000 candidate rows, 4 MiB reserved object bytes and **250,000 candidate-row × edge operations**. At most four storage reads run together, with 33 total reads. These are upper bounds used together, not a promise that every shape at each maximum will be accepted. Ordinary circles, rectangles and simple outlines are supported; a large or complex shape may require a smaller or simpler boundary. The existing map annotations remain intact when a query is rejected.

Errors distinguish invalid query (400), changed snapshot (409), body too large (413), area too large/complex (422) and unavailable data (503). Missing/corrupt objects fail unavailable, never fabricated zero addresses. A 409 restarts the search; a 422 offers boundary adjustment. Catalogue results remain usable if snapshot lookup is unavailable. Failed catalogue pagination cancels its transports before retry. Map switching, closing and aborted searches cannot reopen stale results.

A snapshot candidate only prefills a new private-place draft. The existing live postal verification and explicit Save are still required. The form explains the selected-point versus verified-building distance. Switching a new draft to no-address restores the exact original clicked point.

## Prepare and review publication

Build the audited CSV into an external directory with `scripts/build-address-snapshot.mjs`; the builder checks source bytes, preparation evidence and immutable output pins. Do not put the CSV or generated packs in the repository.

Generate a local-only upload plan:

```sh
node scripts/publish-address-snapshot.mjs --artifacts /absolute/external/artifacts --plan-file /absolute/private/upload-plan.json
```

Dry run starts no remote session and writes no remote objects. Review the complete 1,099-object inventory, aggregate bytes, hashes, bucket and immutable prefix before approving apply. The operator uses existing OAuth through the supported `getPlatformProxy` API of exactly Wrangler 4.145.0, a reviewed single remote R2 binding, no env-file loading and no persistent local emulation. Its temporary Wrangler-managed remote proxy is separate from the application deployment. Authentication/configuration failure has no local fallback.

The uploader checks the whole prefix is vacant, checks each key again, then uses atomic create-only writes with a checksum. The first coordinate index and its matching row pack are each uploaded and fully read back before bulk work begins. At most four workers create and verify the remaining packs. All data objects must pass size, MIME, actual-byte SHA and private cache checks before the manifest is written **last**; the manifest then passes the same checks and a complete prefix inventory rejects missing or unexpected objects.

Every PUT is attempted once. An unknown PUT outcome stops new work; already-started operations settle before the error is returned and the session is disposed. There is no overwrite, delete or partial-prefix resume. Read-only GET/body, HEAD and LIST transport exceptions admit at most three attempts with 250/1,000 ms backoff, including exceptions without a usable status or message. A failed body read obtains a fresh GET on retry. Explicit client/access/not-found statuses and typed integrity/validation failures stop immediately, even if they resemble network errors. No payload or local artifact validation is relaxed. Concurrency outside one to four fails before any storage operation.

The durable JSONL journal serializes intent and acknowledgement events before each PUT. It records safe phase, object key/SHA, attempt and error class, never payloads, local paths, proxy URLs or credentials. Upload and verification progress prints every 100 acknowledgements. The last receipt identifies the stopped phase and acknowledged counts; an intent without acknowledgement remains uncertain. Preserve an interrupted attempt and obtain a reviewed fresh-prefix decision rather than rerunning apply.

### Failed original namespace and recovery boundary

The original one-shot upload to `address-snapshot/v1/<source SHA>/` failed with an unclassified 500 before its data-verification checkpoint. A fresh read-only diagnosis found exactly 1,098 expected data keys and no manifest, missing or unexpected keys. Only the first index and last row pack received full independent size/MIME/cache/SHA checks; the complete data set was not hash verified. The journal cannot establish whether the last PUT acknowledgement or a later read failed. A session-expiry explanation is unproven. The original namespace is preserved unchanged and is never resumed.

The first recovery (`-r1`) also stopped before its manifest: 72 acknowledged PUTs, 71 verified data packs and no unknown PUT outcome. Its journal records an unclassified read failure; the separate proxy log reports an R2-header-missing 500. The original thrown error shape was not captured. A fresh, bounded diagnostic of the exact 641-byte pack passed HEAD plus 100 independent GET/body/SHA checks with at most four reads together. It did not reproduce the fault or prove its original cause. Both failed namespaces stay untouched; neither can resume.

The next candidate uses the fresh `-r2` namespace, with identical bytes/hashes for all 1,098 data objects and changed manifest key prefixes only. Its general idempotent-read policy is deliberate bounded recovery, not a claim that an invented empty/primitive error shape occurred live. Opaque, primitive and generic errors are synthetic test inputs. The new plan binds the canary, bounded-worker and idempotent-read protocol in its digest. Local tests and a fresh dry run do not authorize remote upload or establish publication. Require independent review, exact-source checks and explicit operator approval before this new attempt.

Apply requires the reviewed plan, exact pinned module/config and a fresh receipt. A separate fresh remote-binding verification plus an independent pinned-Wrangler manifest download must establish the actual remote target after upload; local emulation or an empty-prefix probe is insufficient. No apply or release is implied by this document.

## Application release and evidence

Require exact feature-PR CI and merged-main CI, quality/build/map-lockdown checks and the fictional browser suites. Keep all existing UI/media/export regression gates. Confirm current owner draft equals the actual published private snapshot and no publication is active before changing main/source pin; recheck if either changes.

Use the normal source-pin-only preparation and owner-reviewed protected publication to carry the latest private Help library into the paired Worker/Pages build. Never deploy stale public `dist`, disable the content guard, push hydrated private Help source, or execute an old source-pin plan with obsolete runtime fingerprints. Record data/source/content/build identities and both deployments, then verify authenticated lookup, private access denials, originals controls and clear publication lock.

Accepted local evidence distinguishes actual-App production-provider replay (real authenticated Hono routes and strict repository, fictional session/data and in-memory R2), explicit-local provider replay, local workerd profiling and the earlier real-CSV sidecar check. These prove different boundaries. Production address freshness/completeness, physical devices and real owner mutations are not inferred. The earlier 20-million-work profile and interrupted/pre-fix browser runs remain diagnostics, not the final release gate. Current cloud CPU entitlement was not established; the conservative 250,000-work cap preserves existing plan/limits without an increase.
