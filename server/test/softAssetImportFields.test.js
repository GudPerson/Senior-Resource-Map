import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeImportedSoftAssetName,
    normalizeImportedSoftAssetPhone,
    normalizeImportedSoftAssetShortText,
    normalizeImportedSoftAssetSubCategory,
    normalizeImportedSoftAssetTags,
} from '../src/utils/softAssetImportFields.js';

test('imported soft asset fields stay within database-backed lengths', () => {
    assert.equal(normalizeImportedSoftAssetName(` ${'A'.repeat(300)} `).length, 255);
    assert.equal(normalizeImportedSoftAssetPhone(` ${'8'.repeat(80)} `).length, 50);
    assert.equal(normalizeImportedSoftAssetShortText(` ${'Register '.repeat(40)} `).length, 255);
});

test('imported long sub-category suggestions fall back to the bucket', () => {
    assert.equal(
        normalizeImportedSoftAssetSubCategory('Intro to Conversational English I-no classes 1/12/15', 'Programmes'),
        'Programmes',
    );
    assert.equal(normalizeImportedSoftAssetSubCategory('Senior Activities', 'Programmes'), 'Senior Activities');
    assert.equal(normalizeImportedSoftAssetSubCategory('', 'Services'), 'Services');
});

test('imported tags are deduplicated and kept within the database tag limit', () => {
    const tags = normalizeImportedSoftAssetTags([
        'Senior Activities',
        'senior activities',
        ` ${'A'.repeat(140)} `,
        '',
    ]);

    assert.deepEqual(tags, [
        'senior activities',
        'a'.repeat(100),
    ]);
});
