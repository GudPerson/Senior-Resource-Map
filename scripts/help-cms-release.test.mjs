import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
    digestValue, sha256Bytes, httpsOrigin, readReleaseConfiguration, assertPrivateAutomation,
    validateSnapshot, validateOwnerReview, assertContentOnlyPaths, validateBaseSource, validateSourceIdentities,
    deriveEditorialCorrections, collectApprovedMedia, readBoundedBytes, verifyPublicArtifacts, verifyOrdinaryHtmlDelivery,
    pairedRelease, observeVerifiedPublicRelease, deploymentArguments, pagesDeployment, runnerReceipt, assertLatestHelpContentForAppRelease, validatedWranglerPath, validateRecoverySurfaces, priorReleaseState, postReceipt, postCheckpoint, uncommittedContentPaths, assertPrivateSeedUntracked, verifiedPreviousContentDigest,
} from './help-cms-release.mjs';

const revision = 'a'.repeat(40), buildRevision = 'b'.repeat(40);
const oldWorkerId = '11111111-1111-4111-8111-111111111111';
const releaseId = '1791000000000-' + oldWorkerId, jobId = '22222222-2222-4222-8222-222222222222';
const workerId = '33333333-3333-4333-8333-333333333333', pagesId = '44444444-4444-4444-8444-444444444444';
const review = { date: '2026-10-03', owner: 'Verified owner', method: 'owner-cms-review', sourceRevision: revision, evidence: ['Owner checked wording, privacy and Guide answer.'] };
const fact = { id: 'help-overview', title: 'Overview', keywords: ['overview'], message: 'Old wording.', route: '/help', evidence: 'Reviewed source', reviewed: '2026-10-02' };
const topic = { id: 'overview', title: 'Overview', keywords: ['overview'], message: 'Old wording.', route: '/help', label: 'Read help' };
const article = { id: 'HC-01', slug: 'overview', title: 'Overview', summary: 'Read help.', status: 'approved', visibility: 'public',
    sections: [{ id: 'overview', title: 'Overview', facts: [fact], media: [] }] };
function fixturePublication() {
    return { schemaVersion: 1, version: 'cms.2', baseContentVersion: 'baseline.1', review: structuredClone(review),
        manifest: { version: 'cms.2', articleOrder: ['HC-01'], guideFactOrder: ['help-overview'], topics: [{ id: 'overview', label: 'Read help' }], retiredFactIds: [] },
        articles: [structuredClone(article)] };
}
function snapshot(publication = fixturePublication()) {
    return { id: releaseId, jobId, baseSourceRevision: revision, version: publication.version, publication, snapshotDigest: digestValue(publication) };
}
function expected(envelope = snapshot()) {
    return { releaseId, jobId, baseSourceRevision: revision, snapshotDigest: envelope.snapshotDigest };
}
function temp(t, prefix = 'carearound-help-adapter-test-') {
    const root = mkdtempSync(join(tmpdir(), prefix));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
}
const responseJson = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const baseline = { facts: [{ id: fact.id, digest: digestValue(fact) }], topics: [{ id: topic.id, digest: digestValue(topic) }], editorialCorrections: [] };
const compiled = (f = fact, top = topic) => ({ facts: f ? [{ ...f, articleId: 'HC-01', sectionId: 'overview', articleRoute: '/help-centre/overview#overview', visibility: 'public' }] : [], topics: top ? [top] : [] });

const pagesConfiguration = { cloudflareAccountId: 'f'.repeat(32), cloudflareToken: 'fictional-cloudflare-token' };
const deployment = (overrides = {}) => ({ id: pagesId, environment: 'production', created_on: '2026-10-05T12:00:00Z',
    deployment_trigger: { metadata: { commit_hash: buildRevision } }, latest_stage: { status: 'success' }, ...overrides });
const unrelatedDeployments = () => Array.from({ length: 25 }, () => deployment({
    deployment_trigger: { metadata: { commit_hash: revision } },
}));

test('Pages lookup uses the accepted page size and requires the exact successful production build identity', async () => {
    const requested = [];
    const result = await pagesDeployment(pagesConfiguration, buildRevision, async (url, options) => {
        requested.push(new URL(url));
        assert.equal(options.headers.Authorization, 'Bearer fictional-cloudflare-token');
        return responseJson({ success: true, result: [
            deployment({ environment: 'preview', created_on: '2026-10-06T12:00:00Z' }),
            deployment({ latest_stage: { status: 'failure' }, created_on: '2026-10-06T12:00:00Z' }),
            deployment({ deployment_trigger: { metadata: { commit_hash: revision } } }),
            deployment({ id: 'unverified-id' }),
            deployment({ id: oldWorkerId, created_on: '2026-10-04T12:00:00Z' }),
            deployment(),
        ] });
    });
    assert.equal(result, pagesId);
    assert.equal(requested.length, 1);
    assert.equal(requested[0].searchParams.get('per_page'), '25');
    assert.equal(requested[0].searchParams.get('page'), '1');
});

test('Pages recovery finds an older exact build on the second page', async () => {
    const requested = [];
    const result = await pagesDeployment(pagesConfiguration, buildRevision, async url => {
        const page = Number(new URL(url).searchParams.get('page')); requested.push(page);
        return responseJson({ success: true, result: page === 1 ? unrelatedDeployments() : [deployment()] });
    });
    assert.equal(result, pagesId);
    assert.deepEqual(requested, [1, 2]);
});

test('Pages lookup chooses the newest matching deployment across the bounded pages', async () => {
    const result = await pagesDeployment(pagesConfiguration, buildRevision, async url => {
        const first = Number(new URL(url).searchParams.get('page')) === 1;
        const entries = first ? unrelatedDeployments() : [deployment()];
        if (first) entries[0] = deployment({ id: oldWorkerId, created_on: '2026-10-04T12:00:00Z' });
        return responseJson({ success: true, result: entries });
    });
    assert.equal(result, pagesId);
});

test('Pages lookup stops after at most one hundred deployment records and refuses a missing build', async () => {
    const requested = [];
    await assert.rejects(pagesDeployment(pagesConfiguration, buildRevision, async url => {
        const page = Number(new URL(url).searchParams.get('page')); requested.push(page);
        return responseJson({ success: true, result: unrelatedDeployments() });
    }), /no successful deployment/);
    assert.deepEqual(requested, [1, 2, 3, 4]);
});

