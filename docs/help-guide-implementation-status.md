# Help Centre and AI Guide implementation status

Date: 2 October 2026 (Asia/Singapore)

**The local candidate is technically verified. Joshua is content owner and has chosen progressive review during use; the up-front sixty-answer human exercise is deferred. Exact commit/push and release approval remain open. No full human-quality score or production acceptance is claimed.**

## Candidate and scope

- Worktree: `/Users/sweetbuns/.codex/worktrees/help-centre-guide/CareAroundSG`.
- Branch: `codex/help-centre-guide-20261002`; release/source base `b8345be4d2f7a097e81cb03eef64b473abd0cec9`.
- Content version: `2026-10-02.help-centre.6`; digest `44e8b868a4f7680894b00eb6af4e1699a00605902a08172c20d5ffe2851a049d`.
- One repository-authored library contains 48 source-reviewed articles: 40 public and eight restricted. The generated evidence has 196 records across 196 source-approved reading sections. All 105 original fact identities remain: 100 objects preserve their original hashes, and five have documented source-reviewed corrections. Forty-two task articles contain 80 numbered procedure sections with 417 steps; six conceptual articles retain explanatory prose. All 12 original topics retain their exact compatibility contract.
- Added `/help-centre` and stable article/section links. Existing `/help`, Inbox, Updates, reporting, scoped account readers and supported confirmed actions remain in place.
- English articles have a clear English fallback when the app uses another locale. Translations are a later reviewed content task.
- Public static reading works without inference. Restricted list, search, detail and citations use existing server capabilities, no-store responses and identity/revocation clearing. The Super Admin platform capability permits organisation help reading only; it adds no resource or workspace write permission.
- Cloudflare selects approved public evidence when the existing allowance permits. Displayed reviewed answers use the canonical article/fact text, including complete procedural steps; unchecked model prose cannot override that text. Coarse context chooses the private Personal place workflow in My Maps, and genuinely ambiguous private/public creation gets one clarification.

No production credentials, model budgets, database schema, role definitions, public-access policy, map assets or resource forms were changed. The dirty primary checkout and older Guide/release worktrees are preserved.

## Verification

| Evidence | Result | What it proves |
| --- | --- | --- |
| Full server suite | 1,092/1,092 pass | Existing and new route/access/action contracts under automated fixtures |
| Full client suite | 829/829 plus 5/5 environment checks pass | Client source/behaviour contracts and locked build environment |
| Content builder checks | 11/11 pass | Identity/parity, review/policy validation, deterministic freshness and public payload exclusion |
| Fixed offline set | 60/60 cases; 393/393 assertions pass; no model/paid calls | Actual served synthetic routes satisfy frozen explicit assertions; not a live-model or whole-answer human score |
| Supplementary answer tests | Pass | Complete HC-09 text, ordinary wording, wrong-domain sources, contradictory model prose transport replay, restricted inference exclusion and direct unavailable-AI guidance |
| Built browser fixture | 10/10 checks pass | 390/1440 px layout, keyboard/search/anchors/back navigation, English fallback, restricted access revocation/account switching/delayed logout response and legacy Inbox; all external network blocked |
| Actual local API and PGlite UAT | 3/3 checks pass | Every permitted article/section through seven fictional roles, phone Guide ↔ article navigation, automatic long-answer scrolling, and one hidden Programme only after review/confirmation |
| Personal place UI workflow | 4/4 pass at 1440/390 px | Addressed and map-only saves through actual local UI/controllers, My Places reuse and selected-map membership; geocoding replay, no live verification |
| Additional actual API role probes | Organisation Admin 43; Regional Admin 45 articles, no-store | Real capability loaders over fictional local accounts; not credentialed partner acceptance |
| Map lockdown | 104/104 prior focused checks; current full client suite passes | Unchanged locked map source and asset roots; prior focused evidence retained |
| Production-configured client build | Pass, 2,511 modules | Preserved Detailed/Discover derivative/default/gray/print roots; local artifact only |
| Static gate | 11 migration definitions; 579 modules/1,752 edges; no cycles or whitespace errors | Structural validation and preserved migrations; no migration execution |
| Worker dry-run | Pass, cached Wrangler 4.145.0 | Local Worker packaging without upload/deployment |
| Source graph | Refreshed | Implementation paths and callers indexed; local ignored cache |

