# Dependency advisory triage — 2026-08-28

## Baseline evidence

A fresh read-only `npm audit --json` against the committed lockfile reported:

- 0 critical
- 8 high
- 6 moderate
- 1 low
- 15 total affected packages

An audit severity is a warning about an affected package version, not proof that CareAround SG exposes every described exploit. No dependency, manifest, or lockfile was changed during this closeout.

## Patch web/API candidate

The isolated branch `codex/dependency-patch-web-api-20260828`, based on released `main` at `b264dd3cf`, now carries only the first remediation batch:

- `hono` 4.12.16 -> 4.12.34
- `@hono/node-server` 1.19.14 -> 1.19.17
- `react-router-dom` / `react-router` 7.13.1 -> 7.18.2
- `vite` 7.3.2 -> 7.3.6
- `postcss` 8.5.13 -> 8.5.26
- compatible `nanoid` 3.3.11 -> 3.3.18

React Router 7.18.2 is a same-major minor update rather than a literal patch. It is the minimum current advisory-clearing line; 7.13.2 remains affected by later high-severity advisories. The batch does not change Drizzle ORM, Drizzle Kit, schema files, migrations, database configuration, application source, or production data.

After the candidate lockfile was installed, `npm audit --json` reported 0 critical, 2 high, 5 moderate, and 1 low affected packages (8 total). No Hono, Hono Node adapter, React Router, Vite, PostCSS, or Nano ID finding remains. The residual findings are intentionally separated: Drizzle ORM/Kit and their old build-tool chain, jsPDF's optional DOMPurify path, and one low Babel build-tool advisory.

Candidate verification passed ordered migration validation, the 415-module/1,232-edge no-cycle check, server 594/594, client 700/700, `git diff --check`, the standard client build, and the production-configured Detailed-map build.

## First-batch release evidence

The approved batch was merged through pull request 43 to `main` at
`37b4b792b` on 2026-08-28. The pull-request and post-merge GitHub quality gates
passed (`33148675184` and `33148740622`); Cloudflare Pages also reported
successful builds. Legacy Netlify preview checks failed, but Netlify is not a
supported CareAround release path and no Netlify deployment was accepted as
release evidence.

The production Worker release-line guard confirmed clean, synchronized `main`
before deploying Worker version `f287a000-5d17-4a48-b945-db1b655a3f0c`.
The exact production-configured client artifact was then published to
`https://8c879035.senior-resource-map.pages.dev`. The Pages deployment and
`https://app.carearound.sg` served `assets/index-Bnvtvecv.js` with SHA-256
`e307ffb30fd6e6192550b69e56ded8a1ab1708d00de056f5fd81e08310095864`.
All 82 deployed static files matched the validated local artifact byte for
byte, and the required API plus six fixed-map roots remained present.

Production API health and `/discover` returned 200/OK. The credentialed
production smoke suite passed 6/6, covering public load, partner login and
managed resources, postal-import draft review, temporary map creation with
cleanup, saved-resource detail, and the schedule editor without saving. No
schema, migration, production-data, secret, Neon recovery setting, or provider
configuration changed in this release.

## PDF/export dependency release

The separate branch `codex/dependency-patch-pdf-export-20260828`, based on
released `main` at `65c95b134`, carries one lockfile-only change:

- `dompurify` 3.4.8 -> 3.4.14 through jsPDF's compatible optional range

CareAround already uses the current jsPDF 4.2.1 and jsPDF AutoTable 5.0.8, so
no direct dependency or application-source change is required. The candidate
does not change package manifests, Drizzle ORM/Kit, schema files, migrations,
database configuration, runtime settings, secrets, or production data.

After installing the candidate lockfile, `npm audit --json` reported 0 critical,
2 high, 4 moderate, and 1 low affected packages (7 total). No PDF/export-related
finding remains. The residual findings are the separately parked Drizzle
ORM/Kit and build-tool chain plus one low Babel build-tool advisory.

Candidate verification passed focused PDF/PNG/Print View and map-export coverage
89/89, the locked map-export gate 90/90, ordered migration validation, the
415-module/1,232-edge no-cycle check, server 594/594, client 700/700,
`git diff --check`, the standard client build, and the exact production-configured
six-root build. A real two-page A3 document was generated with jsPDF 4.2.1,
rendered to images, and visually inspected: both landscape and portrait pages
were centred, unclipped, and free of broken or overlapping content. The PDF
contained no JavaScript and was not encrypted.

The approved candidate was merged through pull request 44 to `main` at
`608e79c655` on 2026-08-28. The pull-request and post-merge GitHub quality gates
passed (`33155357558` and `33155425036`), and the supported Cloudflare Pages
preview check passed. Legacy Netlify preview checks failed again, but Netlify is
not a supported CareAround release path.

The exact validated 82-file client artifact was published to
`https://cdd609b0.senior-resource-map.pages.dev`. Every file matched the local
artifact and `https://app.carearound.sg` by byte length and SHA-256; the aggregate
manifest SHA-256 is
`c3065b275deb7e30514ab7072ef8a5c989b5b94714ea621e12b1c31c5402d2e4`.
All six fixed-map roots and required export markers remained present, while the
retired labels remained absent. The production app and `/discover` returned 200,
and the production API health endpoint returned OK.

Authenticated production Export View UAT reached `Map ready to download`,
downloaded a 7,280,650-byte A3 PDF, and visually verified its rendered map, QR
code, resource columns, labels, and pins with no clipping, overlap, black boxes,
or corruption. The PDF reported jsPDF 4.2.1, no JavaScript, and no encryption;
its SHA-256 is
`9e416c4279f9dded3b14620cd02289392be6158812887b63da5777d54eb7b1f3`.
The credential-based aggregate production smoke was not rerun because its
credentials were absent from the release shell; this targeted authenticated
export UAT and the same-day prior 6/6 smoke are recorded separately. No Worker,
schema, migration, production-data, secret, Neon recovery setting, or provider
configuration changed in this release.

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

- `dompurify` was optional through `jspdf`, used by client export tooling rather than imported directly by CareAround source. The isolated PDF/export candidate resolves it from 3.4.8 to compatible 3.4.14 and verifies that the updated sanitizer is present in the production-style bundle; focused and rendered PDF checks pass.
- `nanoid` 3.3.11 is brought in by PostCSS and is build tooling in this repository.
- `brace-expansion` 2.0.2 is brought in by the old Drizzle Kit toolchain.
- `@babel/core` 7.29.0 is brought in by the Vite React plugin and is build tooling.
- affected `esbuild` versions enter through both Drizzle Kit and the frontend build chain.

## Safest implementation order

1. **Patch-only web/API batch:** Hono, the Node adapter, React Router, Vite/PostCSS, and compatible transitives. Commit lockfile changes together only when `npm install` produces the reviewed versions. Run the complete quality gate and production smoke before release.
2. **PDF/export dependency check:** released through the compatible DOMPurify lock update; local PNG/PDF/print coverage, exact artifact parity, and authenticated production Export View PDF UAT passed.
3. **Drizzle compatibility project:** upgrade Drizzle ORM and Drizzle Kit without applying any database change; validate query generation, schema comparison, migration generation, and full functional coverage.
4. Rerun `npm audit` and record residual advisories plus code-level applicability.

The first batch is an essential near-term fix. The Drizzle work is also essential, but separating it prevents a package upgrade from being confused with a production schema migration.
