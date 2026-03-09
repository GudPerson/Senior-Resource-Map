import { Hono } from 'hono';
import { getSubCategories, createSubCategory, deleteSubCategory } from '../controllers/subCategoriesController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = new Hono();

router.get('/', getSubCategories);
router.post('/', authenticateToken, authorize('super_admin'), createSubCategory);
router.delete('/:id', authenticateToken, authorize('super_admin'), deleteSubCategory);

export default router;
