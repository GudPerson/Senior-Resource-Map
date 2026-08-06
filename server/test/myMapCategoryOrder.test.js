import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MY_MAP_CATEGORY_ORDER_LIMIT,
    normalizeMyMapCategoryKey,
    normalizeMyMapCategoryOrder,
} from '../src/utils/myMapCategoryOrder.js';

test('My Map category order normalizes, deduplicates, and bounds category keys', () => {
    const values = [
        ' Home care ',
        'ACTIVE AGEING CENTRE (AAC)',
        'home care',
        '',
        ...Array.from({ length: MY_MAP_CATEGORY_ORDER_LIMIT + 5 }, (_, index) => `Category ${index}`),
    ];
    const order = normalizeMyMapCategoryOrder(values);

    assert.deepEqual(order.slice(0, 2), [
        'home care',
        'active ageing centre (aac)',
    ]);
    assert.equal(order.length, MY_MAP_CATEGORY_ORDER_LIMIT);
    assert.equal(normalizeMyMapCategoryKey('  Shop  '), 'shop');
});

test('My Map category order tolerates legacy JSON text and invalid values', () => {
    assert.deepEqual(normalizeMyMapCategoryOrder('["Befriending","Home care"]'), [
        'befriending',
        'home care',
    ]);
    assert.deepEqual(normalizeMyMapCategoryOrder('{broken'), []);
    assert.deepEqual(normalizeMyMapCategoryOrder(null), []);
});
