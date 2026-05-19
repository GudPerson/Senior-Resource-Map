import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildManagedHardResourceListParams,
    buildManagedResourceListParams,
    shouldUseFullResourceDataset,
} from '../src/lib/resourceListLoading.js';

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

test('buildManagedResourceListParams scopes region admin management lists to their region', () => {
    assert.deepEqual(buildManagedResourceListParams({
        canManageResourceTools: true,
        role: 'regional_admin',
    }), { scope: 'managed', regionScoped: true });

    assert.deepEqual(buildManagedResourceListParams({
        canManageResourceTools: true,
        role: 'super_admin',
    }), { scope: 'managed' });

    assert.deepEqual(buildManagedResourceListParams({
        canManageResourceTools: false,
        role: 'regional_admin',
    }), {});
});

test('buildManagedHardResourceListParams requests lean summaries for managed hard asset lists', () => {
    assert.deepEqual(buildManagedHardResourceListParams({
        canManageResourceTools: true,
        role: 'regional_admin',
    }), { scope: 'managed', regionScoped: true, summary: true });

    assert.deepEqual(buildManagedHardResourceListParams({
        canManageResourceTools: true,
        role: 'super_admin',
    }), { scope: 'managed', summary: true });

    assert.deepEqual(buildManagedHardResourceListParams({
        canManageResourceTools: false,
        role: 'regional_admin',
    }), {});
});
