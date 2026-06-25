import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildGroupMemberCandidateListParams,
    buildManagedHardResourceListParams,
    buildManagedResourceListParams,
    buildManagedSoftResourceListParams,
    fetchResourceListPageWithResilience,
    RESOURCE_LIST_SEARCH_DEBOUNCE_MS,
    settleResourceListRequest,
    shouldHydrateAllAdminResourcePages,
    shouldUseFullResourceDataset,
    withResourceListSearchParam,
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
    }), false);

    assert.equal(shouldUseFullResourceDataset({
        query: 'health, exercise',
        boundaryChecksEnabled: true,
        boundaryFilter: 'all',
    }), true);

    assert.equal(shouldUseFullResourceDataset({
        query: 'health / exercise',
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

test('buildManagedResourceListParams scopes admin management lists to their region', () => {
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

test('buildManagedSoftResourceListParams requests lean summaries for managed soft asset lists', () => {
    assert.deepEqual(buildManagedSoftResourceListParams({
        canManageResourceTools: true,
        role: 'regional_admin',
    }), { scope: 'managed', regionScoped: true, summary: true });

    assert.deepEqual(buildManagedSoftResourceListParams({
        canManageResourceTools: true,
        role: 'super_admin',
    }), { scope: 'managed', summary: true });

    assert.deepEqual(buildManagedSoftResourceListParams({
        canManageResourceTools: false,
        role: 'regional_admin',
    }), {});
});

test('buildGroupMemberCandidateListParams keeps Group member search on public candidates', () => {
    assert.deepEqual(buildGroupMemberCandidateListParams({ assetType: 'hard' }), { summary: true });
    assert.deepEqual(buildGroupMemberCandidateListParams({ assetType: 'soft' }), {});
    assert.deepEqual(buildGroupMemberCandidateListParams({ assetType: 'hard' }).scope, undefined);
    assert.deepEqual(buildGroupMemberCandidateListParams({ assetType: 'soft' }).scope, undefined);
});

test('resource list search debounce has a bounded demo-friendly delay', () => {
    assert.equal(RESOURCE_LIST_SEARCH_DEBOUNCE_MS, 350);
});

test('admin resource loads do not eagerly hydrate every resource page', () => {
    assert.equal(shouldHydrateAllAdminResourcePages({ role: 'regional_admin' }), false);
    assert.equal(shouldHydrateAllAdminResourcePages({ role: 'super_admin' }), true);
    assert.equal(shouldHydrateAllAdminResourcePages({ role: 'standard' }), true);
});

test('withResourceListSearchParam scopes full dataset loads to the active search query', () => {
    assert.deepEqual(withResourceListSearchParam({
        scope: 'managed',
        summary: true,
    }, ' frcs '), {
        scope: 'managed',
        summary: true,
        q: 'frcs',
    });

    assert.deepEqual(withResourceListSearchParam({
        scope: 'managed',
        regionScoped: true,
    }, ''), {
        scope: 'managed',
        regionScoped: true,
    });
});

test('fetchResourceListPageWithResilience retries a transient first-page failure', async () => {
    let attempts = 0;
    const result = await fetchResourceListPageWithResilience(async ({ page, pageSize }) => {
        attempts += 1;
        if (attempts === 1) {
            throw new Error('temporary production resource page failure');
        }

        return {
            data: [{ id: 18161, name: 'FRCS Active Ageing Centre' }],
            pagination: {
                page,
                pageSize,
                totalCount: 1,
                totalPages: 1,
            },
        };
    }, { scope: 'managed' }, {
        page: 1,
        pageSize: 50,
        pageTimeoutMs: 100,
        waitMs: async () => {},
    });

    assert.equal(attempts, 2);
    assert.equal(result.pagination.totalCount, 1);
    assert.deepEqual(result.data.map((asset) => asset.name), ['FRCS Active Ageing Centre']);
});

test('settleResourceListRequest keeps one failed resource family from throwing the whole load', async () => {
    const okResult = await settleResourceListRequest(Promise.resolve({ data: [{ id: 1 }] }));
    const failedResult = await settleResourceListRequest(Promise.reject(new Error('temporary offerings failure')));

    assert.equal(okResult.status, 'fulfilled');
    assert.deepEqual(okResult.value.data, [{ id: 1 }]);
    assert.equal(failedResult.status, 'rejected');
    assert.match(failedResult.reason.message, /temporary offerings failure/);
});
