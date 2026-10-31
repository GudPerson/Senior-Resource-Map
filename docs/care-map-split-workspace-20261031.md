# Care Map split workspace — local candidate, 31 October 2026

Release update (1 November): the user has authorized making this owner workspace the default. The following records the historical local candidate; current policy, fallback and release gates are in [the default-workspace release record](care-map-split-default-release-20261101.md).

The user selected the Split workspace concept for the next Care Map direction. This is a functional, owner-only local candidate. It is **not committed, pushed or deployed**. Discover, Shared Maps, embeds, frozen shares and Print retain their established presentations and permissions.

## Review and fallback

Worktree: `/private/tmp/carearound-split-workspace-20261031`; branch `codex/care-map-split-workspace-20261031`, based on public main `d8c108aeb04335a366c88d0caf757969ec47d5d7` (remote revision checked before implementation). Its common Git directory is the primary repository's `.git`; the primary checkout's 153 unfinished entries and the previous release-evidence worktree are preserved.

Open an owner map with `?workspace=split` (append `&workspace=split` when there are other parameters). `VITE_OWNER_MAP_WORKSPACE_ENABLED` is optional and OFF by default. `workspace=current` explicitly selects the retained current presentation even in a build with that flag enabled. These are presentation choices, not access grants.

The presentation is chosen once per page load. **More → Use current layout** first flushes the actual Studio controller and then reloads the same owner route. A failed flush keeps the owner in the workspace. Open notes and active annotation/personal-place tools prevent this fallback until their existing close/finish/cancel flow completes. The mobile map's equivalent return button uses the same guarded action. The valid selected Studio view is carried as the UI-only `workspaceView` parameter; unknown IDs use the existing default. This explicit reload does not promise the same live map instance or camera. It does preserve supported saved documents and resource data. No database/media restoration or schema rollback is involved.

The current UI source remains in place. The previously accepted source and paired-release evidence are recorded in the design baseline at `/Users/sweetbuns/.codex/visualizations/2026/10/23/01a16770-9bad-7d80-8a28-111ecb10f61b/care-map-workspace-20261031/current-ui-baseline.json`. Those historical deployment IDs are references, not automatic rollback commands. A future release must use the current release checklist and normal compatible paired publisher with the latest approved CMS content.

## Functional scope

- A floating labelled rail controls Resources, Studio, Edit, Notes, Share, Export and More. Phones use five readable primary launchers, with Share and Export in More.
- At sufficient viewport width and text size, Resources remains on the left and one contextual tool inspector opens on the right. Narrower screens show one panel at a time. Panels overlay the same map; they do not resize its canvas.
- Resources keeps the existing cards, ordering, table/list-only handling, real notes entry and search. Its transient one/two/three-column width is capped by actual available space and font size. Closing the inspector restores the requested capacity. This does not write `design.layout`.
- Search and a labelled **Map layers and design** entry remain outside the drawers. That entry opens the existing Studio in Design mode. Standard/Detailed and the established native map controls remain driven by DirectoryMap's actual zoom/viewport/availability callback; no guessed duplicate map state is created.
- Existing manage-resources, personal-place chooser/import/category, category arrangement, pin hiding, short description, annotations, resource removal, map details, distance, share, Print, notes/images and Excel commands retain their existing handlers and capability gates.
- Map Studio has one stable component instance and save queue through panel toggles and responsive transitions. A new presentation prop stacks its existing controls in the inspector. Named-view actions use a native labelled disclosure; Retry/conflict recovery remains visible. Hidden panels are hidden/inert while their forms and state remain mounted.
- The persistent status is explicitly scoped to **Map Studio**. It reports the controller's real loading/pending/saving/saved/error state and selected view/mode, including while the inspector is closed. Annotations and notes keep their own lifecycles; there is no global Save all.
- The annotation hook moves only the existing toolbar presentation into the Edit inspector. Geometry, upload, revision, undo and autosave logic remain unchanged. Active annotation/personal-place operations keep their context visible and disable conflicting launcher actions. An unfinished shape or uploaded-image placement requires the existing Finish/Cancel flow before Close; completed annotations retain independent autosave.
- Current presentation, default owner mode and existing V2/classic selection remain available. No server/auth/schema, resource membership, public payload, map renderer/camera algorithm, image budget/compression, shared snapshot or export-renderer change is included.

