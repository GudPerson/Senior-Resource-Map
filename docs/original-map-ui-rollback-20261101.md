# Original Discover and Care Map presentation rollback — 2 November 2026

Status: **merged and source-prepared; normal owner publication pending; original UI rollback NOT LIVE**. [PR96](https://github.com/GudPerson/Senior-Resource-Map/pull/96) merged as public main `8f2665946d338b2eec08e162a23ea05e06e9253e`; exact PR and merged-main quality runs passed all21 steps. The unchanged-code source-pin clone is active, while deployed application code remains private build `e32f2fb66624d864fdb4ddeb46abc520020ea10a` and Pages `466575b6-e1b0-4b9d-ad8f-f85ae0768ebb`, still the previous presentation. Only the next protected publisher's source selection is prepared. The primary153 unfinished entries, earlier candidates and frozen release artifacts remain protected. This separate evidence branch must never be merged to main.

## Target and historical reference

Restore the non-map-first presentation that existed at `2361d3c94238c2dd57da0c501dad426fafb24635`, the parent of initial map-first `5da3f710`. This reference already includes PR92/export fix `692aa2c9`, which remains untouched. Later map-first layers are `5da3f710`/`cf5ef413` (PR93), `70abf935` (PR94) and the Split/compact default in `2c15ad8b` (PR95). This is a presentation policy/restoration, not a wholesale Git/data/CMS rollback.

Discover returns to its original desktop list beside map and mobile Browse/Map flow. Care Maps use their existing V2/classic original toolbar, resources and inline Studio presentation. The classic empty-resource path is explicitly restored. Earlier native mobile Full map remains available; the later fixed map-first re-entry and Split workspace do not execute.

## Narrow implementation and data safety

Six runtime files: new `mapPresentationPolicy.js`, plus `ownerMapWorkspace.js`, `DiscoverPage.jsx`, `MyMapDetailPage.jsx`, `SharedMapDirectoryList.jsx` and a two-line named Fragment import/reference repair in `DiscoveryFilterPanel.jsx`. The shared build-only `VITE_MAP_FIRST_EXPERIMENT_ENABLED` is false when absent. Owner selection checks this gate before old flags/URLs; both routes derive/reset effective map-first false, and the shared receiver blocks experimental roots and their entry button. Browser URLs such as `workspace=split`, the old owner build flag and saved browser values cannot override this policy. No storage is cleared or rewritten. Map-first entry was React state rather than a persisted preference contract; stale-key tests are defensive, not a claim of a new persistent setting.

Existing map-first/Split components remain as backup code for explicitly enabled dedicated test builds. No production/CI/release environment or env file globally enables them. Existing saved views, selected-view tokens, saved layouts, notes/photos, private drafts, resource ordering and unrelated preferences remain intact. Controller/ref/save-queue fixes remain; no renderer, API/schema/ownership or save lifecycle is rewritten.

PR94-dependent arrangements are conditional on map-first: normal Discover restores its native layer beside search, Saved only in the original row, Home separately and original card grid. Shared resources use their original non-map-first wrappers and saved layout. Experimental CSS has no matching workspace/card-grid roots while disabled.

The independent original-page probe first exposed a dormant PR94 false-path error: `React.Fragment` was referenced without importing React. Baseline2361 rendered; the restored branch failed. The approved named Fragment import/reference repair is the only sixth-file change. Initial failing probe stays separate; build/compiler17 and client1050+environment5 pass again after the repair. No filter/row logic was refactored.

## Validation and evidence profiles

The production-default build records common experiment flag **absent**, source policy false. Required configured client build/compiler17, client1050 plus environment5, locked maps116, static/module graph, export45 and original-layout media/notes9/30/5/43/18/7 pass. No package/lock/environment or private publisher change is included. All setup-generated tracked dependencies were restored after every verification browser/server closed.

Independent actual-App acceptance on 2 November passes **10/10** with the common experiment flag absent and **3/3** with that flag false plus the old owner flag true. Both exact-adopted runs report unchanged runtime/harness, zero page or caught-render errors, zero unexpected writes and zero note draft saves. Seven exact historical2361 client source blobs are loaded by a test-only Git-object Vite loader, with blob hashes recorded; no old checkout is reused. Baseline/current assertions compare original toolbar/filter/row/grid geometry, V2/classic mixed/empty/list-only maps, defensive stale browser keys and explicit experimental URLs, map-id navigation and native Full map entry/return. Stored state is preserved.

The portable `tests/browser/original-map-ui-rollback.mjs` is now a public quality-CI gate. CI fetches only the exact historical reference object, runs the absent policy and false/old-owner profiles sequentially, and retains their reports separately. Retained map-first17, Split35 and old-owner-flag-false1 checks also pass again on the final six-file runtime in explicitly enabled fixture builds, with unchanged behavior assertions and `productionDefaultProof=false`. These opt-in passes do not prove the production default.

Reproduce from the selected checkout:

```sh
node tests/browser/original-map-ui-rollback.mjs --out=output/original-map-ui-rollback-browser/default --port=4491
node tests/browser/original-map-ui-rollback.mjs --experiment=false --owner-flag=true --case=stale --out=output/original-map-ui-rollback-browser/false-policy --port=4491
```

Exact six-file runtime canonical SHA256: `8cb975e9e97acb412071b9adf85985af295334f68cacfea65c21a1403b45e173`. Exact tested harness SHA256: `e5fd5af754730cd54c7179992280dc6993f91740d29deebc37d1056037ba275d`. The committed harness removes only two trailing spaces on blank line148 so the required diff gate passes; its SHA256 is `0a2c1b2ab992781bcf19fbe93b6bc655f2b1212edf7aa6af0a9df6f7a3ec1160`, with executable content unchanged. Independent default report SHA256: `f6fcda47483cfff8832d2e612240fea91440d7e552a36b5042c6ef75d85dde5b`; false-policy report SHA256: `b7eec4403bbc9d963d824d37911168e03e0c05adc3b1e3ba715c13fd336f2835`.

Build/client checks were rerun after the Fragment repair. Locked/static/export/media checks preceded that import-only sixth-file repair; their affected runtime and assertions are unchanged. The initially failing policy test, restored-Discover render failure and historical-owner readiness diagnostics are retained separately from passing acceptance.

Durable independent reports/captures: `/Users/sweetbuns/.codex/visualizations/2026/10/23/01a16770-9bad-7d80-8a28-111ecb10f61b/care-map-original-ui-rollback-20261101/`. Evidence working folder: `/private/tmp/carearound-original-map-ui-rollback-20261101/`, including runtime-only patch/hash review, policy before/after, production build profile and verification logs. Independent baseline captures are fictional/intercepted browser evidence, not production or physical-device proof.

## Release preparation and remaining owner action

[PR quality41324444933](https://github.com/GudPerson/Senior-Resource-Map/actions/runs/41324444933) passed on exact feature `ae223fc503f0a3c8c9cdc1292b6d53022ecdf415`; [main quality41325499901](https://github.com/GudPerson/Senior-Resource-Map/actions/runs/41325499901) passed on exact merged main `8f2665946d338b2eec08e162a23ea05e06e9253e`. Both completed all21 steps, including the committed rollback harness. Main tree `c2013c199d8d795d5edf38eca92b0759fceeeb57` equals the tested feature tree; six runtime and committed harness hashes match. No app source changed after acceptance.

A separately reviewed source-pin-only clone `506bef6a-7e66-4e8c-9b9f-670d8cb8104c` was staged once and activated once at100% through deployment `b0f59ec8-11b4-4713-8a7c-bd086656ffbe`. Module ETag, handler/runtime, all44 binding-descriptor and global-settings fingerprints matched the previous runtime; its truthful `git-e32f2fb66624d864fdb4ddeb46abc520020ea10a` tag remains. Six public responses were200 and existing Help/Guide/client content stayed aligned at version `2026-10-31.help-cms.1793475137185`, digest `d04cd77e81f1bf4127d17bbb05a13dc97f45a05ab496e422ff37a8c3f2ee1b34`. These are source-preparation checks, not proof of original-UI delivery.

Normal owner publication has **not** been submitted. Authenticated browser automation was unavailable in this session, so the user was asked to perform the existing owner action:

1. Sign in as owner and open [Help Centre management](https://app.carearound.sg/help-centre?manage=1).
2. Open **More owner tools → Review & publish**. Review the existing saved approved library; no editorial draft save is required for this application-source-only publication.
3. Enter a meaningful review note, acknowledge the dialog and click **Publish saved content** once. Approve the existing protected environment if requested, then wait for that same job.
4. Record the new release/job and final paired Worker/Pages receipt. Verify matching source/content/artifacts, unlocked published state and actual original Discover/Care Map presentation before calling the rollback live. A failed/partial job requires its normal recovery flow, not another dispatch or source repin.

Use the [normal publication runbook](help-content-cms-release-runbook.md#4-publish-approved-content-after-installation) and [release checklist](release-checklist.md). Keep public main at the reviewed source until publication; this evidence-only branch is pushed separately and must not be merged. Do not deploy2361/stale dist, restore map documents, delete browser drafts or change publisher guards/credentials.

Sanitized preparation metadata: [original-map-ui-rollback-prepared-20261102.json](evidence/original-map-ui-rollback-prepared-20261102.json). The immutable local QA manifest is `qa-local-manifest.json`, SHA256 `bd9d7ea39b1dad2303990b6ab5bb91a51ed1dbcd884a90a0ddfe52ac76d49756` (50 QA-owned metadata/fictional files); `qa-local-acceptance.md` records10/10 plus3/3. Frozen QA/v1 files were not edited. There is no authenticated production owner-UI, physical-device/PWA or private-image/export-quality acceptance for this rollback yet.
