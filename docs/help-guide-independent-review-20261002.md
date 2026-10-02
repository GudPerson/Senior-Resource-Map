# Independent Help Centre and Guide review — 2 October 2026

Two delegated reviewers completed a source-grounded semantic review of all sixty exact served answers in `2026-10-02.help-centre.6`. The resulting answers meet all frozen required clauses and provide a usable next step in every case. The separate source-completeness audit covered all 48 canonical articles.

**This is independent AI-assisted source and semantic review.** It does not fill human score cells, prove live-model quality, establish real-account/physical-device acceptance, grant article publication signoff or authorise commit, push or production deployment. Joshua remains the confirmed content owner, with feedback collected progressively during ordinary use.

## Complete-answer results

| Review | Cases | Required clauses | Additional claims/steps | Complete tasks | Critical failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| A — private versus public creation, map membership/cancellation and missing pins | 30 | 125/125 | 105/105 | 30/30 | 0 |
| B — Studio sharing, privacy/exports, plans, organisation scope, other-person refusals and action/AI availability | 30 | 95/95 | 160/160 | 30/30 | 0 |
| Combined | 60 | 220/220 | 265/265 | 60/60 | 0 |

Reviewers read every assigned whole answer, original question, prior turn, action destination and cited section. Required clauses were evaluated for meaning. Additional distinct assertions and instructions were counted separately under frozen rubric v1; repetitions do not add points and each numbered compound action counts once. These denominators are semantic reviewer counts, separate from automated assertion counts. A regex or passing test never substituted for judging completeness, clarification or usefulness.

Per-case claim identities, exact answer hashes, notes and source checks are preserved in [review A JSON](../output/help-centre/independent-review/review-a.json), [review B JSON](../output/help-centre/independent-review/review-b.json), [review A readable report](../output/help-centre/independent-review/review-a.md) and [review B readable report](../output/help-centre/independent-review/review-b.md). Reviewer identities are `/root/guide_answer_review_a` and `/root/help_candidate_evidence_portability`.

## Corrections verified through the review

- Map membership now names **Manage resources → Update map**, selects the intended Place or Programme/service and verifies the map list.
- Cancelling map creation gives the direct answer first: resources already saved to My Directory remain saved; the cancelled draft creates no map membership. The final cancellation variant was independently rechecked.
- Missing-pin diagnostics now name the owner controls for the intended Studio View, **Edit layout**, Map pins/Resource categories, phone controls and saved status. They preserve the distinction between a hidden pin and a resource with no usable coordinates.
- The Studio how-to now gives **Share → Publish share link / Update shared link**, publication-status checks and inspection of the copied public snapshot, with the matching HC-14 reading link. Copying an existing link does not refresh its snapshot.

Changed outputs were independently re-reviewed after the canonical corrections. Review B found only `studio-sharing-4` changed from its .5 packet after content-version and automatic-check normalization; the other 29 questions, turns, answers, actions and sources were unchanged. Review A retains its per-case version comparison and resolved findings.

## Source-completeness audit of all 48 articles

The independent article audit read the complete canonical inventory: HC-01 through HC-48, comprising 40 public and eight restricted articles. It checked inventory coverage, article identity/category/audience/visibility, review metadata, required disposition, related-article references, prerequisites, instructions, expected outcomes and source evidence. All 48 were accounted for; no missing article, broken related-article identity or unresolved scoped coverage gap was found. This audit is a technical source review, without assigning human-quality grades.

The one concrete article omission was in **HC-10 — verify a Personal place address or use a genuine point without an address**. It lacked an explicit sign-in/ownership prerequisite and result clarity. The .5 correction, retained in .6, says to sign in and edit a Personal place you own through My Directory → My Places or an owned My Map; guests may read instructions but cannot save Personal places. It also tells the user to check the returned address and coordinates against the intended place. The related HC-09/HC-11/HC-18 procedures already cover ownership, reuse, deletion and privacy/export boundaries; duplicating every boundary into HC-10 was unnecessary.

Current .6 source data contains 196 sections/evidence records; 42 procedural articles provide 80 numbered sections and 417 steps, while six articles are conceptual. The full source audit preceded the narrow .5/.6 improvements; these changed article sections were then checked again during the final answer review. Original 105 baseline fact identities remain in scope, with their previously documented five source corrections.

## Optional editorial observations

No further source changes were made for these nonblocking observations:

- Public Place permission answers include a true Programme/service permission sentence that is unnecessary for the specific public Place question.
- HC-09 could cite the actual Personal-place creation span `personalPlacesController.js:373–393` as well as its existing ownership evidence. This improves evidence precision without changing the verified procedure.
- `private-sharing-exports-5` and `plans-not-bookings-3` could begin with a brief direct “No” before the correct procedural context. Neither answer asserts a wrong privacy boundary, booking, permission or completed write.

## Exact .6 evidence bindings

| Artifact | SHA-256 |
| --- | --- |
| Compiled canonical content digest | `44e8b868a4f7680894b00eb6af4e1699a00605902a08172c20d5ffe2851a049d` |
| `output/help-centre/offline-evaluation.json` | `a2819340202f88a760df2df1ea1e79b36abbf8d71da4e584118251bed7dfd6bc` |
| `docs/help-guide-offline-answers.md` | `1cd0d27363b5ba6f25341853cd0e65faf24401d6053b8b4aef708de43ba9e49c` |
| Frozen rubric v1 file: `docs/help-guide-review-checklist.md` | `bb194c1ba5dbd7552f14602cf0bc4e7923d9b9b3fe98ad8ca06d78dc2a3e1f5b` |
| `server/src/generated/helpKnowledge.js` | `0713850a175b4c8427672d1e5a547fe0d9733053bb463fd28b865f6f762133c2` |
| `client/src/generated/helpArticles.json` | `a81cc29de1abca4938353327c4ca85aab4fc50b552b54cea43e457c44da3624f` |
| `content/help/manifest.json` | `e33b4e23bada2062a6e3c7a71a6242056c2d7f72b9719b61dd4eb4f1a9bc0d8b` |

The four preserved reviewer files are copied byte for byte from the reviewers’ final private artifacts. Their distinct review schemas and rubric-core extraction hashes are retained; the common exact full rubric-file hash above binds both to the same unchanged rubric v1. Parent orchestration owns candidate status, release receipts and all external gates.

## Progressive-review outcome

The delegated review requested by Joshua is complete for the current .6 offline packet and the scoped 48-article source inventory. No up-front sixty-answer human exercise is imposed. Optional feedback during real use continues under [the progressive-review policy](help-guide-progressive-review.md), with observed issues reproduced, corrected in the canonical library and validated before inclusion in an explicitly approved release. Human scores remain unfilled; known critical privacy, permission, action-confirmation or wrong-workflow defects continue to block release. No live-model budget, credentials, production state or release authority changed through this review.
