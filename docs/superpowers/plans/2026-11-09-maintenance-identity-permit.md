# Temporary maintenance identity permit

The user approved this maintenance implementation, validation, source pin and native Help-preserving CMS publication, followed by one database identity observation. No migration SQL or secret/credential changes are authorized. The failed browser bridge and offline adapter remain stopped.

## Architecture and boundary

Replace only the expired fixed observation clock in the existing owner-only empty-POST endpoint. Keep all existing authentication, no-impersonation, exact app origin/URL/method/body, runtime-only database connector, expected branch/database, private/no-store, role/output filtering and query timeouts. Use a small helper over the existing private HELP_CMS_BUCKET, isolated from authored Help data and release records.

A unique fixed maintenance attempt key is create-once. After a normal authenticated CMS receipt is genuinely published, Help/Guide/client readiness is verified, normal workspace promotion/lock completion is finished, and the serving Worker metadata matches the receipt build/version and current configured public source, the hook may arm one private record. It binds source, release/job, Worker version, Pages deployment and owner; its server-recorded published timestamp determines a strict fifteen-minute expiry. Later receipts/publications cannot renew, replace or re-arm it. Arming must not be possible for failed/partial/unverified releases, a different running source/version, or a wrong configured source. Hook failure must not roll back the verified Help publication or automatically trigger an observation/retry. Any ambiguous arming outcome is a release HOLD requiring read-only reconciliation before the one observation.

The endpoint validates the bound record/current runtime and publication context, and atomically consumes it with R2 ETag compare-and-swap BEFORE the unchanged readMaintenanceDatabaseIdentity call. No successful claim acknowledgement means no query. Expired, malformed, missing, consumed, mismatched or uncertain state fails closed. Query failure, target mismatch or lost response remains spent; no replay, automatic renewal or retry. Return only the existing eight-field identity metadata, never credentials, application rows, authored Help content or raw errors.

The change touches the identity route and one publication-completion hook, plus a separate helper and focused tests. No client/editor/content/schema/auth policy, provider binding, storage bucket or migration changes. The diagnostic/arming hook is removed with the later Regional release; the private record is retained as audit evidence.

## Finite implementation and checks

- Tests first: exact existing owner/origin/body/privacy/DB connector guards; no permit before verified publication; fifteen-minute exclusive expiry; source/Worker/Pages/owner/release binding; create-once/no renewal; two concurrent claims allow at most one query; missing/malformed/failed/uncertain R2 claims allow zero queries; consume-before-query; failed/mismatched/timed-out query remains spent; no secret/error logging.
- Keep normal publication, saved snapshot, workspace promotion and lock behavior intact, including permit failures. Use existing R2 conditional-write patterns with private metadata. No new framework or diagnostic.
- Run focused maintenance/CMS tests then npm run test:server. Run required existing release checks/CI on actual source before live use, without reopening unrelated completed feature reviews.
- Commit/push this maintenance branch, PR/merge through normal quality gates, then advance the existing source pin preserving code/runtime/bindings. Use only the existing signed-in Review & publish controls and truthful evidence-based attestation to publish current authored Help unchanged.
- Verify actual source/version/paired publication, positively establish the armed metadata, then make exactly one authorized empty-POST observation. Stop on failure/uncertainty. Record metadata response/time and exact remaining migration approval; no production migration is executed here.
