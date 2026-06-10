# My Map PDF Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click, searchable PDF ledger export to signed-in My Map detail pages.

**Architecture:** Keep the feature client-side and isolated to the My Map owner view. Reuse the existing directory presentation data for full-map rows, preserve note timestamps in the shared note helper, generate searchable PDF text with a lazily loaded PDF library, and capture the map image separately so a failed snapshot never blocks the ledger.

**Tech Stack:** React, Vite, existing Node test runner, `html-to-image`, `jspdf@4.2.1`, `jspdf-autotable@5.0.8`, existing My Map directory presentation helpers.

---

## File Structure

- Modify `client/package.json` and `package-lock.json`: add the PDF generation dependencies.
- Modify `client/src/lib/mapNotes.js`: preserve note timestamps when normalizing notes.
- Modify `client/test/mapNotes.test.js`: cover timestamp preservation without changing existing note count behavior.
- Create `client/src/lib/myMapPdfLedger.js`: pure data builder for grouped PDF rows, summary counts, source map numbers, and filenames.
- Create `client/test/myMapPdfLedger.test.js`: unit coverage for full-map inclusion, grouping, sorting, notes, timestamps, and source map numbers.
- Create `client/src/lib/myMapPdfGenerator.js`: browser-only PDF generation and file download helper.
- Create `client/test/myMapPdfGeneratorSource.test.js`: source-level guard that the heavy PDF libraries are lazy-loaded.
- Create `client/src/components/MyMapPdfExportButton.jsx`: user-facing export button plus optional hidden map snapshot capture.
- Create `client/test/myMapPdfExportButtonSource.test.js`: source-level guard for button state, hidden capture, and download helper wiring.
- Modify `client/src/pages/MyMapDetailPage.jsx`: add full-map presentation and place the PDF action in desktop and mobile My Map controls.
- Modify `client/src/lib/i18n.js`: add localized button, progress, and failure strings.
- Modify `docs/regression-ledger.md`: after verification, record the locked behavior and test evidence.

## Task 1: Add PDF Dependencies

