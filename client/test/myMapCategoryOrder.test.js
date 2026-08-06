import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMyMapCategoryRank,
    collectMyMapCategoryOptions,
    moveMyMapCategory,
    normalizeMyMapCategoryOrder,
} from '../src/lib/myMapCategoryOrder.js';

test('My Map category order normalizes and ranks unique category keys', () => {
    const order = normalizeMyMapCategoryOrder([
        ' Home care ',
        'ACTIVE AGEING CENTRE',
        'home care',
    ]);
    const rank = buildMyMapCategoryRank(order);

    assert.deepEqual(order, ['home care', 'active ageing centre']);
    assert.equal(rank.get('home care'), 0);
    assert.equal(rank.get('active ageing centre'), 1);
});

test('My Map category options deduplicate mapped and list-only category runs', () => {
    const options = collectMyMapCategoryOptions({
        displayGroups: [
            { categorySortKey: 'home care', categoryLabel: 'Home care', categoryColor: '#0F766E' },
            { categorySortKey: 'home care', categoryLabel: 'Home care', isUnmappedGroup: true },
            { categorySortKey: 'befriending', categoryLabel: 'Befriending' },
        ],
    });

    assert.deepEqual(options.map(({ key, label }) => ({ key, label })), [
        { key: 'home care', label: 'Home care' },
        { key: 'befriending', label: 'Befriending' },
    ]);
    assert.equal(options[0].color, '#0F766E');
});

test('My Map category movement changes only the category sequence', () => {
    const categories = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

    assert.deepEqual(moveMyMapCategory(categories, 2, 0).map((item) => item.key), ['c', 'a', 'b']);
    assert.deepEqual(moveMyMapCategory(categories, 0, -1), categories);
    assert.deepEqual(categories.map((item) => item.key), ['a', 'b', 'c']);
});
