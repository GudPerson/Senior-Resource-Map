# AAR: Auth Session Fallback Loop

Date: 2026-05-16

## Summary

After the Region, asset access, and audience-zone pivot, production began showing intermittent auth instability. The user could sign in successfully, but after navigating, idling, refreshing, or returning to the app, the UI could show zero resources, empty saved assets, failed dashboard fetches, or a login/signup screen that looked like a stale WhatsApp registration flow.

The immediate hotfix was deployed in commit `9cb61909` and confirmed by the user: login stopped looping.

## Impact

- Valid signed-in users could appear logged out.
- `/discover`, `/my-directory`, `/dashboard/resources`, and `/dashboard/admin` could show empty or failed states even though production data still existed.
- A stale WhatsApp login attempt could reopen a signup-required panel after the user had already signed in through another method.
- The issue reduced confidence in the larger access-architecture pivot because several unrelated screens appeared broken at the same time.

## Root Cause

`AuthContext` used the general API fallback list for `/auth/me` session validation. That fallback behavior is acceptable for some public, stateless requests, but it is unsafe for cookie-bound auth. On `app.carearound.sg`, the session cookie belongs to the configured API origin. If the primary session check had a transient problem and the client fell through to a different origin, that fallback origin could not receive the session cookie. The app then interpreted the missing session as a real logout and cleared local auth state.

A second contributing issue was stale WhatsApp attempt state in local storage. A successful email, Google, or phone login did not always clear an old phone-login attempt, so the login page could reopen an outdated WhatsApp signup-required state.

## Why It Escaped

- The regression ledger had locked WhatsApp login mechanics and route recovery, but it did not yet name "auth session continuity" as its own locked surface.
- Existing tests covered API fallback behavior and auth preservation separately, but not the important rule that cookie-scoped session checks must not use stateless fallback origins.
- The access-architecture pivot touched roles, dashboard access, resource scopes, public discovery, saved assets, and auth-adjacent flows in one broad release train.
- The smoke suite itself needed maintenance: public Discover copy had changed, Playwright runner versions drifted, and credentialed smoke credentials were not available in the shell.

## What Went Well

- The fix stayed targeted: client session-origin handling and stale WhatsApp attempt cleanup only.
- No Worker deploy was needed for the hotfix.
- Automated coverage was added for the new session-origin rule and phone-login attempt storage behavior.
- Production verification included the public smoke path and direct bundle confirmation on the custom domain.
- The user completed UAT and confirmed the login loop had stopped.

## What We Should Do Better

- Treat auth/session continuity as a first-class release gate whenever user roles, access scopes, or account-linking logic changes.
- Separate "public fallback-safe API requests" from "cookie-scoped session requests" in both code and tests.
- Before deploying large access pivots, run a cross-flow UAT pass:
  - sign in
  - Discover
  - My Directory
  - Dashboard Resources
  - Admin Tools
  - Profile
  - idle/refocus/refresh
  - repeat after deploy
- Keep the smoke suite current with UI copy and Playwright version changes.
- Configure credentialed smoke variables before production release so admin and dashboard auth flows can be tested automatically.
- When the architecture changes the meaning of users, roles, regions, assets, or ownership, update the regression ledger before implementation begins, not only after a bug appears.

## Regression Ledger Answer

The regression ledger is intended to be a live ledger. It protects any behavior that has been explicitly locked, whether that behavior existed before the ledger, was stabilized recently, or is added in the future.

However, the ledger is not automatic by itself. It becomes protective only when each locked surface has:

- a clear current behavior
- known-good evidence
- reproduction steps
- acceptance criteria
- automated tests or smoke/UAT steps
- a release habit of checking the ledger before changing nearby code

The gap in this incident was not that the ledger only protected old work. The gap was that auth session continuity had not yet been promoted into a named locked surface with its own release gate. That has now been corrected in `docs/regression-ledger.md`.

## Follow-Up Actions

- Keep `Auth session continuity` in the locked stabilization surface list.
- Add auth continuity to every access/identity release manifest.
- Add credentialed production smoke coverage when smoke credentials are available.
- Continue treating the Region and asset-access pivot as high-blast-radius work until the role/access model has settled across public, dashboard, admin, saved, and profile flows.