The actual-route fixture uses synthetic accounts/resources and a disposable local PGlite database. Its simulated AI is explicitly labelled. A two-stage model transport replay tests the output guard; it does not measure real Cloudflare model selection quality. Desktop and phone article screenshots have been inspected locally. These checks do not certify every article workflow on physical devices or every exported file; unchanged export behaviour is source/ledger grounded.

## Review locally

- Public Help Centre: <http://127.0.0.1:5181/help-centre>.
- Personal place specimen: <http://127.0.0.1:5181/help-centre/add-a-personal-place-to-your-map#create-personal-place>.
- Fictional staff session for Guide/actions: <http://127.0.0.1:8793/__fixture/session/staff> (redirects to local app; no real sign-in).
- Served answers: `docs/help-guide-offline-answers.md`; human score sheet: `docs/help-guide-review-checklist.md`.

The local fixture and frontend are running for review. They cannot inspect a real account or save production resources. Their processes must stay running for these URLs to work. The built preview on port 5186 is browser-test infrastructure; use port 5181 for interactive testing.

## Initial review and ordinary-wording refinements

The user briefly reviewed the Help Centre and described it as a very good first draft. This is recorded as initial draft feedback, with final article/whole-answer scoring still pending. The follow-up twelve-question local API probe now returns the expected domain and canonical evidence in 12/12 cases. Supplemental tests also preserve current-account readers, editing, public creation, staff assignment, compound answers and other-person scope.

Refinements cover a new address or unlisted location on a map; updating an old shared layout; private places in owner exports; saved resources versus map membership; locating managed listings; organisation membership versus resource editing; and plans versus provider registration. New public reading sections in HC-06 and HC-33 provide the matching qualified explanations. The original 105 fact identities and sixty fixed scenarios remain; five source-reviewed content corrections are recorded separately with original hashes retained. Restricted-note evidence additionally requires explicit restricted/private/file wording. Navigation labels reuse the existing destination labels.

The requested screenshot specialist completed `docs/help-visual-content-plan.md`. It proposes six reviewed instructional captures for HC-09/HC-10 and a narrow later image-support addition. Four raw editor captures now support local workflow QA; no public help images or renderer changes were added.

See `docs/help-guide-initial-review-20261002.md` and the before/after probe artifacts. These were real local routes over fictional accounts with AI disabled, not live-model acceptance.

## Remaining gates and decisions

1. **Progressive owner review — authorised.** Joshua asked to review as work continues because he does not have bandwidth for bulk scoring. The candidate can advance to staged release consideration after technical gates, with human coverage explicitly provisional. No sixty-answer homework batch is required now; the original full-batch thresholds remain unverified. Record ordinary-use feedback in `docs/help-guide-progressive-review.md`; fix every known critical failure before release.
2. **Named ownership — confirmed.** Joshua confirmed on 2 October 2026 that he will be the sole product/content owner for now. Codex provides technical source/regression verification with specialist review. The generic `CareAround product` historical source-review metadata is not proof that a named human signed off every article. Review feedback weekly for the first month, then monthly; permissions/privacy/actions monthly; catalogue quarterly.
3. **Optional live-model acceptance.** Requires an explicitly bounded allowance and current availability check. Existing recorded pilot expiry: 2 October 2026, 18:54:34 SGT; shared cumulative 80-attempt cap and estimated USD 0.50 sliding-day Gateway control. No remaining-call claim, reset, renewal, extension or paid call was made here. An ongoing AI rollout needs its own approved operating policy. Reviewed fallback remains available without it.
4. **Commit/push and release approval.** With progressive review recorded, explicitly approve the exact candidate for commit/push and Cloudflare Worker API + Pages deployment. Release-time source drift, exact artifact parity, custom-domain MIME/byte/hash checks, role/access smoke and post-release known-failure retests remain required. No deployment approval is inferred from goal activation or the historical Guide release approval.

The operator skill requires: “Commit, push, and deploy only when the user explicitly asks, and verify deployment after release.” The activated project plan independently retains the release gate.

## Release and recovery outline

