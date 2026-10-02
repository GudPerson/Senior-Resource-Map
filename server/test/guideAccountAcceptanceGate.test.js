import test from 'node:test';
import assert from 'node:assert/strict';
import { gateGuideAccountAcceptance } from '../src/preview/guideAcceptanceGate.js';

const preview = () => ({
    ORACLE_ACCOUNT_ACCEPTANCE_ENABLED: 'true',
    ORACLE_ACCOUNT_ACCEPTANCE_DATABASE_HOST: 'preview.example.test',
    DATABASE_URL: 'postgresql://carearound_guide_acceptance_readonly:fictional@preview.example.test/carearound?sslmode=require',
    JWT_SECRET: 'fictional-preview-secret-'.repeat(2),
    NODE_ENV: 'production', ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'false',
    GUIDE_CHAT_ENABLED: 'false', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'false',
});
const request = (path, method = 'GET') => new Request(`https://preview.example.test${path}`, { method });

test('unprovisioned API fails before its handlers and exposes no binding details', async () => {
    const stopped = gateGuideAccountAcceptance(request('/api/auth/me'), {});
    assert.equal(stopped.status, 503);
    assert.equal(stopped.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await stopped.json(), { error: 'This preview is not ready for account testing.' });
});

test('preview requires the approved database host, dedicated readonly role, TLS and private session key', () => {
    for (const changes of [
        { DATABASE_URL: 'postgresql://production_owner:fictional@preview.example.test/carearound?sslmode=require' },
        { ORACLE_ACCOUNT_ACCEPTANCE_DATABASE_HOST: 'different.example.test' },
        { ORACLE_ACCOUNT_ACCEPTANCE_DATABASE_HOST: '' },
        { DATABASE_URL: 'postgresql://carearound_guide_acceptance_readonly:fictional@preview.example.test/carearound' },
        { DATABASE_URL: 'not-a-connection' }, { JWT_SECRET: 'short' },
        { ORACLE_ACCOUNT_ACCEPTANCE_ENABLED: 'false' },
    ]) assert.equal(gateGuideAccountAcceptance(request('/api/guide/topics'), { ...preview(), ...changes }).status, 503);
});

test('paid inference, shared cache and runtime schema bootstrap cannot be attached to account acceptance', () => {
    for (const changes of [
        { AI: { run() { throw new Error('must never run'); } } },
        { MAP_CACHE: {} }, { GUIDE_CHAT_ENABLED: 'true' },
        { GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true' },
        { ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'true' }, { NODE_ENV: 'development' },
    ]) assert.equal(gateGuideAccountAcceptance(request('/api/guide/answer', 'POST'), { ...preview(), ...changes }).status, 503);
});

test('ordinary reads, password session and User View reach existing app handlers', () => {
    for (const [path, method] of [
        ['/api/auth/me', 'GET'], ['/api/auth/login', 'POST'], ['/api/auth/logout', 'POST'],
        ['/api/auth/impersonate/42', 'POST'], ['/api/users', 'GET'],
        ['/api/hard-assets', 'GET'], ['/api/favorites', 'GET'],
        ['/api/guide/managed-access?q=Fictional', 'GET'],
    ]) assert.equal(gateGuideAccountAcceptance(request(path, method), preview()), null);
});

test('nonpersisting answers, public search and programme draft/review reach real candidate routes', () => {
    for (const path of ['/api/guide/answer', '/api/guide/search',
        '/api/guide/actions/programmes/draft', '/api/guide/actions/programmes/review'])
        assert.equal(gateGuideAccountAcceptance(request(path, 'POST'), preview()), null);
});

test('resource creation, saving, history, profile, assignments and publication are denied before app dispatch', () => {
    for (const [path, method] of [
        ['/api/guide/actions/programmes/create', 'POST'], ['/api/guide/actions/saved-resources', 'POST'],
        ['/api/guide/history', 'POST'], ['/api/guide/history', 'DELETE'],
        ['/api/hard-assets', 'POST'], ['/api/soft-assets/1', 'PUT'],
        ['/api/favorites/toggle', 'POST'], ['/api/users/me', 'PUT'],
        ['/api/hard-assets/1/staff', 'POST'], ['/api/my-maps/1/share', 'POST'],
        ['/api/auth/register', 'POST'], ['/api/auth/google', 'POST'],
        ['/api/auth/phone/1', 'GET'], ['/api/auth/impersonate/0', 'POST'],
        ['/api/guide/actions/programmes/%63reate', 'POST'],
        ['/api/guide/answer/extra', 'POST'],
    ]) assert.equal(gateGuideAccountAcceptance(request(path, method), preview()).status, 405);
});

test('static SPA paths pass to assets while static mutations are denied even without provisioning', () => {
    assert.equal(gateGuideAccountAcceptance(request('/help'), {}), null);
    assert.equal(gateGuideAccountAcceptance(request('/assets/app.js', 'HEAD'), {}), null);
    assert.equal(gateGuideAccountAcceptance(request('/help', 'POST'), {}).status, 405);
});


test('actual preview entry denies Create and Save before any session or database access', async () => {
    const { default: worker } = await import('../src/preview/guideAcceptance.worker.js');
    for (const path of ['/api/guide/actions/programmes/create', '/api/guide/actions/saved-resources']) {
        const stopped = await worker.fetch(request(path, 'POST'), preview(), {});
        assert.equal(stopped.status, 405);
        assert.equal((await stopped.json()).error, 'This preview cannot save changes.');
    }
});

test('actual preview entry serves the real reviewed topics without simulated auth or inference', async () => {
    const { default: worker } = await import('../src/preview/guideAcceptance.worker.js');
    const result = await worker.fetch(request('/api/guide/topics'), {
        ...preview(), SUPPORT_INBOX_ENABLED: 'true',
    }, {});
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.chatMode, 'guide');
    assert.ok(body.topics.length > 0);
    assert.equal(typeof body.version, 'string');
});

