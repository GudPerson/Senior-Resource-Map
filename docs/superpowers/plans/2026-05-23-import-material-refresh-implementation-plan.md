# Import Material Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review-first refresh workflow to Import Material so updated flyers can update existing offerings and prompt users about previously listed programmes missing from the refreshed material.

**Architecture:** Keep the existing preview-then-commit importer. Extract matching, classification, diff, and missing-offering logic into a focused server utility so it can be tested independently and reused by the controller. Extend the client wizard with an import mode selector, decision-oriented review sections, and explicit missing-offering actions.

**Tech Stack:** React, Vite, Hono-style Worker controllers, Drizzle ORM, Node test runner, existing `soft_assets` and `soft_asset_locations` tables.

---

## File Structure

- Create `server/src/utils/collateralImportMatching.js`
  - Owns normalization, scoring, match classification, field diffs, suggested actions, and missing-offering review rows.
- Create `server/test/collateralImportMatching.test.js`
  - Verifies matching and refresh-review behaviour without needing a database.
- Modify `server/src/controllers/softAssetCollateralImportController.js`
  - Delegates candidate building to the utility.
  - Accepts `importMode` in preview and commit payloads.
  - Returns `reviewSections` and `missingOfferings`.
  - Handles missing-offering actions during commit.
- Modify `client/src/components/SoftAssetCollateralImportWizard.jsx`
  - Adds New vs Refresh import mode.
  - Uses backend suggested actions and section labels.
  - Shows field diffs for likely updates.
  - Shows missing offerings with keep active, hide, mark ended, or review later.

## Task 1: Add Tested Matching Utility

**Files:**
- Create: `server/src/utils/collateralImportMatching.js`
- Create: `server/test/collateralImportMatching.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/test/collateralImportMatching.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCollateralReviewRows,
    buildMissingOfferingRows,
    buildUpdateDiffs,
} from '../src/utils/collateralImportMatching.js';

const hostOffering = {
    id: 10,
    name: 'Chair Yoga',
    bucket: 'Programmes',
    subCategory: 'Senior Fitness',
    description: 'Gentle seated yoga for seniors.',
    schedule: 'Mondays 9am',
    contactPhone: '+65 6123 4567',
    contactEmail: '',
    ctaLabel: 'Register',
    ctaUrl: '',
    venueNote: 'Activity room',
    newTags: ['fitness', 'senior activities'],
};

test('classifies same-host programme with changed schedule as likely update', () => {
    const [row] = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Chair Yoga',
            bucket: 'Programmes',
            subCategorySuggestion: 'Senior Fitness',
            description: 'Gentle seated yoga for seniors.',
            schedule: 'Tuesdays 10am',
            newTags: ['fitness', 'senior activities'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    assert.equal(row.reviewStatus, 'likely_update');
    assert.equal(row.suggestedAction, 'update');
    assert.equal(row.targetSoftAssetId, 10);
    assert.equal(row.matchCandidates[0].id, 10);
    assert.ok(row.updateDiffs.some((diff) => diff.field === 'schedule'));
});

test('classifies exact duplicate content as no change and skip', () => {
    const [row] = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Chair Yoga',
            bucket: 'Programmes',
            subCategorySuggestion: 'Senior Fitness',
            description: 'Gentle seated yoga for seniors.',
            schedule: 'Mondays 9am',
            contactPhone: '+65 6123 4567',
            venueNote: 'Activity room',
            newTags: ['fitness', 'senior activities'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    assert.equal(row.reviewStatus, 'no_change');
    assert.equal(row.suggestedAction, 'skip');
    assert.equal(row.targetSoftAssetId, 10);
});

test('does not match unrelated weak programme names', () => {
    const [row] = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Digital Banking Talk',
            bucket: 'Programmes',
            subCategorySuggestion: 'Digital Literacy',
            description: 'Learn how to stay safe online.',
            schedule: 'Fridays 2pm',
            newTags: ['digital literacy'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    assert.equal(row.reviewStatus, 'new_offering');
    assert.equal(row.suggestedAction, 'create');
    assert.equal(row.matchCandidates.length, 0);
});

test('builds missing offering rows only for unmatched existing offerings in refresh mode', () => {
    const reviewRows = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Digital Banking Talk',
            bucket: 'Programmes',
            subCategorySuggestion: 'Digital Literacy',
            description: 'Learn how to stay safe online.',
            schedule: 'Fridays 2pm',
            newTags: ['digital literacy'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    const missingRows = buildMissingOfferingRows({
        existingOfferings: [hostOffering],
        reviewRows,
        importMode: 'refresh',
    });

    assert.equal(missingRows.length, 1);
    assert.equal(missingRows[0].id, 'missing-10');
    assert.equal(missingRows[0].suggestedAction, 'review_later');
});

test('does not build missing offering rows for new import mode', () => {
    const missingRows = buildMissingOfferingRows({
        existingOfferings: [hostOffering],
        reviewRows: [],
        importMode: 'new',
    });

    assert.equal(missingRows.length, 0);
});

test('buildUpdateDiffs reports changed fields and ignores unchanged fields', () => {
    const diffs = buildUpdateDiffs({
        existing: hostOffering,
        draft: {
            ...hostOffering,
            schedule: 'Tuesdays 10am',
            contactPhone: '+65 6123 4567',
        },
    });

    assert.deepEqual(diffs, [{
        field: 'schedule',
        label: 'Schedule',
        before: 'Mondays 9am',
        after: 'Tuesdays 10am',
    }]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test --workspace=server -- collateralImportMatching.test.js
```