**Files:**
- Modify: `client/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the browser PDF libraries**

Run:

```bash
npm install --workspace=client jspdf@4.2.1 jspdf-autotable@5.0.8
```

Expected: npm updates `client/package.json` and `package-lock.json` without install errors.

- [ ] **Step 2: Confirm the dependency entries**

Run:

```bash
node -e "const pkg=require('./client/package.json'); console.log(pkg.dependencies.jspdf, pkg.dependencies['jspdf-autotable'])"
```

Expected:

```text
^4.2.1 ^5.0.8
```

- [ ] **Step 3: Commit the dependency change**

Run:

```bash
git add client/package.json package-lock.json
git commit -m "Add My Map PDF export dependencies"
```

Expected: one commit containing only dependency metadata.

## Task 2: Preserve Note Timestamps

**Files:**
- Modify: `client/src/lib/mapNotes.js`
- Modify: `client/test/mapNotes.test.js`

- [ ] **Step 1: Write the failing timestamp test**

In `client/test/mapNotes.test.js`, add `normalizeNoteItems` to the import list:

```js
import {
    applySharedNoteTranslationsToDirectory,
    buildMapNoteResourceRows,
    buildMapNoteRowBadgeParts,
    buildMapNoteSummaryParts,
    getMapNoteResourceSummary,
    normalizeNoteItems,
} from '../src/lib/mapNotes.js';
```

Then add this test near the existing note normalization consumers:

```js
test('normalizeNoteItems preserves available note timestamps', () => {
    const notes = normalizeNoteItems({
        notesUpdatedAt: '2026-06-10T09:30:00.000Z',
        items: [
            {
                id: 10,
                text: 'Call before sending referral',
                isShared: true,
                createdAt: '2026-06-09T08:15:00.000Z',
                updatedAt: '2026-06-10T09:30:00.000Z',
            },
            {
                id: 11,
                text: 'Bring printed form',
                isShared: false,
            },
        ],
    });

    assert.equal(notes[0].createdAt, '2026-06-09T08:15:00.000Z');
    assert.equal(notes[0].updatedAt, '2026-06-10T09:30:00.000Z');
    assert.equal(notes[1].createdAt, '2026-06-10T09:30:00.000Z');
    assert.equal(notes[1].updatedAt, '2026-06-10T09:30:00.000Z');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test client/test/mapNotes.test.js
```

Expected: FAIL because normalized notes do not yet expose `createdAt` and `updatedAt`.

- [ ] **Step 3: Implement timestamp preservation**

In `client/src/lib/mapNotes.js`, add this helper above `normalizeNoteItems`:

```js
function normalizeNoteTimestamp(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const time = new Date(text).getTime();
    return Number.isFinite(time) ? text : null;
}
```

Then update `normalizeNoteItems` so array and legacy notes preserve timestamps:

```js
export function normalizeNoteItems(notes) {
    const fallbackTimestamp = normalizeNoteTimestamp(notes?.notesUpdatedAt);

    if (Array.isArray(notes?.items)) {
        return notes.items
            .map((note, index) => {
                const createdAt = normalizeNoteTimestamp(note?.createdAt) || fallbackTimestamp;
                const updatedAt = normalizeNoteTimestamp(note?.updatedAt)
                    || normalizeNoteTimestamp(note?.createdAt)
                    || fallbackTimestamp;

                return {
                    clientId: note?.id ? `note-${note.id}` : `note-${index}`,
                    id: note?.id || null,
                    text: String(note?.text || '').slice(0, 1000),
                    isShared: Boolean(note?.isShared),
                    createdAt,
                    updatedAt,
                };
            })
            .filter((note) => note.text.trim());
    }

    const legacyItems = [];
    const privateNote = String(notes?.privateNote || '').trim();
    const handoffNote = String(notes?.handoffNote || '').trim();
    if (privateNote) {
        legacyItems.push({
            clientId: 'legacy-private',
            id: null,
            text: privateNote,
            isShared: false,
            createdAt: fallbackTimestamp,
            updatedAt: fallbackTimestamp,
        });
    }
    if (handoffNote) {
        legacyItems.push({
            clientId: 'legacy-shared',
            id: null,
            text: handoffNote,
            isShared: true,
            createdAt: fallbackTimestamp,
            updatedAt: fallbackTimestamp,
        });
    }
    return legacyItems;
}
```

- [ ] **Step 4: Run the focused note tests**

Run:

```bash
node --test client/test/mapNotes.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the note timestamp change**

Run:

```bash
git add client/src/lib/mapNotes.js client/test/mapNotes.test.js
git commit -m "Preserve My Map note timestamps"
```

Expected: one commit containing only the note helper and its test.

## Task 3: Build The PDF Ledger Data Model

**Files:**
- Create: `client/src/lib/myMapPdfLedger.js`
- Create: `client/test/myMapPdfLedger.test.js`

- [ ] **Step 1: Write tests for the ledger builder**

Create `client/test/myMapPdfLedger.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMyMapPdfFileName,
    buildMyMapPdfLedger,
} from '../src/lib/myMapPdfLedger.js';

function row(overrides) {
    return {
        assetKey: `${overrides.resourceType || 'hard'}-${overrides.resourceId}`,
        resourceType: overrides.resourceType || 'hard',
        resourceId: overrides.resourceId,
        name: overrides.name,
        subCategory: overrides.subCategory,
        bucket: overrides.bucket,
        address: overrides.address,
        notes: overrides.notes || { items: [] },
        ...overrides,
    };
}

test('buildMyMapPdfLedger includes full map resources grouped and sorted by category', () => {
    const presentation = {
        mappedGroups: [
            {
                placeKey: 'place-2',
                number: 2,
                name: 'Bravo Place',
                address: '2 Bravo Street Singapore 222222',
                rows: [
                    row({
                        resourceId: 20,
                        name: 'Zeta AAC',
                        subCategory: 'Active Ageing Centre (AAC)',
                        notes: {
                            items: [
                                {
                                    id: 1,
                                    text: 'Shared note',
                                    isShared: true,
                                    updatedAt: '2026-06-10T09:00:00.000Z',
                                },
                            ],
                        },
                    }),
                ],
                nestedPlaces: [
                    {
                        placeKey: 'place-1',
                        number: 1,
                        name: 'Alpha Place',
                        address: '1 Alpha Road Singapore 111111',
                        rows: [
                            row({
                                resourceId: 10,
                                name: 'Alpha Programme',
                                resourceType: 'soft',
                                subCategory: 'Befriending',
                                notes: { items: [] },
                            }),
                        ],
                    },
                ],
            },
        ],
        unmappedRows: [
            row({
                resourceId: 99,
                name: 'Mobile Support',
                resourceType: 'soft',
                bucket: 'Home care',
                address: '',
                notes: {
                    items: [
                        {
                            id: 9,
                            text: 'Private coordination note',
                            isShared: false,
                            createdAt: '2026-06-08T01:00:00.000Z',
                            updatedAt: '2026-06-08T02:00:00.000Z',
                        },
                    ],
                },
            }),
        ],
        placeNumberByKey: {
            'place-1': 1,
            'place-2': 2,
        },
    };

    const ledger = buildMyMapPdfLedger({
        directory: { name: 'My Partners' },
        presentation,
        generatedAt: new Date('2026-06-10T10:00:00.000Z'),
        locale: 'en-SG',
    });

    assert.equal(ledger.mapName, 'My Partners');
    assert.equal(ledger.summary.resourceCount, 3);
    assert.equal(ledger.summary.categoryCount, 3);
    assert.equal(ledger.summary.resourcesWithNotesCount, 2);
    assert.equal(ledger.summary.noteCount, 2);
    assert.deepEqual(ledger.categories.map((category) => category.name), [
        'Active Ageing Centre (AAC)',
        'Befriending',
        'Home care',
    ]);
    assert.deepEqual(ledger.categories[0].resources.map((resource) => resource.name), ['Zeta AAC']);
    assert.equal(ledger.categories[0].resources[0].sourceMapNumber, '2');
    assert.equal(ledger.categories[1].resources[0].sourceMapNumber, '1');
    assert.equal(ledger.categories[2].resources[0].sourceMapNumber, 'List only');
    assert.equal(ledger.categories[2].resources[0].notes[0].visibility, 'Private');
    assert.equal(ledger.categories[2].resources[0].notes[0].updatedAt, '2026-06-08T02:00:00.000Z');
});

test('buildMyMapPdfFileName creates a safe pdf filename', () => {
    assert.equal(buildMyMapPdfFileName('My Partners / North-West'), 'my-partners-north-west-ledger.pdf');
    assert.equal(buildMyMapPdfFileName(''), 'carearound-map-ledger.pdf');
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node --test client/test/myMapPdfLedger.test.js
```

Expected: FAIL because `client/src/lib/myMapPdfLedger.js` does not exist.

- [ ] **Step 3: Implement the pure ledger builder**

Create `client/src/lib/myMapPdfLedger.js`:

```js
import { getRowAssetKey, normalizeNoteItems } from './mapNotes.js';

const LIST_ONLY_LABEL = 'List only';
const UNCATEGORIZED_LABEL = 'Uncategorized';

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function compareText(left, right) {
    return cleanText(left).localeCompare(cleanText(right), undefined, {
        sensitivity: 'base',
        numeric: true,
    });
}

function getCategoryName(row) {
    return cleanText(row?.subCategory)
        || cleanText(row?.bucket)
        || (row?.resourceType === 'hard' ? 'Place' : 'Offering')
        || UNCATEGORIZED_LABEL;
}

function getAddress(row, place) {
    return cleanText(row?.address)
        || cleanText(place?.address)
        || cleanText(row?.locationLabel)
        || cleanText(place?.name)
        || 'Address unavailable';
}

function getSourceMapNumber(presentation, place) {
    const value = place?.number
        || presentation?.placeNumberByKey?.[place?.placeKey]
        || null;
    return value ? String(value) : LIST_ONLY_LABEL;
}

function normalizePdfNotes(row) {
    return normalizeNoteItems(row?.notes).map((note) => ({
        id: note.id,
        text: cleanText(note.text),
        visibility: note.isShared ? 'Shared' : 'Private',
        createdAt: note.createdAt || null,
        updatedAt: note.updatedAt || note.createdAt || null,
    }));
}

function collectPresentationResources(presentation) {
    const seen = new Set();
    const resources = [];

    function addRow(row, place, sourceMapNumber) {
        if (!row) return;
        const key = getRowAssetKey(row);
        if (seen.has(key)) return;
        seen.add(key);

        resources.push({
            key,
            name: cleanText(row.name) || 'Unnamed resource',
            category: getCategoryName(row),
            address: getAddress(row, place),
            sourceMapNumber,
            notes: normalizePdfNotes(row),
        });
    }

    for (const group of presentation?.mappedGroups || []) {
        const groupSourceNumber = getSourceMapNumber(presentation, group);
        for (const row of group?.rows || []) {
            addRow(row, group, groupSourceNumber);
        }

        for (const nestedPlace of group?.nestedPlaces || []) {
            const nestedSourceNumber = getSourceMapNumber(presentation, nestedPlace);
            for (const row of nestedPlace?.rows || []) {
                addRow(row, nestedPlace, nestedSourceNumber);
            }
        }
    }

    for (const row of presentation?.unmappedRows || []) {
        addRow(row, row, LIST_ONLY_LABEL);
    }

    return resources;
}

function groupResourcesByCategory(resources) {
    const byCategory = new Map();

    for (const resource of resources) {
        const categoryName = resource.category || UNCATEGORIZED_LABEL;
        if (!byCategory.has(categoryName)) {
            byCategory.set(categoryName, []);
        }
        byCategory.get(categoryName).push(resource);
    }

    return [...byCategory.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([name, categoryResources]) => ({
            name,
            resources: [...categoryResources].sort((left, right) => compareText(left.name, right.name)),
        }));
}

export function buildMyMapPdfFileName(mapName) {
    const slug = cleanText(mapName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${slug || 'carearound-map'}-ledger.pdf`;
}

export function buildMyMapPdfLedger({
    directory,
    presentation,
    generatedAt = new Date(),
    locale = 'en-SG',
} = {}) {
    const resources = collectPresentationResources(presentation);
    const categories = groupResourcesByCategory(resources);
    const noteCount = resources.reduce((total, resource) => total + resource.notes.length, 0);
    const resourcesWithNotesCount = resources.filter((resource) => resource.notes.length > 0).length;

    return {
        mapName: cleanText(directory?.name) || 'Untitled map',
        generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : new Date(generatedAt).toISOString(),
        generatedLabel: new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(generatedAt instanceof Date ? generatedAt : new Date(generatedAt)),
        summary: {
            resourceCount: resources.length,
            categoryCount: categories.length,
            resourcesWithNotesCount,
            noteCount,
        },
        categories,
    };
}
```

- [ ] **Step 4: Run the ledger tests**

Run:

```bash
node --test client/test/myMapPdfLedger.test.js
```

Expected: PASS.

- [ ] **Step 5: Run related note and presentation tests**

Run:

```bash
node --test client/test/mapNotes.test.js client/test/directoryPresentationLayout.test.js client/test/myMapPdfLedger.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the ledger builder**

Run:

```bash
git add client/src/lib/myMapPdfLedger.js client/test/myMapPdfLedger.test.js
git commit -m "Build My Map PDF ledger data model"
```

Expected: one commit containing the pure builder and tests.

## Task 4: Add The Searchable PDF Generator

**Files:**
- Create: `client/src/lib/myMapPdfGenerator.js`
- Create: `client/test/myMapPdfGeneratorSource.test.js`

- [ ] **Step 1: Add a source-level test for lazy loading**

Create `client/test/myMapPdfGeneratorSource.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/lib/myMapPdfGenerator.js', import.meta.url),
    'utf8',
);

test('My Map PDF generator lazy-loads heavy PDF libraries', () => {
    assert.doesNotMatch(source, /from ['"]jspdf['"]/);
    assert.doesNotMatch(source, /from ['"]jspdf-autotable['"]/);
    assert.match(source, /import\(['"]jspdf['"]\)/);
    assert.match(source, /import\(['"]jspdf-autotable['"]\)/);
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node --test client/test/myMapPdfGeneratorSource.test.js
```

Expected: FAIL because `client/src/lib/myMapPdfGenerator.js` does not exist.

- [ ] **Step 3: Implement the generator**

Create `client/src/lib/myMapPdfGenerator.js`:

```js
import { buildMyMapPdfFileName, buildMyMapPdfLedger } from './myMapPdfLedger.js';

const BRAND = {
    teal: [20, 148, 138],
    dark: [15, 23, 42],
    muted: [71, 85, 105],
    line: [226, 232, 240],
};

function resolveAutoTable(module) {
    return module.default || module.autoTable;
}

function writeHeader(doc, ledger) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...BRAND.dark);
    doc.text(ledger.mapName, 40, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(`Generated ${ledger.generatedLabel}`, 40, 64);
}

function writeSummary(doc, autoTable, ledger, mapSnapshotDataUrl) {
    writeHeader(doc, ledger);

    const summaryRows = [
        ['Total resources', String(ledger.summary.resourceCount)],
        ['Categories', String(ledger.summary.categoryCount)],
        ['Resources with notes', String(ledger.summary.resourcesWithNotesCount)],
        ['Total notes', String(ledger.summary.noteCount)],
    ];

    autoTable(doc, {
        startY: 84,
        head: [['Summary', 'Count']],
        body: summaryRows,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: BRAND.teal, textColor: 255 },
        margin: { left: 40, right: 40 },
    });

    const afterSummaryY = doc.lastAutoTable?.finalY || 160;
    const categoryRows = ledger.categories.map((category) => [
        category.name,
        String(category.resources.length),
    ]);

    autoTable(doc, {
        startY: afterSummaryY + 18,
        head: [['Category', 'Resources']],
        body: categoryRows.length ? categoryRows : [['No categories', '0']],
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255 },
        margin: { left: 40, right: 40 },
    });

    const snapshotY = (doc.lastAutoTable?.finalY || 250) + 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...BRAND.dark);
    doc.text('Map snapshot', 40, snapshotY);

    if (mapSnapshotDataUrl) {
        doc.addImage(mapSnapshotDataUrl, 'PNG', 40, snapshotY + 10, 260, 150, undefined, 'FAST');
        return;
    }

    doc.setDrawColor(...BRAND.line);
    doc.roundedRect(40, snapshotY + 10, 260, 72, 6, 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text('Map snapshot unavailable', 54, snapshotY + 48);
}

function buildResourceRows(category) {
    return category.resources.flatMap((resource) => {
        const noteText = resource.notes.length
            ? resource.notes.map((note) => {
                const timestamp = note.updatedAt ? ` (${note.updatedAt})` : '';
                return `${note.visibility}: ${note.text}${timestamp}`;
            }).join('\n')
            : 'No notes';

        return [[
            resource.sourceMapNumber,
            resource.name,
            resource.address,
            noteText,
        ]];
    });
}

function writeLedger(doc, autoTable, ledger) {
    ledger.categories.forEach((category, index) => {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...BRAND.dark);
        doc.text(category.name, 40, 44);

        autoTable(doc, {
            startY: 60,
            head: [['#', 'Resource', 'Address', 'Notes']],
            body: buildResourceRows(category),
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 8.5,
                cellPadding: 5,
                overflow: 'linebreak',
                valign: 'top',
            },
            headStyles: { fillColor: index % 2 === 0 ? BRAND.teal : [51, 65, 85], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 34, halign: 'center' },
                1: { cellWidth: 120 },
                2: { cellWidth: 150 },
                3: { cellWidth: 190 },
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => {
                const pageNumber = doc.internal.getNumberOfPages();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...BRAND.muted);
                doc.text(`CareAround SG - ${ledger.mapName} - Page ${pageNumber}`, 40, 820);
            },
        });
    });
}

export async function downloadMyMapPdf({
    directory,
    presentation,
    generatedAt = new Date(),
    locale = 'en-SG',
    mapSnapshotDataUrl = null,
} = {}) {
    const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);
    const autoTable = resolveAutoTable(autoTableModule);
    const ledger = buildMyMapPdfLedger({ directory, presentation, generatedAt, locale });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    writeSummary(doc, autoTable, ledger, mapSnapshotDataUrl);
    writeLedger(doc, autoTable, ledger);
    doc.save(buildMyMapPdfFileName(ledger.mapName));
}
```

- [ ] **Step 4: Run the generator source test**

Run:

```bash
node --test client/test/myMapPdfGeneratorSource.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the generator**

Run:

```bash
git add client/src/lib/myMapPdfGenerator.js client/test/myMapPdfGeneratorSource.test.js
git commit -m "Add My Map PDF generator"
```

Expected: one commit containing the generator and source guard.

## Task 5: Add The Export Button And Map Snapshot Capture

**Files:**
- Create: `client/src/components/MyMapPdfExportButton.jsx`
- Create: `client/test/myMapPdfExportButtonSource.test.js`

- [ ] **Step 1: Add a source-level button test**

Create `client/test/myMapPdfExportButtonSource.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/components/MyMapPdfExportButton.jsx', import.meta.url),
    'utf8',
);

