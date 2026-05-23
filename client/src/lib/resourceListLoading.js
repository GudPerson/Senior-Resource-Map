export function shouldUseFullResourceDataset({
    query = '',
    boundaryChecksEnabled = false,
    boundaryFilter = 'all',
} = {}) {
    const hasSearchQuery = String(query || '').trim().length > 0;
    const hasClientBoundaryFilter = Boolean(boundaryChecksEnabled) && boundaryFilter !== 'all';
    return hasSearchQuery || hasClientBoundaryFilter;
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

export function withResourceListSearchParam(params = {}, query = '') {
    const normalizedQuery = String(query || '').trim();
    return normalizedQuery ? { ...params, q: normalizedQuery } : params;
}
