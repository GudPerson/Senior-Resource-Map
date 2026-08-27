function readConfiguredOrigins(runtimeEnv = {}) {
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};
    return String(runtimeEnv.ALLOWED_ORIGINS || processEnv.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function isCareAroundPagesPreview(originHost) {
    return originHost === 'senior-resource-map.pages.dev'
        || originHost.endsWith('.senior-resource-map.pages.dev');
}

export function resolveAllowedRequestOrigin(origin, runtimeEnv = {}) {
    if (!origin) return null;

    try {
        const parsedOrigin = new URL(origin);
        if (parsedOrigin.origin !== origin) return null;

        const originHost = parsedOrigin.hostname;
        const isLocalDevOrigin = originHost === 'localhost' || originHost === '127.0.0.1';
        const isCareAroundOrigin = originHost === 'app.carearound.sg';

        if (isLocalDevOrigin || isCareAroundPagesPreview(originHost) || isCareAroundOrigin) {
            return parsedOrigin.origin;
        }

        if (readConfiguredOrigins(runtimeEnv).includes(parsedOrigin.origin)) {
            return parsedOrigin.origin;
        }
    } catch {
        // Malformed origins are not trusted.
    }

    return null;
}
