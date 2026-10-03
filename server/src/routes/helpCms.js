import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import { HELP_CMS_SEED } from '../generated/helpCmsSeed.js';
import { HELP_ARTICLES } from '../generated/helpKnowledge.js';
import { CMS_LIMITS, cmsSeedWorkspace, validateCmsWorkspace, prepareCmsPublication, validateCmsImage } from '../../../shared/helpContentCms.js';
import { HelpCmsError, requireHelpCmsOwner, requireHelpCmsStorage, requireHelpCmsOrigin,
    requireHelpCmsRunner, requireCmsEtag, validCmsAssetId } from '../utils/helpCmsPolicy.js';
import { cmsSha256, createHelpCmsRepository } from '../utils/helpCmsRepository.js';
import { rebaseHelpCmsWorkspace } from '../utils/helpCmsRebase.js';
import { dispatchHelpCmsRelease, helpCmsPublishingConfiguration, validateHelpCmsReceipt,
    verifyHelpCmsReadiness, reconcileHelpCmsJob } from '../utils/helpCmsPublisher.js';

async function boundedBody(request, maximum) {
    if (!request.body) return new Uint8Array();
    const reader = request.body.getReader(), chunks = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maximum) { await reader.cancel(); throw new HelpCmsError('This upload is too large.', 413); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
}
async function readJson(request, limit = CMS_LIMITS.workspaceBytes + 4096) {
    try { return JSON.parse(new TextDecoder().decode(await boundedBody(request, limit))); }
    catch (error) { if (error instanceof HelpCmsError) throw error; throw new HelpCmsError('Check the draft details and try again.'); }
}
function validateDraft(workspace, seed) {
    if (workspace?.baseContentVersion !== seed.manifest.version) throw new HelpCmsError('This draft needs review against its published base version.', 409);
    try { return validateCmsWorkspace(workspace, seed); }
    catch (error) { throw new HelpCmsError(String(error.message || 'The draft is invalid.').slice(0, 300)); }
}
const imageRefs = (articles) => [...new Set(articles.filter(a => a.visibility === 'public' && a.status === 'approved')
    .flatMap(a => a.sections.flatMap(s => (s.media || []).filter(m => m.type === 'image').map(m => m.assetId))))];
