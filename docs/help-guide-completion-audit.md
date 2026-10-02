# Help Centre and Guide completion audit

Date: 2 October 2026 (Asia/Singapore)

**The goal is not complete. The local milestone is verified; Joshua chose progressive owner review instead of an up-front bulk scoring gate. Full human-quality coverage remains unverified, and exact release approval/production verification remain open.**

This audit uses the current source/build hashes, plan requirements, served outputs and local reports. It distinguishes source review, offline fixtures, simulated transport, actual local routes and future live/production proof. The user has supplied positive initial draft feedback. The subsequent local refinement corrects everyday wording while retaining the original frozen scenarios and current-account boundaries; final human quality remains pending. Joshua subsequently confirmed that he will maintain the content himself for now on 2 October 2026.

| Area | Required outcome | Current conclusion | Authoritative evidence / limitation |
| --- | --- | --- | --- |
| Scope and authorisation | Isolated goal activation, no production release authority | verified locally | Activated plan section 13; branch/base/worktree in release-candidate.json |
| Inventory | All 48 candidate capabilities have a reviewed/qualified article disposition | source-reviewed; human publication review pending | 48 approved source JSON records and docs/help-content-inventory.md |
| Migration | All 105 fact identities and 12 exact original topics are retained; 100 original objects and five documented source corrections | verified locally | helpMigrationBaseline.json hashes; builder and server acceptance gates |
| Single source | Reader and Guide outputs derive from canonical article sections | verified locally | build-help-content.mjs; generated artifacts; no legacy migration corpus remains |
| Identity and links | Unique IDs/slugs/anchors, valid relations and fresh deterministic artifacts | verified locally | Builder 11/11; all delivered section URLs checked through real local API |
| English first | App locale remains selected; explicit English article fallback | verified locally | Built browser desktop zh-CN and mobile checks; HelpCentrePage lang=en |
| Policy | Existing capabilities protect restricted list/search/detail/section/relations/citations | verified locally | helpArticles.test.js and real API 7-role matrix; no new write grant |
| Private caches | No-store responses; delayed responses/revocation/account/User View clearing | verified locally | Built browser checks 7-9 and Help API headers |
| Public privacy | Restricted/internal evidence absent from public artifacts | verified locally | Builder safe-field checks and client generated public corpus; role API assertions |
| Coarse context | Article identity/private paths do not enter Guide/report page context | verified locally | supportDomain/guideAssistantContext tests; Help Centre context assertion |
| HC-09 | Complete six steps, location verification, no-address alternative, reuse/privacy/export qualifications | verified locally | Canonical equality across variants, real phone route and inspected article screenshot |
| Intent | Private/public distinction with one ambiguity clarification and explicit-public precedence | verified offline | Frozen real-route cases and supplementary model source replay guard |
| Canonical text | Model prose cannot overwrite approved facts/procedures | verified by replay; live selection quality pending | Two-stage fake transport tests in helpCentreGuideAcceptance.test.js |
| Current accounts | Permissions/counts/inventory come from existing scoped server readers | verified with synthetic accounts | Full server suites and frozen scoped/privacy cases; no credentialed partner smoke |
| Confirmation | No create before review/explicit confirmation; existing checks retained | verified with disposable writes | Real Programme action UAT: zero matching rows before confirmation, exactly one hidden row afterwards |
| AI unavailable | Public articles/manual controls remain available; no false success claim | verified locally | Direct unavailable-AI real route, canonical HC-29 and supplementary no-inference test |
| Fixed quality set | Five variants of each of twelve scenarios, exactly 60 cases | verified offline | helpCentreGuideCases.js and offline-evaluation.json, 393/393 explicit assertions |
| Human quality | Progressive ordinary-use review now; original full-batch scoring standard retained for later acceptance claims | owner approved gradual review; full-batch scores unverified | help-guide-progressive-review.md; fixed cases/rubric unchanged; no score inferred |
| Live model | Same frozen cases/known failures; exact model/version/calls/spend/availability | pending separate authorisation | No real inference performed; existing pilot not reset/renewed |
| UI | Browse/search/headings/steps/mobile/keyboard/loading/empty/back/deep links | verified in browser fixtures | 10/10 built UI checks; no overflow at 390/1440; no errors |
| Two-way navigation | Guide reading links open section and article CTA opens Guide | verified locally | Actual-route phone UAT in both directions |
| Response scroll | Long canonical answer start visible without manual scrolling | verified locally | Real phone UAT measured reply/viewport geometry |
| Existing support | Guide/Inbox/Updates/report/recovery/review/history/preferences retain contracts | automated + targeted browser proof | Full existing client/server suites; legacy Inbox UAT; comprehensive credentialed production smoke pending |
| Runtime gates | Full server/client/environment/static/required production-configured build | verified locally | 1092 server; 829 client +5 environment; static log; 2511-module client build |
| Locked surfaces | Map controls/data/auth/forms/schema/secrets/budgets preserved | verified local diff/tests; production unchanged | 104 map tests; exact release map roots; unchanged schema/config/lockfile; no DB migration |
| Packaging | Concrete exact diff, source/build hashes, rollback and compatibility notes | verified locally | release-candidate.json and tracked-candidate.patch; Worker dry-run only |
| Ownership | Named accountable product/content owner and technical verifier | owner confirmed | Joshua’s direct 2 October 2026 reply; technical verification by Codex with specialist review is distinct from human publication signoff |
| Maintenance | Weekly first-month triage then monthly; sensitive guidance monthly; catalogue quarterly | documented; Joshua owns maintenance | help-content-authoring.md and activated plan section 12 |
| Release | Explicit commit/push + Worker/Pages approval and fresh release line/recovery | pending authorisation | No new commit, push or deployment; operator skill and plan gate retained |
| Production proof | Exact custom-domain MIME/byte/hash parity and post-release role/known-failure checks | not performed | No new production artifact exists; release-time requirement |
| Completion | All quality/ownership/authorised release requirements true | not achieved | Delegated semantic review complete; progressive human feedback, applicable live-quality authority and production release gates remain explicit; ownership confirmed |

