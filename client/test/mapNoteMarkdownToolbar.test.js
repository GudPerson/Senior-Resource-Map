import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMapNoteMarkdownAction } from '../src/lib/mapNoteMarkdownToolbar.js';

test('applyMapNoteMarkdownAction wraps selected text in bold markers', () => {
    const result = applyMapNoteMarkdownAction({
        value: 'Call before referral',
        selectionStart: 0,
        selectionEnd: 4,
        action: 'bold',
    });

    assert.deepEqual(result, {
        value: '**Call** before referral',
        selectionStart: 2,
        selectionEnd: 6,
    });
});

test('applyMapNoteMarkdownAction inserts italic placeholder when no text is selected', () => {
    const result = applyMapNoteMarkdownAction({
        value: 'Bring ',
        selectionStart: 6,
        selectionEnd: 6,
        action: 'italic',
    });

    assert.deepEqual(result, {
        value: 'Bring *note*',
        selectionStart: 7,
        selectionEnd: 11,
    });
});

test('applyMapNoteMarkdownAction converts selected lines into bullet list items', () => {
    const result = applyMapNoteMarkdownAction({
        value: 'Call intake\nBring referral letter',
        selectionStart: 0,
        selectionEnd: 'Call intake\nBring referral letter'.length,
        action: 'bullet-list',
    });

    assert.deepEqual(result, {
        value: '- Call intake\n- Bring referral letter',
        selectionStart: 0,
        selectionEnd: '- Call intake\n- Bring referral letter'.length,
    });
});

test('applyMapNoteMarkdownAction converts selected lines into numbered list items', () => {
    const result = applyMapNoteMarkdownAction({
        value: 'Call intake\nBring referral letter',
        selectionStart: 0,
        selectionEnd: 'Call intake\nBring referral letter'.length,
        action: 'numbered-list',
    });

    assert.deepEqual(result, {
        value: '1. Call intake\n2. Bring referral letter',
        selectionStart: 0,
        selectionEnd: '1. Call intake\n2. Bring referral letter'.length,
    });
});

test('applyMapNoteMarkdownAction formats selected text as a markdown link', () => {
    const result = applyMapNoteMarkdownAction({
        value: 'See referral form',
        selectionStart: 4,
        selectionEnd: 17,
        action: 'link',
    });

    assert.deepEqual(result, {
        value: 'See [referral form](https://)',
        selectionStart: 20,
        selectionEnd: 28,
    });
});
