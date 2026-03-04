import { Router } from 'express';
import { getSubCategories, createSubCategory, deleteSubCategory } from '../controllers/subCategoriesController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getSubCategories);
router.post('/', authenticateToken, authorize('admin', 'super_admin'), createSubCategory);
router.delete('/:id', authenticateToken, authorize('admin', 'super_admin'), deleteSubCategory);

export default router;
