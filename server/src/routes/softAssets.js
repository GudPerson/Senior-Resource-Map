import express from 'express';
import { authenticateToken, optionalAuth, authorize } from '../middleware/auth.js';
import {
    getSoftAssets, getSoftAssetById,
    createSoftAsset, updateSoftAsset, deleteSoftAsset
} from '../controllers/softAssetsController.js';

const router = express.Router();

router.get('/', optionalAuth, getSoftAssets);
router.get('/:id', optionalAuth, getSoftAssetById);

// Protected routes — partner/admin only
router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createSoftAsset);
router.put('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), updateSoftAsset);
router.delete('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), deleteSoftAsset);

export default router;