## Regression boundaries and evidence

Meaningful automated coverage includes actual App/router fictional fixtures, the real DirectoryMap and Studio component, map/controller identity and geometry, actual resource columns, selected-view restoration, delayed in-flight saves with a queued patch, failed save/flush, conflict recovery, independent notes drafts, real editor entry, Escape/focus/modal ordering and responsive/text-size cases. Synthetic browser actions and intercepted APIs are not physical-device or production proof.

Initial failed evidence is retained separately: two existing source-contract regex expectations needed the new explicit split conditional; phone hierarchy initially hid the first editable design field; short landscape mistakenly applied bottom-sheet clearance to a side inspector, lifting Current layout over native Reset; a generic header selector hid New/Rename inputs; and awaiting a successful flush exposed a stale render-saving guard in the explicit Explore action. These were addressed with workspace-only presentation fixes; native map algorithms and current defaults were not changed. Fixture label/idempotency issues are separate from product regressions.

Validation and final report identities are recorded in the leading regression-ledger/session-handoff entries after the independent final replay. Reproduce with:

```sh
node tests/browser/owner-split-workspace.mjs --out=/private/tmp/carearound-split-recheck
npm run test:client
npm run build:client
npm run verify:map-lockdown
npm run check:static
```

Before a production-default decision, still perform signed-in real-data owner UAT, physical phone/tablet/PWA/keyboard and real wheel/pinch/rotation checks, actual upload/download/PNG/PDF/notes-images quality and network/heap checks, and a compatible recovery rehearsal with newly authored supported documents. The local test fixtures do not establish those results. Full release quality/CI and protected paired publication remain separate, unexecuted release gates for this candidate.


## Final local verification

The final complete actual-App matrix is **20/20 PASS** at `/private/tmp/carearound-split-qa-final20/report.json`, with unchanged source/harness, zero JavaScript page errors and zero unexpected writes. The durable canonical report is `browser-review.json` in the review folder, SHA256 `61547c70e2e8a05b1ef48bd19d633bf4a250a0c22aad436948d1d1a43effdc6b`. Its canonical runtime-file inventory hash is `f62ea0a324f0d870add49ea4ad8224b1f987b854dead40e526171af701fb5eab`; exact final harness SHA256 is `281b6aba8cd4a538c41b8e1df356e0ae109d9d06c09f536b6035a31b545679de`.

Named-view New/Rename/Duplicate/Set default/Delete, held/queued saves, failures/conflicts, real in-flight mode guards and successful one-tap Explore/Design reentry are exercised through the actual controller with fictional APIs. A true same-page viewport sequence retains a Rename draft and the same map/controller. Full-rectangle checks include the short-landscape large-text layer button, not merely its exposed centre point. Provider-credit probes temporarily enable hit testing on the existing pointer-events-none badge and restore it without events or resize; they do not manufacture attribution.

The Explore fix replaces only the existing imperative mode guard's stale render `saving` value with its actual single-flight refs. UI busy/disabled indicators, save ordering, error/dirty rules and queued flushing remain intact. Direct in-flight imperative calls remain blocked on both presentations; successful flush can immediately enter Explore without a second tap. No timeout or forced transition is used.

Final client1047 + environment5, configured10-root build/compiler17, explicit locked maps116 and static/module/diff checks pass. Exact final reports and logs are recorded by the leading ledger/handoff entry and durable source manifest. The earlier19-case pass and supplemental Explore failure are retained as iteration evidence, not the final accepted result. No backend suite, release CI, deployment or physical-device result is claimed.

The reviewed source, tests and these docs are preserved under the durable review folder as a patch plus complete changed-file bundle. `source-manifest.json` pins baseline D8, payload hashes, patch/bundle hashes and the scratch apply/hash verification. It excludes environment files, credentials, dependencies and generated Graft content. The retained current presentation is the rollback path; the bundle is a local recovery artifact, not a live-release receipt.
