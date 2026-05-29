import { Hono } from 'hono';

import { getDiscoveryLocationIndicators } from '../controllers/discoveryController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = new Hono();

router.post('/location-indicators', optionalAuth, getDiscoveryLocationIndicators);

export default router;
