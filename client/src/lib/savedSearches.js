import { requestWithBaseCandidates } from './api.js';
import { getSessionApiBaseCandidates } from './apiBase.js';

export function createSavedSearchApi({ request = requestWithBaseCandidates } = {}) {
    const call = (method, path, body, signal) => request(method, `/saved-searches${path}`, body, {
        baseCandidates: getSessionApiBaseCandidates(), signal, networkAttemptsPerBase: 1,
    });
    const idPath = (id) => {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id || '')) throw new Error('Invalid saved search.');
        return `/${id}`;
    };
    return {
        list: (signal) => call('GET', '', undefined, signal),
        unread: (signal) => call('GET', '/unread-count', undefined, signal),
        create: (input) => call('POST', '', input),
        edit: (id, input) => call('PUT', idPath(id), input),
        remove: (id, revision) => call('DELETE', idPath(id), { revision }),
        setState: (id, noticeId, revision, action) => {
            idPath(noticeId);
            return call('PUT', `${idPath(id)}/digest`, { noticeId, revision, action });
        },
        results: (id, page = 1, signal) => {
            if (!Number.isInteger(page) || page < 1 || page > 9999999) throw new Error('Invalid results page.');
            return call('GET', `${idPath(id)}/results?page=${page}`, undefined, signal);
        },
    };
}
