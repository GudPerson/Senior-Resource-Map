import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { onRequest as index } from '../functions/__help-release-proof/home.js';
import { onRequest as offline } from '../functions/__help-release-proof/offline.js';
import { helpReleaseAssetProof } from '../pages/helpReleaseAssetProof.js';

const jobId = '22222222-2222-4222-8222-222222222222';
const bytes = Buffer.from('<!doctype html>\r\n<html><body>CareAround SG — unchanged bytes</body></html>\n');
const security = { 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()' };
function asset(options = {}) {
    const response = new Response(options.body === undefined ? bytes : options.body, { status: options.status || 200, headers: {
        ...security, 'Content-Type': options.mime === undefined ? 'text/html; charset=UTF-8' : options.mime,
        'Cache-Control': 'no-cache', ETag: '"unaltered"',
    } });
    if (options.redirected) Object.defineProperty(response, 'redirected', { value: true });
    return response;
}
async function invoke(handler, url, { method = 'GET', response = asset(), throws = false } = {}) {
    const requests = [];
    const result = await handler({ request: new Request(url, { method, headers: {
        Cookie: 'private-session=fixture', Authorization: 'Bearer fixture', Range: 'bytes=0-1',
        'If-None-Match': '"old"', 'If-Modified-Since': 'Wed, 01 Oct 2025 00:00:00 GMT', 'X-Arbitrary': 'fixture',
    } }), next: async () => { throw new Error('The dedicated proof must never intercept ordinary asset routing.'); }, env: { ASSETS: {
        fetch: async request => { requests.push(request); if (throws) throw new Error('private internal failure'); return response; },
    } } });
    return { result, requests, response };
}

test('the two dedicated proofs fetch only same-deployment canonical assets with minimal requests and exact streams', async () => {
    for (const [document, canonical, handler] of [['home', '/', index], ['offline', '/offline', offline]]) {
        const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes.subarray(0, 12)); controller.enqueue(bytes.subarray(12)); controller.close(); } });
        const response = asset({ body: stream });
        const { result, requests } = await invoke(handler, 'https://app.carearound.sg/__help-release-proof/' + document + '?help_release_check=' + jobId + '&attempt=1&ignored=value', { response });
        assert.equal(requests.length, 1); const request = requests[0];
        assert.equal(request.url, 'https://app.carearound.sg' + canonical); assert.equal(request.method, 'GET'); assert.equal(request.redirect, 'manual');
        assert.deepEqual([...request.headers], [['accept', 'text/html'], ['cache-control', 'no-cache']]); assert.equal(request.body, null);
        assert.equal(result.body, stream); assert.equal(result.bodyUsed, false); assert.equal(result.status, 200);
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store, no-transform'); assert.equal(response.headers.get('Cache-Control'), 'no-cache');
        for (const [name, value] of response.headers) if (name !== 'cache-control') assert.equal(result.headers.get(name), value);
        assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
    }
});
test('HEAD preserves the canonical method and asset headers with an empty body', async () => {
    for (const [document, handler] of [['home', index], ['offline', offline]]) {
        const { result, requests } = await invoke(handler, 'https://app.carearound.sg/__help-release-proof/' + document + '?help_release_check=' + jobId, { method: 'HEAD' });
        assert.equal(requests[0].method, 'HEAD'); assert.equal(result.body, null); assert.equal(await result.text(), '');
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store, no-transform');
        for (const [name, value] of Object.entries(security)) assert.equal(result.headers.get(name), value);
    }
});
test('strict origin, exact document path, UUID marker and read-method failures never fetch an asset', async () => {
    const prefix = 'https://app.carearound.sg/__help-release-proof/home', marker = '?help_release_check=' + jobId;
    const cases = [prefix, prefix + '?help_release_check=', prefix + '?help_release_check=invalid',
        prefix + marker + '&help_release_check=' + jobId, prefix + marker + '&%68elp_release_check=' + jobId,
        prefix + marker + '%20', prefix + marker + '%0A', prefix + '?help_release_check=1791000000000-' + jobId,
        prefix + '/' + marker, prefix.replace('/home', '/other') + marker, prefix.replace('/home', '/%68ome') + marker,
        prefix.replace('https:', 'http:') + marker, prefix.replace('app.carearound.sg', 'carearound.sg') + marker,
        prefix.replace('app.carearound.sg', 'preview.pages.dev') + marker, prefix.replace('app.carearound.sg', 'app.carearound.sg:8443') + marker,
        'https://app.carearound.sg/' + marker, 'https://app.carearound.sg/offline' + marker,
        'https://app.carearound.sg/api/help/articles' + marker, 'https://app.carearound.sg/embed/maps/token' + marker];
    for (const url of cases) {
        const { result, requests } = await invoke(index, url);
        assert.equal(result.status, 404, url); assert.equal(requests.length, 0); assert.match(result.headers.get('Content-Type'), /^text\/plain/);
    }
    for (const method of ['POST', 'OPTIONS', 'PUT']) {
        const { result, requests } = await invoke(index, prefix + marker, { method });
        assert.equal(result.status, 405); assert.equal(result.headers.get('Allow'), 'GET, HEAD'); assert.equal(requests.length, 0);
    }
    const response = await helpReleaseAssetProof({ request: new Request(prefix + marker) }, '__proto__');
    assert.equal(response.status, 404);
});
test('upstream redirects, followed redirects, errors and wrong MIME cannot become asset proofs', async () => {
    for (const options of [{ status: 308 }, { status: 404 }, { status: 500 }, { status: 201 }, { redirected: true },
        { mime: 'application/json' }, { mime: 'text/plain' }, { mime: '' }, { mime: 'text/html-extra' }]) {
        const response = asset(options); response.headers.set('Location', 'https://other.example/');
        const { result, requests } = await invoke(index, 'https://app.carearound.sg/__help-release-proof/home?help_release_check=' + jobId, { response });
        assert.equal(requests.length, 1); assert.equal(result.status, 502); assert.equal(result.headers.get('Location'), null);
        assert.equal(await result.text(), 'Help release proof unavailable.');
    }
    const { result } = await invoke(index, 'https://app.carearound.sg/__help-release-proof/home?help_release_check=' + jobId, { throws: true });
    assert.equal(result.status, 503); assert.doesNotMatch(await result.text(), /private internal/);
});
test('routing adds only two literal proof paths and keeps all ordinary pages outside Functions', () => {
    const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
    assert.deepEqual(routes, { version: 1, include: ['/embed/maps/*', '/embed/governed-maps/*', '/__help-release-proof/home', '/__help-release-proof/offline'], exclude: [] });
    const files = readdirSync(new URL('../functions/', import.meta.url), { recursive: true }).filter(file => file.endsWith('.js')).sort();
    assert.deepEqual(files, ['__help-release-proof/home.js', '__help-release-proof/offline.js', 'embed/governed-maps/[token].js', 'embed/maps/[token].js']);
});
