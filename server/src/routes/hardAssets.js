import express from 'express';
import { authenticateToken, optionalAuth, authorize } from '../middleware/auth.js';
import {
    getHardAssets, getHardAssetById,
    createHardAsset, updateHardAsset, deleteHardAsset
} from '../controllers/hardAssetsController.js';

const router = express.Router();

router.get('/', optionalAuth, getHardAssets);
router.get('/:id', optionalAuth, getHardAssetById);

// Protected routes — partner/admin only
router.post('/', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), createHardAsset);
router.put('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), updateHardAsset);
router.delete('/:id', authenticateToken, authorize('partner', 'regional_admin', 'admin', 'super_admin'), deleteHardAsset);

export default router;
