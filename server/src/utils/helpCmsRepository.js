import { HelpCmsError, validCmsAssetId, validCmsId } from './helpCmsPolicy.js';

const WORKSPACE_KEY = 'workspace/current.json';
const clone = (value) => JSON.parse(JSON.stringify(value));
const createOnly = () => new Headers({ 'If-None-Match': '*' });
const idFor = (now) => `${String(now().getTime()).padStart(13, '0')}-${crypto.randomUUID()}`;
export async function cmsSha256(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createHelpCmsRepository(bucket, { seedWorkspace, seed, now = () => new Date() } = {}) {
    const readJson = async (key) => {
        const object = await bucket.get(key);
        if (!object) return null;
        return { value: await object.json(), etag: object.etag };
    };
    const writeImmutable = async (key, value, metadata = {}) => {
        const result = await bucket.put(key, JSON.stringify(value), { onlyIf: createOnly(),
            httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' }, customMetadata: metadata });
        if (!result) throw new HelpCmsError('This revision already exists. Try again.', 409);
        return result;
    };
    async function loadWorkspace() {
        const current = await readJson(WORKSPACE_KEY);
        return current ? { ...current.value, etag: current.etag } : { workspace: clone(seedWorkspace), baselineSeed: clone(seed), etag: null, revisionId: null };
    }
    async function saveWorkspace(workspace, etag, ownerId, { restoredFrom = null, previousRevisionId = null, baselineSeed = seed, restorationIntent = false } = {}) {
        const revisionId = idFor(now), updatedAt = now().toISOString();
        const record = { workspace, baselineSeed, revisionId, previousRevisionId, updatedAt, ownerId, restorationIntent, ...(restoredFrom ? { restoredFrom } : {}) };
        await writeImmutable(`revisions/${revisionId}.json`, record, { updatedAt, ownerId: String(ownerId) });
        const saved = await bucket.put(WORKSPACE_KEY, JSON.stringify(record), {
            onlyIf: etag === null ? createOnly() : { etagMatches: etag },
            httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
        });
        if (!saved) throw new HelpCmsError('This draft changed in another window. Refresh it before saving.', 409);
        return { ...record, etag: saved.etag };
    }
    async function getRevision(id) {
        if (!validCmsId(id)) throw new HelpCmsError('Revision not found.', 404);
        const revision = await readJson(`revisions/${id}.json`);
        if (!revision) throw new HelpCmsError('Revision not found.', 404);
        return revision.value;
    }
    async function list(prefix) {
        const objects = [], maximum = 1000;
        let cursor;
        do {
            const result = await bucket.list({ prefix, limit: Math.min(100, maximum - objects.length), ...(cursor ? { cursor } : {}) });
            objects.push(...result.objects);
            cursor = result.truncated ? result.cursor : null;
        } while (cursor && objects.length < maximum);
        return objects.sort((a, b) => b.key.localeCompare(a.key)).slice(0, 50);
    }
    async function history() {
        // A failed conditional save can leave an immutable orphan. Only revisions
        // reachable through the successful workspace chain count as saved history.
        const current = await loadWorkspace(), rows = [];
        let id = current.revisionId;
        while (id && rows.length < 50) {
            const revision = await getRevision(id);
            rows.push({ revisionId: revision.revisionId, updatedAt: revision.updatedAt,
                ...(revision.restoredFrom ? { restoredFrom: revision.restoredFrom } : {}) });
            id = revision.previousRevisionId || null;
        }
        return rows;
    }
    async function saveAsset(bytes, metadata) {
        const assetId = await cmsSha256(bytes);
        const result = await bucket.put(`media/${assetId}`, bytes, { onlyIf: createOnly(),
            httpMetadata: { contentType: metadata.contentType, cacheControl: 'private, no-store' },
            customMetadata: { ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])), assetId } });
        if (!result) {
            const existing = await bucket.get(`media/${assetId}`);
            if (!existing || existing.httpMetadata?.contentType !== metadata.contentType) throw new HelpCmsError('Image storage conflict.', 409);
        }
        return assetId;
    }
    async function getAsset(id) {
        if (!validCmsAssetId(id)) throw new HelpCmsError('Image not found.', 404);
        const asset = await bucket.get(`media/${id}`);
        if (!asset) throw new HelpCmsError('Image not found.', 404);
        return asset;
    }
    async function createRelease(publication, etag, ownerId) {
        const current = await loadWorkspace();
        if (current.etag !== etag || etag === null) throw new HelpCmsError('Save and refresh the draft before publishing.', 409);
        const id = idFor(now), jobId = crypto.randomUUID(), createdAt = now().toISOString();
        const record = { schemaVersion: 1, id, jobId, createdAt, ownerId,
            revisionId: current.revisionId, workspaceEtag: etag, ...publication };
        await claimPublication(id);
        try {
            await writeImmutable(`releases/${id}/snapshot.json`, record);
            await writeImmutable(`release-status/${id}.json`, { id, jobId, createdAt, updatedAt: createdAt,
                version: record.version, snapshotDigest: record.snapshotDigest, baseSourceRevision: record.baseSourceRevision, state: 'queued' });
        } catch (error) { await completePublication(id).catch(() => {}); throw error; }
        return record;
    }
    async function getRelease(id) {
        if (!validCmsId(id)) throw new HelpCmsError('Release not found.', 404);
        const result = await readJson(`releases/${id}/snapshot.json`);
        if (!result) throw new HelpCmsError('Release not found.', 404);
        return result.value;
    }
    async function releaseStatus(id) {
        if (!validCmsId(id)) throw new HelpCmsError('Release not found.', 404);
        const result = await readJson(`release-status/${id}.json`);
        if (!result) throw new HelpCmsError('Release not found.', 404);
        return result;
    }
    async function updateRelease(id, patch, expectedEtag) {
        const current = await releaseStatus(id);
        if (expectedEtag && expectedEtag !== current.etag) throw new HelpCmsError('Release status changed. Retry the status check.', 409);
        if (current.value.state === 'published') {
            if (patch.state !== 'published') throw new HelpCmsError('This release is already published.', 409);
            return current.value;
        }
        if (patch.state === 'failed' && (current.value.deploymentAttempted || current.value.workerVersionId || current.value.pagesDeploymentId)) {
            throw new HelpCmsError('A deployment was attempted. Verify recovery before clearing this publication.', 409);
        }
        const next = { ...current.value, ...patch,
            ...(current.value.workerVersionId && !patch.workerVersionId ? { workerVersionId: current.value.workerVersionId } : {}),
            ...(current.value.pagesDeploymentId && !patch.pagesDeploymentId ? { pagesDeploymentId: current.value.pagesDeploymentId } : {}),
            updatedAt: now().toISOString() };
        const result = await bucket.put(`release-status/${id}.json`, JSON.stringify(next), {
            onlyIf: { etagMatches: current.etag }, httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
        if (!result) throw new HelpCmsError('Release status changed. Retry the status check.', 409);
        return next;
    }
    async function releases() {
        const records = await list('release-status/');
        return Promise.all(records.map(async (item) => (await readJson(item.key))?.value));
    }
    async function latestPublished() {
        const pointer = await readJson('published/current.json');
        return pointer ? getRelease(pointer.value.releaseId) : null;
    }
    async function activePublication() {
        const pointer = await readJson('publication/active.json');
        return pointer?.value.releaseId || null;
    }
    async function claimPublication(releaseId) {
        const pointer = await readJson('publication/active.json');
        if (pointer?.value.releaseId === releaseId) return;
        if (pointer?.value.releaseId) throw new HelpCmsError('A publication is still pending. Review its status before publishing again.', 409);
        const result = await bucket.put('publication/active.json', JSON.stringify({ releaseId }), {
            onlyIf: pointer ? { etagMatches: pointer.etag } : createOnly(),
            httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
        if (!result) throw new HelpCmsError('Another publication started. Review its status before publishing again.', 409);
    }
    async function completePublication(releaseId) {
        const pointer = await readJson('publication/active.json');
        if (pointer?.value.releaseId !== releaseId) return;
        const result = await bucket.put('publication/active.json', JSON.stringify({ releaseId: null }), {
            onlyIf: { etagMatches: pointer.etag }, httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
        if (!result) throw new HelpCmsError('Publication status changed. Retry the status check.', 409);
    }
    async function markPublished(release) {
        const pointer = await readJson('published/current.json');
        if (pointer && pointer.value.releaseId >= release.id) return;
        const result = await bucket.put('published/current.json', JSON.stringify({ releaseId: release.id,
            version: release.version, snapshotDigest: release.snapshotDigest }), {
            onlyIf: pointer ? { etagMatches: pointer.etag } : createOnly(),
            httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
        if (!result) throw new HelpCmsError('The published version changed. Retry the receipt.', 409);
    }
    return { loadWorkspace, saveWorkspace: async (workspace, etag, ownerId, options) => {
        const current = await loadWorkspace();
        if (current.etag !== etag) throw new HelpCmsError('This draft changed in another window. Refresh it before saving.', 409);
        return saveWorkspace({ ...workspace }, etag, ownerId, { baselineSeed: current.baselineSeed || seed,
            restorationIntent: Boolean(current.restorationIntent), ...options, previousRevisionId: current.revisionId });
    }, getRevision, history, saveAsset, getAsset, createRelease, getRelease, releaseStatus, updateRelease, releases,
    latestPublished, markPublished, activePublication, claimPublication, completePublication };
}
