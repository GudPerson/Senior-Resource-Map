# CareAround Guide production release — 2 October 2026

The Guide opens alongside the current page, keeps one account-scoped conversation, and brings the latest response into view. Reviewed product guidance distinguishes saved resources, managed listings, map membership and Place membership. Questions about the current account use authenticated, scoped database readers; private account answers are excluded from model history.

Programme/service creation follows editable draft → canonical server review → explicit Create. The server rechecks the current Place assignment, ownership, audience and schedule, then atomically saves the resource, link, schedule revision and audit receipt. Retrying an uncertain response retains the same request identity. Saving a reviewed public resource is idempotent; it does not toggle it off. Existing resource forms retain their normal path. Guests and User View cannot perform Guide actions.

Cloudflare AI requires signed-in opt-in. It selects reviewed facts and may paraphrase them with reviewed source links. Account permissions and actions remain server-owned. Source IDs and formatting checks do not prove every paraphrase is semantically correct; complete-answer review remains needed.

## Fixed AI allowance

This production release extends the existing approved pilot to the live Guide; it does not create a new allowance. Production binds to the existing preview's `GuidePilotBudget` Durable Object and reserves the same `carearound-guide-pilot-20261001` singleton before every inference, including drafting. Prior usage is retained; preview and production cannot each spend the remainder. The cumulative maximum remains 80 physical attempts. Provider failures are not refunded and retries are limited to one attempt. Gateway estimated spend remains USD 0.50 over a sliding 86,400 seconds, with logs and cache off. Durable Object coordination usage is separate from model cost.

The fixed expiry is **2 October 2026 at 18:54:34 Singapore time**. After expiry, reviewed help, authenticated account readers and confirmed manual actions continue without new LLM calls. This release neither renews the temporary Neon child nor uses its credentials. Production retains its existing database, JWT and other secrets, main Worker entry, routes, cache and cron.

The counter depends on `carearound-guide-account-acceptance` remaining deployed during this pilot. Do not delete or recreate that namespace/object to reclaim calls. An ongoing production model policy and independent durable counter require a separate approved allowance and cutover. Disabling `GUIDE_CHAT_ENABLED` and `GUIDE_SEMANTIC_RETRIEVAL_ENABLED` disables model use; disabling `GUIDE_ACTIONS_ENABLED` disables Guide actions. Removing the budget flag while retaining the dedicated production Gateway fails closed; it cannot enable unbounded calls.

## Release evidence and rollback

Credential-free quality gate: server 994/994; client 826/826; 11 migration definitions; 564 modules and 1716 relative edges with no cycles; required client build. Locked map tests/build, Worker dry-run, local scroll checks, disposable action browser UAT and three-layer fixture checks passed. No production SQL migration or automatic production resource creation was run. Full partner smoke requires private credentials and was not run; local and production proof remain separate. The existing public smoke was attempted and failed because the disposable fixture displays the restricted-public-access screen rather than Discover. The failure and retry are preserved; no public-access policy was changed to make the test pass. Production access must be checked independently.

See `docs/evidence/guide-production-validation-20261002.json`. The prior Worker version is `5e121bcb-eec0-4392-8352-d951c419cbcc`, deployment `d26382b6-cbb9-4598-8102-74cb0ce0e066`. Client baseline is source `ea23d90f36224123ebf238c2a3a7ee5c98b564d6`. Deploy only from clean main matching freshly fetched origin/main through the guarded release commands. Post-deploy checks must record Worker/Pages source identity, secret-name preservation, model/account behavior and custom-domain bytes/hash/MIME parity.
