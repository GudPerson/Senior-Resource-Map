import express from 'express';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';
import {
    getSoftAssets, getSoftAssetById,
    createSoftAsset, updateSoftAsset, deleteSoftAsset
} from '../controllers/softAssetsController.js';

const router = express.Router();

router.get('/', optionalAuth, getSoftAssets);
router.get('/:id', optionalAuth, getSoftAssetById);

// Protected routes — partner/admin only
router.post('/', authenticateToken, requireRole('partner', 'admin'), createSoftAsset);
router.put('/:id', authenticateToken, requireRole('partner', 'admin'), updateSoftAsset);
router.delete('/:id', authenticateToken, requireRole('partner', 'admin'), deleteSoftAsset);

export default router;
