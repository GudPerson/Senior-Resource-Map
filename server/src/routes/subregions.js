import { Hono } from 'hono';
import { getSubregions, createSubregion, deleteSubregion, bulkCreateSubregions, bulkDeleteSubregions, bulkUploadSubregionBoundaries } from '../controllers/subregionsController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = new Hono();

router.get('/', authenticateToken, authorize('super_admin', 'regional_admin', 'partner'), getSubregions);
router.post('/', authenticateToken, authorize('super_admin'), createSubregion);
router.post('/bulk', authenticateToken, authorize('super_admin'), bulkCreateSubregions);
router.post('/boundaries/bulk', authenticateToken, authorize('super_admin', 'regional_admin'), bulkUploadSubregionBoundaries);
router.post('/bulk-delete', authenticateToken, authorize('super_admin'), bulkDeleteSubregions);
router.delete('/:id', authenticateToken, authorize('super_admin'), deleteSubregion);

export default router;
