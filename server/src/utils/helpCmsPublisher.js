import { HelpCmsError } from './helpCmsPolicy.js';

const digestPattern = /^[a-f0-9]{64}$/;
const sourcePattern = /^[a-f0-9]{40}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
function configuredOrigin(value, env) {
    try {
        const url = new URL(value);
        if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
        if (url.protocol === 'https:' || env.NODE_ENV !== 'production' && url.protocol === 'http:'
            && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.origin;
    } catch { /* publisher remains unavailable */ }
    return null;
}
export function helpCmsPublishingConfiguration(env = {}) {
    const repository = env.HELP_CMS_PUBLISH_REPOSITORY || '';
    const workflow = env.HELP_CMS_PUBLISH_WORKFLOW || 'help-content-release.yml';
    const branch = env.HELP_CMS_PUBLISH_BRANCH || 'main';
    const appOrigin = configuredOrigin(env.HELP_CMS_PUBLIC_APP_ORIGIN || 'https://app.carearound.sg', env);
    const apiOrigin = configuredOrigin(env.HELP_CMS_PUBLIC_API_ORIGIN, env);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
        || !/^[A-Za-z0-9_.-]+\.ya?ml$/.test(workflow) || branch !== 'main'
        || !env.HELP_CMS_GITHUB_TOKEN || String(env.HELP_CMS_RELEASE_TOKEN || '').length < 32
        || !sourcePattern.test(env.HELP_CMS_SOURCE_REVISION || '') || !appOrigin || !apiOrigin) return null;
    return { repository, workflow, branch, appOrigin, apiOrigin, sourceRevision: env.HELP_CMS_SOURCE_REVISION };
}
async function boundedFetch(fetchImpl, url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try { return await fetchImpl(url, { ...options, signal: controller.signal, redirect: 'error' }); }
    finally { clearTimeout(timer); }
}
export async function dispatchHelpCmsRelease(release, env, fetchImpl = fetch) {
    const config = helpCmsPublishingConfiguration(env);
    if (!config) throw new HelpCmsError('Publishing has not been configured yet.', 503);
    const headers = { Authorization: `Bearer ${env.HELP_CMS_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CareAround-Help-Publisher' };
    const repositoryUrl = `https://api.github.com/repos/${config.repository}`;
    const metadataResponse = await boundedFetch(fetchImpl, repositoryUrl, { headers });
    if (!metadataResponse.ok) throw new HelpCmsError('The private release service is unavailable.', 503);
    const metadata = await metadataResponse.json();
    if (metadata.private !== true || String(metadata.full_name || '').toLowerCase() !== config.repository.toLowerCase()) {
        throw new HelpCmsError('Publishing requires the configured private release repository.', 503);
    }
    const response = await boundedFetch(fetchImpl, `${repositoryUrl}/actions/workflows/${config.workflow}/dispatches`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: config.branch, inputs: { release_id: release.id, job_id: release.jobId,
            content_digest: release.snapshotDigest, base_source_revision: release.baseSourceRevision } }),
    });
    if (response.status !== 204) throw new HelpCmsError('The private release service did not accept this publication.', 503);
    return { repository: config.repository, workflow: config.workflow };
}
export function validateHelpCmsReceipt(receipt, release, previous = {}) {
    if (!receipt || receipt.jobId !== release.jobId || receipt.snapshotDigest !== release.snapshotDigest
        || receipt.version !== release.version || receipt.baseSourceRevision !== release.baseSourceRevision
        || !['published', 'partially-released', 'failed'].includes(receipt.state)) throw new HelpCmsError('Release receipt does not match this publication.', 409);
    if (receipt.attemptedTargets !== undefined && (!Array.isArray(receipt.attemptedTargets)
        || receipt.attemptedTargets.length > 2 || receipt.attemptedTargets.some(target => !['worker', 'pages'].includes(target)))) throw new HelpCmsError('Release receipt contains invalid recovery details.');
    const attemptedTargets = [...new Set([...(previous.attemptedTargets || []), ...(receipt.attemptedTargets || [])])];
    const deploymentAttempted = Boolean(receipt.deploymentAttempted === true || previous.deploymentAttempted || previous.state === 'partially-released'
        || previous.workerVersionId || previous.pagesDeploymentId || receipt.workerVersionId || receipt.pagesDeploymentId || attemptedTargets.length);
    if (receipt.state === 'failed' && !deploymentAttempted) return { state: 'failed', deploymentAttempted: false,
        message: 'Publication failed before deployment. Review the release details before retrying.' };
    if (previous.compiledContentDigest && receipt.compiledContentDigest && previous.compiledContentDigest !== receipt.compiledContentDigest) throw new HelpCmsError('The immutable publication produced a different content digest.',409);
    const compiledContentDigest = receipt.compiledContentDigest || previous.compiledContentDigest;
    const buildSourceRevision = receipt.buildSourceRevision || previous.buildSourceRevision;
    const workerVersionId = receipt.workerVersionId || previous.workerVersionId || null;
    const pagesDeploymentId = receipt.pagesDeploymentId || previous.pagesDeploymentId || null;
    if (receipt.state === 'failed' && deploymentAttempted && (!compiledContentDigest || !buildSourceRevision)) return {
        state: 'dispatch-unconfirmed', deploymentAttempted: true, attemptedTargets,
        ...(previous.workerVersionId ? {workerVersionId: previous.workerVersionId} : {}),
        ...(previous.pagesDeploymentId ? {pagesDeploymentId: previous.pagesDeploymentId} : {}),
        ...(previous.recovery ? {recovery: previous.recovery} : {}),
        message: 'A release job ended without complete verification. Keep this publication pending and check recovery before retrying.'
    };
    if (!digestPattern.test(compiledContentDigest || '') || !sourcePattern.test(buildSourceRevision || '')
        || workerVersionId !== null && !uuidPattern.test(workerVersionId)
        || pagesDeploymentId !== null && !uuidPattern.test(pagesDeploymentId)
        || receipt.state === 'published' && (!workerVersionId || !pagesDeploymentId)) throw new HelpCmsError('Release receipt is incomplete.');
    let recovery = previous.recovery || null;
    if (receipt.recovery) {
        const r = receipt.recovery;
        if (!uuidPattern.test(r.workerVersionId || '') || !uuidPattern.test(r.pagesDeploymentId || '')
            || !sourcePattern.test(r.workerSourceRevision || '') || !sourcePattern.test(r.pagesSourceRevision || '')
            || typeof r.contentVersion !== 'string' || r.contentVersion.length > 160 || !digestPattern.test(r.contentDigest || '')) throw new HelpCmsError('Release recovery identities are incomplete.');
        const candidate = { workerVersionId: r.workerVersionId, pagesDeploymentId: r.pagesDeploymentId,
            workerSourceRevision: r.workerSourceRevision, pagesSourceRevision: r.pagesSourceRevision,
            contentVersion: r.contentVersion, contentDigest: r.contentDigest };
        if (recovery && JSON.stringify(recovery) !== JSON.stringify(candidate)) throw new HelpCmsError('The original recovery reference cannot be replaced.',409);
        recovery ||= candidate;
    }
    return { state: receipt.state === 'failed' ? 'partially-released' : receipt.state,
        compiledContentDigest, buildSourceRevision, workerVersionId, pagesDeploymentId,
        attemptedTargets, deploymentAttempted, recovery };
}
export async function verifyHelpCmsReadiness(release, receipt, env, fetchImpl = fetch) {
    const config = helpCmsPublishingConfiguration(env);
    if (!config) throw new HelpCmsError('Publishing has not been configured yet.', 503);
    const paths = [ `${config.apiOrigin}/api/help/articles`, `${config.apiOrigin}/api/guide/topics`,
        `${config.appOrigin}/help-content-status.json` ];
    const checks = await Promise.all(paths.map(async (url) => {
        try {
            const response = await boundedFetch(fetchImpl, `${url}?release_check=${encodeURIComponent(release.id)}`, {
                headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
            if (!response.ok || !String(response.headers.get('Content-Type') || '').includes('application/json')) return false;
            const body = await response.json();
            return body.version === release.version && body.contentDigest === receipt.compiledContentDigest;
        } catch { return false; }
    }));
    return { ready: checks.every(Boolean), checks: { help: checks[0], guide: checks[1], client: checks[2] } };
}


export async function reconcileHelpCmsJob(release, env, fetchImpl = fetch) {
    const config = helpCmsPublishingConfiguration(env);
    if (!config) throw new HelpCmsError('Publishing has not been configured yet.', 503);
    const headers = {Authorization:`Bearer ${env.HELP_CMS_GITHUB_TOKEN}`, Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28','User-Agent':'CareAround-Help-Publisher'};
    const repositoryUrl = `https://api.github.com/repos/${config.repository}`;
    const metadata = await boundedFetch(fetchImpl, repositoryUrl, {headers});
    if (!metadata.ok) throw new HelpCmsError('The private release job could not be checked.', 503);
    const repository = await metadata.json();
    if (repository.private !== true || String(repository.full_name || '').toLowerCase() !== config.repository.toLowerCase()) throw new HelpCmsError('Private release access could not be verified.',503);
    const response = await boundedFetch(fetchImpl, `${repositoryUrl}/actions/workflows/${config.workflow}/runs?event=workflow_dispatch&branch=main&per_page=100`,{headers});
    if (!response.ok) throw new HelpCmsError('The private release job could not be checked.',503);
    const body = await response.json();
    const runs = (Array.isArray(body.workflow_runs) ? body.workflow_runs : []).filter(run => run.display_title === `Help publication ${release.jobId}`
        && run.event === 'workflow_dispatch' && run.head_branch === 'main');
    if (!runs.length || runs.some(run => run.status !== 'completed')) throw new HelpCmsError('The release job is still running or its completion could not be verified. Keep this publication pending.',409);
    return {jobReconciled:true,deploymentAttempted:true,message:'The release job has ended. Its deployment remains unverified; review and retry this exact publication to complete verification.'};
}
