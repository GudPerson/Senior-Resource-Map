# Maintenance identity permit — local continuation

Date: 9 November 2026 (Asia/Singapore). Status:**LOCAL CANDIDATE; BROWSER/PUBLICATION STOPPED**. No production identity or deployment claim is made here. The user-approved [finite plan](superpowers/plans/2026-11-09-maintenance-identity-permit.md) covers this maintenance implementation and later native Help-preserving publication/one observation; it does not authorize either enhancement migration. This note grants no additional permission.

## Local package and boundary

Checkout: `/Users/sweetbuns/.codex/worktrees/carearound-identity-permit-20261109/CareAroundSG`; branch: `codex/maintenance-identity-permit-20261109`; implementation base: `5312da3b6d60fb5bc7d20979a6b723fe9de76c01` (Git source ancestry, not a serving production assertion).

The only runtime changes are the separate private-R2 helper and targeted existing CMS route. The fixed key is `maintenance/identity-permit-20261109-v1.json`. It is create-only, contains bounded deployment metadata, and is retained after consumption/expiry. The hook runs only on the first published transition after readiness, current pointer, workspace promotion and lock completion. Exact configured public source, compiled serving Worker build/version, Pages, release/job and owner are bound. The first server `publishedAt` fixes a strictly exclusive fifteen-minute expiry; clones/repeated receipts cannot renew or rearm it.

The diagnostic atomically consumes with ETag before the unchanged bounded runtime-only database read. No successful claim acknowledgement means no query. Database failure, mismatch, timeout or lost result remains spent. Arming uncertainty returns HOLD and preserves successful normal Help publication; no automatic observation/retry is provided. Owner/no-impersonation, exact app origin/URL/empty POST, private/no-store, expected target and strict metadata/error filtering remain. No new schema, provider binding, dependency, authentication policy or client/content workflow is introduced. Remove this temporary hook/diagnostic with the later Regional release; retain its private audit record.

Five frozen source/test SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `server/src/routes/helpCms.js` | `70979b76cd3a748e01bb88632e87497cda23837e545447b79a97731a0c5f36d7` |
| `server/src/utils/maintenanceIdentityPermit.js` | `55e36d4cd9d1af8c5163d3cfd1621acff6b483bfa17d7ee71d6ac7f6c33c5306` |
| `server/test/helpCms.test.js` | `0ce4de9f7bb26caac731bb5951082f1676c1d84d5d6a16a42aaf1d7f501d5807` |
| `server/test/maintenanceIdentity.test.js` | `228dfad3958afc4115b645caffc441e6b18f319233689552f986502202d536eb` |
| `server/test/maintenanceIdentityPermit.test.js` | `aaaa6aacbd89797b7df36ca3e3f1149595b8b421c5a21f3154a99fac24aa8b5c` |

## Existing local verification

The first test-first run was `node --test server/test/maintenanceIdentityPermit.test.js`:0/29 passed because the helper was absent (`/private/tmp/carearound-identity-permit-first-red.log`). The initial helper implementation passed 28/29 and caught a missing explicit supplied-readiness guard (`/private/tmp/carearound-identity-permit-helper-green.log`, despite that historical filename). The corrected integrated maintenance/CMS/publisher run passed 95/95 (`/private/tmp/carearound-identity-permit-focused.log`). An added alternate-origin regression then passed 36/37 and exposed the generic configured-origin allowance; the narrow diagnostic-only correction is included (`/private/tmp/carearound-identity-permit-origin-red.log`).

Final focused command:

```sh
node --test server/test/maintenanceIdentityPermit.test.js server/test/maintenanceIdentity.test.js server/test/helpCms.test.js server/test/helpCmsPublisher.test.js server/test/helpCmsCors.test.js
```

Result: **103/103 passed**, zero failures/skips/cancellations, 418.248 ms. Complete local log: `/private/tmp/carearound-identity-permit-final-focused.log`.

The single required full run was:

```sh
npm run test:server
```

Result: **1361/1361 passed**, zero failures/skips/cancellations, 45.010 s. Complete local log: `/private/tmp/carearound-identity-permit-server-full.log`. No retry or second full run occurred.

