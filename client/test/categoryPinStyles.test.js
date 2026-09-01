import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getCategoryPinLabelColor,
    getCategoryPinLabelColorOverride,
    getCategoryPinRingStrokeWidth,
    getCategoryPinStyle,
    normalizeCategoryPinStyles,
} from '../src/lib/categoryPinStyles.js';

test('category pin styles normalize keys and accept only six-digit hex colours', () => {
    assert.deepEqual(normalizeCategoryPinStyles({
        ' Active Ageing Centre (AAC) ': {
            fillColor: '#123abc',
            ringColor: '#FEDCBA',
            labelColor: '#0f172a',
        },
        Unsafe: {
            fillColor: '#123456',
            ringColor: '#FFFFFF',
            labelColor: 'url(javascript:alert(1))',
        },
    }), {
        'active ageing centre (aac)': {
            fillColor: '#123ABC',
            ringColor: '#FEDCBA',
            ringWeight: 'thin',
            labelColor: '#0F172A',
        },
        unsafe: {
            fillColor: '#123456',
            ringColor: '#FFFFFF',
            ringWeight: 'thin',
        },
    });
});

test('category pin numbers stay readable on very light and very dark custom fills', () => {
    assert.equal(getCategoryPinLabelColor('#FFFFFF'), '#0F172A');
    assert.equal(getCategoryPinLabelColor('#FEF08A'), '#0F172A');
    assert.equal(getCategoryPinLabelColor('#0F172A'), '#FFFFFF');
    assert.equal(getCategoryPinLabelColor('#0F766E'), '#FFFFFF');
    assert.equal(getCategoryPinLabelColor('#3B82F6'), '#FFFFFF');
});

test('category pin styles preserve today\'s category fill and white ring defaults', () => {
    assert.deepEqual(getCategoryPinStyle({}, 'AAC', '#ef4444'), {
        fillColor: '#EF4444',
        ringColor: '#FFFFFF',
        ringWeight: 'thin',
        labelColor: '#FFFFFF',
    });
});

test('category pin styles use a safe manual number colour only when explicitly stored', () => {
    const styles = {
        aac: {
            fillColor: '#FFFFFF',
            ringColor: '#123456',
            labelColor: '#EF4444',
        },
    };

    assert.deepEqual(getCategoryPinStyle(styles, 'AAC'), {
        fillColor: '#FFFFFF',
        ringColor: '#123456',
        ringWeight: 'thin',
        labelColor: '#EF4444',
    });
    assert.equal(getCategoryPinLabelColorOverride(styles, 'AAC'), '#EF4444');
    assert.equal(getCategoryPinLabelColorOverride({}, 'AAC'), null);
});

test('category pin ring weights normalize to three bounded renderer widths', () => {
    assert.deepEqual(normalizeCategoryPinStyles({
        aac: { fillColor: '#123456', ringColor: '#FFFFFF', ringWeight: 'thick' },
        unsafe: { fillColor: '#654321', ringColor: '#FFFFFF', ringWeight: 'giant' },
    }), {
        aac: { fillColor: '#123456', ringColor: '#FFFFFF', ringWeight: 'thick' },
        unsafe: { fillColor: '#654321', ringColor: '#FFFFFF', ringWeight: 'thin' },
    });
    assert.equal(getCategoryPinRingStrokeWidth('thin'), 1);
    assert.equal(getCategoryPinRingStrokeWidth('medium'), 2);
    assert.equal(getCategoryPinRingStrokeWidth('thick'), 3);
});
