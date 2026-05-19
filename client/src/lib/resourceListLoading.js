export function shouldUseFullResourceDataset({
    query = '',
    boundaryChecksEnabled = false,
    boundaryFilter = 'all',
} = {}) {
    const hasSearchQuery = String(query || '').trim().length > 0;
    const hasClientBoundaryFilter = Boolean(boundaryChecksEnabled) && boundaryFilter !== 'all';
    return hasSearchQuery || hasClientBoundaryFilter;
}
