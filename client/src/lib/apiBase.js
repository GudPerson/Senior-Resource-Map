const DEFAULT_API_BASE = '/api';
const CAREAROUND_API_BASE = 'https://api.carearound.sg/api';
// Safety net for Pages deployments that go out without a valid VITE_API_URL.
const CLOUDFLARE_PAGES_FALLBACK_API_BASE = 'https://senior-resource-map-api.joshuachua79.workers.dev/api';
const CUSTOM_DOMAIN_FALLBACK_HOSTS = new Set([
    'app.carearound.sg',
]);

function normalizeBase(value) {
    return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function isAbsoluteHttpUrl(value) {
    return value.startsWith('https://') || value.startsWith('http://');
}

function getSameSiteApiBase(hostname) {
    return hostname === 'app.carearound.sg' ? CAREAROUND_API_BASE : '';
}

export function getApiBaseCandidatesForEnvironment({ hostname = '', envApiUrl = '' } = {}) {
    const envBase = normalizeBase(envApiUrl);
    const explicitBase = isAbsoluteHttpUrl(envBase) ? envBase : '';
    const sameSiteBase = getSameSiteApiBase(hostname);
    const pagesFallbackBase = hostname.endsWith('.pages.dev') || CUSTOM_DOMAIN_FALLBACK_HOSTS.has(hostname)
        ? CLOUDFLARE_PAGES_FALLBACK_API_BASE
        : '';
    const localBase = explicitBase ? DEFAULT_API_BASE : (envBase || DEFAULT_API_BASE);

    return Array.from(new Set([
        sameSiteBase,
        explicitBase,
        pagesFallbackBase,
        localBase,
    ].filter(Boolean)));
}

export function getApiBaseCandidates() {
    return getApiBaseCandidatesForEnvironment({
        hostname: typeof window === 'undefined' ? '' : window.location.hostname,
        envApiUrl: import.meta.env.VITE_API_URL,
    });
}
