import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_CHAT_MODEL } from '../src/utils/guideChat.js';
import { runGuideAi } from '../src/utils/guideAiRuntime.js';
import { createGuideWorkersAiBridge } from './fixtures/guideWorkersAiBridge.worker.js';
import { createGuideLiveAiClient, GUIDE_PILOT_GATEWAY_ID, guidePilotAiOptions } from './fixtures/guideLiveAiClient.js';

function fixture(run = async () => ({ response: 'fixture response' })) {
    const calls = [];
    return { calls, env: { GUIDE_LIVE_PILOT_APPROVED: 'true', GUIDE_AI_GATEWAY_ID: GUIDE_PILOT_GATEWAY_ID,
        AI: { run: async (...args) => { calls.push(args); return run(...args); } } } };
}
function payload(max_tokens = 90) {
    return { model: GUIDE_CHAT_MODEL, params: { messages: [{ role: 'user', content: 'Fictional public-help question' }],
        max_tokens, temperature: 0, stream: false }, options: guidePilotAiOptions() };
}
function request(body = payload(), path = '/__carearound-guide-ai-run') {
    return new Request(`http://127.0.0.1:8788${path}`, { method: 'POST', body: JSON.stringify(body) });
}

test('live bridge refuses missing approval, the wrong Gateway and unavailable binding without inference', async (t) => {
    for (const [name, override] of [
        ['default approval off', { GUIDE_LIVE_PILOT_APPROVED: 'false' }],
        ['approval missing', { GUIDE_LIVE_PILOT_APPROVED: undefined }],
        ['Gateway missing', { GUIDE_AI_GATEWAY_ID: undefined }],
        ['default Gateway forbidden', { GUIDE_AI_GATEWAY_ID: 'default' }],
        ['binding missing', { AI: undefined }],
    ]) await t.test(name, async () => {
        const f = fixture();
        const response = await createGuideWorkersAiBridge().fetch(request(), { ...f.env, ...override });
        assert.equal(response.status, 503);
        assert.equal(f.calls.length, 0);
    });
});

test('answers and drafts reach only the named Gateway with no cache or logging', async () => {
    const bridge = createGuideWorkersAiBridge();
    const f = fixture();
    for (const [tokens, path] of [[90, '/__carearound-guide-ai-run'], [450, '/__carearound-guide-ai-draft']]) {
        const body = payload(tokens);
        const response = await bridge.fetch(request(body, path), f.env);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { response: 'fixture response' });
        assert.deepEqual(f.calls.at(-1), [GUIDE_CHAT_MODEL, body.params,
            { gateway: { id: 'carearound-guide', skipCache: true, collectLog: false } }]);
    }
    assert.equal(f.calls.length, 2);
});

test('unsafe or missing client Gateway options cannot bypass pilot routing or privacy controls', async (t) => {
    for (const [name, options] of [
        ['missing options', undefined],
        ['default Gateway', { gateway: { id: 'default', skipCache: true, collectLog: false } }],
        ['caching enabled', { gateway: { id: GUIDE_PILOT_GATEWAY_ID, skipCache: false, collectLog: false } }],
        ['logging enabled', { gateway: { id: GUIDE_PILOT_GATEWAY_ID, skipCache: true, collectLog: true } }],
        ['retry option', { gateway: { ...guidePilotAiOptions().gateway, retries: { maxAttempts: 3 } } }],
        ['extra headers', { ...guidePilotAiOptions(), extraHeaders: { 'cf-aig-collect-log': 'true' } }],
    ]) await t.test(name, async () => {
        const f = fixture();
        const response = await createGuideWorkersAiBridge().fetch(request({ ...payload(), options }), f.env);
        assert.equal(response.status, 400);
        assert.equal(f.calls.length, 0);
    });
});

test('invalid model, token limit, stream and message shape never consume a model call', async (t) => {
    for (const [name, change] of [
        ['other model', (body) => { body.model = '@cf/other/model'; }],
        ['wrong answer limit', (body) => { body.params.max_tokens = 450; }],
        ['streaming', (body) => { body.params.stream = true; }],
        ['no messages', (body) => { body.params.messages = []; }],
        ['tool role', (body) => { body.params.messages[0].role = 'tool'; }],
        ['invalid content', (body) => { body.params.messages[0].content = {}; }],
        ['too many turns', (body) => { body.params.messages = Array(7).fill(body.params.messages[0]); }],
    ]) await t.test(name, async () => {
        const f = fixture(); const body = payload(); change(body);
        assert.equal((await createGuideWorkersAiBridge().fetch(request(body), f.env)).status, 400);
        assert.equal(f.calls.length, 0);
    });
});

test('twenty actual attempts are allowed per instance; invalid requests do not consume them', async () => {
    const bridge = createGuideWorkersAiBridge(); const f = fixture();
    for (let i = 0; i < 22; i++) {
        const invalid = payload(); delete invalid.options;
        assert.equal((await bridge.fetch(request(invalid), f.env)).status, 400);
    }
    for (let i = 0; i < 20; i++) assert.equal((await bridge.fetch(request(), f.env)).status, 200);
    assert.equal((await bridge.fetch(request(), f.env)).status, 429);
    assert.equal(f.calls.length, 20);
});

