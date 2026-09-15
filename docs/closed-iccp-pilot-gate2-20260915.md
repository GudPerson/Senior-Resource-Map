# Closed ICCP pilot Gate 2 release candidate

Validation checkpoint: local and inactive; commit, push, deploy and activation
had not yet occurred
Date: 2026-09-15 (Asia/Singapore)
Branch: `codex/iccp-gate2-resource-claims-20260915`
Base: `origin/main` at `c2b08a2b`

## Result

Gate 2 is a cumulative candidate built on the separately frozen Gate 1 work.
The `claims` stage enables organisation onboarding and resource claims while
Governed Care Maps and lifecycle actions remain unavailable. The checked-in
Worker configuration and normal production client build still resolve to
`off`; the claims-stage client bundle exists only as local rehearsal evidence.

No production resource is treated as claimed by this code alone. Existing
records remain demonstration references until an Organisation Admin submits a
claim, a Super Admin verifies an accountable resource Owner, and a Super Admin
approves the exact provider fields and public uses covered by a current
organisation agreement.

## Gate 2 behavior

At `claims`:

- an Organisation Admin can search eligible existing demonstration resources,
  submit ownership evidence and request specific public fields and uses;
- claim evidence is limited to active Organisation Admins within the
  organisation and Super Admins; ordinary staff are denied;
- a Super Admin can independently reject a claim or verify an accountable
  resource Owner;
- Owner verification creates the active organisation-resource link and direct
  resource Owner membership without transferring ownership to the submitter;
- publication approval can narrow the request but cannot add fields or uses,
  and requires an active, unexpired organisation agreement covering the uses;
- an authorised Organisation Admin or Super Admin can withdraw permission with
  a recorded reason, immediately suppressing protected provider content from
  anonymous personal Shared Maps and embeds while retaining the ownership and
  organisation link;
- submission and every state transition use atomic database guards to reject
  stale claim revisions, duplicate claims and competing organisations; and
- the older direct resource-candidate, link and agreement-creation routes are
  unavailable to Organisation Admins, closing a bypass around the claim review.

Missing, pending, rejected, expired, withdrawn and unlinked permissions continue
to fail closed. Resource source data, personal My Map ownership, existing share
tokens and public-access settings are unchanged.

## Security remediation

The cumulative Gate 4 release candidate includes the approved remediation for
the Gate 2 cross-organisation claim race reported by Codex Security scan
`707677af-fc0a-4c7b-8c75-db5122207a23`. Resubmission now takes the same
resource advisory lock and availability guard as initial submission, excluding
only its own withdrawn row. Owner verification rechecks competing links after
the resource lock and before any link, Owner, claim, resource or audit write.
Stale client revisions are rejected before batching, so they cannot create a
false resubmission audit event.

The final release review also reproduced an expired-agreement approval under an
`Asia/Singapore` PostgreSQL session. Publication approval now locks and checks
the agreement inside the same atomic batch, using PostgreSQL
`CURRENT_TIMESTAMP` for effective and expiry dates. This keeps the claim state
aligned with the existing fail-closed public publication policy.

The original frozen Gate 2 worktree predates this correction and is historical
evidence only. A release containing Gate 2 must use the remediated cumulative
candidate or carry this exact patch forward.

## Verification

- The repository's formal `npm run verify:quality` release gate passed with
  exit code 0 after the implementation, browser rehearsal and evidence update.
  It reran migration ownership, module graph, diff, full server, full client and
  the exact production client build together.
- Focused resource-claim, publication-policy and atomic-write checks: 17/17
  passed, including legitimate rejected/withdrawn resubmission, retained
  same-organisation links, stale revisions, competing claims/links and forced
  concurrent cross-organisation verification.
- Full server: 780/780 passed.
- Full client: 810/810 plus 5/5 release-environment checks passed.
- Map lockdown: 104/104 passed.
- Static validation: 11 ordered migrations, 509 source modules, 1,538 relative
  import edges, no cycles and a clean diff check.
- Exact checked-in stage-off client build: 2,498 modules transformed.
- Isolated claims-stage client build: 2,498 modules transformed with the claim
  panel present.

The compiled browser rehearsal on `localhost:5187` used a local PostgreSQL
fixture and fictional organisations, users, resource, domain, evidence and
agreement. It confirmed:

1. Organisation Admin submission of the fictional unclaimed resource;
2. exclusion of the older direct add/link/agreement path from that workspace;
3. Super Admin Owner verification and direct Owner assignment;
4. publication approval limited to logo, description and website for personal
   Shared Maps and website embeds;
5. reasoned withdrawal and a visible `Permission withdrawn` state;
6. direct Governed Care Maps navigation remained closed at `claims`; and
7. the claims panel had no horizontal overflow at a 390 by 844 viewport.

The approval, withdrawal and mobile screenshots are under
`output/playwright/governed-pilot-rehearsal/`. The two browser console errors
were Google Identity Services rejecting an unregistered localhost origin. No
CareAround request in the rehearsed claim flow failed unexpectedly.

## Release boundary

No commit, push, database migration, Cloudflare deployment, production stage
change, public-access change or production-data action was performed.

The first reviewable installation must keep both the Worker and client stages
at `off`. Advancing both builds to `claims` is a later explicit release decision
after the Gate 1 organisation procedure, legal wording, operator readiness and
Gate 2 permission workflow have been reviewed. The independent production
public-access setting must remain restricted and receive a fresh smoke check.
Gate 3 collaborative ICCP Care Maps remain unavailable until their own candidate
passes its separate acceptance evidence and release decision.