test('Pages lookup refuses HTTP, provider and malformed pagination responses', async () => {
    for (const response of [
        () => new Response(JSON.stringify({ success: false }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
        () => responseJson({ success: false, result: [deployment()] }),
        () => responseJson({ success: true, result: null }),
        () => responseJson({ success: true, result: [...unrelatedDeployments(), deployment()] }),
    ]) await assert.rejects(pagesDeployment(pagesConfiguration, buildRevision, async () => response()));
    let requests = 0;
    await assert.rejects(pagesDeployment(pagesConfiguration, buildRevision, async () => {
        requests++;
        if (requests === 2) return responseJson({ success: false });
        const entries = unrelatedDeployments(); entries[0] = deployment();
        return responseJson({ success: true, result: entries });
    }), /metadata is unavailable/);
    assert.equal(requests, 2);
});

test('Pages deployment metadata retains its per-response byte bound', async () => {
    await assert.rejects(pagesDeployment(pagesConfiguration, buildRevision, async () => responseJson({
        success: true, result: [deployment()], padding: 'x'.repeat(2 * 1024 * 1024),
    })), /exceeds its size limit/);
});

test('snapshot identity, approved digest and schema are bound to exactly one dispatch', () => {
    const good = snapshot();
    assert.equal(validateSnapshot(good, expected(good)), good.publication);
    const idEnvelope = { ...good, releaseId: good.id, id: undefined };
    assert.equal(validateSnapshot(idEnvelope, expected(good)), good.publication);
    for (const mutate of [
        value => value.jobId = releaseId,
        value => value.baseSourceRevision = buildRevision,
        value => value.publication.articles[0].summary = 'Unreviewed tamper.',
        value => value.publication.schemaVersion = 2,
    ]) {
        const bad = structuredClone(good); mutate(bad);
        assert.throws(() => validateSnapshot(bad, expected(good)));
    }
});
test('owner review must be deliberate, named and source bound', () => {
    assert.equal(validateOwnerReview(review, revision).reviewer, review.owner);
    for (const change of [{ owner: '' }, { method: 'test-pass' }, { evidence: [] }, { date: 'invalid' }, { sourceRevision: buildRevision }]) {
        assert.throws(() => validateOwnerReview({ ...review, ...change }, revision), /owner review/);
    }
});
test('drafts, traversal addresses, duplicate identities and restricted media cannot enter the snapshot', () => {
    for (const mutate of [
        p => p.articles[0].status = 'draft',
        p => p.articles[0].slug = '../../server',
        p => p.articles.push(structuredClone(p.articles[0])),
        p => { p.articles[0].visibility = 'admin'; p.articles[0].sections[0].media = [{ type: 'image', assetId: 'c'.repeat(64) }]; },
        p => p.manifest.articleOrder = [],
    ]) {
        const publication = fixturePublication(); mutate(publication);
        const envelope = snapshot(publication);
        assert.throws(() => validateSnapshot(envelope, expected(envelope)));
    }
});
test('configured origin cannot smuggle a token through credentials, a path, query or insecure redirect', () => {
    assert.equal(httpsOrigin('https://api.carearound.sg'), 'https://api.carearound.sg');
    for (const origin of ['http://api.carearound.sg', 'https://user:secret@api.carearound.sg', 'https://api.carearound.sg/api', 'https://api.carearound.sg?token=secret', 'https://api.carearound.sg:8443']) {
        assert.throws(() => httpsOrigin(origin));
    }
});
test('public or unverified runner configuration is rejected before retrieving private content', async () => {
    const env = { HELP_CMS_RELEASE_ID: releaseId, HELP_CMS_JOB_ID: jobId, HELP_CMS_CONTENT_DIGEST: 'c'.repeat(64), HELP_CMS_BASE_SOURCE_REVISION: revision,
        HELP_CMS_RELEASE_TOKEN: 'private-placeholder-'.repeat(2), HELP_CMS_API_ORIGIN: 'https://api.carearound.sg', GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Owner/private-releases', GITHUB_TOKEN: 'fixture-token', HELP_CMS_WRANGLER_VERSION: '4.145.0' };
    const config = readReleaseConfiguration(env);
    await assertPrivateAutomation(config, async () => responseJson({ private: true, full_name: 'Owner/private-releases' }));
    assert.throws(() => readReleaseConfiguration({ ...env, GITHUB_REPOSITORY: 'GudPerson/Senior-Resource-Map' }), /private automation/);
    await assert.rejects(assertPrivateAutomation(config, async () => responseJson({ private: false, full_name: 'Owner/private-releases' })), /private automation/);
    await assert.rejects(assertPrivateAutomation(config, async () => responseJson({ private: true, full_name: 'Other/private-releases' })), /private automation/);
});
test('release path allowlist cannot modify runtime, secrets, workflow or frozen test baseline', () => {
    assertContentOnlyPaths(['content/help/articles/hc-01-overview.json', 'content/help/manifest.json',
        'content/help/editorial-corrections.json', 'client/src/generated/helpArticles.json', 'server/src/generated/helpKnowledge.js',
        'client/public/help-content-status.json']);
    for (const file of ['server/wrangler.toml', 'server/.env', 'client/src/App.jsx', 'server/test/fixtures/helpMigrationBaseline.json',
        'content/help/articles/../manifest.json', 'content/help/articles/hc-01-overview.json/../../server', '.github/workflows/release.yml',
        'server/src/generated/helpCmsSeed.js']) {
        assert.throws(() => assertContentOnlyPaths([file]), /outside/);
    }
});
test('public source drift, dirty source and a different repository fail closed', () => {
    const state = { head: revision, originMain: revision, clean: true, remote: 'https://github.com/GudPerson/Senior-Resource-Map.git' };
    validateBaseSource(state, revision);
    for (const change of [{ head: buildRevision }, { originMain: buildRevision }, { clean: false }, { remote: 'https://github.com/Other/Repository.git' }]) {
        assert.throws(() => validateBaseSource({ ...state, ...change }, revision));
    }
});
test('private seed is ignored and a force-staged seed is rejected before content hydration', t => {
    const root = temp(t), run = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    mkdirSync(join(root, 'server/src/generated'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), '/server/src/generated/helpCmsSeed.js\n');
    writeFileSync(join(root, 'server/src/generated/helpCmsSeed.js'), 'export const HELP_CMS_SEED = {};\n');
    run(['init', '--quiet']);
    assertPrivateSeedUntracked(root);
    assert.equal(run(['ls-files', '--', 'server/src/generated/helpCmsSeed.js']).trim(), '');
    run(['add', '--force', '--', 'server/src/generated/helpCmsSeed.js']);
    assert.throws(() => assertPrivateSeedUntracked(root), /must remain untracked/);
});
test('stable article access, citation identities and fact routes survive content hydration', () => {
    const p = fixturePublication(), seed = { articles: [structuredClone(article)], manifest: structuredClone(p.manifest) };
    p.articles[0].sections[0].facts[0].message = 'Reviewed new wording.';
    validateSourceIdentities(p, seed);
    for (const mutate of [
        value => value.articles[0].visibility = 'admin',
        value => value.articles[0].slug = 'new-address',
        value => value.articles[0].sections[0].facts[0].route = '/delete-account',
        value => value.articles[0].sections[0].id = 'replacement-anchor',
        value => value.manifest.guideFactOrder = [],
    ]) {
        const bad = structuredClone(p); mutate(bad);
        assert.throws(() => validateSourceIdentities(bad, seed));
    }
});
test('unchanged legacy facts and original reviewed correction exceptions need no mutable override', () => {
    assert.deepEqual(deriveEditorialCorrections({ baseline, compiled: compiled(), publication: fixturePublication() }), { facts: [], topics: [] });
    const original = { ...baseline, editorialCorrections: [{ id: fact.id, expectedDigest: digestValue({ ...fact, message: 'Original documented correction.' }) }] };
    assert.deepEqual(deriveEditorialCorrections({ baseline: original, compiled: compiled({ ...fact, message: 'Original documented correction.' }), publication: fixturePublication() }), { facts: [], topics: [] });
});
test('fact and topic wording changes produce review records and preserve matching previous owner review', () => {
    const changedFact = { ...fact, message: 'Owner reviewed new wording.' }, changedTopic = { ...topic, message: changedFact.message };
    const first = deriveEditorialCorrections({ baseline, compiled: compiled(changedFact, changedTopic), publication: fixturePublication() });
    assert.equal(first.facts[0].expectedDigest, digestValue(changedFact));
    assert.equal(first.topics[0].expectedDigest, digestValue(changedTopic));
    assert.equal(first.facts[0].reviewer, review.owner);
    const previous = structuredClone(first); previous.facts[0].reviewer = 'Previous verified owner';
    const again = deriveEditorialCorrections({ baseline, compiled: compiled(changedFact, changedTopic), publication: fixturePublication(), previous });
    assert.equal(again.facts[0].reviewer, 'Previous verified owner');
    assert.deepEqual(baseline.facts, [{ id: fact.id, digest: digestValue(fact) }]);
});
test('retirements require archived source identities and record owner review for facts and topics', () => {
    const p = fixturePublication(); p.manifest.retiredFactIds = [fact.id];
    const retired = deriveEditorialCorrections({ baseline, compiled: compiled(null, null), publication: p });
    assert.equal(retired.facts[0].kind, 'retired'); assert.equal(retired.topics[0].kind, 'retired');
    assert.equal(retired.facts[0].reviewedAt, review.date);
    assert.throws(() => deriveEditorialCorrections({ baseline, compiled: compiled(null, null), publication: fixturePublication() }), /archived source/);
    assert.throws(() => deriveEditorialCorrections({ baseline, compiled: compiled(), publication: fixturePublication(), previous: { facts: [{ id: fact.id, kind: 'changed' }], topics: [] } }), /registry/);
});
test('private media bytes must match the immutable asset hash and canonical signature validator', async () => {
    const bytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
    const assetId = sha256Bytes(bytes), p = fixturePublication();
    p.articles[0].sections[0].media = [{ type: 'image', assetId }];
    let validated = false;
    const config = { apiOrigin: 'https://api.carearound.sg', releaseId, releaseToken: 'fixture-private-token' };
    const fetchImpl = async (url, options) => {
        assert.equal(url, config.apiOrigin + '/api/help/cms/release/' + releaseId + '/media/' + assetId);
        assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer ' + config.releaseToken);
        return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
    };
    const media = await collectApprovedMedia(p, config, { fetchImpl, validateImage: (value, mime) => { validated = true; assert.equal(mime, 'image/png'); assert.equal(value.length, bytes.length); } });
    assert.equal(validated, true); assert.equal(media[0].sha256, assetId); assert.equal(media[0].bytes, bytes.length);
    await assert.rejects(collectApprovedMedia(p, config, { fetchImpl: async () => new Response('wrong', { headers: { 'Content-Type': 'image/png' } }), validateImage: () => {} }), /content identity/);
    p.articles[0].visibility = 'admin';
    await assert.rejects(collectApprovedMedia(p, config, { fetchImpl, validateImage: () => {} }), /restricted/);
});
test('streamed HTTP bodies cannot exceed a limit regardless of content-length', async () => {
    await assert.rejects(readBoundedBytes(new Response('too large', { headers: { 'Content-Length': '1' } }), 2), /size limit/);
});
function artifactFixture(t) {
    const dist = temp(t);
    const files = { 'index.html': '<html>Approved build</html>', 'release.json': '{}', 'help-content-status.json': '{"version":"cms.2"}', 'other.json': '{"required":"all files"}', '_headers': 'private platform controls' };
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dist, name), text);
    return { dist, files };
}
const securityHeaders = { 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
    'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(self), payment=()' };
const artifactNameAtUrl = url => {
    const path = new URL(url).pathname;
    return path === '/__help-release-proof/home' ? 'index.html' : path === '/__help-release-proof/offline' ? 'offline.html' : decodeURIComponent(path.slice(1));
};
function artifactResponse(name, body, mime = name.endsWith('.html') ? 'text/html' : 'application/json') {
    return new Response(body, { headers: { ...securityHeaders, 'Content-Type': mime, 'Cache-Control': 'private, no-store, no-transform' } });
}
test('custom domain parity checks every public artifact and retains failures before a successful retry', async t => {
    const { dist, files } = artifactFixture(t), counts = {};
    const result = await verifyPublicArtifacts({ dist, appOrigin: 'https://app.carearound.sg', releaseId, probeId: jobId, delay: async () => {}, fetchImpl: async url => {
        const name = artifactNameAtUrl(url); counts[name] = (counts[name] || 0) + 1;
        const value = name === 'other.json' && counts[name] === 1 ? 'stale' : files[name];
        return artifactResponse(name, value);
    } });
    assert.equal(result.passed, true); assert.equal(result.checked, 4); assert.equal(counts._headers, undefined);
    assert.equal(result.records.find(record => record.path === 'other.json').failures.length, 1);
});
test('matching public bytes with wrong MIME do not establish artifact parity', async t => {
    const { dist, files } = artifactFixture(t);
    const result = await verifyPublicArtifacts({ dist, appOrigin: 'https://app.carearound.sg', releaseId, probeId: jobId, attempts: 1, fetchImpl: async url => {
        const name = artifactNameAtUrl(url);
        return artifactResponse(name, files[name], 'text/html');
    } });
    assert.equal(result.passed, false); assert.equal(result.records.filter(record => !record.passed).length, 3);
});
function htmlArtifactFixture(t) {
    const { dist, files } = artifactFixture(t); mkdirSync(join(dist, 'nested'), { recursive: true });
    Object.assign(files, { 'offline.html': '<html>Approved offline</html>', 'nested/index.html': '<html>Nested index</html>', 'nested/offline.html': '<html>Nested offline</html>' });
    for (const name of ['offline.html', 'nested/index.html', 'nested/offline.html']) writeFileSync(join(dist, name), files[name]);
    return { dist, files };
}
async function htmlAssetProof(t) {
    const { dist, files } = htmlArtifactFixture(t);
    const proof = await verifyPublicArtifacts({ dist, appOrigin: 'https://app.carearound.sg', releaseId, probeId: jobId, attempts: 1,
        fetchImpl: async url => artifactResponse(artifactNameAtUrl(url), files[artifactNameAtUrl(url)]) });
    assert.equal(proof.passed, true); return { dist, files, proof };
}
test('only the two root HTML files map to dedicated same-origin asset proofs, using the distinct UUID job identity', async t => {
    const { dist, files } = htmlArtifactFixture(t), requests = [];
    const { onRequest: index } = await import('../client/functions/__help-release-proof/home.js');
    const { onRequest: offline } = await import('../client/functions/__help-release-proof/offline.js');
    const result = await verifyPublicArtifacts({ dist, appOrigin: 'https://app.carearound.sg', releaseId, probeId: jobId, attempts: 1,
        fetchImpl: async (url, options) => {
            const target = new URL(url), name = artifactNameAtUrl(url);
            assert.equal(target.origin, 'https://app.carearound.sg'); assert.equal(target.searchParams.get('help_release_check'), jobId); assert.equal(options.redirect, 'error');
            requests.push(target.pathname);
            if (!['index.html', 'offline.html'].includes(name)) return artifactResponse(name, files[name]);
            return (name === 'index.html' ? index : offline)({ request: new Request(url), env: { ASSETS: { fetch: async request => {
                assert.equal(request.url, name === 'index.html' ? 'https://app.carearound.sg/' : 'https://app.carearound.sg/offline');
                return artifactResponse(name, files[name]);
            } } } });
        } });
    assert.equal(result.passed, true); assert.equal(result.checked, 7);
    assert.deepEqual(requests, ['/help-content-status.json', '/__help-release-proof/home', '/nested/index.html', '/nested/offline.html', '/__help-release-proof/offline', '/other.json', '/release.json']);
    for (const record of result.records) {
        assert.equal(record.bytes, Buffer.byteLength(files[record.path])); assert.equal(record.sha256, sha256Bytes(files[record.path]));
    }
    const envelope = snapshot(), receipt = runnerReceipt(expected(envelope), { version: 'cms.2', contentDigest: 'd'.repeat(64), buildSourceRevision: buildRevision }, { state: 'published', workerVersionId: workerId, pagesDeploymentId: pagesId });
    await postReceipt({ ...expected(envelope), apiOrigin: 'https://api.example.test', releaseToken: 'fixture-only' }, receipt, async (url, options) => {
        assert.equal(url, 'https://api.example.test/api/help/cms/release/' + releaseId + '/receipt'); assert.equal(JSON.parse(options.body).jobId, jobId);
        return responseJson({ release: { id: releaseId, state: 'published' } });
    });
    await assert.rejects(verifyPublicArtifacts({ dist, appOrigin: 'https://app.carearound.sg', releaseId, probeId: releaseId }), /proof identity/);
});
test('raw HTML proof refuses redirects, mismatched bytes/MIME/cache and missing security headers without skipping other files', async t => {
    for (const failure of ['redirect', 'status', 'followed', 'bytes', 'mime', 'cache', 'security']) {
        const { dist, files } = htmlArtifactFixture(t), requests = [];
        const result = await verifyPublicArtifacts({ dist, appOrigin: 'https://app.carearound.sg', releaseId, probeId: jobId, attempts: 1, fetchImpl: async (url, options) => {
            assert.equal(options.redirect, 'error'); requests.push(new URL(url).pathname);
            const name = artifactNameAtUrl(url), proof = ['index.html', 'offline.html'].includes(name);
            const response = proof && ['redirect', 'status'].includes(failure) ? new Response('', { status: failure === 'redirect' ? 308 : 201, headers: { Location: 'https://other.example/', 'Content-Type': 'text/html' } })
                : artifactResponse(name, proof && failure === 'bytes' ? 'X' + files[name].slice(1) : files[name], proof && failure === 'mime' ? 'application/json' : undefined);
            if (proof && failure === 'followed') Object.defineProperty(response, 'redirected', { value: true });
            if (proof && failure === 'cache') response.headers.set('Cache-Control', 'public');
            if (proof && failure === 'security') response.headers.delete('Content-Security-Policy');
            return response;
        } });
        assert.equal(result.passed, false); assert.equal(result.checked, 7); assert.equal(requests.length, 7);
        assert.deepEqual(result.records.filter(record => !record.passed).map(record => record.path), ['index.html', 'offline.html']);
    }
});
const beacon = '<script defer src="https://static.cloudflareinsights.com/beacon.min.js/vfixture"></script>';
function ordinaryResponse(url, body = '<html><body>Ordinary app' + beacon + '</body></html>') {
    return new Response(body, { headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': new URL(url).pathname === '/' ? 'public, max-age=0, must-revalidate' : 'no-cache' } });
}
test('ordinary delivery independently preserves analytics, cache and same-deployment security on six unmodified page requests', async t => {
    const { proof } = await htmlAssetProof(t), requests = [];
    const result = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId, fetchImpl: async (url, options) => {
        assert.equal(options.redirect, 'error'); assert.deepEqual(options.headers, {
            'Cache-Control': 'no-cache', 'User-Agent': 'CareAround-Release-Verification', Accept: 'text/html',
        }); requests.push(url);
        return ordinaryResponse(url, options.headers.Accept === 'text/html' ? undefined : '<html>Generic response without analytics</html>');
    } });
    assert.equal(result.passed, true); assert.equal(result.checked, 6); assert.equal(result.checks.every(record => record.beaconCount === 1 && record.securityHeadersMatch), true);
    assert.deepEqual(requests, ['https://app.carearound.sg/', 'https://app.carearound.sg/?help_release_check=invalid',
        'https://app.carearound.sg/?help_release_check=' + jobId + '&help_release_check=' + jobId,
        'https://app.carearound.sg/offline', 'https://app.carearound.sg/offline?help_release_check=invalid',
        'https://app.carearound.sg/offline?help_release_check=' + jobId + '&help_release_check=' + jobId]);
});
test('a generic response profile without document Accept still fails the ordinary analytics gate', async t => {
    const { proof } = await htmlAssetProof(t);
    for (const accept of [undefined, '*/*']) {
        const result = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId,
            fetchImpl: async (url, options) => {
                const sentHeaders = { ...options.headers };
                if (accept === undefined) delete sentHeaders.Accept; else sentHeaders.Accept = accept;
                assert.equal(sentHeaders['User-Agent'], 'CareAround-Release-Verification');
                return ordinaryResponse(url, sentHeaders.Accept === 'text/html' ? undefined : '<html>Generic response without analytics</html>');
            } });
        assert.equal(result.passed, false); assert.equal(result.checked, 6);
        assert.equal(result.checks.every(record => record.beaconCount === 0 && !record.passed), true);
    }
});
test('the current provider-shaped executable module beacon passes while inert or nomodule variants fail', async t => {
    const { proof } = await htmlAssetProof(t);
    const moduleBeacon = '<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495" integrity="sha512-fixture-only" data-cf-beacon=\'{"version":"fixture-only"}\' crossorigin="anonymous"></script>';
    const result = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId,
        fetchImpl: async (url, options) => {
            assert.equal(options.headers.Accept, 'text/html'); assert.equal(options.headers['User-Agent'], 'CareAround-Release-Verification');
            return ordinaryResponse(url, moduleBeacon);
        } });
    assert.equal(result.passed, true); assert.equal(result.checked, 6); assert.equal(result.checks.every(record => record.beaconCount === 1), true);
    for (const invalid of [moduleBeacon.replace('type="module"', 'type="application/json"'), moduleBeacon.replace('type="module"', 'type="text/plain"'),
        moduleBeacon.replace('type="module"', 'type="module" nomodule'), moduleBeacon.replace('static.cloudflareinsights.com', 'other.example')]) {
        const failed = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId, fetchImpl: async url => ordinaryResponse(url, invalid) });
        assert.equal(failed.passed, false); assert.equal(failed.checks.every(record => record.beaconCount === 0), true);
    }
});
test('ordinary analytics cannot pass with text, comments, inert script types, raw-text containers, foreign sources or duplicate beacons', async t => {
    const { proof } = await htmlAssetProof(t);
    const cases = ['https://static.cloudflareinsights.com/beacon.min.js', '<!--' + beacon + '-->', '<textarea>' + beacon + '</textarea>',
        '<style>' + beacon + '</style>', '<template>' + beacon + '</template>', '<svg>' + beacon + '</svg>',
        '<div title=\'' + beacon + '\'></div>', '<script>' + JSON.stringify(beacon) + '</script>',
        beacon.replace('<script ', '<script type="application/json" '), beacon.replace('<script ', '<script type="text/plain" '),
        beacon.replace('<script ', '<script nomodule '), beacon.replace('https:', 'http:'), beacon.replace('static.cloudflareinsights.com', 'other.example'), beacon + beacon];
    for (const body of cases) {
        const result = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId, fetchImpl: async url => ordinaryResponse(url, body) });
        assert.equal(result.passed, false, body); assert.equal(result.checks.every(record => !record.passed), true);
    }
    const jsType = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId,
        fetchImpl: async url => ordinaryResponse(url, beacon.replace('<script ', '<script type="text/javascript" ')) });
    assert.equal(jsType.passed, true);
});
test('ordinary status, MIME, redirects, bounded bytes, cache changes and each security-header regression block publication', async t => {
    const { proof } = await htmlAssetProof(t);
    const failures = ['status', 'mime', 'redirect', 'bytes', 'private-cache', 'transform-cache', ...Object.keys(securityHeaders)];
    for (const failure of failures) {
        const result = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId, fetchImpl: async url => {
            if (failure === 'status' || failure === 'redirect') return new Response('', { status: failure === 'status' ? 500 : 308, headers: { Location: 'https://other.example/' } });
            const response = ordinaryResponse(url, failure === 'bytes' ? 'X'.repeat(100000) : undefined);
            if (failure === 'mime') response.headers.set('Content-Type', 'application/json');
            if (failure === 'private-cache') response.headers.set('Cache-Control', 'private, no-store');
            if (failure === 'transform-cache') response.headers.set('Cache-Control', 'no-cache, no-transform');
            if (Object.hasOwn(securityHeaders, failure)) response.headers.delete(failure);
            return response;
        } });
        assert.equal(result.passed, false, failure); assert.equal(result.checked, 6);
    }
    const ordinary = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof: proof, probeId: jobId, fetchImpl: async url => ordinaryResponse(url, '<html>Analytics missing</html>') });
    const result = await pairedRelease(paired({ verify: async () => ({ passed: proof.passed && ordinary.passed, artifactCount: proof.checked, artifactChecks: proof.records, ordinaryHtml: ordinary }) }));
    assert.equal(result.state, 'partially-released');
    const receipt = runnerReceipt(expected(), { version: 'cms.2', contentDigest: 'd'.repeat(64), buildSourceRevision: buildRevision }, result);
    assert.equal(receipt.verification.passed, false); assert.equal(Object.hasOwn(receipt.verification, 'ordinaryHtml'), false);
});
test('failed, absent or incomplete asset proofs cannot establish ordinary HTML acceptance', async t => {
    const { proof } = await htmlAssetProof(t);
    const missingHeader = structuredClone(proof); delete missingHeader.records.find(record => record.path === 'index.html').securityHeaders['content-security-policy'];
    for (const artifactProof of [null, { ...proof, passed: false }, { ...proof, records: [] }, missingHeader]) {
        let requests = 0;
        const result = await verifyOrdinaryHtmlDelivery({ appOrigin: 'https://app.carearound.sg', artifactProof, probeId: jobId, fetchImpl: async () => { requests++; return ordinaryResponse('https://app.carearound.sg/'); } });
        assert.equal(result.passed, false); assert.equal(result.checked, 0); assert.equal(requests, 0);
    }
});
function paired(overrides = {}) {
    return { deployWorker: async () => {}, deployPages: async () => {}, observeWorker: async () => workerId, observePages: async () => pagesId,
        verify: async () => ({ passed: true }), assertSource: async () => {}, recovery: { workerVersionId: oldWorkerId, pagesDeploymentId: jobId, workerSourceRevision: revision, pagesSourceRevision: revision, contentVersion: 'baseline.1', contentDigest: 'a'.repeat(64) }, ...overrides };
}
const publicConfig = { apiOrigin: 'https://api.example.test', appOrigin: 'https://app.example.test', releaseId };
const publicTarget = { buildSourceRevision: buildRevision, version: 'cms.target', contentDigest: 'd'.repeat(64) };
function publicObservationFixture({ identity = () => ({}), content = () => ({}) } = {}) {
    let round = 0;
    const requests = [], delays = [];
    return { requests, delays, options: { delay: async ms => delays.push(ms), fetchImpl: async (url, options) => {
        const path = new URL(url).pathname;
        assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined);
        assert.ok(['/api/release', '/release.json', '/api/help/articles', '/api/guide/topics', '/help-content-status.json'].includes(path));
        if (path === '/api/release') round += 1;
        requests.push({ round, path });
        if (path === '/api/release' || path === '/release.json') {
            const value = await identity(round, path);
            return value instanceof Response ? value : responseJson({ sourceClean: true, sourceRevision: buildRevision,
                ...(path === '/api/release' ? { deploymentId: workerId } : {}), ...value });
        }
        const value = await content(round, path);
        return value instanceof Response ? value : responseJson({ version: publicTarget.version, contentDigest: publicTarget.contentDigest, ...value });
    } } };
}
test('paired release reports publication only after both deployments, public verification and final source check', async () => {
    const events = [];
    const result = await pairedRelease(paired({ deployWorker: async () => events.push('worker'), deployPages: async () => events.push('pages'), verify: async () => { events.push('verify'); return { passed: true }; } }));
    assert.deepEqual(events, ['worker', 'pages', 'verify']); assert.equal(result.state, 'published');
    assert.equal(result.workerVersionId, workerId); assert.equal(result.pagesDeploymentId, pagesId);
});
test('paired publication waits for stale Pages content to settle without repeating deployments', async () => {
    const config = { apiOrigin: 'https://api.example.test', appOrigin: 'https://app.example.test', releaseId };
    const target = { buildSourceRevision: buildRevision, version: 'cms.target', contentDigest: 'd'.repeat(64) };
    const events = [], delays = [];
    let contentRound = 0;
    const result = await pairedRelease(paired({
        deployWorker: async () => events.push('worker'), deployPages: async () => events.push('pages'),
        verify: async () => {
            const observed = await observeVerifiedPublicRelease(config, target, { delay: async ms => delays.push(ms), fetchImpl: async url => {
                const path = new URL(url).pathname;
                if (path === '/api/release') return responseJson({ sourceClean: true, sourceRevision: buildRevision, deploymentId: workerId });
                if (path === '/release.json') return responseJson({ sourceClean: true, sourceRevision: buildRevision });
                if (path === '/api/help/articles') contentRound += 1;
                return responseJson(path === '/help-content-status.json' && contentRound === 1
                    ? { version: 'cms.previous', contentDigest: 'a'.repeat(64) }
                    : { version: target.version, contentDigest: target.contentDigest });
            } });
            return { passed: true, content: observed.content, publicObservations: observed.publicObservations };
        },
    }));
    assert.equal(result.state, 'published');
    assert.deepEqual(events, ['worker', 'pages']);
    assert.equal(contentRound, 2);
    assert.deepEqual(delays, [1500]);
});
test('public observation retries reread paired sources and all content together, retaining failed attempts', async () => {
    const fixture = publicObservationFixture({
        identity: (round, path) => round === 1 && path === '/release.json' ? { sourceRevision: revision } : {},
        content: (round, path) => round === 2 && path === '/help-content-status.json' ? { version: 'cms.previous' } : {},
    });
    const result = await observeVerifiedPublicRelease(publicConfig, publicTarget, fixture.options);
    assert.deepEqual(result.content, { version: publicTarget.version, contentDigest: publicTarget.contentDigest, targets: ['help', 'guide', 'client'] });
    assert.deepEqual(result.publicObservations, [
        { attempt: 1, passed: false, code: 'public-source-mismatch' },
        { attempt: 2, passed: false, code: 'public-content-version-mismatch' },
        { attempt: 3, passed: true, code: 'public-observation-verified' },
    ]);
    assert.deepEqual(fixture.delays, [1500, 1500]);
    assert.deepEqual([1, 2, 3].map(round => fixture.requests.filter(record => record.round === round).length), [2, 5, 5]);
});
test('exact sources from one attempt cannot combine with exact content from another', async () => {
    const fixture = publicObservationFixture({ identity: (round, path) => round === 2 && path === '/release.json' ? { sourceRevision: revision } : {},
        content: (round, path) => round === 1 && path === '/help-content-status.json' ? { version: 'cms.previous' } : {} });
    const result = await pairedRelease(paired({ verify: async () => {
        const observed = await observeVerifiedPublicRelease(publicConfig, publicTarget, { ...fixture.options, attempts: 2 });
        return { passed: true, ...observed };
    } }));
    assert.equal(result.state, 'partially-released'); assert.equal(result.failedStage, 'public-verification');
    assert.deepEqual(result.publicObservations.map(record => record.code), ['public-content-version-mismatch', 'public-source-mismatch']);
    assert.equal(fixture.requests.filter(record => record.round === 2).length, 2);
});
test('persistent source, version, digest and unclean-source mismatches exhaust the fixed bound without publication', async () => {
    for (const [fixtureOptions, code] of [
        [{ identity: (_, path) => path === '/release.json' ? { sourceRevision: revision } : {} }, 'public-source-mismatch'],
        [{ identity: (_, path) => path === '/api/release' ? { sourceClean: false } : {} }, 'public-source-unavailable'],
        [{ content: (_, path) => path === '/help-content-status.json' ? { version: 'cms.previous' } : {} }, 'public-content-version-mismatch'],
        [{ content: (_, path) => path === '/api/guide/topics' ? { contentDigest: 'e'.repeat(64) } : {} }, 'public-content-digest-mismatch'],
    ]) {
        const fixture = publicObservationFixture(fixtureOptions);
        const result = await pairedRelease(paired({ verify: async () => ({ passed: true,
            ...await observeVerifiedPublicRelease(publicConfig, publicTarget, fixture.options) }) }));
        assert.equal(result.state, 'partially-released', code); assert.equal(result.failureCode, code);
        assert.equal(result.workerVersionId, workerId); assert.equal(result.pagesDeploymentId, pagesId);
        assert.equal(fixture.requests.filter(record => record.path === '/api/release').length, 4);
        assert.deepEqual(fixture.delays, [1500, 1500, 1500]);
        assert.equal(result.publicObservations.length, 4); assert.ok(result.publicObservations.every(record => record.passed === false && record.code === code));
    }
});
test('public probes retain HTTP, JSON MIME, valid status and response-size guards during retries', async () => {
    for (const response of [
        () => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }),
        () => new Response('{}', { status: 302, headers: { 'Content-Type': 'application/json', Location: 'https://foreign.example.test' } }),
        () => new Response('{}', { headers: { 'Content-Type': 'text/html' } }),
        () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
        () => responseJson({ version: 'cms.target', contentDigest: 'invalid' }),
        () => new Response('x'.repeat(5 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
    ]) {
        const fixture = publicObservationFixture({ content: (_, path) => path === '/help-content-status.json' ? response() : {} });
        await assert.rejects(observeVerifiedPublicRelease(publicConfig, publicTarget, { ...fixture.options, attempts: 1 }),
            error => error.releaseFailureCode === 'public-content-unavailable' && error.publicObservations.length === 1);
        assert.deepEqual(fixture.delays, []);
    }
});
test('public retry limits and target identity reject invalid overrides before any HTTP request', async () => {
    const fixture = publicObservationFixture();
    for (const attempts of [0, -1, 5, 1.5, Infinity, '4']) {
        await assert.rejects(observeVerifiedPublicRelease(publicConfig, publicTarget, { ...fixture.options, attempts }),
            error => error.releaseFailureCode === 'public-configuration-invalid');
    }
    await assert.rejects(observeVerifiedPublicRelease(publicConfig, publicTarget, { ...fixture.options, delay: null }));
    await assert.rejects(observeVerifiedPublicRelease(publicConfig, { ...publicTarget, buildSourceRevision: 'incomplete' }, fixture.options));
    assert.deepEqual(fixture.requests, []); assert.deepEqual(fixture.delays, []);
});
test('private public-observation diagnostics never serialize thrown credential text, URLs or error properties', async () => {
    const secret = 'fictional-secret-do-not-retain';
    const cause = Object.assign(new Error('https://private.example.test/?token=' + secret), { releaseFailureCode: secret,
        publicObservations: [{ attempt: 1, code: 'public-source-unavailable', url: secret, cause: secret }] });
    const fixture = publicObservationFixture({ identity: () => { throw cause; } });
    const result = await pairedRelease(paired({ verify: async () => ({ passed: true,
        ...await observeVerifiedPublicRelease(publicConfig, publicTarget, { ...fixture.options, attempts: 2 }) }) }));
    assert.equal(result.state, 'partially-released'); assert.equal(result.failureCode, 'public-source-unavailable');
    assert.deepEqual(result.publicObservations, [1, 2].map(attempt => ({ attempt, passed: false, code: 'public-source-unavailable' })));
    assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(JSON.stringify(result).includes('private.example.test'), false);
    const injected = await pairedRelease(paired({ verify: async () => { throw cause; } }));
    assert.equal(injected.failureCode, 'public-verification-failed');
    assert.deepEqual(injected.publicObservations, [{ attempt: 1, passed: false, code: 'public-source-unavailable' }]);
    assert.equal(JSON.stringify(injected).includes(secret), false);
    const receipt = runnerReceipt(expected(), publicTarget, result);
    assert.equal(receipt.failureCode, undefined); assert.equal(receipt.publicObservations, undefined);
});
test('settled public observations do not bypass artifact, ordinary HTML, media or final source checks', async t => {
    for (const failure of ['artifact', 'ordinary-html', 'media', 'source']) {
        const fixture = publicObservationFixture({ content: (round, path) => round === 1 && path === '/help-content-status.json' ? { version: 'cms.previous' } : {} });
        const { dist, files } = htmlArtifactFixture(t);
        let sourceChecks = 0;
        const result = await pairedRelease(paired({
            assertSource: async () => { sourceChecks += 1; if (failure === 'source' && sourceChecks === 3) throw new Error('Public main changed'); },
            verify: async () => {
                const observed = await observeVerifiedPublicRelease(publicConfig, publicTarget, fixture.options);
                const artifacts = await verifyPublicArtifacts({ dist, appOrigin: publicConfig.appOrigin, releaseId, probeId: jobId, attempts: 1,
                    fetchImpl: async url => { const name = artifactNameAtUrl(url); return artifactResponse(name, name === 'other.json' && failure === 'artifact' ? 'different bytes' : files[name]); } });
                const ordinary = await verifyOrdinaryHtmlDelivery({ appOrigin: publicConfig.appOrigin, artifactProof: artifacts, probeId: jobId,
                    fetchImpl: async url => ordinaryResponse(url, failure === 'ordinary-html' ? '<html>Missing required analytics</html>' : undefined) });
                return { passed: artifacts.passed && ordinary.passed && failure !== 'media', ...observed,
                    artifactChecks: artifacts.records, ordinaryHtml: ordinary };
            },
        }));
        assert.equal(result.state, 'partially-released', failure);
        assert.deepEqual(result.attemptedTargets, ['worker', 'pages']);
        assert.equal(result.publicObservations.at(-1).passed, true);
        assert.equal(fixture.requests.filter(record => record.path === '/api/release').length, 2);
        assert.deepEqual(fixture.delays, [1500]);
        assert.equal(result.failedStage, failure === 'source' ? 'post-release-source-check' : 'public-verification');
        assert.ok(result.verification); // Retain the real downstream evidence.
        if (failure === 'artifact') assert.ok(result.verification.artifactChecks.some(record => !record.passed));
        if (failure === 'ordinary-html') assert.equal(result.verification.ordinaryHtml.passed, false);
    }
});
test('Pages failure retains actual Worker identity and recovery references', async () => {
    const result = await pairedRelease(paired({ deployPages: async () => { throw new Error('upload failed'); }, observePages: async () => { throw new Error('unknown Pages identity'); } }));
    assert.equal(result.state, 'partially-released'); assert.equal(result.workerVersionId, workerId); assert.equal(result.pagesDeploymentId, null);
    assert.deepEqual(result.attemptedTargets, ['worker', 'pages']); assert.equal(result.recovery.workerVersionId, oldWorkerId);
});
test('uncertain Worker CLI failure is partial truth and records a version observed after failure', async () => {
    let pagesAttempted = false;
    const result = await pairedRelease(paired({ deployWorker: async () => { throw new Error('lost connection after upload'); }, deployPages: async () => { pagesAttempted = true; } }));
    assert.equal(result.state, 'partially-released'); assert.equal(result.workerVersionId, workerId); assert.equal(pagesAttempted, false);
    assert.deepEqual(result.attemptedTargets, ['worker']);
});
test('preflight source drift attempts no deployment; failed readiness after deployment remains partial', async () => {
    const blocked = await pairedRelease(paired({ assertSource: async () => { throw new Error('source drift'); } }));
    assert.equal(blocked.state, 'failed'); assert.deepEqual(blocked.attemptedTargets, []);
    const partial = await pairedRelease(paired({ verify: async () => ({ passed: false }) }));
    assert.equal(partial.state, 'partially-released'); assert.equal(partial.workerVersionId, workerId); assert.equal(partial.pagesDeploymentId, pagesId);
});
test('deployment arguments preserve settings, provenance and Functions discovery without accepting shell input', () => {
    const worker = deploymentArguments('worker', buildRevision), pages = deploymentArguments('pages', buildRevision);
    assert.ok(worker.includes('--keep-vars')); assert.ok(worker.includes('wrangler.toml')); assert.ok(worker.includes('git-' + buildRevision));
    assert.ok(pages.includes('--commit-dirty=false')); assert.ok(pages.includes(buildRevision)); assert.ok(pages.includes('--skip-caching'));
    assert.throws(() => deploymentArguments('worker', revision + '; echo secret'));
    assert.throws(() => deploymentArguments('arbitrary', buildRevision));
});
test('runner receipts distinguish public source, private build commit and partial deployment identity', () => {
    const receipt = runnerReceipt({ jobId, snapshotDigest: 'c'.repeat(64), baseSourceRevision: revision }, { version: 'cms.2', contentDigest: 'd'.repeat(64), buildSourceRevision: buildRevision },
        { state: 'partially-released', workerVersionId: workerId, pagesDeploymentId: null, attemptedTargets: ['worker'] });
    assert.equal(receipt.baseSourceRevision, revision); assert.equal(receipt.buildSourceRevision, buildRevision);
    assert.equal(receipt.workerVersionId, workerId); assert.equal(receipt.pagesDeploymentId, null); assert.equal(receipt.state, 'partially-released');
});
test('ordinary application release guard blocks old content even when the app source is newer', async t => {
    const root = temp(t); mkdirSync(join(root, 'client/public'), { recursive: true });
    writeFileSync(join(root, 'client/public/help-content-status.json'), JSON.stringify({ version: 'baseline.1', contentDigest: 'a'.repeat(64) }));
    const fetchImpl = async () => responseJson({ version: 'cms.2', contentDigest: 'b'.repeat(64) });
    await assert.rejects(assertLatestHelpContentForAppRelease({ root, env: {}, fetchImpl }), /latest published/);
    writeFileSync(join(root, 'client/public/help-content-status.json'), JSON.stringify({ version: 'cms.2', contentDigest: 'b'.repeat(64) }));
    const passed = await assertLatestHelpContentForAppRelease({ root, env: {}, fetchImpl });
    assert.equal(passed.version, 'cms.2');
});

