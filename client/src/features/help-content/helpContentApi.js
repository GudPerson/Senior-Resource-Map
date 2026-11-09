import { getSessionApiBaseCandidates } from '../../lib/apiBase.js';
import { getImpersonationToken, getSessionAuthHeaders } from '../../lib/sessionAuth.js';

const identityUrl = 'https://api.carearound.sg/api/help/cms/binding-observation';
const identityFailure = () => new Error('Database identity could not be confirmed. Stop and do not retry.');
const closedPermit = () => ({ armed: false, expiresAt: null });
function identityMetadata(value) {
    const fields = ['ok', 'branch_id', 'database', 'effective_role', 'session_role', 'workerVersionId', 'sourceRevision', 'observedAt'];
    const role = text => typeof text === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(text);
    if (!value || Object.keys(value).sort().join('|') !== [...fields].sort().join('|') || value.ok !== true
        || value.branch_id !== 'br-green-union-ailxs0g3' || value.database !== 'neondb'
        || !role(value.effective_role) || !role(value.session_role)
        || typeof value.workerVersionId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.workerVersionId)
        || typeof value.sourceRevision !== 'string' || !/^[a-f0-9]{40}$/.test(value.sourceRevision)
        || typeof value.observedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.observedAt)
        || !Number.isFinite(Date.parse(value.observedAt)) || new Date(Date.parse(value.observedAt)).toISOString() !== value.observedAt) throw identityFailure();
    return Object.fromEntries(fields.map(field => [field, value[field]]));
}

export function createHelpContentApi({ fetchImpl = (...args) => globalThis.fetch(...args), base = getSessionApiBaseCandidates()[0] } = {}) {
    async function call(path = '', { method = 'GET', body, signal, file, articleId, blob = false } = {}) {
        if (getImpersonationToken()) {
            const error = new Error('Exit User View before opening Help Content.'); error.status = 403; throw error;
        }
        const headers = { ...getSessionAuthHeaders(), 'X-CareAround-Session': '1' };
        let payload;
        if (file) { payload = new FormData(); payload.append('file', file); payload.append('articleId', articleId); }
        else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
        const response = await fetchImpl(`${base}/help/cms${path}`, {
            method, credentials: 'include', cache: 'no-store', headers, signal,
            ...(payload !== undefined ? { body: payload } : {}),
        });
        const json = (response.headers.get('content-type') || '').includes('application/json');
        if (!response.ok) {
            const data = json ? await response.json() : null;
            const error = new Error(data?.error || 'Help Content could not complete this request. Your draft has been kept.');
            error.status = response.status; error.code = data?.code; error.details = data?.details; error.conflicts = data?.conflicts;
            throw error;
        }
        if (blob) {
            const type = response.headers.get('content-type') || '';
            if (!/^image\/(png|jpeg|webp)(?:;|$)/i.test(type)) throw new Error('This image could not be previewed.');
            return response.blob();
        }
        if (!json) throw new Error('Help Content returned an unexpected response. Your draft has been kept.');
        return response.json();
    }
    async function observeBindingOnce(signal) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 5000);
        let reader;
        try {
            if (getImpersonationToken() || controller.signal.aborted) throw identityFailure();
            const response = await fetchImpl(identityUrl, { method: 'POST', credentials: 'include', redirect: 'error', cache: 'no-store', signal: controller.signal });
            if (response.status !== 200 || response.redirected || response.url !== identityUrl
                || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') || '') || !response.body) throw identityFailure();
            reader = response.body.getReader(); const chunks = []; let size = 0;
            for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) throw identityFailure(); chunks.push(value); }
            if (!size) throw identityFailure();
            const bytes = new Uint8Array(size); let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
            return identityMetadata(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
        } catch { controller.abort(); try { await reader?.cancel(); } catch { /* no retry */ } throw identityFailure(); }
        finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); try { reader?.releaseLock(); } catch { /* reader may already be closed */ } }
    }
    return {
        observeBindingOnce,
        identityPermitStatus: async (signal) => {
            // Refresh metadata only. Never apply the returned workspace to the editor.
            const value = (await call('', { signal })).maintenanceIdentityPermit;
            if (!value || Object.keys(value).sort().join('|') !== 'armed|expiresAt' || value.armed !== true
                || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
                || new Date(Date.parse(value.expiresAt)).toISOString() !== value.expiresAt) return closedPermit();
            return { armed: true, expiresAt: value.expiresAt };
        },
        capability: (signal) => call('/capability', { signal }),
        load: (signal) => call('', { signal }),
        save: (workspace, etag, signal) => call('', { method: 'PUT', body: { workspace, etag }, signal }),
        history: (signal) => call('/history', { signal }),
        rebase: (etag, signal) => call('/rebase', { method: 'POST', body: { etag, approved: true }, signal }),
        restore: (revisionId, etag, signal) => call('/restore', { method: 'POST', body: { revisionId, etag }, signal }),
        upload: (file, articleId, signal) => call('/media', { method: 'POST', file, articleId, signal }),
        media: (assetId, signal) => {
            if (!/^[a-zA-Z0-9_-]{1,160}$/.test(assetId || '')) throw new Error('This image is unavailable.');
            return call(`/media/${encodeURIComponent(assetId)}`, { signal, blob: true });
        },
        publish: (etag, reviewNote, signal) => call('/publish', { method: 'POST', body: { etag, reviewNote, approved: true }, signal }),
        releases: (signal) => call('/releases', { signal }),
        reconcile: (releaseId, signal) => {
            if (!/^[a-zA-Z0-9_-]{1,160}$/.test(releaseId || '')) throw new Error('This publication is unavailable.');
            return call(`/releases/${encodeURIComponent(releaseId)}/reconcile`, { method: 'POST', body: { approved: true }, signal });
        },
        retry: (releaseId, signal) => {
            if (!/^[a-zA-Z0-9_-]{1,160}$/.test(releaseId || '')) throw new Error('This publication is unavailable.');
            return call(`/releases/${encodeURIComponent(releaseId)}/retry`, { method: 'POST', body: { approved: true }, signal });
        },
    };
}
