import { Hono } from 'hono';
import { authenticateToken, optionalAuth, authorize } from '../middleware/auth.js';
import {
    getSoftAssets, getSoftAssetById,
    createSoftAsset, updateSoftAsset, deleteSoftAsset, resetSoftAssetOverrides
} from '../controllers/softAssetsController.js';

const router = new Hono();

router.get('/', optionalAuth, getSoftAssets);
router.get('/:id', optionalAuth, getSoftAssetById);

// Protected routes — partner/admin only
router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createSoftAsset);
router.put('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), updateSoftAsset);
router.post('/:id/reset-overrides', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), resetSoftAssetOverrides);
router.delete('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), deleteSoftAsset);

export default router;