test('actual preview entry sends SPA paths only to the supplied asset binding', async () => {
    const { default: worker } = await import('../src/preview/guideAcceptance.worker.js');
    const result = await worker.fetch(request('/help'), { ASSETS: {
        fetch: async (incoming) => new Response(new URL(incoming.url).pathname),
    } }, {});
    assert.equal(await result.text(), '/help');
});

test('only the fully authorized preview pilot permits AI; the existing write boundary remains', () => {
    const pilot = { ...preview(), ORACLE_PREVIEW_LLM_ENABLED: 'true',
        GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        GUIDE_AI_GATEWAY_ID: 'carearound-guide', GROUNDED_AI_ENABLED: 'false', GOVERNED_PILOT_RELEASE_STAGE: 'off',
        AI: { run() { throw Error('never called by the gate'); } },
        GUIDE_PILOT_BUDGET: { getByName() { throw Error('never called by the gate'); } } };
    assert.equal(gateGuideAccountAcceptance(request('/api/guide/answer', 'POST'), pilot), null);
    for (const changes of [{ GUIDE_PILOT_BUDGET: undefined }, { AI: undefined },
        { GUIDE_AI_GATEWAY_ID: 'different' }, { ORACLE_PREVIEW_LLM_ENABLED: 'false' },
        { GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'false' }, { GROUNDED_AI_ENABLED: 'true' }])
        assert.equal(gateGuideAccountAcceptance(request('/api/guide/topics'), { ...pilot, ...changes }).status, 503);
    for (const path of ['/api/guide/actions/programmes/create', '/api/guide/history', '/api/favorites/toggle'])
        assert.equal(gateGuideAccountAcceptance(request(path, 'POST'), pilot).status, 405);
});


test('actual pilot entry advertises Cloudflare only with a working unexpired persistent allowance', async (t) => {
    const { default: worker } = await import('../src/preview/guideAcceptance.worker.js');
    const { GUIDE_PILOT } = await import('../src/preview/guidePilotBudget.js');
    const expiresAt = Date.parse(GUIDE_PILOT.expiresAt);
    let now = expiresAt - 1;
    // Synthetic time exercises the fixed approval boundary without renewing it.
    t.mock.method(Date, 'now', () => now);
    let calls = 0;
    const env = { ...preview(), SUPPORT_INBOX_ENABLED: 'true', ORACLE_PREVIEW_LLM_ENABLED: 'true',
        GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        GUIDE_AI_GATEWAY_ID: 'carearound-guide', GROUNDED_AI_ENABLED: 'false', GOVERNED_PILOT_RELEASE_STAGE: 'off',
        AI: { run() { calls++; throw Error('must not infer'); } },
        GUIDE_PILOT_BUDGET: { getByName() { return { async status() { return { used: 39, limit: 80, remaining: 41 }; } }; } } };
    assert.equal((await (await worker.fetch(request('/api/guide/topics'), env, {})).json()).chatMode, 'cloudflare');
    assert.equal((await (await worker.fetch(request('/api/guide/pilot'), env, {})).json()).used, 39);
    assert.equal((await worker.fetch(request('/api/guide/actions/programmes/create', 'POST'), env, {})).status, 405);
    now = expiresAt;
    assert.equal((await (await worker.fetch(request('/api/guide/topics'), env, {})).json()).chatMode, 'guide',
        'The deadline disables AI even when the allowance still has capacity.');
    now = expiresAt - 1;
    env.GUIDE_PILOT_BUDGET = { getByName() { return { async status() { return { remaining: 0 }; } }; } };
    assert.equal((await (await worker.fetch(request('/api/guide/topics'), env, {})).json()).chatMode, 'guide');
    assert.equal(calls, 0);
});
