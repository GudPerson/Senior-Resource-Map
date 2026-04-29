import { buildSavedAssetDetailPath } from './savedAssets.js';

const MAP_RETURN_PATH_PREFIXES = ['/my-directory/maps/', '/shared/maps/'];

function isSafeRelativePath(path) {
    return Boolean(path) && path.startsWith('/') && !path.startsWith('//');
}

export function buildCurrentAppPath(location = null) {
    const path = location
        ? `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`
        : (typeof window !== 'undefined'
            ? `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`
            : '/');

    return isSafeRelativePath(path) ? path : '/';
}

export function normalizeMapReturnPath(value, currentPath = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let path = raw;
    if (typeof window !== 'undefined') {
        try {
            const url = new URL(raw, window.location.origin);
            if (url.origin !== window.location.origin) return '';
            path = `${url.pathname}${url.search}${url.hash}`;
        } catch {
            return '';
        }
    }

    if (!isSafeRelativePath(path)) return '';
    if (currentPath && path === currentPath) return '';

    return MAP_RETURN_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
        ? path
        : '';
}

export function getDocumentMapReferrerPath(currentPath = '') {
    if (typeof document === 'undefined') return '';
    return normalizeMapReturnPath(document.referrer, currentPath);
}

export function appendMapReturnTo(path, returnTo) {
    const detailPath = String(path || '').trim();
    const safeReturnTo = normalizeMapReturnPath(returnTo);
    if (!detailPath || !safeReturnTo) return detailPath;

    if (typeof window !== 'undefined') {
        try {
            const url = new URL(detailPath, window.location.origin);
            if (url.origin !== window.location.origin) return detailPath;
            url.searchParams.set('returnTo', safeReturnTo);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch {
            // Fall through to a simple relative-path append below.
        }
    }

    const hashIndex = detailPath.indexOf('#');
    const pathAndSearch = hashIndex >= 0 ? detailPath.slice(0, hashIndex) : detailPath;
    const hash = hashIndex >= 0 ? detailPath.slice(hashIndex) : '';
    const separator = pathAndSearch.includes('?') ? '&' : '?';
    return `${pathAndSearch}${separator}returnTo=${encodeURIComponent(safeReturnTo)}${hash}`;
}

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