Review `output/help-centre/release-candidate.json` and its changed-file hashes. The source changes are additive feature modules and narrow adapters; the large reduction in the original knowledge module moves the original authoring objects into canonical content and generated output, with five documented corrections. There is no temporary independent migration corpus remaining. Public and restricted assets are not interchanged.

Before release, recheck the remote release line and obtain fresh recovery references. Planning/current-work records identify the released Worker version `faaa0b81-f6d7-4528-a6c0-0b0a3f0d9453`, Pages deployment `893e119c-c7a7-42c4-90a4-db9122713b17`, and source `b8345be4d2f7a097e81cb03eef64b473abd0cec9`. These references have not been re-observed at candidate closeout and must be refreshed before deployment. Restore client and Worker consistently if post-release checks fail; no database rollback is needed because this candidate contains no schema change.

The requirement-by-requirement audit is `docs/help-guide-completion-audit.md`. The goal is active and incomplete while the explicitly authorised release and applicable external requirements remain open; delegated semantic review is complete and human feedback is progressive. Named ownership is confirmed. A local candidate is a completed milestone, not project completion.

## Procedural expansion and reviewed corrections

The independent audit found incomplete task procedures and outdated labels. Source-grounded additions now cover the full procedural catalogue, including save/removal, map exports/annotations/notes, account/support recovery, standard and template Programme editors, authorised administration and private files. Current unavailable controls remain qualified; no hidden feature was enabled. `docs/help-content-reviewed-corrections.md` records four export-label corrections and the unavailable Region Groups navigation path. New reading evidence uses domain-qualified retrieval, and the existing wrong-domain and ordinary-wording expectations pass.

Permitted related-article summaries now reach authorised readers and clear with access revocation/identity changes. The human review rubric is concretely frozen for the same sixty scenarios; all human score cells remain pending. Every additional procedure is source-reviewed, not independently certified on a physical device. `output/help-centre/personal-place-workflow/report.json` records the four real local workflow checks with simulated address lookup.

## Review-packet and answer-completeness checkpoint — 2 October 2026

An independent source review found omissions hidden by the earlier automatic pass: combined notes/annotation sharing controls, private-account refusals, immediate save review, Programme server rechecks, public-Place access-review next steps, private-place reuse and missing basic-topic citations. Narrow changes in `guideHelpWorkflows.js` now use the existing approved canonical sections; account denials, confirmation handlers, source content, original fact hashes and role/write grants are preserved. The same sixty questions and frozen required/forbidden clauses pass. Additional valid citations raise the automatic check count to 393; this is not a human semantic score. Full server verification passes 1,090/1,090, static validation passes 579 modules/1,752 edges and local Worker dry-run packaging passes without upload.

The review packet now retains exact preceding turns, complete served response values, action-control labels/routes and usable local article links. `output/help-centre/human-review-batch.json` binds the version/digest, exact output, readable answers, inventory and unchanged semantic rubric v1. All human scores, reviewer/date, named ownership and publication/release approval remain pending.

The disposable API was restarted with the final source; its three actual-route checks pass, including 298 permitted article reads/1,254 section reads and one hidden Programme only after explicit confirmation. Client/browser/map/editor evidence is retained for unchanged sources/artifacts. The four Personal place checks still use simulated geocoding. Gate logs are archived with the candidate under `output/help-centre/gate-evidence/`; `node scripts/verify-help-release-candidate.mjs` verifies hashes and local terminal/report evidence without granting signoff or release authority. Manifest revision 5 was the candidate at this historical checkpoint; the current candidate is described above. No commit, push, deployment, paid inference, budget/credential change or production write occurred.


## Confirmed owner and CMS follow-on — 2 October 2026

Joshua directly confirmed that he will maintain the content himself for now and reported that the instructions are easier to follow. Named ownership is therefore confirmed. Whole-answer scores, article publication signoff and release approval remain pending; no scores or permission grants are inferred. The goal was blocked at this historical checkpoint; the user subsequently resumed it for the CMS prototype. Owner selection is complete.

The requested self-service text/image/video editing is scoped in `docs/plans/2026-10-02-help-content-cms.md`. Recommend a visual editor over the canonical library with Draft → Preview → Publish, version recovery and one generated Help/Guide content version. This is a planned follow-on within the same project; no CMS runtime, media renderer, upload service, schema, role or deployment has been added. Keep the existing candidate intact while prototyping one article.


