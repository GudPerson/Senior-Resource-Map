import { Hono } from 'hono';
import { authenticateToken, optionalAuth, authorize } from '../middleware/auth.js';
import {
    getSoftAssets, getSoftAssetById,
    createSoftAsset, updateSoftAsset, deleteSoftAsset, resetSoftAssetOverrides, patchSoftAssetAvailability
} from '../controllers/softAssetsController.js';
import {
    previewSoftAssetCollateralImport,
    commitSoftAssetCollateralImport,
} from '../controllers/softAssetCollateralImportController.js';

const router = new Hono();

router.get('/', optionalAuth, getSoftAssets);

// Protected routes — partner/admin only
router.post('/import/collateral/preview', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), previewSoftAssetCollateralImport);
router.post('/import/collateral/commit', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), commitSoftAssetCollateralImport);
router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createSoftAsset);
router.get('/:id', optionalAuth, getSoftAssetById);
router.put('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), updateSoftAsset);
router.patch('/:id/availability', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), patchSoftAssetAvailability);
router.post('/:id/reset-overrides', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), resetSoftAssetOverrides);
router.delete('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), deleteSoftAsset);

export default router;
