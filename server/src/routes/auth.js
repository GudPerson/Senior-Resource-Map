import { Hono } from 'hono';
import * as authController from '../controllers/authController.js';

const router = new Hono();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.post('/google', authController.googleAuth);

export default router;
