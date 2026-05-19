import { Hono } from 'hono';
import { dataStore } from '../utils/dataStore.js';
import { MAP_CACHE_SCHEMA_VERSION, rebuildMapCache } from '../utils/cacheBuilder.js';

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

router.get('/map-cache/:subregionId', async (c) => {
    const subregionId = c.req.param('subregionId');
    try {
        const blobKey = `locations-cache-region-${subregionId}.json`;
        const envVars = c.env;
        let data = await dataStore.getJSON(blobKey, envVars);

        if (data && !isCurrentMapCachePayload(data) && hasMapCacheBinding(envVars)) {
            await rebuildMapCache(subregionId, envVars);
            data = await dataStore.getJSON(blobKey, envVars) || data;
        }

        if (!data) {
            return c.json({ error: 'Cache not found', data: [] }, 404);
        }

        const rows = getMapCacheRows(data);
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
        const blobKey = `locations-cache-region-${subregionId}.json`;
        const envVars = c.env;
        let data = await dataStore.getJSON(blobKey, envVars);

        if (data && !isCurrentMapCachePayload(data) && hasMapCacheBinding(envVars)) {
            await rebuildMapCache(subregionId, envVars);
            data = await dataStore.getJSON(blobKey, envVars) || data;
        }

        if (!data) {
            return c.json({ error: 'Cache not found', data: [] }, 404);
        }

        return c.json(getMapCacheRows(data));
    } catch (err) {
        console.error('Error fetching discovery cache:', err);
        return c.json({ error: 'Failed to retrieve discovery cache' }, 500);
    }
});

export default router;
