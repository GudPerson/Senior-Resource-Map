import { getApiBaseCandidates } from './apiBase.js';

export async function fetchEmbeddedMap(token, options = {}) {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) throw new Error('Embedded map link is missing');

    const baseCandidates = options.baseCandidates || getApiBaseCandidates();
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const path = `/shared-maps/${encodeURIComponent(normalizedToken)}/embed`;
    let lastNetworkError = null;

    for (let index = 0; index < baseCandidates.length; index += 1) {
        let response;
        try {
            response = await fetchImpl(`${baseCandidates[index]}${path}`, {
                method: 'GET',
                credentials: 'omit',
                headers: { Accept: 'application/json' },
            });
        } catch (error) {
            lastNetworkError = error;
            continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            if (index < baseCandidates.length - 1) continue;
            throw new Error('Embedded map returned an unexpected response');
        }

        const payload = await response.json();
        if (!response.ok) {
            const error = new Error(payload?.error || 'Embedded map is unavailable');
            error.status = response.status;
            throw error;
        }
        return payload;
    }

    if (lastNetworkError) throw lastNetworkError;
    throw new Error('Embedded map is unavailable');
}
