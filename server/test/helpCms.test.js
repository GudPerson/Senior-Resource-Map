import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpCmsRoutes, createHelpMediaRoutes } from '../src/routes/helpCms.js';
import { createHelpCmsRepository, cmsSha256 } from '../src/utils/helpCmsRepository.js';
import { cmsSeedWorkspace } from '../../shared/helpContentCms.js';
import { rebaseHelpCmsWorkspace } from '../src/utils/helpCmsRebase.js';

class MemoryBucket {
    objects = new Map(); counter = 0; beforePut = null;
    async get(key) {
        const stored = this.objects.get(key);
        if (!stored) return null;
        const bytes = stored.bytes.slice();
        return { etag: stored.etag, body: new Response(bytes).body, httpMetadata: stored.httpMetadata,
            customMetadata: stored.customMetadata, json: async () => JSON.parse(new TextDecoder().decode(bytes)) };
    }
    async put(key, value, options = {}) {
        if (this.beforePut) await this.beforePut(key);
        const previous = this.objects.get(key), condition = options.onlyIf;
        if (condition instanceof Headers && condition.get('If-None-Match') === '*' && previous) return null;
        if (condition?.etagMatches && previous?.etag !== condition.etagMatches) return null;
        const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value).slice();
        const object = { bytes, etag: `etag-${++this.counter}`, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} };
        this.objects.set(key, object);
        return { etag: object.etag };
    }
    async list({ prefix, limit = 1000, cursor } = {}) {
        const keys = [...this.objects.keys()].filter(key => key.startsWith(prefix)).sort();
        const start = cursor ? Number(cursor) : 0, selected = keys.slice(start, start + limit);
        return { objects: selected.map(key => ({ key })), truncated: keys.length > start + limit,
            cursor: keys.length > start + limit ? String(start + limit) : undefined };
    }
}
const article = (id, visibility = 'public') => ({ id, slug: id.toLowerCase(), title: 'Reviewed help', summary: 'Useful instructions',
    category: 'maps', audiences: ['everyone'], visibility, status: 'approved', relatedArticleIds: [],
    sections: [{ id: 'steps', title: 'Steps', paragraphs: ['Start here'], steps: ['Open your map'], facts: [] }] });
const seed = { manifest: { version: 'fixture-base', categories: [{ id: 'maps', title: 'Maps' }], topics: [], guideFactOrder: [] },
    articles: [article('HC-01'), article('HC-02', 'admin')] };
const sourceRevision = 'a'.repeat(40), compiledDigest = 'b'.repeat(64), runnerToken = 'r'.repeat(40);
const envFor = bucket => ({ HELP_CMS_ENABLED: 'true', HELP_CMS_OWNER_ID: '7', HELP_CMS_BUCKET: bucket,
    HELP_CMS_GITHUB_TOKEN: 'test-dispatch-token', HELP_CMS_RELEASE_TOKEN: runnerToken,
    HELP_CMS_PUBLISH_REPOSITORY: 'carearound/private-runner', HELP_CMS_SOURCE_REVISION: sourceRevision,
    HELP_CMS_PUBLIC_API_ORIGIN: 'https://api.example.com', HELP_CMS_PUBLIC_APP_ORIGIN: 'https://app.carearound.sg', NODE_ENV: 'production' });
