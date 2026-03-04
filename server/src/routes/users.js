import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// Restricted Create User — super_admin and regional_admin only
router.post('/',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.createUser
);

// Bulk Create Users
router.post('/bulk',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.bulkCreateUsers
);

// GET /api/users — Scoped user retrieval
router.get('/',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.getUsers
);

// PUT /api/users/me — update own profile
router.put('/me', authenticateToken, userController.updateProfile);

// PUT /api/users/:id/role — super_admin only for role updates
router.put('/:id/role',
    authenticateToken,
    authorize('super_admin'),
    userController.updateUserRole
);

// DELETE /api/users/:id
router.delete('/:id',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.deleteUser
);

export default router;
