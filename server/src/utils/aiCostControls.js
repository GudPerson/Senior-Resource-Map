const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AI_IMPORT_DAILY_LIMIT = 20;
const DEFAULT_GROUNDED_AI_DAILY_LIMIT = 10;
const AI_KV_KEY_PREFIX = 'ai-cost-control';

function normalizeRuntimeEnv(runtimeEnv = {}) {
    return runtimeEnv?.env ?? runtimeEnv ?? {};
}

export function readEnvValue(runtimeEnv = {}, ...keys) {
    const env = normalizeRuntimeEnv(runtimeEnv);
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};

    for (const source of [env || {}, processEnv]) {
        for (const key of keys) {
            const raw = source?.[key];
            if (raw === undefined || raw === null) continue;
            const value = String(raw).trim().replace(/^['"]|['"]$/g, '');
            if (value) return value;
        }
    }

    return '';
}

export function readBooleanEnv(runtimeEnv = {}, key, defaultValue = false) {
    const value = readEnvValue(runtimeEnv, key).toLowerCase();
    if (!value) return defaultValue;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(value);
}

export function readIntegerEnv(runtimeEnv = {}, key, defaultValue) {
    const numeric = Number.parseInt(readEnvValue(runtimeEnv, key), 10);
    return Number.isInteger(numeric) && numeric >= 0 ? numeric : defaultValue;
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function getCounterStore() {
    globalThis.__carearoundAiCostCounters = globalThis.__carearoundAiCostCounters || new Map();
    return globalThis.__carearoundAiCostCounters;
}

function getCacheStore() {
    globalThis.__carearoundAiCostCache = globalThis.__carearoundAiCostCache || new Map();
    return globalThis.__carearoundAiCostCache;
}

function getKv(runtimeEnv = {}) {
    const env = normalizeRuntimeEnv(runtimeEnv);
    return env?.MAP_CACHE || null;
}

function cleanExpiredCacheEntries(now = Date.now()) {
    const cache = getCacheStore();
    for (const [key, entry] of cache.entries()) {
        if (!entry || entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
}

export function fingerprintAiValue(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildAiCacheKey(namespace, payload = {}) {
    return `${namespace}:${fingerprintAiValue(JSON.stringify(payload))}`;
}

export async function getCachedAiResult(runtimeEnv, namespace, payload) {
    if (readBooleanEnv(runtimeEnv, 'AI_CACHE_DISABLED', false)) return null;
    const key = buildAiCacheKey(namespace, payload);
    const kv = getKv(runtimeEnv);
    if (kv && typeof kv.get === 'function') {
        const rawValue = await kv.get(`${AI_KV_KEY_PREFIX}:cache:${key}`);
        if (!rawValue) return null;
        try {
            const parsed = JSON.parse(rawValue);
            return parsed?.value ?? null;
        } catch {
            return null;
        }
    }

    cleanExpiredCacheEntries();
    const entry = getCacheStore().get(key);
    return entry?.expiresAt > Date.now() ? entry.value : null;
}

export async function setCachedAiResult(runtimeEnv, namespace, payload, value) {
    if (readBooleanEnv(runtimeEnv, 'AI_CACHE_DISABLED', false)) return value;
    const ttlHours = readIntegerEnv(runtimeEnv, 'AI_CACHE_TTL_HOURS', Math.round(DEFAULT_CACHE_TTL_MS / (60 * 60 * 1000)));
    if (ttlHours <= 0) return value;
    const key = buildAiCacheKey(namespace, payload);
    const kv = getKv(runtimeEnv);
    if (kv && typeof kv.put === 'function') {
        await kv.put(`${AI_KV_KEY_PREFIX}:cache:${key}`, JSON.stringify({ value }), {
            expirationTtl: Math.max(60, ttlHours * 60 * 60),
        });
        return value;
    }

    getCacheStore().set(key, {
        value,
        expiresAt: Date.now() + ttlHours * 60 * 60 * 1000,
    });
    return value;
}

function costError(message, status = 429) {
    const err = new Error(message);
    err.status = status;
    return err;
}

export function assertAiCallAllowed(runtimeEnv, {
    feature,
    defaultDailyLimit,
    envLimitKey,
    explicitEnableKey = '',
    explicitEnableMessage = '',
} = {}) {
    if (explicitEnableKey && !readBooleanEnv(runtimeEnv, explicitEnableKey, false)) {
        throw costError(explicitEnableMessage || `${feature} is disabled by AI cost controls.`, 503);
    }

    const limit = readIntegerEnv(runtimeEnv, envLimitKey, defaultDailyLimit);
    if (limit === 0) {
        throw costError(`${feature} daily quota is set to 0.`, 429);
    }

    const counterKey = `${todayKey()}:${feature}`;
    const counters = getCounterStore();
    const count = counters.get(counterKey) || 0;
    if (count >= limit) {
        throw costError(`${feature} daily quota reached. Try again tomorrow or ask an admin to raise the AI quota.`, 429);
    }

    counters.set(counterKey, count + 1);
}

export async function assertAiCallAllowedAsync(runtimeEnv, options = {}) {
    const {
        feature,
        defaultDailyLimit,
        envLimitKey,
        explicitEnableKey = '',
        explicitEnableMessage = '',
    } = options;

    if (explicitEnableKey && !readBooleanEnv(runtimeEnv, explicitEnableKey, false)) {
        throw costError(explicitEnableMessage || `${feature} is disabled by AI cost controls.`, 503);
    }

    const limit = readIntegerEnv(runtimeEnv, envLimitKey, defaultDailyLimit);
    if (limit === 0) {
        throw costError(`${feature} daily quota is set to 0.`, 429);
    }

    const counterKey = `${todayKey()}:${feature}`;
    const kv = getKv(runtimeEnv);
    if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
        const key = `${AI_KV_KEY_PREFIX}:counter:${counterKey}`;
        const current = Number.parseInt(await kv.get(key), 10) || 0;
        if (current >= limit) {
            throw costError(`${feature} daily quota reached. Try again tomorrow or ask an admin to raise the AI quota.`, 429);
        }
        await kv.put(key, String(current + 1), { expirationTtl: 36 * 60 * 60 });
        return;
    }

    assertAiCallAllowed(runtimeEnv, options);
}

export async function assertGroundedAiAllowed(runtimeEnv) {
    await assertAiCallAllowedAsync(runtimeEnv, {
        feature: 'grounded-ai',
        defaultDailyLimit: DEFAULT_GROUNDED_AI_DAILY_LIMIT,
        envLimitKey: 'GROUNDED_AI_DAILY_LIMIT',
        explicitEnableKey: 'GROUNDED_AI_ENABLED',
        explicitEnableMessage: 'Grounded AI web fallback is disabled by cost controls.',
    });
}

export async function assertAiImportAllowed(runtimeEnv) {
    await assertAiCallAllowedAsync(runtimeEnv, {
        feature: 'ai-import',
        defaultDailyLimit: DEFAULT_AI_IMPORT_DAILY_LIMIT,
        envLimitKey: 'AI_IMPORT_DAILY_LIMIT',
    });
}
