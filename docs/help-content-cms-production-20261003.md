# Production Help Content CMS — implementation and activation packet

Date: 3 October 2026 (Asia/Singapore)

## 4 October approval update

Joshua has now explicitly approved the scoped private CMS setup, required service credentials, commit/push and initial paired production installation, including a baseline-only publication of existing approved Help. Dedicated private storage and the private release repository/environment have been created; the owner-only new service-token step and real acceptance are pending. No app deployment, migration or AI renewal is inferred from infrastructure creation. The 3 October local verification record below remains historical evidence.

Automatic approval review stopped the first public push because the generated server authoring seed included restricted guidance. That candidate was not pushed. The replacement excludes the seed from Git, generates it privately before supported tests/builds, and rejects a tracked seed in the publisher. Its replacement source history excludes the rejected candidate and is rebased directly onto freshly released public `4f0e85661f02868128e68af14e5360ea42f8c699`, preserving the Personal place spreadsheet import. Only the ledger/handoff dated additions conflicted; both records are retained. Fresh combined checks with the seed absent pass: server 1,132/1,132, full quality including compiler 12/12 and CMS 45/45, client 907/907 plus environment 5/5, production-preset build, and locked maps 104/104. These are local integration checks; this CMS replacement has not been pushed or deployed. Independent review passes three additional seed/bootstrap/drift checks; the library digest and access controls remain unchanged.

## 3 October implementation status (historical)

The owner CMS is implemented and locally verified in the isolated worktree `/Users/sweetbuns/.codex/worktrees/help-cms-production/CareAroundSG`, branch `codex/help-cms-production-20261003`. It has not been committed, pushed, deployed or activated. No infrastructure or credentials have been created or changed. Production still serves source `0c771828102e3ce8bbf06fabb25590df92c63a21` and Help library `2026-10-02.help-centre.6`.

Joshua authorised the production CMS implementation, including adding/removing/ordering topics and articles. The earlier revision-9 production approval applied to the Help Centre and Guide release. The remaining approval is the concrete CMS storage/private-publisher setup and this candidate's commit, push and Worker/Pages production release. No new AI allowance, live inference, production resource write or database migration is included.

## What the owner can do

- Add and rename topics; move them up/down; archive and restore them. Remove an empty topic after confirmation. Move active articles before archiving their topic.
- Add articles, assign a topic, move them within that topic, archive and restore them. Archive is the reversible removal workflow for articles: withdrawal takes effect only after a successful publication. Retained archived articles can be restored later.
- Edit titles, summaries, paragraphs, numbered steps, notes and related links. Existing evidence identities, access levels, citations and stable section references are preserved by server validation.
- Attach multiple images or video links to each step, or before the instructions. Images have captions and alternative text; video links have a checked written transcript. Steps keep stable identities when moved. Removing a step with attachments requires moving or removing those attachments first.
- Keep draft changes private, save durable revisions, restore a revision and compare the article with the text the Guide will receive. Desktop catalogue, editor and reading preview have independent scroll containers. Narrow layouts stack the panes.
- Review the saved candidate and request publication. A private job validates and deploys one Help/Guide library together; the CMS reports verified success, failure or partial/unconfirmed release rather than treating job dispatch as publication.

For an existing article, keeping edits private leaves its last published text live. A new draft remains absent from readers and the Guide until included in a publication. Archiving an article withdraws the last published article; it does not publish unfinished edits. Private draft and archived prose remain in the owner catalogue after another article is published.

## Architecture and blast radius

The existing canonical Help compiler, generated client/server knowledge, reader routes, evidence selection and Guide account/action authorisation remain the product's source of truth. The CMS supplies reviewed canonical content to that compiler rather than replacing the running application's help/data systems.

The private R2 bucket stores a compare-and-swap workspace head, immutable revisions, content-addressed image bytes, immutable release snapshots and release/recovery status. The CMS is available only to the configured real owner account with the existing Super Admin role, outside impersonation/User View. Existing resource-management privileges are not expanded.

The application repository is public. Therefore unpublished and restricted content must never be put on public branches, GitHub Actions logs or public artifacts. The publisher runs in a separate private GitHub repository. It reads the exact private approved snapshot, checks a pinned application source, compiles a private ephemeral content commit and deploys without pushing that content commit. Public images become readable only when referenced by the currently compiled approved public library. As with any published image, previously public bytes and browser caches cannot be promised to become secret again after withdrawal.

Worker and Pages deployments are separate operations. Before either upload, the private job stores the original recovery references and an upload-intent checkpoint. The active release lock stays held on ambiguous/partial outcomes. Exact-snapshot retry and job reconciliation recover without overwriting unrelated work or claiming both targets updated when only one did. Ordinary app deployments are guarded against replacing a privately published library with older public-repository content.

The targeted application integrations are a lazy dashboard route/navigation capability check, Help article media rendering/optional order metadata, the CMS/media API mounts, a bounded CMS upload exception, generated source/status outputs and explicit release guards. Discover, maps, print/export, existing auth flows, database schema, resource APIs and AI allowance policy are not redesigned.

## Content and media boundaries

