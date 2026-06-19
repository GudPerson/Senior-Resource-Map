# My Map Category Bubble Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable bubble-arranged category-icon markers to owner My Map V2 first, then shared maps, while preserving print badges and classic My Map.

**Architecture:** Keep the existing `DirectoryMap` marker boundary and generalize the print bubble solver so it can serve another marker presentation. `directoryPresentation.js` will add per-resource category bubble items to grouped pins; `DirectoryMap.jsx` will render those items as interactive icon bubbles and route hover/click to the visible lobe target.

**Tech Stack:** React, React Leaflet, Leaflet `divIcon`, existing Node source tests, existing CareAround directory presentation helpers.

---

### Task 1: Add Source Tests For The New Marker Contract

**Files:**
- Modify: `client/test/directoryMapMarkerMode.test.js`
- Modify: `client/test/directoryPresentationV2Order.test.js`
- Modify: `client/test/myMapV2Scaffold.test.js`
- Modify: `client/test/sharedMapContinuation.test.js`

- [ ] **Step 1: Add a failing DirectoryMap marker-mode test**

Add a test asserting that `DirectoryMap` exposes a separate `category-bubble` mode, a category bubble marker creator, event target resolution, and collision sync reuse:

```js
test('directory map can render interactive category bubble markers with visible lobe hit targets', () => {
    assert.match(directoryMapSource, /markerMode === 'category-bubble'/);
    assert.match(directoryMapSource, /function createCategoryBubbleMarker/);
    assert.match(directoryMapSource, /function normalizeCategoryBubbleItems/);
    assert.match(directoryMapSource, /function getCategoryBubblePlaceKeyFromEvent\(event, fallbackPlaceKey\)/);
    assert.match(directoryMapSource, /data-category-bubble-place-key/);
    assert.match(directoryMapSource, /class="directory-category-bubble-marker__lobe"/);
    assert.match(directoryMapSource, /categoryBubbleItems: pin\.categoryBubbleItems \|\| null/);
    assert.match(directoryMapSource, /<DirectoryPrintBadgeCollisionSync enabled=\{markerMode === 'print-badge' \|\| markerMode === 'category-bubble'\}/);
    assert.match(appCssSource, /\.leaflet-marker-icon\.directory-category-bubble-leaflet-icon[\s\S]*pointer-events: none !important/);
    assert.match(appCssSource, /\.leaflet-marker-icon\.directory-category-bubble-leaflet-icon \.directory-category-bubble-marker__lobe[\s\S]*pointer-events: auto !important/);
});
```

- [ ] **Step 2: Add failing V2 presentation item tests**

Add assertions to the existing V2 postal-group test so grouped V2 pins expose one `categoryBubbleItems` entry per resource:

```js
assert.equal(groupedPin.categoryBubbleItems.length, 2);
assert.deepEqual(
    groupedPin.categoryBubbleItems.map((item) => item.placeKey),
    [firstPlaceKey, secondPlaceKey],
);
assert.equal(groupedPin.categoryBubbleItems[0].iconUrl, '/icons/aac.svg');
assert.equal(groupedPin.categoryBubbleItems[1].iconUrl, '/icons/day-rehab.svg');
```

- [ ] **Step 3: Add failing owner/shared wiring tests**

Change source assertions so owner My Map V2 and shared-map interactive view use `markerMode="category-bubble"` while classic and print assertions remain unchanged:

```js
assert.match(myMapV2ScaffoldSource, /markerMode="category-bubble"/);
assert.doesNotMatch(myMapV2ScaffoldSource, /markerMode="number"/);
assert.match(sharedMapPageSource, /markerMode="category-bubble"/);
assert.doesNotMatch(sharedMapPageSource, /markerMode="number"/);
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
node --test client/test/directoryMapMarkerMode.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js
```

Expected: FAIL because `category-bubble` mode and `categoryBubbleItems` are not implemented yet.

### Task 2: Add Category Bubble Metadata To V2 Presentation Pins

**Files:**
- Modify: `client/src/lib/directoryPresentation.js`
- Test: `client/test/directoryPresentationV2Order.test.js`

- [ ] **Step 1: Implement `getCategoryBubbleItemsForGroup`**

Add a helper near the existing category-entry helpers:

```js
function getCategoryBubbleItemsForGroup(group = {}, options = {}) {
    const groups = group.isPostalGroup && Array.isArray(group.nestedPlaces)
        ? group.nestedPlaces
        : [group];

    return groups
        .map((member) => {
            const entry = getPrimaryCategoryEntry(member.rows || [], options);
            return {
                placeKey: member.placeKey,
                color: entry.color || null,
                iconUrl: entry.iconUrl || null,
                label: member.name || '',
            };
        })
        .filter((item) => item.placeKey);
}
```

- [ ] **Step 2: Attach `categoryBubbleItems` in `buildGroupedPins`**

