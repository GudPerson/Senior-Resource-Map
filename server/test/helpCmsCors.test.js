import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

const appOrigin = 'https://app.carearound.sg';
const env = { NODE_ENV: 'production' };
const existingHeaders = ['content-type', 'x-session-token', 'x-phone-login-token', 'x-carearound-support-key'];
const cmsHeaders = [...existingHeaders, 'x-carearound-session'];
const headerNames = response => (response.headers.get('Access-Control-Allow-Headers') || '').toLowerCase().split(',');

function preflight(path, { origin = appOrigin, method = 'GET', headers = 'x-carearound-session', runtimeEnv = env } = {}) {
    return app.request('https://api.carearound.sg' + path, { method: 'OPTIONS', headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': headers,
    } }, runtimeEnv);
}

test('the real app permits the CMS client session marker for root and descendant browser preflights', async () => {
    for (const [path, method, headers] of [
        ['/api/help/cms', 'GET', 'x-carearound-session'],
        ['/api/help/cms', 'PUT', 'content-type,x-carearound-session,x-session-token'],
        ['/api/help/cms/capability', 'GET', 'x-carearound-session'],
        ['/api/help/cms/history', 'GET', 'x-carearound-session'],
        ['/api/help/cms/media', 'POST', 'x-carearound-session'],
        ['/api/help/cms/media/approved-image', 'GET', 'x-carearound-session'],
        ['/api/help/cms/publish', 'POST', 'content-type,x-carearound-session'],
        ['/api/help/cms/releases/known-publication/retry', 'POST', 'content-type,x-carearound-session'],
    ]) {
        const response = await preflight(path, { method, headers });
        assert.equal(response.status, 204, path);
        assert.equal(await response.text(), '', path);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), appOrigin, path);
        assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true', path);
        assert.deepEqual(headerNames(response), cmsHeaders, path);
        assert.ok(response.headers.get('Access-Control-Allow-Methods').split(',').includes(method), path);
    }
});

test('CMS-only preflight allowance does not change other routes or lookalike prefixes', async () => {
    for (const path of ['/api/help/articles', '/api/help/media/approved-image', '/api/users', '/api/personal-places',
        '/api/auth/me', '/api/help/cms-other', '/api/help/cmsness', '/api/help/cms%2Fhistory', '/api/Help/cms']) {
        const response = await preflight(path);
        assert.equal(response.status, 204, path);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), appOrigin, path);
        assert.deepEqual(headerNames(response), existingHeaders, path);
        assert.equal(headerNames(response).includes('x-carearound-session'), false, path);
    }
});

test('CMS preflight does not grant arbitrary origins', async () => {
    for (const origin of ['https://untrusted.example', 'https://app.carearound.sg.evil.example',
        'https://carearound.sg', 'https://app.carearound.sg/path', 'null']) {
        const response = await preflight('/api/help/cms', { origin });
        assert.equal(response.status, 204, origin);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), null, origin);
    }
});

test('CMS preflight never reflects additional requested headers, including Authorization', async () => {
    const response = await preflight('/api/help/cms', { method: 'PUT',
        headers: 'content-type,x-carearound-session,authorization,x-untrusted-header,if-match' });
    assert.deepEqual(headerNames(response), cmsHeaders);
    for (const name of ['authorization', 'x-untrusted-header', 'if-match']) {
        assert.equal(headerNames(response).includes(name), false, name);
    }
});

test('CMS preflight retains existing methods, exposed headers and security headers', async () => {
    const baseline = await preflight('/api/health');
    const response = await preflight('/api/help/cms');
    for (const name of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Methods',
        'Access-Control-Expose-Headers', 'Access-Control-Max-Age', 'Vary', 'Content-Security-Policy',
        'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy',
        'Cross-Origin-Resource-Policy', 'Strict-Transport-Security']) {
        assert.equal(response.headers.get(name), baseline.headers.get(name), name);
    }
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET,HEAD,PUT,POST,DELETE,PATCH');
    assert.equal(response.headers.get('Access-Control-Expose-Headers'),
        'X-Request-ID,Server-Timing,X-CareAround-Cache,X-CareAround-Cache-Age,X-CareAround-Cache-Stale');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.ok(response.headers.get('Content-Security-Policy'));
    assert.ok(response.headers.get('Strict-Transport-Security'));
});

test('CMS preflight keeps the existing configured and development origin policy', async () => {
    for (const origin of ['http://localhost:5173', 'https://preview.senior-resource-map.pages.dev', 'https://configured.example']) {
        const runtimeEnv = { ...env, ALLOWED_ORIGINS: 'https://configured.example' };
        const response = await preflight('/api/help/cms', { origin, runtimeEnv });
        const baseline = await preflight('/api/health', { origin, runtimeEnv });
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin, origin);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), baseline.headers.get('Access-Control-Allow-Origin'), origin);
        assert.equal(response.headers.get('Access-Control-Allow-Credentials'), baseline.headers.get('Access-Control-Allow-Credentials'), origin);
    }
});

test('successful CMS preflight does not grant an anonymous actual request or remove private caching', async () => {
    for (const method of ['GET', 'PUT']) {
        const response = await app.request('https://api.carearound.sg/api/help/cms', { method, headers: {
            Origin: appOrigin, 'X-CareAround-Session': '1',
            ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
        }, ...(method === 'PUT' ? { body: JSON.stringify({ workspace: {}, etag: 'untrusted' }) } : {}) }, env);
        assert.equal(response.status, 401, method);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), appOrigin, method);
        assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true', method);
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store', method);
        assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff', method);
        assert.deepEqual(await response.json(), { error: 'No token provided' }, method);
    }
});
