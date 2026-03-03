import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// GET /api/users — admin only
router.get('/', authenticateToken, requireRole('admin'), userController.getUsers);

// PUT /api/users/me — partner updates own profile (must be before /:id to avoid conflict)
router.put('/me', authenticateToken, userController.updateProfile);

// PUT /api/users/:id/role — admin only
router.put('/:id/role', authenticateToken, requireRole('admin'), userController.updateUserRole);

// DELETE /api/users/:id — admin only
router.delete('/:id', authenticateToken, requireRole('admin'), userController.deleteUser);

export default router;
