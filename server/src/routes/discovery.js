import { Hono } from 'hono';

import { getDiscoveryLocationIndicators } from '../controllers/discoveryController.js';
import { optionalAuth } from '../middleware/auth.js';
import { requirePlatformDirectoryAccess } from '../middleware/platformAccess.js';

const router = new Hono();

router.post('/location-indicators', optionalAuth, requirePlatformDirectoryAccess(), getDiscoveryLocationIndicators);

export default router;
