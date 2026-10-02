# Maintaining reviewed Help Centre and Guide knowledge

The canonical library is `content/help/articles/*.json`. Edit that library rather than the generated client/server files. Both human reading and Guide evidence are derived from its approved sections; there is no second editable AI answer bank.

## Review a change

1. Check the actual current app control and its permission, privacy and save/sharing behaviour. Use the regression ledger and exact source spans; an old product map or help draft is a coverage aid, not current authority.
2. Update the affected task article. Use literal UI labels, numbered steps for procedures, and notes for exceptions and privacy boundaries. Never put credentials, private account records or internal operation secrets in an article.
3. Record the source revision, evidence, reviewer and date. `approved` means editorial/source approval; fresh browser, role, device, action and production checks remain separate proof.
4. Set `visibility` to the existing applicable policy. Audience labels organise navigation and do not grant access. Unknown policies fail validation. The current authoring format uses one policy per article; mixed section or fact visibility is rejected. Restricted-only category titles and related articles are delivered only with permitted content.
5. Give each original fact one section home. Legacy fact IDs and bodies have a frozen migration baseline; an intentional future correction or retirement requires a documented review decision and an explicit baseline/manifest update. Do not silently remove original coverage to make a test pass. The five current reviewed exceptions are documented in `docs/help-content-reviewed-corrections.md`; their original digests remain in the baseline.
6. New procedural facts use `answerKind: "procedure"` and inherit their answer from the section's paragraphs, steps and notes. A reader section with no explicit fact gets derived evidence automatically. Its article and section IDs must remain stable so citations keep working.
7. Run `npm run help:build`, then `npm run help:check`. Check generated changes: the client JSON must contain only approved public reading fields. Internal review/evidence records stay in the server artifact.
8. Run the affected answer cases and runtime checks. A client change requires `npm run build:client`; a server/access change requires `npm run test:server`. Follow `docs/release-checklist.md` before a release.

The authoring schema is `content/help/schema.json`; the builder also checks cross-file identities, section anchors, related links, evidence, existing fact coverage and deterministic freshness. `draft` and `retired` articles are excluded from delivery. A public article cannot link directly to a restricted article.

## Answer quality and boundaries

Use the frozen `server/test/helpCentreGuideAcceptance.test.js` cases to detect workflow, permission, privacy and confirmation regressions. These are offline route checks, not a live-model score. Source review, automated route checks, browser fixtures, real devices and production proof must be named separately in release records.

Cloudflare can select approved public evidence. It cannot decide an account role or private inventory; existing server account-read paths do that. All displayed reviewed selections retain their canonical text; a valid citation does not make unchecked model prose accurate. Procedural answers retain the complete canonical steps. Actions keep the existing draft, review, confirmation and server permission checks. This library adds no resource write permission.

A live-model quality evaluation needs a separately authorised allowance with model, content version, call count and spend evidence. Never reset a pilot counter, renew its expiry or change credentials as part of routine content maintenance.

## Keep the library current

Confirmed accountable product/content owner: Joshua, based on the user’s 2 October 2026 confirmation that he will maintain the content himself for now. Codex provides technical source/regression verification with specialist review. Ownership confirmation is separate from approving each article or signing off the complete answer-quality batch; those publication reviews remain pending. Triage feedback weekly for the first month, then monthly. Review affected instructions whenever a workflow changes. Review privacy, sharing, permissions and actions monthly, and the full catalogue quarterly. Missing or uncertain behaviour stays qualified or draft until verified. Retire outdated procedures with an explicit disposition and preserve stable reading links where practical.


## Owner-approved progressive review

Joshua chose gradual review during ordinary use on 2 October 2026. Follow `docs/help-guide-progressive-review.md`: verify each reported issue against the current app, amend the canonical section once, regenerate both consumers, run affected checks and record the result. The full sixty-case human scoring exercise is deferred, not marked passed. Keep known critical failures as release blockers. Exact release approval remains separate.


## Delegated quality review — 2 October 2026

Joshua subsequently asked Codex to delegate the review to capable independent reviewers. Independent specialists will assess all 48 article dispositions and all sixty complete served answers against the frozen rubric, current app evidence and linked sections. Record their findings and any scores explicitly as AI-assisted source/semantic review, separate from human scoring and live-model selection quality. Joshua's hands-on feedback remains optional and progressive. Reviewers do not authorise production release on his behalf.
