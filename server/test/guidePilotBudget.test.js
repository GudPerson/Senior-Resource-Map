import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_PILOT, readGuidePilotBudget, reserveGuidePilotCall, guidePilotRuntime } from '../src/preview/guidePilotBudget.js';
import { GUIDE_AI_MODEL } from '../src/utils/guideAiRuntime.js';
const now = Date.parse('2026-10-01T15:00:00Z');
test.beforeEach((t) => t.mock.method(Date, 'now', () => now));
function storage(initial) {
    let value = initial, tail = Promise.resolve();
    const api = { get: async () => value, put: async (key, next) => { value = next; } };
    return { ...api, transaction(fn) {
        const result = tail.then(() => fn(api));
        tail = result.catch(() => {}); return result;
    } };
}
function runtime(overrides = {}) {
    let calls = 0, reserved = 0;
    const env = { ORACLE_PREVIEW_LLM_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
        GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: GUIDE_PILOT.gateway,
        GROUNDED_AI_ENABLED: 'false', GOVERNED_PILOT_RELEASE_STAGE: 'off',
        AI: { async run(model, body, opts) { assert.deepEqual(opts.gateway.retries, { maxAttempts: 1 }); calls++; return { response: 'fictional' }; } },
        GUIDE_PILOT_BUDGET: { getByName(id) { assert.equal(id, GUIDE_PILOT.id); return {
            async status() { return { remaining: 1 }; },
            async reserve() { reserved++; return { reserved: reserved <= 1 }; },
        }; } }, ...overrides };
    return { env, calls: () => calls, reserved: () => reserved };
}
const options = { gateway: { id: GUIDE_PILOT.gateway, skipCache: true, collectLog: false } };
const params = { messages: [{ role: 'user', content: 'fictional public question' }], max_tokens: 550, stream: false };
test('all concurrent attempts share the cumulative cap, and reopening storage retains it', async () => {
    const store = storage();
    const replies = await Promise.all(Array.from({ length: 100 }, () => reserveGuidePilotCall(store, now)));
    assert.equal(replies.filter(r => r.reserved).length, 41);
    assert.deepEqual(await readGuidePilotBudget(store, now), { used: 80, limit: 80, remaining: 0,
        expiresAt: GUIDE_PILOT.expiresAt, expired: false });
    assert.equal((await reserveGuidePilotCall(store, now)).reserved, false);
});
test('expiry, invalid state and storage failure reject new reservations', async () => {
    assert.equal((await reserveGuidePilotCall(storage(), Date.parse(GUIDE_PILOT.expiresAt))).reserved, false);
    for (const invalid of [0, 38, 81, '39', NaN])
        await assert.rejects(() => reserveGuidePilotCall(storage(invalid), now));
    await assert.rejects(() => reserveGuidePilotCall({ transaction: async () => { throw Error('offline'); } }, now));
});
test('the wrapper reserves before each native call, never refunds or retries', async () => {
    const subject = runtime(); const env = await guidePilotRuntime(subject.env);
    assert.equal(subject.reserved(), 0);
    await env.AI.run(GUIDE_AI_MODEL, params, options);
    await assert.rejects(() => env.AI.run(GUIDE_AI_MODEL, params, options));
    assert.equal(subject.calls(), 1); assert.equal(subject.reserved(), 2);
    const failed = runtime({ AI: { async run() { throw Error('provider failed'); } } });
    const badEnv = await guidePilotRuntime(failed.env);
    await assert.rejects(() => badEnv.AI.run(GUIDE_AI_MODEL, params, options));
    await assert.rejects(() => badEnv.AI.run(GUIDE_AI_MODEL, params, options));
    assert.equal(failed.reserved(), 2);
});
test('out of scope models, token limits, payloads and gateway overrides spend nothing', async () => {
    const subject = runtime(); const env = await guidePilotRuntime(subject.env);
    for (const [model, body, opts] of [
        ['unapproved', params, options], [GUIDE_AI_MODEL, { ...params, max_tokens: 1000 }, options],
        [GUIDE_AI_MODEL, { ...params, stream: true }, options],
        [GUIDE_AI_MODEL, { ...params, messages: ['x'.repeat(21000)] }, options],
        [GUIDE_AI_MODEL, params, { gateway: { ...options.gateway, collectLog: true } }],
        [GUIDE_AI_MODEL, params, { gateway: { ...options.gateway, skipCache: false } }],
        [GUIDE_AI_MODEL, params, { ...options, retry: true }],
    ]) await assert.rejects(() => env.AI.run(model, body, opts));
    assert.equal(subject.reserved(), 0); assert.equal(subject.calls(), 0);
});
test('counter outage, exhaustion or missing authorization disables AI and retains account settings', async () => {
    for (const overrides of [{ ORACLE_PREVIEW_LLM_ENABLED: 'false' }, { GUIDE_PILOT_BUDGET: undefined },
        { GUIDE_PILOT_BUDGET: { getByName() { return { async status() { return { remaining: 0 }; } }; } } },
        { GUIDE_PILOT_BUDGET: { getByName() { return { async status() { throw Error('offline'); } }; } } }]) {
        const subject = runtime({ ...overrides, DATABASE_URL: 'fictional-preserved' });
        const env = await guidePilotRuntime(subject.env);
        assert.equal(env.AI, undefined); assert.equal(env.GUIDE_CHAT_ENABLED, 'false');
        assert.equal(env.DATABASE_URL, 'fictional-preserved'); assert.equal(subject.calls(), 0);
    }
});
