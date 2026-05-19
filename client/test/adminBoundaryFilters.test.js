import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildBoundaryStatusFilterOptions,
    normalizeBoundaryStatusFilterValue,
} from '../src/lib/adminBoundaryFilters.js';

test('buildBoundaryStatusFilterOptions only includes statuses present in current rows', () => {
    const options = buildBoundaryStatusFilterOptions([
        { boundaryStatus: 'inside' },
        { boundaryStatus: 'inside' },
        { boundaryStatus: 'missing-postal' },
    ]);

    assert.deepEqual(options, [
        { value: 'all', label: 'All boundary status' },
        { value: 'inside', label: 'Inside boundary' },
        { value: 'missing-postal', label: 'Missing postal code' },
    ]);
});

test('buildBoundaryStatusFilterOptions ignores unsupported or blank statuses', () => {
    const options = buildBoundaryStatusFilterOptions([
        { boundaryStatus: 'inside' },
        { boundaryStatus: 'legacy-status' },
        { boundaryStatus: '' },
        {},
    ]);

    assert.deepEqual(options, [
        { value: 'all', label: 'All boundary status' },
        { value: 'inside', label: 'Inside boundary' },
    ]);
});

test('normalizeBoundaryStatusFilterValue resets stale selections to all', () => {
    const options = buildBoundaryStatusFilterOptions([{ boundaryStatus: 'inside' }]);

    assert.equal(normalizeBoundaryStatusFilterValue('outside', options), 'all');
    assert.equal(normalizeBoundaryStatusFilterValue('inside', options), 'inside');
});
