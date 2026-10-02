# Owner Help Centre editor: CMS follow-on

Date: 2 October 2026 (Asia/Singapore)
Status: architecture recommendation and planned follow-on; no CMS runtime implemented or deployed.

## User need and ownership

Joshua confirmed that he will be the sole content owner for now. He wants to make small text changes and add images/video himself without needing Codex for each edit. His positive feedback establishes improved readability; it does not score all articles/answers or approve publication.

This extends the existing Help Centre and AI Guide project. Its original release intentionally uses repository-owned structured content with no CMS. Preserve that candidate and add an authoring interface in a separate phase; do not silently replace its knowledge source.

## Recommended architecture

Use a visual editor over the existing canonical article records, backed by versioned content changes and the existing compiler. The editor hides JSON, fact IDs and build commands from routine use. A publisher adapter writes only approved content/media paths on a dedicated content branch, runs validation and prepares the matching client/Worker release. No automatic CMS commit to main is permitted.

Current integration anchors: `compileHelpContent`, `scripts/build-help-content.mjs:28–117`, checks IDs, approval, review evidence, one article visibility policy, related links and legacy coverage, and derives procedural Guide text from reading sections. `generateHelpContent`, lines 119–142, creates client/server outputs. Public Help Centre search reads the bundled public library; restricted reading uses authenticated server-generated articles. Both are build-time consumers today. Therefore Publish will involve a validated content build/release; it cannot promise instant runtime updates.

Some legacy conceptual facts have explicit `fact.message` text rather than a derived section body (`build-help-content.mjs:65–88`). The current parity test also fixes the original 105 facts with exactly five reviewed correction exceptions (`scripts/build-help-content.test.mjs:90–109`). Before publishing new edits, the adapter must preview the article and every affected Guide answer, preserve stable fact IDs, and record legitimate changes through an explicit reviewed-correction mechanism. Routine prose edits must not silently leave those answers stale or bypass the baseline. The editor should present the same task content once, with derived or explicitly synchronised evidence; internal correction bookkeeping must be handled by the publisher rather than asking the owner to edit test files.

A database CMS that changes content immediately would require changing both readers and Guide retrieval, adding schema/write access/cache/version contracts. Defer that broader migration. No vendor, subscription or third-party repository access has been selected or authorised.

## Owner workflow

1. Open Help Content and select an article, or create a draft from a task template.
2. Edit its title, summary, paragraphs, numbered steps and exception notes with familiar controls.
3. Attach an image, place it beside the relevant step, and enter a caption and accessible description. Add a video URL with title, caption and a reviewed text transcript; use a link or click-to-load playback initially.
4. Save Draft. It remains separate from the last published article and does not change live Guide answers.
5. Preview desktop and phone reading, the related Guide answer, and the exact changes from the published version.
6. Choose Publish. Show validation/release progress and report the content version only when both Help and Guide serve the intended version. A failure retains the previous published content.
7. View history and restore a prior content revision through the same validation process. Restore content without rolling unrelated application code back.

One owner may edit and approve. Check publication deliberately; no second staff reviewer is required solely because the business is solo. Permission/privacy/workflow changes need stronger source verification than spelling, formatting or caption edits. Automation detects structural regressions but cannot certify semantic truth.

## Content and media rules

Keep stable article/section/fact identities and existing visibility policies outside casual editing controls. Public articles cannot link to restricted evidence. Use safe structured React output with no arbitrary HTML or scripts. Updated approved prose, steps and transcripts feed the same compiler; never add a second AI answer bank. Images illustrate the written procedure and do not become independent permission or product evidence.

Start with public demonstration images, per the existing HC-09/HC-10 capture plan. Use fictional account/resource data and real app controls. Validate file type/size/dimensions, captions/alt text, placement, content version and reviewed step references. Store original/derived assets with hashes and provenance in a dedicated Help media namespace to be designed; do not reuse resource upload permissions implicitly. Restricted attachments remain disabled until authenticated byte delivery and cache rules are implemented and tested. External video loading must be deliberate and not expose restricted content through public URLs. Direct video uploads/transcoding can follow if linked videos prove insufficient.

## Access and publishing boundaries

The name Joshua is a content-ownership decision, not an account permission grant. Bind editor/publisher access to his verified existing account and explicit server-side owner policy during implementation; no browser-provided role or general help-reading permission can authorise publishing. Reuse existing session protection with narrow endpoints. Credentials stay server-side. Do not expand resource, map, organisation or impersonation authority.

Generate a single content version/digest for both consumers. Deployment across Pages and Worker is not inherently atomic: design a backward-compatible rollout and explicit version readiness before reporting success, with a tested recovery path. Drafts, internal review evidence and restricted media must never enter a public preview/build. Public reading remains available without AI or the CMS.

## Phases and acceptance

- **Editor prototype:** one HC-09 draft, edit/reorder a step, attach an example image, add a caption/video link, phone/desktop preview, show changes and restore a draft. No production publishing or real-account data.
- **Media/content adapter:** extend the canonical schema/compiler and safe reader renderer narrowly; deterministic builds, Guide text parity, stable citation anchors, public/restricted exclusion and accessible media checks.
- **Owner publishing:** verified access, version history, scoped repository/media publishing, paired Help/Guide readiness, rollback, failure recovery and visible owner status. Preview first; existing explicit release approval applies to production.

Required proof includes draft isolation, unauthorised/impersonated publisher denial, expired-session behaviour, no resource/action permission change, unchanged migration coverage, media safety/privacy, reader/Guide version parity, and restoring content without reverting product code. Client changes require the client build; server/access changes require full server tests and the affected ledger/release gates. No paid model, credential or budget change is part of this CMS phase.

Next implementation milestone: demonstrate the editor workflow on HC-09 before selecting a publishing backend or adding a runtime database dependency.
