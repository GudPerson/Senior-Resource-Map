import { Hono } from 'hono';

import {
    getPlatformAccessSettings,
    putPlatformAccessSettings,
} from '../controllers/platformAccessController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = new Hono();

router.get('/', getPlatformAccessSettings);
router.put('/', authenticateToken, authorize('super_admin'), putPlatformAccessSettings);

export default router;
