const PENDING_MEMBERSHIP_TOKEN_KEY = 'carearound:pending-membership-token';

export function buildMembershipLinkPath(token) {
    const safeToken = String(token || '').trim();
    return safeToken ? `/membership/link?token=${encodeURIComponent(safeToken)}` : '/membership/link';
}

export function setPendingMembershipToken(token) {
    if (typeof window === 'undefined') return;
    const safeToken = String(token || '').trim();
    if (!safeToken) return;
    window.sessionStorage.setItem(PENDING_MEMBERSHIP_TOKEN_KEY, safeToken);
}

export function getPendingMembershipToken() {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(PENDING_MEMBERSHIP_TOKEN_KEY) || '';
}

export function clearPendingMembershipToken() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(PENDING_MEMBERSHIP_TOKEN_KEY);
}
