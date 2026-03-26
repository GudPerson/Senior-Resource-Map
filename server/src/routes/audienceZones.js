import { Hono } from 'hono';

import { authenticateToken, authorize } from '../middleware/auth.js';
import {
    bulkDeleteAudienceZones,
    bulkUploadAudienceZoneBoundaries,
    createAudienceZone,
    deleteAudienceZone,
    getAudienceZones,
    updateAudienceZone,
} from '../controllers/audienceZonesController.js';

const router = new Hono();

router.use('*', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'));

router.get('/', getAudienceZones);
router.post('/', createAudienceZone);
router.post('/boundaries/bulk', bulkUploadAudienceZoneBoundaries);
router.post('/bulk-delete', bulkDeleteAudienceZones);
router.put('/:id', updateAudienceZone);
router.delete('/:id', deleteAudienceZone);

export default router;
