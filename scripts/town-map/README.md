# Local W01 fixed town-map assets

These scripts expose the accepted CCK/W01 fixed map to the local CareAround SG
proof without copying the source JPEGs into the repository or client bundle.
The source folder remains read-only.

Generate the deterministic web-surface manifest:

```sh
node scripts/town-map/generate-w01-manifest.mjs
node scripts/town-map/generate-w01-gray-manifest.mjs
```

Then run the allowlisted local asset server:

```sh
node scripts/town-map/serve-w01-assets.mjs
```

The CareAround client asset base is:

```text
http://127.0.0.1:4174/v1/w01
```

Start the local client proof with the feature gate and versioned asset base:

```sh
VITE_TOWN_MAP_PROOF_ENABLED=true \
VITE_TOWN_MAP_ASSET_BASE_URL=http://127.0.0.1:4174/v1/w01 \
VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=http://127.0.0.1:4174/v1/w01/gray \
npm run dev:client
```

`Default | Gray` is one device-level preference shared by Discover, My Maps,
Shared Maps, and print rendering. Live maps use OneMap `Default_HD` or
`Grey_HD`. In the owner-only W01 proof, `Standard | Detailed` remains a separate
cartography control and Detailed turns on automatically at zoom 15. Detailed
uses the accepted colour or native OneMap Grey fixed surface without applying a
browser grayscale filter. Both manifests are preloaded so a Detailed colour
switch does not fall through to live tiles.

For a dormant or rollback production client build, omit all
`VITE_TOWN_MAP_*` variables. Every existing map then keeps its unflagged
behavior. Hosted builds must use the approved versioned R2 base below; never use
the local `127.0.0.1` base in a deployed client.

The server exposes only:

- `/v1/w01/manifest.json`
- the 300 manifest-listed files under `/v1/w01/chunks/`
- `/v1/w01/gray/manifest.json`
- the 88 manifest-listed files under `/v1/w01/gray/chunks/`

It supports `GET`, `HEAD`, and CORS preflight, sends immutable one-year cache
headers for versioned chunks, and does not expose the rest of the SG MAP tree.

Optional environment overrides:

- `TOWN_MAP_SOURCE_ROOT`: read-only SG MAP source root
- `TOWN_MAP_MANIFEST_OUTPUT`: generator output path
- `TOWN_MAP_MANIFEST_PATH`: server manifest path
- `TOWN_MAP_GRAY_MANIFEST_OUTPUT`: Gray manifest generator output path
- `TOWN_MAP_GRAY_MANIFEST_PATH`: local Gray server manifest path
- `TOWN_MAP_ASSET_HOST`: server bind host (default `127.0.0.1`)
- `TOWN_MAP_ASSET_PORT`: server port (default `4174`)

## Versioned R2 delivery

The hosted rollout uses a dedicated `carearound-town-map-assets` bucket and the
versioned public bases `https://maps.carearound.sg/v1/w01` and
`https://maps.carearound.sg/v1/w01/gray`. Uploads remain allowlist-only: the 300
accepted colour JPEGs and 88 accepted Gray JPEGs are read from the source folder
and are never copied into the CareAround client or repository.

The account owner enabled R2 on 2026-07-11. The bucket was created and
configured with:

```sh
npx wrangler r2 bucket create carearound-town-map-assets --location apac --storage-class Standard
npx wrangler r2 bucket cors set carearound-town-map-assets \
  --file scripts/town-map/r2-cors.json --force
```

Validate every local source byte without uploading, then publish all immutable
chunks before the short-cache manifest:

```sh
npm run town-map:r2:plan
npm run town-map:r2:upload
npm run town-map:gray:r2:plan
npm run town-map:gray:r2:upload
```

Connect `maps.carearound.sg` to the bucket with minimum TLS 1.2 after resolving
the existing `carearound.sg` zone ID. Do not enable the `r2.dev` development
hostname:

```sh
npx wrangler r2 bucket domain add carearound-town-map-assets \
  --domain maps.carearound.sg --zone-id <carearound-zone-id> --min-tls 1.2 --force
```

Verify CORS, cache metadata, all 300 object sizes and SHA-256 hashes, total
bytes, and delivery timings through the custom domain:

```sh
npm run town-map:r2:verify
npm run town-map:gray:r2:verify
```

After that verification passes, build a Pages preview or production client
with:

