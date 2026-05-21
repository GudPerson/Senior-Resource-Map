import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildResourceShareUrl,
    shareResourceLink,
} from '../src/lib/resourceShare.js';

test('buildResourceShareUrl builds public resource links only', () => {
    assert.equal(
        buildResourceShareUrl('hard', 12, 'https://app.carearound.sg'),
        'https://app.carearound.sg/resource/hard/12',
    );
    assert.equal(
        buildResourceShareUrl('soft', '34', 'https://app.carearound.sg/'),
        'https://app.carearound.sg/resource/soft/34',
    );
});

test('shareResourceLink uses native share first and falls back to clipboard', async () => {
    const nativeCalls = [];
    const nativeResult = await shareResourceLink({
        type: 'hard',
        id: 12,
        title: 'Care Hub',
        origin: 'https://app.carearound.sg',
        navigatorApi: {
            share: async (payload) => nativeCalls.push(payload),
        },
    });

    assert.equal(nativeResult.mode, 'native');
    assert.equal(nativeCalls[0].url, 'https://app.carearound.sg/resource/hard/12');

    let copied = '';
    const clipboardResult = await shareResourceLink({
        type: 'soft',
        id: 34,
        title: 'Line Dance',
        origin: 'https://app.carearound.sg',
        navigatorApi: {
            clipboard: {
                writeText: async (value) => {
                    copied = value;
                },
            },
        },
    });

    assert.equal(clipboardResult.mode, 'clipboard');
    assert.equal(copied, 'https://app.carearound.sg/resource/soft/34');
});
