import { Hono } from 'hono';
import { authenticateToken, authorize } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = new Hono();

router.post('/',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    userController.createUser
);

router.post('/bulk',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    userController.bulkCreateUsers
);

router.get('/',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    userController.getUsers
);

router.put('/me', authenticateToken, userController.updateProfile);

router.put('/:id/role',
    authenticateToken,
    authorize('super_admin'),
    userController.updateUserRole
);

router.put('/:id/manager',
    authenticateToken,
    authorize('super_admin'),
    userController.updateUserManager
);

router.delete('/:id',
    authenticateToken,
    authorize('super_admin', 'regional_admin', 'partner'),
    userController.deleteUser
);

export default router;
