# Maintenance identity permit and supported owner control

Date: 9 November 2026 (Asia/Singapore). Status: **UI SOURCE LOCALLY VALIDATED; SOURCE CI/PUBLICATION CONTINUATION**. The user explicitly approved **“Approve this limited interface addition”** for the temporary owner-only button and read-only permit-ready indicator, extending the earlier backend-only plan. Root remains the sole provider/release coordinator. Both feature database migrations still require separate exact-target approval. See [the finite plan](superpowers/plans/2026-11-09-maintenance-identity-permit.md).

## Source and CI state at this evidence snapshot

Checkout: `/Users/sweetbuns/.codex/worktrees/carearound-identity-permit-20261109/CareAroundSG`; branch: `codex/maintenance-identity-permit-20261109`; public source ancestry: `5312da3b6d60fb5bc7d20979a6b723fe9de76c01`. PR [#113](https://github.com/GudPerson/Senior-Resource-Map/pull/113) is open and attached to this chat.

Historical backend-only commit `c4fa46dc580cdba09a4d52cda1218337991875e2` was pushed and passed mandatory CI 42556443122 / job 128963132905, all 25 steps, without cancellation/retry. Its focused 103/103, full server 1361/1361 and first locked client build are historical checks. They do not substitute for the newly approved UI source. This committed evidence note precedes the UI follow-up's new exact-source CI run; obtain that actual head/run/status from PR #113 and the coordinator's later receipt. Do not treat the older run as proof of a changed head.

No merge, source-pin change, native publication, permit arming, database identity observation, migration or provider/configuration mutation has been performed by this source worker. Earlier browser-ownership failure notes are historical: root now has the supported native owner UI path. CDP/script-request workarounds remain stopped; the approved button supplies the missing supported observation path after release.

## Behavior and boundaries

The fixed private record is `maintenance/identity-permit-20261109-v1.json`. Create-only arming follows genuine native publisher readiness, matching source/current Worker build/version/Pages receipt, pointer, workspace promotion and lock completion. Owner/source/release/job/Worker/Pages and the first server `publishedAt` are bound; expiry is strictly exclusive at fifteen minutes. Repeated receipts/source clones cannot renew or replace it. Claim acknowledgement with the stored ETag precedes the unchanged bounded runtime-only DB read. Missing/malformed/mismatched/expired/uncertain state fails closed; failed or unknown observations remain spent. Arming HOLD preserves successful normal Help publication and never observes/retries automatically.

`MaintenanceIdentityCheck.jsx` is a separate small component in both existing owner Publication render paths. It makes no request on mount. Explicit refresh calls the existing owner workspace GET and extracts only `{armed,expiresAt}`; it never applies a returned workspace/ETag, saves, publishes or changes draft state. The new server projection reuses the record/runtime/configured-source/publication/lock/owner/time checks read-only. Missing/error status remains disabled and reading status never arms, claims or queries.

A deliberate enabled click latches synchronously before the dedicated exact queryless cookie-only empty POST. That method omits JSON/body/custom session or impersonation headers, retains five-second/4KiB/fatalUTF8 guards, refuses redirects and strictly projects only `ok`, `branch_id`, `database`, `effective_role`, `session_role`, `workerVersionId`, `sourceRevision`, `observedAt`. Failure displays fixed stop/no-retry wording; no raw transport object/error is exposed. No retry, poll or on-mount POST is added.

The latch is an in-memory ref owned by the existing HelpContentSession, so unavailable local/session storage cannot reset it. It survives Publication-panel remounts within that owner session; failure/unknown leaves it spent. It is not claimed to persist through a browser reload. The private R2 record supplies durable cross-reload/session authority: unavailable status storage is closed; uncertain claim acknowledgement performs no SQL. Existing `cmsCanRequest` gating and the session key based on user ID/role/User View remove private state on identity changes; component cleanup aborts its signal and the API checks impersonation before fetch. Existing backend owner/no-impersonation/origin/source/time/target/CAS/privacy checks remain unchanged.

Remove the temporary UI/API/status/helper/diagnostic with Regional; retain the private attempt record. Existing Help library/editor, native publisher/repository, DB connector/SQL/target, secrets, bindings and dependency intent are unchanged. No baseline migration/bootstrap or new application-table state is added.

## Changed-source local evidence

Initial UI/status TDD command:

```sh
node --test client/test/maintenanceIdentityCheck.test.js server/test/maintenanceIdentityPermit.test.js
```

Expected RED: 22 new failures/29 existing passes, 51 total (`/private/tmp/carearound-identity-ui-first-red.log`). The earlier backend helper RED 0/29, initial readiness failure 28/29 and alternate-origin failure 36/37 remain historical retained logs under `/private/tmp/carearound-identity-permit-*.log`; all were corrected before their accepted source checks.

Final focused command:

```sh
node --test client/test/maintenanceIdentityCheck.test.js client/test/helpContentApi.test.js client/test/helpContentRender.test.js server/test/maintenanceIdentityPermit.test.js server/test/maintenanceIdentity.test.js server/test/helpCms.test.js server/test/helpCmsPublisher.test.js server/test/helpCmsCors.test.js
```

Result: **149/149 passed**, zero failures/skips/cancellations, 559.989 ms; log: `/private/tmp/carearound-identity-ui-final-focused.log`. Coverage includes read-only positive/negative permit status, no claim/write, actual owner GET projection, unchanged workspace, other-owner/User View denial, exact cookie-only request/filtering, private canaries, synchronous latch/double activation/error/no-retry and actual component SSR without mount-triggered requests. The UI interaction controller/API/SSR proof is not a real signed-in browser timing or device acceptance claim.

Required changed-source commands, each run once:

```sh
npm run test:server
npm run build:client
```

Server: **1371/1371 passed**, zero failures/skips/cancellations, 44.371 s (`/private/tmp/carearound-identity-ui-server-full.log`). Locked build: **17 internal checks passed**, client built in 5.71 s (`/private/tmp/carearound-identity-ui-client-build.log`). No full-check retry occurred.

Additional checks: `node --check` for `helpContentApi.js`, `helpCms.js` and `maintenanceIdentityPermit.js`; scoped `git diff --check`; dependency-manifest/lockfile and unchanged DB/native publisher/repository diffs. All pass. All 183 tracked dependency deltas remain identical and unstaged, excluded from the explicit source package; their porcelain-v1 status-list SHA-256 is `1ce9a8f86a98f87d25c5a6045d12e7d43b8926614677360b1cb50ecdf3f18dd7`. No env/credential/private seed file is included.

Frozen source/test SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `client/src/features/help-content/HelpContentPage.jsx` | `010dfd7ea86745cd90acad03850b781eeb21e6dd995de6d856204b661925cf9d` |
| `client/src/features/help-content/MaintenanceIdentityCheck.jsx` | `2d92dcddbceab4bd1f25be34ba91cde5c3523ef536a95c040442b483f3b5277d` |
| `client/src/features/help-content/helpContentApi.js` | `b47816f3c61445f4dcc20738246d1e9d2f863797f31d092fda7149d527a17f04` |
| `client/test/maintenanceIdentityCheck.test.js` | `dd193235a4052cf60bdd1496cecb88673850c16c352256956d643861c2a9a163` |
| `server/src/routes/helpCms.js` | `3a89aa315c982921d813281b52a55fddf7be644def16b0fd6054431aa4ee864c` |
| `server/src/utils/maintenanceIdentityPermit.js` | `b5f878594de6ecfa0edde8f789a6b1227b4737be7b675be9905784818e512d48` |
| `server/test/helpCms.test.js` | `c4324522e731591dfd7d473d891a6d2eb0cdaf1191d5ff1649b7e7e8ba45e273` |
| `server/test/maintenanceIdentityPermit.test.js` | `cb76398d34030949bfc492e877e7ca50f461106e94558dcd2ea4e1c4aafdfcee` |
| `server/test/maintenanceIdentity.test.js` | `228dfad3958afc4115b645caffc441e6b18f319233689552f986502202d536eb` |

## Safe continuation

Finish the explicit narrow UI follow-up commit/push on the same PR #113, preserving the original successful run, then require the one new exact-source quality CI. Do not duplicate the PR, request extra reviewers, rerun failed/unknown jobs or alter timeouts. Root directs merge only after current source/provider/observation prerequisites are satisfied.

Root then follows the existing approved source-pin/native **Review & publish** path to carry authored Help unchanged, verifies the actual Worker/Pages source/pair, published pointer, promoted workspace, clear lock and positive permit metadata, explicitly refreshes the ready indicator and uses the one button once. HOLD, failure or unknown result stops the release; do not renew/rearm/retry the attempt. Preserve only the fixed metadata response/time, never credentials or Help prose.

Regional Discovery is released and verified first under its separately approved exact-target database/recovery batch. Only then update Boundary against that accepted result, preserve its additional local commit, obtain its separate ordered migration approval and verify its signed-in flow. No production migration or identity query belongs to this local evidence.

The coordinator's preserved feature references remain: clean Boundary `7cf0ed8c9765d9ba218cfb5e07a392a7fb92f108`; dirty Regional planning `07d4ed0489cb15cf7f906c7097c8b73e690ba3c8`, 286 porcelain-v1 `-uall` entries, status SHA-256 `53ebda21506c32f23c7fd6cb93eaa6f85736753fe4581b1019df654de1c6bf44`. Both feature worktrees, primary unfinished work, operational logs and existing Help content are preserved. No current production deployment IDs are asserted by this note.
