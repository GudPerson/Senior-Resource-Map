import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { guideAiAvailable, runGuideAi } from '../src/utils/guideAiRuntime.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';
import { GUIDE_LLM_PILOT } from '../src/utils/guideLlmPilotPolicy.js';
import { reserveGuidePilotCall, readGuidePilotBudget, guidePilotRuntime } from '../src/preview/guidePilotBudget.js';
const now = Date.parse('2026-10-01T16:00:00Z');
test.beforeEach((t) => t.mock.method(Date, 'now', () => now));
function harness(initial = 43) {
    let used = initial, tail = Promise.resolve(), calls = 0;
    const values = { get: async () => used, put: async (key, value) => { used = value; } };
    const storage = { ...values, transaction(fn) { const task = tail.then(() => fn(values)); tail = task.catch(() => {}); return task; } };
    const stub = { status: () => readGuidePilotBudget(storage), reserve: () => reserveGuidePilotCall(storage) };
    const env = { NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        GUIDE_LLM_PILOT_ENABLED: 'true', GUIDE_CONVERSATIONAL_ANSWERS_ENABLED: 'true',
        GUIDE_AI_GATEWAY_ID: GUIDE_LLM_PILOT.gateway, GROUNDED_AI_ENABLED: 'false', GOVERNED_PILOT_RELEASE_STAGE: 'off',
        GUIDE_PILOT_BUDGET: { getByName(id) { assert.equal(id, GUIDE_LLM_PILOT.id); return stub; } },
        AI: { async run(model, params, options) { calls++; assert.equal(options.gateway.collectLog, false);
            assert.equal(options.gateway.skipCache, true); assert.deepEqual(options.gateway.retries, { maxAttempts: 1 });
            return { response: JSON.stringify({ factIds: ['help-discover'], message: 'Open Discover to find a resource.' }) }; } } };
    return { env, stub, calls: () => calls };
}
const params = { messages: [{ role: 'user', content: 'fictional public product question' }], max_tokens: 550, stream: false };
test('production and preview share the remaining cumulative allowance under concurrency', async () => {
    const subject = harness();
    const preview = await guidePilotRuntime({ ...subject.env, GUIDE_LLM_PILOT_ENABLED: 'false', ORACLE_PREVIEW_LLM_ENABLED: 'true' });
    const tasks = Array.from({ length: 80 }, (_, i) => i % 2 ? runGuideAi(subject.env, params)
        : preview.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', params,
            { gateway: { id: GUIDE_LLM_PILOT.gateway, skipCache: true, collectLog: false } }));
    const replies = await Promise.allSettled(tasks);
    assert.equal(replies.filter(r => r.status === 'fulfilled').length, 37);
    assert.equal(subject.calls(), 37);
    assert.equal((await subject.stub.status()).used, 80);
    await assert.rejects(() => runGuideAi(subject.env, params));
    assert.equal(subject.calls(), 37);
});
test('production counter outages, invalid requests, exhaustion and expiry spend nothing', async (t) => {
    for (const override of [ { GUIDE_PILOT_BUDGET: undefined }, { GUIDE_AI_GATEWAY_ID: 'wrong' },
        { GUIDE_PILOT_BUDGET: { getByName() { return { async reserve() { throw Error('offline'); } }; } } } ]) {
        const subject = harness(); await assert.rejects(() => runGuideAi({ ...subject.env, ...override }, params));
        assert.equal(subject.calls(), 0);
    }
    const subject = harness(80); await assert.rejects(() => runGuideAi(subject.env, params));
    assert.equal(subject.calls(), 0);
    for (const body of [{ ...params, stream: true }, { ...params, max_tokens: 651 },
        { ...params, messages: ['x'.repeat(21000)] }]) await assert.rejects(() => runGuideAi(harness().env, body));
    t.mock.method(Date, 'now', () => Date.parse(GUIDE_LLM_PILOT.expiresAt));
    assert.equal(guideAiAvailable(subject.env), false);
    await assert.rejects(() => runGuideAi(subject.env, params));
});
test('a provider failure consumes one reservation and is never retried or refunded', async () => {
    const subject = harness(); let attempted = 0;
    subject.env.AI.run = async () => { attempted++; throw Error('fictional provider failure'); };
    await assert.rejects(() => runGuideAi(subject.env, params));
    assert.equal(attempted, 1); assert.equal((await subject.stub.status()).used, 44);
});
test('production returns generated prose only with reviewed sources and the bounded opt-in flag', async () => {
    const subject = harness(); subject.env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED = 'false';
    const answer = await answerGuideWithCloudflare({ question: 'How can I find a resource?', topicId: 'discover', env: subject.env });
    assert.equal(answer.message, 'Open Discover to find a resource.');
    assert.equal(answer.sources[0].id, 'help-discover'); assert.ok(answer.actions.every(a => a.route.startsWith('/')));
    assert.equal(subject.calls(), 1); assert.equal((await subject.stub.status()).used, 44);
});
test('the production release preserves the real worker, existing database and cross-worker budget identity', async () => {
    const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
    assert.match(config, /main = "src\/worker.js"/);
    assert.match(config, /GUIDE_LLM_PILOT_ENABLED = "true"/);
    assert.match(config, /script_name = "carearound-guide-account-acceptance"/);
    assert.match(config, /class_name = "GuidePilotBudget"/);
    assert.doesNotMatch(config, /ORACLE_ACCEPTANCE_DATABASE_HOST|ORACLE_ACCOUNT_ACCEPTANCE_ENABLED|DATABASE_URL\s*=/);
    assert.match(config, /crons = \["\* \* \* \* \*"\]/);
});

test('removing the production budget flag fails closed instead of enabling unbounded calls', async () => {
    const subject = harness(); subject.env.GUIDE_LLM_PILOT_ENABLED = 'false';
    assert.equal(guideAiAvailable(subject.env), false);
    await assert.rejects(() => runGuideAi(subject.env, params));
    assert.equal(subject.calls(), 0); assert.equal((await subject.stub.status()).used, 43);
});
