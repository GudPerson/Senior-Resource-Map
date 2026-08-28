# CareAround SG session handoff

Updated: 2026-08-28 (Asia/Singapore)

## Start here

- Repository: `/Users/sweetbuns/CareAroundSG`
- Production app: `https://app.carearound.sg`
- Production API: `https://api.carearound.sg/api`
- Release platform: Cloudflare Pages for the client and Cloudflare Worker for the API.
- Production database: Neon PostgreSQL. Never print the connection value or run a migration without the exact environment, migration IDs, backup/restore evidence, and explicit approval.
- Read `AGENTS.md`, `docs/regression-ledger.md`, and `docs/release-checklist.md` before changing a locked surface.

## Protected workspace state

The primary checkout is intentionally dirty on `codex/offering-filtered-export-parity`. It contains unrelated user/agent work, including the filtered-export feature and local guardrail/tooling files. Do not stage, reset, merge, clean, or release from that checkout.

The Phase 1 closeout was prepared in the isolated worktree:

- path: `/Users/sweetbuns/CareAroundSG-gudauth-contract-regression`
- branch: `codex/gudauth-contract-regression`
- base: production GudAuth recovery on `main` at `44d426d38`
- existing contract commit: `9fdc296a8 test: lock GudAuth create-to-poll contract`

The closeout release is now on `main`:

- release evidence commit: `f5d7db465 chore: close Phase 1 stabilisation evidence`
- GitHub quality gate: passed, run `33143696960`
- Cloudflare Pages production deployment: `https://55f0288b.senior-resource-map.pages.dev`
- custom-domain parity: `https://app.carearound.sg` and the Pages deployment both served `assets/index-C7PWBBaG.js` with SHA-256 `28dc428f0af30a030bb40bf316cced80c070552e9b44bca117b4f73119498d35`
- post-deployment production smoke: 6/6 passed; zero smoke-map fixtures remained
- Worker/API deploy: not required and not performed

The first dependency remediation batch is isolated and release-pending:

- path: `/Users/sweetbuns/CareAroundSG-dependency-patch`
- branch: `codex/dependency-patch-web-api-20260828`
- base: released `main` at `b264dd3cf`
- source scope: `client/package.json`, `server/package.json`, `package-lock.json`, and closeout/handoff evidence only
- updated packages: Hono 4.12.34, Hono Node adapter 1.19.17, React Router 7.18.2, Vite 7.3.6, PostCSS 8.5.26, and Nano ID 3.3.18
- Drizzle ORM/Kit, schema, migrations, database configuration, application source, and production data: unchanged
- local verification: migration validator passed; 415 modules / 1,232 relative imports with no cycle; server 594/594; client 700/700; standard and production-configured Detailed-map builds passed
- fresh audit: 0 critical, 2 high, 5 moderate, 1 low; all remaining findings are outside this batch
- release state: not pushed or deployed; production smoke pending release approval

Ignore untracked `graft/` indexes and generated Playwright output when reviewing release source. Stage only explicitly named task files.

## Stable production behaviour

- The user confirmed WhatsApp sign-in in production opens WhatsApp, returns to the original browser tab, and completes as intended after `44d426d38`.
- Production smoke passed 6/6 on 2026-08-28: public app loading, partner password login, managed-resource entry and postal-import draft, create-map with API cleanup, saved-resource detail, and the reviewed multi-session schedule editor without saving.
- The smoke cleanup now supplies the app `Origin` header required by the established CSRF guard. Four old `Smoke Map` fixtures were removed through the authenticated API and zero remained after the passing run.
- The complete local quality gate passed: ordered migration validation, 415 source modules and 1,232 relative imports with no cycle, server 594/594, client 700/700, clean diff whitespace, and the production client build.

## Closeout evidence

- `docs/stabilisation-closeout-2026-08-28.md`: scope and release gate.
- `docs/database-assurance-2026-08-28.md`: read-only production schema comparison and historical fallback-account audit.
- `docs/dependency-triage-2026-08-28.md`: current 15-package advisory triage and staged upgrade order.
- `server/scripts/audit_schema_alignment.mjs`: metadata-only schema comparison with hashed connection identifiers.
- `server/test/schemaAlignmentAudit.test.js`: audit normalization and drift tests.
- `server/test/phoneLogin.test.js`: GudAuth provider challenge-verifier contract.
- `tests/smoke/pre-ship.spec.mjs`: CSRF-compatible setup and cleanup requests.
- `docs/regression-ledger.md`: current acceptance evidence and locked behaviour.

## Confirmed database state

- All 60 expected public tables and all 604 expected columns exist with matching data types.
- All 18 current production accounts were checked in memory against the removed bulk-import fallback credential; zero matched and no account was changed.
- No hard or soft asset currently uses the two legacy `partner_id` ownership links whose production delete action differs from source.
- Structural drift remains and is documented. The normalized login indexes are not applied.
- Dated provider-console evidence confirms a six-hour point-in-time recovery window, no snapshots, and no backup schedule. A restore rehearsal has not been performed.

## Do not do

- Do not run a production migration or schema bootstrap.
- Do not change dependencies or the lockfile as part of this closeout.
- Do not expose or rotate secrets.
- Do not delete or reset the primary dirty checkout.
- Do not mix the filtered-export work into this closeout.
- Do not claim migration-ready backup/restore coverage until a scheduled snapshot exists and a non-production recovery rehearsal is recorded.
- Do not push or deploy the dependency candidate without explicit release approval and post-deployment smoke.

## Remaining risks and next decision

1. **Dependency remediation:** the Hono/React Router/Vite/PostCSS candidate is locally green and reduces the audit to 2 high, 5 moderate, and 1 low affected packages. Release review and production smoke remain pending; Drizzle ORM/Kit stays separate because it has database-wide blast radius.
2. **Migration readiness:** production schema changes remain frozen until scheduled snapshots exist, recovery is rehearsed outside the production branch, and a reviewed reconciliation plan exists.
3. **Schema drift:** source and production differ in nullability, two legacy foreign-key actions, one legacy audience-zone link, a share-token index definition, and legacy enums.
4. **Private-file quota:** aggregate storage quota control remains the one original Phase 1 finding not implemented.

Recommended next step: review and explicitly approve release of the isolated dependency candidate, then run the normal merge/deploy gate and post-deployment smoke. Keep the PDF/export and Drizzle compatibility work as later, separate goals.
