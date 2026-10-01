import { guidePilotBindingsReady } from './guidePilotBudget.js';

// This gate is used only by the separately configured account-acceptance Worker.
const SAFE_POST_PATHS = new Set([
    '/api/auth/login', '/api/auth/logout',
    '/api/guide/answer', '/api/guide/search',
    '/api/guide/actions/programmes/draft',
    '/api/guide/actions/programmes/review',
]);

function response(error, status) {
    return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function configuredForAccountAcceptance(env) {
    if (env.ORACLE_ACCOUNT_ACCEPTANCE_ENABLED !== 'true'
        || env.NODE_ENV !== 'production'
        || env.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP !== 'false'
        || !(guidePilotBindingsReady(env) || (env.ORACLE_PREVIEW_LLM_ENABLED !== 'true'
            && env.GUIDE_CHAT_ENABLED === 'false' && env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED === 'false'
            && !env.AI && !env.GUIDE_PILOT_BUDGET))
        || env.MAP_CACHE
        || typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32)
        return false;
    try {
        const connection = new URL(env.DATABASE_URL);
        return ['postgres:', 'postgresql:'].includes(connection.protocol)
            && Boolean(env.ORACLE_ACCOUNT_ACCEPTANCE_DATABASE_HOST)
            && connection.hostname === env.ORACLE_ACCOUNT_ACCEPTANCE_DATABASE_HOST
            && decodeURIComponent(connection.username) === 'carearound_guide_acceptance_readonly'
            && connection.searchParams.get('sslmode') === 'require';
    } catch { return false; }
}

export function gateGuideAccountAcceptance(request, env = {}) {
    const path = new URL(request.url).pathname;
    const api = path === '/api' || path.startsWith('/api/');
    if (!api) return ['GET', 'HEAD'].includes(request.method)
        ? null : response('This preview cannot save changes.', 405);
    if (!configuredForAccountAcceptance(env))
        return response('This preview is not ready for account testing.', 503);
    const sessionRead = path === '/api/auth/me';
    const ordinaryRead = request.method === 'GET' && !path.startsWith('/api/auth/');
    const impersonation = /^\/api\/auth\/impersonate\/[1-9]\d*$/.test(path);
    if (sessionRead && request.method === 'GET' || ordinaryRead
        || request.method === 'POST' && (SAFE_POST_PATHS.has(path) || impersonation))
        return null;
    return response('This preview cannot save changes.', 405);
}
