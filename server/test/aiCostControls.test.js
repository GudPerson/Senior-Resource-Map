import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertAiImportAllowed,
    getCachedAiResult,
    setCachedAiResult,
} from '../src/utils/aiCostControls.js';

function createFakeKv() {
    const writes = [];
    const store = new Map();
    return {
        writes,
        async get(key) {
            return store.get(key) || null;
        },
        async put(key, value, options = {}) {
            writes.push({ key, value, options });
            store.set(key, value);
        },
    };
}

test('AI cache uses Worker KV when MAP_CACHE is available', async () => {
    const kv = createFakeKv();
    const env = {
        MAP_CACHE: kv,
        AI_CACHE_TTL_HOURS: '2',
    };
    const payload = {
        name: 'Precious Active Ageing Centre',
        postalCode: '681488',
    };

    assert.equal(await getCachedAiResult(env, 'test-cache', payload), null);

    await setCachedAiResult(env, 'test-cache', payload, { ok: true });
    const cached = await getCachedAiResult(env, 'test-cache', payload);

    assert.deepEqual(cached, { ok: true });
    assert.equal(kv.writes.length, 1);
    assert.match(kv.writes[0].key, /^ai-cost-control:cache:test-cache:/);
    assert.equal(kv.writes[0].options.expirationTtl, 7200);
});
test('AI daily quota uses Worker KV when MAP_CACHE is available', async () => {
    const kv = createFakeKv();
    const env = {
        MAP_CACHE: kv,
        AI_IMPORT_DAILY_LIMIT: '1',
    };

    await assertAiImportAllowed(env);
    await assert.rejects(
        () => assertAiImportAllowed(env),
        /daily quota reached/,
    );

    assert.equal(kv.writes.length, 1);
    assert.match(kv.writes[0].key, /^ai-cost-control:counter:/);
    assert.equal(kv.writes[0].value, '1');
});
