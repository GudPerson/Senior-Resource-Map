import { Hono } from 'hono';
import { dataStore } from '../utils/dataStore.js';
import { env } from 'hono/adapter';

const router = new Hono();

router.get('/map-cache/:subregionId', async (c) => {
    const subregionId = c.req.param('subregionId');
    try {
        const blobKey = `locations-cache-region-${subregionId}.json`;
        const envVars = env(c);
        const data = await dataStore.getJSON(blobKey, envVars);

        if (!data) {
            return c.json({ error: 'Cache not found', data: [] }, 404);
        }
        return c.json(data);
    } catch (err) {
        console.error('Error fetching map cache:', err);
        return c.json({ error: 'Failed to retrieve map cache' }, 500);
    }
});

export default router;
