import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithBaseCandidates } from '../src/lib/api.js';
import { createAddressSnapshotClient } from '../src/lib/addressSnapshotClient.js';

const bases = ['https://primary.example/api', 'https://fallback.example/api'];
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('address metadata keeps cookies, optional session header and abort signal on the configured API base', async t => {
    const previous = globalThis.window;
    globalThis.window = { sessionStorage: { getItem: () => 'fictional-impersonation-token' }, location: { hostname: 'localhost' } };
    t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
    const controller = new AbortController(), calls = [];
    const client = createAddressSnapshotClient({ baseCandidates: bases, apiRequest: (method, path, body, options) => requestWithBaseCandidates(method, path, body, { ...options, fetchImpl: async (url, init) => {
        calls.push({ url, init }); return json({ ready: true, snapshot: { label: 'Fixture', sha256: 'a'.repeat(64) } });
    } }) });
    await client.getAddressSnapshotMetadata({ signal: controller.signal });
    assert.equal(calls.length, 1); assert.equal(calls[0].url, bases[0] + '/address-snapshot/metadata');
    assert.equal(calls[0].init.credentials, 'include'); assert.equal(calls[0].init.headers['X-Session-Token'], 'fictional-impersonation-token');
    assert.equal(calls[0].init.signal, controller.signal); assert.equal(calls[0].init.cache, 'no-store');
});

for (const failure of ['network', '401', 'HTML200', 'HTML503']) test(`private address metadata never tries another base after ${failure}`, async () => {
    const calls = [];
    await assert.rejects(requestWithBaseCandidates('GET', '/address-snapshot/metadata', undefined, { baseCandidates: bases, networkAttemptsPerBase: 1, fetchImpl: async url => {
        calls.push(url);
        if (failure === 'network') throw new TypeError('Offline');
        if (failure === '401') return json({ error: 'Sign in required.' }, 401);
        return new Response('<html>edge fallback</html>', { status: failure === 'HTML200' ? 200 : 503, headers: { 'content-type': 'text/html' } });
    } }));
    assert.deepEqual(calls, [bases[0] + '/address-snapshot/metadata']);
});

test('public network fallback and existing private no-fallback policy remain unchanged', async () => {
    for (const [path, expected] of [['/health', 2], ['/my-maps/123', 1]]) {
        const calls = [], promise = requestWithBaseCandidates('GET', path, undefined, { baseCandidates: bases, networkAttemptsPerBase: 1, fetchImpl: async url => { calls.push(url); if (calls.length === 1) throw new TypeError('Offline'); return json({ ok: true }); } });
        if (expected === 1) await assert.rejects(promise); else assert.deepEqual(await promise, { ok: true });
        assert.equal(calls.length, expected);
    }
});
