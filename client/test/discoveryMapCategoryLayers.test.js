import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildSavedPinCategoryOptions,
    filterSavedPinsByCategoryKeys,
    getSavedPinCategoryKeys,
} from '../src/features/discover/discoveryMapCategoryLayers.js';

const pins = [
    {
        pinKey: 'place-1',
        savedAssets: [
            { assetKey: 'hard:1', subCategory: 'TCM' },
            { assetKey: 'soft:11', subCategory: ' TCM ' },
        ],
    },
    {
        pinKey: 'place-2',
        savedAssets: [
            { assetKey: 'hard:2', subCategory: 'Active Ageing Centre (AAC)' },
            { assetKey: 'soft:12', subCategory: 'Services' },
        ],
    },
    {
        pinKey: 'place-3',
        savedAssets: [{ assetKey: 'hard:3', subCategory: '' }],
    },
];

test('saved pin category options include only categories represented by mappable saved pins', () => {
    assert.deepEqual(buildSavedPinCategoryOptions(pins, { otherLabel: 'Other' }), [
        { key: 'active ageing centre (aac)', label: 'Active Ageing Centre (AAC)', count: 1 },
        { key: '__other__', label: 'Other', count: 1 },
        { key: 'services', label: 'Services', count: 1 },
        { key: 'tcm', label: 'TCM', count: 1 },
    ]);
});

test('a saved pin is counted once per category even when several saved assets share it', () => {
    assert.deepEqual(getSavedPinCategoryKeys(pins[0]), ['tcm']);
});

test('saved pin layers use union semantics and preserve pin order', () => {
    assert.equal(filterSavedPinsByCategoryKeys(pins, []), pins);
    assert.deepEqual(
        filterSavedPinsByCategoryKeys(pins, ['services', 'tcm']).map((pin) => pin.pinKey),
        ['place-1', 'place-2'],
    );
    assert.deepEqual(
        filterSavedPinsByCategoryKeys(pins, ['__other__']).map((pin) => pin.pinKey),
        ['place-3'],
    );
});

test('an empty saved-pin set produces no irrelevant category choices', () => {
    assert.deepEqual(buildSavedPinCategoryOptions([], { otherLabel: 'Other' }), []);
    assert.deepEqual(filterSavedPinsByCategoryKeys([], ['tcm']), []);
});
