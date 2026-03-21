const DEFAULT_API_BASE = '/api';
// Safety net for Pages deployments that go out without a valid VITE_API_URL.
const CLOUDFLARE_PAGES_FALLBACK_API_BASE = 'https://senior-resource-map-api.joshuachua79.workers.dev/api';

function normalizeBase(value) {
    return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function isAbsoluteHttpUrl(value) {
    return value.startsWith('https://') || value.startsWith('http://');
}

function getPagesFallbackApiBase() {
    if (typeof window === 'undefined') return '';
    return window.location.hostname.endsWith('.pages.dev')
        ? CLOUDFLARE_PAGES_FALLBACK_API_BASE
        : '';
}

export function getApiBaseCandidates() {
    const envBase = normalizeBase(import.meta.env.VITE_API_URL);
    const pagesFallbackBase = getPagesFallbackApiBase();
    const explicitBase = isAbsoluteHttpUrl(envBase) ? envBase : '';
    const localBase = explicitBase ? DEFAULT_API_BASE : (envBase || DEFAULT_API_BASE);

    return Array.from(new Set([
        explicitBase,
        pagesFallbackBase,
        localBase,
    ].filter(Boolean)));
}
