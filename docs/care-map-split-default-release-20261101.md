# Owner Care Map default workspace release — 1 November 2026

Status: release preparation; not yet pushed or published. The user authorized commit, push and deployment of the accepted Split workspace and compact map header as the owner default, retaining the current presentation for rollback. Final production IDs and parity evidence must be recorded after the protected release completes.

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