## Everyday wording proof

After the initial review, twelve questions were sent through the actual local API as a fictional member with AI disabled. The corrected route/domain passed in 12/12. Thirteen supplemental regressions cover these questions, the US organisation spelling, and exclusions for account reads, edits and other-person scope. The original sixty scenarios were preserved. Before/after messages are saved in the everyday-question-probe artifacts and `docs/help-guide-initial-review-20261002.md`. This evidence is local and synthetic; it does not score live-model language understanding or replace human answer review.

## Direct link and scrolling proof

The actual local API checked every permitted article detail and every section URL for seven fictional roles. The API uses the real access loaders over disposable PGlite state; it is not an externally authenticated account audit.

| Fictional viewer | Articles | Section URLs checked |
| --- | --- | --- |
| guest | 40 | 173 |
| member | 40 | 173 |
| staff | 42 | 177 |
| orgadmin | 43 | 183 |
| regionadmin | 45 | 186 |
| admin | 48 | 196 |
| impersonating | 40 | 173 |

Total checks: 298 permitted article reads and 1,261 section reads. All returned the expected permitted article/section; role denial/search/header assertions also passed. These totals come from the current .4 `output/help-centre/system-uat.json`.

At a 390 px width, the complete reply was 986.3 px high inside a 614 px message viewport. Its start appeared 11.5 px below the viewport top automatically. The article CTA reopened Guide with the coarse Help Centre page label.

## Next required human/external action

Joshua is the confirmed content owner and has chosen gradual review during use. Report corrections when encountered; the up-front sixty-answer review is deferred. Retain actual human coverage and technical checks separately. Live Cloudflare evaluation and commit/push/production deployment need their applicable explicit authorisation. No additional model allowance, credential access or release approval is inferred from this audit.

## Procedural audit follow-through

The audit gaps have been addressed with 42 procedural articles (79 numbered sections / 412 steps) and six conceptual articles. The controlled migration provenance retains all original hashes and five explicit reviewed exceptions. Final .3 server (1,090), client (829 plus five environment checks), builder (10), offline cases (60/393 assertions), built browser (10), actual API UAT (3), and Personal place workflow (4) checks pass. New task evidence is qualified by domain; old selection and unsupported-workflow cases remain intact. The HC-09 workflow checks use 1440/390 px browser viewports and simulated geocoding, so they do not establish physical-device or live-address acceptance.

Related restricted titles now appear only in permitted article responses and clear on revocation/account changes. The human semantic rubric defines required clauses, variant applicability, complete-task outcomes and critical failures before scores; all human cells remain pending. Screenshot assets remain a proposed later feature: QA captures exist but no public image rendering has been added.

## Review-packet and answer-completeness checkpoint — 2 October 2026

An independent source review found omissions hidden by the earlier automatic pass: combined notes/annotation sharing controls, private-account refusals, immediate save review, Programme server rechecks, public-Place access-review next steps, private-place reuse and missing basic-topic citations. Narrow changes in `guideHelpWorkflows.js` now use the existing approved canonical sections; account denials, confirmation handlers, source content, original fact hashes and role/write grants are preserved. The same sixty questions and frozen required/forbidden clauses pass. Additional valid citations raise the automatic check count to 393; this is not a human semantic score. Full server verification passes 1,090/1,090, static validation passes 579 modules/1,752 edges and local Worker dry-run packaging passes without upload.

