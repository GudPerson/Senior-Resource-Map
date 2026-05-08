import { Hono } from 'hono';
import * as authController from '../controllers/authController.js';
import * as phoneLoginController from '../controllers/phoneLoginController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/phone/start', phoneLoginController.startPhoneLogin);
router.get('/phone/:attemptId', phoneLoginController.getPhoneLoginAttempt);
router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.post('/google', authController.googleAuth);
router.post('/impersonate/:id', authenticateToken, authController.impersonate);

export default router;
