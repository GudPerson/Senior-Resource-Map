import { Hono } from 'hono';
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.post('/google', authController.googleAuth);
router.post('/impersonate/:id', authenticateToken, authController.impersonate);

export default router;