```sh
VITE_API_URL=https://api.carearound.sg/api \
VITE_TOWN_MAP_PROOF_ENABLED=true \
VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v1/w01 \
VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v1/w01/gray \
npm run build:client
```

The immediate rollback is a Pages rebuild with every `VITE_TOWN_MAP_*` variable
omitted, restoring the already verified dormant production behavior without an
API, schema, data, or R2 mutation.

## Native-scale islandwide asset upgrade

The validated 2026-07-22 collection remains outside the repository at:

```text
/Users/sweetbuns/Documents/SG MAP/output/native-scale-readability-edition/default
/Users/sweetbuns/Documents/SG MAP/output/native-scale-readability-edition/gray
```

Its published immutable R2 roots are:

```text
https://maps.carearound.sg/v2/native-scale-20260722/default
https://maps.carearound.sg/v2/native-scale-20260722/gray
```

The R2 planner detects the collection's packaged `surfaces/<id>/chunks`
directories. It continues to support the legacy v1 source layout for rollback.
Validate the full local allowlist and object plan without uploading:

```sh
node scripts/town-map/upload-islandwide-r2.mjs \
  --style=default \
  --manifest-root="/Users/sweetbuns/Documents/SG MAP/output/native-scale-readability-edition/default" \
  --prefix=v2/native-scale-20260722/default

node scripts/town-map/upload-islandwide-r2.mjs \
  --style=gray \
  --manifest-root="/Users/sweetbuns/Documents/SG MAP/output/native-scale-readability-edition/gray" \
  --prefix=v2/native-scale-20260722/gray
```

For local UAT, serve both style roots from the read-only collection:

```sh
TOWN_MAP_MANIFEST_ROOT="/Users/sweetbuns/Documents/SG MAP/output/native-scale-readability-edition/default" \
TOWN_MAP_R2_PREFIX=v2/native-scale-20260722/default \
npm run dev:islandwide-town-map-assets
```

Then build or run the client with the corresponding local bases:

```sh
VITE_TOWN_MAP_PROOF_ENABLED=true \
VITE_TOWN_MAP_ASSET_BASE_URL=http://127.0.0.1:4174/v2/native-scale-20260722/default \
VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=http://127.0.0.1:4174/v2/native-scale-20260722/gray \
npm run dev:client
```

Do not upload `source-cache`, QA viewers, or print-master files into these
interactive roots. The 2026-07-23 release published all immutable chunks first,
then the 32 surface manifests,
and the short-cache collection index last for both styles. Full remote
verification matched all 2,741 chunks and source bytes per style. Keep
`/v1/islandwide` and `/v1/islandwide/gray` intact for immediate rollback.

## Islandwide Print Master collections

Print Master is a print-only, 100%-retained companion to the interactive 50%
native-scale collection. It is never included in the client bundle or used as
the interactive Leaflet surface. The client fetches the selected surface only
after an owner explicitly chooses `Save print master PDF`, then composes only
the chunks intersecting the current print viewport.

External source and packaged roots:

```text
Default source: /Users/sweetbuns/CareAroundSG-print-assets/default
Gray source: /Users/sweetbuns/Documents/SG MAP/output/static-town-maps-grey/print-master-100
Web package: /Users/sweetbuns/CareAroundSG-print-assets/web/v2/print-master-100-20260723
```

The Default generator reads the accepted OneMap source atlas without writing
to it. If an accepted atlas tile is missing, fetching it requires the explicit
developer-agreement gate and writes only to the external supplemental cache:

```sh
ONEMAP_DEVELOPER_AGREEMENT_ACCEPTED=yes \
python3 scripts/town-map/build-default-print-master.py --plate-id ALL --fetch-missing
```

Prepare and validate public-only packages before upload:

```sh
node scripts/town-map/prepare-print-master-web-assets.mjs --style=default
node scripts/town-map/prepare-print-master-web-assets.mjs --style=gray
node scripts/town-map/upload-print-master-r2.mjs --style=default
node scripts/town-map/upload-print-master-r2.mjs --style=gray
```

Publish each style in the guarded order of immutable chunks, sanitized surface
manifests, and collection index last:

```sh
node scripts/town-map/upload-print-master-r2.mjs --style=default --apply
node scripts/town-map/upload-print-master-r2.mjs --style=gray --apply
node scripts/town-map/verify-print-master-r2.mjs --style=default
node scripts/town-map/verify-print-master-r2.mjs --style=gray
```

