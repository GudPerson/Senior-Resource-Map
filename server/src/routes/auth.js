import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// router.post('/register', authController.register); // Removed as per new restricted registration requirement

router.post('/login', authController.login);
router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.post('/google', authController.googleAuth);

export default router;
