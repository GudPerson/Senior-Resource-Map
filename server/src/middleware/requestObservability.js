const DEFAULT_SLOW_REQUEST_MS = 2000;

function readNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function defaultNow() {
    return typeof globalThis.performance?.now === 'function'
        ? globalThis.performance.now()
        : Date.now();
}

function defaultRequestId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function sanitizeObservedRoute(value) {
    let pathname = '/unknown';
    try {
        pathname = new URL(String(value || ''), 'https://carearound.invalid').pathname;
    } catch {
        return pathname;
    }
    return pathname.split('/').map((segment) => {
        if (!segment) return segment;
        if (/^:\w+$/.test(segment)) return segment;
        if (/^\d+$/.test(segment)) return ':id';
        if (segment.length > 24 || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ':id';
        return segment.replace(/[^a-z0-9._~-]/gi, ':');
    }).join('/');
}

function resolveRouteLabel(c) {
    const routePath = String(c.req.routePath || '').trim();
    if (routePath && routePath !== '*') return sanitizeObservedRoute(routePath);
    return sanitizeObservedRoute(c.req.url);
}

function getObservabilityConfig(c) {
    const env = c.env || {};
    return {
        sampleRate: readNumber(env.REQUEST_LOG_SAMPLE_RATE, 0, { min: 0, max: 1 }),
        slowRequestMs: readNumber(env.SLOW_REQUEST_MS, DEFAULT_SLOW_REQUEST_MS, { min: 100, max: 120000 }),
    };
}

export function createRequestObservability(deps = {}) {
    const now = deps.now || defaultNow;
    const createRequestId = deps.createRequestId || defaultRequestId;
    const random = deps.random || Math.random;
    const log = deps.log || ((event) => console.log(JSON.stringify(event)));

    return async function requestObservability(c, next) {
        const startedAt = now();
        const requestId = createRequestId();
        c.set('requestId', requestId);
        c.header('X-Request-ID', requestId);
        let thrown = null;

        try {
            await next();
        } catch (error) {
            thrown = error;
            throw error;
        } finally {
            const durationMs = Math.max(0, now() - startedAt);
            const roundedDurationMs = Math.round(durationMs * 10) / 10;
            const status = thrown ? 500 : Number(c.res?.status || 200);
            const { sampleRate, slowRequestMs } = getObservabilityConfig(c);
            const shouldLog = status >= 500 || durationMs >= slowRequestMs || random() < sampleRate;

            c.header('X-Request-ID', requestId);
            c.header('Server-Timing', `app;dur=${roundedDurationMs}`);

            if (shouldLog) {
                const cacheStatus = String(c.res?.headers?.get('X-CareAround-Cache') || '').trim().toLowerCase();
                log({
                    event: 'api_request',
                    requestId,
                    method: c.req.method,
                    route: resolveRouteLabel(c),
                    status,
                    durationMs: roundedDurationMs,
                    outcome: status >= 500 ? 'error' : (durationMs >= slowRequestMs ? 'slow' : 'sampled'),
                    ...(cacheStatus ? { cacheStatus } : {}),
                });
            }
        }
    };
}

export const requestObservability = createRequestObservability();
