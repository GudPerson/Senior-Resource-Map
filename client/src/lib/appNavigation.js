import { buildSavedAssetDetailPath } from './savedAssets.js';

export function hardNavigate(path, navigate = null) {
    if (typeof window !== 'undefined') {
        window.location.assign(path);
        return;
    }

    navigate?.(path);
}

export function openResourceDetail(resourceType, resourceId, navigate = null) {
    const detailPath = buildSavedAssetDetailPath(resourceType, resourceId);
    hardNavigate(detailPath, navigate);
    return detailPath;
}