## Direct help when AI is unavailable — current candidate revision 7

The resumed completion audit found a confusing detour: the previous no-AI answer supplied chat-submission/waiting steps before its manual-help step. HC-29 now has the separate canonical `read-help-without-ai` section: open Help Centre, browse/search, read the article, then use normal app controls with review/confirmation. The existing unavailable-AI selector points to that section; ordinary ask-Guide instructions and all 195 previous fact bodies/routes and 12 original topics remain unchanged. This adds one derived evidence record, four steps and one procedure section. Current content is `2026-10-02.help-centre.4`, digest `c2f6c89ddbd74ba3e7c15175c27a8b932c1a79a9abae8ed6ed37488fd7bed8f4`, with 48 articles / 196 sections and 42 procedural articles / 80 procedures / 416 steps.

Focused server checks passed 89/89; full server 1,090/1,090, client 829 plus five environment checks, builder ten, frozen offline sixty cases / 393 assertions, production-configured client build, static validation, local Worker packaging, built browser ten, actual API three and Personal place workflow four passed freshly for this content revision. The locked-map-only prior log is retained for unchanged map source, not as new content/build proof. All live inference was disabled; Personal place address lookup is replayed. CUA separately observed the real local no-AI answer with its checkbox off and the correct section citation. Screenshots/report are in `output/playwright/help-centre-no-ai-v7/`. No physical-device, live-model, live-geocoding or production acceptance is claimed.

All 225 recorded revision-6 artifact bytes are preserved in `output/help-centre/history/revision-6-artifacts.zip`, with the raw receipt at `output/help-centre/history/revision-6-manifest.json`. Their extracted historical root was verified; old source copies do not enter the active Graft graph. Current candidate and review batch have fresh exact hashes; the fixed question set and semantic rubric are unchanged. Human scores, reviewer/date and publication approval remain empty; Joshua remains confirmed as sole owner. The candidate verifier now reports that recorded ownership decision instead of incorrectly listing owner selection as pending. It cannot infer content/answer or release approval from test passes. The implementation goal remains active and incomplete. No commit, push, deployment, paid inference, budget renewal or production credential/data change occurred.

