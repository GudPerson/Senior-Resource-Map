import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldUseFullResourceDataset } from '../src/lib/resourceListLoading.js';

test('shouldUseFullResourceDataset keeps default manage-resource loads paginated', () => {
    assert.equal(shouldUseFullResourceDataset({
        query: '',
        boundaryChecksEnabled: true,
        boundaryFilter: 'all',
    }), false);

    assert.equal(shouldUseFullResourceDataset({
        query: '',
        boundaryChecksEnabled: false,
        boundaryFilter: 'all',
    }), false);
});

test('shouldUseFullResourceDataset uses full data only for client-only filters', () => {
    assert.equal(shouldUseFullResourceDataset({
        query: 'teck whye',
        boundaryChecksEnabled: true,
        boundaryFilter: 'all',
    }), true);

    assert.equal(shouldUseFullResourceDataset({
        query: '',
        boundaryChecksEnabled: true,
        boundaryFilter: 'inside',
    }), true);

    assert.equal(shouldUseFullResourceDataset({
        query: '',
        boundaryChecksEnabled: false,
        boundaryFilter: 'inside',
    }), false);
});
