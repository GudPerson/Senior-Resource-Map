import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnnotationMessages, getAnnotationUploadError } from '../src/lib/annotationMessages.js';

test('new image and linking controls have matching messages in all four app languages', () => {
    const english = getAnnotationMessages('en');
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        const messages = getAnnotationMessages(locale);
        assert.deepEqual(Object.keys(messages).sort(), Object.keys(english).sort());
        assert.ok(Object.values(messages).every(value => typeof value === 'string' && value.trim()));
        assert.equal(getAnnotationUploadError({ code: 'map_media_quota_exceeded' }, locale), messages.imageQuotaExceeded);
        assert.equal(getAnnotationUploadError({ code: 'map_media_invalid' }, locale), messages.imageInvalid);
        assert.equal(getAnnotationUploadError({ code: 'map_media_unavailable' }, locale), messages.imageUnavailable);
        assert.equal(getAnnotationUploadError({ code: 'map_media_conflict' }, locale), messages.imageConflict);
        assert.equal(getAnnotationUploadError({ code: 'map_media_access_denied' }, locale), messages.imageAccessDenied);
        assert.equal(getAnnotationUploadError({ message: 'Unreviewed API details' }, locale), messages.imageUploadFailed);
        assert.equal(getAnnotationUploadError(null, locale), messages.imageUploadFailed);
        if (locale !== 'en') assert.notEqual(messages.imageUploadFailed, english.imageUploadFailed);
    }
});