The review packet now retains exact preceding turns, complete served response values, action-control labels/routes and usable local article links. `output/help-centre/human-review-batch.json` binds the version/digest, exact output, readable answers, inventory and unchanged semantic rubric v1. All human scores, reviewer/date, named ownership and publication/release approval remain pending.

The disposable API was restarted with the final source; its three actual-route checks pass, including 298 permitted article reads/1,254 section reads and one hidden Programme only after explicit confirmation. Client/browser/map/editor evidence is retained for unchanged sources/artifacts. The four Personal place checks still use simulated geocoding. Gate logs are archived with the candidate under `output/help-centre/gate-evidence/`; `node scripts/verify-help-release-candidate.mjs` verifies hashes and local terminal/report evidence without granting signoff or release authority. Manifest revision 5 was the candidate at this historical checkpoint; the current candidate is described in the latest checkpoint. No commit, push, deployment, paid inference, budget/credential change or production write occurred.


## Confirmed owner and CMS follow-on — 2 October 2026

Joshua directly confirmed that he will maintain the content himself for now and reported that the instructions are easier to follow. Named ownership is therefore confirmed. Whole-answer scores, article publication signoff and release approval remain pending; no scores or permission grants are inferred. The goal was blocked at this historical checkpoint; the user subsequently resumed it for the CMS prototype. Owner selection is complete.

The requested self-service text/image/video editing is scoped in `docs/plans/2026-10-02-help-content-cms.md`. Recommend a visual editor over the canonical library with Draft → Preview → Publish, version recovery and one generated Help/Guide content version. This is a planned follow-on within the same project; no CMS runtime, media renderer, upload service, schema, role or deployment has been added. Keep the existing candidate intact while prototyping one article.


## Direct help when AI is unavailable — current candidate revision 7

The resumed completion audit found a confusing detour: the previous no-AI answer supplied chat-submission/waiting steps before its manual-help step. HC-29 now has the separate canonical `read-help-without-ai` section: open Help Centre, browse/search, read the article, then use normal app controls with review/confirmation. The existing unavailable-AI selector points to that section; ordinary ask-Guide instructions and all 195 previous fact bodies/routes and 12 original topics remain unchanged. This adds one derived evidence record, four steps and one procedure section. Current content is `2026-10-02.help-centre.4`, digest `c2f6c89ddbd74ba3e7c15175c27a8b932c1a79a9abae8ed6ed37488fd7bed8f4`, with 48 articles / 196 sections and 42 procedural articles / 80 procedures / 416 steps.

Focused server checks passed 89/89; full server 1,090/1,090, client 829 plus five environment checks, builder ten, frozen offline sixty cases / 393 assertions, production-configured client build, static validation, local Worker packaging, built browser ten, actual API three and Personal place workflow four passed freshly for this content revision. The locked-map-only prior log is retained for unchanged map source, not as new content/build proof. All live inference was disabled; Personal place address lookup is replayed. CUA separately observed the real local no-AI answer with its checkbox off and the correct section citation. Screenshots/report are in `output/playwright/help-centre-no-ai-v7/`. No physical-device, live-model, live-geocoding or production acceptance is claimed.

All 225 recorded revision-6 artifact bytes are preserved in `output/help-centre/history/revision-6-artifacts.zip`, with the raw receipt at `output/help-centre/history/revision-6-manifest.json`. Their extracted historical root was verified; old source copies do not enter the active Graft graph. Current candidate and review batch have fresh exact hashes; the fixed question set and semantic rubric are unchanged. Human scores, reviewer/date and publication approval remain empty; Joshua remains confirmed as sole owner. The candidate verifier now reports that recorded ownership decision instead of incorrectly listing owner selection as pending. It cannot infer content/answer or release approval from test passes. The implementation goal remains active and incomplete. No commit, push, deployment, paid inference, budget renewal or production credential/data change occurred.

The local CMS workflow prototype was completed separately at `/Users/sweetbuns/CareAroundSG/output/help-content-cms-prototype/` (http://127.0.0.1:5187/). It edits an unreviewed copied article in one tab and supports image/video metadata, previews, revision restore and verified pasted-backup recovery. It is not persistent/authenticated publishing and does not alter this canonical library. The next required content action is Joshua's article/whole-answer review, with exact release approval and release-time verification afterward.


## Progressive review decision — 2 October 2026

The direct user request to verify/review as work continues supersedes the old up-front bulk human-scoring dependency. The fixed cases and semantic scoring criteria are unchanged; no scores, whole-catalogue human acceptance or publication/release approval are fabricated. Technical checks and an explicit progressive feedback process establish the provisional local candidate. Known critical failures must be corrected before any authorised release. Production deployment and any live-model operating allowance still require their applicable explicit approval.


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
