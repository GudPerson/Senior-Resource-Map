import { requestWithBaseCandidates } from './api.js';
import { getSessionApiBaseCandidates } from './apiBase.js';

export function createNotificationApi({ request = requestWithBaseCandidates } = {}) {
    const call = (method, path, body, signal) => request(method, `/notifications${path}`, body, {
        baseCandidates: getSessionApiBaseCandidates(), signal, networkAttemptsPerBase: 1,
    });
    const idPath = (id) => {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id || '')) throw new Error('Invalid update reference.');
        return `/${id}`;
    };
    return {
        preferences: (signal) => call('GET', '/preferences', undefined, signal),
        setPreference: (category, enabled) => call('PUT', '/preferences', { category, enabled }),
        list: (cursor, signal) => call('GET', cursor ? `?${new URLSearchParams(cursor)}` : '', undefined, signal),
        unread: (signal) => call('GET', '/unread-count', undefined, signal),
        setState: (id, revision, action) => call('PUT', idPath(id), { revision, action }),
        setMute: (id, revision, muted) => call('PUT', `/watches${idPath(id)}`, { revision, muted }),
        muted: (after, signal) => call('GET', `/muted${after ? `?after=${encodeURIComponent(after)}` : ''}`, undefined, signal),
    };
}
