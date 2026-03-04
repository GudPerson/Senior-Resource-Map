import express from 'express';
import { getStore } from '@netlify/blobs';

const router = express.Router();

const getCacheStore = () => getStore({
    name: 'map-cache',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_API_TOKEN,
});

router.get('/map-cache/:subregionId', async (req, res) => {
    const { subregionId } = req.params;
    try {
        const store = getCacheStore();
        const blobKey = `locations-cache-region-${subregionId}.json`;
        const data = await store.get(blobKey, { type: 'json' });

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
