import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_RESOURCE_PAGE_TIMEOUT_MS,
    fetchAllPaginatedResults,
    fetchPaginatedResultPage,
    fetchPaginatedResultsPartial,
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

test('fetchAllPaginatedResults limits concurrent page fetches', async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;

    const fetchPage = async ({ page, pageSize }) => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeRequests -= 1;

        return {
            data: [{ id: page }],
            pagination: {
                page,
                pageSize,
                totalCount: 5,
                totalPages: 5,
            },
        };
    };

    const result = await fetchAllPaginatedResults(fetchPage, {}, {
        pageSize: 1,
        pageTimeoutMs: 100,
        maxConcurrentPages: 2,
        waitMs: async () => {},
    });

    assert.equal(maxActiveRequests, 2);
    assert.deepEqual(result.map((item) => item.id), [1, 2, 3, 4, 5]);
});

test('fetchPaginatedResultsPartial keeps loaded pages when a later page fails', async () => {
    const fetchPage = async ({ page, pageSize }) => {
        if (page === 3) {
            throw new Error('temporary page failure');
        }

        return {
            data: [{ id: page }],
            pagination: {
                page,
                pageSize,
                totalCount: 4,
                totalPages: 4,
            },
        };
    };

    const result = await fetchPaginatedResultsPartial(fetchPage, {}, {
        pageSize: 1,
        maxAttempts: 1,
        pageTimeoutMs: 100,
        maxConcurrentPages: 2,
        waitMs: async () => {},
    });

    assert.equal(result.pagination.isPartial, true);
    assert.deepEqual(result.pagination.failedPages, [3]);
    assert.deepEqual(result.data.map((item) => item.id), [1, 2, 4]);
});

test('timed-out resource pages abort once without multiplying retries', async () => {
    let attempts = 0;
    let aborts = 0;

    await assert.rejects(
        () => fetchPaginatedResultPage((_params, options = {}) => {
            attempts += 1;
            return new Promise((resolve, reject) => {
                options.signal?.addEventListener('abort', () => {
                    aborts += 1;
                    const error = new Error('Aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            });
        }, {}, {
            maxAttempts: 3,
            pageTimeoutMs: 10,
            waitMs: async () => {},
        }),
        (error) => error?.code === 'RESOURCE_PAGE_TIMEOUT',
    );

    assert.equal(attempts, 1);
    assert.equal(aborts, 1);
});
