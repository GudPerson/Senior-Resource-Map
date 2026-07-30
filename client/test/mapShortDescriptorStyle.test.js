import assert from 'node:assert/strict';
import test from 'node:test';

import {
    MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR,
    getMapShortDescriptorPrintStyle,
    normalizeMapShortDescriptorColor,
    normalizeMapShortDescriptorItems,
} from '../src/lib/mapShortDescriptorStyle.js';

test('short descriptor colours normalize valid hex values and reject invalid input', () => {
    assert.equal(normalizeMapShortDescriptorColor('#0f766e'), '#0F766E');
    assert.equal(normalizeMapShortDescriptorColor('not-a-colour', null), null);
});

test('print descriptors retain the existing slate colour when no formatting is saved', () => {
    assert.deepEqual(getMapShortDescriptorPrintStyle({}), {
        color: MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR,
    });
});

test('print descriptors apply owner-selected text and highlight colours', () => {
    assert.deepEqual(getMapShortDescriptorPrintStyle({
        textColor: '#1d4ed8',
        highlightColor: '#fef3c7',
    }), {
        color: '#1D4ED8',
        backgroundColor: '#FEF3C7',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
    });
});

test('short descriptor lists retain independent formatting and legacy fallback support', () => {
    assert.deepEqual(normalizeMapShortDescriptorItems({
        mapShortDescriptors: [
            {
                id: 8,
                text: 'Second in storage',
                textColor: '#1d4ed8',
                highlightColor: '#dbeafe',
                sortOrder: 1,
            },
            {
                id: 7,
                text: 'First in print',
                textColor: '#0f766e',
                highlightColor: '#fef3c7',
                sortOrder: 0,
            },
        ],
    }).map(({ text, textColor, highlightColor }) => ({
        text,
        textColor,
        highlightColor,
    })), [
        {
            text: 'First in print',
            textColor: '#0F766E',
            highlightColor: '#FEF3C7',
        },
        {
            text: 'Second in storage',
            textColor: '#1D4ED8',
            highlightColor: '#DBEAFE',
        },
    ]);

    assert.deepEqual(normalizeMapShortDescriptorItems({
        mapShortDescriptor: 'Legacy description',
        mapShortDescriptorTextColor: '#334155',
    }).map(({ text, textColor }) => ({ text, textColor })), [{
        text: 'Legacy description',
        textColor: '#334155',
    }]);
});
