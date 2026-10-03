import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { onRequest as index } from '../functions/index.js';
import { onRequest as offline } from '../functions/offline.js';
import { helpReleaseProofResponse } from '../pages/helpReleaseProof.js';

const jobId = '22222222-2222-4222-8222-222222222222';
const securityHeaders = {
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
};
const bytes = Buffer.from('<!doctype html>\r\n<html><body>CareAround SG — unchanged bytes</body></html>\n');
function asset({ status = 200, mime = 'text/html; charset=UTF-8', body = bytes, redirected = false } = {}) {
    const response = new Response(body, { status, statusText: status === 200 ? 'OK' : 'Upstream', headers: {
        ...securityHeaders, 'Content-Type': mime, 'Cache-Control': 'no-cache', ETag: '"exact-local-bytes"',
    } });
    if (redirected) Object.defineProperty(response, 'redirected', { value: true });
    return response;
}
async function invoke(handler, url, response, method = 'GET') {
    let nextCalls = 0;
    const result = await handler({ request: new Request(url, { method }), next: async () => { nextCalls++; return response; } });
    assert.equal(nextCalls, 1);
    return result;
}

test('ordinary root and offline visits return the exact original response with headers and bytes unchanged', async () => {
    for (const [path, handler] of [['/', index], ['/offline', offline]]) {
        const response = asset(), headers = [...response.headers];
        const result = await invoke(handler, 'https://app.carearound.sg' + path + '?ordinary=value', response);
        assert.equal(result, response); assert.deepEqual([...result.headers], headers);
        assert.equal(result.bodyUsed, false); assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
    }
});

test('an exact production GET probe preserves the original stream, byte sequence and security headers', async () => {
    for (const [path, handler] of [['/', index], ['/offline', offline]]) {
        const stream = new ReadableStream({ start(controller) {
            controller.enqueue(bytes.subarray(0, 12)); controller.enqueue(bytes.subarray(12)); controller.close();
        } });
        const response = asset({ body: stream });
        const result = await invoke(handler, 'https://app.carearound.sg' + path + '?help_release_check=' + jobId + '&attempt=1', response);
        assert.notEqual(result, response); assert.equal(result.body, stream); assert.equal(result.bodyUsed, false);
        assert.equal(result.status, response.status); assert.equal(result.statusText, response.statusText);
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store, no-transform');
        assert.equal(response.headers.get('Cache-Control'), 'no-cache');
        for (const [name, value] of response.headers) if (name !== 'cache-control') assert.equal(result.headers.get(name), value);
        assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
    }
});

test('an exact production HEAD probe retains a null body and all security headers', async () => {
    for (const [path, handler] of [['/', index], ['/offline', offline]]) {
        const response = asset({ body: null });
        const result = await invoke(handler, 'https://app.carearound.sg' + path + '?help_release_check=' + jobId, response, 'HEAD');
        assert.equal(result.body, null); assert.equal(await result.text(), '');
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store, no-transform');
        for (const [name, value] of Object.entries(securityHeaders)) assert.equal(result.headers.get(name), value);
    }
});

test('host, method, exact path and marker boundaries return the original response', async () => {
    const query = '?help_release_check=' + jobId;
    const cases = [
        ['https://preview.pages.dev/' + query], ['https://carearound.sg/' + query],
        ['http://app.carearound.sg/' + query], ['https://app.carearound.sg:8443/' + query],
        ['https://app.carearound.sg/' + query, 'POST'], ['https://app.carearound.sg/' + query, 'OPTIONS'],
        ['https://app.carearound.sg/help' + query], ['https://app.carearound.sg/api/help/articles' + query],
        ['https://app.carearound.sg/embed/maps/token' + query], ['https://app.carearound.sg/__carearound-town-maps/file' + query],
        ['https://app.carearound.sg/offline/' + query, 'GET', offline],
        ['https://app.carearound.sg/offline.html' + query, 'GET', offline],
        ['https://app.carearound.sg/' + query + '&help_release_check=' + jobId],
        ['https://app.carearound.sg/' + query + '&%68elp_release_check=' + jobId],
        ['https://app.carearound.sg/?help_release_check='], ['https://app.carearound.sg/?help_release_check=not-a-uuid'],
        ['https://app.carearound.sg/?help_release_check=1791000000000-' + jobId],
        ['https://app.carearound.sg/?help_release_check=' + jobId + '%20'],
        ['https://app.carearound.sg/?help_release_check=' + jobId + '%0A'],
        ['https://app.carearound.sg/?help_release_check=' + jobId + '%0D%0A'],
    ];
    for (const [url, method = 'GET', handler = index] of cases) {
        const response = asset(), headers = [...response.headers];
        const result = await invoke(handler, url, response, method);
        assert.equal(result, response, url); assert.deepEqual([...result.headers], headers);
        assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
    }
    const response = asset();
    assert.equal(await helpReleaseProofResponse({ request: new Request('https://app.carearound.sg/help' + query), next: async () => response }, '/help'), response);
});

test('redirects, followed redirects, errors and non-HTML assets pass through unchanged', async () => {
    const cases = [{ status: 308 }, { status: 404 }, { status: 500 }, { status: 201 }, { redirected: true },
        { mime: 'application/json' }, { mime: 'text/plain' }, { mime: '' }, { mime: 'text/html-extra' }];
    for (const options of cases) {
        const response = asset(options), headers = [...response.headers];
        const result = await invoke(index, 'https://app.carearound.sg/?help_release_check=' + jobId, response);
        assert.equal(result, response); assert.deepEqual([...result.headers], headers);
        assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
    }
    const error = new Error('asset fallback failed');
    await assert.rejects(index({ request: new Request('https://app.carearound.sg/'), next: async () => { throw error; } }), value => value === error);
});

test('the shared proof helper creates no additional public Function route', () => {
    const files = readdirSync(new URL('../functions/', import.meta.url), { recursive: true }).filter(file => file.endsWith('.js')).sort();
    assert.deepEqual(files, ['embed/governed-maps/[token].js', 'embed/maps/[token].js', 'index.js', 'offline.js']);
    const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
    assert.deepEqual(routes.include, ['/embed/maps/*', '/embed/governed-maps/*', '/', '/offline']);
    assert.deepEqual(routes.exclude, []);
});