Production roots:

```text
https://maps.carearound.sg/v2/print-master-100-20260723/default
https://maps.carearound.sg/v2/print-master-100-20260723/gray
```

Never publish local `path`, cache, source-section, PDF, or viewer fields. The
packager rejects missing or hash-drifted chunks and emits only JPEG chunks,
sanitized manifests, and one small collection index. Immediate client rollback
is a rebuild without both print-master environment variables; this hides the
Print Master PDF action while retaining interactive Detailed maps and all
versioned R2 objects.

## High-Detail Town Maps download library

This is a separate authenticated download catalogue. It does not feed Leaflet,
My Map, Print View, the personalised PNG/PDF exports, or the PWA cache. The
client loads the catalogue only on `/my-directory/town-maps`, and the published
PNG/PDF objects download directly from `maps.carearound.sg` rather than through
the CareAround Worker.

Read-only source collections:

```text
PDF: /Users/sweetbuns/Documents/SG MAP/output/pdf/default-native-scale-readability-175-clean
PNG: /Users/sweetbuns/Documents/SG MAP/output/png/default-native-scale-readability-175-clean-powerpoint
```

`output/compression-pilot` is forbidden. The validator reads but never modifies
the source collections. It independently verifies all 32 SHA-256 hashes and
byte sizes, PNG signatures/dimensions/RGB density metadata, PDF page geometry
and embedded attribution text, thumbnail geometry, source-to-PNG provenance,
and the exact map-code set.

Prepare the deterministic catalogue, validation, and provenance metadata under
the ignored CareAround output root:

```sh
npm run town-map:downloads:prepare
```

Run the upload command without `--apply` to produce the release plan. Dry-run is
the default:

```sh
npm run town-map:downloads:r2:plan
```

The approved second publication prefix is:

```text
v4/town-map-downloads-20260801-r2/default
```

The first prefix, `v4/town-map-downloads-20260801/default`, is an abandoned
partial publication whose catalogue was never published. Never resume,
overwrite, delete, or finalize it.

The approved second prefix was published and completely remote-verified on
2026-08-02. All 99 objects are immutable and the catalogue was published last;
do not rerun the uploader against this occupied prefix.

After explicit release approval only:

```sh
npm run town-map:downloads:r2:upload
npm run town-map:downloads:r2:verify:full
```

Operational verification requests `Accept-Encoding: identity` so Cloudflare
compression cannot remove the authoritative object `Content-Length` or weaken
the R2 ETag. Full hashes are read in bounded ranges with timeouts and retries;
PDF range delivery is checked independently. To audit an interrupted root whose
catalogue was never published, use the read-only command:

```bash
npm run town-map:downloads:r2:verify:partial
```

This command requires every planned non-catalogue object to exist and match and
requires `catalogue.json` to remain 404. It never writes, resumes, overwrites, or
deletes. A failed or interrupted apply must use a newly approved immutable
prefix; do not finalize the partial root.

The apply path first verifies Cloudflare authentication and then requires every
planned key to return 404. If any key exists, publication aborts before the
first PUT. Every individual PUT attempt repeats its key-specific 404 check, so
an ambiguous failed PUT aborts instead of retrying over an object that became
visible. The tool has no delete path and never resumes into or overwrites a
partial root; use a new versioned prefix after an interrupted publication. It
uploads the C08 PNG first and requires a query-free public GET to match its
exact byte size and SHA-256 before proceeding. It then publishes the remaining
31 PNGs, all 32 PDFs, and all 32 lightweight thumbnails, then immutable
validation/provenance metadata, and the short-revalidation
`catalogue.json` last. All other objects use one-year immutable caching. PNG
and PDF metadata includes an attachment filename; PDFs are verified with range
requests.

For local authenticated UAT, start the read-only source server and normal
client in separate terminals:

```sh
npm run dev:town-map-downloads
npm run dev:client
```

Vite proxies only `/__carearound-town-map-downloads` to the local source server.
No catalogue, thumbnail, PNG, or PDF is requested unless the town-map route is
opened. The published R2 objects are intentionally public at their exact URLs;
the CareAround module is access-protected, but object-level authentication
would require a separately approved signed-URL or gateway design.
