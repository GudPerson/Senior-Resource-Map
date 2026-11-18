# Within-area catalogue timeout repair

The captured hard-assets request is cancelled at exactly 15 seconds while other catalogue pages require 10–14 seconds. The panel overrides the shared paginator's established 45-second page budget. This task removes that feature-only override, retaining one attempt, complete-catalogue publication and existing cancellation. Address snapshot budgets, geometry, visibility, pagination and Saved/map write contracts stay unchanged.

1. Establish the focused baseline and reproduce the mounted panel's 15-second failure with controlled fictional requests and a browser clock.
2. Remove only the panel timeout override if existing close/area-change and sibling cancellation pass. Expand production scope only if a meaningful regression demonstrates another defect.
3. Verify slow success, later-page failure without partial results, Retry, cancellation/stale-response protection and zero loading writes; run focused/full client tests, client build and the area browser cohort. Record local evidence in the ledger.

Use the fresh verified `codex/within-area-catalogue-timeout-20261119` worktree. Its Graft ask/call trace could not run because no graph exists and refresh creation is denied; scoped source inspection is the disclosed fallback. No commit, push, deployment, live database call or environment-file copy is included.

Deployment extension authorised on 19 November: complete quality/map gates, PR/main CI, source-pin-only publisher preparation preserving the deployed Worker code/runtime/bindings, then the existing owner publication with unchanged approved Help content. The checkout's own Graft index became available during release preparation. The first PR run exposed a stale 22-second wait in the existing spatial cancellation test; update only that wait to 52 seconds for the 45-second deadline, retain every cancellation/Retry/map-change assertion, and verify both provider cohorts before fresh CI. No address-budget, backend, schema or credential change is included.
