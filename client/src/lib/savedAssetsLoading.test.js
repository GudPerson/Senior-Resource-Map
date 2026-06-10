import test from 'node:test';
import assert from 'node:assert/strict';

import {
    loadSavedAssetsWithRetry,
    SAVED_ASSETS_LOAD_ATTEMPTS,
} from './savedAssetsLoading.js';

test('saved assets load retries a transient failure before returning items', async () => {
    const calls = [];
    const result = await loadSavedAssetsWithRetry(async () => {
        calls.push('call');
        if (calls.length === 1) {
            throw new Error('temporary API failure');
        }
        return [{ resourceType: 'hard', resourceId: 42 }];
    }, {
        sleepImpl: async () => {},
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(result, [{ resourceType: 'hard', resourceId: 42 }]);
});

test('saved assets load normalizes unexpected responses to an empty list', async () => {
    const result = await loadSavedAssetsWithRetry(async () => ({ items: [] }), {
        sleepImpl: async () => {},
    });

    assert.deepEqual(result, []);
});

test('saved assets load gives up after the configured attempts', async () => {
    let calls = 0;

    await assert.rejects(
        loadSavedAssetsWithRetry(async () => {
            calls += 1;
            throw new Error('still unavailable');
        }, {
            sleepImpl: async () => {},
        }),
        /still unavailable/
    );

    assert.equal(calls, SAVED_ASSETS_LOAD_ATTEMPTS);
});
