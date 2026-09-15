# Closed ICCP pilot production-readiness checkpoint

Status: production evidence refreshed; release and activation held
Captured: 2026-09-15 (Asia/Singapore)

## Decision

The four gate candidates remain separate and locally validated under the active
closed ICCP pilot goal. The cumulative Gate 4 candidate is not yet a clean,
reviewed release commit and was not pushed or deployed during this checkpoint.

The cumulative candidate now includes the approved Gate 2 security remediation.
The original frozen Gate 2 milestone remains historical evidence and must not be
released without that correction.

The current production installation remains contained. Public discovery,
registration and login are closed, `governedPilotEnabled` is false, and the
existing personal Shared Map tested here remains reachable without an account.

## Current production evidence

- `origin/main` and the candidate base both resolve to
  `c2b08a2b433d44ebec24d74bdd5862565a3ae396`.
- `https://api.carearound.sg/api/health` returned HTTP 200.
- The public platform-access response returned `no-store`, revision `5`, all
  three public modes `closed`, and `governedPilotEnabled: false`.
- At a 390 x 844 browser viewport, Discover, registration and login rendered the
  restricted-access notice. The existing personal Shared Map rendered its title
  and a known resource without requiring an account.
- The personal Shared Map currently has a 16-pixel document overflow caused by
  its existing mobile sticky header. `SharedMapPage.jsx` is unchanged by this
  candidate, so this is a pre-existing production layout observation rather
  than a regression introduced by the four pilot gates. It does not block the
  inactive pilot installation, but it should be handled as a separate locked-
  surface fix if the product owner wants strict 390-pixel no-overflow parity.

## Production schema evidence

A serializable Neon HTTP transaction with `readOnly: true` reported:

- database `neondb`;
- runtime role `neondb_owner`;
- branch `br-green-union-ailxs0g3`;
- PostgreSQL major version 17; and
- `transaction_read_only=on`.

All ten tables owned by migrations `0008_platform_access_settings` and
`0009_governed_care_maps` are present. The release journal records both exact
migration hashes once. There is one platform-access row, zero governed-map rows
and zero organisation-onboarding requests. No personal or organisation record
contents were read.

The sanitized machine-readable evidence is in
`docs/evidence/closed-iccp-pilot-production-readiness-20260915.json`.

## Gate 2 remediation evidence

Codex Security scan `707677af-fc0a-4c7b-8c75-db5122207a23` identified a
cross-organisation claim-resubmission race and a related concurrent Owner
verification path. The corrected cumulative candidate serializes both writes
on the resource and rechecks exclusivity within the atomic database batch.
Stale resubmission revisions are rejected before writing an audit event.

Final source review also reproduced an expired agreement being accepted when a
PostgreSQL session used `Asia/Singapore` and the controller compared the
timestamp in JavaScript. Publication approval now locks and validates the
agreement inside the atomic batch and compares effective and expiry dates with
PostgreSQL `CURRENT_TIMESTAMP`.

The focused claim/policy/atomic suite passed 17/17 and the full server suite
passed 780/780. An independent pre-patch investigation reproduced both unsafe
states. A separate post-patch reviewer confirmed the ownership bypass closed,
then identified the stale-revision audit side effect; that side effect was
confirmed, corrected and added to the focused regression coverage.

Resource exclusivity still depends on every privileged writer using the shared
advisory-lock protocol because the database indexes are organisation-scoped.
The older Super Admin direct-link recovery route remains a separate hardening
item outside this Gate 2 remediation and must not be used as an ordinary pilot
onboarding path.

## Inactive installation boundary

Before installing the cumulative candidate with both release stages still
`off`, complete these items against one exact source commit:

1. Freeze the Gate 4 worktree as a clean local release commit and review its
   complete diff from `origin/main`.
2. Re-run the release checklist against that exact commit.
3. Create or confirm a fresh production recovery point immediately before the
   release. The 13 September snapshot and 7 September non-production restore
   remain useful evidence but are not a fresh release-time recovery point.
4. Deploy Worker and Pages from clean `main`, preserving the server and client
   stage values as `off`.
5. Prove Worker health, custom-domain artifact parity, public containment,
   personal Shared Map continuity, direct pilot-route rejection and
   authenticated production smoke. No smoke credentials were read or stored in
   this checkpoint.

## Closed-pilot activation boundary

Installing inactive code does not authorize a real organisation pilot. Before
advancing to `onboarding`, retain separate evidence for:

- qualified review of the Terms, Privacy, legal contact, permission and
  retention wording, and the pilot operating entity;
- the manual independent organisation and exact-domain verification procedure;
- a second recovery operator or a documented and accepted single-operator
  arrangement with a tested fallback;
- named, approved pilot organisations and their authorised administrators; and
- authenticated UAT through onboarding, claims, collaborative maps, retirement,
  restoration, same-token recovery and scheduled archival.

General public reopening remains outside this goal.

## Checkpoint boundary

This checkpoint used public HTTP/browser reads, a production transaction forced
to read-only, local documentation edits and local repository inspection. It did
not commit, push, deploy, migrate, change a release stage, alter public access,
read a secret value into output or write production data.