Initial source remains 48 articles (40 public/eight restricted), 196 Guide evidence records and 12 original quick topics. Version: `2026-10-02.help-centre.6`; digest: `44e8b868a4f7680894b00eb6af4e1699a00605902a08172c20d5ffe2851a049d`. Compilation without CMS edits preserves that digest. The full restricted seed is an ignored server-only build artifact, generated locally before supported tests/builds and excluded from application Git history and private runner content commits. Public client/knowledge/status freshness checks remain strict.

Limits: 40 topics, 200 articles, 24 sections per article, 60 steps per section and 24 media items per article. An image is PNG, JPEG or WebP, at most 2 MiB, with verified actual format/dimensions; dimensions are limited to 8,192 pixels per side and 20 million pixels. Workspace JSON is limited to 4 MiB. Media attachments are supported on public articles only. Videos remain external HTTPS YouTube/Vimeo links; no automatic player loads. Their reviewed transcripts join the Guide evidence so information does not exist only inside a video.

This CMS is an editorial tool, not a way to alter roles, resource access, evidence identifiers or private account data. Existing restricted article boundaries are immutable. Restore/rebase validates immutable metadata against the current published seed; conflicts preserve the saved private draft for review.

## Owner workflow after activation

1. Sign in with the configured owner account, then open Dashboard → Help content.
2. Choose a topic/article, or add a topic and article. Rename or move catalogue entries as needed.
3. Edit the instructions. Use the buttons next to a step to attach images or video links. Complete captions, alternative text and checked transcripts.
4. Check both Help article and Guide text previews. Save draft to create a private revision; unsaved content cannot be published.
5. Include the intended articles in the publication and keep unfinished edits private. Archive old articles to withdraw them, then verify their related links and topic memberships.
6. Review and confirm Publish. Follow the Publication panel until it confirms the same library version/digest on the API, public Help status and client release status.
7. Read the published Help article and ask the corresponding Guide question. Corrections can be made as they arise; the earlier up-front sixty-answer human scoring exercise remains deferred by the owner.

Restore saved history to recover private work. When a prior publication changes the baseline, use the explicit rebase/restore review rather than forcing an old head over new content. If a publication is partial or unconfirmed, check the release job and use the documented exact-snapshot recovery; do not start a different publication.

Unsaved work is guarded when using the editor's internal navigation and page reload/close. Browser Back navigation is not intercepted by the current router; save before using it. This limitation does not affect saved R2 revisions.

## Local demonstration

Start with `http://127.0.0.1:8794/__fixture/session/owner`; it opens `http://127.0.0.1:5188/dashboard/help-content` as a fictional local owner. The API is an in-memory fixture: no real Neon, R2, model, production writes or private publishing credentials are connected. Browser reload retains the running fixture's saved drafts; restarting the fixture server resets them. The separate original prototype at `http://127.0.0.1:5187/` is untouched.

The demo contains one explicitly fictional test topic and article with two images on the same instruction. These are fixture data only and are not in the canonical library or source publication. Public Help remains at `http://127.0.0.1:5188/help-centre`.

## Verification and honest proof boundaries

Fresh full quality gate: canonical builder 11/11; CMS model/release/guard checks 44/44; client 862/862 plus environment 5/5; migrations/module graph/diff and production client build pass. The final full server suite, after the last private archive retention regression, passes 1,112/1,112. The independent final model/backend/adapter review passes 63/63 combined checks plus three synthetic real-route API probes, including the actual adapter checkpoint payload shape. Locked map checks pass 104/104. Offline Guide regression passes 60/60 questions and 393/393 assertions, with zero model attempts or paid calls. Final reviewed Wrangler 4.145.0 Worker dry-run succeeds and includes the dedicated R2 binding; no upload occurred.

Desktop browser checks use the real local CMS client with a synthetic owner/in-memory store: first save, new topic/article, ordering, two images on one step, save/reload, archive/restore, history restore, independent pane geometry and signed-out route denial. These checks do not establish real authenticated owner acceptance, actual R2 conditional writes, private GitHub dispatch, Cloudflare credential scopes, production publication/recovery, physical phone usability or live-model quality.

Failed attempts were retained and corrected rather than counted as green: the first browser save exposed overstrict seedless client validation; a misnamed PNG upload with actual JPEG bytes was correctly rejected before a correctly named JPEG was accepted; an evaluation invocation without its required `--offline` flag failed before the explicit offline run passed. Independent review also corrected release-ID/state mismatches, partial-release checkpoint/retry recovery and archived private head retention. There are no confirmed blocking findings remaining in that final independent review.

See `docs/evidence/help-content-cms-local-validation-20261003.json`, `docs/help-content-cms-release-runbook.md` and the current entries in the session handoff/regression ledger. Existing historical release/header caveats are not reclassified as passed by these CMS checks.

## Remaining activation gates

After explicit CMS setup/release approval: provision the dedicated private R2 bucket and private publisher repository/workflow; privately configure the verified real owner ID, dispatch/runner/deployment credentials and immutable application source pin; refresh recovery references and rerun exact-source release checks; perform the initial app Worker/Pages release; validate the real owner and negative access cases, real private save/media/history and an explicitly reviewed publication on both domains. Confirm public bytes/MIME/SHA parity, scope-restricted article/media delivery, Guide version/answers and rollback/reconcile behaviour. Record actual deployment IDs and real acceptance evidence in the handoff.

Until those gates pass, the CMS is locally verified implementation, not a deployed production CMS. Do not renew the expired Guide AI pilot or change production resource/database behaviour as part of activation.
