# CareAround SG Fresh-Chat Handoff

Last updated: 2026-06-08 (Asia/Singapore)

## Intent / Goal

CareAround SG is a Singapore senior-care discovery and coordination platform. Its core purpose is to help seniors, caregivers, care teams, and community partners find relevant support, save useful resources, and coordinate around resource information without turning every collaboration into a heavy approval workflow.

The current product pillars are:

- public Discover for care and support resources, with relevance from postal search, audience zones, and region boundaries
- My Directory and My Maps for saved assets, private maps, shared maps, and resource-detail handoff
- resource stewardship by direct resource Owner/Staff access for places, offerings, templates, and local rollouts
- lightweight organisation governance for access lists, linked assets, covered offerings, and agreements
- Org Groups and Region Groups as coordination metadata only
- Admin support coverage based on Admin Region Scope and user profile location
- audit trail for meaningful governance/resource changes, excluding everyday browsing, personal map actions, and AI chat/querying

## Operating Guardrails

- Work only in `/Users/sweetbuns/CareAroundSG`.
- Do not use archived or old checkout folders unless the user explicitly asks.
- Before code work, read `AGENTS.md`, `docs/regression-ledger.md`, and run `git status --short --branch`.
- Treat production as the source of truth for deployed behavior.
- Do not print, copy, summarize, commit, or modify secrets, `.env` values, smoke credentials, production auth, Gmail/email, GudAuth, or Worker secret values.
- CareAround SG uses Cloudflare Pages for the client and Cloudflare Worker for the API. Netlify references are legacy noise unless explicitly requested.
- Prefer narrow, ledger-backed changes. Do not refactor broad stable surfaces while fixing one issue.
- For documentation-only changes, runtime tests are not required, but run `git diff --check` and inspect the diff for accidental secrets.
- Do not patch, commit, push, or deploy when the task is a report-only review.

## Established And Locked

- Resource Owner/Staff is the operational edit lane. Organisation access, group roles, and Admin Region Scope do not grant resource edit rights by themselves.
- Organisation governance access is governance-only. Organisation Admins manage organisation Admin/Staff access; Organisation Staff can view organisation context read-only.
- Linking a place to an organisation covers hosted/linked offerings for organisation context, but does not change resource edit permissions.
- Org Groups and Region Groups are coordination metadata only. They do not grant resource ownership, publishing control, restricted notes/files access, public Discover labels, or inter-organisation approval power.
- Org Group Admins may manage Staff access inside their group but cannot grant or remove resource Owner access unless they also hold the relevant Organisation Admin or Resource Owner authority.
- Region Groups are generic cross-organisation coordination groups. All cross-organisation collaboration is intended to happen through Region Groups, but partners do not require platform approval workflows in V1.
- Platform role label is now `Admin` in the UI; the internal role key remains `regional_admin` for backward compatibility.
- Admin Region Scope is assigned by Super Admins and defines support coverage for standard users whose profile Region overlaps that scope. It does not grant resource ownership, organisation access, group access, private notes/files access, or Discover relevance.
- Standard users with no postal code or unresolved profile Region remain Super Admin-only for location/support review until the profile location is completed.
- Public Discover relevance does not depend on assigning a user to a Region. It comes from the searched/home postal context, audience-zone matches, and non-national Region boundary matches.
- Destructive actions use the shared CareAround confirmation dialog, and Admin Tools non-destructive feedback uses in-page feedback instead of native browser message boxes.
- Resource delete audit logging is idempotent: repeated delete clicks/retries should record only one delete audit row for the active-to-deleted transition.

## Current Repo And Production State

- Repo: `/Users/sweetbuns/CareAroundSG`
- Remote: `https://github.com/GudPerson/Senior-Resource-Map.git`
- Branch during latest documentation refresh: `main...origin/main [ahead 5]` before the fifth documentation batch commit.
- Local documentation refresh commits are intentionally not pushed before the live demo unless the user asks, because a push to `main` may trigger a Cloudflare Pages production deploy.
- Latest product/release commits at handoff refresh:
  - `ff30a18d` Record Discover badge deploy
  - `7bc98feb` Improve Discover location badge responsiveness
  - `49f70464` Record admin alert feedback deploy
  - `127dba91` Replace admin alerts with inline feedback
  - `9e208013` Record confirmation dialog deploy
  - `4d6c16df` Standardize destructive confirmation dialogs
