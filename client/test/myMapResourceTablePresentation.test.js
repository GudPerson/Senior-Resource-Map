import test from 'node:test';
import assert from 'node:assert/strict';

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
