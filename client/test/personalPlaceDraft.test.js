import assert from 'node:assert/strict';
import test from 'node:test';
import { getPersonalPlaceDraftCategoryId, isGenericPersonalPlaceDraft } from '../src/lib/personalPlaceDraft.js';

const categories = [{ id: 7, name: 'Health' }, { id: 8, name: 'Outdoor' }];

test('editing an uncategorised imported place retains Personal place after categories load', () => {
    const draft = { id: 25, categoryId: null, categoryLabel: 'Personal place' };
    assert.equal(getPersonalPlaceDraftCategoryId(draft, []), '');
    assert.equal(getPersonalPlaceDraftCategoryId(draft, categories), '');
});

test('manual creation retains the existing default and legacy category selection', () => {
    assert.equal(getPersonalPlaceDraftCategoryId({ id: null }, categories), '7');
    assert.equal(getPersonalPlaceDraftCategoryId({ categoryLabel: 'Outdoor' }, categories), '8');
    assert.equal(getPersonalPlaceDraftCategoryId({ id: 2, categoryId: 8 }, categories), '8');
});

test('a custom legacy category remains eligible for its existing category fallback', () => {
    const draft = { id: 30, categoryId: null, legacyCategoryLabel: 'Outdoor', categoryLabel: 'Outdoor' };
    assert.equal(isGenericPersonalPlaceDraft(draft), false);
    assert.equal(getPersonalPlaceDraftCategoryId(draft, categories), '8');
    assert.equal(isGenericPersonalPlaceDraft({ id: 31, categoryId: null, categoryLabel: 'Personal place' }), true);
});