- Latest local documentation commits before the fifth batch:
  - `0c0fab2a` Refresh CareAround planning guardrails
  - `517031e5` Align CareAround external pitch docs
  - `5279476e` Refresh CareAround pilot documentation
  - `3b9f1ad4` Start CareAround documentation refresh
  - `c5783fcf` Lock CareAround progress handoff
- Latest explicit Cloudflare Pages deploy recorded in the ledger: `https://da6235bc.senior-resource-map.pages.dev` for the Discover badge responsiveness release.
- Production custom domain observed at lock-down: `https://app.carearound.sg` serving `assets/index-BxOjXZRA.js`.
- Current production bundle string check found the Discover badge fast-path markers: `pendingLocationSearchOrigin` and `Recommended for this location`.
- API health at lock-down: `https://api.carearound.sg/api/health` returned `{"status":"ok","timestamp":"2026-06-08T13:10:37.998Z"}`.
- Production Discover check at lock-down: `/discover` loaded `assets/index-BxOjXZRA.js`; searching postal code `681809` requested `/discovery/location-indicators` successfully with HTTP `200`; `Recommended for this location` appeared on visible cards.
- Latest full production smoke in the ledger: `5/5` after the Admin alert feedback deploy. For the Discover badge release, the partner smoke gate was explicitly bypassed by user instruction because smoke credentials were unavailable in the shell.

## Recent Changed Files

Support coverage and Admin Region Scope:

- `client/src/pages/dashboard/AdminPage.jsx`
- `client/test/adminUserAssignmentUi.test.js`
- `client/test/adminBoundaryFilters.test.js`
- `server/test/adminSupportCoverage.test.js`
- `server/test/adminRegionScope.test.js`
- `server/test/userRoleArchitecture.test.js`
- `server/src/utils/adminSupportCoverage.js`
- `server/src/utils/adminRegionScope.js`

Region-side Admin assignment view:

- `client/src/pages/dashboard/AdminPage.jsx`
- `client/test/adminUserAssignmentUi.test.js`
- `docs/regression-ledger.md`

Resource delete audit idempotency:

- `server/src/controllers/hardAssetsController.js`
- `server/src/controllers/softAssetsController.js`
- `server/src/controllers/softAssetParentsController.js`
- `server/test/resourceDeleteAuditIdempotency.test.js`
- `client/src/pages/dashboard/AdminPage.jsx`
- `client/src/pages/dashboard/ResourcesPage.jsx`
- `client/test/resourceDeleteSubmitGuard.test.js`

Shared confirmation dialog consistency:

- `client/src/components/ConfirmDialog.jsx`
- `client/src/pages/dashboard/AdminPage.jsx`
- `client/src/pages/dashboard/ResourcesPage.jsx`
- `client/src/pages/MyDirectoryPage.jsx`
- `client/src/components/AssetAccessPanel.jsx`
- `client/src/components/AssetAudienceZonesPanel.jsx`
- `client/src/components/HardAssetImportWizard.jsx`
- `client/src/components/PhoneVerificationPanel.jsx`
- `client/src/components/admin/GovernanceOrganizationsPanel.jsx`
- `client/test/confirmationDialogConsistency.test.js`

Admin inline feedback consistency:

- `client/src/pages/dashboard/AdminPage.jsx`
- `client/test/alertFeedbackConsistency.test.js`
- `docs/regression-ledger.md`

Discover location badge responsiveness:

- `client/src/features/discover/locationIndicators.js`
- `client/src/features/discover/useDiscoveryLocation.js`
- `client/src/pages/DiscoverPage.jsx`
- `client/test/locationIndicators.test.js`
- `docs/regression-ledger.md`

Session lock-down before documentation refresh:

