import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRegenerationMessage } from '../src/lib/translationReview.js';

const targetLocales = [
    { locale: 'zh-CN', label: 'Mandarin' },
    { locale: 'ms', label: 'Malay' },
    { locale: 'ta', label: 'Tamil' },
];

test('buildRegenerationMessage summarizes all-language auto-fill results', () => {
    const message = buildRegenerationMessage({
        targetLocales,
        requestedLocales: ['zh-CN', 'ms', 'ta'],
        translationStatus: {
            status: 'ok',
            translatedFields: ['zh-CN:name', 'zh-CN:description', 'ta:description'],
            staleFields: ['ms:description'],
        },
    });

    assert.equal(
        message,
        'Updated Mandarin and Tamil. Malay has reviewed wording to check because English changed. Please review the wording before relying on it.',
    );
});

test('buildRegenerationMessage explains when selected languages are already current', () => {
    const message = buildRegenerationMessage({
        targetLocales,
        requestedLocales: ['zh-CN', 'ms', 'ta'],
        translationStatus: {
            status: 'ok',
            translatedFields: [],
            staleFields: [],
        },
    });

    assert.equal(
        message,
        'All selected languages already had current auto text. Please review the wording before relying on it.',
    );
});