const now = () => new Date('2026-10-03T10:00:00.000Z');
function appFor({ bucket = new MemoryBucket(), actor = { id: 7, role: 'super_admin' }, fetchImpl = async () => { throw new Error('unexpected fetch'); } } = {}) {
    const app = createHelpCmsRoutes({ seed, now, fetchImpl, authenticate: async (c, next) => { c.set('user', actor); await next(); } });
    return { app, bucket, env: envFor(bucket) };
}
const jsonRequest = (app, env, path, method, body, headers = {}) => app.request(path, { method,
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.carearound.sg', ...headers }, body: JSON.stringify(body) }, env);
async function savedFixture(options) {
    const result = appFor(options);
    const initial = await (await result.app.request('/', {}, result.env)).json();
    const response = await jsonRequest(result.app, result.env, '/', 'PUT', { workspace: initial.workspace, etag: initial.etag });
    assert.equal(response.status, 200);
    return { ...result, saved: await response.json() };
}

test('CMS is disabled or incomplete by default and owner access denies other accounts and User View', async () => {
    for (const actor of [null, { id: 7, role: 'standard' }, { id: 8, role: 'super_admin' }, { id: 7, role: 'super_admin', isImpersonating: true }]) {
        const { app, env } = appFor({ actor });
        const response = await app.request('/', {}, env);
        assert.equal(response.status, actor ? 403 : 401);
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
        assert.doesNotMatch(await response.text(), /Useful instructions/);
    }
    const { app, env } = appFor();
    assert.equal((await app.request('/', {}, { ...env, HELP_CMS_ENABLED: 'false' })).status, 503);
    assert.equal((await app.request('/', {}, { ...env, HELP_CMS_BUCKET: undefined })).status, 503);
    assert.equal((await app.request('/', {}, { ...env, HELP_CMS_OWNER_ID: '' })).status, 503);
});

test('GET is write-free; saving and restoring preserve immutable history without stale-tab overwrite', async () => {
    const { app, bucket, env } = appFor();
    const initial = await (await app.request('/', {}, env)).json();
    assert.equal(bucket.objects.size, 0);
    const first = await jsonRequest(app, env, '/', 'PUT', { workspace: initial.workspace, etag: null });
    const saved = await first.json();
    const edited = structuredClone(saved.workspace); edited.articles[0].title = 'Changed title';
    const second = await jsonRequest(app, env, '/', 'PUT', { workspace: edited, etag: saved.etag });
    const current = await second.json();
    assert.equal((await jsonRequest(app, env, '/', 'PUT', { workspace: saved.workspace, etag: saved.etag })).status, 409);
    assert.equal((await (await app.request('/', {}, env)).json()).workspace.articles[0].title, 'Changed title');
    const history = await (await app.request('/history', {}, env)).json();
    assert.deepEqual(history.revisions.map(row => row.revisionId), [current.revisionId, saved.revisionId]);
    const restored = await jsonRequest(app, env, '/restore', 'POST', { revisionId: saved.revisionId, etag: current.etag });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).workspace.articles[0].title, 'Reviewed help');
});

test('R2 conditional writes reject a concurrent save even after both readers saw the old ETag', async () => {
    const bucket = new MemoryBucket(), repository = createHelpCmsRepository(bucket, { seed, seedWorkspace: cmsSeedWorkspace(seed), now });
    const initial = await repository.saveWorkspace(cmsSeedWorkspace(seed), null, 7);
    let entered = false;
    bucket.beforePut = async key => {
        if (key === 'workspace/current.json' && !entered) {
            entered = true;
            const current = bucket.objects.get(key); bucket.objects.set(key, { ...current, etag: 'concurrent-write' });
        }
    };
    await assert.rejects(repository.saveWorkspace(initial.workspace, initial.etag, 7), error => error.status === 409);
    assert.equal((await repository.history()).length, 1);
});