test('installed release CLI must match its exact reviewed package version', t => {
    const tooling = temp(t);
    mkdirSync(join(tooling, 'node_modules/wrangler/bin'), { recursive: true });
    writeFileSync(join(tooling, 'node_modules/wrangler/bin/wrangler.js'), '// fixture only');
    writeFileSync(join(tooling, 'node_modules/wrangler/package.json'), JSON.stringify({ name: 'wrangler', version: '4.145.0' }));
    assert.equal(validatedWranglerPath(tooling, '4.145.0'), join(tooling, 'node_modules/wrangler/bin/wrangler.js'));
    assert.throws(() => validatedWranglerPath(tooling, '4.144.0'), /reviewed exact version/);
});

async function compiledCorpusPublication(t, mutate) {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const { cmsSeedWorkspace, prepareCmsPublication } = await import('../shared/helpContentCms.js');
    const { compileHelpContent } = await import('./build-help-content.mjs');
    const seed = { manifest: JSON.parse(readFileSync(join(root, 'content/help/manifest.json'), 'utf8')),
        articles: readdirSync(join(root, 'content/help/articles')).filter(file => file.endsWith('.json')).sort()
            .map(file => JSON.parse(readFileSync(join(root, 'content/help/articles', file), 'utf8'))) };
    const frozenPath = join(root, 'server/test/fixtures/helpMigrationBaseline.json');
    const frozenBytes = readFileSync(frozenPath);
    const frozen = JSON.parse(frozenBytes.toString('utf8'));
    const registryPath = join(root, 'content/help/editorial-corrections.json');
    const registryBytes = readFileSync(registryPath);
    const previousRegistry = JSON.parse(registryBytes.toString('utf8'));
    const workspace = cmsSeedWorkspace(seed);
    mutate(workspace);
    const publication = prepareCmsPublication(workspace, { seed, owner: review.owner, reviewNote: 'Reviewed fixture-only owner change.',
        date: review.date, sourceRevision: revision, version: '2026-10-03.help-cms.fixture.1' });
    const contentRoot = temp(t);
    mkdirSync(join(contentRoot, 'content/help/articles'), { recursive: true });
    writeFileSync(join(contentRoot, 'content/help/manifest.json'), JSON.stringify(publication.manifest));
    for (const item of publication.articles) writeFileSync(join(contentRoot, 'content/help/articles', item.id.toLowerCase() + '-' + item.slug + '.json'), JSON.stringify(item));
    const built = compileHelpContent({ root: contentRoot });
    const registry = deriveEditorialCorrections({ baseline: frozen, compiled: built, publication, previous: previousRegistry });
    assert.equal(frozen.facts.length, 105); assert.equal(frozen.topics.length, 12);
    assert.deepEqual(readFileSync(frozenPath), frozenBytes);
    assert.deepEqual(readFileSync(registryPath), registryBytes);
    return { registry, built, publication, contentRoot, previousRegistry };
}
test('application terminology release accepts only the normalized or exact original compilation of its immutable previous snapshot', async t => {
    const { built, publication, contentRoot } = await compiledCorpusPublication(t, () => {});
    const compiler = await import('./build-help-content.mjs');
    const original = compiler.compileHelpContent({ root: contentRoot, normalizeTerminology: false });
    const originalDigest = digestValue(original), normalizedDigest = digestValue(built);
    assert.notEqual(originalDigest, normalizedDigest);
    const options = { compiler, root: contentRoot, compiled: built };
    assert.equal(verifiedPreviousContentDigest(options), normalizedDigest);
    assert.equal(verifiedPreviousContentDigest({ ...options, previousContentDigest: normalizedDigest }), normalizedDigest);
    assert.equal(verifiedPreviousContentDigest({ ...options, previousContentDigest: originalDigest }), originalDigest);
    assert.deepEqual(built.articles.map(({ id, slug, visibility, articleRoute }) => ({ id, slug, visibility, articleRoute })),
        original.articles.map(({ id, slug, visibility, articleRoute }) => ({ id, slug, visibility, articleRoute })));
    assert.deepEqual(built.facts.map(({ id, route, articleId, sectionId, visibility }) => ({ id, route, articleId, sectionId, visibility })),
        original.facts.map(({ id, route, articleId, sectionId, visibility }) => ({ id, route, articleId, sectionId, visibility })));
    assert.throws(() => verifiedPreviousContentDigest({ ...options, previousContentDigest: 'f'.repeat(64) }), /exact immutable published snapshot/);
    assert.throws(() => verifiedPreviousContentDigest({ ...options, previousContentDigest: 'invalid' }), /digest is invalid/);
    assert.throws(() => validateRecoverySurfaces(['help', 'guide', 'client'].map(target => ({ target,
        version: publication.version, contentDigest: 'f'.repeat(64) })), {
        baseVersion: publication.version, baseDigest: originalDigest, targetVersion: 'next.cms.version', targetDigest: normalizedDigest,
    }), /neither the approved base nor the exact recovery snapshot/);
});
test('an original digest from another publication cannot authorise a changed immutable snapshot', async t => {
    const { built, publication, contentRoot } = await compiledCorpusPublication(t, () => {});
    const compiler = await import('./build-help-content.mjs');
    const originalDigest = digestValue(compiler.compileHelpContent({ root: contentRoot, normalizeTerminology: false }));
    const entry = publication.articles.find(value => value.visibility === 'public' && value.sections.some(section => section.paragraphs?.length));
    const file = join(contentRoot, 'content/help/articles', entry.id.toLowerCase() + '-' + entry.slug + '.json');
    const changed = JSON.parse(readFileSync(file, 'utf8'));
    changed.sections.find(section => section.paragraphs?.length).paragraphs[0] += ' Different fixture-only published wording.';
    writeFileSync(file, JSON.stringify(changed));
    const changedCompiled = compiler.compileHelpContent({ root: contentRoot });
    assert.notEqual(digestValue(changedCompiled), digestValue(built));
    assert.throws(() => verifiedPreviousContentDigest({ compiler, root: contentRoot, compiled: changedCompiled,
        previousContentDigest: originalDigest }), /exact immutable published snapshot/);
});
test('the full 105-fact/12-topic corpus compiles a reviewed owner edit without changing the frozen baseline', async t => {
    const result = await compiledCorpusPublication(t, workspace => {
        const entry = workspace.articles.find(item => item.sections.some(section => section.facts.some(value => value.id === 'help-overview')));
        const section = entry.sections.find(item => item.facts.some(value => value.id === 'help-overview'));
        section.paragraphs[0] += ' Reviewed fixture-only wording.';
    });
    assert.equal(result.registry.facts.find(entry => entry.id === 'help-overview').kind, 'changed');
    assert.equal(result.registry.topics.find(entry => entry.id === 'overview').kind, 'changed');
    assert.notEqual(result.registry.facts.find(entry => entry.id === 'help-overview').expectedDigest,
        result.previousRegistry.facts.find(entry => entry.id === 'help-overview')?.expectedDigest);
    for (const entry of result.previousRegistry.facts.filter(entry => entry.id !== 'help-overview')) {
        assert.deepEqual(result.registry.facts.find(value => value.id === entry.id), entry);
    }
    for (const entry of result.previousRegistry.topics.filter(entry => entry.id !== 'overview')) {
        assert.deepEqual(result.registry.topics.find(value => value.id === entry.id), entry);
    }
});
test('the full corpus archives an article and retires its fact/topic evidence through one owner-reviewed compilation', async t => {
    const result = await compiledCorpusPublication(t, workspace => {
        workspace.articles.find(item => item.sections.some(section => section.facts.some(value => value.id === 'help-overview'))).status = 'retired';
    });
    assert.equal(result.registry.facts.find(entry => entry.id === 'help-overview').kind, 'retired');
    assert.equal(result.registry.topics.find(entry => entry.id === 'overview').kind, 'retired');
    assert.equal(result.built.facts.some(entry => entry.id === 'help-overview'), false);
    assert.ok(result.publication.manifest.retiredFactIds.includes('help-overview'));
});

