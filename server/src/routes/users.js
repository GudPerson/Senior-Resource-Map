import { Hono } from 'hono';
import { authenticateToken, authorize } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = new Hono();

router.post('/',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.createUser
);

router.post('/bulk',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.bulkCreateUsers
);

router.get('/',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.getUsers
);

router.put('/me', authenticateToken, userController.updateProfile);

router.put('/:id/role',
    authenticateToken,
    authorize('super_admin'),
    userController.updateUserRole
);

router.delete('/:id',
    authenticateToken,
    authorize('super_admin', 'regional_admin'),
    userController.deleteUser
);

export default router;
