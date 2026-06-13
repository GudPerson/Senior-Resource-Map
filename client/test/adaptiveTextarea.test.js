import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT,
    MAP_NOTE_TEXTAREA_MIN_HEIGHT,
    resizeTextareaToContent,
} from '../src/lib/adaptiveTextarea.js';

function textarea(scrollHeight) {
    return {
        scrollHeight,
        style: {
            height: '96px',
            overflowY: 'auto',
        },
    };
}

test('resizeTextareaToContent grows a textarea to its wrapped content height', () => {
    const element = textarea(188);

    const result = resizeTextareaToContent(element);

    assert.deepEqual(result, {
        height: '188px',
        overflowY: 'hidden',
    });
    assert.equal(element.style.height, '188px');
    assert.equal(element.style.overflowY, 'hidden');
});

test('resizeTextareaToContent keeps short notes at the map note minimum height', () => {
    const element = textarea(40);

    const result = resizeTextareaToContent(element);

    assert.equal(result.height, `${MAP_NOTE_TEXTAREA_MIN_HEIGHT}px`);
    assert.equal(element.style.height, `${MAP_NOTE_TEXTAREA_MIN_HEIGHT}px`);
    assert.equal(element.style.overflowY, 'hidden');
});

test('resizeTextareaToContent only shows an inner scrollbar when a max height is supplied', () => {
    const element = textarea(420);

    const result = resizeTextareaToContent(element, { maxHeight: 240 });

    assert.deepEqual(result, {
        height: '240px',
        overflowY: 'auto',
    });
});

test('map note focused textarea cap leaves enough room for mobile notes controls', () => {
    assert.equal(MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT, 260);
});
