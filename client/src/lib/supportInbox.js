import { requestWithBaseCandidates } from './api.js';
import { getSessionApiBaseCandidates } from './apiBase.js';
import { normalizeRole } from './roles.js';

export const SUPPORT_UI_ENABLED = import.meta.env?.VITE_SUPPORT_INBOX_ENABLED === 'true';
export const SUPPORT_UPDATED_EVENT = 'carearound:support-updated';
export const SUPPORT_STATUS_LABELS = { open: 'Received', in_progress: 'Under review',
    awaiting_user: 'Your reply needed', fix_available: 'Fix available to try', resolved: 'Resolved' };
const GUEST_STORAGE_KEY = 'carearound:support-guest-recovery';

export function isSupportImpersonating(user, clientFlag = false) {
    return Boolean(clientFlag || user?.isImpersonating);
}

export function canReviewSupportInbox(user, isImpersonating = false) {
    return Boolean(user?.id) && normalizeRole(user.role) === 'super_admin' && !isSupportImpersonating(user, isImpersonating);
}

export function isGuestSupportKey(value) { return /^[a-f0-9]{64}$/.test(value || ''); }

export function newGuestSupportKey() {
    return [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readGuestSupportKey(storage) {
    try { const value = (storage || globalThis.sessionStorage).getItem(GUEST_STORAGE_KEY); return isGuestSupportKey(value) ? value : ''; }
    catch { return ''; }
}

export function rememberGuestSupportKey(value, storage) {
    try {
        const target = storage || globalThis.sessionStorage;
        if (!value) target.removeItem(GUEST_STORAGE_KEY);
        else if (isGuestSupportKey(value)) target.setItem(GUEST_STORAGE_KEY, value);
        return true;
    } catch { return false; }
}

export function signalSupportUpdate() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SUPPORT_UPDATED_EVENT));
}

export function safeGuideActionRoute(route, signedIn = false) {
    if (['/discover', '/login', '/privacy', '/terms', '/help', '/help?tab=report', '/help?tab=inbox'].includes(route)) return route;
    if (signedIn && ['/my-directory', '/dashboard/calendar', '/dashboard/profile'].includes(route)) return route;
    if (/^\/resource\/(hard|soft)\/[1-9]\d*$/.test(route || '')) return route;
    return null;
}

export function createSupportApi({ guestKey = '', reviewer = false, request = requestWithBaseCandidates } = {}) {
    const prefix = reviewer ? '/support/review/reports' : guestKey ? '/support/guest/reports' : '/support/reports';
    const call = (method, path, body, signal) => request(method, path, body, {
        baseCandidates: getSessionApiBaseCandidates(), signal, networkAttemptsPerBase: 1,
        headers: guestKey && !reviewer ? { 'X-CareAround-Support-Key': guestKey } : {},
    });
    const idPath = (id) => {
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid report reference.');
        return `${prefix}/${id}`;
    };
    return {
        topics: (signal) => call('GET', '/guide/topics', undefined, signal),
        answer: (body, signal) => call('POST', '/guide/answer', body, signal),
        search: (body, signal) => call('POST', '/guide/search', body, signal),
        guideHistory: (signal) => call('GET', '/guide/history', undefined, signal),
        guideConversation: (id, signal) => call('GET', `/guide/history/${encodeURIComponent(id)}`, undefined, signal),
        saveGuideConversation: (body) => call('POST', '/guide/history', body),
        deleteGuideConversation: (id, revision) => call('DELETE', `/guide/history/${encodeURIComponent(id)}`, { revision }),
        list: (cursor, signal) => call('GET', `${prefix}${cursor ? `?${new URLSearchParams(cursor)}` : ''}`, undefined, signal),
        unread: (signal) => call('GET', `${prefix}/unread`, undefined, signal),
        preview: (body) => call('POST', '/support/preview', body),
        create: (body) => call('POST', prefix, body),
        detail: (id, after = 0, signal) => call('GET', `${idPath(id)}?after=${after}`, undefined, signal),
        read: (id, sequence) => call('POST', `${idPath(id)}/read`, { sequence }),
        reply: (id, body) => call('POST', `${idPath(id)}/replies`, body),
        status: (id, body) => call('POST', `${idPath(id)}/status`, body),
        propose: (id, body) => call('POST', `${idPath(id)}/proposals`, body),
        proposal: (id, proposalId, signal) => call('GET', `${idPath(id)}/proposals/${encodeURIComponent(proposalId)}`, undefined, signal),
        approve: (id, body) => call('POST', `${idPath(id)}/approve`, body),
        verify: (id, body) => call('POST', `${idPath(id)}/verify`, body),
    };
}
