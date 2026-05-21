import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeMarkdownLiteInput,
    stripMarkdownLite,
    toPlainTextPreview,
} from '../src/lib/markdownLite.js';

test('normalizeMarkdownLiteInput removes simple HTML headings without losing the text', () => {
    assert.equal(
        normalizeMarkdownLiteInput('<h2>We are an organization that supports seniors</h2>'),
        'We are an organization that supports seniors'
    );
});

test('stripMarkdownLite removes HTML tags from search and preview text', () => {
    assert.equal(
        toPlainTextPreview('<h2>Care services</h2><p>Friendly support.</p>'),
        'Care services Friendly support.'
    );

    assert.equal(
        stripMarkdownLite('<strong>Open weekdays</strong>'),
        'Open weekdays'
    );
});

test('normalizeMarkdownLiteInput leaves malformed numeric entities safe', () => {
    assert.equal(
        normalizeMarkdownLiteInput('Care &#999999999999; support'),
        'Care &#999999999999; support'
    );
});
