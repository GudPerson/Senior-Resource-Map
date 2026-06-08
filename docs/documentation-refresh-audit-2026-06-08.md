# CareAround SG Documentation Refresh Audit

Last updated: 2026-06-08 (Asia/Singapore)

Purpose: identify which CareAround SG documents need refresh before wider demo, pilot, or stakeholder use. Use `docs/session-handoff.md` and `docs/regression-ledger.md` as the current operational truth.

## Audit Table

| Document | Audience | Current/stale status | Evidence | Recommended action | Risk if left stale |
| --- | --- | --- | --- | --- | --- |
| `docs/user-guide.md` | Public users, caregivers, demo viewers | Partially stale, safe to refresh first | Screenshot paths pointed to the old `/Users/sweetbuns/Documents/Senior-Resource-Map` checkout; Discover guide did not explain current location badges. | Update active-repo image paths, add plain-language location badge explanation, and keep guide public-user only. | Demo viewers may see broken images or misunderstand location badges as official endorsement. |
| `docs/CAREAROUND_SG_PROJECT_DOSSIER.md` | Founder, advisors, funders, pilot partners | Stale in high-visibility claims | Header was generated from a May 10 worktree; dossier still referenced active/uncommitted partner organisation handover work and older `regional admin` wording. | Refresh current-state summary, role language, organisation governance/Admin Region Scope wording, alert/feedback status, and roadmap. | Stakeholders may think the product is on an old branch, understate recent stability work, or misunderstand permissions. |
| `docs/user-guide-foundation.md` | Internal training and future guide planning | Second-batch refresh started | Previously used `Regional admin` in audience planning and said the handoff was historical. | Refreshed terminology for Resource Owner/Staff, Organisation Admin/Staff, Admin, Admin Region Scope, Support Coverage, Audit Trail, and after-demo security KIV separation. Later work can turn sections into actual guide pages. | Remaining risk is guide depth, not stale role terminology. |
| `docs/AIC_DISCLOSURE_PACK.md` | External disclosure review | Second-batch refresh started | Previously referenced current branch work for partner organisation staff handover and did not mention current Organisation governance/Admin support coverage/security KIV state. | Refreshed current-state wording, endorsement disclaimer, Organisation access limits, Admin Region Scope limits, and after-demo security KIV caveat. Still needs human compliance review before use. | External readers still need confirmed relationship/COI facts outside the repo. |
| `docs/PILOT_CONCEPT_NOTE.md` | Pilot partners, advisors | Second-batch refresh started | Previously did not include Organisation governance, Admin Region Scope, Support Coverage, Audit Trail, or parked security remediation caveats. | Refreshed pilot scope, data, governance outcomes, risks, and decisions-needed sections. Still requires partner/scope confirmation before use. | Pilot commitments still depend on confirmed partner, data-sharing, consent, and remediation decisions. |
| `docs/FUNDER_PITCH_BRIEF.md` | Funders, sponsors | Third-batch refresh started | Previously omitted Organisation governance, Admin support coverage, Audit Trail, location badge relevance cues, and parked security remediation caveat. | Refreshed current maturity, pilot ask, governance outcomes, sustainability value, and AI roadmap caveats. Still needs budget/partner specifics before sending. | Remaining risk is missing confirmed ask amount, partner commitments, and launch prerequisites. |
| `docs/PITCH_DECK_OUTLINE.md` | Presentation planning | Third-batch refresh started | Previously used older partner/admin framing and did not separate parked security fixes from pilot-readiness claims. | Refreshed Operations Layer, Trust/Safety, Pilot Concept, and risk wording. Still needs demo-safe screenshots and final audience-specific slide choices. | Deck still should not be used externally until screenshots and claims are approved. |
| `docs/COI_RISK_MANAGEMENT_PLAN.md` | Governance/advisor review | Third-batch refresh started | Previously did not include Organisation/Admin Region Scope confusion risk or parked security-remediation perception risk. | Refreshed safeguards, partner approach, funding/procurement restrictions, sponsor/visibility policy, and checklist. Still needs real relationship facts and compliance review. | COI language remains a working plan, not legal/compliance advice. |
| `docs/next-stage-roadmap-2026-05-16.md` | Product planning | Fourth-batch refresh started | Created before Organisation governance, Admin Region Scope, confirmation dialog, inline feedback, audit, and Discover badge releases. | Refreshed baseline, recommended order, after-demo security sequence, analytics scope, and AI guardrails. Still needs product prioritisation after the demo. | Remaining risk is roadmap choice, not stale feature state. |
| `docs/carearound-ai-orchestrator.md` | Agent/workflow operations | Fourth-batch refresh started | Current AGENTS references it; older version did not separate documentation refresh, demo window, and after-demo security remediation. | Refreshed routing rules, documentation-refresh workflow, README/project-knowledge guidance, and after-demo security remediation path. | Future agent sessions should be less likely to bundle docs, security, and deploy work accidentally. |
| `docs/layman-language-review.md` | Copy/product clarity | Fourth-batch refresh started | Older review predated Organisation governance, Admin Region Scope, Support Coverage, Audit Trail, and Discover location badges. | Refreshed review note, glossary, Discover badge copy guidance, admin/governance terminology, implementation sequence, and verification notes. Still needs code-level copy batches before UI wording changes. | Plain-language improvements remain planned work, but are now connected to current product terms. |
| `docs/release-checklist.md` | Engineering/release operations | Needs later date/current-scope refresh | It is still operationally useful but last refreshed 2026-05-15. | Refresh separately; do not bundle with public docs unless a release process change is needed. | Release operators may miss recent smoke/deploy caveats unless they read the handoff too. |
| `AGENTS.md` | Repo-level operating guardrails | Needs engineering-ops alignment | Still says the active root is `/Users/sweetbuns/Documents/Senior-Resource-Map`, while current work is locked to `/Users/sweetbuns/CareAroundSG`. | Refresh in a separate guardrail pass with `docs/release-checklist.md` so repo-root, branch, docs-only, deploy, and demo-window instructions are aligned. | Future sessions may start from the old checkout path if they read AGENTS without the handoff/memory context. |

