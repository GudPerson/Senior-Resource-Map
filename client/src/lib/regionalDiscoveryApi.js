import { getApiBaseCandidates } from './apiBase.js';
import { normalizeRegionalDiscoveryPayload } from '../features/regional-discovery/regionalDiscoveryContract.js';

function publicError(code, status) {
    return Object.assign(new Error(code === 'unavailable' ? 'This directory is unavailable.' : code === 'invalid-postal' ? 'Enter a six-digit Singapore postal code.' : 'Services could not be checked. Please retry.'), {code, ...(status ? {status} : {})});
}

async function requestRegionalDiscovery(token, { postalCode, signal, fetchImpl = globalThis.fetch, baseCandidates = getApiBaseCandidates() } = {}) {
    if (typeof token !== 'string' || !token.trim()) throw publicError('unavailable');
    const evaluating = postalCode !== undefined;
    if (evaluating && (typeof postalCode !== 'string' || !/^\d{6}$/.test(postalCode))) throw publicError('invalid-postal');
    const path = `/shared-maps/${encodeURIComponent(token.trim())}/embed/regional-discovery${evaluating ? '/evaluate' : ''}`;
    for (let index = 0; index < baseCandidates.length; index++) {
        signal?.throwIfAborted();
        let response;
        try {
            response = await fetchImpl(`${baseCandidates[index]}${path}`, {
                method: evaluating ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
                headers: { Accept: 'application/json', ...(evaluating ? {'Content-Type':'application/json'} : {}) },
                ...(evaluating ? {body:JSON.stringify({postalCode})} : {}),
            });
        } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError') throw error;
            if (index < baseCandidates.length - 1) continue;
            throw publicError('request-failed');
        }
        signal?.throwIfAborted();
        if (!response.ok) throw publicError([403,404,410].includes(response.status) ? 'unavailable' : 'request-failed', response.status);
        if (!(response.headers.get('content-type') || '').includes('application/json')) {
            if (index < baseCandidates.length - 1) continue;
            throw publicError('request-failed');
        }
        try {
            const dto = normalizeRegionalDiscoveryPayload(await response.json());
            if (evaluating ? dto.evaluation.postalCode !== postalCode || dto.evaluation.status === 'none' : dto.evaluation.status !== 'none' || dto.evaluation.postalCode !== undefined) throw publicError('request-failed');
            signal?.throwIfAborted();
            return dto;
        } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError') throw error;
            throw publicError('request-failed');
        }
    }
    throw publicError('request-failed');
}

export function getRegionalDiscoveryDirectory(token, options = {}) {
    // A GET never accepts query/body evaluation context.
    const {postalCode: ignored, ...requestOptions} = options;
    void ignored;
    return requestRegionalDiscovery(token, requestOptions);
}
export function evaluateRegionalDiscovery(token, options = {}) {
    return requestRegionalDiscovery(token, {...options, postalCode:options.postalCode ?? ''});
}

export function buildDiscoveryHandoffUrl({postalCode, canonicalServiceQuery = ''} = {}) {
    // Discovery's q is generic text search; there is no supported canonical service
    // mapping. Deliberately omit category labels/keys until such a mapping exists.
    void canonicalServiceQuery;
    const params = new URLSearchParams();
    if (typeof postalCode === 'string' && /^\d{6}$/.test(postalCode)) params.set('postal',postalCode);
    return `/discover${params.size ? `?${params}` : ''}`;
}
