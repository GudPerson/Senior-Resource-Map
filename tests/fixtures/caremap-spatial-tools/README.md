# Local spatial preview

This fixture mounts the actual CareAround App, router and providers in the original owner layout. Owner identity, CareAround catalogue, saved map and raster tiles are fictional. API mutations are blocked and audited by default. It does not use production sessions, a database, or live postal verification.

Start the read-only prepared address service separately with an explicitly supplied CSV and expected SHA-256, then run:

```sh
node node_modules/vite/bin/vite.js --config tests/fixtures/caremap-spatial-tools/vite.config.mjs
```

Open `http://127.0.0.1:4496/my-directory/maps/91261103`. The fixture proxies only `/__carearound-addresses` to the local service on port 8796; `SPATIAL_SNAPSHOT_TARGET` may select another loopback test service. It does not load the project's environment files. The visible banner distinguishes fictional owner/resources from the prepared address data.

Use **Edit content → Annotate**, select a circle, box or boundary, then **Find within area**. Use **Personal place → Choose map location** and click an unoccupied point to review nearby address candidates. Candidate selection opens the existing review form; saving an addressed place still requires its normal live verification, which is not supplied by this fixture. Review and cancellation need no write permission.

The browser harness starts its own local index/service over 225 fictional rows to test pagination, shared postal strings, CSV escaping, cancellation and visible-catalogue filtering. `--snapshot=real` instead uses the existing sidecar and runs a separate bounded actual-CSV workflow. A downloaded PNG must be visually inspected for the circle and radius label; signature and dimensions alone are insufficient.

```sh
node tests/browser/caremap-spatial-tools.mjs --out=/private/tmp/caremap-spatial-qa
node tests/browser/caremap-spatial-tools.mjs --snapshot=real --out=/private/tmp/caremap-spatial-real-csv-qa
```

`PLAYWRIGHT_MODULE` can point to an already installed absolute Playwright entry module. `--case=NAME` selects one case and `--port=PORT` selects the harness Vite port. Reports bind the full client source and fixture hashes before and after each run. Synthetic, actual-CSV, physical-device and production evidence are separate.
