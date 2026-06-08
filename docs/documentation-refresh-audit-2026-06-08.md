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
| `docs/next-stage-roadmap-2026-05-16.md` | Product planning | Stale by date and recent releases | Created before Organisation governance, Admin Region Scope, confirmation dialog, inline feedback, audit, and Discover badge releases. | Refresh after user-facing/stakeholder docs; split demo-safe near-term items from after-demo security KIV work. | Roadmap may point the team toward already-completed or wrongly-sequenced work. |
| `docs/carearound-ai-orchestrator.md` | Agent/workflow operations | Needs light alignment later | Current AGENTS references it; not reviewed in this first batch. | Check after documentation refresh to keep workflow guidance aligned with current docs process. | Future agent sessions may apply stale labels or broad-work habits. |
| `docs/layman-language-review.md` | Copy/product clarity | Needs later reconciliation | Not reviewed in this first batch; likely still useful as source material. | Reconcile after user guide refresh. | Plain-language improvements may stay disconnected from current docs. |
| `docs/release-checklist.md` | Engineering/release operations | Needs later date/current-scope refresh | It is still operationally useful but last refreshed 2026-05-15. | Refresh separately; do not bundle with public docs unless a release process change is needed. | Release operators may miss recent smoke/deploy caveats unless they read the handoff too. |

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

## Recommended Next Batch

Refresh `docs/next-stage-roadmap-2026-05-16.md`, `docs/layman-language-review.md`, and `docs/carearound-ai-orchestrator.md`. Keep `docs/release-checklist.md` as a separate engineering-operations pass unless release process wording becomes urgent.