test('a rejected model call counts once, propagates 429 and never retries or calls a fallback Gateway', async () => {
    const bridge = createGuideWorkersAiBridge();
    const f = fixture(async () => { const error = new Error('Fictional budget rejection'); error.status = 429; throw error; });
    for (let i = 0; i < 20; i++) assert.equal((await bridge.fetch(request(), f.env)).status, 429);
    assert.equal(f.calls.length, 20);
    assert.equal((await bridge.fetch(request(), f.env)).status, 429);
    assert.equal(f.calls.length, 20);
    assert.ok(f.calls.every((args) => args[2].gateway.id === GUIDE_PILOT_GATEWAY_ID));
});

test('unknown model errors fall back to unavailable without retry', async () => {
    const f = fixture(async () => { throw new Error('Fictional outage'); });
    assert.equal((await createGuideWorkersAiBridge().fetch(request(), f.env)).status, 503);
    assert.equal(f.calls.length, 1);
});

test('oversized UTF-8 bodies and invalid JSON are rejected without inference', async () => {
    const f = fixture(); const bridge = createGuideWorkersAiBridge();
    const body = payload(); body.params.messages[0].content = '界'.repeat(7000);
    assert.equal((await bridge.fetch(request(body), f.env)).status, 413);
    assert.equal((await bridge.fetch(new Request('http://127.0.0.1:8788/__carearound-guide-ai-run',
        { method: 'POST', body: '{invalid' }), f.env)).status, 400);
    assert.equal(f.calls.length, 0);
});

test('unknown paths and methods never reach the binding', async () => {
    const f = fixture(); const bridge = createGuideWorkersAiBridge();
    assert.equal((await bridge.fetch(request(payload(), '/other'), f.env)).status, 404);
    assert.equal((await bridge.fetch(new Request('http://127.0.0.1:8788/__carearound-guide-ai-run'), f.env)).status, 404);
    assert.equal(f.calls.length, 0);
});

test('fixture runGuideAi preserves its third argument through answer and draft transports', async () => {
    const bridge = createGuideWorkersAiBridge(); const f = fixture(); const urls = [];
    const client = createGuideLiveAiClient({ fetchImpl: async (url, init) => {
        urls.push(url); return bridge.fetch(new Request(url, init), f.env);
    } });
    const env = { NODE_ENV: 'test', GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: GUIDE_PILOT_GATEWAY_ID, AI: client };
    for (const tokens of [90, 450]) assert.deepEqual(await runGuideAi(env, payload(tokens).params), { response: 'fixture response' });
    assert.deepEqual(urls, ['http://127.0.0.1:8788/__carearound-guide-ai-run', 'http://127.0.0.1:8788/__carearound-guide-ai-draft']);
    assert.equal(f.calls.length, 2);
});

test('the loopback client rejects missing Gateway privacy options before sending a request', async () => {
    let sent = 0;
    const client = createGuideLiveAiClient({ fetchImpl: async () => { sent++; return Response.json({}); } });
    await assert.rejects(client.run(GUIDE_CHAT_MODEL, payload().params), /named Gateway/);
    await assert.rejects(client.run(GUIDE_CHAT_MODEL, { ...payload().params, max_tokens: 999 }, guidePilotAiOptions()), /named Gateway/);
    assert.equal(sent, 0);
});

test('the client preserves bridge rejection status without another request', async () => {
    let sent = 0;
    const client = createGuideLiveAiClient({ fetchImpl: async () => { sent++; return new Response('Fictional budget rejection', { status: 429 }); } });
    await assert.rejects(client.run(GUIDE_CHAT_MODEL, payload().params, guidePilotAiOptions()), (error) => error.status === 429);
    assert.equal(sent, 1);
});


test('status reports approval and attempted calls without inference or request content', async () => {
    const bridge = createGuideWorkersAiBridge(); const f = fixture();
    const status = async (env = f.env) => bridge.fetch(new Request('http://127.0.0.1:8788/__carearound-guide-ai-status'), env);
    const initial = await status({ ...f.env, GUIDE_LIVE_PILOT_APPROVED: 'false' });
    assert.equal(initial.headers.get('Cache-Control'), 'no-store');
    const before = await initial.json();
    assert.equal(before.approved, false); assert.equal(before.attemptedCalls, 0);
    assert.equal(f.calls.length, 0);
    await bridge.fetch(request(), f.env);
    const after = await (await status()).json();
    assert.equal(after.instanceId, before.instanceId); assert.equal(after.approved, true);
    assert.equal(after.gatewayConfigured, true); assert.equal(after.attemptedCalls, 1);
    assert.equal(after.maximumCalls, 20); assert.equal(after.model, GUIDE_CHAT_MODEL);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(Object.keys(after).sort(), ['fixture', 'instanceId', 'attemptedCalls', 'maximumCalls',
        'approved', 'gatewayConfigured', 'gatewayId', 'model'].sort());
});

test('status detects a bridge restart instead of treating a reset counter as the same pilot', async () => {
    const f = fixture(); const first = createGuideWorkersAiBridge();
    await first.fetch(request(), f.env);
    const oldState = await (await first.fetch(new Request('http://127.0.0.1:8788/__carearound-guide-ai-status'), f.env)).json();
    const newState = await (await createGuideWorkersAiBridge().fetch(new Request('http://127.0.0.1:8788/__carearound-guide-ai-status'), f.env)).json();
    assert.notEqual(oldState.instanceId, newState.instanceId);
    assert.equal(oldState.attemptedCalls, 1); assert.equal(newState.attemptedCalls, 0);
    assert.equal(f.calls.length, 1);
});