## First Batch Scope

Updated in the first documentation-refresh pass:

- `docs/user-guide.md`
- `docs/CAREAROUND_SG_PROJECT_DOSSIER.md`
- `docs/documentation-refresh-audit-2026-06-08.md`

## Second Batch Scope

Updated in the second documentation-refresh pass:

- `docs/user-guide-foundation.md`
- `docs/AIC_DISCLOSURE_PACK.md`
- `docs/PILOT_CONCEPT_NOTE.md`
- `docs/session-handoff.md`

## Third Batch Scope

Updated in the third documentation-refresh pass:

- `docs/FUNDER_PITCH_BRIEF.md`
- `docs/PITCH_DECK_OUTLINE.md`
- `docs/COI_RISK_MANAGEMENT_PLAN.md`
- `docs/documentation-refresh-audit-2026-06-08.md`
- `docs/session-handoff.md`

Not changed in this pass:

- production code
- screenshots
- release/deploy configuration
- parked security fixes
- external partner/funder claims that require user confirmation

## Fourth Batch Scope

Updated in the fourth documentation-refresh pass:

- `docs/next-stage-roadmap-2026-05-16.md`
- `docs/layman-language-review.md`
- `docs/carearound-ai-orchestrator.md`
- `docs/documentation-refresh-audit-2026-06-08.md`
- `docs/session-handoff.md`

Not changed in this pass:

- production code
- UI copy in React components
- release/deploy configuration
- `AGENTS.md` and `docs/release-checklist.md`
- parked security fixes

## Recommended Next Batch

Refresh the engineering-operations guardrails next: `AGENTS.md` and `docs/release-checklist.md`. Keep that as a separate pass from public/stakeholder docs because it affects how future agents interpret repo root, branch discipline, validation gates, docs-only work, and production deploy behavior.
