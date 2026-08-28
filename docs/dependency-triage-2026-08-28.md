# Dependency advisory triage — 2026-08-28

## Current evidence

A fresh read-only `npm audit --json` against the committed lockfile reported:

- 0 critical
- 8 high
- 6 moderate
- 1 low
- 15 total affected packages

An audit severity is a warning about an affected package version, not proof that CareAround SG exposes every described exploit. No dependency, manifest, or lockfile was changed during this closeout.

## Direct dependencies

| Dependency | Installed | Role in CareAround SG | Assessment | Recommended direction |
| --- | ---: | --- | --- | --- |
| `hono` | 4.12.16 | Production API routing, CORS, cookies, and JWT helpers | High-priority patch. Several advisories concern adapters or SSR features this Worker does not use, but Hono is a central production boundary. CareAround supplies an origin allowlist, CSRF guard, and request limits, which mitigate some CORS/request risks but do not justify retaining an affected core version. | Patch in an isolated dependency branch and rerun all server, client, build, smoke, origin, cookie, and GudAuth contracts. |
| `drizzle-orm` | 0.30.10 | Production database access | High-priority but higher-blast-radius upgrade. The identifier-escaping advisory is relevant to a database core dependency. The only application `sql.raw` identifier use found is protected by a fixed alias allowlist, reducing the confirmed present injection path. Moving to 0.45.2 is a semver-major change in the `0.x` series. | Dedicated Drizzle compatibility project; do not combine with schema migration. Exercise every query family and migration validator before release. |
| `react-router-dom` / `react-router` | 7.13.1 | Production single-page navigation | Patch soon. Many advisories target RSC/data-router server features not used by this BrowserRouter SPA, but navigation/open-redirect handling remains shared code. | Patch together, then run full client tests, build, auth-return, shared-link, resource-link, and browser-history UAT. |
| `@hono/node-server` | 1.19.14 | Local Node server adapter | Lower production exposure: Cloudflare Worker production does not use this adapter and no `serveStatic` use was found. The installed version is one patch behind the indicated fix. | Include in the Hono patch batch and rerun local API tests. |
| `vite` | 7.3.1 | Development server and production client build tooling | Primarily developer/build-host exposure; the cited file-path issue is Windows-specific. It is not client runtime code, but affected build tooling should not remain stale. | Patch with the frontend toolchain batch and compare built artifact behaviour. |
| `postcss` | 8.5.6 | CSS build pipeline | Primarily build-time source-map/file-read exposure. | Patch with Vite/Tailwind build tooling and visually check core screens. |
| `drizzle-kit` | 0.21.4 | Development migration generation | The available audit fix is a semver-major update and brings transitive `esbuild` changes. It is not the production query runtime. | Upgrade only with the Drizzle compatibility project; validate generated SQL and manifest hashes without applying it to production. |

## Transitive dependencies

- `dompurify` 3.4.8 is optional through `jspdf`, used by client export tooling rather than imported directly by CareAround source. Treat it as runtime-reachable through PDF generation until a built-bundle check proves otherwise. Resolve through a compatible `jspdf`/lockfile update and repeat export UAT.
- `nanoid` 3.3.11 is brought in by PostCSS and is build tooling in this repository.
- `brace-expansion` 2.0.2 is brought in by the old Drizzle Kit toolchain.
- `@babel/core` 7.29.0 is brought in by the Vite React plugin and is build tooling.
- affected `esbuild` versions enter through both Drizzle Kit and the frontend build chain.

## Safest implementation order

1. **Patch-only web/API batch:** Hono, the Node adapter, React Router, Vite/PostCSS, and compatible transitives. Commit lockfile changes together only when `npm install` produces the reviewed versions. Run the complete quality gate and production smoke before release.
2. **PDF/export dependency check:** update the compatible jsPDF/DomPurify path and run PNG/PDF/print regression checks.
3. **Drizzle compatibility project:** upgrade Drizzle ORM and Drizzle Kit without applying any database change; validate query generation, schema comparison, migration generation, and full functional coverage.
4. Rerun `npm audit` and record residual advisories plus code-level applicability.

The first batch is an essential near-term fix. The Drizzle work is also essential, but separating it prevents a package upgrade from being confused with a production schema migration.
