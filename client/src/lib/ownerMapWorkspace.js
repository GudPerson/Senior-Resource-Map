// Presentation only. This never changes a Studio document, permission or camera.
export function isOwnerMapWorkspaceEnabled(search, enabled = true) {
    const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
    if (params.get('workspace') === 'current') return false;
    if (params.get('workspace') === 'split') return true;
    return enabled === true || enabled === 'true';
}

export function currentOwnerWorkspaceUrl(href, activeViewId = '') {
    const url = new URL(href);
    url.searchParams.set('workspace', 'current');
    if (activeViewId) url.searchParams.set('workspaceView', activeViewId);
    return url.href;
}

export function getOwnerWorkspaceCapacity({ width, height, fontSize = 16, inspectorOpen = false }) {
    const compact = width < 640 || (height < 500 && width < 1024);
    const rail = 96;
    const controlLane = 64;
    const card = 21 * fontSize;
    const inspector = 23 * fontSize;
    const split = !compact && width >= rail + card + inspector + 400 + controlLane + 64;
    const available = width - rail - controlLane - (inspectorOpen && split ? inspector + 32 + 400 : 40);
    const columns = compact ? 1 : Math.max(1, Math.min(3, Math.floor((available + 16) / (card + 16))));
    return { compact, split, columns };
}
