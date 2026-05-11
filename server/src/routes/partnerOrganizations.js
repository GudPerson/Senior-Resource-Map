import { Hono } from 'hono';

import { authenticateToken, authorize } from '../middleware/auth.js';
import {
    addPartnerOrganizationStaff,
    getPartnerOrganizationStaff,
    getPartnerOrganizationStaffCandidates,
    handoverPartnerOrganizationOwner,
    listPartnerOrganizations,
    revokePartnerOrganizationStaff,
    updatePartnerOrganizationStaffRole,
} from '../controllers/partnerOrganizationsController.js';

const router = new Hono();

router.use('*', authenticateToken, authorize('super_admin', 'regional_admin'));

router.get('/', listPartnerOrganizations);
router.get('/:id/staff', getPartnerOrganizationStaff);
router.get('/:id/staff-candidates', getPartnerOrganizationStaffCandidates);
router.post('/:id/staff', addPartnerOrganizationStaff);
router.put('/:id/staff/:membershipId', updatePartnerOrganizationStaffRole);
router.delete('/:id/staff/:membershipId', revokePartnerOrganizationStaff);
router.post('/:id/handover', handoverPartnerOrganizationOwner);

export default router;
