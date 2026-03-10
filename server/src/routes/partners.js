import { Hono } from 'hono';
import { authenticateToken, authorize } from '../middleware/auth.js';
import {
    bulkUploadPartnerBoundaries,
    exportPartnerBoundaries,
    getPartnerBoundaries,
} from '../controllers/partnerBoundariesController.js';

const router = new Hono();

router.get('/:id/boundaries',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    getPartnerBoundaries
);

router.post('/:id/boundaries/bulk',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    bulkUploadPartnerBoundaries
);

router.get('/:id/boundaries/export',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    exportPartnerBoundaries
);

export default router;
