# Closed ICCP pilot completion goal

Status: active; Gates 1–4 are separate release candidates validated locally
Owner: CareAround SG product owner
Started: 2026-09-15 (Asia/Singapore)

## Goal

Deliver a production-ready closed ICCP pilot through four sequential release
gates while keeping public discovery, public registration and public sign-in
restricted. Existing demonstration records remain available for future owner
claims. Existing personal Shared Maps and embeds remain available through their
direct links.

One gate may be developed and validated at a time. Advancing a gate requires an
explicit release-stage value in both the Worker and client build. An absent,
unknown, misspelled or legacy boolean value resolves to `off`.

| Stage value | Gate enabled | State |
| --- | --- | --- |
| `off` | Containment only | Production baseline |
| `onboarding` | 1. Organisation onboarding | Release candidate |
| `claims` | 2. Resource claims and permissions | Release candidate |
| `maps` | 3. Collaborative ICCP Care Maps | Release candidate |
| `lifecycle` | 4. Lifecycle and closed-pilot activation | Release candidate |

Later stages include the capabilities of earlier stages. Public-access settings
remain an independent server-side control and cannot enable a release stage.

Each gate keeps its own branch or frozen review candidate, acceptance evidence
and release decision. Completing a gate does not commit, deploy, activate or
advance the next gate automatically. The four gates remain milestones under
this one completion goal so progress can continue without weakening the release
boundaries.

## Gate 1 — organisation onboarding

Acceptance requires:

- a new organisation can submit its identity, exact email domain, website,
  organisation-supplied logo and banner, Terms acceptance and digital-asset-use
  grant;
- a Super Admin can independently verify, approve or reject the organisation;
- an email from an approved exact domain creates a pending join request and no
  session before approval;
- a Super Admin approves the first Organisation Admin and a current
  Organisation Admin can decide later staff requests within its organisation;
- consumer domains and suffix matches do not qualify;
- Governed Care Map APIs, public governed-map routes, map navigation, retirement
  actions and scheduled archival remain unavailable;
- fictional end-to-end rehearsal, full server/client checks and the production
  client build pass before release; and
- the manual verification procedure and organisation-facing legal wording are
  reviewed before accepting a real organisation.

## Gate 2 — resource claims and publication permissions

Acceptance requires a reviewable claim for an existing demonstration record,
claim evidence, approve/reject/withdraw actions, current organisation-resource
linkage, resource owner/staff assignment, field-level approved public uses and
owner-supplied asset replacement. Missing, pending, expired, withdrawn or
unlinked permission must continue to fail closed. Competing organisations must
not obtain concurrent active claims or resource links through resubmission or
simultaneous Owner verification, and stale requests must not create audit
events for actions that did not occur. Agreement effectiveness and expiry must
be checked inside the atomic approval transaction using the database clock.

The cumulative Gate 4 candidate contains the approved Gate 2 race remediation
and its focused regression coverage. The separately frozen Gate 2 milestone
predates the correction and is retained as historical evidence only.

## Gate 3 — collaborative ICCP Care Maps

Acceptance requires region-scoped partner resource visibility,
resource-derived map stewardship independent of the creator account,
revision-safe editing, sanitized publishing, exact-origin embeds and immediate
resource-level withdrawal by that resource's authorized staff, owner or linked
Organisation Admin. Personal My Maps remain separate.

At its local validation checkpoint, the Gate 3 candidate satisfied this
acceptance boundary with fictional data and compiled-browser evidence and
remained uncommitted, undeployed and inactive pending its release decision.

## Gate 4 — lifecycle and pilot activation

Acceptance requires reasoned retirement and restoration, participant
notifications, immediate guest suspension, the same token after safe restore,
idempotent archival after 30 days, audit evidence and a staged fictional pilot
rehearsal. Named real pilot organisations may be activated only after the
operational, legal, recovery and employment-boundary prerequisites are met.

At its local validation checkpoint, the Gate 4 candidate satisfied the
technical and fictional-rehearsal boundary and remained uncommitted, undeployed
and inactive. Production release checks and a closed-pilot UAT with named,
approved organisations remain open, so this Goal is still active.

The 15 September production-readiness checkpoint confirms the live public
boundary is closed, the governed pilot is disabled, migrations `0008` and
`0009` are installed with their reviewed hashes, and no governed maps or
onboarding requests exist. The remaining release work is recorded in
`docs/closed-iccp-pilot-production-readiness-20260915.md`.

## Completion rule

This goal is complete only when Gate 4 has passed its production release checks
and closed-pilot UAT. Reopening general public access is a later goal and is not
part of this completion definition.
