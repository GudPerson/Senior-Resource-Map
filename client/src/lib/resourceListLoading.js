import { fetchPaginatedResultPage } from './paginatedResults.js';

export const RESOURCE_LIST_PAGE_LOAD_ATTEMPTS = 3;
export const RESOURCE_LIST_SEARCH_DEBOUNCE_MS = 350;

export function shouldUseFullResourceDataset({
    query = '',
    boundaryChecksEnabled = false,
    boundaryFilter = 'all',
} = {}) {
    const normalizedQuery = String(query || '').trim();
    const hasClientOnlySearchOperators = /[,/]/.test(normalizedQuery);
    const hasClientBoundaryFilter = Boolean(boundaryChecksEnabled) && boundaryFilter !== 'all';
    return hasClientOnlySearchOperators || hasClientBoundaryFilter;
}

export function buildManagedResourceListParams({
    canManageResourceTools = false,
    role = '',
} = {}) {
    if (!canManageResourceTools) return {};
    const normalizedRole = String(role || '').trim().toLowerCase();
    return normalizedRole === 'regional_admin'
        ? { scope: 'managed', regionScoped: true }
        : { scope: 'managed' };
}

export function buildManagedHardResourceListParams(options = {}) {
    const params = buildManagedResourceListParams(options);
    return Object.keys(params).length > 0 ? { ...params, summary: true } : params;
}

export function buildManagedSoftResourceListParams(options = {}) {
    const params = buildManagedResourceListParams(options);
    return Object.keys(params).length > 0 ? { ...params, summary: true } : params;
}

export function buildGroupMemberCandidateListParams({ assetType = '' } = {}) {
    return String(assetType || '').trim().toLowerCase() === 'hard'
        ? { summary: true }
        : {};
}

export function shouldHydrateAllAdminResourcePages({
    role = '',
} = {}) {
    return String(role || '').trim().toLowerCase() !== 'regional_admin';
}

export function withResourceListSearchParam(params = {}, query = '') {
    const normalizedQuery = String(query || '').trim();
    return normalizedQuery ? { ...params, q: normalizedQuery } : params;
}

export function settleResourceListRequest(promise) {
    return Promise.resolve(promise).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason }),
    );
}

export async function fetchResourceListPageWithResilience(fetchPage, params = {}, options = {}) {
    const settings = typeof options === 'number' ? { pageSize: options } : options;
    return fetchPaginatedResultPage(fetchPage, params, {
        maxAttempts: RESOURCE_LIST_PAGE_LOAD_ATTEMPTS,
        ...settings,
    });
}
