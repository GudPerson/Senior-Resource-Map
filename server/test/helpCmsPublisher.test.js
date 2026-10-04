import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchHelpCmsRelease, reconcileHelpCmsJob, verifyHelpCmsReadiness } from '../src/utils/helpCmsPublisher.js';

const repository = 'fictional/private-publisher';
const repositoryUrl = `https://api.github.com/repos/${repository}`;
const env = {
    NODE_ENV: 'production', HELP_CMS_PUBLISH_REPOSITORY: repository,
    HELP_CMS_GITHUB_TOKEN: 'fictional-service-token', HELP_CMS_RELEASE_TOKEN: 'r'.repeat(40),
    HELP_CMS_SOURCE_REVISION: 'a'.repeat(40),
    HELP_CMS_PUBLIC_API_ORIGIN: 'https://api.example.com', HELP_CMS_PUBLIC_APP_ORIGIN: 'https://app.example.com',
};
const release = {
    id: '1791130548800-11111111-1111-4111-8111-111111111111',
    jobId: '22222222-2222-4222-8222-222222222222', snapshotDigest: 'b'.repeat(64),
    baseSourceRevision: env.HELP_CMS_SOURCE_REVISION, version: 'fictional-publication',
};
const receipt = { compiledContentDigest: 'c'.repeat(64) };
const privateRepository = () => Response.json({ private: true, full_name: repository });
const publishedContent = () => Response.json({ version: release.version, contentDigest: receipt.compiledContentDigest });
const redirectResponse = status => new Response(null, { status, headers: { Location: 'https://untrusted.example/collect' } });

test('Publication dispatch sends the exact immutable inputs only after private repository verification', async () => {
    const requests = [];
    await dispatchHelpCmsRelease(release, env, async (url, options) => {
        requests.push(new Request(url, options));
        return requests.length === 1 ? privateRepository() : new Response(null, { status: 204 });
    });
    assert.deepEqual(requests.map(request => [request.method, request.url]), [
        ['GET', repositoryUrl], ['POST', `${repositoryUrl}/actions/workflows/help-content-release.yml/dispatches`],
    ]);
    assert.deepEqual(requests.map(request => request.redirect), ['manual', 'manual']);
    assert.equal(requests[0].headers.get('Authorization'), 'Bearer fictional-service-token');
    assert.deepEqual(await requests[1].json(), { ref: 'main', inputs: {
        release_id: release.id, job_id: release.jobId, content_digest: release.snapshotDigest,
        base_source_revision: release.baseSourceRevision,
    } });
});

test('Every 3xx metadata response refuses publication without sending credentials to a redirect destination', async () => {
    for (let status = 300; status < 400; status++) {
        const requests = [];
        await assert.rejects(dispatchHelpCmsRelease(release, env, async (url) => {
            requests.push(url);
            return redirectResponse(status);
        }), error => error.status === 503 && /unexpected redirect/.test(error.message));
        assert.deepEqual(requests, [repositoryUrl]);
    }
});

test('A workflow dispatch redirect is refused after private repository verification', async () => {
    const requests = [];
    await assert.rejects(dispatchHelpCmsRelease(release, env, async (url) => {
        requests.push(url);
        return requests.length === 1 ? privateRepository() : redirectResponse(307);
    }), error => error.status === 503 && /unexpected redirect/.test(error.message));
    assert.equal(requests.length, 2);
    assert.equal(requests[1], `${repositoryUrl}/actions/workflows/help-content-release.yml/dispatches`);
});

test('Job checks reconcile only the matching terminal job and retain running-job refusal', async () => {
    let terminal = false;
    const fetchImpl = async url => url === repositoryUrl ? privateRepository() : Response.json({ workflow_runs: [
        { display_title: 'Unrelated publication', event: 'workflow_dispatch', head_branch: 'main', status: 'in_progress' },
        { display_title: `Help publication ${release.jobId}`, event: 'workflow_dispatch', head_branch: 'main', status: terminal ? 'completed' : 'in_progress' },
    ] });
    await assert.rejects(reconcileHelpCmsJob(release, env, fetchImpl), error => error.status === 409);
    terminal = true;
    assert.equal((await reconcileHelpCmsJob(release, env, fetchImpl)).jobReconciled, true);
});

test('Job checks refuse redirects from either GitHub metadata or workflow runs', async () => {
    for (const redirectAt of ['metadata', 'runs']) {
        const requests = [];
        await assert.rejects(reconcileHelpCmsJob(release, env, async url => {
            requests.push(url);
            return url === repositoryUrl && redirectAt !== 'metadata' ? privateRepository() : redirectResponse(302);
        }), error => error.status === 503 && /unexpected redirect/.test(error.message));
        assert.equal(requests.length, redirectAt === 'metadata' ? 1 : 2);
        assert.ok(requests.every(url => url.startsWith(repositoryUrl)));
    }
});

test('Readiness requires matching Help, Guide and website versions and refuses a redirect on any surface', async () => {
    const paths = ['/api/help/articles', '/api/guide/topics', '/help-content-status.json'];
    assert.deepEqual(await verifyHelpCmsReadiness(release, receipt, env, async () => publishedContent()), {
        ready: true, checks: { help: true, guide: true, client: true },
    });
    for (const redirected of paths) {
        const result = await verifyHelpCmsReadiness(release, receipt, env, async url =>
            new URL(url).pathname === redirected ? redirectResponse(308) : publishedContent());
        assert.equal(result.ready, false);
        assert.equal(Object.values(result.checks).filter(Boolean).length, 2);
    }
});

test('An unresponsive publication request is still aborted after exactly fifteen seconds', async context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    let signal;
    const publication = dispatchHelpCmsRelease(release, env, async (url, options) => {
        signal = options.signal;
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    assert.equal(signal.aborted, false);
    context.mock.timers.tick(14999);
    assert.equal(signal.aborted, false);
    context.mock.timers.tick(1);
    assert.equal(signal.aborted, true);
    await assert.rejects(publication, error => error.name === 'AbortError');
});
