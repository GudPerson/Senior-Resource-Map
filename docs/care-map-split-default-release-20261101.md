# Owner Care Map default workspace release — 1 November 2026

Status: **published and independently accepted**. Public main `2c15ad8b4b3111665d4b4b5ee1daf7ec2b0a147b` (PR95) is live through the unchanged protected publisher. Final record: `docs/evidence/care-map-split-default-production-20261101.json`. The Current presentation remains available for rollback without restoring map/CMS data.

## Source and scope

The isolated `codex/split-workspace-default-release-20261101` branch starts from verified public main `d8c108aeb04335a366c88d0caf757969ec47d5d7`. All23 files in the immutable compact-header seed manifest matched before integration. The seed runtime inventory is `3727ec7537b8861f463f7fd8ef1e1fdfe614721a4f7412c6d48bb3bb4b28bc34`; its accepted26-case local browser report is historical preparation evidence, not production proof. The original22-file Split candidate,23-file compact candidate, primary153 unfinished entries and clean evidence worktree are preserved.

The release policy changes one runtime default: `isOwnerMapWorkspaceEnabled` defaults its optional policy argument to `true`. Owner Care Maps, including V2 and classic owner branches, open Split without a query parameter. The compact saved-view selector and Studio-only status retain the exact existing save/flush/revision controller. Discover, shared/frozen maps, embed and Print/export selection remain outside this owner presentation policy. No API, schema, authentication, credentials, media allowance, map asset or publisher changes are included.

## Presentation rollback without data rollback

- Add `workspace=current` to an owner map URL to select the retained current presentation. A valid optional `workspaceView` selects the same saved view; invalid values use the established default. These are private owner UI query parameters and are not forwarded to shared/embed URLs.
- From Split, **More → Use current layout** flushes Studio and preserves the selected saved view before an explicit full reload. Failed or conflicting saves keep the owner in Split. Notes and active annotation/place work require their existing close/finish/cancel action first. This reload does not promise to preserve the same camera instance.
- An explicit compile policy `VITE_OWNER_MAP_WORKSPACE_ENABLED=false` retains Current for no-query owner entry. An explicit `workspace=split` still overrides that policy, as before; this is an operator presentation default, not a strict global kill switch.
- Reverting source/presentation does not restore old map documents, media, CMS snapshots or private data. Keep the latest compatible Help content through the unchanged paired publisher; never upload stale public `dist` as rollback.

## Regression gates and evidence

The public quality workflow adds one actual-App default-workspace browser step and retained evidence artifact. Established media/legacy layout fixtures enter `workspace=current`, with their existing assertions retained; the new owner suite separately proves no-query defaults. The protected private publisher, its configuration/variables, source guard and paired Worker→Pages flow are unchanged.

Local preparation currently passed `npm run verify:quality`: generated content17, Help/CMS73, server1239, client1047 plus environment5 and configured ten-root client build. Map-lockdown116 and compiler17/build pass. Independent actual-App35/35 plus explicit-false1/1 pass, unchanged source and zero errors/unexpected writes; all26 accepted compact baseline cases remain. Legacy map-first17, notes/export9, image allowance30, compression5 and export zoom45 pass. Selected phone/tablet notes and personal-place replays also pass after only visible Current navigation and native-control locator corrections, with every assertion retained. Initial failures remain separately recorded. Independent source review confirms all15 runtime files equal the accepted compact seed except the one default boolean; no server/scripts/private publisher changes. See `docs/evidence/care-map-split-default-local-20261101.json`. The first legacy browser attempt could not bind localhost under the sandbox (`EPERM`); an explicitly approved execution-context retry is tracked separately.

Credentialed production smoke, physical-device/PWA checks and private upload/export output quality are distinct from fictional/intercepted browser fixtures. Do not label absent proof as a passed full `verify:release`.

## Release discipline

Before commit/push: scoped source review, complete local quality/map/browser gates and independent QA. Before production: exact merged-main CI, fresh live Worker/Pages/content/source metadata, no active partial release, and parent plus independent release-QA approval. Use only the existing owner **Review & publish** action with its review note and approval checkbox, carrying forward current approved saved content. Do not save an editorial draft, republish an old job, bypass source/content guards or change private publisher configuration.

