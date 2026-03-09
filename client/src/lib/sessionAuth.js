const IMPERSONATION_STORAGE_KEY = 'carearound-impersonation-token';
const IMPERSONATION_HASH_KEY = 'impersonate';

function canUseSessionStorage() {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getImpersonationToken() {
    if (!canUseSessionStorage()) return null;

    try {
        return window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
    } catch {
        return null;
    }
}

export function setImpersonationToken(token) {
    if (!canUseSessionStorage()) return;

    try {
        if (token) {
            window.sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, token);
        } else {
            window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        }
    } catch {
        // Ignore storage failures.
    }
}

export function clearImpersonationToken() {
    setImpersonationToken(null);
}

export function getSessionAuthHeaders() {
    const token = getImpersonationToken();

    if (!token) return {};

    return {
        'X-Session-Token': token,
    };
}

export function consumeImpersonationTokenFromHash() {
    if (typeof window === 'undefined') return null;

    const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;

    if (!rawHash) return null;

    const hashParams = new URLSearchParams(rawHash);
    const token = hashParams.get(IMPERSONATION_HASH_KEY);

    if (!token) return null;

    setImpersonationToken(token);
    hashParams.delete(IMPERSONATION_HASH_KEY);

    const nextHash = hashParams.toString();
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);

    return token;
}