Inside each returned pin object from `buildGroupedPins`, add:

```js
categoryBubbleItems: getCategoryBubbleItemsForGroup(group, options),
```

For postal groups, keep `memberPlaceKeys` unchanged and preserve the current same-postal group key so existing hover peers and focus mapping keep working.

- [ ] **Step 3: Run focused presentation tests and verify GREEN**

Run:

```bash
node --test client/test/directoryPresentationV2Order.test.js
```

Expected: PASS.

### Task 3: Render Interactive Category Bubble Markers

**Files:**
- Modify: `client/src/components/DirectoryMap.jsx`
- Modify: `client/src/index.css`
- Test: `client/test/directoryMapMarkerMode.test.js`

- [ ] **Step 1: Add category bubble marker constants and item normalization**

Add constants near the print badge constants:

```js
const DIRECTORY_CATEGORY_BUBBLE_DIAMETER = 32;
const DIRECTORY_CATEGORY_BUBBLE_LOBE_SPACING = DIRECTORY_CATEGORY_BUBBLE_DIAMETER * 0.76;
```

Add `normalizeCategoryBubbleItems(items, pin = {})` near `normalizePrintBadgeItems`:

```js
function normalizeCategoryBubbleItems(items = null, pin = {}) {
    const sourceItems = Array.isArray(items) && items.length
        ? items
        : [{
            placeKey: pin.placeKey || null,
            color: pin.categoryColor || null,
            iconUrl: pin.categoryIconUrl || null,
            label: pin.title || '',
        }];

    return sourceItems
        .map((item, index) => ({
            placeKey: item?.placeKey || pin.placeKey || null,
            color: normalizeMarkerColor(item?.color || item?.categoryColor || pin.categoryColor, '#0f766e'),
            iconUrl: item?.iconUrl || item?.categoryIconUrl || null,
            label: String(item?.label || item?.title || index + 1),
        }))
        .filter((item) => item.placeKey);
}
```

- [ ] **Step 2: Reuse the lobe layout math without changing print output**

Introduce:

```js
function getBubbleLobeLayout(count, {
    diameter = DIRECTORY_PRINT_BADGE_DIAMETER,
    spacing = DIRECTORY_PRINT_BADGE_LOBE_SPACING,
} = {}) {
    const safeCount = Math.max(1, Number(count) || 1);
    let centers;

    if (safeCount === 1) {
        centers = [{ x: 0, y: 0 }];
    } else if (safeCount === 2) {
        centers = [
            { x: -spacing / 2, y: 0 },
            { x: spacing / 2, y: 0 },
        ];
    } else if (safeCount === 3) {
        centers = [
            { x: 0, y: -spacing * 0.56 },
            { x: -spacing / 2, y: spacing * 0.42 },
            { x: spacing / 2, y: spacing * 0.42 },
        ];
    } else if (safeCount === 4) {
        centers = [
            { x: -spacing / 2, y: -spacing / 2 },
            { x: spacing / 2, y: -spacing / 2 },
            { x: -spacing / 2, y: spacing / 2 },
            { x: spacing / 2, y: spacing / 2 },
        ];
    } else if (safeCount === 5) {
        centers = [
            { x: -spacing, y: -spacing / 2 },
            { x: 0, y: -spacing / 2 },
            { x: spacing, y: -spacing / 2 },
            { x: -spacing / 2, y: spacing / 2 },
            { x: spacing / 2, y: spacing / 2 },
        ];
    } else {
        const columns = Math.ceil(Math.sqrt(safeCount));
        const rows = Math.ceil(safeCount / columns);
        centers = Array.from({ length: safeCount }, (_, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            return {
                x: (column - ((columns - 1) / 2)) * spacing,
                y: (row - ((rows - 1) / 2)) * spacing,
            };
        });
    }

    const radius = diameter / 2;
    const minX = Math.min(...centers.map((center) => center.x - radius));
    const maxX = Math.max(...centers.map((center) => center.x + radius));
    const minY = Math.min(...centers.map((center) => center.y - radius));
    const maxY = Math.max(...centers.map((center) => center.y + radius));

    return {
        width: maxX - minX,
        height: maxY - minY,
        lobes: centers.map((center) => ({
            left: center.x - radius - minX,
            top: center.y - radius - minY,
        })),
    };
}

function getPrintBadgeLobeLayout(count) {
    return getBubbleLobeLayout(count);
}

function getCategoryBubbleLobeLayout(count) {
    return getBubbleLobeLayout(count, {
        diameter: DIRECTORY_CATEGORY_BUBBLE_DIAMETER,
        spacing: DIRECTORY_CATEGORY_BUBBLE_LOBE_SPACING,
    });
}
```

- [ ] **Step 3: Add `createCategoryBubbleMarker`**

Create a `L.divIcon` renderer that:

