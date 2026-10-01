import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { cookieSessionCsrfGuard } from '../src/middleware/security.js';
import { gateGuideAccountAcceptance } from '../src/preview/guideAcceptanceGate.js';

const origin = 'https://carearound-guide-account-acceptance.joshuachua79.workers.dev';
const config = JSON.parse(readFileSync(new URL('../wrangler.guide-account-acceptance.json', import.meta.url), 'utf8'));
const env = { ...config.vars, AI: { run() { throw Error('must not infer'); } },
    GUIDE_PILOT_BUDGET: { getByName() { throw Error('must not reserve'); } },
    DATABASE_URL: 'postgresql://carearound_guide_acceptance_readonly:fictional-only@ep-rapid-hill-aigmz42s-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
    JWT_SECRET: 'fictional-preview-key-for-origin-tests-only',
};
function guardedPreview(runtime = env, withGate = true) {
    const app = new Hono();
    let dispatched = 0;
    if (withGate) app.use('*', async (c, next) => gateGuideAccountAcceptance(c.req.raw, c.env) || next());
    app.use('*', cookieSessionCsrfGuard);
    app.post('*', c => { dispatched++; return c.json({ reachedHandler: true }); });
    return { app, runtime, dispatches: () => dispatched };
}
function submit(subject, path = '/api/guide/answer', headers = { Origin: origin }) {
    return subject.app.fetch(new Request(origin + path, {
        method: 'POST', headers: { Cookie: 'sc_token=fictional-session-only', ...headers },
    }), subject.runtime);
}

test('the actual preview config permits its same-origin cookie Guide request', async () => {
    const subject = guardedPreview();
    const response = await submit(subject);
    assert.equal(response.status, 200);
    assert.equal(subject.dispatches(), 1);
});

test('the preview preserves trusted Referer fallback for cookie Guide requests', async () => {
    const response = await submit(guardedPreview(), '/api/guide/answer', { Referer: origin + '/dashboard' });
    assert.equal(response.status, 200);
});

test('unrelated, lookalike and missing origins still fail verification', async () => {
    for (const headers of [{ Origin: 'https://attacker.example' },
        { Origin: origin + '.attacker.example' }, {}]) {
        const subject = guardedPreview();
        const response = await submit(subject, '/api/guide/answer', headers);
        assert.equal(response.status, 403);
        assert.match((await response.json()).error, /This request could not be verified/);
        assert.equal(subject.dispatches(), 0);
    }
});

test('trusting the preview origin does not allow resource or account writes', async () => {
    const subject = guardedPreview();
    for (const path of ['/api/guide/actions/programmes/create', '/api/map-items',
        '/api/guide/history', '/api/auth/signup', '/api/users/profile']) {
        const response = await submit(subject, path);
        assert.equal(response.status, 405);
        assert.equal((await response.json()).error, 'This preview cannot save changes.');
    }
    assert.equal(subject.dispatches(), 0);
});

test('the production guard does not inherit the preview-specific origin trust', async () => {
    const subject = guardedPreview({ NODE_ENV: 'production' }, false);
    assert.equal((await submit(subject)).status, 403);
    assert.equal((await submit(subject, '/api/guide/answer', { Origin: 'https://app.carearound.sg' })).status, 200);
});
