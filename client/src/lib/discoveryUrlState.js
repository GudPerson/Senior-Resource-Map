const DISCOVERY_TAB_VALUES = new Set(['all', 'hard', 'soft']);

export function normalizeDiscoveryTabParam(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return DISCOVERY_TAB_VALUES.has(normalized) ? normalized : 'all';
}

export function applyDiscoveryTabParam(searchParams, activeTab) {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedTab = normalizeDiscoveryTabParam(activeTab);

    if (normalizedTab === 'all') {
        nextParams.delete('type');
    } else {
        nextParams.set('type', normalizedTab);
    }

    return nextParams;
}