Additional completed checks:

```sh
node --check server/src/utils/maintenanceIdentityPermit.js
node --check server/src/routes/helpCms.js
git diff --check -- server/src/routes/helpCms.js server/src/utils/maintenanceIdentityPermit.js server/test/maintenanceIdentityPermit.test.js server/test/maintenanceIdentity.test.js server/test/helpCms.test.js
git diff --exit-code HEAD -- package.json package-lock.json server/package.json client/package.json
```

All pass. `server/src/db/index.js`, `helpCmsRepository.js` and `helpCmsPublisher.js` are unchanged. `npm ci --no-audit --no-fund` installed the existing locked dependencies; 183 tracked `node_modules/` deltas remain unstaged and are excluded from the source package. Their porcelain-v1/status-list SHA-256 is `1ce9a8f86a98f87d25c5a6045d12e7d43b8926614677360b1cb50ecdf3f18dd7` (status strings, not a claim of package-byte verification). No environment/credential files were copied. Generated private test seed remains ignored; it is excluded.

The tests use fictional R2/CAS/owner/release fixtures and intercepted database transport. They establish local logic, not genuine provider concurrency, a current signed-in session, unchanged live Help content, an armed production permit or database identity. The local logs are machine-local references, not published CI artifacts.

## Precise blocker and safe continuation

The coordinator reports that the current chat's supported browser lookup lists no tabs, and `tabs.get(584546488)` returns not found; the Mac worker reports stale ownership of that former tab. Browser/publication work is STOPPED. This is an unavailable browser-capability handoff, not evidence that a production publish failed. Do not retry through another bridge, retime a window, dispatch a publisher, manufacture a session, infer permission from elapsed time or use stale tab ownership.

No push, PR, CI, source-pin change, publication, permit arming, observation, production migration or provider/configuration change has occurred for this candidate. Existing Help feature/content work remains paused; the existing authored library must be carried forward unchanged through the normal native publication. No production deployment IDs are recorded because no current live readback was performed in this local finish.

When a supported owner-browser connection is available, the one release coordinator should:

1. Verify the local commit's explicit eight-file package; run the required actual-source PR/CI/merge and release checks. Preserve all unstaged dependency deltas and existing worktrees. No push/CI pass is presently claimed.
2. Reconfirm current release/configuration/content metadata and follow the existing approved source-pin path, preserving secrets, bindings and runtime configuration. Use the existing signed-in native **Review & publish** with truthful attestation to carry the current authored Help unchanged. The failed bridge/offline adapter stays stopped.
3. Verify the actual matching Worker/Pages pair, publication receipt/current pointer, promoted workspace and cleared lock, then positively establish the create-once permit's safe metadata and unexpired state. HOLD/missing/uncertain arming stops the release for read-only reconciliation; duplicate receipts must not be used to rearm it.
4. Make the one already-approved exact bodyless/queryless identity POST from the configured non-impersonated owner/app context, then retain only its fixed metadata response/time. Stop on failure, timeout or unknown outcome; never retry it automatically.
5. Prepare the exact Regional production target/migration/recovery batch and ask for its separate database approval. Deploy and verify Regional first. Only then update Boundary against that verified result, preserve its additional local commit, prepare its separate ordered migration/receipt, obtain its own database approval, and deploy/verify the signed-in Boundary journey.

The coordinator separately reconfirmed feature preservation: Boundary is clean at `7cf0ed8c9765d9ba218cfb5e07a392a7fb92f108` on `codex/boundary-library-guided-zones-release-20261108`; Regional remains at `07d4ed0489cb15cf7f906c7097c8b73e690ba3c8` on `codex/mini-curated-discovery-plan-20261106`, 286 porcelain-v1 `-uall` entries, unchanged status SHA-256 `53ebda21506c32f23c7fd6cb93eaa6f85736753fe4581b1019df654de1c6bf44`. Neither feature worktree, existing operational log, Help content nor primary unfinished work was edited by this local deliverable.
