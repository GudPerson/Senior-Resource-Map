import { Hono } from 'hono';

import { authenticateToken } from '../middleware/auth.js';
import { redeemMembershipLink } from '../controllers/membershipsController.js';

const router = new Hono();

router.post('/link', authenticateToken, redeemMembershipLink);

export default router;

