# Session Handoff

Last updated: 2026-05-13 (Asia/Singapore)

## Current Repo State

- Repo: `/Users/sweetbuns/Documents/Senior-Resource-Map`
- Remote: `https://github.com/GudPerson/Senior-Resource-Map.git`
- Active branch: `codex/partner-org-staff-handover`
- Tracking branch: `origin/codex/partner-org-staff-handover`
- App code status at refresh time: clean
- Documentation status at refresh time: several untracked documentation files and user-guide screenshots are present

Current untracked documentation set:

- `README.md`
- `docs/CAREAROUND_SG_PROJECT_DOSSIER.md`
- `docs/AIC_DISCLOSURE_PACK.md`
- `docs/PILOT_CONCEPT_NOTE.md`
- `docs/FUNDER_PITCH_BRIEF.md`
- `docs/PITCH_DECK_OUTLINE.md`
- `docs/COI_RISK_MANAGEMENT_PLAN.md`
- `docs/layman-language-review.md`
- `docs/user-guide-foundation.md`
- `docs/user-guide.md`
- `docs/images/user-guide/*`

Preserve these files unless the user explicitly decides they are no longer needed. They are not random generated trash; they are draft product, stakeholder, copy, and guide materials.

## Latest Branch Context

Recent commits on this branch:

- `ff1d9281` - Improve subregion boundary uploads
- `469b283b` - Refine mobile discovery filter search action
- `dedd0ddb` - Merge remote-tracking branch `origin/main` into `codex/partner-org-staff-handover`
- `2d2518a2` - Add partner organisation staff handover bridge

The most recent committed product work is focused on:

- partner organisation staff access and handover
- mobile Discover filter action simplification
- safer subregion boundary uploads

## Current Source Of Truth

Use these files before editing code:

- `AGENTS.md` - project-level agent guardrails
- `docs/regression-ledger.md` - locked surfaces, known-good references, deploy gates, and regression history
- `docs/release-checklist.md` - current release validation checklist
- `README.md` - untracked product and architecture map, if kept in the worktree

Treat older preview URLs, old branch names, and old "heavily dirty" statements from previous handoff text as historical only.

## Stack And Runtime

- Client: React, Vite, TypeScript, Tailwind CSS
- UI: Radix UI, lucide-react, Vaul, React Select
- Maps: Leaflet, React Leaflet, marker clustering, geolib
- Data/import/export: `@e965/xlsx`, PapaParse, file-saver, html-to-image
- Server: Hono on Cloudflare Workers, with a local Node runtime path
- Database: Neon Postgres through Drizzle ORM
- Validation/auth support: Zod, bcryptjs, session helpers
- Verification: Node test runner for server tests, Playwright smoke tests
- Deployment: Cloudflare Pages for the client, Cloudflare Workers/Wrangler for the API

## Active Guardrails

- Work only from `/Users/sweetbuns/Documents/Senior-Resource-Map`.
- Check `git status --short --branch` before edits.
- Read nearby architecture before changing stable flows.
- Assess blast radius before implementation.
- Do not print, copy, commit, or summarize secret values from `.env` files.
- Preserve existing untracked docs unless cleanup has been explicitly confirmed.
- Prefer narrow fixes over broad rewrites.
- Update `docs/regression-ledger.md` when a locked or recovered behavior changes.

## Locked Product Surfaces

The regression ledger currently lists these as locked or stabilized surfaces:

- Discover
- My Directory saved assets
- Private Maps interactive
- Private Maps print/export
- Shared maps
- Dashboard resources/admin
- Workbook import/export
- Asset create/edit forms
- AI enrichment
- Partner-only detail content
- Secure multilingual foundation
- Client route recovery
- Phone identity uniqueness
- WhatsApp phone login and signup
- Subregion boundary upload

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

For production client deploys, ensure the client API environment is set safely before using the deploy script. Do not print secret values.

## Suggested Next Step

The immediate housekeeping step is to decide which untracked documentation files should be kept in git. A safe default is:

1. Keep the product map, dossier, stakeholder pack, guide docs, screenshots, regression ledger, release checklist, and this handoff.
2. Commit docs as a documentation package if the user wants them preserved in the repo.
3. Only delete documentation after confirming it is duplicated, obsolete, or not meant to live in this repository.

For feature work, start from the current branch and inspect the relevant ledger row before touching code.
