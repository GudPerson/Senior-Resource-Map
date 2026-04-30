# CareAround SG Agent Guardrails

These instructions apply to the whole repository. Treat this project as an evolving production codebase where preventing regressions matters as much as shipping the next improvement.

## Start Every Task Safely

- Work from the active repo root only: `/Users/sweetbuns/Documents/Senior-Resource-Map`.
- Before changing code, check the current branch and worktree state with `git status --short --branch`.
- Inspect the existing architecture and nearby implementation before proposing or editing anything.
- Preserve `.env` files and never print, copy, commit, or summarize secret values.
- Use a `codex/` branch for new feature or bug-fix work unless the user explicitly asks for a direct `main` change.
- Do not use archived or old checkout folders unless the user specifically asks to recover old work.

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
- When a behavior is recovered, stabilized, newly locked, or used as release evidence, update `docs/regression-ledger.md` with the current behavior, known-good reference, reproduction steps, acceptance criteria, and verification result.

## Deployment Discipline

- Do not deploy a stabilization fix until the relevant validation passes and the affected behavior has been checked against the regression ledger.
- Record production or preview deployment details in the final handoff when a deploy happens.
- If a production regression appears after a deploy, prioritize a narrow rollback or targeted fix over broader improvement work.
