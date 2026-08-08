export const MAX_MAP_EMBED_ORIGINS = 10;

function createEmbedOriginError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function isLocalDevelopmentHostname(hostname) {
    const normalized = String(hostname || '').toLowerCase();
    return normalized === 'localhost'
        || normalized === '127.0.0.1'
        || normalized === '[::1]';
}

export function normalizeMapEmbedOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        throw createEmbedOriginError('Website origin is required');
    }
    if (raw.includes('*')) {
        throw createEmbedOriginError('Website origins cannot contain wildcards');
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw createEmbedOriginError('Enter a complete website origin such as https://www.example.org.sg');
    }

    const localDevelopmentOrigin = isLocalDevelopmentHostname(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localDevelopmentOrigin)) {
        throw createEmbedOriginError('Published website origins must use HTTPS');
    }
    if (parsed.username || parsed.password) {
        throw createEmbedOriginError('Website origins cannot include sign-in details');
    }
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
        throw createEmbedOriginError('Use only the website origin without a page path, query, or fragment');
    }
    if (!parsed.hostname || parsed.hostname.startsWith('.') || parsed.hostname.endsWith('.')) {
        throw createEmbedOriginError('Enter a valid website hostname');
    }

    return parsed.origin;
}

export function normalizeMapEmbedOrigins(values) {
    if (!Array.isArray(values)) {
        throw createEmbedOriginError('Approved websites must be provided as a list');
    }
    if (values.length > MAX_MAP_EMBED_ORIGINS) {
        throw createEmbedOriginError(`You can approve up to ${MAX_MAP_EMBED_ORIGINS} websites`);
    }

    const normalized = [];
    const seen = new Set();
    values.forEach((value) => {
        const origin = normalizeMapEmbedOrigin(value);
        if (seen.has(origin)) return;
        seen.add(origin);
        normalized.push(origin);
    });
    return normalized;
}
