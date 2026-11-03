# Local address snapshot service

This optional development service reads an existing external CSV into memory. It does not collect addresses, import records into CareAround, change the database, or expose the CSV as a public asset. It binds only to `127.0.0.1`. The production provider is documented separately in [the service runbook](address-snapshot-production-service.md).

From this checkout, run:

```sh
npm run dev:address-snapshot -- --csv /absolute/path/to/sg_addresses.csv --port 8796
VITE_ADDRESS_SNAPSHOT_PROVIDER=local CAREAROUND_ADDRESS_SERVICE_URL=http://127.0.0.1:8796 npm run dev:client
```

The external file requires these columns: `postal_code,blk_no,road_name,building,address,latitude,longitude`. Six-digit postal strings retain leading zeroes. Every CSV row remains a separate record, including addresses sharing a postal code. Invalid rows fail startup rather than disappearing silently. The service streams quoted CSV, computes its byte SHA-256, and reports the source file modification time as `preparedAt` and the service load time separately as `loadedAt`. The preparation evidence is explicitly file metadata, not a claim about when each source address was verified. An optional `--expected-sha256 HASH` startup argument rejects a changed source before serving it. Metadata states that the source has mixed ages and incomplete coverage. Neither responses nor startup errors reveal the external filesystem path.

The optional Vite proxy `/__carearound-addresses` is installed only when `CAREAROUND_ADDRESS_SERVICE_URL` names a loopback HTTP origin. Existing map-asset and API proxies are retained. Only an explicit development build using `VITE_ADDRESS_SNAPSHOT_PROVIDER=local` selects this proxy. Production defaults to the authenticated API and ignores this local selector. The local provider sends no cookies or session headers; unavailable searches show a retryable error rather than invented zero results. Direct service requests with nonlocal Host or Origin headers are rejected; no cross-origin access headers are enabled.

`GET /metadata` returns `{snapshot}`. `POST /nearby` accepts `{lat,lng,radiusMeters,limit,snapshotSha256}` with a radius from 1 to 10,000 metres. `POST /area` accepts `{area,offset,limit,snapshotSha256}`. The area is a geographic circle `{type:'circle',center:[lat,lng],radiusMeters}` or GeoJSON Polygon/MultiPolygon with closed `[longitude,latitude]` rings. A page contains at most 1,000 records and queries accept at most 10,000 geometry points and a 1 MiB body. The UI obtains metadata then pins every request; the sidecar also accepts legacy unpinned direct development queries and returns 409 for a supplied mismatched pin. Results include `total`, `offset`, `limit`, and `truncated`; CSV export must continue paging until every match is fetched. Snapshot order is deterministic, nearby rows are ordered by geographic distance, and spatial bins prefilter each query. Outer and hole boundaries count as inside; hole interiors do not. Multipart islands form a union. Antimeridian-crossing polygon rings are rejected.

Area calculations reuse the renderer's rotated rectangle and rounded polygon helpers. Imported KML rings retain multipart and hole geometry. Circle radii use the same geographic Earth-distance model and 1 m visible minimum as Leaflet. CSV cells are quoted and spreadsheet-formula protected; exported postal strings use an apostrophe prefix to preserve leading zeroes in spreadsheet applications.

Run focused checks with `npm run test:address-snapshot`. Production hosting, refresh/collection, remote storage, physical-device acceptance, commits, and deployment remain separate work.
