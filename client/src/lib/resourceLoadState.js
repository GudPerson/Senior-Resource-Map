export function buildResourceLoadFailureMessage({
    isOffline = false,
} = {}) {
    if (isOffline) {
        return {
            title: 'You seem to be offline',
            description: 'Reconnect to the internet, then try loading your resources again.',
            notice: 'You seem to be offline. Reconnect and try again.',
        };
    }

    return {
        title: 'We could not load your resources just now',
        description: 'This can happen when the connection or server is briefly slow. Try again in a moment.',
        notice: 'We could not load your resources just now. Check your connection or try again.',
    };
}

export function getManagedResourceListStatus({
    loading = false,
    loadError = null,
    visibleItemCount = 0,
} = {}) {
    if (loading) return 'loading';
    if (Number(visibleItemCount) > 0) return 'ready';
    if (loadError) return 'load-error';
    return 'empty';
}
