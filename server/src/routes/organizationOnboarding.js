import { Hono } from 'hono';

import {
    getJoinRequests,
    getOnboardingRequests,
    postJoinApproval,
    postJoinRejection,
    postJoinRequest,
    postOnboardingApproval,
    postOnboardingRejection,
    postOnboardingRequest,
} from '../controllers/organizationOnboardingController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = new Hono();

router.post('/requests', postOnboardingRequest);
router.post('/join', postJoinRequest);
router.get('/requests', authenticateToken, authorize('super_admin'), getOnboardingRequests);
router.post('/requests/:requestId/approve', authenticateToken, authorize('super_admin'), postOnboardingApproval);
router.post('/requests/:requestId/reject', authenticateToken, authorize('super_admin'), postOnboardingRejection);
router.get('/join-requests', authenticateToken, getJoinRequests);
router.post('/join-requests/:requestId/approve', authenticateToken, postJoinApproval);
router.post('/join-requests/:requestId/reject', authenticateToken, postJoinRejection);

export default router;

