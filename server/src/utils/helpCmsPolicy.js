import { normalizeRole } from './roles.js';

export class HelpCmsError extends Error {
    constructor(message, status = 400) { super(message); this.name = 'HelpCmsError'; this.status = status; }
}

export function requireHelpCmsOwner(user, env = {}) {
    const configuredId = Number(env.HELP_CMS_OWNER_ID);
    if (!Number.isSafeInteger(configuredId) || configuredId <= 0) {
        throw new HelpCmsError('Help Content owner access is not configured.', 503);
    }
    if (!user?.id) throw new HelpCmsError('Sign in to manage Help Content.', 401);
    if (user.isImpersonating || Number(user.id) !== configuredId || normalizeRole(user.role) !== 'super_admin') {
        throw new HelpCmsError('Help Content is not available to this account.', 403);
    }
    return configuredId;
}

export function requireHelpCmsStorage(env = {}, bucket = env.HELP_CMS_BUCKET) {
    if (env.HELP_CMS_ENABLED !== 'true' || !bucket || typeof bucket.get !== 'function' || typeof bucket.put !== 'function') {
        throw new HelpCmsError('Help Content is not configured yet.', 503);
    }
    return bucket;
}

const safeOrigin = (value) => {
    try {
        const url = new URL(value);
        if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
        if (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.origin;
    } catch { /* invalid configuration remains unavailable */ }
    return null;
};

export function requireHelpCmsOrigin(request, env = {}) {
    const allowed = new Set(['https://app.carearound.sg', safeOrigin(env.FRONTEND_URL), safeOrigin(env.HELP_CMS_PUBLIC_APP_ORIGIN)]);
    if (env.NODE_ENV !== 'production') {
        for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) allowed.add(origin);
    }
    const origin = safeOrigin(request.headers.get('Origin'));
    if (!origin || !allowed.has(origin)) throw new HelpCmsError('Refresh CareAround and try this change again.', 403);
}

export function validCmsId(value) {
    return typeof value === 'string' && /^\d{13}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
}

export function validCmsAssetId(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }

export function requireCmsEtag(value) {
    if (value !== null && (typeof value !== 'string' || !value || value.length > 200 || /[\r\n]/.test(value))) {
        throw new HelpCmsError('Refresh the draft before saving.');
    }
    return value;
}

export function constantTimeTokenEquals(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string' || expected.length < 32 || actual.length > 512) return false;
    let difference = actual.length ^ expected.length;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0);
    return difference === 0;
}

export function requireHelpCmsRunner(request, env = {}) {
    const authorization = request.headers.get('Authorization') || '';
    if (!constantTimeTokenEquals(authorization.startsWith('Bearer ') ? authorization.slice(7) : '', env.HELP_CMS_RELEASE_TOKEN)) {
        throw new HelpCmsError('Release access denied.', 403);
    }
}
