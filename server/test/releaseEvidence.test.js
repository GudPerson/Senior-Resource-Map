import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { readGitReleaseSource } from '../../scripts/release-provenance.mjs';
import { buildClientReleaseManifest, clientReleasePlugin } from '../../scripts/client-release-plugin.mjs';
import { deployWorkerRelease, workerReleaseArgs } from '../../scripts/deploy-worker-release.mjs';
import { makeWorkerReleaseManifest, currentWorkerRelease } from '../src/utils/workerRelease.js';
import { createReleaseRoutes } from '../src/routes/release.js';
import { readBoundedReleaseBody, verifySupportProductionRelease } from '../src/utils/supportReleaseVerification.js';
import worker from '../src/worker.js';
import { createReleaseFixture, releaseMetadata, releaseRevision, releaseVersion } from './fixtures/releaseFixture.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const clean = { sourceRevision: releaseRevision, sourceClean: true };
const unavailable = { sourceRevision: null, sourceClean: false };

test('release provenance uses the checked-out source and rejects provider metadata mismatches', () => {
    const calls = [];
    const git = (args) => { calls.push(args); return args[0] === 'rev-parse' ? releaseRevision : ''; };
    assert.deepEqual(readGitReleaseSource({ git, env: {} }), clean);
    assert.deepEqual(calls, [['rev-parse', 'HEAD'], ['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude)node_modules/**']]);
    assert.deepEqual(readGitReleaseSource({ git, env: { CF_PAGES: '1', CF_PAGES_COMMIT_SHA: releaseRevision } }), clean);
    for (const changes of [' M client/src/App.jsx', '?? server/src/new-route.js']) {
        const dirtyGit = (args) => args[0] === 'rev-parse' ? releaseRevision : changes;
        assert.deepEqual(readGitReleaseSource({ git: dirtyGit, env: {} }), unavailable);
        assert.throws(() => readGitReleaseSource({ git: dirtyGit, env: { CF_PAGES: '1' } }), /clean, identifiable/);
    }
    assert.deepEqual(readGitReleaseSource({ git: () => { throw new Error('No git'); }, env: {} }), unavailable);
    assert.deepEqual(readGitReleaseSource({ git: () => 'short-revision', env: {} }), unavailable);
    assert.throws(() => readGitReleaseSource({ git, env: { CF_PAGES_COMMIT_SHA: 'b'.repeat(40) } }), /does not match/);
});

test('client manifest hashes actual generated files and does not certify a dirty build', async () => {
    const fixture = await createReleaseFixture();
    assert.equal(fixture.manifest.htmlSha256, hash(fixture.files.get('/').body));
    assert.equal(fixture.manifest.entryAssets.length, 3);
    for (const asset of fixture.manifest.entryAssets) {
        assert.equal(asset.sha256, hash(fixture.files.get(asset.path).body));
        assert.equal(asset.bytes, fixture.files.get(asset.path).body.length);
    }
    const args = { html: fixture.files.get('/').body, readAsset: async (path) => fixture.files.get(path).body };
    const local = await buildClientReleaseManifest({ ...args, source: unavailable });
    assert.equal(local.sourceRevision, null);
    assert.equal(local.sourceClean, false);
    for (const html of ['<html></html>', '<script src="https://elsewhere.test/app.js"></script>', '<script src="/assets/../secret.js"></script>',
        '<link href="/assets/app.css">', Array.from({ length: 5 }, (_, n) => `<script src="/assets/${n}.js"></script>`).join('')]) {
        await assert.rejects(buildClientReleaseManifest({ ...args, html: Buffer.from(html), source: clean }), /missing or unexpected/);
    }
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(2 * 1024 * 1024 + 1)]) {
        await assert.rejects(buildClientReleaseManifest({ ...args, source: clean, readAsset: async () => bytes }), /limit/);
    }
    const plugin = clientReleasePlugin({ readSource: () => clean });
    assert.equal(plugin.apply, 'build');
    assert.equal(plugin.closeBundle, undefined, 'failed Rollup builds must not write release evidence');
    assert.equal(typeof plugin.writeBundle, 'function');
    let reads = 0;
    const changed = clientReleasePlugin({ readSource: () => reads++ ? unavailable : clean });
    changed.configResolved({ root: '/not-read-by-this-test', build: { outDir: 'dist' } });
    await assert.rejects(changed.writeBundle(), /Source changed/);
});