- `docs/session-handoff.md`

Documentation refresh first batch:

- `docs/documentation-refresh-audit-2026-06-08.md`
- `docs/user-guide.md`
- `docs/CAREAROUND_SG_PROJECT_DOSSIER.md`

Documentation refresh second batch:

- `docs/user-guide-foundation.md`
- `docs/AIC_DISCLOSURE_PACK.md`
- `docs/PILOT_CONCEPT_NOTE.md`

Documentation refresh third batch:

- `docs/FUNDER_PITCH_BRIEF.md`
- `docs/PITCH_DECK_OUTLINE.md`
- `docs/COI_RISK_MANAGEMENT_PLAN.md`

Documentation refresh fourth batch:

- `docs/next-stage-roadmap-2026-05-16.md`
- `docs/layman-language-review.md`
- `docs/carearound-ai-orchestrator.md`
- `docs/documentation-refresh-audit-2026-06-08.md`
- `docs/session-handoff.md`

Documentation refresh fifth batch:

- `AGENTS.md`
- `docs/release-checklist.md`
- `docs/documentation-refresh-audit-2026-06-08.md`
- `docs/session-handoff.md`

## Failed Attempts / Known Traps

- The previous `docs/session-handoff.md` was stale and pointed to the wrong working context. Use this refreshed file as the canonical handoff.
- Smoke tests require the smoke environment to be loaded without printing secrets. Running `npm run test:smoke` without it may fail on missing credentials or localhost connection errors.
- Smoke runs can leave generated Playwright output under `output/playwright/test-results/`; remove generated artifacts before committing unrelated work.
- Cloudflare Pages can serve a newer Git-triggered production bundle after a docs-only push. Always verify the current custom-domain index before quoting the active bundle.
- Some old Pages preview URLs and chunks remain fetchable even after production moved forward. Treat the custom domain index as the current production bundle.
- The custom domain moved from the manual deploy bundle `assets/index-B6ddWshb.js` to `assets/index-BxOjXZRA.js` after the Discover badge deploy. The current bundle was verified at lock-down and still contains the badge responsiveness fix.
- A prior duplicate-delete symptom created multiple audit entries when the confirmation dialog felt unresponsive and the user clicked delete repeatedly. Delete actions now have busy guards and server-side idempotency; do not regress this.
- Native browser `confirm(...)` and `alert(...)` boxes were recently removed from core Admin/destructive flows. Use the shared confirmation dialog and in-page feedback patterns.
- Dashboard resource loading has prior resilience fixes for transient first-page fetch failures. Avoid changing scoped resource list loading without reviewing `docs/regression-ledger.md`.
- Broad IAM and access-control changes have high blast radius. Keep Organisation access, group coordination, Admin Region Scope, and resource Owner/Staff lanes separate.

## KIV Security Fixes After Demo

The 5 review findings remain parked until after the live production demo. Do not mix these fixes into documentation refresh work.

1. Auth rate limiting can be bypassed if a caller rotates arbitrary `X-Session-Token` values.
2. Cookie-authenticated My Maps share creation needs a CSRF/origin guard because the session cookie is cross-site capable.
3. Public resource payloads expose more internal eligibility/governance metadata than public users need.
4. Session JWTs carry more personal/access data than necessary.
5. Dependency advisories still need triage and narrow upgrades or mitigations: `drizzle-orm`, `react-router` / `react-router-dom`, `hono`, `drizzle-kit`, and `esbuild`.

Recommended sequence after the demo: fix one item at a time with tests and a regression-ledger row, starting with the auth rate-limit bypass, then CSRF protection, then public payload minimization, then JWT slimming, then dependency upgrades.

## Documentation Refresh Targets

Start with a stale-document inventory instead of editing every document at once. Use `docs/regression-ledger.md` and this handoff as the operational truth, then refresh narrative documents in small batches.

Priority documentation surfaces:

