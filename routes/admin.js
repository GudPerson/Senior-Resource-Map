import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken, isAdmin);

router.get('/export', adminController.exportFullDB);
router.post('/import', adminController.importCSV);

export default router;
