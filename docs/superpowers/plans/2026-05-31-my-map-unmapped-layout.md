# My Map Unmapped Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make list-only resources compact and adapt their desktop placement without changing My Map or shared-map data behavior.

**Architecture:** Add a pure presentation helper that decides whether list-only rows stay in the side lanes or dock under Map notes. Update `SharedMapDirectoryList.jsx` to render compact list-only rows in the chosen location while preserving existing mapped-card order, map notes, sharing, save/remove actions, and detail links.

**Tech Stack:** React, existing CareAround directory presentation helpers, Node test runner, Vite client build.

---

### Task 1: Presentation Placement Helper

**Files:**
- Modify: `client/src/lib/directoryPresentation.js`
- Test: `client/test/directoryPresentationLayout.test.js`

- [ ] **Step 1: Write placement tests**

Create `client/test/directoryPresentationLayout.test.js` with tests for:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDesktopUnmappedLayout } from '../src/lib/directoryPresentation.js';

function group(number, rowCount = 1) {
    return {
        placeKey: `place-${number}`,
        number,
        rows: Array.from({ length: rowCount }, (_, index) => ({ rowKey: `place-${number}-row-${index}` })),
    };
}

function row(name) {
    return { rowKey: `unmapped-${name}`, name };
}

test('desktop list-only rows distribute into side lanes when mapped resources are sparse', () => {
    const layout = buildDesktopUnmappedLayout({
        mappedGroups: [group(1), group(2), group(3), group(4)],
        leftGroups: [group(1), group(2)],
        rightGroups: [group(3), group(4)],
        unmappedRows: [row('A'), row('B'), row('C')],
    });

    assert.equal(layout.placement, 'side-lanes');
    assert.deepEqual(layout.leftUnmappedRows.map((item) => item.name), ['A', 'C']);
    assert.deepEqual(layout.rightUnmappedRows.map((item) => item.name), ['B']);
    assert.deepEqual(layout.dockedUnmappedRows, []);
});

test('desktop list-only rows dock under map notes when mapped resources are dense', () => {
    const mappedGroups = Array.from({ length: 7 }, (_, index) => group(index + 1));
    const layout = buildDesktopUnmappedLayout({
        mappedGroups,
        leftGroups: mappedGroups.slice(0, 4),
        rightGroups: mappedGroups.slice(4),
        unmappedRows: [row('A'), row('B')],
    });

    assert.equal(layout.placement, 'map-column');
    assert.deepEqual(layout.leftUnmappedRows, []);
    assert.deepEqual(layout.rightUnmappedRows, []);
    assert.deepEqual(layout.dockedUnmappedRows.map((item) => item.name), ['A', 'B']);
});
```

- [ ] **Step 2: Run focused test and confirm it fails before implementation**

Run: `node --test client/test/directoryPresentationLayout.test.js`

Expected: FAIL because `buildDesktopUnmappedLayout` is not exported yet.

- [ ] **Step 3: Implement helper**

Add exported helper functions to `client/src/lib/directoryPresentation.js`:

```js
const DESKTOP_UNMAPPED_DOCK_GROUP_THRESHOLD = 7;
const DESKTOP_UNMAPPED_DOCK_ROW_THRESHOLD = 9;

function getGroupCardWeight(groups = []) {
    return groups.reduce((total, group) => total + 1 + Math.max((group.rows || []).length - 1, 0) * 0.35, 0);
}

export function shouldDockDesktopUnmappedRows(mappedGroups = []) {
    const visibleRowCount = mappedGroups.reduce((count, group) => count + (group.rows || []).length, 0);
    return mappedGroups.length >= DESKTOP_UNMAPPED_DOCK_GROUP_THRESHOLD
        || visibleRowCount >= DESKTOP_UNMAPPED_DOCK_ROW_THRESHOLD;
}

export function buildDesktopUnmappedLayout({
    mappedGroups = [],
    leftGroups = [],
    rightGroups = [],
    unmappedRows = [],
} = {}) {
    if (!unmappedRows.length) {
        return {
            placement: 'none',
            leftUnmappedRows: [],
            rightUnmappedRows: [],
            dockedUnmappedRows: [],
        };
    }

    if (shouldDockDesktopUnmappedRows(mappedGroups)) {
        return {
            placement: 'map-column',
            leftUnmappedRows: [],
            rightUnmappedRows: [],
            dockedUnmappedRows: unmappedRows,
        };
    }

    const leftUnmappedRows = [];
    const rightUnmappedRows = [];
    let leftWeight = getGroupCardWeight(leftGroups);
    let rightWeight = getGroupCardWeight(rightGroups);

    unmappedRows.forEach((row) => {
        if (leftWeight <= rightWeight) {
            leftUnmappedRows.push(row);
            leftWeight += 1;
        } else {
            rightUnmappedRows.push(row);
            rightWeight += 1;
        }
    });

    return {
        placement: 'side-lanes',
        leftUnmappedRows,
        rightUnmappedRows,
        dockedUnmappedRows: [],
    };
}
```

- [ ] **Step 4: Attach layout to presentation**

In `buildDirectoryPresentation`, after `leftGroups` and `rightGroups` are created, call `buildDesktopUnmappedLayout` and include the returned fields in the presentation object.

- [ ] **Step 5: Run focused test**

Run: `node --test client/test/directoryPresentationLayout.test.js`

Expected: PASS.

### Task 2: Compact List-Only Rendering

**Files:**
- Modify: `client/src/components/SharedMapDirectoryList.jsx`

- [ ] **Step 1: Add compact section prop**

Update `DirectoryUnmappedSection` to accept `compact = false` and `className = ''`.

- [ ] **Step 2: Keep print/non-interactive behavior stable**

When `interactive` is false and `compact` is false, keep the existing heading, description, spacing, and print-friendly row rendering.

- [ ] **Step 3: Render compact interactive section**

When `compact` is true, render only a small label/count and the existing `DirectoryUnmappedRow` cards. Do not show the large heading or explanatory paragraph.

- [ ] **Step 4: Use compact section in mobile**

In the mobile branch, keep mapped cards first, then render `DirectoryUnmappedSection` with `compact`.

- [ ] **Step 5: Use adaptive desktop placement**

In the desktop branch:

- Render left mapped groups, then left list-only rows when placement is `side-lanes`.
- Render right mapped groups, then right list-only rows when placement is `side-lanes`.
- Render docked list-only rows under Map notes when placement is `map-column`.
- Remove the old full-width interactive unmapped section from desktop rendering.

### Task 3: Verification And Ledger

**Files:**
- Modify: `docs/regression-ledger.md`

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test client/test/directoryPresentationLayout.test.js client/test/mapNotes.test.js client/test/mobileMapPanelBehavior.test.js
```

Expected: PASS.

- [ ] **Step 2: Run client suite/build**

Run:

```bash
node --test client/test/*.test.js client/src/lib/*.test.js
npm run build:client
git diff --check
```

Expected: all pass, with only the existing large chunk warning if Vite reports it.

- [ ] **Step 3: Update regression ledger**

Add current behavior, known-good reference, reproduction steps, acceptance criteria, and verification result for the My Map/shared-map list-only layout refinement.

- [ ] **Step 4: Commit implementation**

Commit the code, tests, and ledger update with:

```bash
git add client/src/lib/directoryPresentation.js client/src/components/SharedMapDirectoryList.jsx client/test/directoryPresentationLayout.test.js docs/regression-ledger.md
git commit -m "Refine My Map list-only resource layout"
```