Expected: FAIL because `server/src/utils/collateralImportMatching.js` does not exist.

- [ ] **Step 3: Implement utility**

Create `server/src/utils/collateralImportMatching.js` with exported helpers:

```js
const DIFF_FIELDS = [
    ['name', 'Name'],
    ['bucket', 'Bucket'],
    ['subCategory', 'Sub-category'],
    ['description', 'Description'],
    ['schedule', 'Schedule'],
    ['contactPhone', 'Contact phone'],
    ['contactEmail', 'Contact email'],
    ['ctaLabel', 'Action label'],
    ['ctaUrl', 'Action link'],
    ['venueNote', 'Venue note'],
];

export function normalizeImportMode(value) {
    return String(value || '').trim().toLowerCase() === 'refresh' ? 'refresh' : 'new';
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeName(value) {
    return new Set(normalizeName(value).split(' ').filter((token) => token.length > 1));
}

function tokenSimilarity(left, right) {
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((token) => {
        if (right.has(token)) overlap += 1;
    });
    return overlap / Math.max(left.size, right.size);
}

function normalizeTags(values) {
    return new Set((Array.isArray(values) ? values : [])
        .map((tag) => normalizeText(tag).toLowerCase())
        .filter(Boolean));
}

function tagOverlap(left, right) {
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((tag) => {
        if (right.has(tag)) overlap += 1;
    });
    return overlap / Math.max(left.size, right.size);
}

function comparableDraftValue(row, field) {
    if (field === 'subCategory') return row.subCategory || row.subCategorySuggestion || '';
    return row[field] || '';
}

function comparableExistingValue(row, field) {
    if (field === 'newTags') return row.newTags || [];
    return row[field] || '';
}

export function buildUpdateDiffs({ existing, draft }) {
    const diffs = [];
    DIFF_FIELDS.forEach(([field, label]) => {
        const before = normalizeText(comparableExistingValue(existing, field));
        const after = normalizeText(comparableDraftValue(draft, field));
        if (before !== after) {
            diffs.push({ field, label, before, after });
        }
    });

    const existingTags = [...normalizeTags(existing.newTags)].sort();
    const draftTags = [...normalizeTags(draft.newTags)].sort();
    if (existingTags.join('|') !== draftTags.join('|')) {
        diffs.push({
            field: 'newTags',
            label: 'Tags',
            before: existingTags.join(', '),
            after: draftTags.join(', '),
        });
    }

    return diffs;
}

function scoreCandidate(draftRow, asset) {
    const normalizedDraftName = normalizeName(draftRow.name);
    const normalizedAssetName = normalizeName(asset.name);
    if (!normalizedDraftName || !normalizedAssetName) return null;

    const exactName = normalizedDraftName === normalizedAssetName;
    const nameScore = exactName ? 1 : tokenSimilarity(tokenizeName(draftRow.name), tokenizeName(asset.name));
    if (!exactName && nameScore < 0.35) return null;

    let score = nameScore * 0.72;
    if (normalizeText(draftRow.bucket).toLowerCase() && normalizeText(draftRow.bucket).toLowerCase() === normalizeText(asset.bucket).toLowerCase()) {
        score += 0.1;
    }
    const draftSubCategory = normalizeText(draftRow.subCategory || draftRow.subCategorySuggestion).toLowerCase();
    if (draftSubCategory && draftSubCategory === normalizeText(asset.subCategory).toLowerCase()) {
        score += 0.08;
    }
    score += tagOverlap(normalizeTags(draftRow.newTags), normalizeTags(asset.newTags)) * 0.06;
    if (normalizeText(draftRow.contactPhone) && normalizeText(draftRow.contactPhone) === normalizeText(asset.contactPhone)) {
        score += 0.02;
    }
    if (normalizeText(draftRow.ctaUrl) && normalizeText(draftRow.ctaUrl) === normalizeText(asset.ctaUrl)) {
        score += 0.02;
    }

    return {
        id: asset.id,
        name: asset.name,
        bucket: asset.bucket || 'Programmes',
        subCategory: asset.subCategory || '',
        score: Number(Math.min(score, 1).toFixed(2)),
        matchReason: exactName ? 'exact_name' : 'fuzzy_name',
        label: exactName ? 'Exact name match at this host' : 'Likely same-host name match',
    };
}

export function buildMatchCandidatesForDraft(draftRow, existingOfferings) {
    return existingOfferings
        .map((asset) => scoreCandidate(draftRow, asset))
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
}

function classifyDraftRow(draftRow, topCandidate, existingById, importMode) {
    if (!topCandidate) return { reviewStatus: 'new_offering', suggestedAction: 'create' };
    const existing = existingById.get(topCandidate.id);
    const updateDiffs = buildUpdateDiffs({ existing, draft: draftRow });
    if (updateDiffs.length === 0) return { reviewStatus: 'no_change', suggestedAction: 'skip', updateDiffs };
    if (topCandidate.score >= 0.85) return { reviewStatus: 'likely_update', suggestedAction: 'update', updateDiffs };
    if (topCandidate.score >= 0.6) return { reviewStatus: 'possible_match', suggestedAction: importMode === 'refresh' ? 'update' : 'create', updateDiffs };
    return { reviewStatus: 'new_offering', suggestedAction: 'create', updateDiffs: [] };
}

export function buildCollateralReviewRows({ draftRows, existingOfferings, importMode }) {
    const mode = normalizeImportMode(importMode);
    const existingById = new Map((existingOfferings || []).map((asset) => [asset.id, asset]));
    return (draftRows || []).map((draftRow, index) => {
        const matchCandidates = buildMatchCandidatesForDraft(draftRow, existingOfferings || []);
        const topCandidate = matchCandidates[0] || null;
        const classification = classifyDraftRow(draftRow, topCandidate, existingById, mode);
        return {
            id: draftRow.id || `draft-${index + 1}`,
            ...draftRow,
            matchCandidates,
            reviewStatus: classification.reviewStatus,
            suggestedAction: classification.suggestedAction,
            targetSoftAssetId: topCandidate?.id || '',
            updateDiffs: classification.updateDiffs || [],
        };
    });
}

export function buildMissingOfferingRows({ existingOfferings, reviewRows, importMode }) {
    if (normalizeImportMode(importMode) !== 'refresh') return [];
    const matchedIds = new Set((reviewRows || [])
        .map((row) => Number(row.targetSoftAssetId || row.matchCandidates?.[0]?.id))
        .filter(Number.isFinite));
    return (existingOfferings || [])
        .filter((asset) => !matchedIds.has(Number(asset.id)))
        .map((asset) => ({
            id: `missing-${asset.id}`,
            softAssetId: asset.id,
            name: asset.name,
            bucket: asset.bucket || 'Programmes',
            subCategory: asset.subCategory || '',
            schedule: asset.schedule || '',
            description: asset.description || '',
            suggestedAction: 'review_later',
        }));
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm run test --workspace=server -- collateralImportMatching.test.js
```

