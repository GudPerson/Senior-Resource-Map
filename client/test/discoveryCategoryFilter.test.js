import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildDiscoveryCategoryOptions,
    filterDiscoveryResourcesByCategoryKeys,
    matchesDiscoveryCategorySelection,
    normalizeDiscoveryCategoryKey,
} from '../src/lib/discoveryCategoryFilter.js';

const resources = [
    { id: 1, _type: 'hard', subCategory: 'Active Ageing Centre (AAC)' },
    { id: 2, _type: 'hard', subCategory: 'TCM' },
    { id: 3, _type: 'soft', subCategory: 'Services' },
    { id: 4, _type: 'soft', subCategory: '' },
];

test('Discovery category keys are stable across case and whitespace', () => {
    assert.equal(normalizeDiscoveryCategoryKey('  TCM '), 'tcm');
    assert.equal(normalizeDiscoveryCategoryKey(''), '__other__');
    assert.equal(normalizeDiscoveryCategoryKey(null), '__other__');
});

test('Discovery category options remain available while counts follow the current context', () => {
    const options = buildDiscoveryCategoryOptions(resources, [resources[0], resources[2]], {
        otherLabel: 'Other',
    });

    assert.deepEqual(options, [
        { key: 'active ageing centre (aac)', label: 'Active Ageing Centre (AAC)', count: 1 },
        { key: '__other__', label: 'Other', count: 0 },
        { key: 'services', label: 'Services', count: 1 },
        { key: 'tcm', label: 'TCM', count: 0 },
    ]);
});

test('Discovery category selection defaults to all and preserves source order when narrowed', () => {
    assert.equal(filterDiscoveryResourcesByCategoryKeys(resources, []).length, resources.length);
    assert.deepEqual(
        filterDiscoveryResourcesByCategoryKeys(resources, ['services', 'tcm']).map((item) => item.id),
        [2, 3],
    );
    assert.equal(matchesDiscoveryCategorySelection('Services', ['services']), true);
    assert.equal(matchesDiscoveryCategorySelection('TCM', ['services']), false);
});
