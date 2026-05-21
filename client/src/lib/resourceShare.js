export function buildResourceShareUrl(type, id, origin = '') {
    const resourceType = String(type || '').trim().toLowerCase() === 'soft' ? 'soft' : 'hard';
    const resourceId = encodeURIComponent(String(id || '').trim());
    const baseOrigin = String(origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
    return `${baseOrigin}/resource/${resourceType}/${resourceId}`;
}

export async function shareResourceLink({
    type,
    id,
    title = '',
    origin,
    navigatorApi = typeof navigator !== 'undefined' ? navigator : null,
} = {}) {
    const url = buildResourceShareUrl(type, id, origin);
    const sharePayload = {
        title: title || 'CareAround SG resource',
        text: title || 'CareAround SG resource',
        url,
    };

    if (navigatorApi?.share) {
        await navigatorApi.share(sharePayload);
        return { mode: 'native', url };
    }

    if (navigatorApi?.clipboard?.writeText) {
        await navigatorApi.clipboard.writeText(url);
        return { mode: 'clipboard', url };
    }

    const error = new Error('Sharing is not available in this browser.');
    error.code = 'share_unavailable';
    throw error;
}
