# Session Handoff

Last updated: 2026-05-28 (Asia/Singapore)

## Current Repo State

- Repository: `https://github.com/GudPerson/Senior-Resource-Map.git`
- Default branch: `main`
- Current production/GitHub source: `b7af05c4` - `Fix mobile WhatsApp auth handoff`
- Current docs reset branch in this checkout: `codex/refresh-carearound-state-docs`
- Current fresh checkout used by this session: `/Users/sweetbuns/CareAroundSG`
- Historical working checkout: `/Users/sweetbuns/Documents/Senior-Resource-Map`

The historical checkout is still the path named in `AGENTS.md`, but this fresh chat could not read it because macOS blocked access to the Documents folder. The current working copy was cloned cleanly from GitHub so the state could be re-grounded from committed code instead of stale chat context.

## Production Alignment

As of this refresh:

- GitHub `main` points to `b7af05c4`.
- Cloudflare Pages Production lists deployments from source `b7af05c`.
- `https://app.carearound.sg` serves the current app shell.
- `https://senior-resource-map-api.joshuachua79.workers.dev/api/health` returns OK.

CareAround has previously had Preview and Production drift. For future release work, keep verifying Cloudflare deployment source with:

```bash
npx wrangler pages deployment list --project-name senior-resource-map
```

Do not assume GitHub branch state alone proves what production is serving.

## GitHub Branch State

Most remote `codex/*` branches are merged into `main`, including:

- `codex/partner-org-staff-handover`
- `codex/phone-login-phase4a`
- `codex/phone-identity-phase2a`
- `codex/client-route-recovery`
- `codex/security-foundation`
- `codex/secure-multilingual-foundation`
- `codex/partner-private-detail`
- `codex/refine-collateral-import`

One known remote branch is not merged:

- `codex/phone-login-rate-limit-fix`

That branch diverged from an older phone-login base. It is many commits behind `main`, so do not restart work from it wholesale. If any behavior from it is still needed, compare it against the current WhatsApp/auth implementation and cherry-pick only the smallest relevant pieces.

## Latest Committed Work On Main

Recent committed stabilization and product work includes:

- mobile WhatsApp auth handoff fix
- smoke selector stabilization for saved resources
- offering contact field parity between manual create/edit and Import Material review
- form upload API hardening
- social channel icon rendering
- admin resource bootstrap stabilization
- collateral import batch-save hardening
- managed resource search and soft-asset search fixes
- Import Material refresh review
- organisation governance foundation
- public WhatsApp contact sharing
- restricted-content viewer hardening
- AI enrichment stabilization
- translation review streamlining
- dashboard logo containment
- My Map resource notes, per-note sharing, shared-note snapshots, and shared-note translation

## Current Source Of Truth

Use these files before implementation:

- `AGENTS.md` - repository guardrails
- `docs/carearound-ai-orchestrator.md` - role/risk routing for CareAround work
- `docs/regression-ledger.md` - locked behavior, known-good references, deploy gates, and acceptance criteria
- `docs/release-checklist.md` - release validation checklist
- `README.md` - product map and feature relationship overview

Treat older handoff text, old branch names, and stale roadmap items as historical unless they are re-confirmed against GitHub `main` and the regression ledger.

## Stack And Runtime

- Client: React, Vite, TypeScript, Tailwind CSS
- UI: Radix UI, lucide-react, Vaul, React Select
- Maps: Leaflet, React Leaflet, marker clustering, geolib
- Data/import/export: `@e965/xlsx`, PapaParse, file-saver, html-to-image
- Server: Hono on Cloudflare Workers, with a local Node runtime path
- Database: Neon Postgres through Drizzle ORM
- Verification: Node test runner, Playwright smoke tests, browser/manual UAT where needed
- Deployment: Cloudflare Pages for the client, Cloudflare Workers/Wrangler for the API

## Active Guardrails

- Check `git status --short --branch` before edits.
- Use a `codex/` branch for feature, fix, or documentation work unless the user explicitly asks for direct `main` changes.
- Read nearby implementation and the matching regression-ledger row before touching stable flows.
- Preserve `.env` files and never print, copy, commit, or summarize secret values.
- Prefer narrow fixes over broad rewrites.
- Update `docs/regression-ledger.md` when behavior is recovered, stabilized, newly locked, or used as release evidence.
- Verify localhost readiness before asking the user to test local UAT.

## Locked Product Surfaces

The regression ledger currently treats these as locked or stabilized:

- Discover
- Auth session continuity
- Auth transition handoff
- My Directory saved assets
- Private Maps interactive
- Private Maps print/export
- My Map resource notes
- Shared maps
- Dashboard resources/admin
- Workbook import/export
- Subregion boundary upload
- SG postal fallback for place writes
- Hard asset boundary visibility
- Asset create/edit forms
- Resource detail contact/social links
- AI enrichment
- Import Material refresh saves
- Restricted resource notes/files
- Pilot governance foundation
- Direct hard-asset access and local audience zones
- Secure multilingual foundation
- Client route recovery
- Phone identity uniqueness
- WhatsApp phone login and signup

Do not reopen these surfaces casually. If a request touches one, inspect the ledger row first and preserve the documented acceptance criteria.

## Useful Commands

```bash
git status --short --branch
npm run test:server
npm run build:client
npm run test:smoke
npm run verify:release
```

For local app verification:

```bash
npm run dev:server
npm run dev:client
```

Before telling the user localhost is ready, confirm:

- `http://localhost:5173/dashboard/resources`
- `http://localhost:8787/api/auth/me`

## Recommended Next Step

Finish this state reset first:

1. Keep these docs aligned with GitHub `main` and production source.
2. Run baseline verification from the current checkout.
3. Then choose the next feature from remaining future work, likely in-app alerts, partner analytics, or AI social-prescribing planning.

Do not restart Personal Resource Notes for My Map. That feature is already implemented and locked as My Map resource notes.