async function realBackendRelease() {
    const { createHelpCmsRepository } = await import('../server/src/utils/helpCmsRepository.js');
    const rows = new Map([['workspace/current.json', { text: JSON.stringify({ workspace: {}, revisionId: 'fixture', baselineSeed: {} }), etag: 'saved-etag' }]]);
    const bucket = {
        get: async key => { const item = rows.get(key); return item ? { etag: item.etag, json: async () => JSON.parse(item.text) } : null; },
        put: async (key, text) => { const record = { text, etag: 'etag-' + rows.size }; rows.set(key, record); return { etag: record.etag }; },
    };
    const repo = createHelpCmsRepository(bucket, { now: () => new Date('2026-10-03T00:00:00Z') });
    const publication = fixturePublication();
    const release = await repo.createRelease({ publication, version: publication.version, snapshotDigest: digestValue(publication), baseSourceRevision: revision }, 'saved-etag', 7);
    return { release, repo };
}
test('real backend repository and private workflow dispatch produce an adapter-compatible timestamped release identity', async () => {
    const { release } = await realBackendRelease();
    const { dispatchHelpCmsRelease } = await import('../server/src/utils/helpCmsPublisher.js');
    let dispatched;
    const env = { HELP_CMS_PUBLISH_REPOSITORY: 'Owner/private-releases', HELP_CMS_GITHUB_TOKEN: 'fixture-github-token',
        HELP_CMS_RELEASE_TOKEN: 'fixture-private-release-token-'.repeat(2), HELP_CMS_SOURCE_REVISION: revision,
        HELP_CMS_PUBLIC_API_ORIGIN: 'https://api.carearound.sg', NODE_ENV: 'production' };
    await dispatchHelpCmsRelease(release, env, async (url, options) => {
        if (url.endsWith('/dispatches')) { dispatched = JSON.parse(options.body).inputs; return new Response(null, { status: 204 }); }
        return responseJson({ private: true, full_name: env.HELP_CMS_PUBLISH_REPOSITORY });
    });
    const config = readReleaseConfiguration({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: env.HELP_CMS_PUBLISH_REPOSITORY,
        GITHUB_TOKEN: env.HELP_CMS_GITHUB_TOKEN, HELP_CMS_RELEASE_TOKEN: env.HELP_CMS_RELEASE_TOKEN,
        HELP_CMS_API_ORIGIN: env.HELP_CMS_PUBLIC_API_ORIGIN, HELP_CMS_RELEASE_ID: dispatched.release_id, HELP_CMS_JOB_ID: dispatched.job_id,
        HELP_CMS_CONTENT_DIGEST: dispatched.content_digest, HELP_CMS_BASE_SOURCE_REVISION: dispatched.base_source_revision });
    assert.match(config.releaseId, /^\d{13}-/);
    assert.equal(validateSnapshot(release, config), release.publication);
});
test('real partial receipt survives a queued retry and accepts exact old/new surfaces while keeping failed retry locked', async () => {
    const { release, repo } = await realBackendRelease();
    const { validateHelpCmsReceipt } = await import('../server/src/utils/helpCmsPublisher.js');
    const target = { baseVersion: 'baseline.1', baseDigest: 'a'.repeat(64), targetVersion: 'cms.2', targetDigest: 'b'.repeat(64) };
    let surfaces = ['help', 'guide', 'client'].map(target => ({ target, version: 'baseline.1', contentDigest: 'a'.repeat(64) }));
    const first = await pairedRelease(paired({
        deployWorker: async () => { surfaces = surfaces.map(item => item.target === 'client' ? item : { ...item, version: target.targetVersion, contentDigest: target.targetDigest }); },
        deployPages: async () => { throw new Error('Pages failed after Worker success'); },
        observePages: async () => { throw new Error('not deployed'); },
    }));
    const receipt = runnerReceipt({ jobId: release.jobId, snapshotDigest: release.snapshotDigest, baseSourceRevision: revision },
        { version: release.version, contentDigest: target.targetDigest, buildSourceRevision: buildRevision }, first);
    const accepted = validateHelpCmsReceipt(receipt, release);
    await repo.updateRelease(release.id, accepted);
    const queued = await repo.updateRelease(release.id, { state: 'queued' });
    assert.equal(priorReleaseState(queued).productionAttempted, true);
    assert.equal(validateRecoverySurfaces(surfaces, target).mixed, true);
    const blockedRetry = await pairedRelease(paired({ previous: queued, assertSource: async () => { throw new Error('remote main drift'); } }));
    assert.equal(blockedRetry.state, 'partially-released');
    assert.equal(runnerReceipt({ jobId, snapshotDigest: 'c'.repeat(64), baseSourceRevision: revision }, {}, blockedRetry).deploymentAttempted, true);
    const completedRetry = await pairedRelease(paired({
        previous: queued,
        deployPages: async () => { surfaces = surfaces.map(item => ({ ...item, version: target.targetVersion, contentDigest: target.targetDigest })); },
        verify: async () => ({ passed: !validateRecoverySurfaces(surfaces, target).mixed }),
    }));
    assert.equal(completedRetry.state, 'published');
    assert.throws(() => validateRecoverySurfaces(surfaces.map(item => item.target === 'client' ? { ...item, contentDigest: 'f'.repeat(64) } : item), target), /neither/);
});
test('compact server receipt remains bounded with a complete 1000-file parity report retained privately', async () => {
    const config = { jobId, releaseId, snapshotDigest: 'c'.repeat(64), baseSourceRevision: revision, apiOrigin: 'https://api.carearound.sg', releaseToken: 'fixture-only' };
    const result = { state: 'published', attemptedTargets: ['worker', 'pages'], workerVersionId: workerId, pagesDeploymentId: pagesId,
        verification: { passed: true, artifactCount: 1000, mediaCount: 0, mediaPassed: true,
            artifactChecks: Array.from({ length: 1000 }, (_, index) => ({ path: 'assets/' + index + '.js', sha256: 'd'.repeat(64), passed: true, failures: [] })) } };
    const receipt = runnerReceipt(config, { version: 'cms.2', contentDigest: 'd'.repeat(64), buildSourceRevision: buildRevision }, result);
    assert.ok(Buffer.byteLength(JSON.stringify(receipt)) < 16384);
    assert.equal(receipt.verification.artifactCount, 1000); assert.equal(receipt.verification.artifactChecks, undefined);
    const acknowledged = await postReceipt(config, receipt, async () => responseJson({ release: { id: releaseId, state: 'partially-released' } }));
    assert.equal(acknowledged, 'partially-released');
    await assert.rejects(postReceipt(config, receipt, async () => responseJson({ release: { id: 'wrong', state: 'published' } })), /acknowledge/);
});
test('content hydration excludes Linux dependency regeneration while detecting every actual runtime source change', t => {
    const root = temp(t), run = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    mkdirSync(join(root, 'node_modules/mac-only'), { recursive: true });
    mkdirSync(join(root, 'content/help/articles'), { recursive: true });
    writeFileSync(join(root, 'node_modules/mac-only/binary'), 'tracked Mac binary');
    writeFileSync(join(root, 'content/help/articles/hc-01-overview.json'), '{}');
    run(['init', '--quiet']); run(['add', '--', '.']);
    run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'Fixture baseline']);
    rmSync(join(root, 'node_modules/mac-only/binary'));
    mkdirSync(join(root, 'node_modules/linux-only'), { recursive: true });
    writeFileSync(join(root, 'node_modules/linux-only/binary'), 'generated Linux binary');
    writeFileSync(join(root, 'content/help/articles/hc-01-overview.json'), '{"approved":true}');
    let changes = uncommittedContentPaths(root);
    assert.deepEqual(changes.changed, ['content/help/articles/hc-01-overview.json']); assert.deepEqual(changes.untracked, []);
    assertContentOnlyPaths(changes.changed);
    writeFileSync(join(root, 'runtime.js'), 'unexpected runtime change');
    changes = uncommittedContentPaths(root);
    assert.throws(() => assertContentOnlyPaths([...changes.changed, ...changes.untracked]), /outside/);
    assert.equal(run(['diff', '--cached', '--name-only']).trim(), '');
});

