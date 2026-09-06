import { Hono } from 'hono';
import { currentWorkerRelease } from '../utils/workerRelease.js';

export function createReleaseRoutes({ observe = currentWorkerRelease } = {}) {
    const router = new Hono();
    router.get('/', (c) => {
        c.header('Cache-Control', 'no-store');
        const release = observe(c.env);
        return release ? c.json(release) : c.json({ error: 'Verified release metadata is unavailable.' }, 503);
    });
    return router;
}

export default createReleaseRoutes();
