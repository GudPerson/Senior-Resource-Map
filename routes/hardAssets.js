import express from 'express';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';
import {
    getHardAssets, getHardAssetById,
    createHardAsset, updateHardAsset, deleteHardAsset
} from '../controllers/hardAssetsController.js';

const router = express.Router();

router.get('/', optionalAuth, getHardAssets);
router.get('/:id', optionalAuth, getHardAssetById);

// Protected routes — partner/admin only
router.post('/', authenticateToken, requireRole('partner', 'admin'), createHardAsset);
router.put('/:id', authenticateToken, requireRole('partner', 'admin'), updateHardAsset);
router.delete('/:id', authenticateToken, requireRole('partner', 'admin'), deleteHardAsset);

export default router;