test('private checkpoints persist complete recovery and deployment intent before each upload, and checkpoint failure stops upload', async () => {
    const config = { jobId, releaseId, snapshotDigest: 'c'.repeat(64), baseSourceRevision: revision,
        apiOrigin: 'https://api.carearound.sg', releaseToken: 'fixture-private-token' };
    const built = { version: 'cms.2', contentDigest: 'b'.repeat(64), buildSourceRevision: buildRevision };
    const recovery = paired().recovery, events = [];
    const persist = async checkpoint => postCheckpoint(config, built, recovery, checkpoint, async (url, options) => {
        assert.equal(url, config.apiOrigin + '/api/help/cms/release/' + releaseId + '/checkpoint');
        assert.equal(options.headers.Authorization, 'Bearer ' + config.releaseToken);
        const body = JSON.parse(options.body);
        assert.deepEqual(body.recovery, recovery); assert.equal(body.snapshotDigest, config.snapshotDigest);
        events.push(body.stage + ':' + body.attemptedTargets.join(','));
        return responseJson({ release: { id: releaseId, state: body.stage } });
    });
    await persist({ stage: 'prepared', attemptedTargets: [] });
    const done = await pairedRelease(paired({ recovery, beforeDeploy: targets => persist({ stage: 'deploying', attemptedTargets: targets }),
        deployWorker: async () => events.push('worker-upload'), deployPages: async () => events.push('pages-upload') }));
    assert.equal(done.state, 'published');
    assert.deepEqual(events, ['prepared:', 'deploying:worker', 'worker-upload', 'deploying:worker,pages', 'pages-upload']);
    let uploaded = false;
    const blocked = await pairedRelease(paired({ beforeDeploy: async () => { throw new Error('checkpoint rejected'); }, deployWorker: async () => { uploaded = true; } }));
    assert.equal(uploaded, false); assert.deepEqual(blocked.attemptedTargets, []); assert.equal(blocked.failedStage, 'worker-checkpoint');
    await assert.rejects(postCheckpoint(config, built, { workerVersionId: workerId }, { stage: 'prepared', attemptedTargets: [] }), /complete original recovery/);
});
