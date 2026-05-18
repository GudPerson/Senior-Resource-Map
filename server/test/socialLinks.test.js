import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createEmptySocialLinks,
    detectSocialPlatform,
    mergeSocialLinks,
    normalizeSocialLinks,
    splitWebsiteAndSocialLinks,
} from '../src/utils/socialLinks.js';

test('detectSocialPlatform recognises supported social domains', () => {
    assert.equal(detectSocialPlatform('https://m.facebook.com/carearound'), 'facebook');
    assert.equal(detectSocialPlatform('instagram.com/carearound.sg'), 'instagram');
    assert.equal(detectSocialPlatform('https://example.org'), '');
});

test('splitWebsiteAndSocialLinks separates direct social URLs from normal websites', () => {
    assert.deepEqual(splitWebsiteAndSocialLinks('https://www.facebook.com/carearound'), {
        website: '',
        socialLinks: {
            ...createEmptySocialLinks(),
            facebook: 'https://www.facebook.com/carearound',
        },
    });

    assert.deepEqual(splitWebsiteAndSocialLinks('carearound.sg'), {
        website: 'https://carearound.sg/',
        socialLinks: createEmptySocialLinks(),
    });
});

test('normalizeSocialLinks and mergeSocialLinks keep supported platforms only', () => {
    assert.deepEqual(normalizeSocialLinks({
        linkedin: 'linkedin.com/company/carearound',
        unsupported: 'https://example.com',
    }), {
        ...createEmptySocialLinks(),
        linkedin: 'https://linkedin.com/company/carearound',
    });

    assert.deepEqual(mergeSocialLinks(
        { youtube: 'youtube.com/@first' },
        { youtube: 'youtube.com/@second', tiktok: 'tiktok.com/@carearound' },
    ), {
        ...createEmptySocialLinks(),
        youtube: 'https://youtube.com/@first',
        tiktok: 'https://tiktok.com/@carearound',
    });
});
