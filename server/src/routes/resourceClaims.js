import { Hono } from 'hono';

import {
    approveResourcePublication,
    listResourceClaimCandidates,
    listResourceClaims,
    rejectResourceClaim,
    resubmitResourceClaim,
    submitResourceClaim,
    verifyResourceClaimOwner,
    withdrawResourcePermission,
} from '../controllers/resourceClaimsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireResourceClaims } from '../utils/governedPilotRelease.js';

const router = new Hono();

router.use('*', requireResourceClaims);
router.use('*', authenticateToken);

router.get('/', listResourceClaims);
router.get('/candidates', listResourceClaimCandidates);
router.post('/', submitResourceClaim);
router.post('/:id/resubmit', resubmitResourceClaim);
router.post('/:id/verify-owner', verifyResourceClaimOwner);
router.post('/:id/approve-publication', approveResourcePublication);
router.post('/:id/reject', rejectResourceClaim);
router.post('/:id/withdraw', withdrawResourcePermission);

export default router;