- User guide: `docs/user-guide.md`, `docs/user-guide-foundation.md`, and `docs/images/user-guide/*`
- Project dossier: `docs/CAREAROUND_SG_PROJECT_DOSSIER.md`
- External/presentation packs: `docs/AIC_DISCLOSURE_PACK.md`, `docs/PILOT_CONCEPT_NOTE.md`, `docs/FUNDER_PITCH_BRIEF.md`, `docs/PITCH_DECK_OUTLINE.md`, `docs/COI_RISK_MANAGEMENT_PLAN.md`
- Product/roadmap notes: `docs/next-stage-roadmap-2026-05-16.md`, `docs/carearound-ai-orchestrator.md`, and `docs/layman-language-review.md`
- Operational references: `docs/release-checklist.md`, `docs/release-manifest-2026-05-15-asset-access-boundaries.md`, and older `docs/superpowers/*` specs/plans when they are quoted by current docs

Suggested documentation order:

1. Create a doc audit table with audience, current/stale status, and required action.
2. Update user-facing guides first so demo/support language matches the live product.
3. Update the dossier and external packs after the user guide terminology is stable.
4. Keep security fixes KIV unless the user explicitly reopens them.

First batch started on 2026-06-08:

- Added a documentation refresh audit table.
- Refreshed `docs/user-guide.md` image paths and public Discover location-badge explanation.
- Refreshed `docs/CAREAROUND_SG_PROJECT_DOSSIER.md` current-state, Organisation governance, Admin Region Scope, and notification/feedback wording.

Second batch started on 2026-06-08:

- Refreshed `docs/user-guide-foundation.md` role, permission, Organisation workspace, Admin Region Scope, Support Coverage, Audit Trail, and security KIV terminology.
- Refreshed `docs/AIC_DISCLOSURE_PACK.md` current-state, endorsement disclaimer, Organisation/Admin Region Scope limits, and after-demo security KIV caveat.
- Refreshed `docs/PILOT_CONCEPT_NOTE.md` pilot scope, data, governance outcomes, risks, and decisions needed for Organisation governance, Admin Region Scope, Audit Trail, and after-demo security remediation.

Third batch started on 2026-06-08:

- Refreshed `docs/FUNDER_PITCH_BRIEF.md` current maturity, pilot ask, governance outcomes, sustainability value, AI roadmap caveats, and security-remediation caveat.
- Refreshed `docs/PITCH_DECK_OUTLINE.md` Operations Layer, Trust/Safety, Pilot Concept, and risk wording so deck claims match current permissions and security KIV state.
- Refreshed `docs/COI_RISK_MANAGEMENT_PLAN.md` governance-scope confusion, security-readiness perception, sponsor/visibility, and operating-checklist safeguards.

Fourth batch started on 2026-06-08:

- Refreshed `docs/next-stage-roadmap-2026-05-16.md` to separate demo stability, after-demo security remediation, personal notes, notifications, analytics, and AI sequencing.
- Refreshed `docs/layman-language-review.md` for current Organisation/Admin terminology, Discover badge wording, support coverage, audit/change-history wording, and copy-batch verification notes.
- Refreshed `docs/carearound-ai-orchestrator.md` so future sessions keep documentation refresh, demo-window work, and after-demo security remediation separate.
- Updated `docs/documentation-refresh-audit-2026-06-08.md` to mark the fourth batch and identify `AGENTS.md` plus `docs/release-checklist.md` as the next engineering-operations guardrail pass.

Fifth batch started on 2026-06-08:

- Refreshed `AGENTS.md` to point future work at `/Users/sweetbuns/CareAroundSG`, require `docs/regression-ledger.md` plus this handoff for grounding, and keep docs-only demo-prep commits local unless explicitly pushed.
- Refreshed `docs/release-checklist.md` for current locked surfaces, docs-only demo-prep checks, Cloudflare Pages `VITE_API_URL=https://api.carearound.sg/api`, production smoke environment, deploy commands, health check, and parked security findings.
- Updated `docs/documentation-refresh-audit-2026-06-08.md` to mark the fifth batch and recommend pausing broad doc refresh before the live demo unless a demo-readiness runbook is needed.

## Security And Bug Review Targets

