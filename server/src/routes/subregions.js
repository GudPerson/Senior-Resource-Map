import { Hono } from 'hono';
import { getSubregions, createSubregion, deleteSubregion, bulkCreateSubregions, bulkDeleteSubregions } from '../controllers/subregionsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.get('/', getSubregions);
router.post('/', authenticateToken, createSubregion);
router.post('/bulk', authenticateToken, bulkCreateSubregions);
router.post('/bulk-delete', authenticateToken, bulkDeleteSubregions);
router.delete('/:id', authenticateToken, deleteSubregion);

export default router;