test('My Map PDF export button captures a map snapshot but still downloads without one', () => {
    assert.match(source, /downloadMyMapPdf/);
    assert.match(source, /captureMapSnapshot/);
    assert.match(source, /mapSnapshotDataUrl/);
    assert.match(source, /createPortal/);
    assert.match(source, /DirectoryMap/);
    assert.match(source, /failedDownloadPdf/);
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node --test client/test/myMapPdfExportButtonSource.test.js
```

Expected: FAIL because `client/src/components/MyMapPdfExportButton.jsx` does not exist.

- [ ] **Step 3: Implement the button component**

Create `client/src/components/MyMapPdfExportButton.jsx`:

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown } from 'lucide-react';
import { toPng } from 'html-to-image';

import DirectoryMap from './DirectoryMap.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { downloadMyMapPdf } from '../lib/myMapPdfGenerator.js';

const TRANSPARENT_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

export default function MyMapPdfExportButton({
    directory,
    presentation,
    activeAnchor = null,
    className = '',
}) {
    const { locale, t } = useLocale();
    const snapshotRef = useRef(null);
    const exportReadyRef = useRef(false);
    const mapErrorRef = useRef(null);
    const readyWaitersRef = useRef([]);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const exportRoot = typeof document !== 'undefined' ? document.body : null;
    const canCaptureMap = Boolean((presentation?.pins || []).length || activeAnchor);

    useEffect(() => {
        exportReadyRef.current = false;
        mapErrorRef.current = null;
        readyWaitersRef.current = [];
    }, [
        activeAnchor?.address,
        activeAnchor?.kind,
        activeAnchor?.lat,
        activeAnchor?.lng,
        activeAnchor?.postalCode,
        directory?.id,
        directory?.updatedAt,
        presentation?.pins?.length,
    ]);

    const handleMapReadyForCapture = useCallback(() => {
        exportReadyRef.current = true;
        mapErrorRef.current = null;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ resolve }) => resolve());
    }, []);

    const handleMapCaptureError = useCallback((captureError) => {
        mapErrorRef.current = captureError;
        exportReadyRef.current = false;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ reject }) => reject(captureError));
    }, []);

    async function waitForMapSnapshotSurface() {
        if (!canCaptureMap) return false;

        if (document.fonts?.ready) {
            try {
                await document.fonts.ready;
            } catch {
                // Continue without blocking PDF export on font readiness.
            }
        }

        if (mapErrorRef.current) return false;
        if (exportReadyRef.current) return true;

        return new Promise((resolve) => {
            const timeoutId = window.setTimeout(() => {
                readyWaitersRef.current = readyWaitersRef.current.filter((waiter) => waiter !== waiterEntry);
                resolve(false);
            }, 5500);

            const waiterEntry = {
                resolve: () => {
                    window.clearTimeout(timeoutId);
                    resolve(true);
                },
                reject: () => {
                    window.clearTimeout(timeoutId);
                    resolve(false);
                },
            };

            readyWaitersRef.current.push(waiterEntry);
        });
    }

    async function captureMapSnapshot() {
        if (!snapshotRef.current) return null;
        const ready = await waitForMapSnapshotSurface();
        if (!ready) return null;

        await new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(resolve);
            });
        });

        try {
            return await toPng(snapshotRef.current, {
                cacheBust: false,
                imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
                pixelRatio: 1.5,
                backgroundColor: '#ffffff',
            });
        } catch {
            return null;
        }
    }

    async function handleDownload() {
        if (exporting || !directory || !presentation) return;
        setExporting(true);
        setError('');

        try {
            const mapSnapshotDataUrl = await captureMapSnapshot();
            await downloadMyMapPdf({
                directory,
                presentation,
                locale,
                generatedAt: new Date(),
                mapSnapshotDataUrl,
            });
        } catch (err) {
            console.error(err);
            setError(err?.message || t('failedDownloadPdf'));
        } finally {
            setExporting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <FileDown size={16} />
                {exporting ? t('preparingPdf') : t('downloadPdf')}
            </button>
            {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}

            {exportRoot ? createPortal(
                <div
                    className="pointer-events-none fixed left-0 top-0 overflow-visible p-4"
                    style={{ left: '-10000px', opacity: 0.001 }}
                    aria-hidden="true"
                >
                    <div ref={snapshotRef} className="w-[720px] bg-white">
                        <DirectoryMap
                            activeAnchor={activeAnchor}
                            pins={presentation?.pins || []}
                            interactive={false}
                            markerMode="number"
                            placeNumberByKey={presentation?.placeNumberByKey}
                            showPopup={false}
                            showZoomControl={false}
                            showProviderBadgeLogo
                            mapHeightClassName="h-[360px] min-h-[360px] max-h-[360px]"
                            onMapReadyForCapture={handleMapReadyForCapture}
                            onMapCaptureError={handleMapCaptureError}
                        />
                    </div>
                </div>,
                exportRoot,
            ) : null}
        </>
    );
}
```

- [ ] **Step 4: Run the source test**

Run:

```bash
node --test client/test/myMapPdfExportButtonSource.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the button component**

Run:

```bash
git add client/src/components/MyMapPdfExportButton.jsx client/test/myMapPdfExportButtonSource.test.js
git commit -m "Add My Map PDF export button"
```

Expected: one commit containing only the component and source guard.

## Task 6: Wire The Button Into My Map Detail

**Files:**
- Modify: `client/src/pages/MyMapDetailPage.jsx`
- Modify: `client/src/lib/i18n.js`
- Create: `client/test/myMapPdfIntegrationSource.test.js`

- [ ] **Step 1: Add a source-level integration test**

Create `client/test/myMapPdfIntegrationSource.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const i18nSource = readFileSync(
    new URL('../src/lib/i18n.js', import.meta.url),
    'utf8',
);

test('My Map detail page uses an unfiltered presentation for PDF export', () => {
    assert.match(pageSource, /MyMapPdfExportButton/);
    assert.match(pageSource, /pdfPresentation/);
    assert.match(pageSource, /buildDirectoryPresentation\(directory,\s*\{\s*activeAnchor\s*\}\)/);
    assert.match(pageSource, /presentation=\{pdfPresentation\}/);
});

test('My Map PDF labels are available in all locale dictionaries', () => {
    for (const key of ['downloadPdf', 'preparingPdf', 'failedDownloadPdf']) {
        const occurrences = [...i18nSource.matchAll(new RegExp(`${key}:`, 'g'))].length;
        assert.equal(occurrences, 4, `${key} should exist once per locale`);
    }
});
```

- [ ] **Step 2: Run the new integration test and confirm it fails**

Run:

```bash
node --test client/test/myMapPdfIntegrationSource.test.js
```

Expected: FAIL because the page and translation keys are not wired yet.

- [ ] **Step 3: Wire the PDF button into `MyMapDetailPage.jsx`**

Update the icon imports:

```jsx
import { ArrowLeft, Link2, Menu, Pencil, Plus, Printer, X } from 'lucide-react';
```

Add the component import:

```jsx
import MyMapPdfExportButton from '../components/MyMapPdfExportButton.jsx';
```

Update `OwnerHeader` props:

```jsx
function OwnerHeader({
    directory,
    query,
    onQueryChange,
    anchorState,
    actionError,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
    renderPdfExportButton,
}) {
```

Inside the desktop action row, place the PDF action after Print:

```jsx
<button type="button" onClick={onOpenPrintView} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
    <Printer size={16} />
    {t('print')}
</button>
{renderPdfExportButton?.(`h-12 justify-center px-3.5 text-sm sm:w-auto sm:px-4`)}
<button type="button" onClick={onOpenShare} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
    <Link2 size={16} />
    {t('share')}
</button>
```

Update `MyMapMobileControls` props:

```jsx
function MyMapMobileControls({
    directory,
    query,
    onQueryChange,
    anchorState,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
    renderPdfExportButton,
}) {
```

Inside the mobile drawer button stack, place the PDF action after Print:

```jsx
<button type="button" onClick={() => runDrawerAction(onOpenPrintView)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
    <Printer size={16} />
    {t('printFriendlyView')}
</button>
{renderPdfExportButton?.('h-12 w-full justify-center px-4 text-sm')}
<button type="button" onClick={() => runDrawerAction(onOpenShare)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
    <Link2 size={16} />
    {t('share')}
</button>
```

Add the full-map presentation near `interactivePresentation`:

```jsx
const pdfPresentation = useMemo(() => (
    buildDirectoryPresentation(directory, { activeAnchor })
), [activeAnchor, directory]);
```

Add a render helper in `MyMapDetailPage` after `sharedDirectoryUrl`:

```jsx
const renderPdfExportButton = useCallback((className = '') => (
    <MyMapPdfExportButton
        directory={directory}
        presentation={pdfPresentation}
        activeAnchor={activeAnchor}
        className={className}
    />
), [activeAnchor, directory, pdfPresentation]);
```

Pass it to mobile controls:

```jsx
renderPdfExportButton={renderPdfExportButton}
```

Pass it to `OwnerHeader`:

```jsx
renderPdfExportButton={renderPdfExportButton}
```

- [ ] **Step 4: Add translation keys**

In each locale block in `client/src/lib/i18n.js`, add the three keys next to `saveAsImage` and `exporting`.

English:

```js
downloadPdf: 'Download PDF',
preparingPdf: 'Preparing PDF...',
failedDownloadPdf: 'PDF download failed. Try again.',
```

Chinese:

```js
downloadPdf: '下载 PDF',
preparingPdf: '正在准备 PDF...',
failedDownloadPdf: 'PDF 下载失败。请再试一次。',
```

Malay:

```js
downloadPdf: 'Muat turun PDF',
preparingPdf: 'Menyediakan PDF...',
failedDownloadPdf: 'Muat turun PDF gagal. Cuba lagi.',
```

Tamil:

```js
downloadPdf: 'PDF பதிவிறக்கு',
preparingPdf: 'PDF தயாராகிறது...',
failedDownloadPdf: 'PDF பதிவிறக்கம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
```

- [ ] **Step 5: Run the integration and i18n tests**

Run:

```bash
node --test client/test/myMapPdfIntegrationSource.test.js client/test/i18n.test.js client/test/i18nCoverage.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the page wiring**

Run:

```bash
git add client/src/pages/MyMapDetailPage.jsx client/src/lib/i18n.js client/test/myMapPdfIntegrationSource.test.js
git commit -m "Wire My Map PDF download action"
```

Expected: one commit containing the owner page integration and translation keys.

## Task 7: Verify PDF Export Behavior And Lock The Regression Ledger

**Files:**
- Modify: `docs/regression-ledger.md`

- [ ] **Step 1: Run the focused client tests**

Run:

```bash
node --test \
  client/test/mapNotes.test.js \
  client/test/myMapPdfLedger.test.js \
  client/test/myMapPdfGeneratorSource.test.js \
  client/test/myMapPdfExportButtonSource.test.js \
  client/test/myMapPdfIntegrationSource.test.js \
  client/test/directoryPresentationLayout.test.js \
  client/test/i18n.test.js \
  client/test/i18nCoverage.test.js
```

Expected: PASS.

- [ ] **Step 2: Run the broader client test sweep**

Run:

```bash
node --test client/test/*.test.js client/src/lib/*.test.js
```

Expected: PASS.

- [ ] **Step 3: Build the client**

Run:

```bash
npm run build:client
```

Expected: PASS. Existing large chunk warnings are acceptable if they match the current baseline. There must be no build error.

- [ ] **Step 4: Run the server test gate**

Run:

```bash
npm run test:server
```

Expected: PASS.

- [ ] **Step 5: Start local app for manual PDF verification**

Run the server and client in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Expected: Worker API and Vite client are both available locally.

- [ ] **Step 6: Manually verify the signed-in My Map PDF flow**

Open a signed-in My Map detail page. Use a map that has at least one mapped resource, one list-only resource, and at least one note.

Expected:

- `Download PDF` appears on desktop beside Print and Share.
- `Download PDF` appears in the mobile map controls drawer.
- Clicking the button downloads a `.pdf` without opening the browser print dialog.
- The PDF first page shows summary counts, category breakdown, and either a map snapshot or `Map snapshot unavailable`.
- Ledger pages group categories alphabetically.
- Resources within each category are alphabetical.
- Source map number shows the visible map number for pinned resources and `List only` for unmapped resources.
- Note text is visible only from the data already visible to the signed-in map owner.
- Note timestamps appear when available.
- PDF text can be selected and searched.
- Existing Print, Share, Save as image, map card navigation, and map notes still work.

- [ ] **Step 7: Update the regression ledger**

Add a dated row to `docs/regression-ledger.md` with this behavior summary:

```markdown
| 2026-06-10 | My Map PDF ledger export | Locked signed-in My Map one-click PDF export for full-map resource and notes review. PDF export is owner-page only in V1, uses permission-filtered map payload data, groups all resources by category alphabetically, includes source map numbers/list-only labels, and keeps Print/Share/image export behavior unchanged. | `node --test client/test/mapNotes.test.js client/test/myMapPdfLedger.test.js client/test/myMapPdfGeneratorSource.test.js client/test/myMapPdfExportButtonSource.test.js client/test/myMapPdfIntegrationSource.test.js client/test/directoryPresentationLayout.test.js client/test/i18n.test.js client/test/i18nCoverage.test.js`; `node --test client/test/*.test.js client/src/lib/*.test.js`; `npm run build:client`; `npm run test:server`; manual signed-in My Map PDF download check | Locked |
```

- [ ] **Step 8: Check the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` returns no output. `git status --short` shows only the intended feature and ledger files.

- [ ] **Step 9: Commit the verification ledger**

Run:

```bash
git add docs/regression-ledger.md
git commit -m "Record My Map PDF ledger verification"
```

Expected: one commit containing the regression ledger update.

## Final Release Gate After Implementation

Before asking the user to test or approve deployment, run:

```bash
node --test client/test/*.test.js client/src/lib/*.test.js
npm run test:server
npm run build:client
git diff --check
```

Expected: all tests and the build pass, and `git diff --check` returns no output.
