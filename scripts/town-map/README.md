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
