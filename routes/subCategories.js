import { Router } from 'express';
import { getSubCategories, createSubCategory, deleteSubCategory } from '../controllers/subCategoriesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', getSubCategories);
router.post('/', authenticateToken, createSubCategory);
router.delete('/:id', authenticateToken, deleteSubCategory);

export default router;
