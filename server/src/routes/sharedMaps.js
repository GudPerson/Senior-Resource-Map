import { Hono } from 'hono';

import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { getSharedMap, postSharedMapCopy } from '../controllers/sharedMapsController.js';

const router = new Hono();

router.get('/:token', optionalAuth, getSharedMap);
router.post('/:token/copy', authenticateToken, postSharedMapCopy);

export default router;
