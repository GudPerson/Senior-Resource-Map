# Map Notes Markdown Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let My Map notes use the existing safe Markdown Lite format and give users toolbar buttons so they do not need to type markdown by hand.

**Architecture:** Keep map notes stored as plain text in the existing autosave payload. Reuse `MarkdownLiteText` for display so note text is rendered as React elements, not raw HTML. Add a note-specific toolbar helper for inserting markdown into the textarea, and keep PDF output readable by stripping markdown markers during ledger cleanup.

**Tech Stack:** React, lucide-react, Node test runner, existing CareAround map-notes helpers, existing Markdown Lite renderer.

---

### Task 1: Note Markdown Text Helper

**Files:**
- Create: `client/src/lib/mapNoteMarkdownToolbar.js`
- Test: `client/test/mapNoteMarkdownToolbar.test.js`

- [x] Write tests first for applying bold, italic, bullet list, numbered list, and link markdown to selected textarea text.
- [x] Run the helper test and confirm it fails before the helper exists.
- [x] Implement the smallest helper that returns `{ value, selectionStart, selectionEnd }`.
- [x] Run the helper test and confirm it passes.

### Task 2: Safe Note Rendering And Toolbar UI

**Files:**
- Modify: `client/src/components/SharedMapDirectoryList.jsx`
- Modify: `client/src/lib/i18n.js`
- Test: `client/test/sharedMapDirectoryListRefinement.test.js`
- Test: `client/test/i18nCoverage.test.js`

- [x] Add source tests that map notes import `MarkdownLiteText`, use helper toolbar buttons, and do not use `dangerouslySetInnerHTML`.
- [x] Run the source tests and confirm they fail before the UI changes.
- [x] Replace plain note paragraphs with `MarkdownLiteText` in owner/shared note read-only views and shared card note snippets.
- [x] Add a compact icon toolbar above each note textarea for bold, italic, bullets, numbered list, link, and preview.
- [x] Toolbar actions update the existing draft note text so the current autosave path remains unchanged.
- [x] Add translated labels for the new toolbar controls in all supported locales.
- [x] Run the focused source/i18n tests and confirm they pass.

### Task 3: PDF Plain-Text Markdown Cleanup

**Files:**
- Modify: `client/src/lib/myMapPdfLedger.js`
- Test: `client/test/myMapPdfLedger.test.js`

- [x] Add a PDF ledger test showing markdown note text exports as readable plain text.
- [x] Run the PDF test and confirm it fails before cleanup.
- [x] Strip Markdown Lite markers after existing PDF-safe cleanup while preserving bullets and line breaks.
- [x] Run the PDF test and confirm it passes.

### Task 4: Regression Gate And Release

**Files:**
- Modify: `docs/regression-ledger.md`

- [x] Run focused map-note/markdown/PDF tests.
- [x] Run full client tests.
- [x] Run `VITE_API_URL=https://api.carearound.sg/api npm run build:client`.
- [x] Update the regression ledger with current behavior and verification evidence.
- [x] Inspect the diff for secrets and unrelated churn.
- [ ] Commit, push the branch, deploy Cloudflare Pages, and verify production smoke only after all local gates pass.
