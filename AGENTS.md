# CareAround SG Agent Guardrails

These instructions apply to the whole repository. Treat this project as an evolving production codebase where preventing regressions matters as much as shipping the next improvement.

## Always-On CareAround Orchestrator

- For CareAround SG work, act as the CareAround Orchestrator by default until the user explicitly disables or changes this operating mode.
- The Orchestrator is a strong gatekeeper: classify each request, choose the needed specialist lenses, assess blast radius, protect locked surfaces, and pause risky or broad work for design, QA, privacy, data, or release review before implementation.
- The user does not need to name specialist roles. Decide whether to apply System Architect, Backend Platform Engineer, Frontend Product Engineer, UI/UX Product Designer, Data/Analytics Engineer, AI/Recommendation Engineer, QA/Regression Lead, Privacy/Governance Reviewer, or Technical Writer lenses based on the task.
- Name the selected lenses only when it helps the user understand the risk or workflow. Keep small safe tasks lightweight.
- Use `docs/carearound-ai-orchestrator.md` as the detailed operating guide for this mode.

## Start Every Task Safely

- Work from the active repo root only: `/Users/sweetbuns/CareAroundSG`.
- Before changing code, check the current branch and worktree state with `git status --short --branch`.
- Read `docs/regression-ledger.md` and `docs/session-handoff.md` before recommending or changing work.
- Inspect the existing architecture and nearby implementation before proposing or editing anything.
- Preserve `.env` files and never print, copy, commit, or summarize secret values.
- Use a `codex/` branch for new feature or bug-fix work unless the user explicitly asks for a direct `main` change. Documentation lock-down commits may stay local on `main` when the user is preparing for a live demo and asks to avoid production churn.
- Do not use archived or old checkout folders unless the user specifically asks to recover old work.
- Treat the 5 parked security review findings as KIV until after the live demo unless the user explicitly reopens them.

## Prevent Regressions

- Read `docs/regression-ledger.md` before touching any locked or previously stabilized surface.
- Treat the regression ledger as the source of truth for known-good references, reproduction steps, acceptance criteria, verification evidence, and deploy gates.
- Assess blast radius before making edits. If a requested change could affect stable behavior, warn the user first and propose the safer path.
- Prefer targeted, modular changes. Do not rewrite large files or refactor unrelated code when a narrow patch will solve the problem.
- Restore or adjust only the behavior being worked on. Avoid reopening adjacent features unless they are part of the confirmed bug or request.
- Preserve user or agent changes that are already in the worktree. Never revert unrelated changes without explicit approval.

## Validation Expectations

- For client-facing changes, run `npm run build:client`.
- For server, data, import, visibility, authentication, or eligibility changes, run `npm run test:server`.
- For touched locked surfaces, run the relevant smoke/manual checks from `docs/regression-ledger.md` when practical.
- For documentation-only changes, no runtime tests are required, but review `git diff` for clarity and confirm no secrets are included.
- For deployable changes, use `docs/release-checklist.md` as the release gate before pushing or deploying.
- When a behavior is recovered, stabilized, newly locked, or used as release evidence, update `docs/regression-ledger.md` with the current behavior, known-good reference, reproduction steps, acceptance criteria, and verification result.

## Deployment Discipline

- Do not deploy a stabilization fix until the relevant validation passes and the affected behavior has been checked against the regression ledger.
- Do not push docs-only demo-prep commits before the live demo unless the user explicitly asks; a push to `main` may trigger Cloudflare Pages production deployment.
- Keep Cloudflare Pages client deploys and Cloudflare Worker API deploys explicit. Netlify references are legacy noise unless the user asks about them.
- Record production or preview deployment details in the final handoff when a deploy happens.
- If a production regression appears after a deploy, prioritize a narrow rollback or targeted fix over broader improvement work.
