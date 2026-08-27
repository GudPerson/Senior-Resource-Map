import { Hono } from 'hono';
import { dataStore } from '../utils/dataStore.js';
import { MAP_CACHE_SCHEMA_VERSION, rebuildMapCache } from '../utils/cacheBuilder.js';
import { isAssetScheduledHidden } from '../utils/visibility.js';

const router = new Hono();

function isFiniteCoordinate(value) {
    return Number.isFinite(Number.parseFloat(value));
}

function getMapCacheRows(data) {
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.data) ? data.data : [];
}

function isCurrentMapCachePayload(data) {
    return Boolean(data)
        && !Array.isArray(data)
        && Number(data.version) === MAP_CACHE_SCHEMA_VERSION
        && Array.isArray(data.data);
}

function hasMapCacheBinding(envVars = {}) {
    return Boolean(envVars?.MAP_CACHE || envVars?.env?.MAP_CACHE);
}

const DEFAULT_CACHE_STALE_AFTER_SECONDS = 24 * 60 * 60;

function readCacheStaleAfterSeconds(envVars = {}) {
    const raw = envVars?.MAP_CACHE_STALE_AFTER_SECONDS ?? envVars?.env?.MAP_CACHE_STALE_AFTER_SECONDS;
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    return Number.isInteger(parsed) && parsed >= 60 && parsed <= 30 * 24 * 60 * 60
        ? parsed
        : DEFAULT_CACHE_STALE_AFTER_SECONDS;
}

export function buildPublicCacheObservation(data, now = new Date(), staleAfterSeconds = DEFAULT_CACHE_STALE_AFTER_SECONDS) {
    const generatedAtMs = Date.parse(String(data?.generatedAt || ''));
    if (!Number.isFinite(generatedAtMs)) {
        return { ageSeconds: null, stale: null };
    }
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const ageSeconds = Math.max(0, Math.floor((nowMs - generatedAtMs) / 1000));
    return {
        ageSeconds,
        stale: ageSeconds > staleAfterSeconds,
    };
}

function setPublicCacheObservationHeaders(c, status, data) {
    const observation = buildPublicCacheObservation(data, new Date(), readCacheStaleAfterSeconds(c.env));
    c.header('X-CareAround-Cache', status);
    c.header('X-CareAround-Cache-Stale', observation.stale === null ? 'unknown' : String(observation.stale));
    if (observation.ageSeconds !== null) {
        c.header('X-CareAround-Cache-Age', String(observation.ageSeconds));
    }
}

async function loadPublicCachePayload(c, subregionId) {
    const blobKey = `locations-cache-region-${subregionId}.json`;
    const envVars = c.env;
    let data = await dataStore.getJSON(blobKey, envVars);
    let status = data ? 'hit' : 'miss';

    if (data && !isCurrentMapCachePayload(data)) {
        status = 'legacy';
        if (hasMapCacheBinding(envVars)) {
            await rebuildMapCache(subregionId, envVars);
            const refreshed = await dataStore.getJSON(blobKey, envVars);
            if (refreshed && isCurrentMapCachePayload(refreshed)) {
                data = refreshed;
                status = 'refreshed';
            }
        }
    }

    setPublicCacheObservationHeaders(c, status, data);
    return data;
}

const CACHE_VISIBILITY_FIELDS = new Set([
    'hide_from',
    'hide_until',
    'hideFrom',
    'hideUntil',
    'location_hide_from',
    'location_hide_until',
    'locationHideFrom',
    'locationHideUntil',
]);

export function isPublicCacheRowVisible(row, now = new Date()) {
    const resourceHidden = isAssetScheduledHidden({
        hideFrom: row?.hide_from ?? row?.hideFrom,
        hideUntil: row?.hide_until ?? row?.hideUntil,
    }, now);
    const locationHidden = isAssetScheduledHidden({
        hideFrom: row?.location_hide_from ?? row?.locationHideFrom,
        hideUntil: row?.location_hide_until ?? row?.locationHideUntil,
    }, now);
    return !resourceHidden && !locationHidden;
}

export function buildPublicCacheRows(data, now = new Date()) {
    return getMapCacheRows(data)
        .filter((row) => isPublicCacheRowVisible(row, now))
        .map((row) => Object.fromEntries(
            Object.entries(row).filter(([key]) => !CACHE_VISIBILITY_FIELDS.has(key))
        ));
}

router.get('/map-cache/:subregionId', async (c) => {
    const subregionId = c.req.param('subregionId');
    try {
        const data = await loadPublicCachePayload(c, subregionId);

        if (!data) {
            return c.json({ error: 'Cache not found', data: [] }, 404);
        }

        const rows = buildPublicCacheRows(data);
        const filtered = rows.filter((row) => isFiniteCoordinate(row?.lat) && isFiniteCoordinate(row?.lng));
        return c.json(filtered);
    } catch (err) {
        console.error('Error fetching map cache:', err);
        return c.json({ error: 'Failed to retrieve map cache' }, 500);
    }
});

router.get('/discovery-cache/:subregionId', async (c) => {
    const subregionId = c.req.param('subregionId');
    try {
        const data = await loadPublicCachePayload(c, subregionId);

        if (!data) {
            return c.json({ error: 'Cache not found', data: [] }, 404);
        }

        return c.json(buildPublicCacheRows(data));
    } catch (err) {
        console.error('Error fetching discovery cache:', err);
        return c.json({ error: 'Failed to retrieve discovery cache' }, 500);
    }
});

export default router;
