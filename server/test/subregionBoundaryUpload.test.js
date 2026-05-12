import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeSubregionBoundaryUploadMode,
} from '../src/utils/subregionBoundaryUpload.js';

test('subregion boundary upload defaults to append to avoid destructive replacement', () => {
    assert.equal(normalizeSubregionBoundaryUploadMode(undefined), 'append');
    assert.equal(normalizeSubregionBoundaryUploadMode(null), 'append');
    assert.equal(normalizeSubregionBoundaryUploadMode(''), 'append');
});

test('subregion boundary upload accepts explicit append or replace modes only', () => {
    assert.equal(normalizeSubregionBoundaryUploadMode('append'), 'append');
    assert.equal(normalizeSubregionBoundaryUploadMode('replace'), 'replace');
    assert.equal(normalizeSubregionBoundaryUploadMode('merge'), 'append');
    assert.equal(normalizeSubregionBoundaryUploadMode('delete'), 'append');
});