test('Owner write routes require a trusted app origin and cannot alter article visibility or routing evidence', async () => {
    const { app, env, saved } = await savedFixture();
    for (const origin of ['https://attacker.example', 'null', '']) {
        assert.equal((await jsonRequest(app, env, '/', 'PUT', { workspace: saved.workspace, etag: saved.etag }, { Origin: origin })).status, 403);
    }
    const edited = structuredClone(saved.workspace); edited.articles[1].visibility = 'public';
    assert.equal((await jsonRequest(app, env, '/', 'PUT', { workspace: edited, etag: saved.etag })).status, 400);
    assert.equal((await jsonRequest(app, env, '/', 'PUT', { workspace: { ...saved.workspace, baseContentVersion: 'stale' }, etag: saved.etag })).status, 409);
});

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VgAAAABJRU5ErkJggg==', 'base64'));
async function upload(app, env, articleId, bytes = png, type = 'image/png') {
    const form = new FormData(); form.set('articleId', articleId); form.set('file', new Blob([bytes], { type }), 'example.png');
    return app.request('/media', { method: 'POST', headers: { Origin: 'https://app.carearound.sg' }, body: form }, env);
}
test('Media requires an active public article, a matching raster signature, and owner byte delivery', async () => {
    const { app, bucket, env } = appFor();
    assert.equal((await upload(app, env, 'HC-02')).status, 400);
    assert.equal((await upload(app, env, 'HC-01', new TextEncoder().encode('<svg/>'), 'image/png')).status, 400);
    const response = await upload(app, env, 'HC-01');
    assert.equal(response.status, 201);
    const { assetId } = await response.json();
    assert.equal(assetId, await cmsSha256(png));
    const read = await app.request(`/media/${assetId}`, {}, env);
    assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(read.headers.get('X-Content-Type-Options'), 'nosniff');
    const unauthorized = appFor({ bucket, actor: { id: 8, role: 'super_admin' } });
    assert.equal((await unauthorized.app.request(`/media/${assetId}`, {}, env)).status, 403);
    const publicMedia = createHelpMediaRoutes({ articles: [], bucketForContext: () => bucket });
    assert.equal((await publicMedia.request(`/${assetId}`)).status, 404);
    const published = createHelpMediaRoutes({ articles: [{ visibility: 'public', sections: [{ media: [{ type: 'image', assetId }] }] }], bucketForContext: () => bucket });
    assert.equal((await published.request(`/${assetId}`)).status, 200);
    const restricted = createHelpMediaRoutes({ articles: [{ visibility: 'admin', sections: [{ media: [{ type: 'image', assetId }] }] }], bucketForContext: () => bucket });
    assert.equal((await restricted.request(`/${assetId}`)).status, 404);
});

test('Publishing refuses a public runner repository and retains a recoverable private snapshot', async () => {
    let dispatches = 0;
    const fetchImpl = async (url) => {
        if (url.endsWith('/carearound/private-runner')) return Response.json({ private: false, full_name: 'carearound/private-runner' });
        dispatches++; return new Response(null, { status: 204 });
    };
    const { app, env, bucket, saved } = await savedFixture({ fetchImpl });
    const response = await jsonRequest(app, env, '/publish', 'POST', { etag: saved.etag, reviewNote: 'Reviewed the instructions.', approved: true });
    assert.equal(response.status, 503); assert.equal(dispatches, 0);
    assert.equal((await (await app.request('/', {}, env)).json()).etag, saved.etag);
    assert.equal([...bucket.objects.keys()].filter(key => key.startsWith('releases/')).length, 1);
    const releases = await (await app.request('/releases', {}, env)).json();
    assert.equal(releases.releases[0].state, 'dispatch-unconfirmed');
});

