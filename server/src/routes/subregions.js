import { Hono } from 'hono';
import { getSubregions, createSubregion, deleteSubregion } from '../controllers/subregionsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.get('/', getSubregions);
router.post('/', authenticateToken, createSubregion);
router.delete('/:id', authenticateToken, deleteSubregion);

export default router;
