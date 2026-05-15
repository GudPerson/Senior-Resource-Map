import { Hono } from 'hono';
import { authenticateToken, optionalAuth, authorizeResourceOperator } from '../middleware/auth.js';
import { requireManagedResourceListAuth } from '../middleware/resourceListAuth.js';
import {
    getHardAssets, getHardAssetById,
    createHardAsset, updateHardAsset, deleteHardAsset, createHardAssetMembershipQr,
    previewGoogleHardAssetImport, searchGoogleHardAssetImportCandidates,
    enrichHardAssetDraft,
} from '../controllers/hardAssetsController.js';
import {
    addHardAssetStaff,
    getHardAssetStaff,
    getHardAssetStaffCandidates,
    revokeHardAssetStaff,
    updateHardAssetStaffRole,
} from '../controllers/hardAssetStaffController.js';

const router = new Hono();

router.get('/', optionalAuth, requireManagedResourceListAuth(), getHardAssets);
router.post('/import/google-candidates', authenticateToken, authorizeResourceOperator(), searchGoogleHardAssetImportCandidates);
router.post('/import/google-preview', authenticateToken, authorizeResourceOperator(), previewGoogleHardAssetImport);
router.post('/import/enrich-draft', authenticateToken, authorizeResourceOperator(), enrichHardAssetDraft);
router.get('/:id/staff', authenticateToken, authorizeResourceOperator(), getHardAssetStaff);
router.get('/:id/staff-candidates', authenticateToken, authorizeResourceOperator(), getHardAssetStaffCandidates);
router.post('/:id/staff', authenticateToken, authorizeResourceOperator(), addHardAssetStaff);
router.put('/:id/staff/:membershipId', authenticateToken, authorizeResourceOperator(), updateHardAssetStaffRole);
router.delete('/:id/staff/:membershipId', authenticateToken, authorizeResourceOperator(), revokeHardAssetStaff);
router.get('/:id', optionalAuth, getHardAssetById);

// Protected routes — resource operators only
router.post('/', authenticateToken, authorizeResourceOperator(), createHardAsset);
router.post('/:id/membership-qr', authenticateToken, authorizeResourceOperator(), createHardAssetMembershipQr);
router.put('/:id', authenticateToken, authorizeResourceOperator(), updateHardAsset);
router.delete('/:id', authenticateToken, authorizeResourceOperator(), deleteHardAsset);

export default router;