async function publishedFixture({ readiness = true, editWorkspace, fetchImpl: suppliedFetch } = {}) {
    let dispatched;
    const fetchImpl = async (url, options = {}) => {
        if (url === 'https://api.github.com/repos/carearound/private-runner') return Response.json({ private: true, full_name: 'carearound/private-runner' });
        if (url.includes('/runs?') && suppliedFetch) return suppliedFetch(url,options);
        if (url.includes('/dispatches')) { dispatched = JSON.parse(options.body); return suppliedFetch ? suppliedFetch(url,options) : new Response(null, { status: 204 }); }
        return Response.json({ version: `${now().toISOString().slice(0, 10)}.help-cms.${now().getTime()}`,
            contentDigest: readiness ? compiledDigest : 'c'.repeat(64) });
    };
    const result = await savedFixture({ fetchImpl });
    if (editWorkspace) {
        const workspace = structuredClone(result.saved.workspace); editWorkspace(workspace);
        const saved = await jsonRequest(result.app, result.env, '/', 'PUT', { workspace, etag: result.saved.etag });
        assert.equal(saved.status, 200); result.saved = await saved.json();
    }
    const response = await jsonRequest(result.app, result.env, '/publish', 'POST', { etag: result.saved.etag, reviewNote: 'Checked this complete publication.', approved: true });
    assert.equal(response.status, 202);
    const release = (await response.json()).release;
    const downloaded = await result.app.request(`/release/${release.id}`, { headers: { Authorization: `Bearer ${runnerToken}` } }, result.env);
    const snapshot = await downloaded.json();
    assert.equal(dispatched.inputs.content_digest, snapshot.snapshotDigest);
    assert.equal(snapshot.snapshotDigest, await cmsSha256(JSON.stringify(snapshot.publication)));
    const receipt = { state: 'published', jobId: snapshot.jobId, snapshotDigest: snapshot.snapshotDigest,
        version: snapshot.version, baseSourceRevision: sourceRevision, buildSourceRevision: 'd'.repeat(40), compiledContentDigest: compiledDigest,
        workerVersionId: '12345678-1234-1234-1234-123456789012', pagesDeploymentId: '87654321-4321-4321-4321-210987654321' };
    return { ...result, snapshot, receipt };
}

test('Release downloads require the dedicated runner token; mismatched receipts cannot publish', async () => {
    const { app, env, snapshot, receipt } = await publishedFixture();
    assert.equal((await app.request(`/release/${snapshot.id}`, {}, env)).status, 403);
    assert.equal((await app.request('/release/latest', { headers: { Authorization: `Bearer ${runnerToken}` } }, env)).status, 404);
    const wrong = await jsonRequest(app, env, `/release/${snapshot.id}/receipt`, 'POST', { ...receipt, jobId: crypto.randomUUID() }, { Authorization: `Bearer ${runnerToken}` });
    assert.equal(wrong.status, 409);
    assert.equal((await (await app.request('/releases', {}, env)).json()).releases[0].state, 'dispatched');
});

test('Both API consumers and the deployed client must match before a publication becomes current', async () => {
    const failed = await publishedFixture({ readiness: false });
    const response = await jsonRequest(failed.app, failed.env, `/release/${failed.snapshot.id}/receipt`, 'POST', failed.receipt,
        { Authorization: `Bearer ${runnerToken}` });
    assert.equal((await response.json()).release.state, 'partially-released');
    assert.equal((await failed.app.request('/release/latest', { headers: { Authorization: `Bearer ${runnerToken}` } }, failed.env)).status, 404);
    const good = await publishedFixture();
    const completed = await jsonRequest(good.app, good.env, `/release/${good.snapshot.id}/receipt`, 'POST', good.receipt,
        { Authorization: `Bearer ${runnerToken}` });
    assert.equal((await completed.json()).release.state, 'published');
    const current = await (await good.app.request('/', {}, good.env)).json();
    assert.equal(current.workspace.baseContentVersion, good.snapshot.version);
    assert.equal(current.baseDrift, false);
    assert.equal((await good.app.request('/release/latest', { headers: { Authorization: `Bearer ${runnerToken}` } }, good.env)).status, 200);
});

test('Publication completion preserves newer unsaved-base edits and reports review drift', async () => {
    const { app, env, snapshot, receipt, saved } = await publishedFixture();
    const workspace = structuredClone(saved.workspace); workspace.articles[0].title = 'A later edit';
    assert.equal((await jsonRequest(app, env, '/', 'PUT', { workspace, etag: saved.etag })).status, 200);
    await jsonRequest(app, env, `/release/${snapshot.id}/receipt`, 'POST', receipt, { Authorization: `Bearer ${runnerToken}` });
    const current = await (await app.request('/', {}, env)).json();
    assert.equal(current.workspace.articles[0].title, 'A later edit');
    assert.equal(current.baseDrift, true);
    assert.equal((await jsonRequest(app, env, '/publish', 'POST', { etag: current.etag, reviewNote: 'Checked.', approved: true })).status, 409);
    const restored = await jsonRequest(app, env, '/restore', 'POST', { revisionId: 'published', etag: current.etag });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).baseDrift, false);
});

