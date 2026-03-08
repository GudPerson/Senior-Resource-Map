import { Hono } from 'hono';
import { dataStore } from '../utils/dataStore.js';

const router = new Hono();

function isFiniteCoordinate(value) {
    return Number.isFinite(Number.parseFloat(value));
}

router.get('/map-cache/:subregionId', async (c) => {
    const subregionId = c.req.param('subregionId');
    try {
        const blobKey = `locations-cache-region-${subregionId}.json`;
        const envVars = c.env;
        const data = await dataStore.getJSON(blobKey, envVars);

        if (!data) {
            return c.json({ error: 'Cache not found', data: [] }, 404);
        }

        const rows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const filtered = rows.filter((row) => isFiniteCoordinate(row?.lat) && isFiniteCoordinate(row?.lng));
        return c.json(filtered);
    } catch (err) {
        console.error('Error fetching map cache:', err);
        return c.json({ error: 'Failed to retrieve map cache' }, 500);
    }
});

export default router;
