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