- uses className `directory-category-bubble-leaflet-icon`
- renders `.directory-category-bubble-marker`, `.directory-category-bubble-marker__core`, and `.directory-category-bubble-marker__lobe`
- writes `data-print-*` geometry attributes so the existing collision sync can measure and settle offsets
- writes `data-category-bubble-place-key` on each lobe
- renders `<img>` when `item.iconUrl` is available
- renders a heart SVG fallback when no icon exists
- uses the category color as the bubble fill and white border/shadow for contrast

- [ ] **Step 4: Route pointer events to the visible lobe**

Add:

```js
function getCategoryBubblePlaceKeyFromEvent(event, fallbackPlaceKey) {
    const target = event?.originalEvent?.target;
    const element = target?.closest?.('.directory-category-bubble-marker__lobe[data-category-bubble-place-key]');
    return element?.dataset?.categoryBubblePlaceKey || fallbackPlaceKey || null;
}
```

Then, when `markerMode === 'category-bubble'`, call `handlePlaceActivate`, `onHoverPlaceStart`, and `onHoverPlaceEnd` with `getCategoryBubblePlaceKeyFromEvent(event, pin.placeKey)`.

- [ ] **Step 5: Enable the collision sync for category bubbles**

Change the sync render to:

```jsx
<DirectoryPrintBadgeCollisionSync
    enabled={markerMode === 'print-badge' || markerMode === 'category-bubble'}
    refreshKey={printBadgeLayoutRefreshKey}
/>
```

Include category bubble item keys in `printBadgeLayoutRefreshKey` so hover/selection redraws settle without flicker.

- [ ] **Step 6: Add CSS for pointer safety and icon sizing**

In `client/src/index.css`, add:

```css
.leaflet-marker-icon.directory-category-bubble-leaflet-icon {
  pointer-events: none !important;
}

.leaflet-marker-icon.directory-category-bubble-leaflet-icon .directory-category-bubble-marker,
.leaflet-marker-icon.directory-category-bubble-leaflet-icon .directory-category-bubble-marker__core {
  pointer-events: none !important;
}

.leaflet-marker-icon.directory-category-bubble-leaflet-icon .directory-category-bubble-marker__lobe {
  pointer-events: auto !important;
}

.directory-category-bubble-marker__icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
}

.directory-category-bubble-marker__fallback {
  width: 15px;
  height: 15px;
  fill: #ffffff;
}
```

- [ ] **Step 7: Run focused DirectoryMap tests and verify GREEN**

Run:

```bash
node --test client/test/directoryMapMarkerMode.test.js
```

Expected: PASS.

### Task 4: Wire Owner My Map V2 And Shared Maps To Category Bubbles

**Files:**
- Modify: `client/src/components/MyMapV2PreviewScaffold.jsx`
- Modify: `client/src/pages/SharedMapPage.jsx`
- Test: `client/test/myMapV2Scaffold.test.js`
- Test: `client/test/sharedMapContinuation.test.js`

- [ ] **Step 1: Enable category bubbles for owner My Map V2**

Change the V2 `DirectoryMap` call from:

```jsx
markerMode="count"
pinCategoryIconMode="none"
clusterMarkerMode="none"
```

to:

```jsx
markerMode="category-bubble"
pinCategoryIconMode="none"
clusterMarkerMode="none"
```

- [ ] **Step 2: Enable category bubbles for shared-map interactive views**

Apply the same `markerMode="category-bubble"` change to all interactive shared-map `DirectoryMap` renderers, leaving shared print untouched.

- [ ] **Step 3: Run focused wiring tests and verify GREEN**

Run:

```bash
node --test client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js
```

Expected: PASS.

### Task 5: Update Regression Ledger And Run Release-Quality Validation

**Files:**
- Modify: `docs/regression-ledger.md`

- [ ] **Step 1: Add a My Map V2/shared-map category bubble follow-up**

Append a short follow-up under `2026-06-14 My Map V2 preview scaffold` stating that owner My Map V2 and interactive shared maps now use category-icon bubble markers, print keeps numeric bubbles, and classic `?ui=stable` remains unchanged.

- [ ] **Step 2: Run the focused gate**

Run:

```bash
node --test client/test/directoryMapMarkerMode.test.js client/test/directoryPresentationV2Order.test.js client/test/myMapV2Scaffold.test.js client/test/sharedMapContinuation.test.js client/test/sharedMapDirectoryListRefinement.test.js
```

Expected: PASS.

- [ ] **Step 3: Run full client coverage**

Run:

```bash
node --test client/test/*.test.js client/src/lib/*.test.js
```

Expected: PASS.

- [ ] **Step 4: Run production-style client build**

Run:

```bash
VITE_API_URL=https://api.carearound.sg/api npm run build:client
```

Expected: PASS, allowing the existing large-chunk warning.

- [ ] **Step 5: Check whitespace and worktree**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only intended changed files plus the existing untracked Playwright output folder.