test('A saved private draft is excluded from release downloads and retained after another article is published', async () => {
    const { app, env, snapshot, receipt } = await publishedFixture({ editWorkspace: workspace => {
        workspace.articles[0].status = 'draft'; workspace.articles[0].title = 'Private unfinished title';
        const draft = article('HC-03'); draft.status = 'draft'; draft.title = 'Another private unfinished title';
        draft.sections[0].paragraphs = ['A private unfinished paragraph'];
        draft.sections[0].stepIds = ['steps-step-1']; draft.sections[0].media = [];
        workspace.articles.push(draft); workspace.manifest.articleOrder.push(draft.id);
    } });
    assert.doesNotMatch(JSON.stringify(snapshot.publication), /Private unfinished|private unfinished/);
    assert.equal(snapshot.publication.articles.some(a => a.id === 'HC-03'), false);
    const response = await jsonRequest(app, env, `/release/${snapshot.id}/receipt`, 'POST', receipt, { Authorization: `Bearer ${runnerToken}` });
    assert.equal(response.status, 200);
    const current = await (await app.request('/', {}, env)).json();
    assert.equal(current.workspace.articles.find(a => a.id === 'HC-01').title, 'Private unfinished title');
    assert.equal(current.workspace.articles.find(a => a.id === 'HC-03').title, 'Another private unfinished title');
    assert.equal(current.workspace.baseContentVersion, snapshot.version);
});

test('Publication CAS blocks duplicate publish; definite failure clears it and exact-snapshot retry keeps identity', async () => {
    const { app, env, snapshot, receipt, saved } = await publishedFixture();
    assert.equal((await (await app.request('/', {}, env)).json()).activeReleaseId, snapshot.id);
    assert.equal((await jsonRequest(app, env, '/publish', 'POST', { etag: saved.etag, reviewNote: 'Second click.', approved: true })).status, 409);
    const failed = await jsonRequest(app, env, `/release/${snapshot.id}/receipt`, 'POST', { ...receipt, state: 'failed', workerVersionId: null, pagesDeploymentId: null, attemptedTargets: [] }, { Authorization: `Bearer ${runnerToken}` });
    assert.equal(failed.status, 200);
    assert.equal((await (await app.request('/', {}, env)).json()).activeReleaseId, null);
    assert.equal((await jsonRequest(app, env, `/releases/${snapshot.id}/retry`, 'POST', { approved: false })).status, 400);
    const retry = await jsonRequest(app, env, `/releases/${snapshot.id}/retry`, 'POST', { approved: true });
    assert.equal(retry.status, 202);
    const status = (await retry.json()).release;
    assert.equal(status.jobId, snapshot.jobId); assert.equal(status.snapshotDigest, snapshot.snapshotDigest);
    assert.equal((await (await app.request('/releases', {}, env)).json()).releases.length, 1);
});

test('Partial readiness retains the active release and cannot retry after the app source changes', async () => {
    const { app, env, snapshot, receipt } = await publishedFixture({ readiness: false });
    await jsonRequest(app, env, `/release/${snapshot.id}/receipt`, 'POST', receipt, { Authorization: `Bearer ${runnerToken}` });
    assert.equal((await (await app.request('/', {}, env)).json()).activeReleaseId, snapshot.id);
    const changed = { ...env, HELP_CMS_SOURCE_REVISION: 'e'.repeat(40) };
    assert.equal((await jsonRequest(app, changed, `/releases/${snapshot.id}/retry`, 'POST', { approved: true })).status, 409);
});

test('Capability does not load draft contents and oversized uploads are stopped before storage', async () => {
    const { app, env, bucket } = appFor();
    assert.deepEqual(await (await app.request('/capability', {}, env)).json(), { canEdit: true });
    assert.equal(bucket.objects.size, 0);
    const huge = await app.request('/', { method: 'PUT', headers: { Origin: 'https://app.carearound.sg', 'Content-Type': 'application/json' },
        body: 'x'.repeat(4 * 1024 * 1024 + 5000) }, env);
    assert.equal(huge.status, 413);
    assert.equal(bucket.objects.size, 0);
});

