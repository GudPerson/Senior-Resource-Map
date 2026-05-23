import test from 'node:test';
import assert from 'node:assert/strict';

import {
    allocateUniqueSoftAssetExternalKeys,
    buildImportRowFailureResult,
} from '../src/utils/softAssetImportCommit.js';

test('allocates unique external keys for bulk-created import rows', () => {
    const keys = allocateUniqueSoftAssetExternalKeys(
        [
            { payload: { name: 'Chair Yoga' } },
            { payload: { name: 'Chair Yoga' } },
            { payload: { name: 'Line Dance' } },
        ],
        new Set(['offering-chair-yoga']),
    );

    assert.deepEqual(keys, [
        'offering-chair-yoga-2',
        'offering-chair-yoga-3',
        'offering-line-dance',
    ]);
});

test('row failure results include the reviewed row name for import reports', () => {
    const result = buildImportRowFailureResult(
        { id: 'draft-9', name: 'Movie Matinee' },
        'draft-9',
        new Error('Too many subrequests.'),
    );

    assert.deepEqual(result, {
        id: 'draft-9',
        status: 'failed',
        name: 'Movie Matinee',
        error: 'Too many subrequests.',
    });
});
