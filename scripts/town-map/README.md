# Local W01 fixed town-map assets

These scripts expose the accepted CCK/W01 fixed map to the local CareAround SG
proof without copying the source JPEGs into the repository or client bundle.
The source folder remains read-only.

Generate the deterministic web-surface manifest:

```sh
node scripts/town-map/generate-w01-manifest.mjs
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
npm run dev:client
```

The owner proof uses `Standard` for the OneMap surface and `Detailed` for the
accepted fixed W01 colour surface. Detailed turns on automatically at zoom 15.
The accepted source colours are unchanged by default. Set
`VITE_TOWN_MAP_GRAYSCALE=true` only when running a reversible local grayscale
comparison; the manifest bytes, hashes, bounds, labels, and attribution remain
unchanged.

For a normal production client build, omit all `VITE_TOWN_MAP_*` variables. The
proof then remains dormant and every existing map keeps its current behavior.
Do not enable the proof in a hosted build until the manifest and chunks have an
approved public versioned asset URL; never use the local `127.0.0.1` base in a
deployed client.

The server exposes only:

- `/v1/w01/manifest.json`
- the 300 manifest-listed files under `/v1/w01/chunks/`

It supports `GET`, `HEAD`, and CORS preflight, sends immutable one-year cache
headers for versioned chunks, and does not expose the rest of the SG MAP tree.

Optional environment overrides:

- `TOWN_MAP_SOURCE_ROOT`: read-only SG MAP source root
- `TOWN_MAP_MANIFEST_OUTPUT`: generator output path
- `TOWN_MAP_MANIFEST_PATH`: server manifest path
- `TOWN_MAP_ASSET_HOST`: server bind host (default `127.0.0.1`)
- `TOWN_MAP_ASSET_PORT`: server port (default `4174`)

## Versioned R2 delivery

The hosted rollout uses a dedicated `carearound-town-map-assets` bucket and the
versioned public base `https://maps.carearound.sg/v1/w01`. The upload remains
allowlist-only: the 300 accepted JPEGs are read from the source folder and are
never copied into the CareAround client or repository.

After the account owner enables the R2 subscription, create and configure the
bucket:

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
```

Only after that verification passes should a Pages preview be built with:

```sh
VITE_API_URL=https://api.carearound.sg/api \
VITE_TOWN_MAP_PROOF_ENABLED=true \
VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v1/w01 \
npm run build:client
```

The immediate rollback is a Pages rebuild with every `VITE_TOWN_MAP_*` variable
omitted, restoring the already verified dormant production behavior without an
API, schema, data, or R2 mutation.
