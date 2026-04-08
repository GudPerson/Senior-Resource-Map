import { Hono } from 'hono';
import { getSubCategories, createSubCategory, updateSubCategory, deleteSubCategory } from '../controllers/subCategoriesController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = new Hono();

router.get('/', getSubCategories);
router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createSubCategory);
router.put('/:id', authenticateToken, authorize('super_admin'), updateSubCategory);
router.delete('/:id', authenticateToken, authorize('super_admin'), deleteSubCategory);

export default router;
