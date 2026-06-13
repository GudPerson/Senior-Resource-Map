import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPdfMarkdownLines,
} from '../src/lib/myMapPdfMarkdown.js';

test('buildPdfMarkdownLines keeps bold markdown as a PDF line style', () => {
    assert.deepEqual(
        buildPdfMarkdownLines('**APT 2.0 Meeting Notes**'),
        [
            {
                text: 'APT 2.0 Meeting Notes',
                fontStyle: 'bold',
                hasLink: false,
            },
        ],
    );
});

test('buildPdfMarkdownLines keeps list markers while stripping helper syntax', () => {
    assert.deepEqual(
        buildPdfMarkdownLines('- Bring *referral letter*\n1. Call **centre lead**'),
        [
            {
                text: '- Bring referral letter',
                fontStyle: 'italic',
                hasLink: false,
            },
            {
                text: '1. Call centre lead',
                fontStyle: 'bold',
                hasLink: false,
            },
        ],
    );
});

test('buildPdfMarkdownLines renders markdown links as readable PDF text', () => {
    assert.deepEqual(
        buildPdfMarkdownLines('[Website](https://example.com/aac)'),
        [
            {
                text: 'Website (https://example.com/aac)',
                fontStyle: 'normal',
                hasLink: true,
            },
        ],
    );
});

test('buildPdfMarkdownLines marks repeated link lines consistently', () => {
    assert.deepEqual(
        buildPdfMarkdownLines('[One](https://example.com/one)\n[Two](https://example.com/two)'),
        [
            {
                text: 'One (https://example.com/one)',
                fontStyle: 'normal',
                hasLink: true,
            },
            {
                text: 'Two (https://example.com/two)',
                fontStyle: 'normal',
                hasLink: true,
            },
        ],
    );
});
