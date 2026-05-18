import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createEmptySocialLinks,
    getSocialLinkEntries,
    mergeSocialLinks,
    normalizeSocialLinks,
} from '../src/lib/socialLinks.js';

test('normalizeSocialLinks keeps only supported social URLs with protocols', () => {
    assert.deepEqual(normalizeSocialLinks({
        facebook: 'facebook.com/carearound',
        instagram: 'https://instagram.com/carearound.sg',
        unknown: 'https://example.com/not-supported',
    }), {
        facebook: 'https://facebook.com/carearound',
        instagram: 'https://instagram.com/carearound.sg',
        tiktok: '',
        youtube: '',
        linkedin: '',
    });
});

test('getSocialLinkEntries returns display-ready social links in platform order', () => {
    assert.deepEqual(getSocialLinkEntries({
        youtube: 'youtube.com/@carearound',
        facebook: 'https://facebook.com/carearound',
    }), [
        {
            key: 'facebook',
            label: 'Facebook',
            placeholder: 'https://facebook.com/your-page',
            url: 'https://facebook.com/carearound',
        },
        {
            key: 'youtube',
            label: 'YouTube',
            placeholder: 'https://youtube.com/@your-channel',
            url: 'https://youtube.com/@carearound',
        },
    ]);
});

test('mergeSocialLinks preserves the first valid link for each platform', () => {
    assert.deepEqual(mergeSocialLinks(
        { facebook: 'https://facebook.com/first' },
        { facebook: 'https://facebook.com/second', instagram: 'instagram.com/carearound' },
    ), {
        ...createEmptySocialLinks(),
        facebook: 'https://facebook.com/first',
        instagram: 'https://instagram.com/carearound',
    });
});
