import { normalizePostalCode } from './postalBoundaries.js';

const SINGAPORE_BOUNDS = {
    minLat: 1.13,
    maxLat: 1.50,
    minLng: 103.50,
    maxLng: 104.15,
};

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
const LOCATION_CONTEXT_CACHE_KEY = '__carearoundDiscoveryLocationContextCache';

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

function parseCoordinate(value) {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function isSingaporeCoordinate(lat, lng) {
    return lat >= SINGAPORE_BOUNDS.minLat
        && lat <= SINGAPORE_BOUNDS.maxLat
        && lng >= SINGAPORE_BOUNDS.minLng
        && lng <= SINGAPORE_BOUNDS.maxLng;
}

function getCache() {
    globalThis[LOCATION_CONTEXT_CACHE_KEY] = globalThis[LOCATION_CONTEXT_CACHE_KEY] || new Map();
    return globalThis[LOCATION_CONTEXT_CACHE_KEY];
}

function buildCacheKey(location) {
    return `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;
}

function getGoogleMapsApiKey(env) {
    return readEnvValue(env, 'GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY');
}

function buildGoogleReverseGeocodeUrl(location, apiKey) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`);
    url.searchParams.set('region', 'sg');
    url.searchParams.set('key', apiKey);
    return url.toString();
}

function hasComponentType(component, type) {
    return Array.isArray(component?.types) && component.types.includes(type);
}

function isSingaporeResult(result) {
    const components = Array.isArray(result?.address_components) ? result.address_components : [];
    return components.some((component) => (
        hasComponentType(component, 'country')
        && (
            String(component.short_name || '').toUpperCase() === 'SG'
            || String(component.long_name || '').toLowerCase() === 'singapore'
        )
    ));
}

function extractPostalCodeFromResult(result) {
    const components = Array.isArray(result?.address_components) ? result.address_components : [];
    const postalComponent = components.find((component) => hasComponentType(component, 'postal_code'));
    return normalizePostalCode(postalComponent?.long_name || postalComponent?.short_name);
}

export function normalizeContextLocation(value) {
    const lat = parseCoordinate(value?.lat ?? value?.latitude);
    const lng = parseCoordinate(value?.lng ?? value?.longitude);
    if (lat === null || lng === null) return null;
    if (!isSingaporeCoordinate(lat, lng)) return null;
    return { lat, lng };
}

export function extractGoogleReverseGeocodePostalCode(payload) {
    const results = Array.isArray(payload?.results) ? payload.results : [];
    for (const result of results) {
        if (!isSingaporeResult(result)) continue;
        const postalCode = extractPostalCodeFromResult(result);
        if (postalCode) return postalCode;
    }
    return '';
}

export async function resolveContextPostalCodeFromLocation(locationValue, options = {}) {
    const location = normalizeContextLocation(locationValue);
    if (!location) return '';

    const cache = getCache();
    const cacheKey = buildCacheKey(location);
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.postalCode || '';
    }

    const apiKey = getGoogleMapsApiKey(options.env);
    if (!apiKey) return '';

    try {
        const response = await (options.fetchImpl || fetch)(
            buildGoogleReverseGeocodeUrl(location, apiKey),
        );
        if (!response?.ok) return '';

        const payload = await response.json().catch(() => ({}));
        const postalCode = extractGoogleReverseGeocodePostalCode(payload);
        cache.set(cacheKey, {
            postalCode,
            expiresAt: now + (Number.isFinite(options.cacheTtlMs) ? options.cacheTtlMs : DEFAULT_CACHE_TTL_MS),
        });
        return postalCode;
    } catch {
        return '';
    }
}
