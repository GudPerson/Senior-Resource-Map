import { Hono } from 'hono';

import {
    getBoundaryLayers,
    replaceUnmappedBoundary,
    upsertRegionBoundary,
} from '../controllers/boundaryLayersController.js';
import { authenticateToken, authorize, authorizeResourceOperator } from '../middleware/auth.js';

const router = new Hono();

router.get('/', authenticateToken, authorizeResourceOperator(), getBoundaryLayers);
router.post('/regions', authenticateToken, authorize('super_admin'), upsertRegionBoundary);
router.post('/unmapped', authenticateToken, authorize('super_admin'), replaceUnmappedBoundary);

export default router;
