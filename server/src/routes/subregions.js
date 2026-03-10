import { Hono } from 'hono';
import { getSubregions, createSubregion, deleteSubregion, bulkCreateSubregions, bulkDeleteSubregions, bulkUploadSubregionBoundaries } from '../controllers/subregionsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.get('/', authenticateToken, getSubregions);
router.post('/', authenticateToken, createSubregion);
router.post('/bulk', authenticateToken, bulkCreateSubregions);
router.post('/boundaries/bulk', authenticateToken, bulkUploadSubregionBoundaries);
router.post('/bulk-delete', authenticateToken, bulkDeleteSubregions);
router.delete('/:id', authenticateToken, deleteSubregion);

export default router;
