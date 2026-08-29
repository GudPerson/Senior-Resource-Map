import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getCategoryPinLabelColor,
    getCategoryPinStyle,
    normalizeCategoryPinStyles,
} from '../src/lib/categoryPinStyles.js';

test('category pin styles normalize keys and accept only six-digit hex colours', () => {
    assert.deepEqual(normalizeCategoryPinStyles({
        ' Active Ageing Centre (AAC) ': {
            fillColor: '#123abc',
            ringColor: '#FEDCBA',
        },
        Unsafe: {
            fillColor: 'red',
            ringColor: 'url(javascript:alert(1))',
        },
    }), {
        'active ageing centre (aac)': {
            fillColor: '#123ABC',
            ringColor: '#FEDCBA',
        },
    });
});

test('category pin numbers stay readable on very light and very dark custom fills', () => {
    assert.equal(getCategoryPinLabelColor('#FFFFFF'), '#0F172A');
    assert.equal(getCategoryPinLabelColor('#FEF08A'), '#0F172A');
    assert.equal(getCategoryPinLabelColor('#0F172A'), '#FFFFFF');
    assert.equal(getCategoryPinLabelColor('#0F766E'), '#FFFFFF');
});

test('category pin styles preserve today\'s category fill and white ring defaults', () => {
    assert.deepEqual(getCategoryPinStyle({}, 'AAC', '#ef4444'), {
        fillColor: '#EF4444',
        ringColor: '#FFFFFF',
    });
});