test('Reviewed rebase combines independent edits and keeps the latest immutable evidence', async () => {
    const oldSeed = structuredClone(seed), newSeed = structuredClone(seed);
    oldSeed.articles[0].sections[0].facts = [{ id: 'stable-fact', reviewed: '2026-10-02', message: 'Original evidence' }];
    newSeed.manifest.version = 'published-new'; newSeed.articles[0].summary = 'Published summary';
    newSeed.articles[0].sections[0].facts = [{ id: 'stable-fact', reviewed: '2026-10-03', message: 'Reviewed evidence' }];
    const local = cmsSeedWorkspace(oldSeed); local.articles[0].title = 'A later private title';
    const result = rebaseHelpCmsWorkspace(local, oldSeed, newSeed);
    assert.equal(result.workspace.baseContentVersion, 'published-new');
    assert.equal(result.workspace.articles[0].title, 'A later private title');
    assert.equal(result.workspace.articles[0].summary, 'Published summary');
    assert.deepEqual(result.workspace.articles[0].sections[0].facts, newSeed.articles[0].sections[0].facts);
});

test('Rebase conflicts retain the exact saved draft; historical restore explicitly retains selected old prose', async () => {
    const result = await publishedFixture({ editWorkspace: workspace => { workspace.articles[0].title = 'Published new title'; } });
    const { app, env, saved, snapshot, receipt } = result;
    const local = cmsSeedWorkspace(seed); local.articles[0].title = 'Conflicting private title';
    const save = await jsonRequest(app, env, '/', 'PUT', { workspace: local, etag: saved.etag });
    assert.equal(save.status, 200);
    await jsonRequest(app, env, `/release/${snapshot.id}/receipt`, 'POST', receipt, { Authorization: `Bearer ${runnerToken}` });
    const current = await (await app.request('/', {}, env)).json();
    const conflict = await jsonRequest(app, env, '/rebase', 'POST', { etag: current.etag, approved: true });
    assert.equal(conflict.status, 409);
    assert.deepEqual((await conflict.json()).conflicts, ['HC-01.title']);
    const unchanged = await (await app.request('/', {}, env)).json();
    assert.equal(unchanged.etag, current.etag); assert.equal(unchanged.workspace.articles[0].title, 'Conflicting private title');
    const history = await (await app.request('/history', {}, env)).json();
    const historical = history.revisions.at(-1);
    const restored = await jsonRequest(app, env, '/restore', 'POST', { revisionId: historical.revisionId, etag: current.etag });
    assert.equal(restored.status, 200);
    const restoredWorkspace = await restored.json();
    const rebased = await jsonRequest(app, env, '/rebase', 'POST', { etag: restoredWorkspace.etag, approved: true });
    assert.equal(rebased.status, 200);
    const reviewed = await rebased.json();
    assert.equal(reviewed.baseDrift, false);
    assert.equal(reviewed.workspace.articles[0].title, 'Reviewed help');
    assert.equal(reviewed.rebaseReport.restoration, true);
    assert.equal((await (await app.request('/releases', {}, env)).json()).releases.length, 1);
});


