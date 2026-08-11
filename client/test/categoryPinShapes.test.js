import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CATEGORY_PIN_SHAPE_OPTIONS,
    getCategoryPinShape,
    getCategoryPinShapePath,
    normalizeCategoryPinShape,
    normalizeCategoryPinShapes,
} from '../src/lib/categoryPinShapes.js';

test('numbered category pin shapes expose the approved five-shape set', () => {
    assert.deepEqual(CATEGORY_PIN_SHAPE_OPTIONS, [
        'circle',
        'triangle',
        'star',
        'square',
        'pentagon',
    ]);
    CATEGORY_PIN_SHAPE_OPTIONS.forEach((shape) => {
        assert.ok(getCategoryPinShapePath(shape));
    });
});

test('Circle remains the backward-compatible default and is stored implicitly', () => {
    assert.equal(normalizeCategoryPinShape('unknown'), 'circle');
    assert.deepEqual(normalizeCategoryPinShapes({
        ' Active Ageing Centre (AAC) ': 'triangle',
        'Senior Care Centre (SCC)': 'circle',
        'Community Club': 'unknown',
    }), {
        'active ageing centre (aac)': 'triangle',
    });
    assert.equal(getCategoryPinShape({}, 'Active Ageing Centre (AAC)'), 'circle');
});
