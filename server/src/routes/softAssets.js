import { Hono } from 'hono';
import { authenticateToken, optionalAuth, authorizeResourceOperator } from '../middleware/auth.js';
import { requireManagedResourceListAuth } from '../middleware/resourceListAuth.js';
import {
    getSoftAssets, getSoftAssetById,
    createSoftAsset, updateSoftAsset, deleteSoftAsset, resetSoftAssetOverrides, patchSoftAssetAvailability,
    getSoftAssetGroupMembers, replaceSoftAssetGroupMembers
} from '../controllers/softAssetsController.js';
import {
    addSoftAssetStaff,
    getSoftAssetStaff,
    getSoftAssetStaffCandidates,
    revokeSoftAssetStaff,
} from '../controllers/softAssetAccessController.js';
import {
    previewSoftAssetCollateralImport,
    commitSoftAssetCollateralImport,
} from '../controllers/softAssetCollateralImportController.js';

const router = new Hono();

router.get('/', optionalAuth, requireManagedResourceListAuth(), getSoftAssets);

// Protected routes — resource operators only
router.post('/import/collateral/preview', authenticateToken, authorizeResourceOperator(), previewSoftAssetCollateralImport);
router.post('/import/collateral/commit', authenticateToken, authorizeResourceOperator(), commitSoftAssetCollateralImport);
router.post('/', authenticateToken, authorizeResourceOperator(), createSoftAsset);
router.get('/:id/group-members', authenticateToken, authorizeResourceOperator(), getSoftAssetGroupMembers);
router.put('/:id/group-members', authenticateToken, authorizeResourceOperator(), replaceSoftAssetGroupMembers);
router.get('/:id/staff', authenticateToken, authorizeResourceOperator(), getSoftAssetStaff);
router.get('/:id/staff-candidates', authenticateToken, authorizeResourceOperator(), getSoftAssetStaffCandidates);
router.post('/:id/staff', authenticateToken, authorizeResourceOperator(), addSoftAssetStaff);
router.delete('/:id/staff/:membershipId', authenticateToken, authorizeResourceOperator(), revokeSoftAssetStaff);
router.get('/:id', optionalAuth, getSoftAssetById);
router.put('/:id', authenticateToken, authorizeResourceOperator(), updateSoftAsset);
router.patch('/:id/availability', authenticateToken, authorizeResourceOperator(), patchSoftAssetAvailability);
router.post('/:id/reset-overrides', authenticateToken, authorizeResourceOperator(), resetSoftAssetOverrides);
router.delete('/:id', authenticateToken, authorizeResourceOperator(), deleteSoftAsset);

export default router;
