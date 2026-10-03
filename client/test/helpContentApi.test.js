import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpContentApi } from '../src/features/help-content/helpContentApi.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('CMS read/write use one session origin, no cache and exact optimistic concurrency envelopes', async () => {
    const calls = [], controller = new AbortController();
    const api = createHelpContentApi({ base: 'https://same-origin.test/api', fetchImpl: async (url, options) => { calls.push([url, options]); return json({ workspace: {}, etag: 'next' }); } });
    const workspace = { schemaVersion: 1, articles: [] };
    await api.capability(controller.signal); await api.load(controller.signal); await api.save(workspace, 'prior', controller.signal); await api.history(); await api.restore('revision-one', 'next'); await api.publish('next', 'Reviewed controls and privacy.'); await api.releases();
    assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
        ['https://same-origin.test/api/help/cms/capability', 'GET'], ['https://same-origin.test/api/help/cms', 'GET'], ['https://same-origin.test/api/help/cms', 'PUT'], ['https://same-origin.test/api/help/cms/history', 'GET'], ['https://same-origin.test/api/help/cms/restore', 'POST'], ['https://same-origin.test/api/help/cms/publish', 'POST'], ['https://same-origin.test/api/help/cms/releases', 'GET'],
    ]);
    for (const [, options] of calls) { assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.headers['X-CareAround-Session'], '1'); }
    assert.equal(calls[0][1].signal, controller.signal);
    assert.deepEqual(JSON.parse(calls[2][1].body), { workspace, etag: 'prior' });
    assert.deepEqual(JSON.parse(calls[4][1].body), { revisionId: 'revision-one', etag: 'next' });
    assert.deepEqual(JSON.parse(calls[5][1].body), { etag: 'next', reviewNote: 'Reviewed controls and privacy.', approved: true });
});

test('a save conflict or network failure never retries a content mutation', async () => {
    let count = 0;
    const api = createHelpContentApi({ base: '/api', fetchImpl: async () => { count++; return json({ error: 'A newer revision exists.', code: 'CONFLICT' }, 409); } });
    await assert.rejects(api.save({}, 'stale'), (error) => error.status === 409 && error.code === 'CONFLICT');
    assert.equal(count, 1);
    const offline = createHelpContentApi({ fetchImpl: async () => { count++; throw new Error('Offline'); } });
    await assert.rejects(offline.publish('etag', 'Reviewed'), /Offline/);
    assert.equal(count, 2);
});

test('image upload sends article ownership context and preserves multipart boundaries', async () => {
    let request;
    const api = createHelpContentApi({ base: '/api', fetchImpl: async (url, options) => { request = { url, options }; return json({ assetId: 'a'.repeat(64) }); } });
    const file = new Blob(['fictional image'], { type: 'image/png' }), controller = new AbortController();
    const result = await api.upload(file, 'HC-09', controller.signal);
    assert.equal(request.url, '/api/help/cms/media');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.body.get('articleId'), 'HC-09');
    assert.equal(await request.options.body.get('file').text(), 'fictional image');
    assert.equal(request.options.headers['Content-Type'], undefined);
    assert.equal(request.options.signal, controller.signal);
    assert.equal(result.assetId, 'a'.repeat(64));
});

test('owner image bytes are credentialed and only supported image responses become preview blobs', async () => {
    const calls = [];
    const api = createHelpContentApi({ base: '/api', fetchImpl: async (url, options) => { calls.push([url, options]); return new Response('image', { headers: { 'Content-Type': 'image/webp' } }); } });
    const id = 'a'.repeat(64), controller = new AbortController();
    const blob = await api.media(id, controller.signal);
    assert.equal(blob.type, 'image/webp');
    assert.equal(calls[0][0], `/api/help/cms/media/${id}`);
    assert.equal(calls[0][1].credentials, 'include');
    assert.equal(calls[0][1].signal, controller.signal);
    assert.throws(() => api.media('../private'), /unavailable/);
    const html = createHelpContentApi({ fetchImpl: async () => new Response('<script>unsafe</script>', { headers: { 'Content-Type': 'text/html' } }) });
    await assert.rejects(html.media(id), /could not be previewed/);
});

test('unauthorised session response retains status and does not turn HTML into a workspace', async () => {
    const forbidden = createHelpContentApi({ fetchImpl: async () => json({ error: 'Owner access required.' }, 403) });
    await assert.rejects(forbidden.load(), (error) => error.status === 403);
    const html = createHelpContentApi({ fetchImpl: async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }) });
    await assert.rejects(html.load(), /unexpected response/);
});

test('publication retry reuses the reviewed release identity with explicit approval', async () => {
    let request;
    const api = createHelpContentApi({ base: '/api', fetchImpl: async (url, options) => { request = { url, options }; return json({ release: { id: 'release-one', status: 'queued' } }); } });
    await api.retry('release-one');
    assert.equal(request.url, '/api/help/cms/releases/release-one/retry');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), { approved: true });
    assert.throws(() => api.retry('../another-release'), /unavailable/);
});

test('draft rebase requires explicit approval and preserves server conflict details', async () => {
    let request;
    const api = createHelpContentApi({ base: '/api', fetchImpl: async (url, options) => { request = { url, options }; return json({ error: 'Conflicting edits.', conflicts: ['HC-09.title'] }, 409); } });
    await assert.rejects(api.rebase('current-etag'), (error) => error.status === 409 && error.conflicts[0] === 'HC-09.title');
    assert.equal(request.url, '/api/help/cms/rebase');
    assert.deepEqual(JSON.parse(request.options.body), { etag: 'current-etag', approved: true });
});

test('release job check requires explicit approval on the exact release identity', async () => {
    let request;
    const api = createHelpContentApi({ base: '/api', fetchImpl: async (url, options) => { request = { url, options }; return json({ release: { id: 'job-one', state: 'dispatch-unconfirmed', jobReconciled: true } }); } });
    await api.reconcile('job-one');
    assert.equal(request.url, '/api/help/cms/releases/job-one/reconcile');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), { approved: true });
    assert.throws(() => api.reconcile('../another-job'), /unavailable/);
});