function promotePublishedWorkspace(publication, currentWorkspace) {
    const publishedSeed = { manifest: publication.manifest, articles: publication.articles };
    const workspace = cmsSeedWorkspace(publishedSeed);
    for (const draft of currentWorkspace.articles.filter(article => article.status === 'draft' || article.status === 'retired')) {
        const index = workspace.articles.findIndex(article => article.id === draft.id);
        if (index >= 0) workspace.articles[index] = draft;
        else { workspace.articles.push(draft); workspace.manifest.articleOrder.push(draft.id); }
        if (!workspace.manifest.categories.some(category => category.id === draft.category)) {
            const category = currentWorkspace.manifest.categories.find(item => item.id === draft.category);
            if (category) workspace.manifest.categories.push(category);
        }
    }
    const identities = new Set(workspace.articles.map(article => article.id));
    workspace.manifest.articleOrder = [...currentWorkspace.manifest.articleOrder.filter(id => identities.has(id)),
        ...workspace.manifest.articleOrder.filter(id => !currentWorkspace.manifest.articleOrder.includes(id))];
    return { workspace, publishedSeed };
}
function imageResponse(object, publicRead = false) {
    const type = object.httpMetadata?.contentType;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw new HelpCmsError('Image not found.', 404);
    return new Response(object.body, { headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline', 'Cache-Control': publicRead ? 'public, max-age=31536000, immutable' : 'private, no-store' } });
}

export function createHelpCmsRoutes({ authenticate = authenticateToken, seed = HELP_CMS_SEED,
    bucketForContext = c => c.env?.HELP_CMS_BUCKET, fetchImpl = fetch, now = () => new Date() } = {}) {
    const router = new Hono(), owners = new Hono(), runner = new Hono();
    router.use('*', async (c, next) => {
        try { await next(); }
        finally {
            c.header('Cache-Control', 'private, no-store');
            c.header('Vary', 'Cookie, Authorization, X-CareAround-Session');
            c.header('X-Content-Type-Options', 'nosniff');
        }
    });
    const repository = c => createHelpCmsRepository(requireHelpCmsStorage(c.env, bucketForContext(c)), {
        seed, seedWorkspace: cmsSeedWorkspace(seed), now });
    const handle = action => async c => {
        try { return await action(c, repository(c)); }
        catch (error) {
            if (error instanceof HelpCmsError) return c.json({ error: error.message,
                ...(Array.isArray(error.conflicts) ? { conflicts: error.conflicts } : {}) }, error.status);
            return c.json({ error: 'Help Content is temporarily unavailable. Your last saved draft is retained.' }, 503);
        }
    };
    runner.use('*', async (c, next) => {
        try { requireHelpCmsRunner(c.req.raw, c.env); requireHelpCmsStorage(c.env, bucketForContext(c)); await next(); }
        catch (error) { return c.json({ error: error instanceof HelpCmsError ? error.message : 'Release service unavailable.' }, error instanceof HelpCmsError ? error.status : 503); }
    });
    runner.get('/latest', handle(async (c, repo) => {
        const release = await repo.latestPublished();
        if (!release) throw new HelpCmsError('No CMS release has been published yet.', 404);
        return c.json(release);
    }));
    runner.get('/:id', handle(async (c, repo) => {
        const release = await repo.getRelease(c.req.param('id'));
        return c.json({ ...release, releaseStatus: (await repo.releaseStatus(release.id)).value });
    }));
    runner.get('/:id/media/:assetId', handle(async (c, repo) => {
        const release = await repo.getRelease(c.req.param('id'));
        if (!imageRefs(release.publication.articles).includes(c.req.param('assetId'))) throw new HelpCmsError('Image not found.', 404);
        return imageResponse(await repo.getAsset(c.req.param('assetId')));
    }));
    runner.post('/:id/checkpoint', handle(async (c, repo) => {
        const release = await repo.getRelease(c.req.param('id'));
        const previous = (await repo.releaseStatus(release.id)).value;
        if (previous.state === 'published') throw new HelpCmsError('This publication is already complete.',409);
        const body = await readJson(c.req.raw,16384);
        if (!['prepared','deploying'].includes(body.stage) || !body.recovery
            || body.stage === 'prepared' && body.attemptedTargets?.length
            || body.stage === 'deploying' && !body.attemptedTargets?.length) throw new HelpCmsError('Release checkpoint is incomplete.');
        const checkpoint = validateHelpCmsReceipt({...body,state:'partially-released',workerVersionId:null,pagesDeploymentId:null},release,previous);
        const state = body.stage === 'deploying' || checkpoint.deploymentAttempted ? 'partially-released' : 'prepared';
        return c.json({release:await repo.updateRelease(release.id,{...checkpoint,state,checkpointAt:now().toISOString()})});
    }));
    runner.post('/:id/receipt', handle(async (c, repo) => {
        const release = await repo.getRelease(c.req.param('id'));
        const previous = (await repo.releaseStatus(release.id)).value;
        const receipt = validateHelpCmsReceipt(await readJson(c.req.raw, 16384), release, previous);
        if (receipt.state === 'failed' || receipt.state === 'dispatch-unconfirmed') {
            const status = await repo.updateRelease(release.id, receipt);
            if (receipt.state === 'failed') await repo.completePublication(release.id);
            return c.json({ release: status });
        }
        const readiness = await verifyHelpCmsReadiness(release, receipt, c.env, fetchImpl);
        const state = receipt.state === 'published' && readiness.ready ? 'published' : 'partially-released';
        const status = await repo.updateRelease(release.id, { ...receipt, state, readiness: readiness.checks,
            ...(state === 'published' ? { publishedAt: now().toISOString() } : { message: 'Both Help and Guide versions have not been verified. Review recovery before retrying.' }) });
        if (state === 'published') {
            await repo.markPublished(release);
            const current = await repo.loadWorkspace();
            const latest = await repo.latestPublished();
            if (latest?.id === release.id && current.etag === release.workspaceEtag) {
                const { workspace, publishedSeed } = promotePublishedWorkspace(release.publication, current.workspace);
                try {
                    validateDraft(workspace, publishedSeed);
                    await repo.saveWorkspace(workspace, current.etag, release.ownerId, { baselineSeed: publishedSeed, restorationIntent: false });
                } catch {
                    // Live publication is verified. Preserve the saved draft and
                    // expose baseDrift/rebase if its promotion needs another attempt.
                }
            }
            await repo.completePublication(release.id);
        }
        return c.json({ release: status });
    }));
    router.route('/release', runner);
    owners.use('*', authenticate);
    owners.use('*', async (c, next) => {
        try {
            requireHelpCmsStorage(c.env, bucketForContext(c));
            c.set('helpCmsOwnerId', requireHelpCmsOwner(c.get('user'), c.env));
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method.toUpperCase())) requireHelpCmsOrigin(c.req.raw, c.env);
            await next();
        } catch (error) { return c.json({ error: error instanceof HelpCmsError ? error.message : 'Help Content is unavailable.' }, error instanceof HelpCmsError ? error.status : 503); }
    });
    const workspaceResponse = async (repo, env) => {
        const current = await repo.loadWorkspace(), latest = await repo.latestPublished();
        validateDraft(current.workspace, current.baselineSeed || seed);
        return { workspace: current.workspace, etag: current.etag, revisionId: current.revisionId,
            configured: true, publishingAvailable: Boolean(helpCmsPublishingConfiguration(env)),
            baseDrift: Boolean(latest && current.workspace.baseContentVersion !== latest.version),
            activeReleaseId: await repo.activePublication() };
    };
    owners.get('/', handle(async (c, repo) => c.json(await workspaceResponse(repo, c.env))));
    owners.get('/capability', c => c.json({ canEdit: true }));
    owners.put('/', handle(async (c, repo) => {
        const body = await readJson(c.req.raw), current = await repo.loadWorkspace();
        const workspace = validateDraft(body.workspace, current.baselineSeed || seed);
        await repo.saveWorkspace(workspace, requireCmsEtag(body.etag), c.get('helpCmsOwnerId'));
        return c.json(await workspaceResponse(repo, c.env));
    }));
    owners.get('/history', handle(async (c, repo) => c.json({ revisions: await repo.history() })));
    owners.post('/restore', handle(async (c, repo) => {
        const body = await readJson(c.req.raw, 16384), current = await repo.loadWorkspace();
        let revision;
        if (body.revisionId === 'published') {
            const published = await repo.latestPublished();
            if (!published) throw new HelpCmsError('No CMS release has been published yet.', 404);
            const publishedSeed = { manifest: published.publication.manifest, articles: published.publication.articles };
            revision = { workspace: cmsSeedWorkspace(publishedSeed), baselineSeed: publishedSeed, revisionId: published.id };
        } else revision = await repo.getRevision(body.revisionId);
        const baselineSeed = revision.baselineSeed || current.baselineSeed || seed;
        validateDraft(revision.workspace, baselineSeed);
        await repo.saveWorkspace(revision.workspace, requireCmsEtag(body.etag), c.get('helpCmsOwnerId'), {
            restoredFrom: revision.revisionId, baselineSeed, restorationIntent: body.revisionId !== 'published' });
        return c.json(await workspaceResponse(repo, c.env));
    }));
    owners.post('/rebase', handle(async (c, repo) => {
        const body = await readJson(c.req.raw, 16384);
        if (body.approved !== true) throw new HelpCmsError('Confirm reviewing the saved draft against the current published content first.');
        const current = await repo.loadWorkspace(), latest = await repo.latestPublished(), etag = requireCmsEtag(body.etag);
        if (!latest) throw new HelpCmsError('No CMS release has been published yet.', 404);
        if (current.etag !== etag || etag === null) throw new HelpCmsError('This draft changed. Refresh it before rebasing.', 409);
        if (current.workspace.baseContentVersion === latest.version) throw new HelpCmsError('This draft already uses the current published version.', 409);
        const publishedSeed = { manifest: latest.publication.manifest, articles: latest.publication.articles };
        const frozen = await repo.getRevision(latest.revisionId);
        const rebased = rebaseHelpCmsWorkspace(current.workspace, current.baselineSeed || seed, publishedSeed, {
            restorationIntent: Boolean(current.restorationIntent), publicationWorkspace: frozen.workspace });
        validateDraft(rebased.workspace, publishedSeed);
        await repo.saveWorkspace(rebased.workspace, etag, c.get('helpCmsOwnerId'), { baselineSeed: publishedSeed, restorationIntent: false });
        return c.json({ ...await workspaceResponse(repo, c.env), rebaseReport: rebased.report });
    }));
    owners.post('/media', handle(async (c, repo) => {
        if (!String(c.req.header('Content-Type') || '').startsWith('multipart/form-data;')) throw new HelpCmsError('Choose an image file to upload.');
        const bytes = await boundedBody(c.req.raw, CMS_LIMITS.imageBytes + 65536);
        let form;
        try { form = await new Response(bytes, { headers: { 'Content-Type': c.req.header('Content-Type') } }).formData(); }
        catch { throw new HelpCmsError('Choose a valid image file to upload.'); }
        const file = form.get('file'), articleId = form.get('articleId');
        const current = await repo.loadWorkspace();
        validateDraft(current.workspace, current.baselineSeed || seed);
        const article = current.workspace.articles.find(item => item.id === articleId);
        if (!article || article.visibility !== 'public' || article.status === 'retired') throw new HelpCmsError('Images can only be attached to active public articles.');
        if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || file.size > CMS_LIMITS.imageBytes) throw new HelpCmsError('Choose an image no larger than 2 MB.');
        const image = new Uint8Array(await file.arrayBuffer());
        let details;
        try { details = validateCmsImage(image, file.type); }
        catch (error) { throw new HelpCmsError(String(error.message || 'Choose a valid image.').slice(0, 300)); }
        const assetId = await repo.saveAsset(image, { contentType: details.mime, size: details.size, articleId });
        return c.json({ assetId }, 201);
    }));
    owners.get('/media/:assetId', handle(async (c, repo) => imageResponse(await repo.getAsset(c.req.param('assetId')))));
    owners.post('/publish', handle(async (c, repo) => {
        const body = await readJson(c.req.raw, 16384);
        if (body.approved !== true) throw new HelpCmsError('Review this content and confirm publication first.');
        const config = helpCmsPublishingConfiguration(c.env);
        if (!config) throw new HelpCmsError('Publishing has not been configured yet.', 503);
        const current = await repo.loadWorkspace(), latest = await repo.latestPublished();
        validateDraft(current.workspace, current.baselineSeed || seed);
        if (latest && current.workspace.baseContentVersion !== latest.version) throw new HelpCmsError('A newer version was published. Review or restore the published content before publishing this draft.', 409);
        const etag = requireCmsEtag(body.etag);
        if (etag === null || current.etag !== etag) throw new HelpCmsError('Save and refresh the draft before publishing.', 409);
        const date = now(), version = `${date.toISOString().slice(0, 10)}.help-cms.${date.getTime()}`;
        let publication;
        try { publication = prepareCmsPublication(current.workspace, { seed: current.baselineSeed || seed,
            reviewNote: body.reviewNote, owner: 'CareAround content owner', date: date.toISOString().slice(0, 10),
            version, sourceRevision: config.sourceRevision }); }
        catch (error) { throw new HelpCmsError(String(error.message || 'Review the content before publishing.').slice(0, 300)); }
        for (const assetId of imageRefs(publication.articles)) await repo.getAsset(assetId);
        const snapshotDigest = await cmsSha256(JSON.stringify(publication));
        const release = await repo.createRelease({ publication, version, snapshotDigest, baseSourceRevision: config.sourceRevision }, etag, c.get('helpCmsOwnerId'));
        try {
            await dispatchHelpCmsRelease(release, c.env, fetchImpl);
            const currentStatus = await repo.releaseStatus(release.id);
            const status = currentStatus.value.state === 'queued'
                ? await repo.updateRelease(release.id, { state: 'dispatched', message: null }, currentStatus.etag) : currentStatus.value;
            return c.json({ release: status }, 202);
        } catch {
            const currentStatus = await repo.releaseStatus(release.id);
            if (currentStatus.value.state !== 'published') await repo.updateRelease(release.id, { state: 'dispatch-unconfirmed', message: 'Publication dispatch could not be confirmed. Review release status before retrying.' }, currentStatus.etag);
            throw new HelpCmsError('Publication dispatch could not be confirmed. Your draft is retained; review status before retrying.', 503);
        }
    }));
    owners.get('/releases', handle(async (c, repo) => c.json({ releases: await repo.releases() })));
    owners.post('/releases/:id/reconcile', handle(async (c, repo) => {
        const body = await readJson(c.req.raw,16384);
        if (body.approved !== true) throw new HelpCmsError('Confirm checking this private release job.');
        const release = await repo.getRelease(c.req.param('id')), status = await repo.releaseStatus(release.id);
        if (status.value.state === 'published') {
            const readiness = await verifyHelpCmsReadiness(release,status.value,c.env,fetchImpl);
            if (!readiness.ready) throw new HelpCmsError('The published release cannot be verified. Keep recovery pending.',409);
            await repo.markPublished(release);
            await repo.completePublication(release.id);
            return c.json({release:status.value});
        }
        if (!['queued','dispatched','dispatch-unconfirmed','prepared'].includes(status.value.state)) throw new HelpCmsError('This release already has a confirmed result.',409);
        const result = await reconcileHelpCmsJob(release,c.env,fetchImpl);
        return c.json({release:await repo.updateRelease(release.id,{...result,state:'dispatch-unconfirmed'},status.etag)});
    }));
    owners.post('/releases/:id/retry', handle(async (c, repo) => {
        const body = await readJson(c.req.raw, 16384);
        if (body.approved !== true) throw new HelpCmsError('Confirm retrying this exact publication after reviewing its status.');
        const release = await repo.getRelease(c.req.param('id')), status = await repo.releaseStatus(release.id);
        if (!['failed', 'dispatch-unconfirmed', 'partially-released'].includes(status.value.state)) throw new HelpCmsError('This publication is not ready to retry.', 409);
        if (status.value.state === 'dispatch-unconfirmed' && !status.value.jobReconciled) throw new HelpCmsError('Check that the private release job has ended before retrying.',409);
        const config = helpCmsPublishingConfiguration(c.env), latest = await repo.latestPublished();
        if (!config || config.sourceRevision !== release.baseSourceRevision) throw new HelpCmsError('The application release changed. Review this publication before retrying.', 409);
        if (latest && latest.id !== release.id && latest.version !== release.publication.baseContentVersion) throw new HelpCmsError('A newer version was published. Review a new draft before publishing again.', 409);
        await repo.claimPublication(release.id);
        await repo.updateRelease(release.id, { state: 'queued', message: null, jobReconciled: false }, status.etag);
        try {
            await dispatchHelpCmsRelease(release, c.env, fetchImpl);
            const currentStatus = await repo.releaseStatus(release.id);
            const updated = currentStatus.value.state === 'queued' ? await repo.updateRelease(release.id, { state: 'dispatched', message: null }, currentStatus.etag) : currentStatus.value;
            return c.json({ release: updated }, 202);
        } catch {
            const currentStatus = await repo.releaseStatus(release.id);
            if (currentStatus.value.state === 'queued') await repo.updateRelease(release.id, { state: 'dispatch-unconfirmed', message: 'Retry dispatch could not be confirmed. Review status before retrying again.' }, currentStatus.etag);
            throw new HelpCmsError('Retry dispatch could not be confirmed. Review status before retrying again.', 503);
        }
    }));
    router.route('/', owners);
    return router;
}

export function createHelpMediaRoutes({ articles = HELP_ARTICLES, bucketForContext = c => c.env?.HELP_CMS_BUCKET } = {}) {
    const router = new Hono();
    const publicAssets = new Set(articles.filter(a => a.visibility === 'public').flatMap(a => a.sections
        .flatMap(s => (s.media || []).filter(m => m.type === 'image').map(m => m.assetId))));
    router.get('/:assetId', async c => {
        try {
            const id = c.req.param('assetId'), bucket = bucketForContext(c);
            if (!validCmsAssetId(id) || !publicAssets.has(id) || !bucket || typeof bucket.get !== 'function') throw new HelpCmsError('Image not found.', 404);
            const object = await bucket.get(`media/${id}`);
            if (!object) throw new HelpCmsError('Image not found.', 404);
            return imageResponse(object, true);
        } catch { return c.json({ error: 'Image not found.' }, 404); }
    });
    return router;
}

export default createHelpCmsRoutes();