The final release must show matching Worker/Pages private-build provenance and public Help/Guide/client version/digest, complete asset/ordinary-HTML delivery proof, accepted published receipt, promoted content pointers and cleared release lock. Owner no-query default and guarded Current fallback require live behavior checks after delivery.

Working evidence: `/private/tmp/carearound-split-default-release-20261101/`. Durable source/QA/release receipts will be linked here before final handoff.

## Accepted production result

The exact feature/PR head was `eaefc5580efb6b8c6290bb8f11d05e240c30d185`; merged main2c15 has the identical tested tree/runtime/harness. PR quality41231457354 and main quality41232283661 both pass. Private workflow330420711969ff4978bbbd1300aee99eadc39705 was not changed; run41234690664/job124635881912 passed all4 protected gates and acknowledged the published receipt.

Private content build `e32f2fb66624d864fdb4ddeb46abc520020ea10a` is served by Worker `ce6fdd63-ccdc-455b-b3d8-5e3654f3b40b` and Pages `466575b6-e1b0-4b9d-ad8f-f85ae0768ebb` ([immutable URL](https://466575b6.senior-resource-map.pages.dev)). Publication1793475137335-375c06f0-ebe3-4dbc-99a6-f2d5eb2441b0/jobf744b243-bcbe-4e20-92b2-d425b8d5c9bc uses snapshotdc07013e2f16a987a08e293cd78520307bc3e863dd1edd5b7fe8618e1da7bc11. Help/Guide/client agree on version2026-10-31.help-cms.1793475137185 and digestd04cd77e81f1bf4127d17bbb05a13dc97f45a05ab496e422ff37a8c3f2ee1b34; health is OK. Workspace promotion and lock clearance are confirmed. Authored-v1 remains f94a57a2b0da8f553f5a574179ccb820b913526ebbbb0a6a7c05d58ba2712d8c,48 articles/11 categories (exclude only manifest.version, recursively sort keys, preserve arrays). No historical92c9 equivalence is asserted.

Independent delivery passes105 custom artifacts,103 immutable non-HTML files,12 ordinary HTML cases and4 immutable-origin denials for production-only proof endpoints. Root read-only production checks pass default and classic no-workspace-query entry and both guarded Current fallbacks, with one controller/map and retained selected-view token. The accepted untruncated47-request trace shows zero owner-map mutations. Earlier truncated sampling is excluded. Private production images/DOM bodies are not committed.

The first source-pin connector attempt was rejected403 for connection scope and independently caused no state change. Revised one-shot pinned Wrangler4.145 `versions secret put` staged an inactive source-pin-only version using existing auth, followed by a separately approved activation. No tokens were extracted, new scopes granted or credentials copied. Exact module bytes/etag,44 descriptors/runtime/global settings and old truthful private268 tag were preserved before normal publication. Its recovery baseline was ead05cd2-bb91-450c-b0bf-2d7038dc9447 / prior Pagescd1b. No ordinary secret-put, stale-dist upload, private-workflow change, forced unlock, manual dispatch or old publication retry was used. Automatic public Pages preview/main failures and fixture navigation diagnostics remain separate from the accepted protected release.

The committed public source33-file patch/ZIP and scratch apply/all-hash proof are preserved in the durable review folder. Final evidence is on separate `codex/split-workspace-default-release-evidence-20261101`; it may be pushed as a backup but must not be merged into main or trigger another publication for this release. Accepted public source pin remains2c15. Primary153, original22/23-file local candidates, their immutable artifacts and prior clean a787 checkout remain intact. Physical-device/PWA, credentialed full verify:release smoke and private media output-quality proof remain explicitly separate.

Final independent signoff: `qa-final-acceptance.md` SHA256 `9e339543db94d8c10e5c757e9d6283c2ed71c5fc5fa83b250cac42d76a99bb45`; final manifest `qa-manifest-v3-final.json` SHA256 `08e247c918ea3d4362c992f425164d4587376f16ce6c11ed3c8ab50ac4b9ed75` in the durable release folder. Its114 metadata/fictional files exclude production JPEGs/private captures. Root closed its two verification tabs and left the original Discover tab untouched.
