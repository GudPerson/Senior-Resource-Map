import { Hono } from 'hono';
import { authenticateToken, optionalAuth, authorize } from '../middleware/auth.js';
import {
    getHardAssets, getHardAssetById,
    createHardAsset, updateHardAsset, deleteHardAsset, createHardAssetMembershipQr,
    previewGoogleHardAssetImport, searchGoogleHardAssetImportCandidates,
    enrichHardAssetDraft,
} from '../controllers/hardAssetsController.js';

const router = new Hono();

router.get('/', optionalAuth, getHardAssets);
router.post('/import/google-candidates', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), searchGoogleHardAssetImportCandidates);
router.post('/import/google-preview', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), previewGoogleHardAssetImport);
router.post('/import/enrich-draft', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), enrichHardAssetDraft);
router.get('/:id', optionalAuth, getHardAssetById);

// Protected routes — partner/admin only
router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createHardAsset);
router.post('/:id/membership-qr', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createHardAssetMembershipQr);
router.put('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), updateHardAsset);
router.delete('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), deleteHardAsset);

export default router;