Expected: PASS.

## Task 2: Wire Server Preview And Commit

**Files:**
- Modify: `server/src/controllers/softAssetCollateralImportController.js`
- Test: `server/test/collateralImportMatching.test.js`

- [ ] **Step 1: Write failing tests for missing action semantics**

Add to `server/test/collateralImportMatching.test.js`:

```js
test('missing offering hide and mark ended actions are explicit review actions', () => {
    const [missing] = buildMissingOfferingRows({
        existingOfferings: [hostOffering],
        reviewRows: [],
        importMode: 'refresh',
    });

    assert.equal(missing.suggestedAction, 'review_later');
    assert.equal(missing.softAssetId, 10);
});
```

- [ ] **Step 2: Run test**

Run:

```bash
npm run test --workspace=server -- collateralImportMatching.test.js
```

Expected: PASS after Task 1. This anchors the explicit-action contract before wiring commit.

- [ ] **Step 3: Replace local matching helpers with utility import**

In `server/src/controllers/softAssetCollateralImportController.js`, import:

```js
import {
    buildCollateralReviewRows,
    buildMissingOfferingRows,
    normalizeImportMode,
} from '../utils/collateralImportMatching.js';
```

Remove the controller-local `normalizeName`, `tokenizeName`, `computeTokenSimilarity`, `formatMatchReason`, and `buildMatchCandidatesForDraft` helpers.

- [ ] **Step 4: Include import mode in preview**

In `previewSoftAssetCollateralImport`, read:

```js
const importMode = normalizeImportMode(formData.get('importMode'));
```

Replace draft row construction with:

```js
const draftRows = buildCollateralReviewRows({
    draftRows: extraction.draftRows.map((draftRow, index) => ({
        id: `draft-${index + 1}`,
        ...draftRow,
    })),
    existingOfferings: formattedExistingOfferings,
    importMode,
});
const missingOfferings = buildMissingOfferingRows({
    existingOfferings: formattedExistingOfferings,
    reviewRows: draftRows,
    importMode,
});
```

