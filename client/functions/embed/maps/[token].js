const DEFAULT_API_BASE_URL = 'https://api.carearound.sg/api';
const MAX_ALLOWED_ORIGINS = 10;

function isLocalDevelopmentHostname(hostname) {
    const normalized = String(hostname || '').toLowerCase();
    return normalized === 'localhost'
        || normalized === '127.0.0.1'
        || normalized === '[::1]';
}

export function normalizeFrameAncestorOrigins(values) {
    if (!Array.isArray(values) || values.length > MAX_ALLOWED_ORIGINS) return [];
    const normalized = [];
    const seen = new Set();

    for (const value of values) {
        let parsed;
        try {
            parsed = new URL(String(value || '').trim());
        } catch {
            return [];
        }
        const localDevelopmentOrigin = isLocalDevelopmentHostname(parsed.hostname);
        const validProtocol = parsed.protocol === 'https:'
            || (parsed.protocol === 'http:' && localDevelopmentOrigin);
        if (
            !validProtocol
            || parsed.username
            || parsed.password
            || parsed.pathname !== '/'
            || parsed.search
            || parsed.hash
            || !parsed.hostname
            || String(value || '').includes('*')
        ) {
            return [];
        }
        if (!seen.has(parsed.origin)) {
            seen.add(parsed.origin);
            normalized.push(parsed.origin);
        }
    }

    return normalized;
}

export function buildEmbedContentSecurityPolicy(allowedOrigins) {
    const frameAncestors = ["'self'", ...allowedOrigins].join(' ');
    return [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        `frame-ancestors ${frameAncestors}`,
        "script-src 'self' https://static.cloudflareinsights.com",
        "frame-src 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https:",
        "form-action 'none'",
        'upgrade-insecure-requests',
    ].join('; ');
}

function buildUnavailableResponse(status = 503) {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CareAround SG embedded map</title>
  <style>
    html,body{height:100%;margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6f8fb;color:#0f172a}
    main{box-sizing:border-box;min-height:100%;display:grid;place-items:center;padding:24px;text-align:center}
    section{max-width:520px;padding:28px;border:1px solid #dbe4ee;border-radius:24px;background:#fff;box-shadow:0 16px 40px rgba(15,23,42,.08)}
    h1{margin:0;font-size:1.35rem}p{margin:12px 0 0;color:#475569;line-height:1.6}
  </style>
</head>
<body><main><section><h1>This embedded map is unavailable</h1><p>The map owner may have disabled website embedding or the map may be temporarily unavailable.</p></section></main></body>
</html>`;
    return new Response(html, {
        status,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
            'X-Robots-Tag': 'noindex, nofollow',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        },
    });
}

function resolveApiBaseUrl(env = {}) {
    const configured = String(env.CAREAROUND_EMBED_API_BASE_URL || '').trim();
    return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export async function buildEmbeddedMapResponse(context, fetchImpl = globalThis.fetch) {
    const token = String(context?.params?.token || '').trim();
    if (!token || token.length > 128) return buildUnavailableResponse(404);

    let configResponse;
    try {
        const configUrl = `${resolveApiBaseUrl(context.env)}/shared-maps/${encodeURIComponent(token)}/embed-config`;
        configResponse = await fetchImpl(configUrl, {
            headers: { Accept: 'application/json' },
            redirect: 'error',
        });
    } catch {
        return buildUnavailableResponse(503);
    }
    if (!configResponse.ok) {
        return buildUnavailableResponse(configResponse.status === 404 ? 404 : 503);
    }

    let config;
    try {
        config = await configResponse.json();
    } catch {
        return buildUnavailableResponse(503);
    }
    const allowedOrigins = normalizeFrameAncestorOrigins(config?.allowedOrigins);
    if (allowedOrigins.length === 0) return buildUnavailableResponse(404);

    let assetResponse;
    try {
        const indexUrl = new URL('/index.html', context.request.url);
        assetResponse = await context.env.ASSETS.fetch(indexUrl);
    } catch {
        return buildUnavailableResponse(503);
    }
    if (!assetResponse.ok) return buildUnavailableResponse(503);

    const headers = new Headers(assetResponse.headers);
    headers.delete('X-Frame-Options');
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('Content-Security-Policy', buildEmbedContentSecurityPolicy(allowedOrigins));
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
    });
}

export async function onRequest(context) {
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { Allow: 'GET, HEAD' },
        });
    }
    const response = await buildEmbeddedMapResponse(context);
    return context.request.method === 'HEAD'
        ? new Response(null, response)
        : response;
}
