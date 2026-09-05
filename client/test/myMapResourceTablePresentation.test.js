import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
} from '../src/lib/printMapState.js';
import {
    getMyMapResourceTableDetailVisibility,
    normalizeMyMapResourceTableColumnCount,
    splitMyMapResourceTableCategories,
} from '../src/lib/myMapResourceTablePresentation.js';

const resourceTableSource = readFileSync(
    new URL('../src/components/MyMapResourceTable.jsx', import.meta.url),
    'utf8',
);

test('table detail visibility follows every existing Card detail choice', () => {
    assert.deepEqual(getMyMapResourceTableDetailVisibility(PRINT_MAP_LABEL_DETAIL_NAMES), {
        labelDetail: PRINT_MAP_LABEL_DETAIL_NAMES,
        compact: true,
        showLogo: false,
        showAddress: false,
        showDescriptions: false,
        showPersonalPlaceLabel: false,
    });
    assert.equal(getMyMapResourceTableDetailVisibility(PRINT_MAP_LABEL_DETAIL_LOGOS).showLogo, true);
    assert.equal(getMyMapResourceTableDetailVisibility(PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES).showAddress, true);
    assert.equal(getMyMapResourceTableDetailVisibility(PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS).showDescriptions, true);
    assert.deepEqual(getMyMapResourceTableDetailVisibility(PRINT_MAP_LABEL_DETAIL_FULL), {
        labelDetail: PRINT_MAP_LABEL_DETAIL_FULL,
        compact: false,
        showLogo: true,
        showAddress: true,
        showDescriptions: true,
        showPersonalPlaceLabel: true,
    });
});

test('table columns accept the same one-to-six layout range and preserve category order', () => {
    const categories = [
        { name: 'A', assets: [{}, {}, {}] },
        { name: 'B', assets: [{}] },
        { name: 'C', assets: [{}, {}] },
        { name: 'D', assets: [{}] },
    ];
    const columns = splitMyMapResourceTableCategories(categories, 3);

    assert.equal(normalizeMyMapResourceTableColumnCount(6), 6);
    assert.equal(normalizeMyMapResourceTableColumnCount(0), 1);
    assert.equal(columns.length, 3);
    assert.deepEqual(columns.flat().map((category) => category.name), ['A', 'B', 'C', 'D']);
    assert.deepEqual(splitMyMapResourceTableCategories(categories, 1), [categories]);
});

test('table descriptions use the same base text size as resource names', () => {
    assert.match(
        resourceTableSource,
        /className="rounded px-1\.5 py-0\.5 text-base font-semibold leading-5 print-color-adjust"/,
    );
    assert.match(
        resourceTableSource,
        /<span className="text-base text-slate-400">\{t\('mapAssetNoDescriptions'\)\}<\/span>/,
    );
});