test('Partial deployment cannot be downgraded to failed, unlocked, or lose observed recovery IDs on retry', async () => {
    const {app,env,snapshot,receipt} = await publishedFixture({readiness:false});
    const partial = {...receipt,state:'partially-released',pagesDeploymentId:null,attemptedTargets:['worker'],recovery:{
        workerVersionId:'11111111-1111-1111-1111-111111111111',pagesDeploymentId:'22222222-2222-2222-2222-222222222222',
        workerSourceRevision:'a'.repeat(40),pagesSourceRevision:'a'.repeat(40),contentVersion:'fixture-base',contentDigest:'c'.repeat(64)}};
    assert.equal((await jsonRequest(app,env,`/release/${snapshot.id}/receipt`,'POST',partial,{Authorization:`Bearer ${runnerToken}`})).status,200);
    assert.equal((await jsonRequest(app,env,`/releases/${snapshot.id}/retry`,'POST',{approved:true})).status,202);
    const failed = {...receipt,state:'failed',workerVersionId:null,pagesDeploymentId:null,compiledContentDigest:null,buildSourceRevision:null,attemptedTargets:[]};
    const response = await jsonRequest(app,env,`/release/${snapshot.id}/receipt`,'POST',failed,{Authorization:`Bearer ${runnerToken}`});
    assert.equal(response.status,200);
    const status=(await response.json()).release;
    assert.equal(status.state,'partially-released');assert.equal(status.workerVersionId,receipt.workerVersionId);assert.equal(status.recovery.contentVersion,'fixture-base');
    assert.equal((await (await app.request('/',{},env)).json()).activeReleaseId,snapshot.id);
    const downloaded=await (await app.request(`/release/${snapshot.id}`,{headers:{Authorization:`Bearer ${runnerToken}`}},env)).json();
    assert.equal(downloaded.releaseStatus.workerVersionId,receipt.workerVersionId);
});


test('Stalled dispatched jobs require proved terminal status and never clear the publication lock', async () => {
    let terminal=false;
    const fetchImpl=async (url) => {
        if (url.includes('/runs?')) return Response.json({workflow_runs:[{display_title:`Help publication ${jobId}`,event:'workflow_dispatch',head_branch:'main',status:terminal?'completed':'in_progress',conclusion:'timed_out'}]});
        if (url.includes('/dispatches')) return new Response(null,{status:204});
        return Response.json({private:true,full_name:'carearound/private-runner'});
    };
    let jobId;
    const {app,env,snapshot}=await publishedFixture({fetchImpl});jobId=snapshot.jobId;
    assert.equal((await jsonRequest(app,env,`/releases/${snapshot.id}/reconcile`,'POST',{approved:true})).status,409);
    terminal=true;
    const response=await jsonRequest(app,env,`/releases/${snapshot.id}/reconcile`,'POST',{approved:true});
    assert.equal(response.status,200);assert.equal((await response.json()).release.state,'dispatch-unconfirmed');
    assert.equal((await (await app.request('/',{},env)).json()).activeReleaseId,snapshot.id);
    const receipt={state:'failed',jobId,snapshotDigest:snapshot.snapshotDigest,version:snapshot.version,baseSourceRevision:sourceRevision,compiledContentDigest:null,buildSourceRevision:null};
    assert.equal((await jsonRequest(app,env,`/release/${snapshot.id}/receipt`,'POST',receipt,{Authorization:`Bearer ${runnerToken}`})).status,200);
    assert.equal((await (await app.request('/',{},env)).json()).activeReleaseId,snapshot.id);
});


test('Published-but-active storage failure is recoverable without a new publication or lost drafts', async () => {
    const {app,env,snapshot,receipt,bucket}=await publishedFixture();
    let injected=false;
    bucket.beforePut=async key=>{if(key==='published/current.json'&&!injected){injected=true;throw new Error('transient private storage failure');}};
    const failed=await jsonRequest(app,env,`/release/${snapshot.id}/receipt`,'POST',receipt,{Authorization:`Bearer ${runnerToken}`});
    assert.equal(failed.status,503);
    assert.equal((await (await app.request('/releases',{},env)).json()).releases[0].state,'published');
    assert.equal((await (await app.request('/',{},env)).json()).activeReleaseId,snapshot.id);
    const repair=await jsonRequest(app,env,`/releases/${snapshot.id}/reconcile`,'POST',{approved:true});
    assert.equal(repair.status,200);
    const current=await (await app.request('/',{},env)).json();assert.equal(current.activeReleaseId,null);assert.equal(current.baseDrift,true);
    assert.equal((await jsonRequest(app,env,'/rebase','POST',{etag:current.etag,approved:true})).status,200);
});


