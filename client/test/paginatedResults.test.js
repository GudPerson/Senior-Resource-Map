import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_RESOURCE_PAGE_TIMEOUT_MS,
    fetchAllPaginatedResults,
} from '../src/lib/paginatedResults.js';

test('resource page timeout allows slow production pages to complete', () => {
    assert.ok(DEFAULT_RESOURCE_PAGE_TIMEOUT_MS >= 30000);
});

test('fetchAllPaginatedResults collects a slow later page before timing out', async () => {
    const calls = [];
    const fetchPage = async ({ page, pageSize }) => {
        calls.push(page);
        if (page === 2) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        return {
            data: [{ id: page }],
            pagination: {
                page,
                pageSize,
                totalCount: 2,
                totalPages: 2,
            },
        };
    };

    const result = await fetchAllPaginatedResults(fetchPage, {}, {
        pageSize: 1,
        pageTimeoutMs: 50,
        waitMs: async () => {},
    });

    assert.deepEqual(calls, [1, 2]);
    assert.deepEqual(result.map((item) => item.id), [1, 2]);
});
