import express from 'express';
import { dataStore } from '../utils/dataStore.js';

const router = express.Router();

router.get('/map-cache/:subregionId', async (req, res) => {
    const { subregionId } = req.params;
    try {
        const blobKey = `locations-cache-region-${subregionId}.json`;
        // Pass the request environment if we are running in a worker (Cloudflare Pages Functions)
        const data = await dataStore.getJSON(blobKey, req.cf ? { env: req.cf.env } : {});

        if (!data) {
            return res.status(404).json({ error: 'Cache not found', data: [] });
        }
        res.json(data);
    } catch (err) {
        console.error('Error fetching map cache:', err);
        res.status(500).json({ error: 'Failed to retrieve map cache' });
    }
});

export default router;
