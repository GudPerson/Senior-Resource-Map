# Original Discover and Care Map presentation rollback — 2 November 2026

Status: **published on2November2026 at09:21:41SGT (01:21:41UTC)**. The normal owner publication completed from [PR96](https://github.com/GudPerson/Senior-Resource-Map/pull/96), public base `8f2665946d338b2eec08e162a23ea05e06e9253e`, into private content build `22e7a20b9c65590f00a4a839989bae154cb96a2e`. Original Discover presentation is verified on the actual public desktop and phone UI. The same reviewed original owner Care Map presentation policy is delivered; authenticated owner-map visual/interaction UAT remains unclaimed. Earlier source-preparation/pending-owner-action status is superseded. Main remains pinned at8f; this documentation-only evidence branch is separate and must not merge to main or cause another publication.

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

## Completed publication and acceptance

[PR quality41324444933](https://github.com/GudPerson/Senior-Resource-Map/actions/runs/41324444933) on feature `ae223fc503f0a3c8c9cdc1292b6d53022ecdf415` and [main quality41325499901](https://github.com/GudPerson/Senior-Resource-Map/actions/runs/41325499901) on merged main `8f2665946d338b2eec08e162a23ea05e06e9253e` passed all21 steps. Their tree is identical; runtime and committed harness hashes above remain unchanged.

The user performed the normal owner Review &publish action. Publication `1793582083066-94e41165-4343-4bf6-815f-0231239c3d4c`, job `6c065ae5-4db5-4357-a02e-1faac76892b2`, completed at `2026-11-02T01:21:41Z` (2November09:21:41SGT). Protected publisher run `41371453019` / job `125042616527` passed all7 steps and all4 release quality gates. Its acknowledged receipt is published, the published pointer is promoted and publication lock is cleared. No second publication or retry is required.

Actual live targets are Worker `95a67c7c-6f9f-4b1c-840a-8629452ac4af` at100% (deployment `10735be3-b963-4b94-9dfa-872b9cf2668d`) and canonical production/main Pages `407157e5-93c1-43f3-ad05-7760af43ecd0`, with observed immutable URL `https://407157e5.senior-resource-map.pages.dev`. API/client report clean private build `22e7a20b9c65590f00a4a839989bae154cb96a2e`; public base8f and private content build22e7 are distinct provenance identities by design.

The normal approved snapshot digest is `f6536bc7d035b7c5ad496b10d42f2d73b855bd3559ca6ef403420289fda82abd`. Help, Guide and client status coherently report version `2026-11-02.help-cms.1793582082858` and compiled digest `0773d8aad5d18a02bc065d1adcd281547cb6920fd6ec775dda3f9ff0e8387967`. This proves source-bound coherent approved-snapshot delivery; authored-v1 source-body equality was not independently re-read or claimed.

Independent production QA passes19/19 provenance/delivery checks. Fresh expectations came from the actual new producer:105custom and103immutable byte/hash/MIME records,12ordinary HTML observations and4immutable-origin proof denials pass. All44binding descriptors/runtime and approved global settings match the reviewed baseline. Common experiment and old owner flags are absent in the actual canonical deployment and project metadata. No raw private Worker bundle was fetched.

Actual anonymous Discover checks additionally verify the original450px sidebar beside1278px map/sign-in pane at1728×1050, and the original Browse/results presentation at390×844. Public release.json independently reports clean22e7; actual loaded client-asset hashes and positive original-branch DOM geometry bind this UI evidence to the new delivery. Zero page/render errors occurred. A fresh nonpersistent browser blocked its sole attempted analytics POST; no app data-writing request was transmitted, no auth/profile/geolocation was imported, and the task browser is closed. Public screenshots remain local-only; none is committed.

Production QA's frozen18-file manifest is `qa-production-manifest.json`, SHA256 `62fe630f9830b24e724adbb3dd92a8266b0ebddf9a11eecf384817324c96f6d5`. The separate actual-public-UI addendum manifest is `ui-manifest.json`, SHA256 `84729053afcde6be1c05a9f4fc4ca6a4a24348568d0799194287c80da8945cf8`. Earlier local QA50-file manifest `bd9d7ea39b1dad2303990b6ab5bb91a51ed1dbcd884a90a0ddfe52ac76d49756` remains immutable; local fixture passes remain distinct from production proof.

Historical preparation: source-pin-only clone506bef6a/deploymentb0f59ec8 prepared source8f while olde32/Pages466 still served. That earlier pending-publication state is superseded by the completed normal owner publication above. No additional source repin, publication or main push is needed for this evidence update.

Remaining limits: authenticated owner Care Map visual/interaction UAT, full credentialed smoke, physical devices/gestures/PWA/private-image/export quality and authored-v1 equality are unclaimed. The exact compiled four-entry Functions route inventory was not exposed by the terminal report; deployed ordinary/proof/embed behavior passed, but a positive enabled-embed token was not exercised. Guest public counts do not establish owner-library counts.

See the [final sanitized evidence record](evidence/original-map-ui-rollback-prepared-20261102.json), [publication runbook](help-content-cms-release-runbook.md#4-publish-approved-content-after-installation) and [release checklist](release-checklist.md). Frozen artifacts, primary153 unfinished entries, earlier candidates and main8f are protected. This evidence branch must remain separate.