When the security review resumes after the demo, run it as report-only first. Do not patch during the first pass.

Known dependency advisories from `npm audit` at handoff refresh:

- High: `drizzle-orm` SQL identifier escaping advisory. Treat as a dedicated database-query migration risk; do not bundle with routine UI work.
- High: `react-router` / `react-router-dom` advisories, including RCE/XSS/open redirect/DoS families. Verify whether the app uses affected server/RSC/prerender/single-fetch surfaces before assigning exploitability.
- Moderate/low: `hono` advisories, including cache middleware, cookie helper, JWT scheme/date handling, IPv6 restriction, and mount-prefix behavior. Verify which Hono middleware/helpers are actually used.
- Moderate: `drizzle-kit` / `esbuild` dev-tool advisory chain. Treat as development tooling risk unless production exposure is found.

Suggested code-review focus:

- auth/session boundaries, cookie behavior, JWT/session signing, and production fallback behavior
- GudAuth/WhatsApp phone proof handoff paths without changing GudAuth or secrets
- Admin Region Scope visibility versus resource Owner/Staff permissions
- Organisation/group governance routes and final-admin protection
- private resource notes/files access checks and preview/download handling
- My Maps and Shared Maps privacy, share tokens, copied maps, and public snapshots
- Discover/public APIs for accidental private metadata, postal/profile leakage, or internal label exposure
- import/export parsing, file-size limits, row limits, and unsafe HTML/URL handling
- audit trail write conditions, metadata sanitization, duplicate writes, and scoped visibility
- Cloudflare Worker subrequest pressure and retry behavior on large governance/resource lists
- client-side XSS sinks, unsafe redirects, target URLs, storage usage, and environment values shipped to the browser

## Recommended Next Step

Pause broad documentation refresh before the live demo. If one more support artifact is useful, prepare a short demo-readiness runbook/checklist without touching production, secrets, or the parked security fixes. Keep local documentation commits unpushed unless the user explicitly asks to publish them.

## Fresh Chat Starter Prompt

```text
We are working only in:

/Users/sweetbuns/CareAroundSG

Do not use archived folders or old checkout folders unless I explicitly ask.

Before doing any work:
1. Read AGENTS.md.
2. Read docs/regression-ledger.md.
3. Read docs/session-handoff.md.
4. Run git status --short --branch.
5. Treat production as the source of truth for deployed behavior.
6. Do not print, copy, summarize, commit, or modify secrets, .env values, smoke credentials, production auth, Gmail/email, GudAuth, or Worker secret values.
7. CareAround SG uses Cloudflare Pages + Cloudflare Worker. Netlify is legacy noise.

Task:
Lock onto the current CareAround SG state and prepare a documentation refresh before editing broad documentation.

Important constraints:
- Do not edit files in the first pass.
- Do not run migrations or destructive commands.
- Do not commit, push, or deploy during the audit pass.
- Do not modify auth, Gmail/email, GudAuth, secrets, schema, or access-control behavior.
- Treat docs/regression-ledger.md and docs/session-handoff.md as the operational truth.
- Keep the 5 security fixes KIV until after the live demo unless I explicitly reopen them.
- Use plain language suitable for a live demo, user guide, and stakeholder dossier.
- First produce a documentation audit table: document, audience, current/stale status, evidence, recommended action, and risk if left stale.
- After the audit is approved, update documents in small batches and run git diff --check before committing.

Useful starting points:
- docs/user-guide.md
- docs/user-guide-foundation.md
- docs/images/user-guide/
- docs/CAREAROUND_SG_PROJECT_DOSSIER.md
- docs/AIC_DISCLOSURE_PACK.md
- docs/PILOT_CONCEPT_NOTE.md
- docs/FUNDER_PITCH_BRIEF.md
- docs/PITCH_DECK_OUTLINE.md
- docs/COI_RISK_MANAGEMENT_PLAN.md
- docs/next-stage-roadmap-2026-05-16.md
- docs/carearound-ai-orchestrator.md
- docs/layman-language-review.md
```