The local CMS workflow prototype was completed separately at `/Users/sweetbuns/CareAroundSG/output/help-content-cms-prototype/` (http://127.0.0.1:5187/). It edits an unreviewed copied article in one tab and supports image/video metadata, previews, revision restore and verified pasted-backup recovery. It is not persistent/authenticated publishing and does not alter this canonical library. The current review policy is progressive owner feedback; the up-front bulk review is deferred. Exact release approval and release-time verification still apply.


## Progressive review checkpoint — 2 October 2026

Joshua directly chose review during use because he lacks bandwidth for the full sixty-answer exercise now. `docs/help-guide-progressive-review.md` records the workflow, unchanged automated checks, empty human scores and critical-failure gate. The plan's review timing is updated; original fixed cases and semantic rubric remain frozen. No deployment, paid inference, budget renewal, credential or permission authority is implied.


## Delegated quality review — 2 October 2026

Joshua subsequently asked Codex to delegate the review to capable independent reviewers. Independent specialists will assess all 48 article dispositions and all sixty complete served answers against the frozen rubric, current app evidence and linked sections. Record their findings and any scores explicitly as AI-assisted source/semantic review, separate from human scoring and live-model selection quality. Joshua's hands-on feedback remains optional and progressive. Reviewers do not authorise production release on his behalf.



## Independent review and final local verification — 2 October 2026, revision 8

Joshua delegated the bulk review to independent specialists and approved progressive feedback during ordinary use. The final source-grounded AI-assisted review accounts for all 48 articles and all 60 complete served answers: 220/220 required clauses, 265/265 additional claims, 60/60 complete tasks and zero critical failures. These are AI-assisted semantic scores; human scores remain empty, and no live-model, real-account or production acceptance is inferred. See `docs/help-guide-independent-review-20261002.md`.

Current content is `2026-10-02.help-centre.6`, digest `44e8b868a4f7680894b00eb6af4e1699a00605902a08172c20d5ffe2851a049d`: 48 articles / 40 public / 196 evidence sections, 42 procedural articles / 80 procedures / 417 steps. Narrow corrections give generic map-membership controls, direct cancellation answers including the British spelling “cancelling”, owner-qualified pin diagnostics and the Studio Share/update procedure. HC-10 now has its own prerequisite, save-result and privacy clarity. Original 105 fact identities, five documented corrections, 12 topics and the frozen rubric/cases remain preserved.

Fresh final gates: 1,092 server tests; 829 client tests plus five environment checks; 11 builder checks; 60 offline cases / 393 assertions, zero model calls; production-configured client build; static checks and Worker dry-run packaging. Fresh CUA local UI/controller checks verify four Personal place saves at 1440/390 px, My Places reuse/map membership, the complete long HC-09 answer beginning visibly without manual scrolling, two-way reading navigation and one hidden Programme only after review and confirmation. The refreshed read-only role probe checked 298 permitted articles and 1,261 section URLs over seven fictional roles with no-store and restricted denial/search checks. Address lookup is replayed; no physical-device or live-geocoding proof is claimed.

The earlier ten built-browser layout/access/navigation checks and 104 focused locked-map checks are retained explicitly as prior evidence for unchanged UI/access/map sources. They were not rerun or relabelled as current .6 browser passes. Revision 7's exact 228-artifact bundle and raw receipt remain in `output/help-centre/history/`; current source/build/report hashes are separately bound in revision 8. The pilot expiry regression uses test-scoped synthetic time only; real expiry, budget and runtime controls are unchanged.

There is no bulk scoring task for Joshua now. Optional real-use feedback is tracked progressively; every known critical defect remains a release blocker. The implementation goal remains active until an explicitly authorised release is verified. Exact candidate commit/push, Worker/Pages release, release-time recovery/custom-domain parity and any applicable new live-model allowance remain separate gates. No new commit, push, deployment, paid inference, budget renewal, credentials, database schema or production-data change occurred.


## Guide task-button correction and independent release preflight — revision 9

Independent release review found that new Guide actions were present in served JSON but filtered out by the legacy action-route guard. A 15-line Guide-only `GuideActionLinks` component now accepts exact signed-in My Maps/My Places destinations and validates article-reading destinations with the existing Help guard. `GuidePanel` delegates only message actions; resource links, notification links, saved-search links, shared route guard and permission enforcement are unchanged. Guests still cannot use the two private Directory actions, and arbitrary/external/encoded queries remain denied.

Fresh affected verification: 830 client tests plus five environment checks, production-configured build, 580 modules / 1,755 import edges with no cycles, and static checks. Independent review also passed 18 focused route/render tests and compared the patch against the archived revision-8 source. Fresh CUA actual local clicks verified desktop Open My Maps, Open My Places and Read instructions (correct article section), plus Open My Places at 390 px; no page errors, model calls or production writes. Source content remains `.6`, with the unchanged 60-answer semantic/offline review. Revision 8's complete 246-artifact bundle and receipt were frozen before the correction.

The prior ten built-browser checks remain historical evidence for unchanged Help renderer/access/context sources. GuidePanel has changed, so it is excluded from the unchanged-source claim and covered by fresh rendered route tests and the four CUA navigation checks. Existing server, builder, Worker packaging, offline and Personal-place/API evidence remains explicitly retained because their implementation/content is unchanged; it has not been relabelled as freshly rerun.

One extra broad question, “What happens if I cancel creating a map?”, falls back to a generic clarification with AI off. Independent review classifies this as a noncritical intent-coverage limitation, with no false write, deletion, permission or completion claim. It is recorded separately for progressive improvement; frozen 60-case scores remain unchanged.

Read-only release preflight confirms origin/main and both production release manifests still point to `b8345be4d2f7a097e81cb03eef64b473abd0cec9`; Worker and Pages recovery references are recorded. Cloudflare MCP authentication failed, but existing Wrangler read-only access succeeded. No new credentials or permissions were needed. Clean release integration/provenance, credentialed standard partner smoke (currently unverified), explicit release approval and post-release/custom-domain parity remain outstanding. The goal remains active; no commit, push, deployment, model allowance renewal or production mutation occurred.
