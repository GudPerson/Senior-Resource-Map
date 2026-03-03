import { Router } from 'express';
import { getSubCategories, createSubCategory, deleteSubCategory } from '../controllers/subCategoriesController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', getSubCategories);
router.post('/', authenticateToken, requireRole('admin'), createSubCategory);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteSubCategory);

export default router;
