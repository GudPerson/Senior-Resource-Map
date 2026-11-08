import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import { privateBoundaryHeaders } from '../utils/boundaryRequests.js';
import { cancelBoundaryMapGuidance, getBoundaryMap, startBoundaryMap } from '../controllers/boundaryWorkflowController.js';

const router = new Hono();
router.use('*', privateBoundaryHeaders, authenticateToken);
router.post('/map', startBoundaryMap);
router.get('/map/:requestId', getBoundaryMap);
router.post('/map/:requestId/cancel', cancelBoundaryMapGuidance);
export default router;