test('production verifier checks served shell and entry bytes, not a revision label alone', async () => {
    const fixture = await createReleaseFixture();
    const evidence = await verifySupportProductionRelease('both', fixture.fetcher, fixture.runtime);
    assert.equal(evidence.client.sourceRevision, releaseRevision);
    assert.equal(evidence.client.artifactSha256, fixture.manifest.htmlSha256);
    assert.equal(evidence.client.verificationMethod, 'client-entry-integrity');
    assert.equal(evidence.server.deploymentId, releaseVersion);
    assert.equal(evidence.server.verificationMethod, 'worker-runtime-version');
    assert.equal(evidence.client.healthy, true);
    assert.equal(evidence.server.healthy, true);
    assert.equal(fixture.requests.length, 5);
    for (const { url, options } of fixture.requests) {
        assert.equal(new URL(url).origin, 'https://app.carearound.sg');
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers['Cache-Control'], 'no-cache');
        assert.equal(options.headers['Accept-Encoding'], 'identity');
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.headers.Cookie, undefined);
        assert.equal(options.cf.cacheTtl, 0);
        assert.ok(options.signal instanceof AbortSignal);
    }
    await assert.rejects(verifySupportProductionRelease('https://private-host/', fixture.fetcher), { status: 400 });
});

test('invalid metadata and missing, changed or fallback client files fail closed', async (t) => {
    const cases = [
        ['unverified local build', (f) => Object.assign(f.manifest, unavailable)],
        ['wrong application', (f) => { f.manifest.application = 'different-app'; }],
        ['wrong target', (f) => { f.manifest.target = 'server'; }],
        ['unsupported schema', (f) => { f.manifest.schemaVersion = 2; }],
        ['untrusted provenance', (f) => { f.manifest.provenance = 'user-input'; }],
        ['missing entry list', (f) => { f.manifest.entryAssets = []; }],
        ['duplicate entry', (f) => { f.manifest.entryAssets.push(f.manifest.entryAssets[0]); }],
        ['excessive entries', (f) => { f.manifest.entryAssets = Array(5).fill(f.manifest.entryAssets[0]); }],
        ['cross-origin entry', (f) => { f.manifest.entryAssets[0].path = 'https://private-host/app.js'; }],
        ['private entry path', (f) => { f.manifest.entryAssets[0].path = '/api/private.js'; }],
        ['invalid hash', (f) => { f.manifest.entryAssets[0].sha256 = 'short'; }],
        ['excessive declared bytes', (f) => { f.manifest.entryAssets[0].bytes = 2 * 1024 * 1024 + 1; }],
        ['no application script', (f) => { f.manifest.entryAssets = f.manifest.entryAssets.filter((a) => !a.path.startsWith('/assets/app-123.js')); }],
        ['changed shell', (f) => { f.files.get('/').body = Buffer.from('<html>wrong deployment</html>'); }],
        ['entry absent from shell', (f) => { f.manifest.entryAssets[0].path = '/assets/absent.css'; }],
        ['missing asset', (f) => { f.files.delete('/assets/app-123.js'); }],
        ['fallback HTML asset', (f) => { f.files.get('/assets/app-123.js').type = 'text/html'; }],
        ['changed asset bytes', (f) => { f.files.get('/assets/app-123.js').body = Buffer.from('wrong code'); }],
        ['wrong asset length', (f) => { f.manifest.entryAssets[0].bytes++; }],
    ];
    for (const [name, change] of cases) await t.test(name, async () => {
        const fixture = await createReleaseFixture();
        change(fixture);
        await assert.rejects(verifySupportProductionRelease('client', fixture.fetcher), { status: 503, message: 'Production release evidence is unavailable. No fix update was sent.' });
        assert.ok(fixture.requests.every(({ url }) => new URL(url).origin === 'https://app.carearound.sg'));
    });
    for (const response of [Response.json({ sourceRevision: releaseRevision }), new Response('<html>fallback</html>'),
        new Response('bad json', { headers: { 'Content-Type': 'application/json' } }), new Response(null, { status: 302 })]) {
        await assert.rejects(verifySupportProductionRelease('client', async () => response), { status: 503 });
    }
    await assert.rejects(verifySupportProductionRelease('client', async () => { throw new Error('Network unavailable'); }), { status: 503 });
});

test('release body limits cancel oversized streams even when content length is absent or false', async () => {
    for (const declared of [null, '1', '100']) {
        let cancelled = false;
        const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(6)); }, cancel() { cancelled = true; } });
        const response = new Response(body, { headers: declared === null ? {} : { 'Content-Length': declared } });
        await assert.rejects(readBoundedReleaseBody(response, 5), /limit/);
        assert.equal(cancelled, true);
        assert.equal(response.body.locked, false);
    }
    assert.deepEqual(await readBoundedReleaseBody(new Response(new Uint8Array([1, 2, 3])), 3), new Uint8Array([1, 2, 3]));
    await assert.rejects(readBoundedReleaseBody(new Response(null), 5), /limit/);
});

