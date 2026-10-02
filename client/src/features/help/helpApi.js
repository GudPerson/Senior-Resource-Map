import { requestWithBaseCandidates } from '../../lib/api.js';
import { getSessionApiBaseCandidates } from '../../lib/apiBase.js';
import { helpArticleRoute, normalizeHelpQuery } from './helpLibrary.js';

export function createHelpArticlesApi({ request = requestWithBaseCandidates, fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
    const call = (path, signal) => request('GET', `/help/articles${path}`, undefined, {
        baseCandidates: getSessionApiBaseCandidates(), networkAttemptsPerBase: 1, signal,
        fetchImpl: (url, options) => fetchImpl(url, { ...options, cache: 'no-store' }),
    });
    return {
        list: (signal) => call('', signal),
        search: (query, signal) => call(`/search?${new URLSearchParams({ q: normalizeHelpQuery(query) })}`, signal),
        article: (slug, signal, sectionId = '') => {
            if (!helpArticleRoute(slug, sectionId)) throw new Error('This help article link is unavailable.');
            return call(`/${slug}${sectionId ? `?${new URLSearchParams({ section: sectionId })}` : ''}`, signal);
        },
    };
}