test('Private pre-deploy checkpoint retains original recovery before any upload or runner timeout', async () => {
    const {app,env,snapshot,receipt}=await publishedFixture();
    const checkpoint={...receipt,stage:'prepared',workerVersionId:null,pagesDeploymentId:null,attemptedTargets:[],recovery:{
        workerVersionId:'11111111-1111-1111-1111-111111111111',pagesDeploymentId:'22222222-2222-2222-2222-222222222222',
        workerSourceRevision:sourceRevision,pagesSourceRevision:sourceRevision,contentVersion:'fixture-base',contentDigest:'c'.repeat(64)}};
    assert.equal((await jsonRequest(app,env,`/release/${snapshot.id}/checkpoint`,'POST',checkpoint)).status,403);
    const response=await jsonRequest(app,env,`/release/${snapshot.id}/checkpoint`,'POST',checkpoint,{Authorization:`Bearer ${runnerToken}`});
    assert.equal(response.status,200);assert.equal((await response.json()).release.state,'prepared');
    const deploying=await jsonRequest(app,env,`/release/${snapshot.id}/checkpoint`,'POST',{...checkpoint,stage:'deploying',attemptedTargets:['worker']},{Authorization:`Bearer ${runnerToken}`});
    assert.equal(deploying.status,200);assert.equal((await deploying.json()).release.deploymentAttempted,true);
    const downloaded=await (await app.request(`/release/${snapshot.id}`,{headers:{Authorization:`Bearer ${runnerToken}`}},env)).json();
    assert.equal(downloaded.releaseStatus.recovery.workerVersionId,checkpoint.recovery.workerVersionId);
    assert.equal(downloaded.releaseStatus.compiledContentDigest,compiledDigest);
    assert.equal((await jsonRequest(app,env,`/release/${snapshot.id}/checkpoint`,'POST',{...checkpoint,recovery:{...checkpoint.recovery,workerVersionId:receipt.workerVersionId}},{Authorization:`Bearer ${runnerToken}`})).status,409);
    const failed=await jsonRequest(app,env,`/release/${snapshot.id}/receipt`,'POST',{...receipt,state:'failed',workerVersionId:null,pagesDeploymentId:null,compiledContentDigest:null,buildSourceRevision:null},{Authorization:`Bearer ${runnerToken}`});
    assert.equal((await failed.json()).release.state,'partially-released');
    assert.equal((await (await app.request('/',{},env)).json()).activeReleaseId,snapshot.id);
});


test('Successful publication keeps private archived articles, edits, attachments and catalogue order recoverable', async () => {
    const {app,env,snapshot,receipt}=await publishedFixture({editWorkspace:workspace=>{
        workspace.articles[0].status='retired';workspace.articles[0].title='Private archived title edit';
        const archived=article('HC-03');archived.status='retired';archived.title='Never published private archive';
        archived.sections[0].stepIds=['steps-step-1'];archived.sections[0].media=[];
        workspace.articles.push(archived);workspace.manifest.articleOrder.unshift(archived.id);
    }});
    assert.doesNotMatch(JSON.stringify(snapshot.publication), /Private archived title edit|Never published private archive/);
    assert.equal((await jsonRequest(app,env,`/release/${snapshot.id}/receipt`,'POST',receipt,{Authorization:`Bearer ${runnerToken}`})).status,200);
    const saved=await (await app.request('/',{},env)).json();
    assert.equal(saved.workspace.articles.find(a=>a.id==='HC-01').title,'Private archived title edit');
    assert.equal(saved.workspace.articles.find(a=>a.id==='HC-03').title,'Never published private archive');
    assert.equal(saved.workspace.manifest.articleOrder[0],'HC-03');
    assert.equal(saved.workspace.articles.find(a=>a.id==='HC-03').status,'retired');
    const restored=structuredClone(saved.workspace);restored.articles.find(a=>a.id==='HC-03').status='draft';
    assert.equal((await jsonRequest(app,env,'/','PUT',{workspace:restored,etag:saved.etag})).status,200);
});