test('Worker evidence requires matching compiled revision, platform version and production origin', async () => {
    const valid = makeWorkerReleaseManifest(releaseRevision, releaseMetadata);
    assert.equal(valid.deploymentId, releaseVersion);
    assert.equal(currentWorkerRelease({ CF_VERSION_METADATA: releaseMetadata, SOURCE_REVISION: releaseRevision }), null, 'runtime variables cannot inject the compiled source revision');
    for (const [revision, metadata] of [[null, releaseMetadata], [releaseRevision.slice(0, 8), releaseMetadata],
        [releaseRevision, null], [releaseRevision, { ...releaseMetadata, tag: 'git-wrong' }],
        [releaseRevision, { ...releaseMetadata, id: 'not-a-version-id' }], [releaseRevision, { ...releaseMetadata, timestamp: 'invalid' }]]) {
        assert.equal(makeWorkerReleaseManifest(revision, metadata), null);
    }
    let fetches = 0;
    const neverFetch = async () => { fetches++; throw new Error('Worker must not call itself over public HTTP'); };
    const fixture = await createReleaseFixture();
    assert.equal((await verifySupportProductionRelease('server', neverFetch, fixture.runtime)).server.sourceRevision, releaseRevision);
    assert.equal(fetches, 0);
    for (const requestUrl of ['http://api.carearound.sg/api/support', 'https://preview.workers.dev/api/support',
        'https://api.carearound.sg.evil.test/api/support', 'http://localhost/api/support']) {
        await assert.rejects(verifySupportProductionRelease('server', neverFetch, { ...fixture.runtime, requestUrl }), { status: 503 });
    }
    for (const release of [null, { ...valid, sourceClean: false }, { ...valid, deploymentId: 'forged' }, { ...valid, uploadedAt: '' }]) {
        await assert.rejects(verifySupportProductionRelease('server', neverFetch, { ...fixture.runtime, release }), { status: 503 });
    }
});

test('release route is non-caching, fails closed without compiled identity, and preserves health', async () => {
    const missing = await worker.fetch(new Request('https://api.carearound.sg/api/release'), { CF_VERSION_METADATA: releaseMetadata }, { waitUntil() {} });
    assert.equal(missing.status, 503);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await missing.json(), { error: 'Verified release metadata is unavailable.' });
    const health = await worker.fetch(new Request('https://api.carearound.sg/api/health'), {}, { waitUntil() {} });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    const app = new Hono();
    app.route('/api/release', createReleaseRoutes({ observe: (env) => makeWorkerReleaseManifest(releaseRevision, env.CF_VERSION_METADATA) }));
    const available = await app.request('/api/release', {}, { CF_VERSION_METADATA: releaseMetadata });
    assert.equal(available.status, 200);
    assert.equal(available.headers.get('cache-control'), 'no-store');
    assert.equal((await available.json()).sourceRevision, releaseRevision);
});

test('guarded Worker command preserves release-line gates and rejects revision/config overrides', () => {
    const calls = [];
    const run = (...args) => { calls.push(args); return { status: 0 }; };
    const args = { validate() { calls.push('validated'); }, readSource: () => clean, run, extraArgs: [] };
    deployWorkerRelease(args);
    assert.equal(calls[0], 'validated');
    assert.equal(calls[1][0], 'npx');
    assert.deepEqual(calls[1][1], ['wrangler', 'deploy', '--config', 'wrangler.toml', '--tag', `git-${releaseRevision}`,
        '--define', `__CAREAROUND_SOURCE_REVISION__:"${releaseRevision}"`]);
    assert.equal(calls[1][2].shell, false);
    assert.ok(calls[1][2].cwd.endsWith('/server'));
    const noRun = () => assert.fail('deployment must not be attempted');
    assert.throws(() => deployWorkerRelease({ ...args, run: noRun, validate() { throw new Error('Release line rejected'); } }), /Release line rejected/);
    assert.throws(() => deployWorkerRelease({ ...args, run: noRun, readSource: () => unavailable }), /clean, identifiable/);
    for (const extraArgs of [['--env', 'preview'], ['--define', 'fake'], ['--config', '/elsewhere']]) {
        assert.throws(() => deployWorkerRelease({ ...args, run: noRun, extraArgs }), /overrides/);
        assert.throws(() => workerReleaseArgs(clean, extraArgs), /overrides/);
    }
    for (const result of [{ status: 1 }, { status: null, error: new Error('could not start') }]) {
        assert.throws(() => deployWorkerRelease({ ...args, run: () => result }), /did not complete/);
    }
});
