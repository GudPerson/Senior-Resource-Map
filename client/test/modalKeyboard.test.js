import test from 'node:test';
import assert from 'node:assert/strict';

import { handleModalKeyboardEvent } from '../src/lib/modalKeyboard.js';

function createFocusable(name) {
    return {
        name,
        hidden: false,
        focused: false,
        getAttribute: () => null,
        focus() {
            this.focused = true;
        },
    };
}

function createDialog(activeElement) {
    const first = createFocusable('first');
    const last = createFocusable('last');
    const elements = [first, last];

    return {
        first,
        last,
        dialog: {
            ownerDocument: { activeElement: activeElement === 'last' ? last : first },
            querySelectorAll: () => elements,
            contains: (element) => elements.includes(element),
        },
    };
}

test('Shift+Tab wraps from the first modal control to the last', () => {
    const { dialog, last } = createDialog('first');
    let prevented = false;

    const handled = handleModalKeyboardEvent({
        key: 'Tab',
        shiftKey: true,
        currentTarget: dialog,
        preventDefault: () => { prevented = true; },
    });

    assert.equal(handled, true);
    assert.equal(prevented, true);
    assert.equal(last.focused, true);
});

test('Tab wraps from the last modal control to the first', () => {
    const { dialog, first } = createDialog('last');

    const handled = handleModalKeyboardEvent({
        key: 'Tab',
        shiftKey: false,
        currentTarget: dialog,
        preventDefault() {},
    });

    assert.equal(handled, true);
    assert.equal(first.focused, true);
});

test('Escape closes an enabled modal', () => {
    let closed = false;
    let prevented = false;

    const handled = handleModalKeyboardEvent({
        key: 'Escape',
        preventDefault: () => { prevented = true; },
    }, {
        onEscape: () => { closed = true; },
    });

    assert.equal(handled, true);
    assert.equal(prevented, true);
    assert.equal(closed, true);
});

test('Escape remains inert while modal submission disables closing', () => {
    let prevented = false;

    const handled = handleModalKeyboardEvent({
        key: 'Escape',
        preventDefault: () => { prevented = true; },
    }, { onEscape: null });

    assert.equal(handled, false);
    assert.equal(prevented, false);
});
