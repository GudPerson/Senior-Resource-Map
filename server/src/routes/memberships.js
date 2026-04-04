import { Hono } from 'hono';

import { authenticateToken } from '../middleware/auth.js';
import { getMyMemberships, redeemMembershipLink } from '../controllers/membershipsController.js';

const router = new Hono();

router.get('/me', authenticateToken, getMyMemberships);
router.post('/link', authenticateToken, redeemMembershipLink);

export default router;
