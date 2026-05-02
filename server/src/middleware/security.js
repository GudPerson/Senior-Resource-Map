const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const DEFAULT_FILE_BODY_LIMIT_BYTES = 15 * 1024 * 1024;

function readEnvValue(runtimeEnv = {}, ...keys) {
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};

    for (const source of [runtimeEnv || {}, processEnv]) {
        for (const key of keys) {
            const raw = source?.[key];
            if (raw === undefined || raw === null) continue;
            const value = String(raw).trim().replace(/^['"]|['"]$/g, '');
            if (value) return value;
        }
    }

    return '';
}

function isHttpsRequest(c) {
    try {
        const url = new URL(c.req.url);
        if (url.protocol === 'https:') return true;
    } catch {
        // Fall through to proxy headers.
    }

    const forwardedProto = String(c.req.header('x-forwarded-proto') || '').toLowerCase();
    return forwardedProto.split(',').map((value) => value.trim()).includes('https');
}

export function isProductionRequest(c) {
    const nodeEnv = readEnvValue(c.env, 'NODE_ENV').toLowerCase();
    const envName = readEnvValue(c.env, 'ENVIRONMENT', 'CF_PAGES_BRANCH').toLowerCase();
    return nodeEnv === 'production' || envName === 'production' || envName === 'main';
}

export async function securityHeaders(c, next) {
    await next();

    const csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "script-src 'self' https://accounts.google.com https://static.cloudflareinsights.com",
        "frame-src https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https:",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ].join('; ');

    c.header('Content-Security-Policy', csp);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
    c.header('Cross-Origin-Resource-Policy', 'same-site');
    c.header('Vary', 'Origin');

    if (isProductionRequest(c) && isHttpsRequest(c)) {
        c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
}

function parseContentLength(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isJsonContentType(contentType) {
    const type = String(contentType || '').toLowerCase();
    return type.includes('application/json') || type.includes('+json');
}

function isLargeBodyRoute(pathname) {
    return pathname.startsWith('/api/upload')
        || (pathname.startsWith('/api/private-resource-content/') && pathname.includes('/files'))
        || pathname === '/api/soft-assets/import/collateral/preview'
        || pathname.startsWith('/api/admin/imports/');
}

function getBodyLimitBytes(c) {
    const pathname = new URL(c.req.url).pathname;
    return isLargeBodyRoute(pathname) ? DEFAULT_FILE_BODY_LIMIT_BYTES : DEFAULT_JSON_BODY_LIMIT_BYTES;
}

export async function requestBodyGuard(c, next) {
    if (!BODY_METHODS.has(c.req.method.toUpperCase())) {
        await next();
        return;
    }

    const limitBytes = getBodyLimitBytes(c);
    const contentLength = parseContentLength(c.req.header('content-length'));
    if (contentLength !== null && contentLength > limitBytes) {
        c.header('Connection', 'close');
        return c.json({
            error: `Request body is too large. Maximum allowed size is ${Math.floor(limitBytes / (1024 * 1024))} MB.`,
        }, 413);
    }

    if (isJsonContentType(c.req.header('content-type')) && c.req.raw.body !== null) {
        try {
            await c.req.raw.clone().json();
        } catch {
            return c.json({ error: 'Request body must be valid JSON.' }, 400);
        }
    }

    await next();
}

function normalizeIp(value) {
    const text = String(value || '').split(',')[0].trim();
    return text || 'unknown';
}

function getClientKey(c) {
    const sessionToken = c.req.header('x-session-token');
    if (sessionToken) {
        return `session:${sessionToken.slice(0, 24)}`;
    }

    return `ip:${normalizeIp(
        c.req.header('cf-connecting-ip')
        || c.req.header('x-forwarded-for')
        || c.req.header('x-real-ip')
        || 'unknown',
    )}`;
}

function cleanupExpiredBuckets(store, now) {
    if (store.size < 5000) return;
    for (const [key, bucket] of store.entries()) {
        if (!bucket || bucket.resetAt <= now) {
            store.delete(key);
        }
    }
}

export function createRateLimiter({
    name,
    limit,
    windowMs,
    methods = DEFAULT_ALLOWED_METHODS,
    keyFn = getClientKey,
}) {
    const allowedMethods = new Set(methods.map((method) => method.toUpperCase()));

    return async (c, next) => {
        if (!allowedMethods.has(c.req.method.toUpperCase())) {
            await next();
            return;
        }

        const now = Date.now();
        const storeKey = '__carearoundRateLimitBuckets';
        globalThis[storeKey] = globalThis[storeKey] || new Map();
        const store = globalThis[storeKey];
        cleanupExpiredBuckets(store, now);

        const key = `${name}:${keyFn(c)}`;
        const current = store.get(key);
        const bucket = current && current.resetAt > now
            ? current
            : { count: 0, resetAt: now + windowMs };
        bucket.count += 1;
        store.set(key, bucket);

        const remaining = Math.max(0, limit - bucket.count);
        c.header('X-RateLimit-Limit', String(limit));
        c.header('X-RateLimit-Remaining', String(remaining));
        c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > limit) {
            c.header('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
            return c.json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
        }

        await next();
    };
}

export const authRateLimit = createRateLimiter({
    name: 'auth',
    limit: 20,
    windowMs: 10 * 60 * 1000,
});

export const uploadRateLimit = createRateLimiter({
    name: 'upload',
    limit: 40,
    windowMs: 15 * 60 * 1000,
    methods: ['POST'],
});

export const aiRateLimit = createRateLimiter({
    name: 'ai',
    limit: 25,
    windowMs: 60 * 60 * 1000,
    methods: ['POST'],
});

export const translationRateLimit = createRateLimiter({
    name: 'translation',
    limit: 80,
    windowMs: 60 * 60 * 1000,
    methods: ['POST', 'PUT'],
});
