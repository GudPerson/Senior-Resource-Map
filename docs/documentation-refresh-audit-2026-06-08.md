# CareAround SG Documentation Refresh Audit

Last updated: 2026-06-08 (Asia/Singapore)

Purpose: identify which CareAround SG documents need refresh before wider demo, pilot, or stakeholder use. Use `docs/session-handoff.md` and `docs/regression-ledger.md` as the current operational truth.

## Audit Table

| Document | Audience | Current/stale status | Evidence | Recommended action | Risk if left stale |
| --- | --- | --- | --- | --- | --- |
| `docs/user-guide.md` | Public users, caregivers, demo viewers | Partially stale, safe to refresh first | Screenshot paths pointed to the old `/Users/sweetbuns/Documents/Senior-Resource-Map` checkout; Discover guide did not explain current location badges. | Update active-repo image paths, add plain-language location badge explanation, and keep guide public-user only. | Demo viewers may see broken images or misunderstand location badges as official endorsement. |
| `docs/CAREAROUND_SG_PROJECT_DOSSIER.md` | Founder, advisors, funders, pilot partners | Stale in high-visibility claims | Header was generated from a May 10 worktree; dossier still referenced active/uncommitted partner organisation handover work and older `regional admin` wording. | Refresh current-state summary, role language, organisation governance/Admin Region Scope wording, alert/feedback status, and roadmap. | Stakeholders may think the product is on an old branch, understate recent stability work, or misunderstand permissions. |
| `docs/user-guide-foundation.md` | Internal training and future guide planning | Mostly useful, terminology needs later pass | Still uses `Regional admin` in audience planning and has older guide structure. | Refresh after the public guide and dossier settle; align with `Admin`, `Admin Region Scope`, Organisation governance, and Resource Owner/Staff language. | Future partner/admin guides may inherit old role names. |
| `docs/AIC_DISCLOSURE_PACK.md` | External disclosure review | Needs verification before external sharing | Not reviewed in this first batch; likely depends on current dossier claims and relationship wording. | Refresh after dossier wording is stable. Keep all endorsement/relationship claims conservative. | External readers may infer endorsement or relationship status that has not been confirmed. |
| `docs/PILOT_CONCEPT_NOTE.md` | Pilot partners, advisors | Needs verification before pilot use | Not reviewed in this first batch; likely affected by current governance, support coverage, and security KIV state. | Refresh after dossier; ensure pilot scope does not imply parked security fixes are complete. | Pilot commitments may be made using outdated feature/readiness assumptions. |
| `docs/FUNDER_PITCH_BRIEF.md` | Funders, sponsors | Needs verification before sending | Not reviewed in this first batch; depends on current dossier and pilot concept. | Refresh after dossier and pilot note. Keep seniors/caregivers free and avoid overclaiming AI readiness. | Funders may receive an outdated product maturity or impact story. |
| `docs/PITCH_DECK_OUTLINE.md` | Presentation planning | Needs verification before deck work | Not reviewed in this first batch; likely depends on updated guide/dossier narrative. | Refresh after funder/pilot docs. | Deck may tell a story that no longer matches the live product. |
| `docs/COI_RISK_MANAGEMENT_PLAN.md` | Governance/advisor review | Needs dedicated review | Not reviewed in this first batch; depends on partner/funder relationship facts outside the repo. | Review separately with current partner/sponsor assumptions. | COI language may be either too vague for review or too strong for current facts. |
| `docs/next-stage-roadmap-2026-05-16.md` | Product planning | Stale by date and recent releases | Created before Organisation governance, Admin Region Scope, confirmation dialog, inline feedback, audit, and Discover badge releases. | Refresh after user-facing/stakeholder docs; split demo-safe near-term items from after-demo security KIV work. | Roadmap may point the team toward already-completed or wrongly-sequenced work. |
| `docs/carearound-ai-orchestrator.md` | Agent/workflow operations | Needs light alignment later | Current AGENTS references it; not reviewed in this first batch. | Check after documentation refresh to keep workflow guidance aligned with current docs process. | Future agent sessions may apply stale labels or broad-work habits. |
| `docs/layman-language-review.md` | Copy/product clarity | Needs later reconciliation | Not reviewed in this first batch; likely still useful as source material. | Reconcile after user guide refresh. | Plain-language improvements may stay disconnected from current docs. |
| `docs/release-checklist.md` | Engineering/release operations | Needs later date/current-scope refresh | It is still operationally useful but last refreshed 2026-05-15. | Refresh separately; do not bundle with public docs unless a release process change is needed. | Release operators may miss recent smoke/deploy caveats unless they read the handoff too. |

## First Batch Scope

Updated in this documentation-refresh pass:

- `docs/user-guide.md`
- `docs/CAREAROUND_SG_PROJECT_DOSSIER.md`
- `docs/documentation-refresh-audit-2026-06-08.md`

Not changed in this pass:

- production code
- screenshots
- release/deploy configuration
- parked security fixes
- external partner/funder claims that require user confirmation

## Recommended Next Batch

Refresh `docs/user-guide-foundation.md`, then `docs/AIC_DISCLOSURE_PACK.md` and `docs/PILOT_CONCEPT_NOTE.md`. The foundation should settle internal role/permission terminology before external disclosure and pilot language are updated.
