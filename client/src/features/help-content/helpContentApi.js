import { getSessionApiBaseCandidates } from '../../lib/apiBase.js';
import { getImpersonationToken, getSessionAuthHeaders } from '../../lib/sessionAuth.js';

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
    return {
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
