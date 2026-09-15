# Closed ICCP pilot Gate 1 release candidate

Validation checkpoint: local and inactive; commit, push, deploy and activation
had not yet occurred
Date: 2026-09-15 (Asia/Singapore)
Branch: `codex/iccp-gate1-organization-onboarding-20260915`
Base: `origin/main` at `c2b08a2b`

## Result

Gate 1 is isolated from the later resource-claim, governed-map and lifecycle
gates. The Worker and client now accept only an explicit ordered stage:
`off`, `onboarding`, `claims`, `maps`, or `lifecycle`. Missing, legacy,
misspelled and unknown values fail closed to `off`.

The checked-in Worker configuration and exact production client build remain
`off`. Installing this candidate cannot by itself open organisation onboarding,
change public-access settings, publish a map, run scheduled map archival or
alter a production record.

## Gate 1 behavior

At `onboarding`:

- an organisation can submit its exact domain, applicant, official website,
  owner-supplied logo/banner URLs, Terms acceptance and digital-asset grant;
- a Super Admin can review and approve or reject the organisation;
- staff can request access only through an approved exact domain;
- no account session exists before an authorised approval;
- the Super Admin approves the first Organisation Admin, after which the
  organisation can decide later staff requests under existing role rules;
- Governed Care Map navigation, public map/embed routes, map mutations,
  retirement, restore and scheduled archival remain unavailable; and
- the separate public-access boundary can keep discovery and general account
  access restricted while leaving the organisation pathway available.

The manual checks required before approving a real organisation are recorded
in `docs/organisation-verification-procedure.md`.

## Verification

- The repository's formal `npm run verify:quality` release gate passed with
  exit code 0 on 2026-09-15. It reran migration ownership, module graph, diff,
  full server, full client and exact production client-build checks together.
- Focused server and fictional onboarding: 6/6 passed.
- Full server: 771/771 passed.
- Focused client and release-environment checks: 7/7 passed.
- Full client: 810/810 plus 5/5 production-environment checks passed after the
  final wording corrections.
- Exact stage-off production client build: 2,497 modules transformed.
- Map lockdown: 104/104 passed.
- Static gate: 11 ordered migrations, 505 source modules, 1,515 relative import
  edges, no cycles, and a clean diff check.
- Final Graft caller and exhaustive legacy-flag review found no executable
  legacy client flag and no release-stage bypass. The sole server legacy-flag
  reference is the regression assertion that proves it cannot activate a stage.
- The cumulative Gate 2 candidate adds an explicit regression proving that an
  Organisation Admin cannot bypass the claim workflow through the older direct
  resource-candidate, organisation-resource-link or agreement-creation routes.
  Removal and revocation controls remain available so access can still fail
  closed. The focused cumulative claim and policy suite passes 9/9 and the full
  cumulative server suite passes 778/778.

The isolated compiled-browser rehearsal on `localhost:5186` used only fictional
PostgreSQL data and confirmed:

1. organisation application and the supplied content-use grant;
2. Super Admin review and approval;
3. exact-domain staff request, alongside the HTTP integration proof for first
   Organisation Admin approval;
4. a rejected login before approval and successful login after approval;
5. no Governed Care Maps navigation and an unavailable direct dashboard route;
6. confirmation copy that preserves personal My Map sharing while keeping
   Governed Care Maps for their later stage;
7. restricted public discovery and general sign-in with organisation sign-in,
   staff-request and organisation-registration paths still present; and
8. no horizontal overflow at a 390 by 844 viewport.

The deliberate pre-approval login produced the expected HTTP 401 console entry.
No unexpected console error remained on the final gated surfaces.

## Release boundary

At the final preflight, local `HEAD`, the worktree base and `origin/main` all
resolved to `c2b08a2b`. GitHub and Cloudflare operator sessions were available,
but no remote or production mutation was performed.

The first reviewable release should install this code with both Worker and
client stages set to `off`. Advancing them to `onboarding` is a later, separate
release decision after legal wording, the manual verification procedure and
operator readiness have been reviewed. Gate 2 must add the resource-claim and
permission workflow before the `claims` stage can be used.