Return `importMode`, `draftRows`, and `missingOfferings`.

- [ ] **Step 5: Include import mode and missing actions in commit**

In `commitSoftAssetCollateralImport`, read:

```js
const importMode = normalizeImportMode(body?.importMode);
const missingOfferings = Array.isArray(body?.missingOfferings) ? body.missingOfferings : [];
```

After reviewed draft rows are processed, loop through `missingOfferings`. For `hide` and `mark_ended`, update the target manageable existing offering with `isHidden: true` and `updatedAt: new Date()`. For `keep_active` and `review_later`, push skipped-style results without changing the offering.

- [ ] **Step 6: Run server tests**

Run:

```bash
npm run test:server
```

Expected: all server tests pass.

## Task 3: Update Client Review Wizard

**Files:**
- Modify: `client/src/components/SoftAssetCollateralImportWizard.jsx`

- [ ] **Step 1: Add import mode state**

Add:

```js
const [importMode, setImportMode] = useState('new');
const [missingOfferings, setMissingOfferings] = useState([]);
```

Append `importMode` to the preview `FormData`.

- [ ] **Step 2: Use backend suggested actions**

In `buildDraftRowState`, set:

```js
action: row.suggestedAction || 'create',
targetSoftAssetId: row.targetSoftAssetId || row.matchCandidates?.[0]?.id || '',
reviewStatus: row.reviewStatus || 'new_offering',
updateDiffs: Array.isArray(row.updateDiffs) ? row.updateDiffs : [],
```

- [ ] **Step 3: Store missing offerings from preview**

After preview succeeds:

```js
setMissingOfferings(data.missingOfferings || []);
```

Also reset missing offerings in `resetPreview`.

- [ ] **Step 4: Submit import mode and missing offerings**

Add `importMode` and `missingOfferings` to the commit payload. Each missing row should send `softAssetId` and `action`.

- [ ] **Step 5: Add New vs Refresh selector**

In the upload form, add two selectable buttons:

```jsx
<button type="button" onClick={() => setImportMode('new')}>New material</button>
<button type="button" onClick={() => setImportMode('refresh')}>Refresh existing material</button>
```

The refresh option copy should explain that missing existing programmes will be reviewed.

- [ ] **Step 6: Show update diffs**

For rows with `updateDiffs.length`, render a compact list under the suggested match:

```jsx
{row.updateDiffs.map((diff) => (
    <li key={diff.field}>{diff.label}: {diff.before || 'blank'} -> {diff.after || 'blank'}</li>
))}
```

- [ ] **Step 7: Show missing programme review section**

In preview mode, if `missingOfferings.length`, render cards with actions:

```jsx
<select value={row.action || row.suggestedAction || 'review_later'}>
    <option value="review_later">Review later</option>
    <option value="keep_active">Keep active</option>
    <option value="hide">Hide from discovery</option>
    <option value="mark_ended">Mark as ended</option>
</select>
```

- [ ] **Step 8: Build client**

Run:

```bash
npm run build:client
```

Expected: build succeeds.

## Task 4: Verification And Local UAT Readiness

**Files:**
- Verify only unless fixes are needed.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test --workspace=server -- collateralImportMatching.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full server tests**

Run:

```bash
npm run test:server
```

Expected: PASS.

- [ ] **Step 3: Run client build**

Run:

```bash
npm run build:client
```

Expected: PASS.

- [ ] **Step 4: Check local readiness for UAT**

Run:

```bash
curl -sS -o /dev/null -w 'client %{http_code}\n' http://localhost:5173/dashboard/resources
curl -sS -o /dev/null -w 'api %{http_code}\n' http://localhost:8787/api/auth/me
```

Expected: client returns `200`; API returns an HTTP response such as `200` or `401`, not connection refused. Start `npm run dev:server` and `npm run dev:client` if either port is down.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add client/src/components/SoftAssetCollateralImportWizard.jsx server/src/controllers/softAssetCollateralImportController.js server/src/utils/collateralImportMatching.js server/test/collateralImportMatching.test.js docs/superpowers/plans/2026-05-23-import-material-refresh-implementation-plan.md
git commit -m "Improve import material refresh review"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: The plan covers smarter matching, diff review, refresh mode, missing programme review, explicit hide/mark-ended choices, and tests. Import batch persistence is intentionally deferred because the first safe patch can reduce duplicates without schema changes.
- Placeholder scan: No task depends on TODO/TBD placeholders.
- Type consistency: Server actions use `create`, `update`, `skip`, `hide`, `mark_ended`, `keep_active`, and `review_later`; client sends the same strings.
